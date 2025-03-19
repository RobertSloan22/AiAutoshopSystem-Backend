import axios from "axios";

export async function handleAskQuestion(event, question) {
  try {
    const response = await axios.post("http://localhost:5000/ask_question", {
      question,
    });
    return response.data;
  } catch (err) {
    console.error(err);
    return { error: err.message };
  }
}
