import React, { useState, useCallback } from 'react'
import { Upload, Image as ImageIcon, Search, Eye, Trash2, Download } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { useQuery } from 'react-query'
import { imageAnalysisAPI } from '../services/api'
import { useAppContext } from '../context/AppContext'

export function ImageAnalysis() {
  const [selectedImages, setSelectedImages] = useState([])
  const [analysisPrompt, setAnalysisPrompt] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResults, setAnalysisResults] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchType, setSearchType] = useState('conversation')

  const { currentVehicle, showError, showSuccess } = useAppContext()

  const onDrop = useCallback((acceptedFiles) => {
    const imageFiles = acceptedFiles.map(file => ({
      id: Date.now() + Math.random(),
      file,
      preview: URL.createObjectURL(file),
      name: file.name,
      size: file.size
    }))
    setSelectedImages(prev => [...prev, ...imageFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    multiple: true,
    maxSize: 10 * 1024 * 1024 // 10MB
  })

  // Search results query
  const { data: searchResults, isLoading: searchLoading, refetch: refetchSearch } = useQuery(
    ['imageAnalysisSearch', searchQuery, searchType],
    async () => {
      if (!searchQuery.trim()) return null
      
      switch (searchType) {
        case 'conversation':
          return await imageAnalysisAPI.searchByConversation(searchQuery)
        case 'image':
          return await imageAnalysisAPI.searchByImage(searchQuery)
        case 'annotated':
          return await imageAnalysisAPI.searchAnnotated(searchQuery)
        default:
          return null
      }
    },
    {
      enabled: false // Manual trigger
    }
  )

  const removeImage = (id) => {
    setSelectedImages(prev => {
      const updated = prev.filter(img => img.id !== id)
      const removed = prev.find(img => img.id === id)
      if (removed?.preview) {
        URL.revokeObjectURL(removed.preview)
      }
      return updated
    })
  }

  const analyzeImages = async () => {
    if (selectedImages.length === 0) {
      showError('Please select images to analyze')
      return
    }

    if (!analysisPrompt.trim()) {
      showError('Please enter an analysis prompt')
      return
    }

    setIsAnalyzing(true)
    const results = []

    try {
      for (const image of selectedImages) {
        // Convert image to base64
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.readAsDataURL(image.file)
        })

        // Analyze image
        const result = await imageAnalysisAPI.analyze(
          base64,
          analysisPrompt,
          {
            vehicleContext: currentVehicle,
            filename: image.name
          }
        )

        results.push({
          ...result,
          imageId: image.id,
          imageName: image.name,
          imagePreview: image.preview
        })
      }

      setAnalysisResults(results)
      showSuccess(`Successfully analyzed ${results.length} image(s)`)
      
    } catch (error) {
      showError(error.message || 'Failed to analyze images')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleSearch = () => {
    if (searchQuery.trim()) {
      refetchSearch()
    }
  }

  const clearResults = () => {
    setAnalysisResults([])
    setSelectedImages([])
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Image Analysis
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Upload and analyze vehicle images with AI
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Section */}
        <div className="space-y-6">
          {/* Image Upload */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Upload Images
              </h3>
            </div>
            <div className="card-body">
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                  ${isDragActive 
                    ? 'border-automotive-400 bg-automotive-50 dark:bg-automotive-900' 
                    : 'border-gray-300 dark:border-gray-700 hover:border-automotive-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }
                `}
              >
                <input {...getInputProps()} />
                <Upload className="h-10 w-10 text-gray-400 mx-auto mb-4" />
                {isDragActive ? (
                  <p className="text-automotive-600 dark:text-automotive-400">
                    Drop images here...
                  </p>
                ) : (
                  <div>
                    <p className="text-gray-600 dark:text-gray-400 mb-2">
                      Drag and drop images here, or click to select
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      Supports JPEG, PNG, GIF, WebP (max 10MB)
                    </p>
                  </div>
                )}
              </div>

              {/* Selected Images */}
              {selectedImages.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Selected Images ({selectedImages.length})
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {selectedImages.map((image) => (
                      <div key={image.id} className="relative group">
                        <img
                          src={image.preview}
                          alt={image.name}
                          className="w-full h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                        />
                        <button
                          onClick={() => removeImage(image.id)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          {image.name}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Analysis Prompt */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Analysis Instructions
              </h3>
            </div>
            <div className="card-body">
              <textarea
                value={analysisPrompt}
                onChange={(e) => setAnalysisPrompt(e.target.value)}
                rows={4}
                className="input"
                placeholder="Describe what you want to analyze in the images... (e.g., 'Analyze the condition of the brake pads', 'Identify any damage or wear', 'Check engine components for issues')"
              />
              
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  {currentVehicle && (
                    <span className="bg-automotive-100 text-automotive-800 px-2 py-1 rounded text-xs">
                      Context: {currentVehicle.year} {currentVehicle.make} {currentVehicle.model}
                    </span>
                  )}
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={clearResults}
                    className="btn btn-secondary btn-sm"
                    disabled={selectedImages.length === 0 && analysisResults.length === 0}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear
                  </button>
                  
                  <button
                    onClick={analyzeImages}
                    disabled={selectedImages.length === 0 || !analysisPrompt.trim() || isAnalyzing}
                    className="btn btn-automotive"
                  >
                    {isAnalyzing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        Analyze Images
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search Section */}
        <div className="space-y-6">
          {/* Search Previous Analyses */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Search Previous Analyses
              </h3>
            </div>
            <div className="card-body">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Search Type
                  </label>
                  <select
                    value={searchType}
                    onChange={(e) => setSearchType(e.target.value)}
                    className="input"
                  >
                    <option value="conversation">By Conversation ID</option>
                    <option value="image">By Image URL</option>
                    <option value="annotated">Annotated Analyses</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Search Query
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="input flex-1"
                      placeholder={
                        searchType === 'conversation' ? 'Enter conversation ID' :
                        searchType === 'image' ? 'Enter image URL or data' :
                        'Enter original conversation ID'
                      }
                    />
                    <button
                      onClick={handleSearch}
                      disabled={!searchQuery.trim() || searchLoading}
                      className="btn btn-automotive"
                    >
                      <Search className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Search Results */}
              {searchLoading && (
                <div className="mt-4 text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-automotive-600 mx-auto"></div>
                  <p className="text-sm text-gray-500 mt-2">Searching...</p>
                </div>
              )}

              {searchResults && (
                <div className="mt-4 space-y-3">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Search Results ({searchResults.length || 0})
                  </h4>
                  {searchResults.length === 0 ? (
                    <p className="text-sm text-gray-500">No results found</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {searchResults.map((result, index) => (
                        <SearchResultCard key={index} result={result} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Analysis Results */}
      {analysisResults.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Analysis Results
            </h3>
          </div>
          <div className="card-body">
            <div className="space-y-6">
              {analysisResults.map((result, index) => (
                <AnalysisResultCard key={index} result={result} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SearchResultCard({ result }) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <div className="flex items-start space-x-3">
        {result.imageUrl && (
          <img
            src={result.imageUrl}
            alt="Analysis result"
            className="w-12 h-12 object-cover rounded"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {result.prompt || 'Image Analysis'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
            {result.explanation}
          </p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-400">
              {new Date(result.createdAt).toLocaleDateString()}
            </span>
            <span className="text-xs bg-automotive-100 text-automotive-800 px-2 py-1 rounded">
              {result.conversationId}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function AnalysisResultCard({ result }) {
  const downloadResult = () => {
    const data = {
      analysis: result.explanation,
      prompt: result.prompt,
      image: result.imageName,
      timestamp: new Date().toISOString(),
      vehicleContext: result.vehicleContext
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `analysis_${result.imageName}_${Date.now()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-start justify-between mb-4">
        <h4 className="text-lg font-medium text-gray-900 dark:text-white">
          {result.imageName}
        </h4>
        <button
          onClick={downloadResult}
          className="btn btn-secondary btn-sm"
          title="Download analysis result"
        >
          <Download className="h-4 w-4" />
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <img
            src={result.imagePreview}
            alt={result.imageName}
            className="w-full h-48 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
          />
        </div>
        
        <div className="space-y-3">
          <div>
            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Analysis Prompt:
            </h5>
            <p className="text-sm text-gray-600 dark:text-gray-400 italic">
              "{result.prompt}"
            </p>
          </div>
          
          <div>
            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              AI Analysis:
            </h5>
            <div className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 p-3 rounded">
              <p className="whitespace-pre-wrap">{result.explanation}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}