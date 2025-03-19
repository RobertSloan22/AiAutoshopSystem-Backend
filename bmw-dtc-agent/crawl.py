import os
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from pathlib import Path
import glob
from typing import Dict, List, Optional

# Updated imports for LangChain
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import FAISS
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.docstore.document import Document
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate

###############################################################################
# 1. CODE SCANNING
###############################################################################
def scan_codebase(root_dir: str, file_extensions: List[str] = None) -> Dict[str, str]:
    """
    Scan local codebase and return dict of {filepath: content}
    """
    if file_extensions is None:
        file_extensions = ['.py', '.js', '.ts', '.jsx', '.tsx', '.json', '.yml', '.yaml']

    codebase = {}
    root_path = Path(root_dir)

    # Define directories to ignore
    ignore_dirs = {'.git', 'node_modules', 'venv', '__pycache__', 'build', 'dist'}

    for ext in file_extensions:
        for filepath in root_path.rglob(f'*{ext}'):
            # Skip ignored directories
            if any(ignore_dir in filepath.parts for ignore_dir in ignore_dirs):
                continue

            try:
                relative_path = filepath.relative_to(root_path)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                codebase[str(relative_path)] = content
            except Exception as e:
                print(f"[ERROR] Failed to read {filepath}: {e}")

    return codebase

def process_code_for_context(codebase: Dict[str, str]) -> List[Document]:
    """
    Process codebase into documents suitable for embedding
    """
    documents = []

    # Special splitter for code that tries to keep logical blocks together
    code_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1500,
        chunk_overlap=200,
        length_function=len,
        separators=["\n\n", "\n", " ", ""]
    )

    for filepath, content in codebase.items():
        chunks = code_splitter.create_documents(
            [content],
            metadatas=[{"source": filepath, "type": "code"}]
        )
        documents.extend(chunks)

    return documents

###############################################################################
# 2. DOCUMENTATION CRAWLING (Your existing crawl functions here...)
###############################################################################
def scrape_page(url: str) -> str:
    """
    Fetch and return the visible text of a page as a single string.
    """
    try:
        response = requests.get(url)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Get the main content div (adjust selector based on the site structure)
        content = soup.find('div', {'class': 'markdown'}) or soup

        # Remove scripts, styles, and navigation elements
        for element in content(['script', 'style', 'nav', 'header', 'footer']):
            element.decompose()

        # Extract text
        text = content.get_text(separator="\n")
        # Clean up
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        clean_text = "\n".join(lines)
        return clean_text

    except requests.exceptions.RequestException as e:
        print(f"[ERROR] Failed to fetch {url}: {e}")
        return ""

def get_all_links(url: str, response_text: str) -> list:
    """
    Extract all <a> tag href links from the given HTML,
    returns absolute URLs belonging to the same domain/path.
    """
    soup = BeautifulSoup(response_text, "html.parser")
    base_domain = urlparse(url).netloc
    base_path = "/eliza/docs/"  # Specific to elizaos docs

    links = []
    for a_tag in soup.find_all("a", href=True):
        href = a_tag["href"]
        absolute_url = urljoin(url, href)
        parsed_url = urlparse(absolute_url)

        # Only keep links that:
        # 1. Are on the same domain
        # 2. Are in the docs section
        # 3. Don't have fragments (#)
        if (parsed_url.netloc == base_domain and
            base_path in parsed_url.path and
            not parsed_url.fragment):
            links.append(absolute_url)

    return list(set(links))  # Remove duplicates

def crawl_docs(start_url: str, max_pages: int = 100) -> dict:
    """
    Crawls the documentation site from the start_url, up to max_pages.
    Returns {url: text_content}.
    """
    visited = set()
    to_visit = [start_url]
    scraped_data = {}

    while to_visit and len(visited) < max_pages:
        current_url = to_visit.pop(0)
        if current_url in visited:
            continue

        print(f"[CRAWL] Visiting: {current_url}")
        visited.add(current_url)

        try:
            response = requests.get(current_url)
            response.raise_for_status()

            page_text = scrape_page(current_url)
            if page_text:
                scraped_data[current_url] = page_text

                # Find more links to visit
                links = get_all_links(current_url, response.text)
                for link in links:
                    if link not in visited and link not in to_visit:
                        to_visit.append(link)

        except Exception as e:
            print(f"[ERROR] Failed processing {current_url}: {e}")

    return scraped_data

###############################################################################
# 3. VECTOR STORE BUILDING
###############################################################################
def build_vector_store(docs_data: dict, codebase: Optional[Dict[str, str]] = None) -> FAISS:
    """
    Build vector store from both documentation and codebase
    """
    all_documents = []

    # Process documentation
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len
    )

    for url, text in docs_data.items():
        docs = text_splitter.create_documents(
            [text],
            metadatas=[{"source": url, "type": "documentation"}]
        )
        all_documents.extend(docs)

    # Process codebase if provided
    if codebase:
        code_documents = process_code_for_context(codebase)
        all_documents.extend(code_documents)

    embeddings = OpenAIEmbeddings()
    vector_store = FAISS.from_documents(all_documents, embeddings)
    return vector_store

###############################################################################
# 4. ENHANCED QA CHAIN
###############################################################################
def build_qa_chain(vector_store: FAISS) -> RetrievalQA:
    """
    Creates an enhanced RetrievalQA chain that can handle code generation
    """
    retriever = vector_store.as_retriever(
        search_type="similarity",
        search_kwargs={"k": 4}
    )

    # Enhanced prompt template for code generation
    prompt_template = """You are a helpful automotive assistant and researcher. Use the following context to answer the question or generate code as requested.

    Context:
    {context}

    Question: {question}

    If diagnosing a vehicle:
    - Use the context to diagnose the vehicle
    - Provide a detailed explanation of the diagnosis
    - Provide a list of recommended fixes
    - Provide a list of parts needed
    - Provide a list of tools needed
    - Provide a list of safety precautions
    

    Answer:"""

    PROMPT = PromptTemplate(
        template=prompt_template,
        input_variables=["context", "question"]
    )

    llm = ChatOpenAI(
        model_name="gpt-3.5-turbo-16k",  # Using 16k for larger context
        temperature=0.2
    )

    qa_chain = RetrievalQA.from_chain_type(
        llm=llm,
        chain_type="stuff",
        retriever=retriever,
        chain_type_kwargs={"prompt": PROMPT},
        return_source_documents=True
    )
    return qa_chain

###############################################################################
# 5. FILE GENERATION
###############################################################################
def generate_file(qa_chain: RetrievalQA, filepath: str, description: str) -> str:
    """
   Generate a step by step guide for a vehicle repair
    """
    prompt = f"""Please generate a step by step guide for a vehicle repair.
    Requirements: {description}

    The step by step guide should:
    1. Be written in a way that is easy to understand
    2. Be written in a way that is easy to follow
    3. Be written in a way that is easy to implement
    4. Be written in a way that is easy to remember
    5. Be written in a way that is easy to update
    6. Be written in a way that is easy to verify
    7. Be written in a way that is easy to troubleshoot
    8. Be written in a way that is easy to maintain

    Please provide the complete file contents."""

    result = qa_chain.invoke({"query": prompt})
    return result["result"]

def save_generated_file(filepath: str, content: str) -> None:
    """
    Save generated content to file, creating directories if needed
    """
    file_path = Path(filepath)
    file_path.parent.mkdir(parents=True, exist_ok=True)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"[INFO] Generated file saved to: {filepath}")

###############################################################################
# 6. MAIN WORKFLOW
###############################################################################
def main():
    # Ensure OpenAI API key is set
    if not os.getenv("OPENAI_API_KEY"):
        raise ValueError("Please set OPENAI_API_KEY environment variable")

    # 6A: Scan local codebase
    print("[INFO] Scanning local codebase...")
    codebase = scan_codebase(".")  # Scan current directory
    print(f"[INFO] Found {len(codebase)} files in codebase")

    # 6B: Crawl the docs site
    root_url = "https://x.com/seraphagent"
    print("[INFO] Starting documentation crawl...")
    docs_data = crawl_docs(root_url, max_pages=100)
    print(f"[INFO] Completed crawling. Found {len(docs_data)} doc pages")

    # 6C: Build unified vector store
    print("[INFO] Building vector store...")
    vector_store = build_vector_store(docs_data, codebase)
    print("[INFO] Vector store built")

    # 6D: Create QA chain
    print("[INFO] Creating QA chain...")
    qa_chain = build_qa_chain(vector_store)
    print("[INFO] QA chain ready")

    # 6E: Interactive loop
    print("\nEnter commands ('quit' to exit):")
    print("1. Ask a question: Just type your question")
    print("2. Generate file: 'generate <filepath>: <description>'")

    while True:
        user_input = input("\nCommand: ").strip()
        if user_input.lower() in ('quit', 'exit', 'q'):
            break

        try:
            if user_input.startswith('generate '):
                # Parse generate command
                _, rest = user_input.split('generate ', 1)
                filepath, description = rest.split(':', 1)
                filepath = filepath.strip()
                description = description.strip()

                # Generate and save file
                content = generate_file(qa_chain, filepath, description)
                save_generated_file(filepath, content)

            else:
                # Regular question
                result = qa_chain.invoke({"query": user_input})
                print("\n[ANSWER]")
                print(result["result"])

                # Print sources
                print("\n[SOURCES]")
                for doc in result["source_documents"]:
                    source_type = doc.metadata.get('type', 'unknown')
                    source = doc.metadata['source']
                    print(f"- [{source_type}] {source}")

        except Exception as e:
            print(f"[ERROR] Failed to process command: {e}")

if __name__ == "__main__":
    main()