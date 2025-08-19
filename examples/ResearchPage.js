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
import React, { useState } from 'react';
import ResearchProgress from './ResearchProgress';
/**
 * ResearchPage Component
 *
 * Example of how to integrate the ResearchProgress component
 * with a form to submit research queries.
 */
var ResearchPage = function () {
    var _a = useState(''), query = _a[0], setQuery = _a[1];
    var _b = useState(null), researchId = _b[0], setResearchId = _b[1];
    var _c = useState(false), isLoading = _c[0], setIsLoading = _c[1];
    var _d = useState(null), error = _d[0], setError = _d[1];
    // Submit the research query to the API
    var handleSubmit = function (e) { return __awaiter(void 0, void 0, void 0, function () {
        var response, errorData, data, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    e.preventDefault();
                    if (!query.trim()) {
                        setError('Please enter a research query');
                        return [2 /*return*/];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, 7, 8]);
                    setIsLoading(true);
                    setError(null);
                    return [4 /*yield*/, fetch('/api/multiagent-research', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ query: query }),
                        })];
                case 2:
                    response = _a.sent();
                    if (!!response.ok) return [3 /*break*/, 4];
                    return [4 /*yield*/, response.json()];
                case 3:
                    errorData = _a.sent();
                    throw new Error(errorData.error || 'Failed to create research request');
                case 4: return [4 /*yield*/, response.json()];
                case 5:
                    data = _a.sent();
                    setResearchId(data.id);
                    return [3 /*break*/, 8];
                case 6:
                    err_1 = _a.sent();
                    setError(err_1 instanceof Error ? err_1.message : 'An error occurred');
                    return [3 /*break*/, 8];
                case 7:
                    setIsLoading(false);
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/];
            }
        });
    }); };
    return (<div className="research-page">
      <h2>Automotive Research</h2>
      
      {!researchId ? (<form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="query">Research Question</label>
            <textarea id="query" value={query} onChange={function (e) { return setQuery(e.target.value); }} placeholder="Enter your automotive research question here..." rows={4} disabled={isLoading}/>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <button type="submit" disabled={isLoading} className="submit-button">
            {isLoading ? 'Submitting...' : 'Start Research'}
          </button>
        </form>) : (<div className="research-results">
          <div className="research-info">
            <h3>Research in Progress</h3>
            <p>Research ID: {researchId}</p>
            <p>Query: {query}</p>
            <button className="view-results-button" onClick={function () {
                window.open("/research/".concat(researchId), '_blank');
            }}>
              View Full Results
            </button>
            <button className="new-research-button" onClick={function () {
                setResearchId(null);
                setQuery('');
            }}>
              New Research
            </button>
          </div>
          
          <ResearchProgress researchId={researchId}/>
        </div>)}
      
      <style jsx>{"\n        .research-page {\n          max-width: 1000px;\n          margin: 0 auto;\n          padding: 20px;\n          font-family: system-ui, -apple-system, sans-serif;\n        }\n        \n        .form-group {\n          margin-bottom: 20px;\n        }\n        \n        label {\n          display: block;\n          margin-bottom: 8px;\n          font-weight: 500;\n        }\n        \n        textarea {\n          width: 100%;\n          padding: 12px;\n          border: 1px solid #ddd;\n          border-radius: 4px;\n          font-size: 16px;\n          font-family: inherit;\n        }\n        \n        .error-message {\n          color: #d32f2f;\n          background-color: #ffebee;\n          padding: 10px;\n          border-radius: 4px;\n          margin-bottom: 15px;\n        }\n        \n        button {\n          padding: 12px 24px;\n          background-color: #2196f3;\n          color: white;\n          border: none;\n          border-radius: 4px;\n          font-size: 16px;\n          cursor: pointer;\n          transition: background-color 0.3s;\n        }\n        \n        button:hover {\n          background-color: #1976d2;\n        }\n        \n        button:disabled {\n          background-color: #cccccc;\n          cursor: not-allowed;\n        }\n        \n        .research-info {\n          margin-bottom: 30px;\n          padding: 15px;\n          background-color: #f5f5f5;\n          border-radius: 4px;\n        }\n        \n        .research-info p {\n          margin: 5px 0;\n        }\n        \n        .view-results-button,\n        .new-research-button {\n          margin-right: 10px;\n          margin-top: 10px;\n        }\n        \n        .new-research-button {\n          background-color: #757575;\n        }\n        \n        .new-research-button:hover {\n          background-color: #616161;\n        }\n      "}</style>
    </div>);
};
export default ResearchPage;
