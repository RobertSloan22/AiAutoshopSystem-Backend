import React, { useState, useEffect } from 'react';
import { 
  Box, Card, CardContent, Typography, Chip
} from '@mui/material';
import ContentBlockRenderer from '../responses/ContentBlockRenderer';
import { ContentBlock, ChartContentBlock } from '../../types/responses';
import { ResponsesService } from '../../services/responsesService';
import { useIsMobile } from '../../hooks/use-mobile';
import useViewportScaling from '../../hooks/useViewportScaling';
import { isIOSDevice } from '../../utils/deviceDetection';

// Enhanced CSS for the AI Architecture Flow with responsive design
const architectureStyles = `
  .ai-architecture-flow {
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    min-height: 100vh;
    overflow-x: hidden;
    padding: 16px;
    position: relative;
  }
  
  .architecture-card {
    background: rgba(30, 41, 59, 0.8) !important;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(59, 130, 246, 0.2) !important;
    border-radius: 12px !important;
    transition: all 0.3s ease !important;
    width: 100%;
    overflow: hidden;
  }
  
  .architecture-card:hover {
    border-color: rgba(59, 130, 246, 0.4) !important;
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(59, 130, 246, 0.1) !important;
  }

  .container-wrapper {
    width: 100%;
    height: 100%;
  }

  .scroll-container {
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    scrollbar-color: rgba(59, 130, 246, 0.5) transparent;
    padding-bottom: 8px;
  }

  .scroll-container::-webkit-scrollbar {
    height: 4px;
  }

  .scroll-container::-webkit-scrollbar-track {
    background: rgba(30, 41, 59, 0.3);
    border-radius: 2px;
  }

  .scroll-container::-webkit-scrollbar-thumb {
    background: rgba(59, 130, 246, 0.5);
    border-radius: 2px;
  }

  .architecture-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    flex-wrap: wrap;
    gap: 8px;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 20px;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.2);
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    animation: pulse 2s infinite;
  }

  .status-connected { background-color: #10b981; }
  .status-disconnected { background-color: #ef4444; }
  .status-connecting { background-color: #f59e0b; }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  
  /* Tablet styles */
  @media (max-width: 1024px) {
    .ai-architecture-flow { 
      padding: 16px !important;
      min-height: 50vh;
    }
    
    .flow-chart-container {
      min-width: 700px;
      height: 350px;
    }
  }

  /* Mobile styles */
  @media (max-width: 768px) { 
    .ai-architecture-flow { 
      padding: 12px !important;
      min-height: auto;
    }
    
    .architecture-card {
      border-radius: 8px !important;
      margin: 0 !important;
    }
    
    .architecture-header {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }
    
    .responsive-text { 
      font-size: 0.875rem !important; 
      line-height: 1.4 !important;
    }

    .status-indicator {
      justify-content: center;
      padding: 10px 16px;
    }

    .flow-chart-container {
      min-width: 900px;
      height: 320px;
    }
  }

  /* Small mobile styles */
  @media (max-width: 480px) {
    .ai-architecture-flow { 
      padding: 8px !important; 
    }
    
    .architecture-card {
      border-radius: 6px !important;
    }
    
    .responsive-text { 
      font-size: 0.8125rem !important; 
    }

    .flow-chart-container {
      min-width: 800px;
      height: 280px;
    }
  }

  /* Extra small devices */
  @media (max-width: 360px) {
    .flow-chart-container {
      min-width: 700px;
      height: 260px;
    }
  }
  
  /* Fix for iOS devices */
  @supports (-webkit-touch-callout: none) {
    .scroll-container {
      -webkit-overflow-scrolling: touch;
    }
    
    .responsive-text {
      /* Prevent text size adjustment on orientation change */
      -webkit-text-size-adjust: 100%;
    }
  }
`;

interface AIArchitectureFlowProps {
  className?: string;
  obd2Status?: 'connected' | 'disconnected' | 'connecting';
  apiStatus?: 'connected' | 'disconnected' | 'connecting';
  imageAnalysisStatus?: 'connected' | 'disconnected' | 'connecting';
}

const AIArchitectureFlow: React.FC<AIArchitectureFlowProps> = ({ 
  className = '', 
  obd2Status = 'disconnected',
  apiStatus = 'connected',
  imageAnalysisStatus = 'connected'
}) => {
  const [architectureBlock, setArchitectureBlock] = useState<ContentBlock | null>(null);
  const [responsesService] = useState(() => new ResponsesService());
  
  // Use the shared hook for mobile detection
  const isMobile = useIsMobile();
  const isTablet = !isMobile && window.innerWidth <= 1024;
  const isIOS = isIOSDevice();
  
  // Use the viewport scaling hook for better mobile display
  useViewportScaling({
    checkOnMount: true,
    runOnResize: true
  });

  // Add styles to document
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.innerHTML = architectureStyles;
    document.head.appendChild(styleElement);
    
    return () => {
      if (document.head.contains(styleElement)) {
        document.head.removeChild(styleElement);
      }
    };
  }, []);

  // Initialize architecture flow
  useEffect(() => {
    generateArchitectureFlow();
  }, [obd2Status, apiStatus, imageAnalysisStatus, isMobile, isTablet]);

  // Define responsive node positions based on screen size
  const getResponsivePositions = () => {
    // Extra small mobile
    if (window.innerWidth <= 360) {
      return {
        '1': { x: 40, y: 120 },
        '2': { x: 120, y: 120 },
        '3': { x: 240, y: 120 },
        '4': { x: 360, y: 50 },
        '5': { x: 360, y: 100 },
        '6': { x: 360, y: 150 },
        '7': { x: 360, y: 200 },
        '8': { x: 480, y: 120 },
        '9': { x: 240, y: 240 },
        '10': { x: 160, y: 240 },
      };
    }
    
    // Small mobile
    if (window.innerWidth <= 480) {
      return {
        '1': { x: 50, y: 130 },
        '2': { x: 140, y: 130 },
        '3': { x: 270, y: 130 },
        '4': { x: 390, y: 60 },
        '5': { x: 390, y: 110 },
        '6': { x: 390, y: 160 },
        '7': { x: 390, y: 210 },
        '8': { x: 520, y: 130 },
        '9': { x: 270, y: 250 },
        '10': { x: 180, y: 250 },
      };
    }
    
    // Mobile
    if (isMobile) {
      return {
        '1': { x: 50, y: 140 },
        '2': { x: 150, y: 140 },
        '3': { x: 280, y: 140 },
        '4': { x: 420, y: 60 },
        '5': { x: 420, y: 120 },
        '6': { x: 420, y: 180 },
        '7': { x: 420, y: 240 },
        '8': { x: 560, y: 140 },
        '9': { x: 280, y: 260 },
        '10': { x: 190, y: 260 },
      };
    }
    
    // Tablet
    if (isTablet) {
      return {
        '1': { x: 40, y: 140 },
        '2': { x: 160, y: 140 },
        '3': { x: 320, y: 140 },
        '4': { x: 480, y: 50 },
        '5': { x: 480, y: 110 },
        '6': { x: 480, y: 170 },
        '7': { x: 480, y: 230 },
        '8': { x: 640, y: 140 },
        '9': { x: 320, y: 260 },
        '10': { x: 210, y: 260 },
      };
    }
    
    // Desktop (default)
    return {
      '1': { x: 50, y: 150 },
      '2': { x: 200, y: 150 },
      '3': { x: 400, y: 150 },
      '4': { x: 600, y: 50 },
      '5': { x: 600, y: 120 },
      '6': { x: 600, y: 190 },
      '7': { x: 600, y: 260 },
      '8': { x: 800, y: 150 },
      '9': { x: 400, y: 270 },
      '10': { x: 250, y: 270 },
    };
  };

  const generateArchitectureFlow = () => {
    const positions = getResponsivePositions();

    // Create flow chart block
    const block: ContentBlock = {
      type: 'chart',
      chart_type: 'flow',
      title: 'Automotive AI System Architecture',
      description: 'Complete image analysis, diagnosis and intelligence workflow',
      data: {
        nodes: [
          { 
            id: '1', 
            label: 'OBD2\nScanner', 
            position: positions['1'],
            color: obd2Status === 'connected' ? '#10b981' : '#ef4444'
          },
          { 
            id: '2', 
            label: 'Bluetooth\nConnect', 
            position: positions['2'],
            color: obd2Status === 'connected' ? '#10b981' : '#6b7280'
          },
          { 
            id: '3', 
            label: 'AI Core\nBackend', 
            position: positions['3'],
            color: apiStatus === 'connected' ? '#8b5cf6' : '#ef4444'
          },
          { 
            id: '4', 
            label: 'Realtime\nAI Assistant', 
            position: positions['4'],
            color: '#3b82f6'
          },
          { 
            id: '5', 
            label: 'Diagnostic\nData Analysis', 
            position: positions['5'],
            color: '#059669'
          },
          { 
            id: '6', 
            label: 'Technical\nResearch System', 
            position: positions['6'],
            color: '#dc2626'
          },
          { 
            id: '7', 
            label: 'Vector\nStorage', 
            position: positions['7'],
            color: '#f59e0b'
          },
          { 
            id: '8', 
            label: 'USER', 
            position: positions['8'],
            color: '#ec4899'
          },
          {
            id: '9',
            label: 'Image Analysis\nSystem',
            position: positions['9'],
            color: imageAnalysisStatus === 'connected' ? '#3b82f6' : '#ef4444'
          },
          {
            id: '10',
            label: 'Annotated\nImage Processing',
            position: positions['10'],
            color: '#10b981'
          }
        ],
        edges: [
          // Linear flow to AI Core Backend
          { id: 'e1-2', source: '1', target: '2', label: 'Data Stream', animated: true },
          { id: 'e2-3', source: '2', target: '3', label: 'Connected', animated: true },
          
          // Branching from AI Core Backend to primary systems
          { id: 'e3-4', source: '3', target: '4', label: 'Chat/Assist', animated: true },
          { id: 'e3-5', source: '3', target: '5', label: 'Diagnostics', animated: true },
          { id: 'e3-6', source: '3', target: '6', label: 'Research', animated: true },
          { id: 'e3-7', source: '3', target: '7', label: 'Storage', animated: true },
          { id: 'e3-9', source: '3', target: '9', label: 'Images', animated: true },
          
          // Image Analysis subsystem
          { id: 'e9-10', source: '9', target: '10', label: 'Annotation', animated: true },
          
          // All systems converge to USER
          { id: 'e4-8', source: '4', target: '8', label: 'Responses', animated: true },
          { id: 'e5-8', source: '5', target: '8', label: 'Insights', animated: true },
          { id: 'e6-8', source: '6', target: '8', label: 'Research', animated: true },
          { id: 'e7-8', source: '7', target: '8', label: 'Knowledge', animated: true },
          { id: 'e9-8', source: '9', target: '8', label: 'Analysis', animated: true }
        ]
      }
    };
    
    setArchitectureBlock(block);
  };

  const getStatusText = (status: string, system: string) => {
    switch (status) {
      case 'connected': return `${system} Connected`;
      case 'connecting': return `${system} Connecting...`;
      default: return `${system} Disconnected`;
    }
  };

  // Type guard to check if block is a chart
  const isChartBlock = (block: ContentBlock): block is ChartContentBlock => {
    return block.type === 'chart';
  };

  const getBlockLabel = (block: ContentBlock): string => {
    if (isChartBlock(block)) {
      return block.chart_type || block.type;
    }
    return block.type;
  };

  const getBlockTitle = (block: ContentBlock): string => {
    if (isChartBlock(block)) {
      return block.title || 'Architecture';
    }
    return 'Content';
  };

  return (
    <div className={`ai-architecture-flow ${className}`}>
      <Box>
        {architectureBlock && (
          <Card className="architecture-card">
            <CardContent>
              <div className="architecture-header">
                <Box className="flex items-center gap-2">
                  <Chip 
                    label={getBlockLabel(architectureBlock)} 
                    size="small" 
                    className="bg-blue-600 text-white"
                  />
                  <Typography variant="caption" className="text-blue-400 responsive-text">
                    {getBlockTitle(architectureBlock).toUpperCase()}
                  </Typography>
                </Box>
                
                <div className="status-indicator">
                  <div className={`status-dot status-${apiStatus}`}></div>
                  <Typography variant="caption" className="text-white responsive-text">
                    {getStatusText(apiStatus, 'System')}
                  </Typography>
                </div>
              </div>
              
              <div className="container-wrapper">
                <div className="scroll-container">
                  <div className="flow-chart-container">
                    <ContentBlockRenderer block={architectureBlock} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </Box>
    </div>
  );
};

export default AIArchitectureFlow;