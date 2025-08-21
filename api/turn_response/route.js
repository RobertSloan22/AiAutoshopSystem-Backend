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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
import { MODEL } from "@/config/constants";
import { NextResponse } from "next/server";
import OpenAI from "openai";
export function POST(request) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, messages, tools, openai_1, events_1, stream, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, request.json()];
                case 1:
                    _a = _b.sent(), messages = _a.messages, tools = _a.tools;
                    console.log("Received messages:", messages);
                    openai_1 = new OpenAI();
                    return [4 /*yield*/, openai_1.responses.create({
                            model: MODEL,
                            input: messages,
                            tools: tools,
                            stream: true,
                            parallel_tool_calls: false,
                        })];
                case 2:
                    events_1 = _b.sent();
                    stream = new ReadableStream({
                        start: function (controller) {
                            return __awaiter(this, void 0, void 0, function () {
                                var _a, events_2, events_2_1, event_1, data, e_1_1, error_2;
                                var _b, e_1, _c, _d;
                                return __generator(this, function (_e) {
                                    switch (_e.label) {
                                        case 0:
                                            _e.trys.push([0, 13, , 14]);
                                            _e.label = 1;
                                        case 1:
                                            _e.trys.push([1, 6, 7, 12]);
                                            _a = true, events_2 = __asyncValues(events_1);
                                            _e.label = 2;
                                        case 2: return [4 /*yield*/, events_2.next()];
                                        case 3:
                                            if (!(events_2_1 = _e.sent(), _b = events_2_1.done, !_b)) return [3 /*break*/, 5];
                                            _d = events_2_1.value;
                                            _a = false;
                                            event_1 = _d;
                                            data = JSON.stringify({
                                                event: event_1.type,
                                                data: event_1,
                                            });
                                            controller.enqueue("data: ".concat(data, "\n\n"));
                                            _e.label = 4;
                                        case 4:
                                            _a = true;
                                            return [3 /*break*/, 2];
                                        case 5: return [3 /*break*/, 12];
                                        case 6:
                                            e_1_1 = _e.sent();
                                            e_1 = { error: e_1_1 };
                                            return [3 /*break*/, 12];
                                        case 7:
                                            _e.trys.push([7, , 10, 11]);
                                            if (!(!_a && !_b && (_c = events_2.return))) return [3 /*break*/, 9];
                                            return [4 /*yield*/, _c.call(events_2)];
                                        case 8:
                                            _e.sent();
                                            _e.label = 9;
                                        case 9: return [3 /*break*/, 11];
                                        case 10:
                                            if (e_1) throw e_1.error;
                                            return [7 /*endfinally*/];
                                        case 11: return [7 /*endfinally*/];
                                        case 12:
                                            // End of stream
                                            controller.close();
                                            return [3 /*break*/, 14];
                                        case 13:
                                            error_2 = _e.sent();
                                            console.error("Error in streaming loop:", error_2);
                                            controller.error(error_2);
                                            return [3 /*break*/, 14];
                                        case 14: return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    });
                    // Return the ReadableStream as SSE
                    return [2 /*return*/, new Response(stream, {
                            headers: {
                                "Content-Type": "text/event-stream",
                                "Cache-Control": "no-cache",
                            },
                        })];
                case 3:
                    error_1 = _b.sent();
                    console.error("Error in POST handler:", error_1);
                    return [2 /*return*/, NextResponse.json({
                            error: error_1 instanceof Error ? error_1.message : "Unknown error",
                        }, { status: 500 })];
                case 4: return [2 /*return*/];
            }
        });
    });
}
