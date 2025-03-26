import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export const addFile = async (req, res) => {
  try {
    const { storeId, content } = req.body;
    
    const embedding = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: content
    });

    // Here you would typically store the embedding in your database
    // associated with the storeId and content
    
    res.status(200).json({ message: "File added successfully", embedding });
  } catch (error) {
    console.error("Error adding file to vector store:", error);
    res.status(500).json({ error: "Error adding file to vector store" });
  }
}; 