import React, { useState } from 'react'
import { BarChart3, Download, Trash2, Eye, Filter, Grid, List } from 'lucide-react'
import { useQuery } from 'react-query'
import { imagesAPI } from '../services/api'
import { ChartDisplay } from '../components/Charts/ChartDisplay'

export function ChartGallery() {
  const [selectedCharts, setSelectedCharts] = useState([])
  const [viewMode, setViewMode] = useState('grid')
  const [filters, setFilters] = useState({
    executionId: '',
    tag: '',
    dateRange: '',
    sortBy: 'newest'
  })

  // Charts query
  const { data: chartsData, isLoading, refetch } = useQuery(
    ['chartGallery', filters],
    () => imagesAPI.listCharts({
      executionId: filters.executionId || undefined,
      tag: filters.tag || undefined,
      limit: 50,
      offset: 0
    })
  )

  const charts = chartsData?.images || []

  const handleSelectChart = (chartId) => {
    setSelectedCharts(prev => 
      prev.includes(chartId)
        ? prev.filter(id => id !== chartId)
        : [...prev, chartId]
    )
  }

  const handleSelectAll = () => {
    if (selectedCharts.length === charts.length) {
      setSelectedCharts([])
    } else {
      setSelectedCharts(charts.map(chart => chart.id))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedCharts.length === 0) return
    
    if (window.confirm(`Delete ${selectedCharts.length} selected chart(s)?`)) {
      try {
        await imagesAPI.bulkDeleteCharts({ imageIds: selectedCharts })
        setSelectedCharts([])
        refetch()
      } catch (error) {
        console.error('Bulk delete failed:', error)
      }
    }
  }

  const handleBulkDownload = async () => {
    if (selectedCharts.length === 0) return

    for (const chartId of selectedCharts) {
      try {
        const chartUrl = imagesAPI.getChart(chartId, { download: true })
        const link = document.createElement('a')
        link.href = chartUrl
        link.download = `chart_${chartId}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`Failed to download chart ${chartId}:`, error)
      }
    }
  }

  const clearFilters = () => {
    setFilters({
      executionId: '',
      tag: '',
      dateRange: '',
      sortBy: 'newest'
    })
  }

  // Get unique tags and execution IDs for filters
  const uniqueTags = [...new Set(charts.flatMap(chart => chart.tags || []))]
  const uniqueExecutionIds = [...new Set(charts.map(chart => chart.executionId).filter(Boolean))]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Chart Gallery
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Browse and manage all generated charts and visualizations
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="btn btn-secondary"
          >
            {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
          </button>
          
          {selectedCharts.length > 0 && (
            <>
              <button
                onClick={handleBulkDownload}
                className="btn btn-secondary"
              >
                <Download className="h-4 w-4 mr-2" />
                Download ({selectedCharts.length})
              </button>
              
              <button
                onClick={handleBulkDelete}
                className="btn btn-danger"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete ({selectedCharts.length})
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
              <Filter className="h-5 w-5 mr-2" />
              Filters
            </h3>
            <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-gray-700">
              Clear All
            </button>
          </div>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Execution ID
              </label>
              <select
                value={filters.executionId}
                onChange={(e) => setFilters(prev => ({ ...prev, executionId: e.target.value }))}
                className="input"
              >
                <option value="">All executions</option>
                {uniqueExecutionIds.map(id => (
                  <option key={id} value={id}>{id.slice(-8)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tag
              </label>
              <select
                value={filters.tag}
                onChange={(e) => setFilters(prev => ({ ...prev, tag: e.target.value }))}
                className="input"
              >
                <option value="">All tags</option>
                {uniqueTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date Range
              </label>
              <select
                value={filters.dateRange}
                onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
                className="input"
              >
                <option value="">All time</option>
                <option value="today">Today</option>
                <option value="week">This week</option>
                <option value="month">This month</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sort By
              </label>
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                className="input"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-3">
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {charts.length} chart{charts.length !== 1 ? 's' : ''} found
          </span>
          
          {charts.length > 0 && (
            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={selectedCharts.length === charts.length}
                onChange={handleSelectAll}
                className="rounded border-gray-300 text-automotive-600 focus:ring-automotive-500"
              />
              <span className="text-gray-600 dark:text-gray-400">
                Select all
              </span>
            </label>
          )}
        </div>
        
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {selectedCharts.length} selected
        </div>
      </div>

      {/* Charts Display */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-automotive-600"></div>
          <span className="ml-2 text-gray-500">Loading charts...</span>
        </div>
      ) : charts.length === 0 ? (
        <div className="text-center py-12">
          <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No charts found
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Generate some charts using the AI Diagnostic Chat or Python execution to see them here.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {charts.map((chart) => (
            <ChartGridItem
              key={chart.id}
              chart={chart}
              selected={selectedCharts.includes(chart.id)}
              onSelect={() => handleSelectChart(chart.id)}
              onDelete={() => {
                if (window.confirm('Delete this chart?')) {
                  imagesAPI.deleteChart(chart.id).then(() => refetch())
                }
              }}
            />
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="card-body p-0">
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {charts.map((chart) => (
                <ChartListItem
                  key={chart.id}
                  chart={chart}
                  selected={selectedCharts.includes(chart.id)}
                  onSelect={() => handleSelectChart(chart.id)}
                  onDelete={() => {
                    if (window.confirm('Delete this chart?')) {
                      imagesAPI.deleteChart(chart.id).then(() => refetch())
                    }
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ChartGridItem({ chart, selected, onSelect, onDelete }) {
  const [imageError, setImageError] = useState(false)

  const downloadChart = async (e) => {
    e.stopPropagation()
    const link = document.createElement('a')
    link.href = imagesAPI.getChart(chart.id, { download: true })
    link.download = `${chart.filename || `chart_${chart.id}`}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const viewChart = (e) => {
    e.stopPropagation()
    window.open(imagesAPI.getChart(chart.id), '_blank')
  }

  return (
    <div className={`
      card cursor-pointer transition-all duration-200 hover:shadow-lg
      ${selected ? 'ring-2 ring-automotive-500 bg-automotive-50 dark:bg-automotive-900' : ''}
    `}>
      <div onClick={onSelect}>
        {/* Checkbox */}
        <div className="absolute top-2 left-2 z-10">
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelect}
            className="rounded border-gray-300 text-automotive-600 focus:ring-automotive-500"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Chart Image */}
        <div className="aspect-w-16 aspect-h-9 bg-gray-100 dark:bg-gray-800 rounded-t-lg overflow-hidden">
          {imageError ? (
            <div className="flex items-center justify-center h-48">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Failed to load chart</p>
              </div>
            </div>
          ) : (
            <img
              src={imagesAPI.getChart(chart.id)}
              alt={chart.filename}
              className="w-full h-48 object-contain hover:scale-105 transition-transform duration-200"
              onError={() => setImageError(true)}
              loading="lazy"
            />
          )}
        </div>

        {/* Chart Info */}
        <div className="p-4">
          <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-2 truncate">
            {chart.filename || `Chart ${chart.id.slice(-8)}`}
          </h4>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{new Date(chart.createdAt).toLocaleDateString()}</span>
              <span>{Math.round(chart.size / 1024)} KB</span>
            </div>
            
            {chart.tags && chart.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {chart.tags.slice(0, 2).map(tag => (
                  <span
                    key={tag}
                    className="inline-block bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs px-2 py-0.5 rounded"
                  >
                    {tag}
                  </span>
                ))}
                {chart.tags.length > 2 && (
                  <span className="text-xs text-gray-500">+{chart.tags.length - 2}</span>
                )}
              </div>
            )}
            
            {chart.executionId && (
              <div className="text-xs text-gray-400 font-mono">
                Execution: {chart.executionId.slice(-8)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 pb-4 flex items-center space-x-2">
        <button
          onClick={viewChart}
          className="flex-1 btn btn-secondary btn-sm"
          title="View full size"
        >
          <Eye className="h-3 w-3 mr-1" />
          View
        </button>
        
        <button
          onClick={downloadChart}
          className="btn btn-secondary btn-sm"
          title="Download"
        >
          <Download className="h-3 w-3" />
        </button>
        
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="btn btn-danger btn-sm"
          title="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

function ChartListItem({ chart, selected, onSelect, onDelete }) {
  const [imageError, setImageError] = useState(false)

  return (
    <div className={`
      flex items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
      ${selected ? 'bg-automotive-50 dark:bg-automotive-900' : ''}
    `}>
      <input
        type="checkbox"
        checked={selected}
        onChange={onSelect}
        className="rounded border-gray-300 text-automotive-600 focus:ring-automotive-500 mr-4"
      />

      <div className="flex-shrink-0 w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden mr-4">
        {imageError ? (
          <div className="w-full h-full flex items-center justify-center">
            <BarChart3 className="h-6 w-6 text-gray-400" />
          </div>
        ) : (
          <img
            src={imagesAPI.getChart(chart.id)}
            alt={chart.filename}
            className="w-full h-full object-contain"
            onError={() => setImageError(true)}
            loading="lazy"
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-gray-900 dark:text-white mb-1">
          {chart.filename || `Chart ${chart.id.slice(-8)}`}
        </h4>
        
        <div className="flex items-center space-x-4 text-sm text-gray-500">
          <span>{new Date(chart.createdAt).toLocaleDateString()}</span>
          <span>{Math.round(chart.size / 1024)} KB</span>
          {chart.executionId && (
            <span className="font-mono">ID: {chart.executionId.slice(-8)}</span>
          )}
        </div>
        
        {chart.tags && chart.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {chart.tags.map(tag => (
              <span
                key={tag}
                className="inline-block bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs px-2 py-0.5 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2 ml-4">
        <a
          href={imagesAPI.getChart(chart.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary btn-sm"
        >
          <Eye className="h-3 w-3" />
        </a>
        
        <a
          href={imagesAPI.getChart(chart.id, { download: true })}
          download={`${chart.filename || `chart_${chart.id}`}.png`}
          className="btn btn-secondary btn-sm"
        >
          <Download className="h-3 w-3" />
        </a>
        
        <button
          onClick={onDelete}
          className="btn btn-danger btn-sm"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}