import { handleCrawl } from "./handlers/crawlHandler.js";
import { handleVectorStore } from "./handlers/vectorHandler.js";
import { handleAskQuestion } from "./handlers/qaHandler.js";

export default function setupApiHandlers(ipcMain) {
  ipcMain.handle("crawl-forums", handleCrawl);
  ipcMain.handle("build-vector-store", handleVectorStore);
  ipcMain.handle("ask-question", handleAskQuestion);
}
