var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
// src/components/VehicleResearch.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useCustomer } from '../../context/CustomerContext';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import { Button } from '../ui/button';
import { useResearch } from '../../context/ResearchContext';
import { ImageSearchModal } from './ImageSearchModal';
import { Imagemodal } from './Imagemodal';
import { Search, ExternalLink, Trash2, Upload } from 'lucide-react';
import { CustomerContextDisplay } from "../../components/customer/CustomerContextDisplay";
import { AppointmentsPage } from "../../components/assistant/AppointmentsPage";
import { App } from '../../app/src/app/App';
import { TranscriptProvider } from '../../app/src/app/contexts/TranscriptContext';
import { EventProvider } from '../../app/src/app/contexts/EventContext';
import { VerticalLinearStepper } from '../dtc/Stepper';
var getImageUrl = function (url) {
    if (!url)
        return '';
    try {
        // Clean the URL
        var cleanUrl = url.trim().replace(/\s+/g, '');
        // Handle different URL formats
        if (cleanUrl.startsWith('data:')) {
            return cleanUrl; // Return as-is if it's a base64 image
        }
        // Always use proxy in electron environment
        if (window.electron && !cleanUrl.startsWith('data:')) {
            // Check if baseURL has "/api" already
            var baseUrl = axiosInstance.defaults.baseURL || '';
            var proxyPath = baseUrl.includes('/api') ? '/proxy-image' : '/api/proxy-image';
            var proxyUrl = "".concat(baseUrl).concat(proxyPath, "?url=").concat(encodeURIComponent(cleanUrl));
            console.log('Using proxy URL:', proxyUrl);
            return proxyUrl;
        }
        return cleanUrl;
    }
    catch (error) {
        console.error('Error processing image URL:', error);
        return '/placeholder-image.png'; // Return fallback image path on error
    }
};
// Add this helper for image error handling
var handleImageError = function (event) {
    var img = event.currentTarget;
    // Check if we're already using the fallback to prevent loops
    if (img.src.includes('placeholder-image.png')) {
        return; // Already showing fallback, don't process further
    }
    // Set fallback image for broken images
    img.onerror = null; // Prevent infinite error loop
    img.src = '/placeholder-image.png'; // Replace with your fallback image path
    console.error('Image failed to load:', img.src);
    // Add styling to indicate broken image
    img.style.opacity = '0.5';
    img.style.border = '1px dashed #ff0000';
    // Add a small caption below the image container
    var parent = img.parentElement;
    if (parent) {
        // Check if we already added a caption
        var existingCaption = parent.querySelector('[data-image-error-caption]');
        if (!existingCaption) {
            var caption = document.createElement('div');
            caption.textContent = 'Image unavailable';
            caption.style.color = '#ff0000';
            caption.style.fontSize = '12px';
            caption.style.textAlign = 'center';
            caption.setAttribute('data-image-error-caption', 'true');
            parent.appendChild(caption);
        }
    }
};
//Main Data Modal 
var DetailModal = function (_a) {
    var isOpen = _a.isOpen, onClose = _a.onClose, loading = _a.loading, data = _a.data;
    if (!isOpen)
        return null;
    return (<div className="fixed inset-0 bg-black bg-opacity-5 z-50 flex items-center justify-center">
      <div className="bg-gray-800 rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-bold text-white">{data === null || data === void 0 ? void 0 : data.title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {loading ? (<div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>) : (<div className="space-y-4">
            <div className="bg-blue-800 p-4 rounded-lg">
              <h4 className="text-blue-400 text-3xl mb-2">Detailed Description</h4>
              <p className="text-white text-2xl">{data === null || data === void 0 ? void 0 : data.detailedDescription}</p>
            </div>
            
            {/* Component Location */}
            {(data === null || data === void 0 ? void 0 : data.componentLocation) && (<div className="bg-blue-900 p-4 rounded-lg">
                <h4 className="text-blue-400 text-3xl mb-2">Component Location</h4>
                <p className="text-white text-2xl">{data.componentLocation}</p>
              </div>)}
            
            {/* Service Manual References */}
            {(data === null || data === void 0 ? void 0 : data.serviceManualReferences) && data.serviceManualReferences.length > 0 && (<div className="bg-blue-900 p-4 rounded-lg">
                <h4 className="text-blue-400 text-3xl mb-2">Service Manual References</h4>
                <ul className="list-disc list-inside text-white space-y-2">
                  {data.serviceManualReferences.map(function (ref, index) { return (<li key={index} className="text-2xl">{ref}</li>); })}
                </ul>
              </div>)}

            {(data === null || data === void 0 ? void 0 : data.additionalSteps) && (<div className="bg-yellow-900 p-4 rounded-lg">
                <h4 className="text-blue-400 text-3xl mb-2">Additional Steps</h4>
                <ul className="list-disc list-inside text-white space-y-2">
                  {data.additionalSteps.map(function (step, index) { return (<li key={index} className="text-2xl">
                      {step}
                    </li>); })}
                </ul>
              </div>)}
            
            {/* Torque Specifications */}
            {(data === null || data === void 0 ? void 0 : data.torqueSpecifications) && data.torqueSpecifications.length > 0 && (<div className="bg-yellow-900 p-4 rounded-lg">
                <h4 className="text-blue-400 text-3xl mb-2">Torque Specifications</h4>
                <ul className="list-disc list-inside text-white space-y-2">
                  {data.torqueSpecifications.map(function (spec, index) { return (<li key={index} className="text-2xl">{spec}</li>); })}
                </ul>
              </div>)}
            
            {/* OEM Part Numbers */}
            {(data === null || data === void 0 ? void 0 : data.oemPartNumbers) && data.oemPartNumbers.length > 0 && (<div className="bg-yellow-900 p-4 rounded-lg">
                <h4 className="text-blue-400 text-3xl mb-2">OEM Part Numbers</h4>
                <ul className="list-disc list-inside text-white space-y-2">
                  {data.oemPartNumbers.map(function (part, index) { return (<li key={index} className="text-2xl">{part}</li>); })}
                </ul>
              </div>)}
            
            {/* Specific Tools */}
            {(data === null || data === void 0 ? void 0 : data.specificTools) && data.specificTools.length > 0 && (<div className="bg-yellow-900 p-4 rounded-lg">
                <h4 className="text-blue-400 text-3xl mb-2">Specific Tools Required</h4>
                <ul className="list-disc list-inside text-white space-y-2">
                  {data.specificTools.map(function (tool, index) { return (<li key={index} className="text-2xl">{tool}</li>); })}
                </ul>
              </div>)}

            {(data === null || data === void 0 ? void 0 : data.warnings) && (<div className="bg-red-900 bg-opacity-50 p-4 rounded-lg">
                <h4 className="text-red-400 text-3xl mb-2">Important Warnings</h4>
                <ul className="list-disc list-inside text-white space-y-2">
                  {data.warnings.map(function (warning, index) { return (<li key={index} className="text-2xl">
                      {warning}
                    </li>); })}
                </ul>
              </div>)}

            {(data === null || data === void 0 ? void 0 : data.expertTips) && (<div className="bg-green-900 bg-opacity-50 p-4 rounded-lg">
                <h4 className="text-green-400 text-3xl mb-2">Expert Tips</h4>
                <ul className="list-disc list-inside text-white space-y-2">
                  {data.expertTips.map(function (tip, index) { return (<li key={index} className="text-2xl">
                      {tip}
                    </li>); })}
                </ul>
              </div>)}
            
            {/* Manufacturer Specific Info */}
            {(data === null || data === void 0 ? void 0 : data.manufacturerSpecificInfo) && (<div className="bg-green-900 bg-opacity-50 p-4 rounded-lg">
                <h4 className="text-green-400 text-3xl mb-2">Manufacturer Specific Information</h4>
                <p className="text-white text-2xl">{data.manufacturerSpecificInfo}</p>
              </div>)}
            
            {/* Common Failure Patterns */}
            {(data === null || data === void 0 ? void 0 : data.commonFailurePatterns) && data.commonFailurePatterns.length > 0 && (<div className="bg-red-900 bg-opacity-50 p-4 rounded-lg">
                <h4 className="text-red-400 text-3xl mb-2">Common Failure Patterns</h4>
                <ul className="list-disc list-inside text-white space-y-2">
                  {data.commonFailurePatterns.map(function (pattern, index) { return (<li key={index} className="text-2xl">{pattern}</li>); })}
                </ul>
              </div>)}

            {(data === null || data === void 0 ? void 0 : data.additionalResources) && (<div className="bg-gray-800 p-4 rounded-lg">
                <h4 className="text-blue-400 text-xl mb-2">Additional Resources</h4>
                <div className="space-y-3">
                  {data.additionalResources.map(function (resource, index) { return (<div key={index} className="border-l-4 border-blue-500 pl-4">
                      <h5 className="text-white text-lg font-semibold">{resource.title}</h5>
                      <p className="text-gray-300">{resource.description}</p>
                      
                      {/* Document number if available */}
                      {resource.documentNumber && (<p className="text-gray-300">Document #: {resource.documentNumber}</p>)}
                      
                      {/* Page numbers if available */}
                      {resource.pageNumbers && (<p className="text-gray-300">Pages: {resource.pageNumbers}</p>)}
                      
                      {resource.url && (<a href={resource.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                          Learn More →
                        </a>)}
                    </div>); })}
                </div>
              </div>)}

            {(data === null || data === void 0 ? void 0 : data.estimatedTime) && (<div className="mt-4 text-gray-300">
                <span className="text-blue-400">Estimated Time:</span> {data.estimatedTime}
              </div>)}

            {(data === null || data === void 0 ? void 0 : data.requiredExpertise) && (<div className="mt-2 text-gray-300">
                <span className="text-blue-400">Required Expertise:</span> {data.requiredExpertise}
              </div>)}
          </div>)}
      </div>
    </div>);
};
// New component for drag and drop functionality
var DropZone = function (_a) {
    var onImageUpload = _a.onImageUpload;
    var _b = useState(false), isDragging = _b[0], setIsDragging = _b[1];
    var fileInputRef = useRef(null);
    var handleDragOver = function (e) {
        e.preventDefault();
        setIsDragging(true);
    };
    var handleDragLeave = function () {
        setIsDragging(false);
    };
    var handleDrop = function (e) {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            var file = e.dataTransfer.files[0];
            if (file.type.startsWith('image/')) {
                onImageUpload(file);
            }
            else {
                toast.error('Please upload an image file');
            }
        }
    };
    var handleFileInput = function (e) {
        if (e.target.files && e.target.files.length > 0) {
            var file = e.target.files[0];
            if (file.type.startsWith('image/')) {
                onImageUpload(file);
            }
            else {
                toast.error('Please upload an image file');
            }
        }
    };
    var handleButtonClick = function () {
        var _a;
        (_a = fileInputRef.current) === null || _a === void 0 ? void 0 : _a.click();
    };
    return (<div className={"border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ".concat(isDragging ? 'border-blue-500 bg-blue-900 bg-opacity-20' : 'border-gray-600')} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={handleButtonClick}>
      <input type="file" ref={fileInputRef} onChange={handleFileInput} className="hidden" accept="image/*"/>
      <Upload className="mx-auto h-10 w-10 text-gray-400"/>
      <p className="mt-2 text-xl font-bold text-gray-400">
        {isDragging ? 'Drop image here' : 'Drag & drop an image or click to upload'}
      </p>
      <p className="text-xl text-gray-500">
        Supported formats: JPG, PNG, GIF
      </p>
    </div>);
};
// Update the props interface to reflect that onAskQuestion doesn't return a value
var TechnicalQuestionInput = function (_a) {
    var onAskQuestion = _a.onAskQuestion, isLoading = _a.isLoading;
    var _b = useState(''), question = _b[0], setQuestion = _b[1];
    var _c = useState(''), dtcCode = _c[0], setDtcCode = _c[1];
    var _d = useState(null), answer = _d[0], setAnswer = _d[1];
    var handleSubmit = function (e) { return __awaiter(void 0, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    e.preventDefault();
                    if (!question.trim())
                        return [2 /*return*/];
                    setAnswer(null);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, onAskQuestion(question, dtcCode || undefined)];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    console.error('Error asking question:', error_1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    return (<div className="bg-gray-800 bg-opacity-50 rounded-lg p-4">
      <h3 className="text-2xl font-bold text-yellow-300 mb-3">Ask Technical Questions</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-white text-lg mb-1">DTC Code (Optional)</label>
          <input type="text" value={dtcCode} onChange={function (e) { return setDtcCode(e.target.value); }} placeholder="e.g. P0300" className="w-full p-2 bg-gray-700 text-white rounded-lg text-lg"/>
        </div>
        <div>
          <label className="block text-white text-lg mb-1">Technical Question</label>
          <textarea value={question} onChange={function (e) { return setQuestion(e.target.value); }} placeholder="Ask about specifications, procedures, TSBs, etc." className="w-full p-2 bg-gray-700 text-white rounded-lg text-lg min-h-[100px]" disabled={isLoading}/>
        </div>
        <button type="submit" disabled={isLoading || !question.trim()} className="w-full p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:bg-blue-800 disabled:opacity-50">
          {isLoading ? 'Getting Answer...' : 'Ask Question'}
        </button>
      </form>
      
      {answer && (<div className="mt-4 bg-blue-900 bg-opacity-70 p-4 rounded-lg">
          <h4 className="text-xl font-bold text-blue-300 mb-2">Answer:</h4>
          <div className="text-white text-lg whitespace-pre-wrap">{answer}</div>
        </div>)}
    </div>);
};
var VehicleResearch = function (_a) {
    var initialResults = _a.initialResults;
    var _b = useCustomer(), selectedCustomer = _b.selectedCustomer, selectedVehicle = _b.selectedVehicle;
    var _c = useResearch(), problem = _c.problem, setProblem = _c.setProblem, researchData = _c.researchData, setResearchData = _c.setResearchData, detailedData = _c.detailedData, isLoading = _c.isLoading, setIsLoading = _c.setIsLoading;
    // State management
    var _d = useState('diagnostic'), activeTab = _d[0], setActiveTab = _d[1];
    var _e = useState(false), detailModalOpen = _e[0], setDetailModalOpen = _e[1];
    var _f = useState(false), detailLoading = _f[0], setDetailLoading = _f[1];
    var _g = useState(null), selectedDetailKey = _g[0], setSelectedDetailKey = _g[1];
    var _h = useState(null), currentDetailData = _h[0], setCurrentDetailData = _h[1];
    var _j = useState([]), vehicleImages = _j[0], setVehicleImages = _j[1];
    var _k = useState([]), problemImages = _k[0], setProblemImages = _k[1];
    var _l = useState({}), diagnosticImages = _l[0], setDiagnosticImages = _l[1];
    var _m = useState(null), selectedDiagram = _m[0], setSelectedDiagram = _m[1];
    var _o = useState(false), isImageSearchModalOpen = _o[0], setIsImageSearchModalOpen = _o[1];
    var _p = useState(false), showLogViewer = _p[0], setShowLogViewer = _p[1];
    var _q = useState(false), imageModalOpen = _q[0], setImageModalOpen = _q[1];
    var _r = useState([]), modalImages = _r[0], setModalImages = _r[1];
    var _s = useState(null), selectedImage = _s[0], setSelectedImage = _s[1];
    var _t = useState([]), searchResults = _t[0], setSearchResults = _t[1];
    var _u = useState(null), partPricing = _u[0], setPartPricing = _u[1];
    var _v = useState([]), savedImages = _v[0], setSavedImages = _v[1];
    var _w = useState(''), customImageSearch = _w[0], setCustomImageSearch = _w[1];
    var _x = useState(false), showSavedImages = _x[0], setShowSavedImages = _x[1];
    var _y = useState(false), hasInitiatedResearch = _y[0], setHasInitiatedResearch = _y[1];
    var _z = useState(0), currentImageIndex = _z[0], setCurrentImageIndex = _z[1];
    var _0 = useState(''), imageExplanation = _0[0], setImageExplanation = _0[1];
    var _1 = useState(false), isLoadingExplanation = _1[0], setIsLoadingExplanation = _1[1];
    var _2 = useState(false), isLoadingFollowUp = _2[0], setIsLoadingFollowUp = _2[1];
    var _3 = useState(false), isLoadingSavedImages = _3[0], setIsLoadingSavedImages = _3[1];
    var _4 = useState(3.5), imageZoom = _4[0], setImageZoom = _4[1];
    var _5 = useState(null), uploadedImage = _5[0], setUploadedImage = _5[1];
    var _6 = useState(false), isUploadingImage = _6[0], setIsUploadingImage = _6[1];
    var _7 = useState(''), followUpQuestion = _7[0], setFollowUpQuestion = _7[1];
    var _8 = useState(''), followUpAnswer = _8[0], setFollowUpAnswer = _8[1];
    var _9 = useState(false), isAskingFollowUp = _9[0], setIsAskingFollowUp = _9[1];
    var _10 = useState(null), conversationId = _10[0], setConversationId = _10[1];
    var _11 = useState(null), technicalQuestionAnswer = _11[0], setTechnicalQuestionAnswer = _11[1];
    var _12 = useState(false), isLoadingTechnicalQuestion = _12[0], setIsLoadingTechnicalQuestion = _12[1];
    var _13 = useState({}), preloadedDetails = _13[0], setPreloadedDetails = _13[1];
    var _14 = useState(null), detailData = _14[0], setDetailData = _14[1];
    // Image handling functions
    var openImagesInModal = function (images) {
        setModalImages(images);
        setImageModalOpen(true);
    };
    var searchImages = function (query_1) {
        var args_1 = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args_1[_i - 1] = arguments[_i];
        }
        return __awaiter(void 0, __spreadArray([query_1], args_1, true), void 0, function (query, type) {
            var cleanedQuery, loadingToast, response, error_2, typedError, errorMessage;
            var _a, _b, _c, _d;
            if (type === void 0) { type = 'diagram'; }
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _e.trys.push([0, 2, , 3]);
                        if (!selectedVehicle) {
                            toast.error('Please select a vehicle first');
                            return [2 /*return*/, []];
                        }
                        cleanedQuery = query.trim();
                        loadingToast = toast.loading('Searching for images...');
                        return [4 /*yield*/, axiosInstance.post('/serper/images', {
                                query: cleanedQuery,
                                num: 30,
                                vehicleInfo: {
                                    year: selectedVehicle.year,
                                    make: selectedVehicle.make,
                                    model: selectedVehicle.model,
                                    engine: selectedVehicle.engine || undefined
                                }
                            })];
                    case 1:
                        response = _e.sent();
                        // Dismiss loading toast
                        toast.dismiss(loadingToast);
                        if (((_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.images) === null || _b === void 0 ? void 0 : _b.length) > 0) {
                            // Use the results directly from the backend
                            setSearchResults(response.data.images);
                            return [2 /*return*/, response.data.images];
                        }
                        else {
                            // Show helpful message when no results found
                            toast.error('No relevant images found. Try:\n' +
                                '• Being more specific (e.g. "timing belt diagram" instead of just "belt")\n' +
                                '• Including the component name (e.g. "water pump location")\n' +
                                '• Adding terms like "diagram", "schematic", or "layout"');
                            return [2 /*return*/, []];
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_2 = _e.sent();
                        typedError = error_2;
                        errorMessage = ((_d = (_c = typedError.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.message) || typedError.message || 'Failed to search for images';
                        toast.error(errorMessage);
                        return [2 /*return*/, []];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    var getImageExplanation = function (imageUrl, title) { return __awaiter(void 0, void 0, void 0, function () {
        var imageData, response, explanation, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, 3, 4]);
                    imageData = {
                        title: title,
                        imageUrl: imageUrl,
                        thumbnailUrl: (selectedDiagram === null || selectedDiagram === void 0 ? void 0 : selectedDiagram.thumbnail) || '',
                        source: '',
                        link: imageUrl,
                        originalUrl: imageUrl,
                        prompt: "You are an automotive expert. Please explain this automotive diagram or image in detail. Focus on identifying parts, explaining their function, and any technical details visible in the image."
                    };
                    console.log('Requesting image explanation...');
                    return [4 /*yield*/, axiosInstance.post('/openai/explain-image', imageData)];
                case 1:
                    response = _a.sent();
                    console.log('Received response:', response.data);
                    if (response.data) {
                        explanation = response.data.explanation || response.data.output_text;
                        console.log('Setting explanation:', explanation);
                        setImageExplanation(explanation || 'No explanation available.');
                        // Use the correct field names from the backend response
                        if (response.data.conversationId) {
                            setConversationId(response.data.conversationId);
                            console.log('Saved conversation ID:', response.data.conversationId);
                        }
                        else if (response.data.conversation_id) {
                            // Backend might send as conversation_id (OpenAI's format)
                            setConversationId(response.data.conversation_id);
                            console.log('Saved conversation_id as conversation ID:', response.data.conversation_id);
                        }
                        else if (response.data.responseId) {
                            // Use responseId as a fallback
                            setConversationId(response.data.responseId);
                            console.log('Saved responseId as conversation ID:', response.data.responseId);
                        }
                        else {
                            console.warn('No conversation ID found in response:', response.data);
                        }
                    }
                    else {
                        console.log('No explanation in response');
                        setImageExplanation('No explanation available.');
                    }
                    return [3 /*break*/, 4];
                case 2:
                    error_3 = _a.sent();
                    console.error('Error getting image explanation:', error_3);
                    toast.error('Failed to get image explanation');
                    setImageExplanation('Failed to get explanation. Please try again.');
                    return [3 /*break*/, 4];
                case 3:
                    setIsLoadingExplanation(false);
                    // Clear the pending flag
                    setSelectedDiagram(function (prev) { return prev ? __assign(__assign({}, prev), { pendingExplanation: false }) : null; });
                    return [7 /*endfinally*/];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handleImageLoad = function () {
        if (selectedDiagram === null || selectedDiagram === void 0 ? void 0 : selectedDiagram.pendingExplanation) {
            setIsLoadingExplanation(true);
            generateImageExplanation();
        }
    };
    var handleImageClick = function (image) { return __awaiter(void 0, void 0, void 0, function () {
        var imageUrl, explanationData;
        return __generator(this, function (_a) {
            try {
                imageUrl = 'originalUrl' in image ? image.originalUrl : image.imageUrl;
                if (!imageUrl) {
                    toast.error('No valid image URL found');
                    return [2 /*return*/];
                }
                // Check if image has conversationId (for saved images)
                if ('conversationId' in image && image.conversationId) {
                    console.log('Using conversation ID from saved image:', image.conversationId);
                    setConversationId(image.conversationId);
                }
                else {
                    // Reset conversation ID for new images
                    setConversationId(null);
                }
                console.log('Setting diagram data...');
                setSelectedDiagram({
                    url: imageUrl,
                    title: image.title,
                    thumbnail: image.thumbnailUrl,
                    sourceUrl: image.link,
                    fileType: 'image',
                    link: image.link,
                    pendingExplanation: true
                });
                if ('_id' in image && 'explanation' in image && image.explanation) {
                    console.log('Using saved explanation');
                    explanationData = typeof image.explanation === 'string'
                        ? image.explanation
                        : image.explanation.explanation || 'No explanation available.';
                    setImageExplanation(explanationData);
                    setSelectedDiagram(function (prev) { return prev ? __assign(__assign({}, prev), { pendingExplanation: false }) : null; });
                    return [2 /*return*/];
                }
            }
            catch (error) {
                console.error('Error handling image click:', error);
                toast.error('Failed to open image');
            }
            return [2 /*return*/];
        });
    }); };
    var handleSaveImage = function (image) { return __awaiter(void 0, void 0, void 0, function () {
        var conversationId_1, imageData, response, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    conversationId_1 = selectedDiagram === null || selectedDiagram === void 0 ? void 0 : selectedDiagram.conversationId;
                    console.log('Saving image with conversation ID:', conversationId_1 || 'none');
                    imageData = {
                        title: image.title,
                        imageUrl: image.imageUrl,
                        thumbnailUrl: image.thumbnailUrl,
                        source: image.source,
                        link: image.link,
                        originalUrl: image.imageUrl,
                        prompt: "Please explain this automotive diagram or image in detail. Focus on identifying parts, explaining their function, and any technical details visible in the image.",
                        conversationId: conversationId_1
                    };
                    return [4 /*yield*/, axiosInstance.post('/response-images', imageData)];
                case 1:
                    response = _a.sent();
                    toast.success('Image saved successfully');
                    return [2 /*return*/, response.data];
                case 2:
                    error_4 = _a.sent();
                    console.error('Image save error:', error_4);
                    toast.error('Failed to save image');
                    throw error_4;
                case 3: return [2 /*return*/];
            }
        });
    }); };
    // Effects
    useEffect(function () {
        if (initialResults && !researchData) {
            var formattedResults = __assign(__assign({}, initialResults), { recommendedFixes: (initialResults.recommendedFixes || []).map(function (fix) {
                    var _a;
                    return ({
                        fix: fix.fix,
                        difficulty: fix.difficulty,
                        estimatedCost: fix.estimatedCost,
                        professionalOnly: Boolean(fix.professionalOnly),
                        parts: ((_a = fix.parts) === null || _a === void 0 ? void 0 : _a.map(function (part) { return ({
                            name: typeof part === 'string' ? part : part.name,
                            partNumber: typeof part === 'string' ? '' : part.partNumber,
                            estimatedPrice: typeof part === 'string' ? '' : part.estimatedPrice,
                            notes: typeof part === 'string' ? '' : part.notes
                        }); })) || [],
                        laborTime: fix.laborTime || '',
                        specialTools: fix.specialTools || []
                    });
                }) });
            setResearchData(formattedResults);
        }
    }, [initialResults, researchData]);
    // Function to preload all details
    var preloadAllDetails = function () { return __awaiter(void 0, void 0, void 0, function () {
        var preloadPromises_1, error_5;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    if (!researchData || isLoading)
                        return [2 /*return*/];
                    setIsLoading(true);
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 3, 4, 5]);
                    preloadPromises_1 = [];
                    (_a = researchData.diagnosticSteps) === null || _a === void 0 ? void 0 : _a.forEach(function (step, index) {
                        preloadPromises_1.push(loadDetail('diagnostic', step, index));
                    });
                    (_b = researchData.possibleCauses) === null || _b === void 0 ? void 0 : _b.forEach(function (cause, index) {
                        preloadPromises_1.push(loadDetail('causes', cause, index));
                    });
                    (_c = researchData.recommendedFixes) === null || _c === void 0 ? void 0 : _c.forEach(function (fix, index) {
                        preloadPromises_1.push(loadDetail('fixes', fix, index));
                    });
                    return [4 /*yield*/, Promise.all(preloadPromises_1)];
                case 2:
                    _d.sent();
                    toast.success('All detailed information has been preloaded');
                    return [3 /*break*/, 5];
                case 3:
                    error_5 = _d.sent();
                    console.error('Error preloading all details:', error_5);
                    toast.error('Failed to preload all details');
                    return [3 /*break*/, 5];
                case 4:
                    setIsLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    // Function to load a single detail
    var loadDetail = function (category, item, index) { return __awaiter(void 0, void 0, void 0, function () {
        var preloadKey, response, parsed_1, error_6;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    preloadKey = "".concat(category, "-").concat(index);
                    if (preloadedDetails[preloadKey])
                        return [2 /*return*/];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, axiosInstance.post('/research/detail', {
                            vin: selectedVehicle.vin,
                            year: selectedVehicle.year,
                            make: selectedVehicle.make,
                            model: selectedVehicle.model,
                            category: category,
                            item: item,
                            originalProblem: problem
                        }, {
                            timeout: 30000 // Reduce timeout to 30 seconds
                        })];
                case 2:
                    response = _b.sent();
                    if ((_a = response.data) === null || _a === void 0 ? void 0 : _a.result) {
                        parsed_1 = typeof response.data.result === 'string'
                            ? JSON.parse(response.data.result)
                            : response.data.result;
                        setPreloadedDetails(function (prev) {
                            var _a;
                            return (__assign(__assign({}, prev), (_a = {}, _a[preloadKey] = parsed_1, _a)));
                        });
                    }
                    return [3 /*break*/, 4];
                case 3:
                    error_6 = _b.sent();
                    console.warn("Failed to preload detail for ".concat(category, " ").concat(index, ":"), error_6);
                    throw error_6;
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handleItemClick = function (category, item, index) { return __awaiter(void 0, void 0, void 0, function () {
        var preloadKey, response, parsed_2, error_7;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    preloadKey = "".concat(category, "-").concat(index);
                    // Open modal first
                    setDetailModalOpen(true);
                    // Check if we already have the data
                    if (preloadedDetails[preloadKey]) {
                        setDetailData(preloadedDetails[preloadKey]);
                        setDetailLoading(false);
                        return [2 /*return*/];
                    }
                    // If not preloaded, load it
                    setDetailLoading(true);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, axiosInstance.post('/research/detail', {
                            vin: selectedVehicle === null || selectedVehicle === void 0 ? void 0 : selectedVehicle.vin,
                            year: selectedVehicle === null || selectedVehicle === void 0 ? void 0 : selectedVehicle.year,
                            make: selectedVehicle === null || selectedVehicle === void 0 ? void 0 : selectedVehicle.make,
                            model: selectedVehicle === null || selectedVehicle === void 0 ? void 0 : selectedVehicle.model,
                            category: category,
                            item: item,
                            originalProblem: problem
                        })];
                case 2:
                    response = _b.sent();
                    if ((_a = response.data) === null || _a === void 0 ? void 0 : _a.result) {
                        parsed_2 = typeof response.data.result === 'string'
                            ? JSON.parse(response.data.result)
                            : response.data.result;
                        setDetailData(parsed_2);
                        // Update preloaded details without triggering a re-render cascade
                        setPreloadedDetails(function (prev) {
                            var _a;
                            return (__assign(__assign({}, prev), (_a = {}, _a[preloadKey] = parsed_2, _a)));
                        });
                    }
                    else {
                        toast.error('No detailed information available.');
                    }
                    return [3 /*break*/, 5];
                case 3:
                    error_7 = _b.sent();
                    console.error('Detail research error:', error_7);
                    toast.error('Error fetching detailed information. Please try again.');
                    return [3 /*break*/, 5];
                case 4:
                    setDetailLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    // Preload detail info
    useEffect(function () {
        if (researchData && !isLoading) {
            var preloadDetails = function () { return __awaiter(void 0, void 0, void 0, function () {
                var categories, preloadPromises, preloadedResults, newPreloadedDetails, error_8;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            categories = {
                                diagnostic: researchData.diagnosticSteps[0],
                                causes: researchData.possibleCauses[0],
                                fixes: researchData.recommendedFixes[0],
                            };
                            preloadPromises = Object.entries(categories).map(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
                                var response, error_9;
                                var _c;
                                var category = _b[0], item = _b[1];
                                return __generator(this, function (_d) {
                                    switch (_d.label) {
                                        case 0:
                                            if (!item)
                                                return [2 /*return*/, null];
                                            _d.label = 1;
                                        case 1:
                                            _d.trys.push([1, 3, , 4]);
                                            return [4 /*yield*/, axiosInstance.post('/researchl/detail', {
                                                    vin: selectedVehicle.vin,
                                                    year: selectedVehicle.year,
                                                    make: selectedVehicle.make,
                                                    model: selectedVehicle.model,
                                                    category: category,
                                                    item: item,
                                                    originalProblem: problem
                                                })];
                                        case 2:
                                            response = _d.sent();
                                            if ((_c = response.data) === null || _c === void 0 ? void 0 : _c.result) {
                                                return [2 /*return*/, { category: category, data: response.data.result }];
                                            }
                                            return [3 /*break*/, 4];
                                        case 3:
                                            error_9 = _d.sent();
                                            console.warn("Preload failed for ".concat(category, ":"), error_9);
                                            return [2 /*return*/, null];
                                        case 4: return [2 /*return*/];
                                    }
                                });
                            }); });
                            return [4 /*yield*/, Promise.all(preloadPromises)];
                        case 1:
                            preloadedResults = _a.sent();
                            newPreloadedDetails = preloadedResults.reduce(function (acc, result) {
                                if (result) {
                                    acc["".concat(result.category, "-0")] = result.data;
                                }
                                return acc;
                            }, {});
                            Object.entries(newPreloadedDetails).forEach(function (_a) {
                                var key = _a[0], value = _a[1];
                                loadDetail(key, value, 0);
                            });
                            return [3 /*break*/, 3];
                        case 2:
                            error_8 = _a.sent();
                            console.warn('Preload details error:', error_8);
                            return [3 /*break*/, 3];
                        case 3: return [2 /*return*/];
                    }
                });
            }); };
            preloadDetails();
        }
    }, [researchData, isLoading, selectedVehicle, problem]);
    // Rendering for diagnostic steps
    var renderDiagnosticSteps = function () {
        var _a;
        return (_a = researchData === null || researchData === void 0 ? void 0 : researchData.diagnosticSteps) === null || _a === void 0 ? void 0 : _a.map(function (step, index) { return (<div key={index} className="mb-4 p-4 text-2xl bg-gray-800 bg-opacity-80 rounded-lg border-l-4 border-blue-500 cursor-pointer hover:bg-gray-700 transition-colors" onClick={function () { return handleItemClick('diagnostic', step, index); }}>
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold text-blue-400">Step {index + 1}</h4>
          {detailedData["diagnostic-".concat(index)] && (<span className="text-xl text-green-400">(Detailed info available)</span>)}
        </div>
        <p className="text-white mt-2">{step.step}</p>
        <p className="text-gray-300 mt-1">{step.details}</p>
        
        {/* Only render componentLocation if it exists */}
        {step.componentLocation && (<div className="mt-2">
            <span className="text-blue-400">Component Location:</span>
            <p className="text-gray-300 ml-4">{step.componentLocation}</p>
          </div>)}
        
        {/* Only render connectorInfo if it exists */}
        {step.connectorInfo && (<div className="mt-2">
            <span className="text-blue-400">Connector Info:</span>
            <p className="text-gray-300 ml-4">{step.connectorInfo}</p>
          </div>)}
        
        {step.tools && (<div className="mt-2">
            <span className="text-blue-400">Required Tools:</span>
            <ul className="list-disc list-inside text-gray-300 ml-4">
              {step.tools.map(function (tool, i) { return (<li key={i}>{tool}</li>); })}
            </ul>
          </div>)}
        
        {/* Only render normalValueRanges if it exists */}
        {step.normalValueRanges && (<div className="mt-2">
            <span className="text-blue-400">Normal Value Ranges:</span>
            <p className="text-gray-300 ml-4">{step.normalValueRanges}</p>
          </div>)}
        
        {/* Only render factoryServiceManualRef if it exists */}
        {step.factoryServiceManualRef && (<div className="mt-2">
            <span className="text-blue-400">Service Manual Reference:</span>
            <p className="text-gray-300 ml-4">{step.factoryServiceManualRef}</p>
          </div>)}
      </div>); });
    };
    var renderPossibleCauses = function () {
        var _a;
        return (_a = researchData === null || researchData === void 0 ? void 0 : researchData.possibleCauses) === null || _a === void 0 ? void 0 : _a.map(function (cause, index) { return (<div key={index} className="mb-4 p-4 text-2xl bg-gray-800 bg-opacity-80 rounded-lg border-l-4 border-yellow-500 cursor-pointer hover:bg-gray-700 transition-colors" onClick={function () { return handleItemClick('causes', cause, index); }}>
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold text-yellow-400">{cause.cause}</h4>
          <div className="flex items-center gap-2">
            {detailedData["causes-".concat(index)] && (<span className="text-xl text-green-400">(Detailed info available)</span>)}
            <span className={"px-2 py-1 rounded text-sm ".concat(cause.likelihood === 'High' ? 'bg-red-500' :
                cause.likelihood === 'Medium' ? 'bg-yellow-500' :
                    'bg-green-500')}>
              {cause.likelihood}
            </span>
          </div>
        </div>
        <p className="text-gray-300 mt-2">{cause.explanation}</p>
        
        {/* Display model-specific notes if available using type assertion */}
        {cause.modelSpecificNotes && (<div className="mt-2">
            <span className="text-blue-400">Model-Specific Notes:</span>
            <p className="text-gray-300 ml-4">{cause.modelSpecificNotes}</p>
          </div>)}
        
        {/* Display common symptoms using the correct property or fall back to type assertion */}
        {(cause.commonSymptoms || cause.commonSymptomsForThisCause) && (<div className="mt-2">
            <span className="text-blue-400">Common Symptoms:</span>
            <ul className="list-disc list-inside text-gray-300 ml-4">
              {(cause.commonSymptoms || cause.commonSymptomsForThisCause || []).map(function (symptom, i) { return (<li key={i}>{symptom}</li>); })}
            </ul>
          </div>)}
      </div>); });
    };
    var renderRecommendedFixes = function () {
        var _a;
        return (_a = researchData === null || researchData === void 0 ? void 0 : researchData.recommendedFixes) === null || _a === void 0 ? void 0 : _a.map(function (fix, index) { return (<div key={index} className="mb-4 p-4 text-2xl bg-gray-800 bg-opacity-80 rounded-lg border-l-4 border-green-500 cursor-pointer hover:bg-gray-700 transition-colors" onClick={function () { return handleItemClick('fixes', fix, index); }}>
        <div className="flex items-center justify-between">
          <h4 className="text-2xl font-semibold text-green-400">{fix.fix}</h4>
          <div className="flex items-center gap-2">
            {detailedData["fixes-".concat(index)] && (<span className="text-xl text-green-400">(Detailed info available)</span>)}
            <span className={"px-2 py-1 rounded text-sm ".concat(fix.difficulty === 'Complex' ? 'bg-red-500' :
                fix.difficulty === 'Moderate' ? 'bg-yellow-500' :
                    'bg-green-500')}>
              {fix.difficulty}
            </span>
          </div>
        </div>
        <div className="mt-2">
          <span className="text-blue-400">Estimated Cost:</span>
          <span className="text-gray-300 ml-2">{fix.estimatedCost}</span>
        </div>
        
        {/* Display labor hours/time properly */}
        {(fix.laborTime || fix.laborHours) && (<div className="mt-2">
            <span className="text-blue-400">Labor Hours:</span>
            <span className="text-gray-300 ml-2">{fix.laborTime || fix.laborHours}</span>
          </div>)}
        
        {/* Display parts properly with correct type handling */}
        {fix.parts && fix.parts.length > 0 && (<div className="mt-2">
            <span className="text-blue-400">Required Parts:</span>
            <ul className="list-disc list-inside text-gray-300 ml-4">
              {fix.parts.map(function (part, i) { return (<li key={i}>{typeof part === 'string' ? part : part.name}</li>); })}
            </ul>
          </div>)}
        
        {/* Display OEM part numbers if available */}
        {fix.oemPartNumbers && (<div className="mt-2">
            <span className="text-blue-400">OEM Part Numbers:</span>
            <ul className="list-disc list-inside text-gray-300 ml-4">
              {fix.oemPartNumbers.map(function (partNumber, i) { return (<li key={i}>{partNumber}</li>); })}
            </ul>
          </div>)}
        
        {/* Display torque specs if available */}
        {fix.torqueSpecs && (<div className="mt-2">
            <span className="text-blue-400">Torque Specifications:</span>
            <p className="text-gray-300 ml-4">{fix.torqueSpecs}</p>
          </div>)}
        
        {/* Display special tools if available */}
        {fix.specialTools && fix.specialTools.length > 0 && (<div className="mt-2">
            <span className="text-blue-400">Special Tools:</span>
            <ul className="list-disc list-inside text-gray-300 ml-4">
              {fix.specialTools.map(function (tool, i) { return (<li key={i}>{tool}</li>); })}
            </ul>
          </div>)}
        
        {/* Display procedure overview if available */}
        {fix.procedureOverview && (<div className="mt-2">
            <span className="text-blue-400">Procedure Overview:</span>
            <p className="text-gray-300 ml-4">{fix.procedureOverview}</p>
          </div>)}
      </div>); });
    };
    var renderTechnicalNotes = function () {
        var _a, _b, _c, _d, _e, _f;
        return (<div className="space-y-6 text-2xl">
        {((_a = researchData === null || researchData === void 0 ? void 0 : researchData.technicalNotes) === null || _a === void 0 ? void 0 : _a.commonIssues) && (<div className="mb-4 p-4 text-2xl bg-gray-800 bg-opacity-80 rounded-lg border-l-4 border-purple-500 cursor-pointer hover:bg-gray-700 transition-colors" onClick={function () { return handleItemClick('technical', { section: 'commonIssues', data: researchData.technicalNotes.commonIssues }, 0); }}>
            <h4 className="text-2xl font-semibold text-purple-400 mb-3">Common Issues</h4>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              {researchData.technicalNotes.commonIssues.map(function (issue, index) { return (<li key={index} className="text-2xl">{issue}</li>); })}
            </ul>
          </div>)}

        {/* Display manufacturer-specific notes if available */}
        {((_b = researchData === null || researchData === void 0 ? void 0 : researchData.technicalNotes) === null || _b === void 0 ? void 0 : _b.manufacturerSpecificNotes) && (<div className="mb-4 p-4 text-2xl bg-gray-800 bg-opacity-80 rounded-lg border-l-4 border-purple-500 cursor-pointer hover:bg-gray-700 transition-colors" onClick={function () { return handleItemClick('technical', { section: 'manufacturerSpecificNotes', data: researchData.technicalNotes.manufacturerSpecificNotes }, 0); }}>
            <h4 className="text-2xl font-semibold text-purple-400 mb-3">Manufacturer-Specific Information</h4>
            <p className="text-gray-300">{researchData.technicalNotes.manufacturerSpecificNotes}</p>
          </div>)}

        {/* Display known good values if available */}
        {((_c = researchData === null || researchData === void 0 ? void 0 : researchData.technicalNotes) === null || _c === void 0 ? void 0 : _c.knownGoodValues) && (<div className="mb-4 p-4 text-2xl bg-gray-800 bg-opacity-80 rounded-lg border-l-4 border-purple-500 cursor-pointer hover:bg-gray-700 transition-colors" onClick={function () { return handleItemClick('technical', { section: 'knownGoodValues', data: researchData.technicalNotes.knownGoodValues }, 0); }}>
            <h4 className="text-2xl font-semibold text-purple-400 mb-3">Known Good Values</h4>
            <p className="text-gray-300">{researchData.technicalNotes.knownGoodValues}</p>
          </div>)}

        {((_d = researchData === null || researchData === void 0 ? void 0 : researchData.technicalNotes) === null || _d === void 0 ? void 0 : _d.serviceIntervals) && (<div className="mb-4 p-4 text-2xl bg-gray-800 bg-opacity-80 rounded-lg border-l-4 border-purple-500 cursor-pointer hover:bg-gray-700 transition-colors" onClick={function () { return handleItemClick('technical', { section: 'serviceIntervals', data: researchData.technicalNotes.serviceIntervals }, 0); }}>
            <h4 className="text-2xl font-semibold text-purple-400 mb-3">Service Intervals</h4>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              {researchData.technicalNotes.serviceIntervals.map(function (interval, index) { return (<li key={index} className="text-2xl">{interval}</li>); })}
            </ul>
          </div>)}

        {((_e = researchData === null || researchData === void 0 ? void 0 : researchData.technicalNotes) === null || _e === void 0 ? void 0 : _e.recalls) && (<div className="mb-4 p-4 text-2xl bg-gray-800 bg-opacity-80 rounded-lg border-l-4 border-purple-500 cursor-pointer hover:bg-gray-700 transition-colors" onClick={function () { return handleItemClick('technical', { section: 'recalls', data: researchData.technicalNotes.recalls }, 0); }}>
            <h4 className="text-2xl font-semibold text-purple-400 mb-3">Recalls</h4>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              {researchData.technicalNotes.recalls.map(function (recall, index) { return (<li key={index} className="text-2xl">{recall}</li>); })}
            </ul>
          </div>)}

        {((_f = researchData === null || researchData === void 0 ? void 0 : researchData.technicalNotes) === null || _f === void 0 ? void 0 : _f.tsbs) && (<div className="mb-4 p-4 text-2xl bg-gray-800 bg-opacity-80 rounded-lg border-l-4 border-purple-500 cursor-pointer hover:bg-gray-700 transition-colors" onClick={function () { return handleItemClick('technical', { section: 'tsbs', data: researchData.technicalNotes.tsbs }, 0); }}>
            <h4 className="text-2xl font-semibold text-purple-400 mb-3">
              Technical Service Bulletins
            </h4>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              {researchData.technicalNotes.tsbs.map(function (tsb, index) { return (<li key={index} className="text-2xl">{tsb}</li>); })}
            </ul>
          </div>)}
      </div>);
    };
    var renderReferences = function () {
        var _a;
        return (<div className="space-y-4">
        {(_a = researchData === null || researchData === void 0 ? void 0 : researchData.references) === null || _a === void 0 ? void 0 : _a.map(function (reference, index) { return (<div key={index} className="mb-4 p-4 text-2xl bg-gray-800 bg-opacity-80 rounded-lg border-l-4 border-blue-500 cursor-pointer hover:bg-gray-700 transition-colors">
            <h4 className="text-2xl font-semibold text-purple-400">{reference.source || 'Unknown Source'}</h4>
            <div className="mt-1 text-2xl text-gray-300">{reference.type || 'Unknown Type'}</div>
            
            {reference.documentNumber && (<div className="mt-1 text-2xl">
                <span className="text-blue-400 text-2xl">Document #:</span>
                <span className="text-gray-300 ml-2 text-2xl">{reference.documentNumber}</span>
              </div>)}
            
            <div className="mt-1 text-2xl">
              <span className="text-blue-400 text-2xl">Relevance:</span>
              <span className="text-gray-300 ml-2 text-2xl">{reference.relevance || 'Not specified'}</span>
            </div>
            
            {reference.url && (<a href={reference.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-blue-400 hover:text-blue-300 text-2xl">
                Visit Source →
              </a>)}
          </div>); })}
      </div>);
    };
    // Add function to fetch saved images
    var fetchSavedImages = function () { return __awaiter(void 0, void 0, void 0, function () {
        var response, error_10;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, axiosInstance.get('/response-images')];
                case 1:
                    response = _a.sent();
                    setSavedImages(response.data);
                    return [3 /*break*/, 3];
                case 2:
                    error_10 = _a.sent();
                    console.error('Error fetching saved images:', error_10);
                    toast.error('Failed to load saved images');
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    // Add useEffect to load saved images on component mount
    useEffect(function () {
        fetchSavedImages();
    }, []);
    // Update handleCustomImageSearch
    var handleCustomImageSearch = function (e) { return __awaiter(void 0, void 0, void 0, function () {
        var results, error_11;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    e.preventDefault();
                    if (!customImageSearch.trim() || !selectedVehicle)
                        return [2 /*return*/];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, searchImages(customImageSearch)];
                case 2:
                    results = _a.sent();
                    if (results.length > 0) {
                        setIsImageSearchModalOpen(true);
                        setCurrentImageIndex(0);
                        toast.success("Found ".concat(results.length, " images"));
                    }
                    setCustomImageSearch('');
                    return [3 /*break*/, 4];
                case 3:
                    error_11 = _a.sent();
                    console.error('Custom image search error:', error_11);
                    toast.error('Search failed. Please try again.');
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    // Add delete function for saved images
    var handleDeleteImage = function (imageId) { return __awaiter(void 0, void 0, void 0, function () {
        var error_12;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, axiosInstance.delete("/response-images/".concat(imageId))];
                case 1:
                    _a.sent();
                    toast.success('Image deleted successfully');
                    // Refresh the saved images list
                    fetchSavedImages();
                    return [3 /*break*/, 3];
                case 2:
                    error_12 = _a.sent();
                    console.error('Error deleting image:', error_12);
                    toast.error('Failed to delete image');
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    // Add useEffect to fetch saved images when modal opens
    useEffect(function () {
        if (isImageSearchModalOpen) {
            fetchSavedImages();
        }
    }, [isImageSearchModalOpen]);
    var handleModalImageClick = function (image) {
        console.log('Image clicked from modal, conversation ID:', image.conversationId || 'none');
        handleImageClick(__assign(__assign({}, image), { 
            // Explicitly extract conversationId from the saved image
            conversationId: image.conversationId }));
    };
    // Function to handle zoom changes
    var handleZoomIn = function () {
        setImageZoom(function (prev) { return Math.min(prev + 0.5, 6); });
    };
    var handleZoomOut = function () {
        setImageZoom(function (prev) { return Math.max(prev - 0.5, 1); });
    };
    var generateImageExplanation = function () { return __awaiter(void 0, void 0, void 0, function () {
        var error_13;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    if (!(selectedDiagram && selectedDiagram.url)) return [3 /*break*/, 2];
                    console.log('Generating explanation for image with conversation ID:', conversationId || 'none');
                    return [4 /*yield*/, getImageExplanation(selectedDiagram.url, selectedDiagram.title || 'Vehicle Diagram')];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2: return [3 /*break*/, 4];
                case 3:
                    error_13 = _a.sent();
                    console.error('Error generating image explanation:', error_13);
                    setIsLoadingExplanation(false);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    // Function to handle uploaded image
    var handleImageUpload = function (file) { return __awaiter(void 0, void 0, void 0, function () {
        var reader_1, base64Promise, base64Image, uniqueId, timestamp, fileName, resizedImage, imageMetadata, imageData, response, explanation, updatedMetadata, saveResponse, saveError_1, error_14;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 10, 11, 12]);
                    setIsUploadingImage(true);
                    toast.loading('Processing your image...');
                    reader_1 = new FileReader();
                    base64Promise = new Promise(function (resolve, reject) {
                        reader_1.onload = function () { return resolve(reader_1.result); };
                        reader_1.onerror = function (error) { return reject(error); };
                    });
                    reader_1.readAsDataURL(file);
                    return [4 /*yield*/, base64Promise];
                case 1:
                    base64Image = _a.sent();
                    uniqueId = "upload-".concat(Date.now(), "-").concat(Math.random().toString(36).substr(2, 9));
                    timestamp = new Date().toISOString();
                    fileName = file.name || 'Uploaded Image';
                    return [4 /*yield*/, resizeImageIfNeeded(base64Image, 1200)];
                case 2:
                    resizedImage = _a.sent();
                    imageMetadata = {
                        title: fileName,
                        imageUrl: resizedImage,
                        thumbnailUrl: resizedImage,
                        source: 'User Upload',
                        link: '',
                        _id: uniqueId,
                        timestamp: timestamp,
                        originalUrl: resizedImage,
                        contentType: file.type,
                        relevanceScore: 10 // Higher relevance for user uploads
                    };
                    // Set diagram data with uploaded image
                    setSelectedDiagram({
                        url: resizedImage,
                        title: fileName,
                        thumbnail: resizedImage,
                        sourceUrl: '',
                        fileType: file.type,
                        link: '',
                        pendingExplanation: true
                    });
                    imageData = __assign(__assign({}, imageMetadata), { prompt: "You are an automotive expert. Please explain this automotive diagram or image in detail. Focus on identifying parts, explaining their function, and any technical details visible in the image. Include how to locate the components and test the components." });
                    return [4 /*yield*/, axiosInstance.post('/openai/explain-image', imageData)];
                case 3:
                    response = _a.sent();
                    if (!response.data) return [3 /*break*/, 8];
                    explanation = response.data.explanation || response.data.output_text || 'No explanation available.';
                    updatedMetadata = __assign(__assign({}, imageMetadata), { explanation: explanation });
                    // Update the explanation state
                    setImageExplanation(explanation);
                    // Store conversation ID if available, or use responseId as fallback
                    if (response.data.conversationId) {
                        console.log('Storing conversation ID from upload:', response.data.conversationId);
                        setConversationId(response.data.conversationId);
                        // Also include conversation ID in the saved metadata
                        updatedMetadata.conversationId = response.data.conversationId;
                    }
                    else if (response.data.conversation_id) {
                        console.log('Found conversation_id in response:', response.data.conversation_id);
                        setConversationId(response.data.conversation_id);
                        // Include the conversation_id in the saved metadata
                        updatedMetadata.conversationId = response.data.conversation_id;
                    }
                    else if (response.data.responseId) {
                        // Use responseId as a fallback
                        setConversationId(response.data.responseId);
                        console.log('No conversationId in response, using responseId instead:', response.data.responseId);
                        // Include the responseId as conversationId in the saved metadata
                        updatedMetadata.conversationId = response.data.responseId;
                    }
                    else {
                        console.warn('No conversationId or responseId found in response:', response.data);
                    }
                    _a.label = 4;
                case 4:
                    _a.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, axiosInstance.post('/response-images', updatedMetadata)];
                case 5:
                    saveResponse = _a.sent();
                    // Add to saved images if save was successful
                    if (saveResponse.data) {
                        fetchSavedImages(); // Refresh saved images list
                    }
                    return [3 /*break*/, 7];
                case 6:
                    saveError_1 = _a.sent();
                    console.error('Error saving uploaded image:', saveError_1);
                    return [3 /*break*/, 7];
                case 7:
                    toast.dismiss();
                    toast.success('Image processed successfully');
                    return [3 /*break*/, 9];
                case 8:
                    toast.dismiss();
                    toast.error('Failed to process image');
                    _a.label = 9;
                case 9: return [3 /*break*/, 12];
                case 10:
                    error_14 = _a.sent();
                    console.error('Error uploading and processing image:', error_14);
                    toast.dismiss();
                    toast.error('Failed to process image');
                    return [3 /*break*/, 12];
                case 11:
                    setIsUploadingImage(false);
                    return [7 /*endfinally*/];
                case 12: return [2 /*return*/];
            }
        });
    }); };
    // Helper function to resize image if needed
    var resizeImageIfNeeded = function (dataUrl, maxWidth) {
        return new Promise(function (resolve) {
            var img = new Image();
            img.onload = function () {
                // Only resize if image is larger than maxWidth
                if (img.width <= maxWidth) {
                    resolve(dataUrl);
                    return;
                }
                // Calculate new dimensions while maintaining aspect ratio
                var ratio = maxWidth / img.width;
                var newWidth = maxWidth;
                var newHeight = img.height * ratio;
                // Create canvas and resize
                var canvas = document.createElement('canvas');
                canvas.width = newWidth;
                canvas.height = newHeight;
                var ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, newWidth, newHeight);
                    // Get the resized image as dataURL
                    var resizedDataUrl = canvas.toDataURL(
                    // Try to keep original format if possible
                    dataUrl.startsWith('data:image/png') ? 'image/png' :
                        dataUrl.startsWith('data:image/gif') ? 'image/gif' :
                            'image/jpeg', 0.9 // Quality for jpg
                    );
                    resolve(resizedDataUrl);
                }
                else {
                    // If can't get context, return original
                    resolve(dataUrl);
                }
            };
            img.onerror = function () {
                // If error, return original
                resolve(dataUrl);
            };
            img.src = dataUrl;
        });
    };
    // Handle follow-up questions to images
    var handleFollowUpQuestion = function (imageUrl, question) { return __awaiter(void 0, void 0, void 0, function () {
        var isTechnicalQuestion, answer, error_15, followUpData, response, answer_1, error_16;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!question.trim()) {
                        toast.error('Please enter a question');
                        return [2 /*return*/];
                    }
                    isTechnicalQuestion = question.toLowerCase().includes('specification') ||
                        question.toLowerCase().includes('spec') ||
                        question.toLowerCase().includes('torque') ||
                        question.toLowerCase().includes('tsb') ||
                        question.toLowerCase().includes('bulletin') ||
                        question.toLowerCase().includes('part number') ||
                        question.toLowerCase().includes('procedure');
                    if (!(isTechnicalQuestion && selectedVehicle)) return [3 /*break*/, 6];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    setIsAskingFollowUp(true);
                    setIsLoadingFollowUp(true);
                    return [4 /*yield*/, askVehicleQuestion(question)];
                case 2:
                    answer = _a.sent();
                    setFollowUpAnswer(answer);
                    // Don't append to image explanation for technical questions
                    toast.success('Technical information retrieved');
                    return [3 /*break*/, 5];
                case 3:
                    error_15 = _a.sent();
                    console.error('Error with technical question:', error_15);
                    setFollowUpAnswer('Error processing your technical question. Please try again.');
                    toast.error('Technical question failed');
                    return [3 /*break*/, 5];
                case 4:
                    setIsAskingFollowUp(false);
                    setIsLoadingFollowUp(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
                case 6:
                    // Handle image-related follow-up as before
                    if (!conversationId) {
                        toast.error('No conversation context available. Please try refreshing the explanation.');
                        return [2 /*return*/];
                    }
                    _a.label = 7;
                case 7:
                    _a.trys.push([7, 9, 10, 11]);
                    setIsAskingFollowUp(true);
                    setIsLoadingFollowUp(true);
                    toast.loading('Getting answer...');
                    followUpData = {
                        imageUrl: imageUrl,
                        question: question,
                        conversationId: conversationId,
                        context: {
                            vehicleYear: selectedVehicle === null || selectedVehicle === void 0 ? void 0 : selectedVehicle.year,
                            vehicleMake: selectedVehicle === null || selectedVehicle === void 0 ? void 0 : selectedVehicle.make,
                            vehicleModel: selectedVehicle === null || selectedVehicle === void 0 ? void 0 : selectedVehicle.model,
                            vehicleEngine: selectedVehicle === null || selectedVehicle === void 0 ? void 0 : selectedVehicle.engine
                        }
                    };
                    console.log('Sending follow-up with conversation ID:', conversationId);
                    return [4 /*yield*/, axiosInstance.post('/openai/explain-image/follow-up', followUpData)];
                case 8:
                    response = _a.sent();
                    toast.dismiss();
                    if (response.data && (response.data.answer || response.data.output_text)) {
                        answer_1 = response.data.answer || response.data.output_text;
                        setFollowUpAnswer(answer_1);
                        // Append to the existing explanation for conversation history
                        setImageExplanation(function (prev) {
                            var separator = prev ? '\n\nQ: ' + question + '\n\nA: ' : '';
                            return prev + separator + answer_1;
                        });
                        // Update conversation ID if it changed
                        if (response.data.conversationId) {
                            setConversationId(response.data.conversationId);
                            console.log('Updated conversation ID:', response.data.conversationId);
                        }
                        else if (response.data.conversation_id) {
                            // Check for conversation_id (from OpenAI format)
                            setConversationId(response.data.conversation_id);
                            console.log('Updated conversation_id as conversation ID:', response.data.conversation_id);
                        }
                        else if (response.data.responseId) {
                            // Use responseId as a fallback
                            setConversationId(response.data.responseId);
                            console.log('Updated to responseId as conversation ID:', response.data.responseId);
                        }
                        toast.success('Got answer');
                    }
                    else {
                        setFollowUpAnswer('Sorry, I couldn\'t answer that question about the image.');
                        toast.error('Failed to get a clear answer');
                    }
                    return [3 /*break*/, 11];
                case 9:
                    error_16 = _a.sent();
                    console.error('Error with follow-up question:', error_16);
                    toast.dismiss();
                    toast.error('Failed to process your question');
                    setFollowUpAnswer('Error processing your question. Please try again.');
                    return [3 /*break*/, 11];
                case 10:
                    setIsAskingFollowUp(false);
                    setIsLoadingFollowUp(false);
                    return [7 /*endfinally*/];
                case 11: return [2 /*return*/];
            }
        });
    }); };
    // Helper function to fetch images
    var fetchImages = function (query_1) {
        var args_1 = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args_1[_i - 1] = arguments[_i];
        }
        return __awaiter(void 0, __spreadArray([query_1], args_1, true), void 0, function (query, type) {
            var cleanedQuery, loadingToast, response, error_17, typedError, errorMessage;
            var _a, _b, _c, _d;
            if (type === void 0) { type = 'diagram'; }
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _e.trys.push([0, 2, , 3]);
                        if (!selectedVehicle) {
                            toast.error('Please select a vehicle first');
                            return [2 /*return*/, []];
                        }
                        cleanedQuery = query.trim();
                        loadingToast = toast.loading('Searching for images...');
                        return [4 /*yield*/, axiosInstance.post('/serper/images', {
                                query: cleanedQuery,
                                num: 30,
                                vehicleInfo: {
                                    year: selectedVehicle.year,
                                    make: selectedVehicle.make,
                                    model: selectedVehicle.model,
                                    engine: selectedVehicle.engine || undefined
                                }
                            })];
                    case 1:
                        response = _e.sent();
                        // Dismiss loading toast
                        toast.dismiss(loadingToast);
                        if (((_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.images) === null || _b === void 0 ? void 0 : _b.length) > 0) {
                            // Use the results directly from the backend
                            setSearchResults(response.data.images);
                            return [2 /*return*/, response.data.images];
                        }
                        else {
                            // Show helpful message when no results found
                            toast.error('No relevant images found. Try:\n' +
                                '• Being more specific (e.g. "timing belt diagram" instead of just "belt")\n' +
                                '• Including the component name (e.g. "water pump location")\n' +
                                '• Adding terms like "diagram", "schematic", or "layout"');
                            return [2 /*return*/, []];
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_17 = _e.sent();
                        typedError = error_17;
                        errorMessage = ((_d = (_c = typedError.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.message) || typedError.message || 'Failed to search for images';
                        toast.error(errorMessage);
                        return [2 /*return*/, []];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // New method to ask vehicle-specific questions using the new endpoint
    var askVehicleQuestion = function (question, dtcCode) { return __awaiter(void 0, void 0, void 0, function () {
        var response, error_18;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!selectedVehicle) {
                        toast.error('No vehicle selected');
                        return [2 /*return*/, 'Please select a vehicle first'];
                    }
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, 4, 5]);
                    setIsLoadingFollowUp(true);
                    toast.loading('Getting expert answer...');
                    return [4 /*yield*/, axiosInstance.post('/research/vehicle-question', {
                            vin: selectedVehicle.vin,
                            year: selectedVehicle.year,
                            make: selectedVehicle.make,
                            model: selectedVehicle.model,
                            dtcCode: dtcCode,
                            question: question,
                            trim: selectedVehicle.trim,
                            engine: selectedVehicle.engine,
                            transmission: selectedVehicle.transmission,
                            mileage: selectedVehicle.mileage,
                            includeHistory: true
                        })];
                case 2:
                    response = _b.sent();
                    toast.dismiss();
                    if ((_a = response.data) === null || _a === void 0 ? void 0 : _a.result) {
                        toast.success('Got expert answer');
                        return [2 /*return*/, response.data.result];
                    }
                    else {
                        toast.error('Failed to get answer');
                        return [2 /*return*/, 'Sorry, I could not answer that question about the vehicle.'];
                    }
                    return [3 /*break*/, 5];
                case 3:
                    error_18 = _b.sent();
                    console.error('Error asking vehicle question:', error_18);
                    toast.dismiss();
                    toast.error('Failed to process your question');
                    return [2 /*return*/, 'Error processing your question. Please try again.'];
                case 4:
                    setIsLoadingFollowUp(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    return (<>
    <div className="p-4 pb-20 text-2xl">
      {/* Content grid with main column */}
      <div className="flex flex-col gap-4">
        {/* Top section with grid */}
        <div className="grid grid-cols-12 gap-6">
          {/* Customer Context - 2 columns */}
          <div className="col-span-3 ">
            <CustomerContextDisplay />
          </div>
          
          {/* Middle section - 8 columns */}
          <div className="col-span-9 flex flex-col gap-4 bg-opacity-50 ">
        
            <div className="w-full flex-1 rounded-lg  border-l-4 border-green-500">
              <TranscriptProvider>
                <EventProvider>
                <AppointmentsPage />
                  <App />
                </EventProvider>
              </TranscriptProvider>
            </div>
          </div>

          {/* Right spacing for image area - 2 columns */}
          <div className="col-span-2"></div>
        </div>

        {/* Image search section - fixed on right side */}
        <div className="fixed right-[1vw] w-[13vw] h-[78vh] bg-opacity-50  border-l-4 border-green-400 bg-gray-800 shadow-xl z-10 rounded-lg flex flex-col">
          <div className="p-4 border-b border-gray-600">
            <form onSubmit={handleCustomImageSearch} className="flex flex-col gap-2">
              <input type="text" value={customImageSearch} onChange={function (e) { return setCustomImageSearch(e.target.value); }} placeholder={selectedVehicle ?
            "Search ".concat(selectedVehicle.year, " ").concat(selectedVehicle.make, " ").concat(selectedVehicle.model) :
            "Select a vehicle first"} className="w-full p-2 text-center bg-gray-600 text-white rounded-lg text-2xl focus:ring-2 focus:ring-blue-500" disabled={!selectedVehicle}/>
              <Button type="submit" disabled={!selectedVehicle || !customImageSearch.trim()} className="text-2xl text-white w-full">
                <Search className="mr-2"/>
                Search
              </Button>
            </form>
            
            {/* Add DropZone component here */}
            <div className="mt-4  border-r-4 border-l-4 border-blue-500">
              <h4 className="text-white text-xl mb-2 font-bold text-center">Upload your own image</h4>
              <DropZone onImageUpload={handleImageUpload}/>
            </div>
          </div>
          <div className="flex-1  overflow-y-auto p-4">
            <div className="space-y-4 ">
              {savedImages
            .sort(function (a, b) {
            // Sort by timestamp in descending order (newest first)
            var timestampA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            var timestampB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return timestampB - timestampA;
        })
            .slice(0, 15) // Only display the 15 most recent images
            .map(function (image, index) { return (<div key={index} className="bg-gray-900 bg-opacity-50 rounded-lg border-l-4 border-r-4 border-blue-500 p-2 cursor-pointer hover:bg-gray-800" onClick={function () { return handleModalImageClick(image); }}>
                  <div className="relative w-full h-48">
                    <img src={getImageUrl(image.imageUrl)} alt={image.title} className="w-full text-xl h-full object-contain rounded" onError={function (e) {
                var target = e.target;
                console.log("Image load error, trying alternates:", image.title);
                // Try alternate image sources
                if (image.thumbnailUrl) {
                    target.src = getImageUrl(image.thumbnailUrl);
                }
                else if (image.link) {
                    target.src = getImageUrl(image.link);
                }
                else {
                    // If no alternates, use the default handler
                    handleImageError(e);
                }
            }}/>
                  </div>
                  <p className="mt-2 text-white text-2xl truncate font-semibold">{image.title}</p>
                  <div className="flex justify-between items-center">
                    <p className="text-gray-400 text-2xl font-semibold">
                      Saved: {image.timestamp ? new Date(image.timestamp).toLocaleDateString() : 'Unknown date'}
                    </p>
                    <button onClick={function (e) {
                e.stopPropagation();
                handleDeleteImage(image._id);
            }} className="p-1 text-red-500 hover:bg-gray-700 rounded" title="Delete Image">
                      <Trash2 size={16}/>
                    </button>
                  </div>
                </div>); })}
            </div>
          </div>
        </div>
       
        {/* Research results grid - Always visible */}
        <div className="mt-6">
          <div className="grid grid-cols-5 gap-4 h-[80vh] overflow-y-auto">
            {/* Diagnostic Steps Column */}
            <div className="bg-gray-800 bg-opacity-50 rounded-lg p-4 overflow-y-auto border-l-4 border-blue-500">
              <h3 className="text-2xl font-bold text-yellow-300 mb-4 sticky top-0 bg-gray-800 py-2 z-10">Diagnostic Steps</h3>
              <div className="space-y-4">
                {researchData ? renderDiagnosticSteps() : (<div className="text-gray-400 text-center p-4">
                    No diagnostic steps available yet. Select a vehicle and problem to begin research.
                  </div>)}
              </div>
            </div>

            {/* Possible Causes Column */}
            <div className="bg-gray-800 bg-opacity-50 rounded-lg p-4  overflow-y-auto border-l-4  border-green-500">
              <h3 className="text-2xl font-bold text-yellow-300 mb-4 sticky top-0 bg-gray-800 py-2 z-10">Possible Causes</h3>
              <div className="space-y-4">
                {researchData ? renderPossibleCauses() : (<div className="text-gray-400 text-center p-4">
                    No possible causes identified yet. Select a vehicle and problem to begin research.
                  </div>)}
              </div>
            </div>

            {/* Recommended Fixes Column */}
            <div className="bg-gray-800 bg-opacity-50 rounded-lg p-4 overflow-y-auto border-l-4  border-blue-500">
              <h3 className="text-2xl font-bold text-yellow-300 mb-4 sticky top-0 bg-gray-800 py-2 z-10">Recommended Fixes</h3>
              <div className="space-y-4">
                {researchData ? renderRecommendedFixes() : (<div className="text-gray-400 text-center p-4">
                    No recommended fixes available yet. Select a vehicle and problem to begin research.
                  </div>)}
              </div>
            </div>

            {/* Technical Notes Column */}
            <div className="bg-gray-800 bg-opacity-50 rounded-lg p-4 overflow-y-auto border-l-4  border-green-500">
              <h3 className="text-2xl font-bold text-yellow-300 mb-4 sticky top-0 bg-gray-800 py-2 z-10">Technical Notes</h3>
              <div className="space-y-4">
                {researchData ? renderTechnicalNotes() : (<div className="text-gray-400 text-center p-4">
                    No technical notes available yet. Select a vehicle and problem to begin research.
                  </div>)}
              </div>
            </div>

            {/* References Column */}
            <div className="bg-gray-800 bg-opacity-50 rounded-lg p-4 overflow-y-auto border-l-4 border-blue-500">
              <h3 className="text-2xl font-bold text-yellow-300 mb-4 sticky top-0 bg-gray-800 py-2 z-10">References</h3>
              <div className="space-y-4">
                {researchData ? renderReferences() : (<div className="text-gray-400 text-center p-4">
                    No references available yet. Select a vehicle and problem to begin research.
                  </div>)}
              </div>
            </div>
          </div>
        </div>

        {/* Diagnostic Stepper */}
        {(researchData === null || researchData === void 0 ? void 0 : researchData.diagnosticSteps) && researchData.diagnosticSteps.length > 0 && (<div className="mt-6 bg-gray-800 bg-opacity-50 rounded-lg p-4 border-l-4 border-r-4 border-blue-500">
            <h3 className="text-2xl font-bold text-yellow-300 mb-4">Diagnostic Procedure</h3>
            <VerticalLinearStepper diagnosticSteps={researchData.diagnosticSteps.map(function (step, index) { return (__assign(__assign({}, step), { id: "step-".concat(index) })); })} onStepComplete={function (stepIndex, testResults) {
                // Handle step completion
                console.log("Step ".concat(stepIndex + 1, " completed with results:"), testResults);
            }}/>
          </div>)}
      </div>

      {/* Modals */}
      <DetailModal isOpen={detailModalOpen} onClose={function () {
            setDetailModalOpen(false);
            setSelectedDetailKey(null);
            setCurrentDetailData(null);
        }} loading={detailLoading} data={currentDetailData}/>

      {/* Image Search Modal */}
      <ImageSearchModal isOpen={isImageSearchModalOpen} onClose={function () { return setIsImageSearchModalOpen(false); }} savedImages={savedImages} onImageClick={handleModalImageClick} onDeleteImage={handleDeleteImage} isLoadingSavedImages={isLoadingSavedImages}/>

      {/* Image Viewer Modal with Follow-up Question support */}
      {selectedDiagram && (<Imagemodal open={!!selectedDiagram} onClose={function () {
                setSelectedDiagram(null);
                setImageExplanation('');
                setImageZoom(3.5); // Reset zoom when closing
                setConversationId(null); // Clear conversation ID when closing
            }} explanation={imageExplanation} isLoadingExplanation={isLoadingExplanation} onAskFollowUp={function (question) { return handleFollowUpQuestion(selectedDiagram.url, question); }} selectedDiagram={selectedDiagram} conversationId={conversationId} isLoadingFollowUp={isLoadingFollowUp || isAskingFollowUp}>
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="absolute top-4 left-4 z-50 flex space-x-2">
              <button onClick={handleZoomOut} className="bg-gray-800 text-red-500 rounded-full w-20 h-20 flex items-center justify-center text-3xl">
                -
              </button>
              <button onClick={handleZoomIn} className="bg-gray-800 text-green-400 rounded-full w-20 h-20 flex items-center justify-center text-3xl">
                +
              </button>
            </div>
            
            <img src={getImageUrl(selectedDiagram.url)} alt={selectedDiagram.title} className="object-contain" style={{
                maxWidth: "100%",
                maxHeight: "100%",
                width: "auto",
                height: "auto",
                transform: "scale(".concat(imageZoom, ")") // Use the zoom state variable
            }} onLoad={handleImageLoad} onError={function (e) {
                var target = e.target;
                console.log("Image load error, trying alternates:", selectedDiagram.title);
                toast.error("Image failed to load. Trying alternate source...");
                // Try the original URL first if available
                if (selectedDiagram.link && selectedDiagram.link !== selectedDiagram.url) {
                    console.log("Using link as alternate source");
                    target.src = getImageUrl(selectedDiagram.link);
                }
                // Try thumbnail as a second option
                else if (selectedDiagram.thumbnail) {
                    console.log("Using thumbnail as fallback");
                    target.src = getImageUrl(selectedDiagram.thumbnail);
                }
                // If all alternates fail, apply the default error handler on the next error
                else {
                    handleImageError(e);
                }
                // Set up a final fallback in case the alternate sources also fail
                target.onerror = function (finalError) { return handleImageError(finalError); };
            }}/>
            <div className="absolute bottom-0 left-0 right-0 bg-gray-900 bg-opacity-90 p-4 rounded-b-lg">
              <p className="text-3xl text-white font-semibold">{selectedDiagram.title}</p>
              {selectedDiagram.sourceUrl && (<a href={selectedDiagram.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-blue-400 hover:text-blue-300 text-3xl mt-2">
                  <ExternalLink size={16} className="mr-2"/>
                  View Source
                </a>)}
            </div>
          </div>
        </Imagemodal>)}
    </div>

    <div className="col-span-2 flex flex-col space-y-8 mt-4">
      <div className="w-full bg-gray-800 bg-opacity-50 rounded-lg shadow-md">
      </div>
      <div className="w-full bg-gray-800 bg-opacity-50 rounded-lg shadow-md">
       
      </div>  
    </div>  
    </>);
};
export default VehicleResearch;
