import React, { useState, useEffect } from 'react'
import { Activity, Wifi, WifiOff, Play, Square, AlertTriangle, Gauge } from 'lucide-react'
import { useQuery } from 'react-query'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { obd2API } from '../services/api'
import { useAppContext } from '../context/AppContext'

export function OBD2Monitor() {
  const [isStreaming, setIsStreaming] = useState(false)
  const [liveData, setLiveData] = useState({})
  const [historicalData, setHistoricalData] = useState([])
  const [selectedMetrics, setSelectedMetrics] = useState(['rpm', 'speed', 'coolantTemp'])
  const [wsConnection, setWsConnection] = useState(null)
  
  const { currentVehicle, showError, showSuccess } = useAppContext()

  // OBD2 Status Query
  const { data: obd2Status, refetch: refetchStatus } = useQuery(
    'obd2Status',
    obd2API.getStatus,
    { refetchInterval: 5000 }
  )

  // Available Adapters Query
  const { data: adapters } = useQuery(
    'obd2Adapters',
    obd2API.scanAdapters,
    { enabled: !obd2Status?.connected }
  )

  // Connect to OBD2 WebSocket for real-time data
  useEffect(() => {
    if (isStreaming && obd2Status?.connected) {
      const ws = obd2API.connectWebSocket((data) => {
        setLiveData(data)
        
        // Add to historical data
        setHistoricalData(prev => {
          const newData = [...prev, { ...data, timestamp: Date.now() }]
          // Keep only last 50 data points
          return newData.slice(-50)
        })
      })
      
      setWsConnection(ws)
      
      return () => {
        ws.close()
        setWsConnection(null)
      }
    }
  }, [isStreaming, obd2Status?.connected])

  const handleConnect = async (adapterId) => {
    try {
      await obd2API.connect(adapterId)
      showSuccess('Connected to OBD2 adapter')
      refetchStatus()
    } catch (error) {
      showError(error.message || 'Failed to connect to adapter')
    }
  }

  const handleDisconnect = async () => {
    try {
      if (wsConnection) {
        wsConnection.close()
        setWsConnection(null)
      }
      setIsStreaming(false)
      await obd2API.disconnect()
      showSuccess('Disconnected from OBD2 adapter')
      refetchStatus()
    } catch (error) {
      showError(error.message || 'Failed to disconnect')
    }
  }

  const toggleStreaming = async () => {
    if (!obd2Status?.connected) {
      showError('Please connect to an OBD2 adapter first')
      return
    }

    try {
      if (isStreaming) {
        await obd2API.stopStreaming()
        setIsStreaming(false)
        showSuccess('Stopped data streaming')
      } else {
        await obd2API.startStreaming()
        setIsStreaming(true)
        showSuccess('Started data streaming')
      }
    } catch (error) {
      showError(error.message || 'Failed to toggle streaming')
    }
  }

  const readDTCCodes = async () => {
    try {
      const codes = await obd2API.readDTCCodes()
      if (codes.length === 0) {
        showSuccess('No diagnostic trouble codes found')
      } else {
        showSuccess(`Found ${codes.length} DTC code(s)`)
        // Handle DTC codes display
      }
    } catch (error) {
      showError(error.message || 'Failed to read DTC codes')
    }
  }

  const clearDTCCodes = async () => {
    if (window.confirm('Are you sure you want to clear all DTC codes?')) {
      try {
        await obd2API.clearDTCCodes()
        showSuccess('DTC codes cleared successfully')
      } catch (error) {
        showError(error.message || 'Failed to clear DTC codes')
      }
    }
  }

  const metrics = [
    { key: 'rpm', label: 'RPM', unit: 'rpm', color: '#3b82f6', icon: Gauge },
    { key: 'speed', label: 'Speed', unit: 'mph', color: '#10b981', icon: Activity },
    { key: 'coolantTemp', label: 'Coolant Temp', unit: '°F', color: '#f59e0b', icon: Activity },
    { key: 'oilTemp', label: 'Oil Temp', unit: '°F', color: '#ef4444', icon: Activity },
    { key: 'intakeTemp', label: 'Intake Temp', unit: '°F', color: '#8b5cf6', icon: Activity },
    { key: 'throttlePosition', label: 'Throttle', unit: '%', color: '#06b6d4', icon: Activity },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          OBD2 Monitor
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Real-time vehicle diagnostics and data monitoring
        </p>
      </div>

      {/* Connection Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatusCard
          title="Connection Status"
          value={obd2Status?.connected ? 'Connected' : 'Disconnected'}
          icon={obd2Status?.connected ? Wifi : WifiOff}
          color={obd2Status?.connected ? 'text-green-500' : 'text-red-500'}
          bgColor={obd2Status?.connected ? 'bg-green-50' : 'bg-red-50'}
        />
        
        <StatusCard
          title="Streaming Status"
          value={isStreaming ? 'Active' : 'Inactive'}
          icon={Activity}
          color={isStreaming ? 'text-blue-500' : 'text-gray-400'}
          bgColor={isStreaming ? 'bg-blue-50' : 'bg-gray-50'}
        />
        
        <StatusCard
          title="Current Vehicle"
          value={currentVehicle ? `${currentVehicle.year} ${currentVehicle.make}` : 'None Selected'}
          icon={AlertTriangle}
          color="text-automotive-500"
          bgColor="bg-automotive-50"
        />
      </div>

      {/* Connection Controls */}
      {!obd2Status?.connected ? (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Connect to OBD2 Adapter
            </h3>
          </div>
          <div className="card-body">
            {adapters && adapters.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Select an OBD2 adapter to connect:
                </p>
                {adapters.map((adapter) => (
                  <div
                    key={adapter.id}
                    className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {adapter.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {adapter.address} - Signal: {adapter.signal}%
                      </p>
                    </div>
                    <button
                      onClick={() => handleConnect(adapter.id)}
                      className="btn btn-automotive btn-sm"
                    >
                      Connect
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <WifiOff className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  No OBD2 adapters found. Make sure your adapter is plugged in and in pairing mode.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between card p-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Wifi className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Connected to {obd2Status.adapter?.name}
              </span>
            </div>
            
            <button
              onClick={toggleStreaming}
              className={`btn btn-sm ${isStreaming ? 'btn-danger' : 'btn-primary'}`}
            >
              {isStreaming ? (
                <>
                  <Square className="h-4 w-4 mr-2" />
                  Stop Streaming
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start Streaming
                </>
              )}
            </button>
          </div>
          
          <div className="flex items-center space-x-2">
            <button onClick={readDTCCodes} className="btn btn-secondary btn-sm">
              Read DTC Codes
            </button>
            <button onClick={clearDTCCodes} className="btn btn-secondary btn-sm">
              Clear DTC Codes
            </button>
            <button onClick={handleDisconnect} className="btn btn-danger btn-sm">
              Disconnect
            </button>
          </div>
        </div>
      )}

      {/* Live Data Display */}
      {obd2Status?.connected && Object.keys(liveData).length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Live Data
            </h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {metrics.map((metric) => {
                const value = liveData[metric.key]
                const IconComponent = metric.icon
                
                return (
                  <div key={metric.key} className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <IconComponent className={`h-6 w-6 mx-auto mb-2 ${metric.color}`} />
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {value !== undefined ? Math.round(value) : '--'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {metric.label}
                    </p>
                    <p className="text-xs text-gray-400">
                      {metric.unit}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Historical Data Chart */}
      {historicalData.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Historical Data
              </h3>
              <div className="flex items-center space-x-2">
                {metrics.map((metric) => (
                  <label key={metric.key} className="flex items-center space-x-1">
                    <input
                      type="checkbox"
                      checked={selectedMetrics.includes(metric.key)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMetrics(prev => [...prev, metric.key])
                        } else {
                          setSelectedMetrics(prev => prev.filter(m => m !== metric.key))
                        }
                      }}
                      className="rounded border-gray-300 text-automotive-600 focus:ring-automotive-500"
                    />
                    <span className="text-sm" style={{ color: metric.color }}>
                      {metric.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="card-body">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) => new Date(value).toLocaleTimeString()}
                  />
                  {selectedMetrics.map((metricKey) => {
                    const metric = metrics.find(m => m.key === metricKey)
                    return (
                      <Line
                        key={metricKey}
                        type="monotone"
                        dataKey={metricKey}
                        stroke={metric?.color || '#3b82f6'}
                        strokeWidth={2}
                        dot={false}
                        name={metric?.label || metricKey}
                      />
                    )
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusCard({ title, value, icon: Icon, color, bgColor }) {
  return (
    <div className="card">
      <div className="card-body">
        <div className="flex items-center">
          <div className={`p-2 rounded-lg ${bgColor}`}>
            <Icon className={`h-6 w-6 ${color}`} />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {title}
            </p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {value}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}