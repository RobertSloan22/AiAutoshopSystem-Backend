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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
/**
 * ResearchProgress Component
 *
 * This component connects to the Socket.IO server and displays real-time
 * progress of the multi-agent research system.
 */
var ResearchProgress = function (_a) {
    var researchId = _a.researchId, _b = _a.socketUrl, socketUrl = _b === void 0 ? 'http://localhost:5000' : _b;
    var _c = useState({}), progress = _c[0], setProgress = _c[1];
    var _d = useState([]), messages = _d[0], setMessages = _d[1];
    var _e = useState([]), questions = _e[0], setQuestions = _e[1];
    var _f = useState('pending'), overallStatus = _f[0], setOverallStatus = _f[1];
    var _g = useState(null), error = _g[0], setError = _g[1];
    useEffect(function () {
        // Connect to Socket.IO server
        var socket = io(socketUrl);
        // Listen for research agent status updates
        socket.on('research_agent_status', function (data) {
            if (data.sessionId === researchId) {
                console.log('Research status update:', data);
                // Update progress data for this agent
                if (data.progress) {
                    setProgress(function (prev) {
                        var _a;
                        return (__assign(__assign({}, prev), (_a = {}, _a[data.agentId] = data.progress, _a)));
                    });
                }
                // Update overall status
                if (data.status === 'complete' && data.agentId === 'main') {
                    setOverallStatus('completed');
                }
                else if (data.status === 'error') {
                    setOverallStatus('error');
                    setError(data.message);
                }
                else if (data.status === 'starting') {
                    setOverallStatus('in-progress');
                }
                // Add to message log
                setMessages(function (prev) { return __spreadArray(__spreadArray([], prev, true), [{
                        timestamp: data.timestamp || new Date().toISOString(),
                        message: data.message,
                        agentId: data.agentId,
                        status: data.status
                    }], false); });
                // Update questions if available
                if (data.questions) {
                    setQuestions(data.questions);
                }
                // Update completion status of questions
                if (data.agentId !== 'main' && data.agentId !== 'decomposer' &&
                    data.message && data.message.startsWith('Completed:')) {
                    var questionText_1 = data.message.replace('Completed: ', '');
                    setQuestions(function (prev) { return prev.map(function (q) {
                        return q.question === questionText_1 ? __assign(__assign({}, q), { completed: true }) : q;
                    }); });
                }
            }
        });
        // Listen for research status updates (from routes)
        socket.on('research_status_update', function (data) {
            if (data.researchId === researchId) {
                console.log('Research status update from API:', data);
                setOverallStatus(data.status);
                if (data.status === 'failed' && data.error) {
                    setError(data.error);
                }
                setMessages(function (prev) { return __spreadArray(__spreadArray([], prev, true), [{
                        timestamp: data.timestamp || new Date().toISOString(),
                        message: data.message,
                        agentId: 'api',
                        status: data.status === 'in-progress' ? 'in_progress' :
                            data.status === 'completed' ? 'complete' :
                                data.status === 'failed' ? 'error' : 'starting'
                    }], false); });
            }
        });
        // Clean up on unmount
        return function () {
            socket.disconnect();
        };
    }, [researchId, socketUrl]);
    // Calculate overall progress percentage
    var calculateOverallProgress = function () {
        if (Object.keys(progress).length === 0)
            return 0;
        // Sum of all percentages divided by number of agents
        var sum = Object.values(progress).reduce(function (acc, curr) { return acc + curr.percentage; }, 0);
        return Math.round(sum / Object.keys(progress).length);
    };
    return (<div className="research-progress">
      <h3>Research Progress</h3>
      
      {/* Overall progress */}
      <div className="overall-progress">
        <h4>Overall Progress: {overallStatus}</h4>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: "".concat(calculateOverallProgress(), "%") }}/>
          <span>{calculateOverallProgress()}%</span>
        </div>
        
        {error && (<div className="error-message">
            Error: {error}
          </div>)}
      </div>
      
      {/* Agent-specific progress */}
      <div className="agent-progress">
        <h4>Agent Progress</h4>
        {Object.entries(progress).map(function (_a) {
            var agentId = _a[0], data = _a[1];
            return (<div key={agentId} className="agent-progress-item">
            <h5>{agentId}</h5>
            <div className="progress-bar">
              <div className="progress-bar-fill" style={{ width: "".concat(data.percentage, "%") }}/>
              <span>{data.current}/{data.total} ({data.percentage}%)</span>
            </div>
          </div>);
        })}
      </div>
      
      {/* Research questions */}
      {questions.length > 0 && (<div className="research-questions">
          <h4>Research Questions</h4>
          <ul>
            {questions.map(function (question) { return (<li key={question.id} className={question.completed ? 'completed' : ''}>
                <strong>{question.category}:</strong> {question.question}
                {question.completed && <span className="check">✓</span>}
              </li>); })}
          </ul>
        </div>)}
      
      {/* Activity log */}
      <div className="research-log">
        <h4>Activity Log</h4>
        {messages.map(function (msg, i) { return (<div key={i} className={"log-entry log-".concat(msg.status)}>
            <time>{new Date(msg.timestamp).toLocaleTimeString()}</time>
            <span className="agent">{msg.agentId}</span>
            <span className="message">{msg.message}</span>
          </div>); })}
      </div>
      
      <style jsx>{"\n        .research-progress {\n          max-width: 800px;\n          margin: 0 auto;\n          padding: 20px;\n          font-family: system-ui, -apple-system, sans-serif;\n        }\n        \n        h3, h4, h5 {\n          margin-top: 0;\n          margin-bottom: 10px;\n        }\n        \n        .progress-bar {\n          height: 20px;\n          background-color: #f0f0f0;\n          border-radius: 10px;\n          margin-bottom: 15px;\n          overflow: hidden;\n          position: relative;\n        }\n        \n        .progress-bar-fill {\n          height: 100%;\n          background-color: #4caf50;\n          transition: width 0.3s ease;\n        }\n        \n        .progress-bar span {\n          position: absolute;\n          left: 50%;\n          top: 50%;\n          transform: translate(-50%, -50%);\n          color: #333;\n          font-size: 12px;\n          font-weight: bold;\n        }\n        \n        .agent-progress-item {\n          margin-bottom: 15px;\n        }\n        \n        .research-questions ul {\n          padding-left: 20px;\n        }\n        \n        .research-questions li {\n          margin-bottom: 8px;\n          transition: opacity 0.3s ease;\n        }\n        \n        .research-questions li.completed {\n          opacity: 0.7;\n        }\n        \n        .check {\n          color: #4caf50;\n          margin-left: 5px;\n        }\n        \n        .research-log {\n          margin-top: 20px;\n          max-height: 300px;\n          overflow-y: auto;\n          border: 1px solid #eee;\n          padding: 10px;\n          border-radius: 5px;\n        }\n        \n        .log-entry {\n          padding: 5px;\n          border-bottom: 1px solid #f0f0f0;\n          font-size: 14px;\n        }\n        \n        .log-entry time {\n          color: #666;\n          margin-right: 10px;\n          font-size: 12px;\n        }\n        \n        .log-entry .agent {\n          background: #e0e0e0;\n          padding: 2px 5px;\n          border-radius: 3px;\n          margin-right: 10px;\n          font-size: 12px;\n        }\n        \n        .log-entry.log-starting {\n          background-color: #e3f2fd;\n        }\n        \n        .log-entry.log-in_progress {\n          background-color: #f1f8e9;\n        }\n        \n        .log-entry.log-complete {\n          background-color: #e8f5e9;\n        }\n        \n        .log-entry.log-error {\n          background-color: #ffebee;\n        }\n        \n        .error-message {\n          color: #d32f2f;\n          background-color: #ffebee;\n          padding: 10px;\n          border-radius: 4px;\n          margin-bottom: 15px;\n        }\n      "}</style>
    </div>);
};
export default ResearchProgress;
