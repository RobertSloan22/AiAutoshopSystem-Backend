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
import axios from 'axios';
import OBD2AITools from './obd2AITools';
var ResponsesService = /** @class */ (function () {
    function ResponsesService() {
        // Use different URLs based on environment
        var isProduction = typeof window !== 'undefined' && window.location.hostname !== 'localhost';
        this.baseUrl = isProduction ? 'https://eliza.ngrok.app' : 'http://localhost:5000';
        console.log('ResponsesService singleton initialized with baseUrl:', this.baseUrl);
    }
    ResponsesService.getInstance = function () {
        if (!ResponsesService.instance) {
            ResponsesService.instance = new ResponsesService();
        }
        return ResponsesService.instance;
    };
    ResponsesService.prototype.getHeaders = function () {
        return {
            'Content-Type': 'application/json',
        };
    };
    // Function to create a response from the backend API
    ResponsesService.prototype.createResponse = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, axios.post("".concat(this.baseUrl, "/api/responses/chat"), options, { headers: this.getHeaders() })];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                    case 2:
                        error_1 = _a.sent();
                        console.error('Error creating response:', error_1);
                        throw error_1;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Function to create a streaming response using Server-Sent Events
    ResponsesService.prototype.createStreamingResponse = function (options, onChunk, onComplete) {
        return __awaiter(this, void 0, void 0, function () {
            var requestPayload, response, reader_1, decoder_1, buffer_1, fullContent_1, processStream, error_2;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        requestPayload = {
                            message: options.message,
                            vehicleContext: options.vehicleContext || {},
                            customerContext: options.customerContext || {},
                            tools: options.tools || []
                        };
                        console.log('Starting streaming request with payload:', requestPayload);
                        return [4 /*yield*/, fetch("".concat(this.baseUrl, "/api/responses/chat/stream"), {
                                method: 'POST',
                                headers: this.getHeaders(),
                                body: JSON.stringify(requestPayload),
                            })];
                    case 1:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("HTTP error! status: ".concat(response.status));
                        }
                        if (!response.body) {
                            throw new Error('ReadableStream not supported');
                        }
                        reader_1 = response.body.getReader();
                        decoder_1 = new TextDecoder();
                        buffer_1 = '';
                        fullContent_1 = '';
                        processStream = function () { return __awaiter(_this, void 0, void 0, function () {
                            var _a, done, value, chunk, lines, _i, lines_1, message, dataMatch, jsonData, streamError_1;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _b.trys.push([0, 4, , 5]);
                                        _b.label = 1;
                                    case 1:
                                        if (!true) return [3 /*break*/, 3];
                                        return [4 /*yield*/, reader_1.read()];
                                    case 2:
                                        _a = _b.sent(), done = _a.done, value = _a.value;
                                        if (done)
                                            return [3 /*break*/, 3];
                                        chunk = decoder_1.decode(value, { stream: true });
                                        buffer_1 += chunk;
                                        lines = buffer_1.split('\n\n');
                                        // Keep the last incomplete line in buffer
                                        buffer_1 = lines.pop() || '';
                                        // Process complete messages
                                        for (_i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
                                            message = lines_1[_i];
                                            if (message.trim()) {
                                                dataMatch = message.match(/^data:\s*(.+)$/m);
                                                if (dataMatch) {
                                                    try {
                                                        jsonData = JSON.parse(dataMatch[1]);
                                                        console.log('Received SSE data:', jsonData);
                                                        // Handle different message types
                                                        if (jsonData.type === 'content' && jsonData.content) {
                                                            fullContent_1 += jsonData.content;
                                                            onChunk({
                                                                type: 'content',
                                                                content: jsonData.content,
                                                                sessionId: jsonData.sessionId
                                                            });
                                                        }
                                                        else if (jsonData.type === 'session_started') {
                                                            onChunk({
                                                                type: 'session_started',
                                                                sessionId: jsonData.sessionId
                                                            });
                                                        }
                                                        else if (jsonData.type === 'tool_call') {
                                                            onChunk({
                                                                type: 'tool_call',
                                                                toolCall: jsonData.toolCall,
                                                                sessionId: jsonData.sessionId
                                                            });
                                                        }
                                                        else if (jsonData.type === 'tool_call_progress') {
                                                            onChunk({
                                                                type: 'tool_call_progress',
                                                                toolCall: jsonData.toolCall,
                                                                sessionId: jsonData.sessionId
                                                            });
                                                        }
                                                        else if (jsonData.type === 'tool_calls_started') {
                                                            onChunk({
                                                                type: 'tool_calls_started',
                                                                toolCalls: jsonData.toolCalls,
                                                                sessionId: jsonData.sessionId
                                                            });
                                                        }
                                                        else if (jsonData.type === 'tool_calls_completed') {
                                                            onChunk({
                                                                type: 'tool_calls_completed',
                                                                results: jsonData.results,
                                                                sessionId: jsonData.sessionId
                                                            });
                                                        }
                                                        else if (jsonData.type === 'stream_complete') {
                                                            onChunk({
                                                                type: 'stream_complete',
                                                                sessionId: jsonData.sessionId
                                                            });
                                                        }
                                                        else if (jsonData.type === 'error') {
                                                            onChunk({
                                                                type: 'error',
                                                                error: jsonData.error,
                                                                sessionId: jsonData.sessionId
                                                            });
                                                        }
                                                    }
                                                    catch (e) {
                                                        console.log('Failed to parse SSE data:', dataMatch[1], e);
                                                    }
                                                }
                                            }
                                        }
                                        return [3 /*break*/, 1];
                                    case 3:
                                        // Complete the stream
                                        onComplete({
                                            fullContent: fullContent_1,
                                            type: 'stream_complete'
                                        });
                                        return [3 /*break*/, 5];
                                    case 4:
                                        streamError_1 = _b.sent();
                                        console.error('Error processing stream:', streamError_1);
                                        throw streamError_1;
                                    case 5: return [2 /*return*/];
                                }
                            });
                        }); };
                        return [4 /*yield*/, processStream()];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        console.error('Error in streaming response:', error_2);
                        throw error_2;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // Execute Python code with visualization support
    ResponsesService.prototype.executePython = function (code_1) {
        return __awaiter(this, arguments, void 0, function (code, options) {
            var response, error_3;
            var _a;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, axios.post("".concat(this.baseUrl, "/api/responses/execute/python"), {
                                code: code,
                                save_plots: (_a = options.save_plots) !== null && _a !== void 0 ? _a : true,
                                plot_filename: options.plot_filename
                            }, { headers: this.getHeaders() })];
                    case 1:
                        response = _b.sent();
                        return [2 /*return*/, response.data];
                    case 2:
                        error_3 = _b.sent();
                        console.error('Error executing Python code:', error_3);
                        throw error_3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Create an analysis with potential visualizations
    ResponsesService.prototype.createAnalysis = function (question_1) {
        return __awaiter(this, arguments, void 0, function (question, context, includeVisualization) {
            var response, error_4;
            if (context === void 0) { context = {}; }
            if (includeVisualization === void 0) { includeVisualization = true; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, axios.post("".concat(this.baseUrl, "/api/responses/chat/analyze"), {
                                question: question,
                                vehicleContext: context.vehicleContext,
                                customerContext: context.customerContext,
                                includeVisualization: includeVisualization
                            }, { headers: this.getHeaders() })];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                    case 2:
                        error_4 = _a.sent();
                        console.error('Error creating analysis:', error_4);
                        throw error_4;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Create a streaming analysis with visualizations
    ResponsesService.prototype.createStreamingAnalysis = function (question_1, onChunk_1, onComplete_1) {
        return __awaiter(this, arguments, void 0, function (question, onChunk, onComplete, context, includeVisualization) {
            var response, reader_2, decoder_2, buffer_2, fullContent_2, visualizations_1, processStream, error_5;
            var _this = this;
            if (context === void 0) { context = {}; }
            if (includeVisualization === void 0) { includeVisualization = true; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, fetch("".concat(this.baseUrl, "/api/responses/chat/analyze/stream"), {
                                method: 'POST',
                                headers: this.getHeaders(),
                                body: JSON.stringify({
                                    question: question,
                                    vehicleContext: context.vehicleContext,
                                    customerContext: context.customerContext,
                                    includeVisualization: includeVisualization
                                }),
                            })];
                    case 1:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("HTTP error! status: ".concat(response.status));
                        }
                        if (!response.body) {
                            throw new Error('ReadableStream not supported');
                        }
                        reader_2 = response.body.getReader();
                        decoder_2 = new TextDecoder();
                        buffer_2 = '';
                        fullContent_2 = '';
                        visualizations_1 = [];
                        processStream = function () { return __awaiter(_this, void 0, void 0, function () {
                            var _a, done, value, chunk, lines, _i, lines_2, message, dataMatch, jsonData, streamError_2;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _b.trys.push([0, 4, , 5]);
                                        _b.label = 1;
                                    case 1:
                                        if (!true) return [3 /*break*/, 3];
                                        return [4 /*yield*/, reader_2.read()];
                                    case 2:
                                        _a = _b.sent(), done = _a.done, value = _a.value;
                                        if (done)
                                            return [3 /*break*/, 3];
                                        chunk = decoder_2.decode(value, { stream: true });
                                        buffer_2 += chunk;
                                        lines = buffer_2.split('\n\n');
                                        buffer_2 = lines.pop() || '';
                                        for (_i = 0, lines_2 = lines; _i < lines_2.length; _i++) {
                                            message = lines_2[_i];
                                            if (message.trim()) {
                                                dataMatch = message.match(/^data:\s*(.+)$/m);
                                                if (dataMatch) {
                                                    try {
                                                        jsonData = JSON.parse(dataMatch[1]);
                                                        // Pass through all events
                                                        onChunk(jsonData);
                                                        // Track content and visualizations
                                                        if (jsonData.type === 'content') {
                                                            fullContent_2 += jsonData.content;
                                                        }
                                                        else if (jsonData.type === 'visualization_ready') {
                                                            visualizations_1 = jsonData.visualizations;
                                                        }
                                                    }
                                                    catch (e) {
                                                        console.log('Failed to parse SSE data:', dataMatch[1], e);
                                                    }
                                                }
                                            }
                                        }
                                        return [3 /*break*/, 1];
                                    case 3:
                                        onComplete({
                                            fullContent: fullContent_2,
                                            visualizations: visualizations_1,
                                            type: 'analysis_complete'
                                        });
                                        return [3 /*break*/, 5];
                                    case 4:
                                        streamError_2 = _b.sent();
                                        console.error('Error processing analysis stream:', streamError_2);
                                        throw streamError_2;
                                    case 5: return [2 /*return*/];
                                }
                            });
                        }); };
                        return [4 /*yield*/, processStream()];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_5 = _a.sent();
                        console.error('Error in streaming analysis:', error_5);
                        throw error_5;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // Get service status endpoints
    ResponsesService.prototype.getMCPStatus = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, axios.get("".concat(this.baseUrl, "/api/responses/mcp/status"))];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                    case 2:
                        error_6 = _a.sent();
                        console.error('Error getting MCP status:', error_6);
                        throw error_6;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    ResponsesService.prototype.getWebSearchStatus = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_7;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, axios.get("".concat(this.baseUrl, "/api/responses/websearch/status"))];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                    case 2:
                        error_7 = _a.sent();
                        console.error('Error getting web search status:', error_7);
                        throw error_7;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    ResponsesService.prototype.getAllServicesStatus = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_8;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, axios.get("".concat(this.baseUrl, "/api/responses/services/status"))];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                    case 2:
                        error_8 = _a.sent();
                        console.error('Error getting services status:', error_8);
                        throw error_8;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Health check
    ResponsesService.prototype.checkHealth = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_9;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, axios.get("".concat(this.baseUrl, "/api/responses/health"))];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                    case 2:
                        error_9 = _a.sent();
                        console.error('Error checking health:', error_9);
                        throw error_9;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // FINAL FIX: Predefined tools for common scenarios
    ResponsesService.prototype.getWebSearchTool = function () {
        return {
            type: "web_search"
            // No name property for web_search tools
        };
    };
    ResponsesService.prototype.getFileSearchTool = function (vectorStoreIds) {
        if (vectorStoreIds === void 0) { vectorStoreIds = []; }
        return __assign({ type: "file_search" }, (vectorStoreIds.length > 0 && { vector_store_ids: vectorStoreIds })
        // No name property for file_search tools
        );
    };
    ResponsesService.prototype.getFunctionTool = function (name, description, parameters) {
        return {
            type: "function",
            name: name, // ✅ REQUIRED: Top-level name
            function: {
                name: name, // ✅ REQUIRED: Must match top-level name
                description: description,
                parameters: parameters
            }
        };
    };
    ResponsesService.prototype.getReasoningTool = function () {
        return {
            type: "reasoning"
            // No name property for reasoning tools
        };
    };
    // Python execution tool
    ResponsesService.prototype.getPythonExecutionTool = function () {
        return {
            type: "function",
            name: "execute_python_code",
            function: {
                name: "execute_python_code",
                description: "Execute Python code in a secure environment with access to data analysis libraries (pandas, numpy, matplotlib, seaborn). Can perform calculations, data analysis, and generate plots.",
                parameters: {
                    type: "object",
                    properties: {
                        code: {
                            type: "string",
                            description: "The Python code to execute. Can include imports, calculations, data analysis, and plot generation."
                        },
                        save_plots: {
                            type: "boolean",
                            description: "Whether to save any generated plots as PNG files",
                            default: true
                        },
                        plot_filename: {
                            type: "string",
                            description: "Optional filename for saved plots (without extension). If not provided, a unique name will be generated."
                        }
                    },
                    required: ["code"]
                }
            }
        };
    };
    // FINAL FIX: Direct OBD2 Function Tools (replaces MCP tools)
    ResponsesService.prototype.getOBD2FunctionTool = function (name, description, parameters) {
        if (parameters === void 0) { parameters = {}; }
        return {
            type: "function",
            name: name, // ✅ REQUIRED: Top-level name
            function: {
                name: name, // ✅ REQUIRED: Must match top-level name
                description: description,
                parameters: {
                    type: "object",
                    properties: parameters,
                    required: Object.keys(parameters)
                }
            }
        };
    };
    // FINAL FIX: Get all OBD2 function tools
    ResponsesService.prototype.getOBD2Tools = function () {
        var toolDescriptions = OBD2AITools.getToolDescriptions();
        return [
            this.getOBD2FunctionTool("scanForAdapters", toolDescriptions.scanForAdapters),
            this.getOBD2FunctionTool("connectOBD2Adapter", toolDescriptions.connectOBD2Adapter, {
                deviceId: {
                    type: "string",
                    description: "Optional device ID to connect to. If not provided, will auto-select best adapter."
                }
            }),
            this.getOBD2FunctionTool("getLiveData", toolDescriptions.getLiveData),
            this.getOBD2FunctionTool("readDiagnosticCodes", toolDescriptions.readDiagnosticCodes),
            this.getOBD2FunctionTool("getConnectionStatus", toolDescriptions.getConnectionStatus),
            this.getOBD2FunctionTool("getVehicleContext", toolDescriptions.getVehicleContext)
        ];
    };
    // Get all available tools including Python execution
    ResponsesService.prototype.getAllTools = function () {
        return __spreadArray(__spreadArray([], this.getOBD2Tools(), true), [
            this.getPythonExecutionTool(),
            this.getWebSearchTool(),
            this.getReasoningTool()
        ], false);
    };
    // Handle local OBD2 tool calls before sending to backend
    ResponsesService.prototype.handleLocalToolCall = function (toolName_1) {
        return __awaiter(this, arguments, void 0, function (toolName, args) {
            var _a, error_10;
            if (args === void 0) { args = {}; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        console.log("\uD83D\uDD27 Handling local tool call: ".concat(toolName), args);
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 15, , 16]);
                        _a = toolName;
                        switch (_a) {
                            case 'scanForAdapters': return [3 /*break*/, 2];
                            case 'connectOBD2Adapter': return [3 /*break*/, 4];
                            case 'getLiveData': return [3 /*break*/, 6];
                            case 'readDiagnosticCodes': return [3 /*break*/, 8];
                            case 'getConnectionStatus': return [3 /*break*/, 10];
                            case 'getVehicleContext': return [3 /*break*/, 12];
                        }
                        return [3 /*break*/, 13];
                    case 2: return [4 /*yield*/, OBD2AITools.scanForAdapters()];
                    case 3: return [2 /*return*/, _b.sent()];
                    case 4: return [4 /*yield*/, OBD2AITools.connectOBD2Adapter(args.deviceId)];
                    case 5: return [2 /*return*/, _b.sent()];
                    case 6: return [4 /*yield*/, OBD2AITools.getLiveData()];
                    case 7: return [2 /*return*/, _b.sent()];
                    case 8: return [4 /*yield*/, OBD2AITools.readDiagnosticCodes()];
                    case 9: return [2 /*return*/, _b.sent()];
                    case 10: return [4 /*yield*/, OBD2AITools.getConnectionStatus()];
                    case 11: return [2 /*return*/, _b.sent()];
                    case 12: return [2 /*return*/, OBD2AITools.getVehicleContext()];
                    case 13: throw new Error("Unknown OBD2 tool: ".concat(toolName));
                    case 14: return [3 /*break*/, 16];
                    case 15:
                        error_10 = _b.sent();
                        console.error("Error in tool ".concat(toolName, ":"), error_10);
                        return [2 /*return*/, {
                                error: error_10 instanceof Error ? error_10.message : 'Tool execution failed',
                                success: false,
                                timestamp: Date.now()
                            }];
                    case 16: return [2 /*return*/];
                }
            });
        });
    };
    // Create a chat completion with OBD2 diagnostic capabilities
    ResponsesService.prototype.createOBD2DiagnosticResponse = function (prompt_1, vehicleContext_1) {
        return __awaiter(this, arguments, void 0, function (prompt, vehicleContext, options) {
            var enhancedPrompt, requestOptions;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                // Set vehicle context for AI tools
                if (vehicleContext) {
                    OBD2AITools.setVehicleContext(vehicleContext);
                }
                enhancedPrompt = vehicleContext
                    ? "Vehicle Context: ".concat(vehicleContext.year, " ").concat(vehicleContext.make, " ").concat(vehicleContext.model, " ").concat(vehicleContext.vin ? "(VIN: ".concat(vehicleContext.vin, ")") : '', "\n\nDiagnostic Request: ").concat(prompt)
                    : prompt;
                requestOptions = __assign({ model: options.model || 'gpt-4', message: enhancedPrompt, tools: this.getAllTools(), max_tokens: options.max_tokens || 2000, temperature: options.temperature || 0.3 }, options);
                return [2 /*return*/, this.createResponse(requestOptions)];
            });
        });
    };
    // Create a diagnostic analysis with visualizations
    ResponsesService.prototype.createDiagnosticAnalysis = function (question_1, vehicleContext_1) {
        return __awaiter(this, arguments, void 0, function (question, vehicleContext, includeVisualization) {
            if (includeVisualization === void 0) { includeVisualization = true; }
            return __generator(this, function (_a) {
                // Set vehicle context for AI tools
                if (vehicleContext) {
                    OBD2AITools.setVehicleContext(vehicleContext);
                }
                return [2 /*return*/, this.createAnalysis(question, { vehicleContext: vehicleContext }, includeVisualization)];
            });
        });
    };
    // Helper function to format customer and vehicle context nicely
    ResponsesService.prototype.formatCustomerAndVehicleContext = function (customerName, vehicleContext, obd2Status) {
        // Build system context even if no customer/vehicle info to include OBD2 status
        var formattedContext = '\n\n[SYSTEM CONTEXT - NOT VISIBLE TO USER]\n';
        // Add customer info if available
        if (customerName) {
            formattedContext += "Customer: ".concat(customerName, "\n");
        }
        // Add vehicle info if available
        if (vehicleContext) {
            if (vehicleContext.year || vehicleContext.make || vehicleContext.model) {
                formattedContext += "Vehicle: ".concat(vehicleContext.year || '', " ").concat(vehicleContext.make || '', " ").concat(vehicleContext.model || '', "\n");
            }
            if (vehicleContext.vin) {
                formattedContext += "VIN: ".concat(vehicleContext.vin, "\n");
            }
        }
        // Add OBD2 status if available
        if (obd2Status) {
            formattedContext += "\nOBD2 Status: ".concat(obd2Status.isConnected ? 'CONNECTED' : 'DISCONNECTED', "\n");
            if (obd2Status.isConnected) {
                formattedContext += "Data Age: ".concat(obd2Status.dataAge !== null ? "".concat(obd2Status.dataAge, "s ago") : 'Unknown', "\n");
                if (obd2Status.currentData) {
                    formattedContext += 'Current Data:\n';
                    Object.entries(obd2Status.currentData).forEach(function (_a) {
                        var key = _a[0], value = _a[1];
                        if (value !== null && value !== undefined) {
                            formattedContext += "- ".concat(key, ": ").concat(value, "\n");
                        }
                    });
                }
            }
        }
        formattedContext += '[END SYSTEM CONTEXT]\n\n';
        return formattedContext;
    };
    // Create a streaming diagnostic session with direct OBD2 tools
    ResponsesService.prototype.createOBD2StreamingSession = function (prompt_1, onChunk_1, onComplete_1, vehicleContext_1) {
        return __awaiter(this, arguments, void 0, function (prompt, onChunk, onComplete, vehicleContext, options, customerName, obd2Status) {
            var contextHeader, enhancedPrompt, requestOptions, enhancedOnChunk;
            var _this = this;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                // Set vehicle context for AI tools
                if (vehicleContext) {
                    OBD2AITools.setVehicleContext(vehicleContext);
                }
                contextHeader = this.formatCustomerAndVehicleContext(customerName, vehicleContext, obd2Status);
                enhancedPrompt = contextHeader + prompt;
                requestOptions = __assign({ model: options.model || 'gpt-4', message: enhancedPrompt, tools: this.getAllTools(), max_tokens: options.max_tokens || 2000, temperature: options.temperature || 0.3, stream: true }, options);
                enhancedOnChunk = function (chunk) { return __awaiter(_this, void 0, void 0, function () {
                    var toolName, toolArgs, obd2ToolNames, toolResult, error_11;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                if (!(chunk.type === 'tool_call' && chunk.function)) return [3 /*break*/, 4];
                                toolName = chunk.function.name;
                                toolArgs = chunk.function.arguments;
                                obd2ToolNames = ['scanForAdapters', 'connectOBD2Adapter', 'getLiveData', 'readDiagnosticCodes', 'getConnectionStatus', 'getVehicleContext'];
                                if (!obd2ToolNames.includes(toolName)) return [3 /*break*/, 4];
                                _a.label = 1;
                            case 1:
                                _a.trys.push([1, 3, , 4]);
                                console.log("\uD83D\uDD27 Processing local OBD2 tool call: ".concat(toolName));
                                return [4 /*yield*/, this.handleLocalToolCall(toolName, toolArgs)];
                            case 2:
                                toolResult = _a.sent();
                                // Send tool result as a chunk
                                onChunk({
                                    type: 'tool_result',
                                    tool_call_id: chunk.id,
                                    content: JSON.stringify(toolResult, null, 2)
                                });
                                return [2 /*return*/]; // Don't pass OBD2 tool calls to backend
                            case 3:
                                error_11 = _a.sent();
                                console.error("Error handling local tool call ".concat(toolName, ":"), error_11);
                                onChunk({
                                    type: 'tool_result',
                                    tool_call_id: chunk.id,
                                    content: JSON.stringify({
                                        error: error_11 instanceof Error ? error_11.message : 'Tool execution failed',
                                        success: false
                                    })
                                });
                                return [2 /*return*/];
                            case 4:
                                // Pass all other chunks through normally
                                onChunk(chunk);
                                return [2 /*return*/];
                        }
                    });
                }); };
                return [2 /*return*/, this.createStreamingResponse(requestOptions, enhancedOnChunk, onComplete)];
            });
        });
    };
    // Create a streaming diagnostic analysis session with visualizations
    ResponsesService.prototype.createOBD2StreamingAnalysis = function (question_1, onChunk_1, onComplete_1, vehicleContext_1, customerName_1, obd2Status_1) {
        return __awaiter(this, arguments, void 0, function (question, onChunk, onComplete, vehicleContext, customerName, obd2Status, includeVisualization) {
            var context, enhancedOnChunk;
            var _this = this;
            if (includeVisualization === void 0) { includeVisualization = true; }
            return __generator(this, function (_a) {
                // Set vehicle context for AI tools
                if (vehicleContext) {
                    OBD2AITools.setVehicleContext(vehicleContext);
                }
                context = {
                    vehicleContext: vehicleContext,
                    customerContext: customerName ? { name: customerName } : undefined,
                    obd2Data: obd2Status ? {
                        connectionStatus: obd2Status.isConnected ? 'connected' : 'disconnected',
                        metrics: obd2Status.currentData
                    } : undefined
                };
                enhancedOnChunk = function (chunk) { return __awaiter(_this, void 0, void 0, function () {
                    var toolName, toolArgs, obd2ToolNames, toolResult, error_12;
                    var _a;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                if (!(chunk.type === 'tool_call_progress' && ((_a = chunk.toolCall) === null || _a === void 0 ? void 0 : _a.function))) return [3 /*break*/, 4];
                                toolName = chunk.toolCall.function.name;
                                toolArgs = chunk.toolCall.function.arguments;
                                obd2ToolNames = ['scanForAdapters', 'connectOBD2Adapter', 'getLiveData', 'readDiagnosticCodes', 'getConnectionStatus', 'getVehicleContext'];
                                if (!obd2ToolNames.includes(toolName)) return [3 /*break*/, 4];
                                _b.label = 1;
                            case 1:
                                _b.trys.push([1, 3, , 4]);
                                console.log("\uD83D\uDD27 Processing local OBD2 tool call: ".concat(toolName));
                                return [4 /*yield*/, this.handleLocalToolCall(toolName, toolArgs)];
                            case 2:
                                toolResult = _b.sent();
                                // Send tool result as a chunk
                                onChunk({
                                    type: 'tool_result',
                                    tool_call_id: chunk.toolCall.id,
                                    content: JSON.stringify(toolResult, null, 2)
                                });
                                return [2 /*return*/]; // Don't pass OBD2 tool calls to backend
                            case 3:
                                error_12 = _b.sent();
                                console.error("Error handling local tool call ".concat(toolName, ":"), error_12);
                                onChunk({
                                    type: 'tool_result',
                                    tool_call_id: chunk.toolCall.id,
                                    content: JSON.stringify({
                                        error: error_12 instanceof Error ? error_12.message : 'Tool execution failed',
                                        success: false
                                    })
                                });
                                return [2 /*return*/];
                            case 4:
                                // Pass all other chunks through normally
                                onChunk(chunk);
                                return [2 /*return*/];
                        }
                    });
                }); };
                return [2 /*return*/, this.createStreamingAnalysis(question, enhancedOnChunk, onComplete, context, includeVisualization)];
            });
        });
    };
    // Add a sendMessage method for easier usage
    ResponsesService.prototype.sendMessage = function (message_1) {
        return __awaiter(this, arguments, void 0, function (message, context) {
            var vehicleContext, customerName, obd2Status, response, result, bubbleData, event_1, event_2, error_13;
            var _a, _b, _c, _d, _e;
            if (context === void 0) { context = {}; }
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        console.log('responsesService.sendMessage called with:', message, context);
                        _f.label = 1;
                    case 1:
                        _f.trys.push([1, 3, , 4]);
                        vehicleContext = context.vehicleContext || {};
                        customerName = (_a = context.customerContext) === null || _a === void 0 ? void 0 : _a.name;
                        obd2Status = context.obd2Data ? {
                            isConnected: context.obd2Data.connectionStatus === 'connected',
                            currentData: context.obd2Data.metrics || {}
                        } : undefined;
                        return [4 /*yield*/, this.createOBD2DiagnosticResponse(message, vehicleContext, {
                                // Additional options can be set here
                                temperature: 0.5
                            })];
                    case 2:
                        response = _f.sent();
                        console.log('responsesService.sendMessage received response:', response);
                        result = {
                            response: response.content || response.message || response.response || 'No response from AI',
                            bubbleData: null
                        };
                        // Include live OBD data and research data if requested
                        if (context.includeLiveOBDData || context.includeResearchData) {
                            bubbleData = {
                                type: 'LiveOBDMCP',
                                data: {
                                    obd2Data: (_b = context.obd2Data) === null || _b === void 0 ? void 0 : _b.metrics,
                                    connectionStatus: ((_c = context.obd2Data) === null || _c === void 0 ? void 0 : _c.connectionStatus) || 'disconnected',
                                    researchData: context.includeResearchData ? context.researchData : undefined,
                                    timestamp: new Date().toISOString(),
                                    // Add additional data needed for the enhanced UnifiedLiveOBDMCPBubble
                                    vehicleContext: context.vehicleContext || {
                                        make: "Not specified",
                                        model: "Not specified",
                                        year: "Not specified"
                                    },
                                    customerName: customerName || "Customer"
                                }
                            };
                            result.bubbleData = bubbleData;
                            // Dispatch ai-response event for BubbleManager integration
                            try {
                                if (typeof document !== 'undefined') {
                                    console.log('Dispatching ai-response event for AI response with LiveOBDMCP data');
                                    event_1 = new CustomEvent('ai-response', {
                                        detail: {
                                            text: response.content || response.message || response.response || 'No response from AI',
                                            source: 'assistant',
                                            bubbleType: 'obd-live',
                                            additionalData: {
                                                obd2Data: (_d = context.obd2Data) === null || _d === void 0 ? void 0 : _d.metrics,
                                                connectionStatus: ((_e = context.obd2Data) === null || _e === void 0 ? void 0 : _e.connectionStatus) || 'disconnected',
                                                researchData: context.includeResearchData ? context.researchData : undefined,
                                                timestamp: new Date().toISOString(),
                                                // Include the same additional data in the event
                                                vehicleContext: context.vehicleContext || {
                                                    make: "Not specified",
                                                    model: "Not specified",
                                                    year: "Not specified"
                                                },
                                                customerName: customerName || "Customer"
                                            }
                                        }
                                    });
                                    document.dispatchEvent(event_1);
                                }
                            }
                            catch (dispatchError) {
                                console.error('Error dispatching ai-response event for AI response:', dispatchError);
                            }
                        }
                        else {
                            // For regular responses without OBD data, still dispatch an event for the BubbleManager
                            try {
                                if (typeof document !== 'undefined') {
                                    console.log('Dispatching ai-response event for standard AI response');
                                    event_2 = new CustomEvent('ai-response', {
                                        detail: {
                                            text: response.content || response.message || response.response || 'No response from AI',
                                            source: 'assistant',
                                            bubbleType: 'realtime',
                                            additionalData: {
                                                timestamp: new Date().toISOString()
                                            }
                                        }
                                    });
                                    document.dispatchEvent(event_2);
                                }
                            }
                            catch (dispatchError) {
                                console.error('Error dispatching ai-response event for standard AI response:', dispatchError);
                            }
                        }
                        return [2 /*return*/, result];
                    case 3:
                        error_13 = _f.sent();
                        console.error('Error in responsesService.sendMessage:', error_13);
                        throw error_13;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // Add a new method specifically for creating LiveOBDMCP bubbles
    ResponsesService.prototype.createLiveOBDMCPResponse = function (dtcCode_1) {
        return __awaiter(this, arguments, void 0, function (dtcCode, context) {
            var obd2Data, err_1, vehicleContext, customerName, bubbleData, event_3, error_14;
            var _a, _b, _c, _d, _e;
            if (context === void 0) { context = {}; }
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        _f.trys.push([0, 5, , 6]);
                        obd2Data = void 0;
                        _f.label = 1;
                    case 1:
                        _f.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.handleLocalToolCall('getLiveData')];
                    case 2:
                        obd2Data = _f.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        err_1 = _f.sent();
                        console.error('Error fetching live OBD2 data:', err_1);
                        obd2Data = null;
                        return [3 /*break*/, 4];
                    case 4:
                        vehicleContext = context.vehicleContext || {};
                        customerName = (_a = context.customerContext) === null || _a === void 0 ? void 0 : _a.name;
                        bubbleData = {
                            type: 'LiveOBDMCP',
                            data: {
                                obd2Data: obd2Data || ((_b = context.obd2Data) === null || _b === void 0 ? void 0 : _b.metrics),
                                connectionStatus: (obd2Data && !obd2Data.error) ? 'connected' :
                                    ((_c = context.obd2Data) === null || _c === void 0 ? void 0 : _c.connectionStatus) || 'disconnected',
                                researchData: context.researchData,
                                dtcCode: dtcCode,
                                title: dtcCode ? "Diagnostic Analysis for ".concat(dtcCode) : 'Live OBD2 Diagnostic Data',
                                timestamp: new Date().toISOString(),
                                // Add additional data needed for the enhanced UnifiedLiveOBDMCPBubble
                                vehicleContext: {
                                    make: vehicleContext.make || "Not specified",
                                    model: vehicleContext.model || "Not specified",
                                    year: vehicleContext.year || "Not specified",
                                    vin: vehicleContext.vin
                                },
                                customerName: customerName || "Customer"
                            }
                        };
                        // Dispatch ai-response event for BubbleManager integration
                        try {
                            if (typeof document !== 'undefined') {
                                console.log('Dispatching ai-response event for LiveOBDMCP data');
                                event_3 = new CustomEvent('ai-response', {
                                    detail: {
                                        text: dtcCode ? "Diagnostic Analysis for ".concat(dtcCode) : 'Live OBD2 Diagnostic Data',
                                        source: 'obd2',
                                        bubbleType: 'obd-live',
                                        additionalData: {
                                            obd2Data: obd2Data || ((_d = context.obd2Data) === null || _d === void 0 ? void 0 : _d.metrics),
                                            connectionStatus: (obd2Data && !obd2Data.error) ? 'connected' :
                                                ((_e = context.obd2Data) === null || _e === void 0 ? void 0 : _e.connectionStatus) || 'disconnected',
                                            researchData: context.researchData,
                                            dtcCode: dtcCode,
                                            timestamp: new Date().toISOString(),
                                            // Include the same additional data in the event
                                            vehicleContext: {
                                                make: vehicleContext.make || "Not specified",
                                                model: vehicleContext.model || "Not specified",
                                                year: vehicleContext.year || "Not specified",
                                                vin: vehicleContext.vin
                                            },
                                            customerName: customerName || "Customer"
                                        }
                                    }
                                });
                                document.dispatchEvent(event_3);
                            }
                        }
                        catch (dispatchError) {
                            console.error('Error dispatching ai-response event for LiveOBDMCP:', dispatchError);
                        }
                        return [2 /*return*/, {
                                bubbleData: bubbleData,
                                success: true
                            }];
                    case 5:
                        error_14 = _f.sent();
                        console.error('Error creating LiveOBDMCP response:', error_14);
                        return [2 /*return*/, {
                                bubbleData: null,
                                success: false,
                                error: error_14 instanceof Error ? error_14.message : 'Unknown error'
                            }];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    return ResponsesService;
}());
export { ResponsesService };
// Export a single instance of the service to be used throughout the application
export var responsesService = ResponsesService.getInstance();
// Export a hook for React components
export var useResponsesService = function () {
    return responsesService;
};
