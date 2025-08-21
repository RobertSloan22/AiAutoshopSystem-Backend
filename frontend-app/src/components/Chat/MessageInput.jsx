import React, { useState, useRef } from 'react'
import { Send, Square, Paperclip, Image as ImageIcon } from 'lucide-react'
import { useDropzone } from 'react-dropzone'

export function MessageInput({ 
  value, 
  onChange, 
  onSubmit, 
  onStop,
  onImageUpload,
  isStreaming, 
  disabled, 
  placeholder = "Type your message..." 
}) {
  const [attachments, setAttachments] = useState([])
  const textareaRef = useRef(null)

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    multiple: true,
    maxSize: 10 * 1024 * 1024, // 10MB
    onDrop: (acceptedFiles) => {
      const newAttachments = acceptedFiles.map(file => ({
        id: Date.now() + Math.random(),
        file,
        preview: URL.createObjectURL(file),
        type: 'image'
      }))
      setAttachments(prev => [...prev, ...newAttachments])
    }
  })

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (disabled || (!value.trim() && attachments.length === 0)) return

    // Process attachments if any
    if (attachments.length > 0 && onImageUpload) {
      onImageUpload(attachments)
    }

    onSubmit(e)
    setAttachments([])
  }

  const removeAttachment = (id) => {
    setAttachments(prev => {
      const updated = prev.filter(att => att.id !== id)
      // Clean up preview URLs
      const removed = prev.find(att => att.id === id)
      if (removed?.preview) {
        URL.revokeObjectURL(removed.preview)
      }
      return updated
    })
  }

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
    }
  }

  React.useEffect(() => {
    adjustTextareaHeight()
  }, [value])

  return (
    <div className="space-y-3">
      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="relative group">
              <img
                src={attachment.preview}
                alt="Attachment preview"
                className="w-16 h-16 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
              />
              <button
                onClick={() => removeAttachment(attachment.id)}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex items-end space-x-3">
        <div className="flex-1 relative">
          {/* Drag and Drop Overlay */}
          {isDragActive && (
            <div className="absolute inset-0 bg-automotive-50 dark:bg-automotive-900 border-2 border-dashed border-automotive-300 dark:border-automotive-600 rounded-lg flex items-center justify-center z-10">
              <div className="text-center">
                <ImageIcon className="mx-auto h-8 w-8 text-automotive-500" />
                <p className="mt-2 text-sm text-automotive-600 dark:text-automotive-400">
                  Drop images here to analyze
                </p>
              </div>
            </div>
          )}

          {/* Text Input */}
          <div className="relative">
            <textarea
              {...getRootProps()}
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className={`
                w-full pr-12 py-3 pl-4 border border-gray-300 dark:border-gray-600 
                rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-automotive-500 
                focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-200
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                ${isDragActive ? 'opacity-50' : ''}
              `}
              style={{ minHeight: '48px' }}
            />
            <input {...getInputProps()} />

            {/* Attach Button */}
            <button
              type="button"
              onClick={() => document.querySelector('input[type="file"]')?.click()}
              disabled={disabled}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <Paperclip className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Send/Stop Button */}
        <div className="flex-shrink-0">
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              className="p-3 bg-red-500 text-white rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
              title="Stop generation"
            >
              <Square className="h-5 w-5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={disabled || (!value.trim() && attachments.length === 0)}
              className={`
                p-3 bg-automotive-500 text-white rounded-lg transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-automotive-500 focus:ring-offset-2
                ${disabled || (!value.trim() && attachments.length === 0)
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-automotive-600 transform hover:scale-105'
                }
              `}
              title="Send message"
            >
              <Send className="h-5 w-5" />
            </button>
          )}
        </div>
      </form>

      {/* Input Hints */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center space-x-4">
          <span>Press Enter to send, Shift+Enter for new line</span>
          {attachments.length > 0 && (
            <span>{attachments.length} image{attachments.length !== 1 ? 's' : ''} attached</span>
          )}
        </div>
        {value.length > 0 && (
          <span className={value.length > 2000 ? 'text-red-500' : ''}>
            {value.length}/2000
          </span>
        )}
      </div>
    </div>
  )
}