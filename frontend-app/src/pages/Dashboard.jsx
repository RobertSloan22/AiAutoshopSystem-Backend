import React from 'react'
import { useQuery } from 'react-query'
import { Link } from 'react-router-dom'
import { 
  Activity, 
  MessageSquare, 
  Image, 
  Search, 
  BarChart3, 
  Car, 
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp
} from 'lucide-react'
import { systemAPI, obd2API, vehicleAPI } from '../services/api'
import { useAppContext } from '../context/AppContext'

const quickActions = [
  {
    name: 'AI Diagnostic Chat',
    description: 'Neural network diagnostic conversation interface',
    href: '/diagnostic-chat',
    icon: MessageSquare,
    color: 'from-neon-blue to-neon-cyan',
    accent: 'neon-blue',
  },
  {
    name: 'OBD2 Monitor',
    description: 'Real-time vehicle telemetry and data streams',
    href: '/obd2-monitor',
    icon: Activity,
    color: 'from-neon-green to-green-400',
    accent: 'neon-green',
  },
  {
    name: 'Image Analysis',
    description: 'Computer vision diagnostic analysis system',
    href: '/image-analysis',
    icon: Image,
    color: 'from-neon-purple to-purple-400',
    accent: 'neon-purple',
  },
  {
    name: 'Web Search',
    description: 'Distributed knowledge acquisition network',
    href: '/web-search',
    icon: Search,
    color: 'from-neon-amber to-orange-400',
    accent: 'neon-amber',
  },
]

export function Dashboard() {
  const { systemStatus, currentVehicle } = useAppContext()

  // System health query
  const { data: healthData, isLoading: healthLoading } = useQuery(
    'systemHealth',
    systemAPI.getHealth,
    { refetchInterval: 30000 }
  )

  // OBD2 status query
  const { data: obd2Status } = useQuery(
    'obd2Status',
    obd2API.getStatus,
    { refetchInterval: 10000 }
  )

  // Recent vehicles query
  const { data: recentVehicles } = useQuery(
    'recentVehicles',
    () => vehicleAPI.list({ limit: 5, sortBy: 'recent' })
  )

  const systemOnline = systemStatus.backend === 'online'
  const obd2Connected = obd2Status?.connected || false
  const hasIssues = Object.values(systemStatus).some(status => status === 'offline')

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-tech font-bold text-dark-text-primary mb-2 tracking-wider">
          <span className="bg-gradient-to-r from-neon-cyan via-neon-blue to-neon-purple bg-clip-text text-transparent">
            AI AUTOSHOP MATRIX
          </span>
        </h1>
        <p className="text-sm font-mono text-dark-text-secondary tracking-widest">
          NEURAL DIAGNOSTIC COMMAND CENTER // SYSTEM ACTIVE
        </p>
        <div className="mt-4 w-32 h-px bg-gradient-to-r from-transparent via-neon-cyan to-transparent mx-auto" />
      </div>

      {/* System Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatusCard
          title="System Status"
          value={systemOnline ? 'Online' : 'Offline'}
          icon={systemOnline ? CheckCircle : AlertTriangle}
          color={systemOnline ? 'text-green-500' : 'text-red-500'}
          bgColor={systemOnline ? 'bg-green-50' : 'bg-red-50'}
        />
        
        <StatusCard
          title="OBD2 Connection"
          value={obd2Connected ? 'Connected' : 'Disconnected'}
          icon={obd2Connected ? Activity : AlertTriangle}
          color={obd2Connected ? 'text-green-500' : 'text-gray-400'}
          bgColor={obd2Connected ? 'bg-green-50' : 'bg-gray-50'}
        />
        
        <StatusCard
          title="Active Vehicle"
          value={currentVehicle ? `${currentVehicle.year} ${currentVehicle.make}` : 'None Selected'}
          icon={Car}
          color="text-blue-500"
          bgColor="bg-blue-50"
        />
        
        <StatusCard
          title="System Health"
          value={hasIssues ? 'Issues Detected' : 'All Systems OK'}
          icon={hasIssues ? AlertTriangle : CheckCircle}
          color={hasIssues ? 'text-yellow-500' : 'text-green-500'}
          bgColor={hasIssues ? 'bg-yellow-50' : 'bg-green-50'}
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <QuickActionCard key={action.name} action={action} />
          ))}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Recent Activity
            </h3>
          </div>
          <div className="card-body">
            <div className="space-y-3">
              <ActivityItem
                icon={MessageSquare}
                title="AI Diagnostic Session"
                description="Analyzed P0301 misfire code for 2020 Toyota Camry"
                time="2 hours ago"
              />
              <ActivityItem
                icon={BarChart3}
                title="Chart Generated"
                description="Engine performance analysis chart created"
                time="3 hours ago"
              />
              <ActivityItem
                icon={Search}
                title="Web Search"
                description="Found 3 TSBs for cylinder misfire issues"
                time="1 day ago"
              />
              <ActivityItem
                icon={Image}
                title="Image Analysis"
                description="Analyzed spark plug condition images"
                time="2 days ago"
              />
            </div>
          </div>
        </div>

        {/* System Overview */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              System Overview
            </h3>
          </div>
          <div className="card-body">
            <div className="space-y-4">
              <ServiceStatus
                name="AI Responses Agent"
                status={systemStatus.backend}
                description="Main AI diagnostic assistant"
              />
              <ServiceStatus
                name="Web Search"
                status={systemStatus.webSearch}
                description="Online research capabilities"
              />
              <ServiceStatus
                name="Python Analytics"
                status={systemStatus.python}
                description="Data analysis and visualization"
              />
              <ServiceStatus
                name="OBD2 Interface"
                status={systemStatus.obd2}
                description="Vehicle diagnostic connection"
              />
              <ServiceStatus
                name="MCP Tools"
                status={systemStatus.mcp}
                description="External tool integration"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Vehicles */}
      {recentVehicles && recentVehicles.length > 0 && (
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Recent Vehicles
            </h3>
            <Link to="/vehicles" className="text-sm text-automotive-600 hover:text-automotive-700">
              View all →
            </Link>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentVehicles.slice(0, 3).map((vehicle) => (
                <VehicleCard key={vehicle.id} vehicle={vehicle} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusCard({ title, value, icon: Icon, color, bgColor }) {
  const isOnline = value === 'Online' || value === 'Connected' || value === 'All Systems OK'
  const isOffline = value === 'Offline' || value === 'Disconnected'
  const hasIssues = value === 'Issues Detected'
  
  return (
    <div className="tech-panel group hover:shadow-neon-blue transition-all duration-500 relative overflow-hidden">
      <div className="flex items-center space-x-4">
        <div className={`p-3 rounded-lg ${
          isOnline ? 'bg-neon-green/20 border border-neon-green/30' :
          isOffline ? 'bg-red-500/20 border border-red-500/30' :
          hasIssues ? 'bg-neon-amber/20 border border-neon-amber/30' :
          'bg-neon-blue/20 border border-neon-blue/30'
        } relative`}>
          <Icon className={`h-6 w-6 ${
            isOnline ? 'text-neon-green' :
            isOffline ? 'text-red-400' :
            hasIssues ? 'text-neon-amber' :
            'text-neon-blue'
          } drop-shadow-lg ${isOnline ? 'animate-pulse' : ''}`} />
          
          {/* Status glow effect */}
          <div className={`absolute inset-0 rounded-lg blur-md opacity-30 ${
            isOnline ? 'bg-neon-green' :
            isOffline ? 'bg-red-500' :
            hasIssues ? 'bg-neon-amber' :
            'bg-neon-blue'
          }`} />
        </div>
        
        <div className="flex-1">
          <p className="text-xs font-mono text-dark-text-muted tracking-wider uppercase">
            {title}
          </p>
          <p className={`text-lg font-tech font-bold tracking-wide ${
            isOnline ? 'text-neon-green' :
            isOffline ? 'text-red-400' :
            hasIssues ? 'text-neon-amber' :
            'text-neon-cyan'
          }`}>
            {value.toUpperCase()}
          </p>
        </div>
        
        {/* Live status indicator */}
        <div className={`w-3 h-3 rounded-full ${
          isOnline ? 'bg-neon-green animate-pulse' :
          isOffline ? 'bg-red-500' :
          'bg-neon-amber animate-pulse'
        }`} />
      </div>
      
      {/* Scan line effect */}
      <div className={`absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-${
        isOnline ? 'neon-green' :
        isOffline ? 'red-500' :
        hasIssues ? 'neon-amber' :
        'neon-blue'
      } to-transparent opacity-50`} />
    </div>
  )
}

function QuickActionCard({ action }) {
  return (
    <Link
      to={action.href}
      className="tech-panel group hover:shadow-neon-blue hover:-translate-y-2 transform transition-all duration-500 relative overflow-hidden"
    >
      <div className="text-center relative z-10">
        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r ${action.color} mb-4 relative`}>
          <action.icon className="h-8 w-8 text-dark-bg drop-shadow-lg" />
          
          {/* Icon glow effect */}
          <div className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>
        
        <h3 className="text-sm font-tech font-bold text-dark-text-primary mb-2 tracking-wider">
          {action.name.toUpperCase()}
        </h3>
        <p className="text-xs font-mono text-dark-text-secondary leading-relaxed tracking-wide">
          {action.description}
        </p>
      </div>
      
      {/* Hover scan effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-neon-blue/5 to-transparent -translate-y-full group-hover:translate-y-0 transition-transform duration-1000" />
      
      {/* Border glow */}
      <div className="absolute inset-0 border border-neon-blue/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </Link>
  )
}

function ActivityItem({ icon: Icon, title, description, time }) {
  return (
    <div className="flex items-start space-x-3">
      <div className="flex-shrink-0">
        <Icon className="h-5 w-5 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {title}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
      </div>
      <div className="flex-shrink-0">
        <p className="text-xs text-gray-400">
          {time}
        </p>
      </div>
    </div>
  )
}

function ServiceStatus({ name, status, description }) {
  const statusConfig = {
    online: { color: 'text-green-500', bg: 'bg-green-100', label: 'Online' },
    offline: { color: 'text-red-500', bg: 'bg-red-100', label: 'Offline' },
    checking: { color: 'text-yellow-500', bg: 'bg-yellow-100', label: 'Checking' },
  }

  const config = statusConfig[status] || statusConfig.offline

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {name}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {description}
        </p>
      </div>
      <div className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
        {config.label}
      </div>
    </div>
  )
}

function VehicleCard({ vehicle }) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
      <div className="flex items-center space-x-3">
        <Car className="h-8 w-8 text-automotive-500" />
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            VIN: {vehicle.vin?.slice(-6) || 'N/A'}
          </p>
        </div>
      </div>
    </div>
  )
}