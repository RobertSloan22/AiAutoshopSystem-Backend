import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, RefreshCw, Trash2 } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  sessionId?: string;
}

interface ConversationContext {
  vehicleContext?: {
    year?: string;
    make?: string;
    model?: string;
    vin?: string;
  };
  customerContext?: {
    name?: string;
    dtcCode?: string;
  };
}

interface ConversationalChatProps {
  initialContext?: ConversationContext;
  onMessageSent?: (message: string, response: string) => void;
  className?: string;
}

export const ConversationalChat: React.FC<ConversationalChatProps> = ({
  initialContext = {},
  onMessageSent,
  className = ''
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId] = useState(() => `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [context, setContext] = useState<ConversationContext>(initialContext);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: message.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/responses/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message.trim(),
          conversationId, // 🔑 KEY: This maintains conversation context
          vehicleContext: context.vehicleContext,
          customerContext: context.customerContext
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      const decoder = new TextDecoder();
      let assistantMessage: Message = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: new Date()
      };

      // Add the assistant message to the UI immediately
      setMessages(prev => [...prev, assistantMessage]);

      let buffer = '';
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          
          // Process complete lines
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer
          
          for (const line of lines) {
            if (line.trim().startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6)); // Remove 'data: '
                
                if (data.type === 'session_started') {
                  assistantMessage.sessionId = data.sessionId;
                }
                else if (data.type === 'content' && data.content) {
                  // Stream content updates
                  assistantMessage.content += data.content;
                  
                  // Update the message in state
                  setMessages(prev => 
                    prev.map(msg => 
                      msg.id === assistantMessage.id 
                        ? { ...msg, content: assistantMessage.content }
                        : msg
                    )
                  );
                }
                else if (data.type === 'stream_complete') {
                  // Final response received
                  onMessageSent?.(message, assistantMessage.content);
                }
                else if (data.type === 'error') {
                  console.error('Stream error:', data.error);
                  assistantMessage.content += `\n\n❌ Error: ${data.error}`;
                  setMessages(prev => 
                    prev.map(msg => 
                      msg.id === assistantMessage.id 
                        ? { ...msg, content: assistantMessage.content }
                        : msg
                    )
                  );
                }
              } catch (parseError) {
                console.warn('Failed to parse SSE data:', line);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage: Message = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: `❌ Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, context, isLoading, onMessageSent]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputMessage);
  };

  const clearConversation = async () => {
    try {
      await fetch(`/api/responses/conversation/${conversationId}`, {
        method: 'DELETE'
      });
      setMessages([]);
    } catch (error) {
      console.error('Error clearing conversation:', error);
    }
  };

  const loadConversationHistory = async () => {
    try {
      const response = await fetch(`/api/responses/conversation/${conversationId}`);
      if (response.ok) {
        const data = await response.json();
        const historyMessages: Message[] = data.messages
          .filter((msg: any) => msg.role !== 'system')
          .map((msg: any, index: number) => ({
            id: `history_${index}`,
            role: msg.role,
            content: msg.content,
            timestamp: new Date(data.lastUpdated)
          }));
        setMessages(historyMessages);
      }
    } catch (error) {
      console.error('Error loading conversation history:', error);
    }
  };

  const updateContext = (newContext: Partial<ConversationContext>) => {
    setContext(prev => ({
      ...prev,
      ...newContext,
      vehicleContext: { ...prev.vehicleContext, ...newContext.vehicleContext },
      customerContext: { ...prev.customerContext, ...newContext.customerContext }
    }));
  };

  return (
    <Card className={`h-full flex flex-col ${className}`}>
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">AI Assistant Chat</h3>
            <p className="text-sm text-gray-500">Conversation ID: {conversationId}</p>
            {context.vehicleContext && (
              <p className="text-xs text-blue-600">
                Vehicle: {context.vehicleContext.year} {context.vehicleContext.make} {context.vehicleContext.model}
              </p>
            )}
            {context.customerContext?.name && (
              <p className="text-xs text-green-600">
                Customer: {context.customerContext.name}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadConversationHistory}
              title="Load conversation history"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearConversation}
              title="Clear conversation"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <p>Start a conversation! I'll remember our entire chat history.</p>
                <p className="text-sm mt-2">Try asking: "My name is [Your Name] and I drive a [Year Make Model]. Remember this."</p>
              </div>
            )}
            
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  <div className={`text-xs mt-1 opacity-70`}>
                    {message.timestamp.toLocaleTimeString()}
                    {message.sessionId && (
                      <span className="ml-2">Session: {message.sessionId.substring(0, 8)}...</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div ref={messagesEndRef} />
        </ScrollArea>

        <div className="p-4 border-t">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type your message... (context will be remembered)"
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
          
          <div className="mt-2 text-xs text-gray-500">
            💡 This chat maintains conversation context. The AI will remember previous messages in this session.
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Hook for easy integration with existing components
export const useConversationalChat = (initialContext?: ConversationContext) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId] = useState(() => `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  const sendMessage = async (message: string, context?: ConversationContext) => {
    const response = await fetch('/api/responses/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        conversationId, // 🔑 KEY: This maintains conversation context
        vehicleContext: context?.vehicleContext || initialContext?.vehicleContext,
        customerContext: context?.customerContext || initialContext?.customerContext
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.response;
  };

  const clearConversation = async () => {
    await fetch(`/api/responses/conversation/${conversationId}`, {
      method: 'DELETE'
    });
    setMessages([]);
  };

  return {
    conversationId,
    messages,
    sendMessage,
    clearConversation
  };
};

export default ConversationalChat;