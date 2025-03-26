import OpenAI from "openai";

const openai = new OpenAI();

export async function POST(request: Request) {
  const { vectorStoreId, fileId } = await request.json();
  try {
    const vectorStore = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: fileId
    });
    return new Response(JSON.stringify(vectorStore), { status: 200 });
  } catch (error) {
    console.error("Error adding file:", error);
    return new Response("Error adding file", { status: 500 });
  }
}
