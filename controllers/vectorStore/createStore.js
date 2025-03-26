import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export const createStore = async (req, res) => {
  try {
    const { name } = req.body;
    
    const vectorStore = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: name
    });

    res.status(200).json(vectorStore);
  } catch (error) {
    console.error("Error creating vector store:", error);
    res.status(500).json({ error: "Error creating vector store" });
  }
}; 