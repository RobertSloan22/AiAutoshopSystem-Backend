import React, { useState } from 'react'
import { X, Download, ZoomIn, ExternalLink, BarChart3, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { imagesAPI } from '../../services/api'

export function ChartDisplay({ charts, onClear, title = "Charts" }) {
  const [selectedChart, setSelectedChart] = useState(null)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [loading, setLoading] = useState({})

  const downloadChart = async (chart, filename) => {
    setLoading(prev => ({ ...prev, [chart.imageId]: true }))
    try {
      if (chart.data) {
        // Download from base64 data
        const link = document.createElement('a')
        link.href = chart.data
        link.download = filename || `chart_${chart.imageId || Date.now()}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else if (chart.url) {
        // Download from API URL
        const response = await fetch(`${chart.url}?download=true`)
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename || `chart_${chart.imageId || Date.now()}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Download failed:', error)
    } finally {
      setLoading(prev => ({ ...prev, [chart.imageId]: false }))
    }
  }

  const openInNewTab = (chart) => {
    if (chart.url) {
      window.open(chart.url, '_blank')
    } else if (chart.data) {
      const newWindow = window.open()
      newWindow.document.write(`
        <html>
          <head><title>Chart Viewer</title></head>
          <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f5f5f5;">
            <img src="${chart.data}" style="max-width:100%;max-height:100%;object-fit:contain;" alt="Chart" />
          </body>
        </html>
      `)
      newWindow.document.close()
    }
  }

  const deleteChart = async (chart) => {
    if (chart.imageId && window.confirm('Are you sure you want to delete this chart?')) {
      try {
        await imagesAPI.deleteChart(chart.imageId)
        // Remove from local state
        const updatedCharts = charts.filter(c => c.imageId !== chart.imageId)
        onClear()
        // Re-add remaining charts (if parent component supports partial updates)
      } catch (error) {
        console.error('Failed to delete chart:', error)
      }
    }
  }

  if (!charts || charts.length === 0) {
    return null
  }

  return (
    <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
          <BarChart3 className="h-5 w-5 mr-2" />
          {title} ({charts.length})
        </h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => charts.forEach(chart => downloadChart(chart))}
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center"
          >
            <Download className="h-4 w-4 mr-1" />
            Download All
          </button>
          <button
            onClick={onClear}
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Clear All
          </button>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
        <AnimatePresence>
          {charts.map((chart, index) => (
            <ChartCard
              key={chart.imageId || index}
              chart={chart}
              index={index}
              onSelect={setSelectedChart}
              onDownload={downloadChart}
              onOpenInNewTab={openInNewTab}
              onDelete={deleteChart}
              loading={loading[chart.imageId]}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Chart Modal */}
      <AnimatePresence>
        {selectedChart && (
          <ChartModal
            chart={selectedChart}
            onClose={() => {
              setSelectedChart(null)
              setZoomLevel(1)
            }}
            zoomLevel={zoomLevel}
            onZoomChange={setZoomLevel}
            onDownload={downloadChart}
            onOpenInNewTab={openInNewTab}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function ChartCard({ 
  chart, 
  index, 
  onSelect, 
  onDownload, 
  onOpenInNewTab, 
  onDelete, 
  loading 
}) {
  const [imageError, setImageError] = useState(false)
  const [useApiUrl, setUseApiUrl] = useState(!!chart.url)

  const handleImageError = () => {
    if (useApiUrl && chart.data) {
      // Fallback to base64 if API fails
      setUseApiUrl(false)
      setImageError(false)
    } else {
      setImageError(true)
    }
  }

  const imageSrc = useApiUrl ? chart.url : chart.data

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="group relative bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200"
    >
      {/* Chart Image */}
      <div className="aspect-w-16 aspect-h-9 bg-gray-100 dark:bg-gray-800">
        {imageError ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Failed to load chart</p>
            </div>
          </div>
        ) : (
          <img
            src={imageSrc}
            alt={`Chart ${index + 1}`}
            className="w-full h-48 object-contain cursor-pointer hover:scale-105 transition-transform duration-200"
            onClick={() => onSelect(chart)}
            onError={handleImageError}
            loading="lazy"
          />
        )}
      </div>

      {/* Chart Actions Overlay */}
      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onSelect(chart)}
            className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:scale-110 transition-transform"
            title="View full size"
          >
            <ZoomIn className="h-4 w-4 text-gray-700 dark:text-gray-300" />
          </button>
          
          <button
            onClick={() => onDownload(chart)}
            disabled={loading}
            className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:scale-110 transition-transform disabled:opacity-50"
            title="Download"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></div>
            ) : (
              <Download className="h-4 w-4 text-gray-700 dark:text-gray-300" />
            )}
          </button>
          
          <button
            onClick={() => onOpenInNewTab(chart)}
            className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:scale-110 transition-transform"
            title="Open in new tab"
          >
            <ExternalLink className="h-4 w-4 text-gray-700 dark:text-gray-300" />
          </button>
        </div>
      </div>

      {/* Chart Info */}
      <div className="p-3 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              Chart {index + 1}
            </p>
            {chart.imageId && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                ID: {chart.imageId.slice(-8)}
              </p>
            )}
          </div>
          
          {chart.imageId && (
            <button
              onClick={() => onDelete(chart)}
              className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 transition-colors"
              title="Delete chart"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function ChartModal({ 
  chart, 
  onClose, 
  zoomLevel, 
  onZoomChange, 
  onDownload, 
  onOpenInNewTab 
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.8 }}
        className="bg-white dark:bg-gray-800 rounded-lg max-w-6xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Chart Viewer
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onZoomChange(Math.max(0.5, zoomLevel - 0.1))}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              -
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400 min-w-[60px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => onZoomChange(Math.min(3, zoomLevel + 0.1))}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              +
            </button>
            <button
              onClick={() => onDownload(chart)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              title="Download"
            >
              <Download className="h-5 w-5" />
            </button>
            <button
              onClick={() => onOpenInNewTab(chart)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              title="Open in new tab"
            >
              <ExternalLink className="h-5 w-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
          <div className="flex justify-center">
            <img
              src={chart.url || chart.data}
              alt="Chart"
              className="max-w-full h-auto transition-transform duration-200"
              style={{ transform: `scale(${zoomLevel})` }}
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}