import axios from "axios";

export async function handleCrawl(event, urls, maxPages) {
  try {
    const response = await axios.post("http://localhost:5000/crawl", {
      urls,
      max_pages: maxPages,
    });
    return response.data;
  } catch (err) {
    console.error(err);
    return { error: err.message };
  }
}
