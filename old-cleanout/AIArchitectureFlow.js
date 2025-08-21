import React, { useState, useEffect } from 'react';
import { Box, Card, CardContent, Typography, Chip } from '@mui/material';
import ContentBlockRenderer from '../responses/ContentBlockRenderer';
import { ResponsesService } from '../../services/responsesService';
import { useIsMobile } from '../../hooks/use-mobile';
import useViewportScaling from '../../hooks/useViewportScaling';
import { isIOSDevice } from '../../utils/deviceDetection';
// Enhanced CSS for the AI Architecture Flow with responsive design
var architectureStyles = "\n  .ai-architecture-flow {\n    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);\n    min-height: 100vh;\n    overflow-x: hidden;\n    padding: 16px;\n    position: relative;\n  }\n  \n  .architecture-card {\n    background: rgba(30, 41, 59, 0.8) !important;\n    backdrop-filter: blur(10px);\n    border: 1px solid rgba(59, 130, 246, 0.2) !important;\n    border-radius: 12px !important;\n    transition: all 0.3s ease !important;\n    width: 100%;\n    overflow: hidden;\n  }\n  \n  .architecture-card:hover {\n    border-color: rgba(59, 130, 246, 0.4) !important;\n    transform: translateY(-2px);\n    box-shadow: 0 8px 32px rgba(59, 130, 246, 0.1) !important;\n  }\n\n  .container-wrapper {\n    width: 100%;\n    height: 100%;\n  }\n\n  .scroll-container {\n    width: 100%;\n    overflow-x: auto;\n    overflow-y: hidden;\n    -webkit-overflow-scrolling: touch;\n    scrollbar-width: thin;\n    scrollbar-color: rgba(59, 130, 246, 0.5) transparent;\n    padding-bottom: 8px;\n  }\n\n  .scroll-container::-webkit-scrollbar {\n    height: 4px;\n  }\n\n  .scroll-container::-webkit-scrollbar-track {\n    background: rgba(30, 41, 59, 0.3);\n    border-radius: 2px;\n  }\n\n  .scroll-container::-webkit-scrollbar-thumb {\n    background: rgba(59, 130, 246, 0.5);\n    border-radius: 2px;\n  }\n\n  .architecture-header {\n    display: flex;\n    justify-content: space-between;\n    align-items: center;\n    margin-bottom: 16px;\n    flex-wrap: wrap;\n    gap: 8px;\n  }\n\n  .status-indicator {\n    display: flex;\n    align-items: center;\n    gap: 8px;\n    padding: 8px 12px;\n    border-radius: 20px;\n    background: rgba(59, 130, 246, 0.1);\n    border: 1px solid rgba(59, 130, 246, 0.2);\n  }\n\n  .status-dot {\n    width: 8px;\n    height: 8px;\n    border-radius: 50%;\n    animation: pulse 2s infinite;\n  }\n\n  .status-connected { background-color: #10b981; }\n  .status-disconnected { background-color: #ef4444; }\n  .status-connecting { background-color: #f59e0b; }\n\n  @keyframes pulse {\n    0%, 100% { opacity: 1; }\n    50% { opacity: 0.5; }\n  }\n  \n  /* Tablet styles */\n  @media (max-width: 1024px) {\n    .ai-architecture-flow { \n      padding: 16px !important;\n      min-height: 50vh;\n    }\n    \n    .flow-chart-container {\n      min-width: 700px;\n      height: 350px;\n    }\n  }\n\n  /* Mobile styles */\n  @media (max-width: 768px) { \n    .ai-architecture-flow { \n      padding: 12px !important;\n      min-height: auto;\n    }\n    \n    .architecture-card {\n      border-radius: 8px !important;\n      margin: 0 !important;\n    }\n    \n    .architecture-header {\n      flex-direction: column;\n      align-items: stretch;\n      gap: 12px;\n    }\n    \n    .responsive-text { \n      font-size: 0.875rem !important; \n      line-height: 1.4 !important;\n    }\n\n    .status-indicator {\n      justify-content: center;\n      padding: 10px 16px;\n    }\n\n    .flow-chart-container {\n      min-width: 900px;\n      height: 320px;\n    }\n  }\n\n  /* Small mobile styles */\n  @media (max-width: 480px) {\n    .ai-architecture-flow { \n      padding: 8px !important; \n    }\n    \n    .architecture-card {\n      border-radius: 6px !important;\n    }\n    \n    .responsive-text { \n      font-size: 0.8125rem !important; \n    }\n\n    .flow-chart-container {\n      min-width: 800px;\n      height: 280px;\n    }\n  }\n\n  /* Extra small devices */\n  @media (max-width: 360px) {\n    .flow-chart-container {\n      min-width: 700px;\n      height: 260px;\n    }\n  }\n  \n  /* Fix for iOS devices */\n  @supports (-webkit-touch-callout: none) {\n    .scroll-container {\n      -webkit-overflow-scrolling: touch;\n    }\n    \n    .responsive-text {\n      /* Prevent text size adjustment on orientation change */\n      -webkit-text-size-adjust: 100%;\n    }\n  }\n";
var AIArchitectureFlow = function (_a) {
    var _b = _a.className, className = _b === void 0 ? '' : _b, _c = _a.obd2Status, obd2Status = _c === void 0 ? 'disconnected' : _c, _d = _a.apiStatus, apiStatus = _d === void 0 ? 'connected' : _d, _e = _a.imageAnalysisStatus, imageAnalysisStatus = _e === void 0 ? 'connected' : _e;
    var _f = useState(null), architectureBlock = _f[0], setArchitectureBlock = _f[1];
    var responsesService = useState(function () { return new ResponsesService(); })[0];
    // Use the shared hook for mobile detection
    var isMobile = useIsMobile();
    var isTablet = !isMobile && window.innerWidth <= 1024;
    var isIOS = isIOSDevice();
    // Use the viewport scaling hook for better mobile display
    useViewportScaling({
        checkOnMount: true,
        runOnResize: true
    });
    // Add styles to document
    useEffect(function () {
        var styleElement = document.createElement('style');
        styleElement.innerHTML = architectureStyles;
        document.head.appendChild(styleElement);
        return function () {
            if (document.head.contains(styleElement)) {
                document.head.removeChild(styleElement);
            }
        };
    }, []);
    // Initialize architecture flow
    useEffect(function () {
        generateArchitectureFlow();
    }, [obd2Status, apiStatus, imageAnalysisStatus, isMobile, isTablet]);
    // Define responsive node positions based on screen size
    var getResponsivePositions = function () {
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
    var generateArchitectureFlow = function () {
        var positions = getResponsivePositions();
        // Create flow chart block
        var block = {
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
    var getStatusText = function (status, system) {
        switch (status) {
            case 'connected': return "".concat(system, " Connected");
            case 'connecting': return "".concat(system, " Connecting...");
            default: return "".concat(system, " Disconnected");
        }
    };
    // Type guard to check if block is a chart
    var isChartBlock = function (block) {
        return block.type === 'chart';
    };
    var getBlockLabel = function (block) {
        if (isChartBlock(block)) {
            return block.chart_type || block.type;
        }
        return block.type;
    };
    var getBlockTitle = function (block) {
        if (isChartBlock(block)) {
            return block.title || 'Architecture';
        }
        return 'Content';
    };
    return (<div className={"ai-architecture-flow ".concat(className)}>
      <Box>
        {architectureBlock && (<Card className="architecture-card">
            <CardContent>
              <div className="architecture-header">
                <Box className="flex items-center gap-2">
                  <Chip label={getBlockLabel(architectureBlock)} size="small" className="bg-blue-600 text-white"/>
                  <Typography variant="caption" className="text-blue-400 responsive-text">
                    {getBlockTitle(architectureBlock).toUpperCase()}
                  </Typography>
                </Box>
                
                <div className="status-indicator">
                  <div className={"status-dot status-".concat(apiStatus)}></div>
                  <Typography variant="caption" className="text-white responsive-text">
                    {getStatusText(apiStatus, 'System')}
                  </Typography>
                </div>
              </div>
              
              <div className="container-wrapper">
                <div className="scroll-container">
                  <div className="flow-chart-container">
                    <ContentBlockRenderer block={architectureBlock}/>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>)}
      </Box>
    </div>);
};
export default AIArchitectureFlow;
