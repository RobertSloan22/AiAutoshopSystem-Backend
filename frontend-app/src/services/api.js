import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// Create axios instance with default config
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('authToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error.response?.data || error.message)
  }
)

// System API
export const systemAPI = {
  getHealth: () => api.get('/api/responses/health'),
  getServicesStatus: () => api.get('/api/responses/services/status'),
  getMCPStatus: () => api.get('/api/responses/mcp/status'),
  getWebSearchStatus: () => api.get('/api/responses/websearch/status'),
}

// Responses API (AI Agent)
export const responsesAPI = {
  // Streaming chat
  createStreamingSession: async (message, vehicleContext = {}, customerContext = {}) => {
    const response = await fetch(`${BASE_URL}/api/responses/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        vehicleContext,
        customerContext
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response.body.getReader()
  },

  // Non-streaming chat
  chat: (message, vehicleContext = {}, customerContext = {}) => 
    api.post('/api/responses/chat', {
      message,
      vehicleContext,
      customerContext
    }),

  // Execute Python code
  executePython: (code, options = {}) =>
    api.post('/api/responses/execute/python', {
      code,
      ...options
    }),
}

// OBD2 API
export const obd2API = {
  getStatus: () => api.get('/api/obd2/status'),
  scanAdapters: () => api.get('/api/obd2/scan-adapters'),
  connect: (adapterId) => api.post('/api/obd2/connect', { adapterId }),
  disconnect: () => api.post('/api/obd2/disconnect'),
  getLiveData: () => api.get('/api/obd2/live-data'),
  readDTCCodes: () => api.get('/api/obd2/dtc-codes'),
  clearDTCCodes: () => api.post('/api/obd2/clear-dtc'),
  getHistoricalData: (params = {}) => api.get('/api/obd2/historical-data', { params }),
  
  // Streaming data
  startStreaming: () => api.post('/api/obd2/start-streaming'),
  stopStreaming: () => api.post('/api/obd2/stop-streaming'),
  
  // WebSocket connection for real-time data
  connectWebSocket: (callback) => {
    const ws = new WebSocket(`ws://localhost:5000/obd2-stream`)
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        callback(data)
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
    
    return ws
  }
}

// Images API (Chart serving)
export const imagesAPI = {
  getChart: (imageId, params = {}) => {
    const query = new URLSearchParams(params).toString()
    return `${BASE_URL}/api/images/charts/${imageId}${query ? `?${query}` : ''}`
  },
  
  getThumbnail: (imageId) => 
    `${BASE_URL}/api/images/charts/${imageId}/thumbnail`,
  
  getImageInfo: (imageId) => 
    api.get(`/api/images/charts/${imageId}/info`),
  
  listCharts: (params = {}) => 
    api.get('/api/images/charts', { params }),
  
  deleteChart: (imageId) => 
    api.delete(`/api/images/charts/${imageId}`),
  
  bulkDeleteCharts: (data) => 
    api.delete('/api/images/charts', { data }),
}

// Web Search API
export const webSearchAPI = {
  search: (query, options = {}) =>
    api.post('/api/responses/web-search', {
      query,
      ...options
    }),
  
  searchImages: (query, options = {}) =>
    api.post('/api/responses/search-images', {
      query,
      ...options
    }),
}

// Vehicle API
export const vehicleAPI = {
  list: (params = {}) => api.get('/api/vehicles', { params }),
  get: (id) => api.get(`/api/vehicles/${id}`),
  create: (data) => api.post('/api/vehicles', data),
  update: (id, data) => api.put(`/api/vehicles/${id}`, data),
  delete: (id) => api.delete(`/api/vehicles/${id}`),
  
  // DTC related
  getDTCInfo: (code) => api.get(`/api/dtc/${code}`),
}

// Customer API
export const customerAPI = {
  list: (params = {}) => api.get('/api/customers', { params }),
  get: (id) => api.get(`/api/customers/${id}`),
  create: (data) => api.post('/api/customers', data),
  update: (id, data) => api.put(`/api/customers/${id}`, data),
  delete: (id) => api.delete(`/api/customers/${id}`),
}

// Image Analysis API
export const imageAnalysisAPI = {
  searchByConversation: (conversationId, params = {}) =>
    api.get(`/api/openai/image-analysis/${conversationId}`, { params }),
  
  searchByImage: (imageUrl, params = {}) =>
    api.get('/api/openai/image-analysis/by-image', {
      params: { imageUrl, ...params }
    }),
  
  searchAnnotated: (originalConversationId, params = {}) =>
    api.get(`/api/openai/annotated-analyses/${originalConversationId}`, { params }),
  
  deleteAnalysis: (analysisId, params = {}) =>
    api.delete(`/api/openai/annotated-analysis/${analysisId}`, { params }),
  
  analyze: (imageData, prompt, options = {}) =>
    api.post('/api/openai/analyze-image', {
      image: imageData,
      prompt,
      ...options
    }),
}

// Research API
export const researchAPI = {
  search: (query, options = {}) =>
    api.post('/api/research', {
      query,
      ...options
    }),
  
  getResults: (id) => api.get(`/api/research/results/${id}`),
  listResults: (params = {}) => api.get('/api/research/results', { params }),
  
  // Vehicle specific research
  vehicleQuestion: (question, vehicleContext, options = {}) =>
    api.post('/api/research/vehicle-question', {
      question,
      vehicleContext,
      ...options
    }),
  
  serviceBulletin: (query, vehicleContext, options = {}) =>
    api.post('/api/research/service-bulletin', {
      query,
      vehicleContext,
      ...options
    }),
}

// Diagnostic Agents API
export const diagnosticAgentsAPI = {
  list: () => api.get('/api/diagnostic-agents'),
  get: (id) => api.get(`/api/diagnostic-agents/${id}`),
  execute: (agentId, data) => api.post(`/api/diagnostic-agents/${agentId}/execute`, data),
  
  // Streaming execution
  executeStreaming: async (agentId, data) => {
    const response = await fetch(`${BASE_URL}/api/diagnostic-agents/${agentId}/execute-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response.body.getReader()
  },
}

// Streaming utilities
export const streamingUtils = {
  // Process Server-Sent Events stream
  processSSEStream: async (reader, callbacks = {}) => {
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim()
          
          if (line.startsWith('event:')) {
            const event = line.slice(6).trim()
            const dataLine = lines[i + 1]
            
            if (dataLine && dataLine.startsWith('data:')) {
              try {
                const data = JSON.parse(dataLine.slice(5).trim())
                
                if (callbacks[event]) {
                  await callbacks[event](data)
                }
                
                // Generic callback for all events
                if (callbacks.onEvent) {
                  await callbacks.onEvent(event, data)
                }
              } catch (error) {
                console.error('Error parsing SSE data:', error)
                if (callbacks.onError) {
                  callbacks.onError(error)
                }
              }
            }
            i++ // Skip the data line
          }
        }
      }
    } catch (error) {
      console.error('Stream processing error:', error)
      if (callbacks.onError) {
        callbacks.onError(error)
      }
    } finally {
      reader.releaseLock()
      if (callbacks.onComplete) {
        callbacks.onComplete()
      }
    }
  },

  // Create AbortController for cancelling streams
  createAbortController: () => new AbortController(),
}

export default api