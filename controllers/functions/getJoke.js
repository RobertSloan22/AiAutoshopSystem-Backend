import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export const getJoke = async (req, res) => {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a comedian. Tell a funny joke."
        }
      ],
      temperature: 0.7,
      max_tokens: 150
    });

    const joke = completion.choices[0]?.message?.content;
    res.status(200).json({ joke });
  } catch (error) {
    console.error("Error getting joke:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get joke"
    });
  }
}; 