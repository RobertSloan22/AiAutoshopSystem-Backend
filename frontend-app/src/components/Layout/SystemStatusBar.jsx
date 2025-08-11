import React from 'react'
import { AlertTriangle, CheckCircle, XCircle, Loader, Wifi, Database, Search, Code, Zap } from 'lucide-react'

const statusConfig = {
  online: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50', label: 'Online' },
  offline: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', label: 'Offline' },
  checking: { icon: Loader, color: 'text-yellow-500', bg: 'bg-yellow-50', label: 'Checking', animate: 'animate-spin' },
  warning: { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-50', label: 'Warning' },
}

const serviceConfig = {
  backend: { name: 'Backend API', icon: Database, description: 'Main server connection' },
  obd2: { name: 'OBD2 System', icon: Wifi, description: 'Vehicle diagnostic connection' },
  webSearch: { name: 'Web Search', icon: Search, description: 'Online search capabilities' },
  python: { name: 'Python Analytics', icon: Code, description: 'Data analysis and charts' },
  mcp: { name: 'MCP Tools', icon: Zap, description: 'External tool integration' },
}

export function SystemStatusBar({ status = {} }) {
  const hasIssues = Object.values(status).some(s => s === 'offline' || s === 'warning')
  const allOnline = Object.values(status).every(s => s === 'online')

  if (allOnline) {
    return (
      <div className="bg-green-50 border-b border-green-200 px-4 py-2">
        <div className="flex items-center justify-center">
          <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
          <span className="text-sm font-medium text-green-800">All systems operational</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`border-b px-4 py-2 ${hasIssues ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-center justify-center space-x-6 text-xs">
        {Object.entries(status).map(([service, serviceStatus]) => {
          const statusInfo = statusConfig[serviceStatus] || statusConfig.offline
          const serviceInfo = serviceConfig[service] || { name: service, icon: Database }
          const IconComponent = statusInfo.icon
          const ServiceIcon = serviceInfo.icon

          return (
            <div key={service} className="flex items-center space-x-1.5" title={serviceInfo.description}>
              <ServiceIcon className="h-3 w-3 text-gray-400" />
              <span className="text-gray-600 font-medium">{serviceInfo.name}:</span>
              <div className="flex items-center space-x-1">
                <IconComponent className={`h-3 w-3 ${statusInfo.color} ${statusInfo.animate || ''}`} />
                <span className={statusInfo.color}>{statusInfo.label}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}