import axios from "axios";

export async function handleVectorStore() {
  try {
    const response = await axios.post("http://localhost:5000/build_vector_store");
    return response.data;
  } catch (err) {
    console.error(err);
    return { error: err.message };
  }
}
