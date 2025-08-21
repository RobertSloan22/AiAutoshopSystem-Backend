// Enhanced Chart Display Component with Dual Image Serving
import React, { useState, useEffect, useRef } from 'react';
import { 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Maximize2, 
  Minimize2,
  Image as ImageIcon,
  FileText,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Eye,
  Trash2,
  Share2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const EnhancedChartDisplay = ({ 
  charts = [], 
  onClear, 
  onChartClick,
  theme = 'dark',
  showControls = true,
  allowDownload = true,
  allowDelete = true,
  maxChartsDisplay = 12
}) => {
  const [selectedChart, setSelectedChart] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [fullscreenChart, setFullscreenChart] = useState(null);
  const [loadingStates, setLoadingStates] = useState({});
  const [errorStates, setErrorStates] = useState({});
  const [currentPage, setCurrentPage] = useState(0);
  const [imageLoadStrategy, setImageLoadStrategy] = useState('progressive'); // 'base64', 'api', 'progressive'
  const modalRef = useRef(null);
  const fullscreenRef = useRef(null);

  const chartsPerPage = 6;
  const totalPages = Math.ceil(charts.length / chartsPerPage);
  const paginatedCharts = charts.slice(
    currentPage * chartsPerPage,
    (currentPage + 1) * chartsPerPage
  );

  // Theme classes
  const themeClasses = theme === 'dark' ? {
    bg: 'bg-gray-900',
    bgSecondary: 'bg-gray-800',
    bgTertiary: 'bg-gray-700',
    text: 'text-white',
    textSecondary: 'text-gray-300',
    textMuted: 'text-gray-400',
    border: 'border-gray-600',
    button: 'bg-blue-600 hover:bg-blue-700',
    buttonSecondary: 'bg-gray-600 hover:bg-gray-700',
    buttonDanger: 'bg-red-600 hover:bg-red-700'
  } : {
    bg: 'bg-white',
    bgSecondary: 'bg-gray-50',
    bgTertiary: 'bg-gray-100',
    text: 'text-gray-900',
    textSecondary: 'text-gray-700',
    textMuted: 'text-gray-500',
    border: 'border-gray-300',
    button: 'bg-blue-600 hover:bg-blue-700',
    buttonSecondary: 'bg-gray-500 hover:bg-gray-600',
    buttonDanger: 'bg-red-600 hover:bg-red-700'
  };

  // Handle image loading with progressive enhancement
  const handleImageLoad = (chartId) => {
    setLoadingStates(prev => ({
      ...prev,
      [chartId]: false
    }));
    setErrorStates(prev => ({
      ...prev,
      [chartId]: false
    }));
  };

  const handleImageError = (chartId, chart) => {
    setErrorStates(prev => ({
      ...prev,
      [chartId]: true
    }));
    
    // Try fallback strategies
    if (imageLoadStrategy === 'api' && chart.data) {
      // Fallback to base64
      const imgElement = document.querySelector(`[data-chart-id="${chartId}"]`);
      if (imgElement && chart.data) {
        imgElement.src = chart.data;
      }
    }
  };

  // Download functionality
  const downloadChart = async (chart, filename) => {
    try {
      let dataUrl = chart.data;
      let downloadFilename = filename || chart.path?.split('/').pop() || 'chart.png';

      // If using API strategy, fetch the image
      if (imageLoadStrategy === 'api' && chart.url) {
        try {
          const response = await fetch(`${chart.url}?download=true`);
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          
          const link = document.createElement('a');
          link.href = url;
          link.download = downloadFilename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          return;
        } catch (error) {
          console.warn('API download failed, falling back to base64:', error);
        }
      }

      // Base64 download fallback
      if (dataUrl) {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = downloadFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  // Share chart functionality
  const shareChart = async (chart) => {
    if (chart.url) {
      try {
        if (navigator.share) {
          await navigator.share({
            title: `Diagnostic Chart - ${chart.filename || 'Chart'}`,
            url: chart.url
          });
        } else {
          // Fallback to clipboard
          await navigator.clipboard.writeText(chart.url);
          // You might want to show a toast notification here
        }
      } catch (error) {
        console.error('Sharing failed:', error);
      }
    }
  };

  // Delete chart functionality
  const deleteChart = async (chartId) => {
    if (allowDelete && window.confirm('Are you sure you want to delete this chart?')) {
      try {
        // If chart has imageId, delete from backend
        const chart = charts.find(c => c.id === chartId);
        if (chart && chart.imageId) {
          await fetch(`/api/images/charts/${chart.imageId}`, {
            method: 'DELETE'
          });
        }
        
        // Remove from local state
        const updatedCharts = charts.filter(c => c.id !== chartId);
        onClear?.(updatedCharts);
      } catch (error) {
        console.error('Failed to delete chart:', error);
      }
    }
  };

  // Modal component for detailed view
  const ChartModal = ({ chart, onClose }) => {
    const [modalZoom, setModalZoom] = useState(1);

    useEffect(() => {
      const handleEscape = (e) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div className={`${themeClasses.bgSecondary} rounded-lg max-w-6xl max-h-[90vh] w-full mx-4 flex flex-col`}>
          {/* Modal Header */}
          <div className={`p-4 border-b ${themeClasses.border} flex items-center justify-between`}>
            <div>
              <h3 className={`text-lg font-semibold ${themeClasses.text}`}>
                Chart Details
              </h3>
              <p className={`text-sm ${themeClasses.textMuted}`}>
                {chart.filename || chart.path?.split('/').pop() || 'Unnamed Chart'}
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Zoom Controls */}
              <button
                onClick={() => setModalZoom(z => Math.max(0.25, z - 0.25))}
                className={`p-2 ${themeClasses.buttonSecondary} ${themeClasses.text} rounded`}
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              
              <span className={`px-2 text-sm ${themeClasses.textSecondary}`}>
                {Math.round(modalZoom * 100)}%
              </span>
              
              <button
                onClick={() => setModalZoom(z => Math.min(3, z + 0.25))}
                className={`p-2 ${themeClasses.buttonSecondary} ${themeClasses.text} rounded`}
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => setModalZoom(1)}
                className={`p-2 ${themeClasses.buttonSecondary} ${themeClasses.text} rounded`}
                title="Reset Zoom"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              
              <button
                onClick={onClose}
                className={`p-2 ${themeClasses.buttonDanger} text-white rounded`}
                title="Close"
              >
                ×
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-auto p-4">
            <div className="flex justify-center">
              <div 
                className="transition-transform duration-200 origin-center"
                style={{ transform: `scale(${modalZoom})` }}
              >
                <ProgressiveImage
                  chart={chart}
                  alt="Detailed Chart View"
                  className="max-w-full h-auto"
                  strategy={imageLoadStrategy}
                />
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className={`p-4 border-t ${themeClasses.border} flex justify-center space-x-3`}>
            {allowDownload && (
              <button
                onClick={() => downloadChart(chart, chart.filename)}
                className={`px-4 py-2 ${themeClasses.button} text-white rounded flex items-center space-x-2`}
              >
                <Download className="w-4 h-4" />
                <span>Download</span>
              </button>
            )}
            
            {chart.url && (
              <button
                onClick={() => shareChart(chart)}
                className={`px-4 py-2 ${themeClasses.buttonSecondary} ${themeClasses.text} rounded flex items-center space-x-2`}
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </button>
            )}
            
            {chart.url && (
              <a
                href={chart.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`px-4 py-2 ${themeClasses.buttonSecondary} ${themeClasses.text} rounded flex items-center space-x-2`}
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open</span>
              </a>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Progressive image component
  const ProgressiveImage = ({ chart, alt, className, strategy }) => {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [currentSrc, setCurrentSrc] = useState('');

    useEffect(() => {
      // Determine image source based on strategy
      let src = '';
      if (strategy === 'base64' || !chart.url) {
        src = chart.data;
      } else if (strategy === 'api') {
        src = chart.url;
      } else { // progressive
        src = chart.url || chart.data;
      }
      
      setCurrentSrc(src);
      setImageLoaded(false);
      setImageError(false);
    }, [chart, strategy]);

    return (
      <div className="relative">
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-700 rounded">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
          </div>
        )}
        
        {imageError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-700 rounded">
            <div className="text-center text-gray-400">
              <AlertCircle className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">Failed to load image</p>
              {strategy === 'api' && chart.data && (
                <button
                  onClick={() => {
                    setCurrentSrc(chart.data);
                    setImageError(false);
                  }}
                  className="text-blue-400 text-xs mt-1 hover:underline"
                >
                  Try fallback
                </button>
              )}
            </div>
          </div>
        )}
        
        <img
          src={currentSrc}
          alt={alt}
          className={`${className} ${imageLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            if (strategy === 'progressive' && chart.url && chart.data && currentSrc === chart.url) {
              // Try fallback to base64
              setCurrentSrc(chart.data);
              setImageError(false);
            } else {
              setImageError(true);
            }
          }}
        />
      </div>
    );
  };

  if (charts.length === 0) {
    return (
      <div className={`${themeClasses.bgSecondary} rounded-lg p-8 text-center`}>
        <ImageIcon className={`w-16 h-16 ${themeClasses.textMuted} mx-auto mb-4`} />
        <h3 className={`text-xl font-semibold ${themeClasses.text} mb-2`}>No Charts Generated</h3>
        <p className={`${themeClasses.textMuted}`}>
          Charts and visualizations will appear here as they are generated during the diagnostic process.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-2xl font-bold ${themeClasses.text} flex items-center`}>
            <ImageIcon className="w-6 h-6 text-blue-400 mr-2" />
            Generated Charts ({charts.length})
          </h2>
          <p className={`${themeClasses.textMuted} mt-1`}>
            Diagnostic visualizations and analysis charts
          </p>
        </div>

        {showControls && (
          <div className="flex items-center space-x-3">
            {/* Image Loading Strategy */}
            <select
              value={imageLoadStrategy}
              onChange={(e) => setImageLoadStrategy(e.target.value)}
              className={`${themeClasses.bgTertiary} ${themeClasses.text} px-3 py-2 rounded border ${themeClasses.border}`}
            >
              <option value="progressive">Progressive</option>
              <option value="api">API Serving</option>
              <option value="base64">Base64 Only</option>
            </select>

            <button
              onClick={onClear}
              className={`px-4 py-2 ${themeClasses.buttonDanger} text-white rounded flex items-center space-x-2`}
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear All</span>
            </button>
          </div>
        )}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedCharts.map((chart, index) => {
          const chartId = chart.id || chart.path || `chart-${index}`;
          
          return (
            <div
              key={chartId}
              className={`${themeClasses.bgSecondary} rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 group`}
            >
              {/* Chart Image */}
              <div className="relative aspect-video">
                <ProgressiveImage
                  chart={chart}
                  alt={`Chart ${index + 1}`}
                  className="w-full h-full object-contain cursor-pointer"
                  strategy={imageLoadStrategy}
                />
                
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                  <button
                    onClick={() => setSelectedChart(chart)}
                    className="opacity-0 group-hover:opacity-100 bg-white bg-opacity-20 backdrop-blur-sm rounded-full p-3 transition-all duration-200 hover:bg-opacity-30"
                  >
                    <Eye className="w-6 h-6 text-white" />
                  </button>
                </div>
              </div>

              {/* Chart Info */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className={`font-semibold ${themeClasses.text} truncate`}>
                      {chart.filename || chart.path?.split('/').pop() || `Chart ${index + 1}`}
                    </h3>
                    <p className={`text-sm ${themeClasses.textMuted} mt-1`}>
                      Generated: {new Date(chart.generatedAt || Date.now()).toLocaleString()}
                    </p>
                  </div>
                  
                  {chart.imageId && (
                    <span className={`text-xs ${themeClasses.textMuted} bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded`}>
                      ID: {chart.imageId.slice(-8)}
                    </span>
                  )}
                </div>

                {/* Chart Actions */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setSelectedChart(chart)}
                    className={`flex-1 px-3 py-2 ${themeClasses.button} text-white rounded text-sm flex items-center justify-center space-x-1`}
                  >
                    <Eye className="w-4 h-4" />
                    <span>View</span>
                  </button>

                  {allowDownload && (
                    <button
                      onClick={() => downloadChart(chart, chart.filename)}
                      className={`px-3 py-2 ${themeClasses.buttonSecondary} ${themeClasses.text} rounded text-sm`}
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}

                  {chart.url && (
                    <button
                      onClick={() => shareChart(chart)}
                      className={`px-3 py-2 ${themeClasses.buttonSecondary} ${themeClasses.text} rounded text-sm`}
                      title="Share"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  )}

                  {allowDelete && (
                    <button
                      onClick={() => deleteChart(chartId)}
                      className={`px-3 py-2 ${themeClasses.buttonDanger} text-white rounded text-sm`}
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className={`p-2 ${themeClasses.buttonSecondary} ${themeClasses.text} rounded disabled:opacity-50`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className={`px-4 py-2 ${themeClasses.textSecondary}`}>
            Page {currentPage + 1} of {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage === totalPages - 1}
            className={`p-2 ${themeClasses.buttonSecondary} ${themeClasses.text} rounded disabled:opacity-50`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modal */}
      {selectedChart && (
        <ChartModal 
          chart={selectedChart} 
          onClose={() => setSelectedChart(null)} 
        />
      )}
    </div>
  );
};

export default EnhancedChartDisplay;