import React from 'react'
import { Bot, User, Loader, Wrench, Search, BarChart3, AlertTriangle } from 'lucide-react'
import { motion } from 'framer-motion'

const toolIcons = {
  execute_python_code: BarChart3,
  web_search: Search,
  search_technical_images: Search,
  scan_obd2_adapters: Wrench,
  connect_obd2_adapter: Wrench,
  get_obd2_live_data: Wrench,
  read_dtc_codes: Wrench,
}

export function ChatMessage({ message, isStreaming, toolStatus }) {
  const isUser = message.role === 'user'
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`flex max-w-3xl ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div className={`flex-shrink-0 ${isUser ? 'ml-3' : 'mr-3'}`}>
          <div className={`
            w-8 h-8 rounded-full flex items-center justify-center
            ${isUser 
              ? 'bg-automotive-500 text-white' 
              : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }
          `}>
            {isUser ? (
              <User className="w-4 h-4" />
            ) : (
              <Bot className="w-4 h-4" />
            )}
          </div>
        </div>

        {/* Message Content */}
        <div className={`
          px-4 py-2 rounded-lg max-w-full
          ${isUser
            ? 'bg-automotive-500 text-white rounded-br-none'
            : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600 rounded-bl-none'
          }
        `}>
          {/* Tool Status */}
          {toolStatus && (
            <div className="mb-2 flex items-center space-x-2 text-sm opacity-75">
              <ToolStatusIndicator toolStatus={toolStatus} />
            </div>
          )}

          {/* Message Text */}
          <div className="text-sm whitespace-pre-wrap">
            {message.content}
            {isStreaming && (
              <span className="inline-flex items-center ml-1">
                <Loader className="w-3 h-3 animate-spin" />
              </span>
            )}
          </div>

          {/* Error State */}
          {message.error && (
            <div className="mt-2 flex items-center space-x-2 text-red-400">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs">Failed to process request</span>
            </div>
          )}

          {/* Timestamp */}
          <div className={`
            text-xs mt-1 
            ${isUser ? 'text-automotive-200' : 'text-gray-400 dark:text-gray-500'}
          `}>
            {message.timestamp?.toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function ToolStatusIndicator({ toolStatus }) {
  const { tool, status } = toolStatus
  const ToolIcon = toolIcons[tool] || Wrench

  const statusConfig = {
    executing: { color: 'text-blue-500', label: 'Executing' },
    completed: { color: 'text-green-500', label: 'Completed' },
    error: { color: 'text-red-500', label: 'Error' },
  }

  const config = statusConfig[status] || statusConfig.executing

  return (
    <div className="flex items-center space-x-1">
      <ToolIcon className={`w-3 h-3 ${config.color}`} />
      <span className={config.color}>
        {getToolDisplayName(tool)} - {config.label}
      </span>
      {status === 'executing' && <Loader className="w-3 h-3 animate-spin" />}
    </div>
  )
}

function getToolDisplayName(toolName) {
  const displayNames = {
    execute_python_code: 'Python Analysis',
    web_search: 'Web Search',
    search_technical_images: 'Image Search',
    scan_obd2_adapters: 'Scanning OBD2',
    connect_obd2_adapter: 'Connecting OBD2',
    get_obd2_live_data: 'Reading Live Data',
    read_dtc_codes: 'Reading DTC Codes',
  }

  return displayNames[toolName] || toolName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}