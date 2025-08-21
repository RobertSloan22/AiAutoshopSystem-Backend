import React from 'react'
import { X, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppContext } from '../../context/AppContext'

const notificationIcons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const notificationStyles = {
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: 'text-green-500',
    text: 'text-green-800',
    button: 'text-green-600 hover:text-green-800',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: 'text-red-500',
    text: 'text-red-800',
    button: 'text-red-600 hover:text-red-800',
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    icon: 'text-yellow-500',
    text: 'text-yellow-800',
    button: 'text-yellow-600 hover:text-yellow-800',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'text-blue-500',
    text: 'text-blue-800',
    button: 'text-blue-600 hover:text-blue-800',
  },
}

export function NotificationCenter({ notifications }) {
  const { removeNotification } = useAppContext()

  if (!notifications || notifications.length === 0) {
    return null
  }

  return (
    <div className="fixed top-20 right-4 z-50 space-y-2 max-w-sm w-full">
      <AnimatePresence>
        {notifications.map((notification) => {
          const Icon = notificationIcons[notification.type] || Info
          const styles = notificationStyles[notification.type] || notificationStyles.info

          return (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, x: 300, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 300, scale: 0.8 }}
              transition={{ duration: 0.3, type: 'spring', stiffness: 300, damping: 30 }}
              className={`
                p-4 rounded-lg border shadow-lg backdrop-blur-sm
                ${styles.bg} ${styles.border}
              `}
            >
              <div className="flex items-start">
                <Icon className={`flex-shrink-0 h-5 w-5 mt-0.5 mr-3 ${styles.icon}`} />
                
                <div className="flex-1 min-w-0">
                  {notification.title && (
                    <h4 className={`text-sm font-medium ${styles.text} mb-1`}>
                      {notification.title}
                    </h4>
                  )}
                  <p className={`text-sm ${styles.text}`}>
                    {notification.message}
                  </p>
                  {notification.action && (
                    <div className="mt-2">
                      <button
                        onClick={notification.action.onClick}
                        className={`text-sm underline ${styles.button}`}
                      >
                        {notification.action.label}
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => removeNotification(notification.id)}
                  className={`flex-shrink-0 ml-2 ${styles.button}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Progress bar for timed notifications */}
              {notification.duration && notification.showProgress && (
                <motion.div
                  className={`mt-2 h-1 rounded-full bg-opacity-30 ${styles.border.replace('border-', 'bg-')}`}
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: notification.duration / 1000, ease: 'linear' }}
                />
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}