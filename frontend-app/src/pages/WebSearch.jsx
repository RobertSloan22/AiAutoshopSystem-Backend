import React, { useState } from 'react'
import { Search, ExternalLink, Calendar, Globe, Image as ImageIcon, FileText, AlertTriangle } from 'lucide-react'
import { webSearchAPI } from '../services/api'
import { useAppContext } from '../context/AppContext'

export function WebSearch() {
  const [query, setQuery] = useState('')
  const [searchType, setSearchType] = useState('automotive')
  const [maxResults, setMaxResults] = useState(10)
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState(null)
  const [imageResults, setImageResults] = useState(null)
  const [activeTab, setActiveTab] = useState('web')

  const { currentVehicle, systemStatus, showError, showSuccess } = useAppContext()

  const searchTypes = [
    { value: 'general', label: 'General Web Search', description: 'Broad web search' },
    { value: 'automotive', label: 'Automotive', description: 'Vehicle and automotive content' },
    { value: 'technical', label: 'Technical', description: 'Repair procedures and technical guides' },
    { value: 'recall', label: 'Recalls & TSBs', description: 'Safety recalls and service bulletins' },
    { value: 'tsb', label: 'TSB Only', description: 'Technical service bulletins only' },
  ]

  const handleWebSearch = async () => {
    if (!query.trim()) {
      showError('Please enter a search query')
      return
    }

    if (systemStatus.webSearch === 'offline') {
      showError('Web search service is offline')
      return
    }

    setIsSearching(true)
    
    try {
      let enhancedQuery = query
      
      // Add vehicle context to query if available
      if (currentVehicle) {
        enhancedQuery = `${currentVehicle.year} ${currentVehicle.make} ${currentVehicle.model} ${query}`
      }

      const results = await webSearchAPI.search(enhancedQuery, {
        search_type: searchType,
        max_results: maxResults
      })

      setSearchResults(results)
      setActiveTab('web')
      
      if (results.success) {
        showSuccess(`Found ${results.results?.length || 0} results`)
      } else {
        showError(results.error || 'Search failed')
      }
      
    } catch (error) {
      showError(error.message || 'Search failed')
      setSearchResults({ success: false, error: error.message })
    } finally {
      setIsSearching(false)
    }
  }

  const handleImageSearch = async () => {
    if (!query.trim()) {
      showError('Please enter a search query')
      return
    }

    if (systemStatus.webSearch === 'offline') {
      showError('Web search service is offline')
      return
    }

    setIsSearching(true)
    
    try {
      let enhancedQuery = query
      
      // Add vehicle context for image search
      if (currentVehicle) {
        enhancedQuery = `${currentVehicle.year} ${currentVehicle.make} ${currentVehicle.model} ${query}`
      }

      const results = await webSearchAPI.searchImages(enhancedQuery, {
        vehicle_context: currentVehicle ? {
          year: currentVehicle.year,
          make: currentVehicle.make,
          model: currentVehicle.model
        } : {},
        image_type: getImageType(query)
      })

      setImageResults(results)
      setActiveTab('images')
      
      if (results.success) {
        showSuccess(`Found ${results.results?.length || 0} images`)
      } else {
        showError(results.error || 'Image search failed')
      }
      
    } catch (error) {
      showError(error.message || 'Image search failed')
      setImageResults({ success: false, error: error.message })
    } finally {
      setIsSearching(false)
    }
  }

  const getImageType = (query) => {
    const lowerQuery = query.toLowerCase()
    if (lowerQuery.includes('wiring') || lowerQuery.includes('electrical')) return 'wiring'
    if (lowerQuery.includes('diagram') || lowerQuery.includes('schematic')) return 'diagram'
    if (lowerQuery.includes('flowchart') || lowerQuery.includes('troubleshoot')) return 'flowchart'
    if (lowerQuery.includes('part') || lowerQuery.includes('component')) return 'parts'
    return 'general'
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (activeTab === 'web') {
        handleWebSearch()
      } else {
        handleImageSearch()
      }
    }
  }

  const clearResults = () => {
    setSearchResults(null)
    setImageResults(null)
    setQuery('')
  }

  const webSearchOffline = systemStatus.webSearch === 'offline'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Web Search
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Search for automotive technical information, recalls, and repair guides
        </p>
      </div>

      {/* Search Form */}
      <div className="card">
        <div className="card-body">
          {/* Search Tabs */}
          <div className="flex space-x-1 mb-4">
            <button
              onClick={() => setActiveTab('web')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'web'
                  ? 'bg-automotive-100 text-automotive-700 dark:bg-automotive-900 dark:text-automotive-300'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <Globe className="h-4 w-4 inline mr-2" />
              Web Search
            </button>
            <button
              onClick={() => setActiveTab('images')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'images'
                  ? 'bg-automotive-100 text-automotive-700 dark:bg-automotive-900 dark:text-automotive-300'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <ImageIcon className="h-4 w-4 inline mr-2" />
              Technical Images
            </button>
          </div>

          {/* Search Input */}
          <div className="space-y-4">
            <div>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="input flex-1"
                  placeholder={
                    activeTab === 'web'
                      ? "Search for recalls, TSBs, repair procedures..."
                      : "Search for wiring diagrams, parts diagrams, flowcharts..."
                  }
                  disabled={webSearchOffline}
                />
                <button
                  onClick={activeTab === 'web' ? handleWebSearch : handleImageSearch}
                  disabled={!query.trim() || isSearching || webSearchOffline}
                  className="btn btn-automotive"
                >
                  {isSearching ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </button>
              </div>
              
              {currentVehicle && (
                <div className="mt-2">
                  <span className="text-xs text-gray-500">
                    Context: {currentVehicle.year} {currentVehicle.make} {currentVehicle.model}
                  </span>
                </div>
              )}
            </div>

            {/* Search Options */}
            {activeTab === 'web' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Search Type
                  </label>
                  <select
                    value={searchType}
                    onChange={(e) => setSearchType(e.target.value)}
                    className="input"
                    disabled={webSearchOffline}
                  >
                    {searchTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {searchTypes.find(t => t.value === searchType)?.description}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Max Results
                  </label>
                  <select
                    value={maxResults}
                    onChange={(e) => setMaxResults(parseInt(e.target.value))}
                    className="input"
                    disabled={webSearchOffline}
                  >
                    <option value={5}>5 results</option>
                    <option value={10}>10 results</option>
                    <option value={20}>20 results</option>
                  </select>
                </div>
              </div>
            )}

            {/* Offline Warning */}
            {webSearchOffline && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                  <span className="text-sm text-red-800">
                    Web search service is currently offline. Please check system status.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Search Suggestions */}
      {!searchResults && !imageResults && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Quick Search Examples
            </h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Web Search</h4>
                <div className="space-y-2">
                  {[
                    'P0301 cylinder 1 misfire',
                    'brake pad replacement procedure',
                    'engine oil leak repair',
                    'transmission fluid change interval',
                    'airbag recall information'
                  ].map((example) => (
                    <button
                      key={example}
                      onClick={() => setQuery(example)}
                      className="text-left text-sm text-automotive-600 hover:text-automotive-700 dark:text-automotive-400 dark:hover:text-automotive-300 block"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Image Search</h4>
                <div className="space-y-2">
                  {[
                    'engine vacuum diagram',
                    'wiring harness connector',
                    'brake caliper assembly',
                    'timing belt replacement',
                    'fuse box layout'
                  ].map((example) => (
                    <button
                      key={example}
                      onClick={() => setQuery(example)}
                      className="text-left text-sm text-automotive-600 hover:text-automotive-700 dark:text-automotive-400 dark:hover:text-automotive-300 block"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Web Search Results */}
      {searchResults && (
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Web Search Results
              {searchResults.success && ` (${searchResults.results?.length || 0})`}
            </h3>
            <button onClick={clearResults} className="btn btn-secondary btn-sm">
              Clear Results
            </button>
          </div>
          <div className="card-body">
            {searchResults.success ? (
              searchResults.results?.length > 0 ? (
                <div className="space-y-4">
                  {searchResults.results.map((result, index) => (
                    <WebResultCard key={index} result={result} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No results found for your search query.
                </div>
              )
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                  <span className="text-red-800">
                    Search failed: {searchResults.error || 'Unknown error'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image Search Results */}
      {imageResults && (
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Image Search Results
              {imageResults.success && ` (${imageResults.results?.length || 0})`}
            </h3>
            <button onClick={clearResults} className="btn btn-secondary btn-sm">
              Clear Results
            </button>
          </div>
          <div className="card-body">
            {imageResults.success ? (
              imageResults.results?.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {imageResults.results.map((result, index) => (
                    <ImageResultCard key={index} result={result} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No images found for your search query.
                </div>
              )
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                  <span className="text-red-800">
                    Image search failed: {imageResults.error || 'Unknown error'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function WebResultCard({ result }) {
  const formatDate = (dateString) => {
    if (!dateString) return null
    try {
      return new Date(dateString).toLocaleDateString()
    } catch {
      return null
    }
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h4 className="text-lg font-medium text-gray-900 dark:text-white hover:text-automotive-600 dark:hover:text-automotive-400 line-clamp-2">
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {result.title}
            </a>
          </h4>
          
          <div className="flex items-center space-x-4 mt-1 mb-2">
            <span className="text-sm text-automotive-600 dark:text-automotive-400">
              {result.source}
            </span>
            {result.date && (
              <div className="flex items-center text-sm text-gray-500">
                <Calendar className="h-3 w-3 mr-1" />
                {formatDate(result.date)}
              </div>
            )}
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 mb-3">
            {result.snippet}
          </p>
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-mono">
              {result.url.length > 60 ? `${result.url.substring(0, 60)}...` : result.url}
            </span>
            
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-automotive-600 hover:text-automotive-700 dark:text-automotive-400 dark:hover:text-automotive-300 text-sm flex items-center"
            >
              Visit Site
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

function ImageResultCard({ result }) {
  const [imageError, setImageError] = useState(false)

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-lg transition-all">
      <div className="aspect-w-16 aspect-h-9 bg-gray-100 dark:bg-gray-800">
        {imageError ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-center">
              <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Image failed to load</p>
            </div>
          </div>
        ) : (
          <img
            src={result.thumbnail_url || result.image_url}
            alt={result.title}
            className="w-full h-48 object-cover"
            onError={() => setImageError(true)}
            loading="lazy"
          />
        )}
      </div>
      
      <div className="p-3">
        <h4 className="font-medium text-gray-900 dark:text-white text-sm line-clamp-2 mb-2">
          {result.title}
        </h4>
        
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{result.source}</span>
          {result.width && result.height && (
            <span>{result.width}×{result.height}</span>
          )}
        </div>
        
        <div className="flex items-center space-x-2 mt-2">
          <a
            href={result.image_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-automotive-600 hover:text-automotive-700 dark:text-automotive-400 dark:hover:text-automotive-300 text-xs flex items-center"
          >
            View Image
            <ExternalLink className="h-3 w-3 ml-1" />
          </a>
          
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 text-xs flex items-center"
          >
            Source
            <FileText className="h-3 w-3 ml-1" />
          </a>
        </div>
      </div>
    </div>
  )
}