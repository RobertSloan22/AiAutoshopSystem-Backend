import React, { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader, Image, BarChart3, Search, Activity, AlertTriangle } from 'lucide-react'
import { responsesAPI, streamingUtils } from '../services/api'
import { useAppContext } from '../context/AppContext'
import { ChatMessage } from '../components/Chat/ChatMessage'
import { ChartDisplay } from '../components/Charts/ChartDisplay'
import { VehicleSelector } from '../components/Vehicle/VehicleSelector'
import { MessageInput } from '../components/Chat/MessageInput'

export function DiagnosticChat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [charts, setCharts] = useState([])
  const [searchResults, setSearchResults] = useState([])
  const [sessionId, setSessionId] = useState(null)
  const messagesEndRef = useRef(null)
  const abortControllerRef = useRef(null)
  const currentMessageRef = useRef('')

  const { currentVehicle, systemStatus, showError, showSuccess } = useAppContext()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim() || isStreaming) return

    const userMessage = input.trim()
    setInput('')
    setIsStreaming(true)

    // Add user message
    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMsg])

    // Add placeholder assistant message
    const assistantMessageId = Date.now() + 1
    const assistantMsg = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      isStreaming: true,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, assistantMsg])

    currentMessageRef.current = ''

    try {
      // Create abort controller for cancellation
      abortControllerRef.current = streamingUtils.createAbortController()

      const reader = await responsesAPI.createStreamingSession(
        userMessage,
        currentVehicle ? {
          year: currentVehicle.year,
          make: currentVehicle.make,
          model: currentVehicle.model,
          vin: currentVehicle.vin
        } : {},
        {
          name: 'Customer',
          dtcCode: extractDTCCode(userMessage)
        }
      )

      await streamingUtils.processSSEStream(reader, {
        session_started: (data) => {
          setSessionId(data.sessionId)
          console.log('Session started:', data.sessionId)
        },

        content: (data) => {
          currentMessageRef.current += data.content
          setMessages(prev => prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, content: currentMessageRef.current }
              : msg
          ))
        },

        tool_call_progress: (data) => {
          console.log('Tool executing:', data.tool, data.status)
          // Show tool execution status
          setMessages(prev => prev.map(msg =>
            msg.id === assistantMessageId
              ? { 
                  ...msg, 
                  toolStatus: { tool: data.tool, status: data.status }
                }
              : msg
          ))
        },

        tool_calls_started: (data) => {
          console.log('Tool calls started:', data.tools)
        },

        tool_calls_completed: (data) => {
          console.log('Tool calls completed:', data)
          
          // Process charts from tool results
          if (data.results) {
            data.results.forEach(result => {
              try {
                const toolResult = typeof result.content === 'string' 
                  ? JSON.parse(result.content) 
                  : result.content

                // Handle charts from Python execution
                if (toolResult.plots && toolResult.plots.length > 0) {
                  setCharts(prev => [...prev, ...toolResult.plots])
                }

                // Handle web search results
                if (toolResult.results && Array.isArray(toolResult.results)) {
                  setSearchResults(prev => [...prev, ...toolResult.results])
                }
              } catch (error) {
                console.error('Error processing tool result:', error)
              }
            })
          }

          // Clear tool status
          setMessages(prev => prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, toolStatus: null }
              : msg
          ))
        },

        stream_complete: () => {
          console.log('Stream completed')
          setMessages(prev => prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, isStreaming: false }
              : msg
          ))
          setIsStreaming(false)
          showSuccess('Response completed successfully')
        },

        error: (data) => {
          console.error('Stream error:', data)
          setMessages(prev => prev.map(msg =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: `Error: ${data.message || 'An unexpected error occurred'}`,
                  isStreaming: false,
                  error: true
                }
              : msg
          ))
          setIsStreaming(false)
          showError(data.message || 'Failed to process request')
        }
      })

    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? {
              ...msg,
              content: `Error: ${error.message || 'Failed to connect to AI assistant'}`,
              isStreaming: false,
              error: true
            }
          : msg
      ))
      setIsStreaming(false)
      showError(error.message || 'Failed to connect to AI assistant')
    }
  }

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsStreaming(false)
      showSuccess('Request cancelled')
    }
  }

  const extractDTCCode = (message) => {
    const dtcPattern = /[PpBbCcUu][0-9][0-9][0-9][0-9]/g
    const matches = message.match(dtcPattern)
    return matches ? matches[0].toUpperCase() : null
  }

  const clearChat = () => {
    setMessages([])
    setCharts([])
    setSearchResults([])
    setSessionId(null)
  }

  const systemOffline = systemStatus.backend === 'offline'

  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              AI Diagnostic Assistant
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Advanced automotive diagnostics with web search, OBD2 data, and analytics
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <VehicleSelector />
            
            {sessionId && (
              <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                Session: {sessionId.slice(-8)}
              </div>
            )}
            
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="btn btn-secondary btn-sm"
                disabled={isStreaming}
              >
                Clear Chat
              </button>
            )}
          </div>
        </div>
      </div>

      {/* System Status Warning */}
      {systemOffline && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
            <span className="text-sm text-red-800">
              AI Assistant is offline. Please check system status.
            </span>
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Welcome to AI Diagnostic Assistant
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                Ask me about vehicle diagnostics, DTC codes, repair procedures, or upload images for analysis.
                I can search the web, analyze OBD2 data, and create charts to help you.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                <ExamplePrompt
                  title="Diagnostic Code Analysis"
                  description="What does DTC P0301 mean for a 2020 Toyota Camry?"
                  onClick={setInput}
                />
                <ExamplePrompt
                  title="Performance Analysis"
                  description="Analyze my OBD2 data and create a performance chart"
                  onClick={setInput}
                />
                <ExamplePrompt
                  title="Research TSBs"
                  description="Find technical service bulletins for cylinder misfire issues"
                  onClick={setInput}
                />
                <ExamplePrompt
                  title="Repair Guidance"
                  description="How do I diagnose an engine misfire step by step?"
                  onClick={setInput}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isStreaming={message.isStreaming}
                  toolStatus={message.toolStatus}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Charts Display */}
      {charts.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <ChartDisplay
            charts={charts}
            onClear={() => setCharts([])}
            title="Generated Charts"
          />
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
              <Search className="h-5 w-5 mr-2" />
              Web Search Results ({searchResults.length})
            </h3>
            <button
              onClick={() => setSearchResults([])}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear Results
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-64 overflow-y-auto">
            {searchResults.slice(0, 6).map((result, index) => (
              <SearchResultCard key={index} result={result} />
            ))}
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
        <MessageInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          onStop={handleStop}
          isStreaming={isStreaming}
          disabled={systemOffline}
          placeholder={
            systemOffline
              ? "AI Assistant is offline..."
              : currentVehicle
              ? `Ask about your ${currentVehicle.year} ${currentVehicle.make} ${currentVehicle.model}...`
              : "Ask me about vehicle diagnostics, DTC codes, or upload images..."
          }
        />
      </div>
    </div>
  )
}

function ExamplePrompt({ title, description, onClick }) {
  return (
    <button
      onClick={() => onClick(description)}
      className="text-left p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
    >
      <h4 className="font-medium text-gray-900 dark:text-white mb-1">
        {title}
      </h4>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {description}
      </p>
    </button>
  )
}

function SearchResultCard({ result }) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-1 line-clamp-1">
        {result.title}
      </h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">
        {result.snippet}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-automotive-600 dark:text-automotive-400">
          {result.source}
        </span>
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          View →
        </a>
      </div>
    </div>
  )
}