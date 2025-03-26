import OpenAI from "openai";

const openai = new OpenAI();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const vectorStoreId = searchParams.get("vector_store_id");

  try {
    const vectorStore = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: vectorStoreId || ""
    });
    return new Response(JSON.stringify(vectorStore), { status: 200 });
  } catch (error) {
    console.error("Error fetching files:", error);
    return new Response("Error fetching files", { status: 500 });
  }
}
