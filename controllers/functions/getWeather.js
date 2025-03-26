import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export const getWeather = async (req, res) => {
  try {
    const { location } = req.query;

    if (!location) {
      return res.status(400).json({ error: "Location parameter is required" });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a weather expert. Provide weather information for the given location."
        },
        {
          role: "user",
          content: `What's the weather like in ${location}?`
        }
      ],
      temperature: 0.7,
      max_tokens: 150
    });

    const weatherInfo = completion.choices[0]?.message?.content;
    res.status(200).json({ weather: weatherInfo });
  } catch (error) {
    console.error("Error getting weather:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get weather information"
    });
  }
}; 