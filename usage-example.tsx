import React, { useState } from 'react';
import { ConversationalChat, useConversationalChat } from './ConversationalChat';

// Example 1: Full Component Usage
export const DiagnosticChatPage: React.FC = () => {
  const [vehicleInfo, setVehicleInfo] = useState({
    year: '2020',
    make: 'Honda',
    model: 'Civic',
    vin: 'JH4KA7561PC123456'
  });

  const [customerInfo, setCustomerInfo] = useState({
    name: 'Sarah Johnson',
    dtcCode: 'P0420'
  });

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Vehicle Diagnostic Chat</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vehicle Info Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <h3 className="font-semibold mb-2">Vehicle Information</h3>
            <div className="space-y-2 text-sm">
              <div>Year: {vehicleInfo.year}</div>
              <div>Make: {vehicleInfo.make}</div>
              <div>Model: {vehicleInfo.model}</div>
              <div>VIN: {vehicleInfo.vin}</div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-2">Customer Information</h3>
            <div className="space-y-2 text-sm">
              <div>Name: {customerInfo.name}</div>
              <div>DTC Code: {customerInfo.dtcCode}</div>
            </div>
          </div>
        </div>

        {/* Chat Panel */}
        <div className="lg:col-span-2">
          <ConversationalChat
            initialContext={{
              vehicleContext: vehicleInfo,
              customerContext: customerInfo
            }}
            onMessageSent={(message, response) => {
              console.log('Message sent:', message);
              console.log('AI Response:', response);
              // You could save to database, analytics, etc.
            }}
            className="h-[600px]"
          />
        </div>
      </div>
    </div>
  );
};

// Example 2: Hook Usage for Custom Implementation
export const CustomChatImplementation: React.FC = () => {
  const [currentMessage, setCurrentMessage] = useState('');
  const [responses, setResponses] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const { conversationId, sendMessage, clearConversation } = useConversationalChat({
    vehicleContext: {
      year: '2019',
      make: 'Ford',
      model: 'F-150'
    },
    customerContext: {
      name: 'Mike Wilson'
    }
  });

  const handleSend = async () => {
    if (!currentMessage.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const response = await sendMessage(currentMessage);
      setResponses(prev => [...prev, `You: ${currentMessage}`, `AI: ${response}`]);
      setCurrentMessage('');
    } catch (error) {
      console.error('Error:', error);
      setResponses(prev => [...prev, `Error: ${error}`]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Custom Chat Implementation</h2>
          <p className="text-sm text-gray-500">Conversation ID: {conversationId}</p>
        </div>
        
        <div className="p-4">
          <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
            {responses.length === 0 && (
              <p className="text-gray-500 text-center py-8">
                Start chatting! The AI will remember our conversation.
              </p>
            )}
            {responses.map((response, index) => (
              <div key={index} className="text-sm">
                {response}
              </div>
            ))}
          </div>
          
          <div className="flex gap-2">
            <input
              type="text"
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type your message..."
              disabled={isLoading}
              className="flex-1 px-3 py-2 border rounded-md"
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !currentMessage.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50"
            >
              {isLoading ? 'Sending...' : 'Send'}
            </button>
          </div>
          
          <button
            onClick={clearConversation}
            className="mt-2 text-sm text-red-600 hover:text-red-800"
          >
            Clear Conversation History
          </button>
        </div>
      </div>
    </div>
  );
};

// Example 3: Integration with Existing Diagnostic Flow
export const DiagnosticWorkflow: React.FC = () => {
  const [step, setStep] = useState<'vehicle-info' | 'chat' | 'results'>('vehicle-info');
  const [vehicleContext, setVehicleContext] = useState({});
  const [chatHistory, setChatHistory] = useState<Array<{message: string, response: string}>>([]);

  const { conversationId, sendMessage } = useConversationalChat();

  const handleDiagnosticChat = async (message: string) => {
    try {
      const response = await sendMessage(message, { vehicleContext });
      setChatHistory(prev => [...prev, { message, response }]);
      return response;
    } catch (error) {
      console.error('Diagnostic chat error:', error);
      throw error;
    }
  };

  if (step === 'vehicle-info') {
    return (
      <div className="max-w-md mx-auto p-6">
        <h2 className="text-xl font-bold mb-4">Vehicle Information</h2>
        {/* Vehicle info form */}
        <button
          onClick={() => setStep('chat')}
          className="w-full py-2 bg-blue-600 text-white rounded-md"
        >
          Start Diagnostic Chat
        </button>
      </div>
    );
  }

  if (step === 'chat') {
    return (
      <div className="h-screen">
        <div className="p-4 bg-gray-50 border-b">
          <h2 className="text-lg font-semibold">Diagnostic Session</h2>
          <p className="text-sm text-gray-600">Conversation: {conversationId}</p>
        </div>
        
        <ConversationalChat
          initialContext={{ vehicleContext }}
          onMessageSent={(message, response) => {
            setChatHistory(prev => [...prev, { message, response }]);
          }}
          className="flex-1"
        />
        
        <div className="p-4 bg-gray-50 border-t">
          <button
            onClick={() => setStep('results')}
            className="w-full py-2 bg-green-600 text-white rounded-md"
          >
            Complete Diagnosis
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-xl font-bold mb-4">Diagnostic Results</h2>
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold mb-2">Chat Summary ({chatHistory.length} exchanges)</h3>
        <div className="space-y-4">
          {chatHistory.map((exchange, index) => (
            <div key={index} className="border-l-2 border-blue-200 pl-4">
              <div className="text-sm font-medium">Q: {exchange.message}</div>
              <div className="text-sm text-gray-600 mt-1">A: {exchange.response.substring(0, 200)}...</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DiagnosticChatPage;