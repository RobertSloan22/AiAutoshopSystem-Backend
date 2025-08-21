import React from 'react'
import { Link } from 'react-router-dom'
import { X, Home, MessageSquare, Activity, Image, Search, BarChart3, Car, Settings, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home, current: false },
  { name: 'AI Diagnostic Chat', href: '/diagnostic-chat', icon: MessageSquare, current: false },
  { name: 'OBD2 Monitor', href: '/obd2-monitor', icon: Activity, current: false },
  { name: 'Image Analysis', href: '/image-analysis', icon: Image, current: false },
  { name: 'Web Search', href: '/web-search', icon: Search, current: false },
  { name: 'Chart Gallery', href: '/chart-gallery', icon: BarChart3, current: false },
  { name: 'Vehicles', href: '/vehicles', icon: Car, current: false },
  { name: 'Settings', href: '/settings', icon: Settings, current: false },
]

export function Sidebar({ open, onClose, currentPath }) {
  const updatedNavigation = navigation.map(item => ({
    ...item,
    current: currentPath === item.href
  }))

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex z-40 md:hidden"
          >
            <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={onClose} />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-gray-800"
            >
              <SidebarContent navigation={updatedNavigation} onClose={onClose} mobile />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64">
          <SidebarContent navigation={updatedNavigation} />
        </div>
      </div>
    </>
  )
}

function SidebarContent({ navigation, onClose, mobile = false }) {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gradient-panel border-r border-neon-blue/20 relative backdrop-blur-sm">
      {/* Cyber border effect */}
      <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-neon-blue to-transparent opacity-50" />
      
      {/* Header */}
      <div className="flex items-center h-16 flex-shrink-0 px-4 bg-gradient-neon relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyber-800/90 to-cyber-600/90" />
        <div className="relative z-10 flex items-center">
          <Zap className="h-8 w-8 text-neon-cyan animate-glow" />
          <div className="ml-3">
            <h1 className="text-lg font-tech font-bold text-dark-text-primary tracking-wider">AI AUTOSHOP</h1>
            <p className="text-xs text-neon-cyan font-mono tracking-widest">DIAGNOSTIC SYSTEM</p>
          </div>
        </div>
        {mobile && (
          <button
            onClick={onClose}
            className="ml-auto flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full hover:bg-neon-blue/20 text-dark-text-primary relative z-10 transition-all duration-300"
          >
            <X className="h-6 w-6" />
          </button>
        )}
        
        {/* Scan line effect */}
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-neon-cyan to-transparent opacity-60" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-2 relative">
        {navigation.map((item) => {
          const isActive = item.current

          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={mobile ? onClose : undefined}
              className={`
                group flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-300 relative overflow-hidden
                ${isActive
                  ? 'bg-gradient-to-r from-neon-blue/20 to-cyber-600/30 text-neon-cyan border border-neon-blue/30 shadow-neon-blue'
                  : 'text-dark-text-secondary hover:bg-dark-elevated hover:text-dark-text-primary border border-transparent hover:border-dark-border'
                }
              `}
            >
              {/* Active indicator line */}
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-neon-cyan via-neon-blue to-neon-purple rounded-r-full" />
              )}
              
              <item.icon
                className={`
                  mr-3 flex-shrink-0 h-5 w-5 transition-all duration-300
                  ${isActive 
                    ? 'text-neon-cyan drop-shadow-lg' 
                    : 'text-dark-text-muted group-hover:text-neon-blue'
                  }
                `}
              />
              
              <span className={`font-mono tracking-wide ${isActive ? 'font-semibold' : ''}`}>
                {item.name.toUpperCase()}
              </span>
              
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="ml-auto w-2 h-2 bg-neon-cyan rounded-full shadow-neon-blue animate-pulse"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
              
              {/* Hover scan effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-neon-blue/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="flex-shrink-0 p-4 border-t border-neon-blue/20 bg-dark-elevated/50">
        <div className="text-xs text-dark-text-muted font-mono space-y-1">
          <div className="flex items-center justify-between">
            <span>© 2024 AI AUTOSHOP</span>
            <div className="w-2 h-2 bg-neon-green rounded-full animate-pulse" />
          </div>
          <p className="text-neon-cyan">DIAGNOSTIC SYSTEM v1.0</p>
          <div className="text-dark-text-muted/60">
            NEURAL NETWORK ACTIVE
          </div>
        </div>
      </div>
      
      {/* Ambient glow effect */}
      <div className="absolute top-16 left-2 right-2 h-px bg-gradient-to-r from-transparent via-neon-purple/30 to-transparent" />
    </div>
  )
}