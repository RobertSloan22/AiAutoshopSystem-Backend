import React, { useState, useCallback } from 'react';

interface Template {
  id: string;
  name: string;
  type: string;
  description: string;
}

interface StreamEvent {
  event: string;
  data: any;
}

const UIGeneratorExample: React.FC = () => {
  const [userInput, setUserInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [streamedContent, setStreamedContent] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState('');

  // Base API URL - adjust this to match your backend URL
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  // Get auth token - adjust based on your auth implementation
  const getAuthToken = () => {
    // Example: Get from localStorage, context, or cookies
    return localStorage.getItem('authToken') || '';
  };

  // Fetch available templates
  const fetchTemplates = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/ui/templates`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch templates');
      
      const data = await response.json();
      setTemplates(data.templates);
    } catch (err) {
      setError(`Error fetching templates: ${err.message}`);
    }
  };

  // Generate UI component using SSE
  const generateUI = async () => {
    if (!userInput.trim()) return;

    setIsGenerating(true);
    setGeneratedCode('');
    setStreamedContent('');
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/ui/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({ user_input: userInput }),
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
              handleStreamEvent(eventData);
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (err) {
      setError(`Error generating UI: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle different types of stream events
  const handleStreamEvent = (eventData: StreamEvent) => {
    switch (eventData.event) {
      case 'assistant_delta':
        // Handle assistant message deltas
        if (eventData.data.content) {
          setStreamedContent(prev => prev + eventData.data.content);
        }
        break;

      case 'function_arguments_delta':
        // Handle function argument streaming
        console.log('Function arguments delta:', eventData.data);
        break;

      case 'function_arguments_done':
        // Handle completed function call
        console.log('Function completed:', eventData.data);
        if (eventData.data.generatedUI) {
          setGeneratedCode(eventData.data.generatedUI);
        }
        break;

      case 'error':
        setError(eventData.data.message);
        break;

      case 'done':
        console.log('Stream completed');
        break;
    }
  };

  // Preview generated component
  const previewComponent = async () => {
    if (!generatedCode) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/ui/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({ 
          code: generatedCode,
          framework: 'react' 
        }),
      });

      if (!response.ok) throw new Error('Failed to preview component');
      
      const data = await response.json();
      console.log('Preview response:', data);
      // Handle preview response - could open in new window, iframe, etc.
    } catch (err) {
      setError(`Error previewing component: ${err.message}`);
    }
  };

  // Load templates on component mount
  React.useEffect(() => {
    fetchTemplates();
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">UI Generator</h1>

      {/* Templates Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Available Templates</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {templates.map(template => (
            <div
              key={template.id}
              className="border rounded-lg p-4 hover:shadow-lg cursor-pointer transition-shadow"
              onClick={() => setUserInput(`Create a ${template.name}`)}
            >
              <h3 className="font-semibold">{template.name}</h3>
              <p className="text-sm text-gray-600">{template.type}</p>
              <p className="text-sm mt-2">{template.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Input Section */}
      <div className="mb-6">
        <label htmlFor="userInput" className="block text-lg font-medium mb-2">
          Describe the UI component you want to generate:
        </label>
        <textarea
          id="userInput"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          className="w-full p-3 border rounded-lg h-32 resize-none"
          placeholder="e.g., Create a responsive form for vehicle inspection with fields for make, model, year, mileage, and condition rating with a submit button"
        />
        <button
          onClick={generateUI}
          disabled={isGenerating || !userInput.trim()}
          className={`mt-4 px-6 py-2 rounded-lg font-medium ${
            isGenerating || !userInput.trim()
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          {isGenerating ? 'Generating...' : 'Generate UI'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Streaming Content Display */}
      {streamedContent && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">AI Response:</h3>
          <div className="p-4 bg-gray-100 rounded-lg whitespace-pre-wrap">
            {streamedContent}
          </div>
        </div>
      )}

      {/* Generated Code Display */}
      {generatedCode && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold">Generated Code:</h3>
            <div className="space-x-2">
              <button
                onClick={() => navigator.clipboard.writeText(generatedCode)}
                className="px-4 py-1 bg-gray-200 hover:bg-gray-300 rounded"
              >
                Copy Code
              </button>
              <button
                onClick={previewComponent}
                className="px-4 py-1 bg-green-500 text-white hover:bg-green-600 rounded"
              >
                Preview
              </button>
            </div>
          </div>
          <pre className="p-4 bg-gray-900 text-gray-100 rounded-lg overflow-x-auto">
            <code>{generatedCode}</code>
          </pre>
        </div>
      )}

      {/* Example Usage */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold mb-2">Example Prompts:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>Create a responsive vehicle information form with fields for make, model, year, and VIN</li>
          <li>Build a service history table with sorting and filtering capabilities</li>
          <li>Generate a dashboard card showing customer details with edit functionality</li>
          <li>Create a chart component for displaying diagnostic trouble codes over time</li>
          <li>Build a technician assignment dropdown with search functionality</li>
        </ul>
      </div>
    </div>
  );
};

export default UIGeneratorExample;

// Usage in your app:
// import UIGeneratorExample from './UIGeneratorExample';
// 
// function App() {
//   return <UIGeneratorExample />;
// }