import React, { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { SystemStatusBar } from './SystemStatusBar'
import { NotificationCenter } from './NotificationCenter'
import { useAppContext } from '../../context/AppContext'

export function Layout({ children, systemStatus }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const { notifications } = useAppContext()

  return (
    <div className="h-screen flex overflow-hidden bg-dark-bg relative">
      {/* Futuristic background effects */}
      <div className="fixed inset-0 bg-gradient-cyber opacity-90 pointer-events-none" />
      <div className="fixed inset-0 bg-gradient-radial from-neon-blue/5 via-transparent to-transparent pointer-events-none" />
      
      {/* Grid overlay */}
      <div 
        className="fixed inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 212, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 212, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }}
      />

      {/* Sidebar */}
      <Sidebar 
        open={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        currentPath={location.pathname}
      />

      {/* Main content area */}
      <div className="flex-1 overflow-hidden flex flex-col relative z-10">
        {/* Top Bar */}
        <TopBar 
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          systemStatus={systemStatus}
        />

        {/* System Status Bar */}
        <SystemStatusBar status={systemStatus} />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-dark-bg/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="animate-fade-in">
              {children}
            </div>
          </div>
        </main>
      </div>

      {/* Notification Center */}
      <NotificationCenter notifications={notifications} />
      
      {/* Scan lines for futuristic effect */}
      <div className="fixed top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-neon-cyan to-transparent opacity-30 animate-scan" />
    </div>
  )
}