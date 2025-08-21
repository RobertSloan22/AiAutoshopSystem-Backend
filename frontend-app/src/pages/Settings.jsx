import React, { useState } from 'react'
import { Settings as SettingsIcon, Moon, Sun, Bell, Shield, Database, Globe } from 'lucide-react'
import { useQuery } from 'react-query'
import { systemAPI } from '../services/api'
import { useAppContext } from '../context/AppContext'

export function Settings() {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true'
  })
  const [notifications, setNotifications] = useState(() => {
    return localStorage.getItem('notifications') !== 'false'
  })
  const [autoConnect, setAutoConnect] = useState(() => {
    return localStorage.getItem('autoConnect') === 'true'
  })
  const [dataRetention, setDataRetention] = useState(() => {
    return localStorage.getItem('dataRetention') || '30'
  })

  const { showSuccess, showError } = useAppContext()

  // System status query
  const { data: systemStatus, refetch: refetchSystemStatus } = useQuery(
    'systemStatus',
    systemAPI.getStatus,
    { refetchInterval: 30000 }
  )

  // Services status query  
  const { data: servicesStatus } = useQuery(
    'servicesStatus',
    systemAPI.getServicesStatus,
    { refetchInterval: 30000 }
  )

  const handleDarkModeToggle = () => {
    const newValue = !darkMode
    setDarkMode(newValue)
    localStorage.setItem('darkMode', newValue.toString())
    
    if (newValue) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    
    showSuccess(`Dark mode ${newValue ? 'enabled' : 'disabled'}`)
  }

  const handleNotificationsToggle = () => {
    const newValue = !notifications
    setNotifications(newValue)
    localStorage.setItem('notifications', newValue.toString())
    showSuccess(`Notifications ${newValue ? 'enabled' : 'disabled'}`)
  }

  const handleAutoConnectToggle = () => {
    const newValue = !autoConnect
    setAutoConnect(newValue)
    localStorage.setItem('autoConnect', newValue.toString())
    showSuccess(`Auto-connect ${newValue ? 'enabled' : 'disabled'}`)
  }

  const handleDataRetentionChange = (value) => {
    setDataRetention(value)
    localStorage.setItem('dataRetention', value)
    showSuccess(`Data retention set to ${value} days`)
  }

  const clearAllData = async () => {
    if (window.confirm('This will clear all chat history, analysis results, and cached data. This action cannot be undone. Continue?')) {
      try {
        await systemAPI.clearCache()
        showSuccess('All data cleared successfully')
        // Optionally refresh the page to reset state
        window.location.reload()
      } catch (error) {
        showError('Failed to clear data: ' + error.message)
      }
    }
  }

  const exportSettings = () => {
    const settings = {
      darkMode,
      notifications,
      autoConnect,
      dataRetention,
      exportDate: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ai-autoshop-settings-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    showSuccess('Settings exported successfully')
  }

  const importSettings = (event) => {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const settings = JSON.parse(e.target.result)
        
        if (settings.darkMode !== undefined) {
          setDarkMode(settings.darkMode)
          localStorage.setItem('darkMode', settings.darkMode.toString())
        }
        
        if (settings.notifications !== undefined) {
          setNotifications(settings.notifications)
          localStorage.setItem('notifications', settings.notifications.toString())
        }
        
        if (settings.autoConnect !== undefined) {
          setAutoConnect(settings.autoConnect)
          localStorage.setItem('autoConnect', settings.autoConnect.toString())
        }
        
        if (settings.dataRetention !== undefined) {
          setDataRetention(settings.dataRetention)
          localStorage.setItem('dataRetention', settings.dataRetention)
        }
        
        showSuccess('Settings imported successfully')
        
        // Apply dark mode immediately if imported
        if (settings.darkMode) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
        
      } catch (error) {
        showError('Failed to import settings: Invalid file format')
      }
    }
    reader.readAsText(file)
  }

  const serviceStatusItems = [
    { key: 'obd2', label: 'OBD2 Service', icon: Database },
    { key: 'responses', label: 'AI Responses', icon: SettingsIcon },
    { key: 'webSearch', label: 'Web Search', icon: Globe },
    { key: 'imageAnalysis', label: 'Image Analysis', icon: SettingsIcon },
    { key: 'python', label: 'Python Execution', icon: SettingsIcon }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Settings
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Configure your AI Autoshop System preferences and monitor system status
        </p>
      </div>

      {/* System Status */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            System Status
          </h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {serviceStatusItems.map(({ key, label, icon: Icon }) => {
              const status = servicesStatus?.[key] || 'unknown'
              const statusString = String(status)
              const isOnline = status === 'online'
              
              return (
                <div key={key} className="flex items-center space-x-3 p-4 bg-gradient-panel border border-dark-border rounded-lg relative overflow-hidden">
                  <Icon className={`h-5 w-5 ${isOnline ? 'text-neon-green' : 'text-red-400'} drop-shadow-lg`} />
                  <div className="flex-1">
                    <p className="text-sm font-mono font-medium text-dark-text-primary tracking-wide">
                      {label.toUpperCase()}
                    </p>
                    <p className={`text-xs font-mono tracking-wider ${isOnline ? 'text-neon-green' : 'text-red-400'}`}>
                      {statusString.charAt(0).toUpperCase() + statusString.slice(1)}
                    </p>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-neon-green animate-pulse' : 'bg-red-500'} shadow-lg`} />
                  
                  {/* Status line */}
                  <div className={`absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-${isOnline ? 'neon-green' : 'red-500'} to-transparent opacity-60`} />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Appearance Settings */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Appearance
          </h3>
        </div>
        <div className="card-body space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {darkMode ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Dark Mode
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Use dark theme throughout the application
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={darkMode}
                onChange={handleDarkModeToggle}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-automotive-300 dark:peer-focus:ring-automotive-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-automotive-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Notifications
          </h3>
        </div>
        <div className="card-body space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Bell className="h-5 w-5" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  System Notifications
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Receive alerts for system events and errors
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notifications}
                onChange={handleNotificationsToggle}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-automotive-300 dark:peer-focus:ring-automotive-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-automotive-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Connection Settings */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Connection
          </h3>
        </div>
        <div className="card-body space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Shield className="h-5 w-5" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Auto-Connect OBD2
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Automatically connect to known OBD2 adapters
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoConnect}
                onChange={handleAutoConnectToggle}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-automotive-300 dark:peer-focus:ring-automotive-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-automotive-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Data Management
          </h3>
        </div>
        <div className="card-body space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Data Retention Period
            </label>
            <select
              value={dataRetention}
              onChange={(e) => handleDataRetentionChange(e.target.value)}
              className="input"
            >
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
              <option value="365">1 year</option>
              <option value="-1">Never delete</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              How long to keep chat history, analysis results, and cached data
            </p>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <button
              onClick={clearAllData}
              className="btn btn-danger btn-sm"
            >
              Clear All Data
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              This will permanently delete all stored data
            </p>
          </div>
        </div>
      </div>

      {/* Settings Import/Export */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Settings Backup
          </h3>
        </div>
        <div className="card-body">
          <div className="flex items-center space-x-4">
            <button
              onClick={exportSettings}
              className="btn btn-secondary"
            >
              Export Settings
            </button>
            
            <div className="relative">
              <input
                type="file"
                id="import-settings"
                accept=".json"
                onChange={importSettings}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <label
                htmlFor="import-settings"
                className="btn btn-secondary cursor-pointer"
              >
                Import Settings
              </label>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Backup and restore your application settings
          </p>
        </div>
      </div>

      {/* System Information */}
      {systemStatus && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              System Information
            </h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Version:</span>
                <span className="ml-2 text-gray-600 dark:text-gray-400">{systemStatus.version || 'Unknown'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Uptime:</span>
                <span className="ml-2 text-gray-600 dark:text-gray-400">{systemStatus.uptime || 'Unknown'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Node.js:</span>
                <span className="ml-2 text-gray-600 dark:text-gray-400">{systemStatus.nodeVersion || 'Unknown'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Memory Usage:</span>
                <span className="ml-2 text-gray-600 dark:text-gray-400">{systemStatus.memoryUsage || 'Unknown'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}