import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { systemAPI } from '../services/api'
import { useQuery } from 'react-query'

const AppContext = createContext()

const initialState = {
  user: null,
  currentVehicle: null,
  systemStatus: {
    backend: 'checking',
    obd2: 'checking',
    webSearch: 'checking',
    python: 'checking',
    mcp: 'checking'
  },
  theme: 'light',
  notifications: [],
  settings: {
    autoConnect: true,
    showNotifications: true,
    defaultChartType: 'line',
    maxResults: 50
  }
}

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload }
    
    case 'SET_CURRENT_VEHICLE':
      return { ...state, currentVehicle: action.payload }
    
    case 'UPDATE_SYSTEM_STATUS':
      return { 
        ...state, 
        systemStatus: { ...state.systemStatus, ...action.payload } 
      }
    
    case 'SET_THEME':
      return { ...state, theme: action.payload }
    
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [...state.notifications, {
          id: Date.now(),
          ...action.payload
        }]
      }
    
    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload)
      }
    
    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: { ...state.settings, ...action.payload }
      }
    
    default:
      return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState)

  // System status query
  const { data: systemStatus } = useQuery(
    'systemStatus',
    systemAPI.getServicesStatus,
    {
      refetchInterval: 30000, // Check every 30 seconds
      onSuccess: (data) => {
        const status = {
          backend: 'online',
          obd2: data.python?.available ? 'online' : 'offline',
          webSearch: data.webSearch?.available ? 'online' : 'offline',
          python: data.python?.available ? 'online' : 'offline',
          mcp: data.mcp?.connected ? 'online' : 'offline'
        }
        dispatch({ type: 'UPDATE_SYSTEM_STATUS', payload: status })
      },
      onError: () => {
        dispatch({ 
          type: 'UPDATE_SYSTEM_STATUS', 
          payload: { 
            backend: 'offline',
            obd2: 'offline',
            webSearch: 'offline',
            python: 'offline',
            mcp: 'offline'
          } 
        })
      }
    }
  )

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('appSettings')
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings)
        dispatch({ type: 'UPDATE_SETTINGS', payload: settings })
      } catch (error) {
        console.error('Failed to load settings:', error)
      }
    }
  }, [])

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('appSettings', JSON.stringify(state.settings))
  }, [state.settings])

  const actions = {
    setUser: (user) => dispatch({ type: 'SET_USER', payload: user }),
    
    setCurrentVehicle: (vehicle) => dispatch({ type: 'SET_CURRENT_VEHICLE', payload: vehicle }),
    
    updateSystemStatus: (status) => dispatch({ type: 'UPDATE_SYSTEM_STATUS', payload: status }),
    
    setTheme: (theme) => {
      dispatch({ type: 'SET_THEME', payload: theme })
      document.documentElement.classList.toggle('dark', theme === 'dark')
    },
    
    addNotification: (notification) => {
      dispatch({ type: 'ADD_NOTIFICATION', payload: notification })
      
      // Auto-remove after delay if specified
      if (notification.autoRemove !== false) {
        setTimeout(() => {
          dispatch({ type: 'REMOVE_NOTIFICATION', payload: notification.id || Date.now() })
        }, notification.duration || 5000)
      }
    },
    
    removeNotification: (id) => dispatch({ type: 'REMOVE_NOTIFICATION', payload: id }),
    
    updateSettings: (settings) => dispatch({ type: 'UPDATE_SETTINGS', payload: settings }),
    
    // Utility functions
    showSuccess: (message) => {
      actions.addNotification({
        type: 'success',
        message,
        duration: 3000
      })
    },
    
    showError: (message) => {
      actions.addNotification({
        type: 'error',
        message,
        duration: 5000
      })
    },
    
    showInfo: (message) => {
      actions.addNotification({
        type: 'info',
        message,
        duration: 4000
      })
    },
    
    showWarning: (message) => {
      actions.addNotification({
        type: 'warning',
        message,
        duration: 4000
      })
    }
  }

  const value = {
    ...state,
    ...actions
  }

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider')
  }
  return context
}

export default AppContext