import React from 'react'
import { Menu, Bell, User, Sun, Moon, Wifi, WifiOff, AlertTriangle } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'

export function TopBar({ onMenuClick, systemStatus }) {
  const { notifications, currentVehicle } = useAppContext()

  const unreadCount = notifications.filter(n => !n.read).length
  const hasSystemIssues = Object.values(systemStatus || {}).some(status => status === 'offline')

  return (
    <div className="bg-gradient-panel backdrop-blur-sm border-b border-neon-blue/20 relative">
      {/* Cyber scan line */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-neon-purple to-transparent opacity-40" />
      
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left side */}
          <div className="flex items-center">
            <button
              onClick={onMenuClick}
              className="md:hidden p-2 rounded-lg text-dark-text-secondary hover:text-neon-blue hover:bg-dark-elevated transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-neon-blue/50"
            >
              <Menu className="h-6 w-6" />
            </button>
            
            {/* Current Vehicle */}
            {currentVehicle && (
              <div className="ml-4 flex items-center">
                <div className="tech-panel py-2 px-4 relative overflow-hidden">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-neon-green rounded-full animate-pulse" />
                    <div>
                      <span className="text-sm font-mono font-semibold text-neon-cyan tracking-wide">
                        {currentVehicle.year} {currentVehicle.make} {currentVehicle.model}
                      </span>
                      {currentVehicle.vin && (
                        <div className="text-xs text-dark-text-muted font-mono">
                          VIN: {currentVehicle.vin.slice(-6)}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Active vehicle scan line */}
                  <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-neon-green to-transparent opacity-60" />
                </div>
              </div>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-3">
            {/* System Status Indicator */}
            <div className="flex items-center">
              {hasSystemIssues ? (
                <div className="flex items-center px-3 py-1 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400">
                  <AlertTriangle className="h-4 w-4 animate-pulse" />
                  <span className="ml-2 text-xs font-mono font-medium hidden sm:inline tracking-wide">
                    SYSTEM FAULT
                  </span>
                </div>
              ) : (
                <div className="flex items-center px-3 py-1 rounded-lg bg-neon-green/20 border border-neon-green/30 text-neon-green">
                  <Wifi className="h-4 w-4" />
                  <span className="ml-2 text-xs font-mono font-medium hidden sm:inline tracking-wide">
                    ALL SYSTEMS ONLINE
                  </span>
                </div>
              )}
            </div>

            {/* Notifications */}
            <div className="relative">
              <button className="p-3 rounded-lg text-dark-text-secondary hover:text-neon-blue hover:bg-dark-elevated/50 transition-all duration-300 relative">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 bg-neon-purple text-dark-bg text-xs rounded-full flex items-center justify-center font-mono font-bold animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
                {/* Button glow effect */}
                <div className="absolute inset-0 rounded-lg bg-neon-blue/10 opacity-0 hover:opacity-100 transition-opacity duration-300" />
              </button>
            </div>

            {/* User Menu */}
            <div className="relative">
              <button className="flex items-center px-4 py-2 rounded-lg text-dark-text-secondary hover:text-neon-cyan hover:bg-dark-elevated/50 transition-all duration-300 relative border border-dark-border hover:border-neon-blue/30">
                <User className="h-5 w-5" />
                <span className="ml-2 text-sm font-mono font-medium text-dark-text-primary hidden sm:inline tracking-wide">
                  TECHNICIAN
                </span>
                {/* Active status indicator */}
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-neon-green rounded-full animate-ping opacity-75" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-neon-green rounded-full" />
              </button>
            </div>

            {/* Real-time clock */}
            <div className="hidden lg:flex flex-col items-end text-xs font-mono text-dark-text-muted">
              <div className="text-neon-cyan font-semibold">
                {new Date().toLocaleTimeString()}
              </div>
              <div className="text-dark-text-muted">
                {new Date().toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Bottom scan line */}
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-neon-cyan to-transparent opacity-30" />
    </div>
  )
}