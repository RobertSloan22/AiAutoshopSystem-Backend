import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export const retrieveStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    
    const vectorStore = await openai.embeddings.retrieve(storeId);
    
    res.status(200).json(vectorStore);
  } catch (error) {
    console.error("Error retrieving vector store:", error);
    res.status(500).json({ error: "Error retrieving vector store" });
  }
}; 