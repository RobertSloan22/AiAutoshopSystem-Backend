import { useState, useCallback } from 'react';

interface UseUIGeneratorOptions {
  apiUrl?: string;
  getAuthToken?: () => string;
}

interface StreamEvent {
  event: string;
  data: any;
}

export const useUIGenerator = (options: UseUIGeneratorOptions = {}) => {
  const {
    apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000',
    getAuthToken = () => localStorage.getItem('authToken') || ''
  } = options;

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [streamedContent, setStreamedContent] = useState('');
  const [error, setError] = useState('');

  const generateUI = useCallback(async (prompt: string) => {
    setIsGenerating(true);
    setGeneratedCode('');
    setStreamedContent('');
    setError('');

    try {
      const response = await fetch(`${apiUrl}/api/ui/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({ user_input: prompt }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response body');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.slice(6)) as StreamEvent;
              
              switch (eventData.event) {
                case 'assistant_delta':
                  if (eventData.data.content) {
                    setStreamedContent(prev => prev + eventData.data.content);
                  }
                  break;

                case 'function_arguments_done':
                  if (eventData.data.generatedUI) {
                    setGeneratedCode(eventData.data.generatedUI);
                  }
                  break;

                case 'error':
                  setError(eventData.data.message);
                  break;
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  }, [apiUrl, getAuthToken]);

  const reset = useCallback(() => {
    setGeneratedCode('');
    setStreamedContent('');
    setError('');
  }, []);

  return {
    generateUI,
    isGenerating,
    generatedCode,
    streamedContent,
    error,
    reset
  };
};

// Example usage:
/*
import React, { useState } from 'react';
import { useUIGenerator } from './useUIGenerator';

function MyComponent() {
  const [prompt, setPrompt] = useState('');
  const { generateUI, isGenerating, generatedCode, error } = useUIGenerator();

  const handleGenerate = () => {
    if (prompt.trim()) {
      generateUI(prompt);
    }
  };

  return (
    <div>
      <input
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe your UI component..."
      />
      <button onClick={handleGenerate} disabled={isGenerating}>
        {isGenerating ? 'Generating...' : 'Generate'}
      </button>
      
      {error && <div className="error">{error}</div>}
      
      {generatedCode && (
        <pre>
          <code>{generatedCode}</code>
        </pre>
      )}
    </div>
  );
}
*/