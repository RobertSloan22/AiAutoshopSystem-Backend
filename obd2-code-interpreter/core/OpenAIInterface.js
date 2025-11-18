/**
 * OpenAIInterface - Simple wrapper for OpenAI API
 */

import OpenAI from 'openai';

class OpenAIInterface {
  constructor(apiKey) {
    this.client = new OpenAI({ apiKey });
  }

  async createCompletion(params) {
    return await this.client.chat.completions.create(params);
  }
}

export default OpenAIInterface;
