// services/realtimeDiagnosticAgent.js - Real-time AI diagnostic agent for OBD2 streaming data

import ResponsesAPIService from './responsesService.js';
import obd2RealtimeService from './OBD2RealtimeService.js';
import { DiagnosticCalculations } from './diagnosticCalculations.js';
import { EventEmitter } from 'events';

class RealtimeDiagnosticAgent extends EventEmitter {
    constructor() {
        super();
        this.responsesService = new ResponsesAPIService();
        this.activeAnalysis = new Map(); // sessionId -> analysis state
        this.analysisInterval = 60000; // 1 minute
        this.isEnabled = false; // DISABLED: Not currently needed
        this.diagnosticPrompts = this.buildDiagnosticPrompts();

        console.log('🤖 Real-time Diagnostic Agent initialized (DISABLED)');
    }

    // Start monitoring a session for real-time diagnostic analysis
    async startMonitoring(sessionId, vehicleContext = {}, options = {}) {
        if (this.activeAnalysis.has(sessionId)) {
            console.log(`⚠️ Already monitoring session: ${sessionId}`);
            return;
        }

        console.log(`🔍 Starting real-time diagnostic monitoring for session: ${sessionId}`);

        const analysisState = {
            sessionId,
            vehicleContext,
            startTime: Date.now(),
            lastAnalysisTime: Date.now(),
            dataBuffer: [],
            diagnosticHistory: [],
            intervalId: null,
            options: {
                analysisInterval: options.analysisInterval || this.analysisInterval,
                minDataPoints: options.minDataPoints || 10,
                enablePredictive: options.enablePredictive !== false,
                ...options
            }
        };

        // Start periodic analysis
        analysisState.intervalId = setInterval(
            () => this.performPeriodicAnalysis(sessionId),
            analysisState.options.analysisInterval
        );

        this.activeAnalysis.set(sessionId, analysisState);

        // Emit monitoring started event
        this.emit('monitoringStarted', { sessionId, vehicleContext });
    }

    // Stop monitoring a session
    async stopMonitoring(sessionId) {
        const analysisState = this.activeAnalysis.get(sessionId);
        if (!analysisState) return;

        if (analysisState.intervalId) {
            clearInterval(analysisState.intervalId);
        }

        this.activeAnalysis.delete(sessionId);
        console.log(`🛑 Stopped monitoring session: ${sessionId}`);
        
        this.emit('monitoringStopped', { sessionId });
    }

    // Perform periodic diagnostic analysis
    async performPeriodicAnalysis(sessionId) {
        const analysisState = this.activeAnalysis.get(sessionId);
        if (!analysisState || !this.isEnabled) return;

        try {
            console.log(`🔬 Performing diagnostic analysis for session: ${sessionId}`);
            
            // Get recent data from Redis
            const recentData = await obd2RealtimeService.getRecentUpdates(
                sessionId, 
                analysisState.lastAnalysisTime,
                100  // Last 100 data points
            );

            if (recentData.length < analysisState.options.minDataPoints) {
                console.log(`⏳ Insufficient data points (${recentData.length}) for analysis`);
                return;
            }

            // Prepare diagnostic analysis prompt
            const analysisPrompt = this.buildAnalysisPrompt(recentData, analysisState);

            // Calculate diagnostic probabilities using both AI and mathematical models
            let diagnosticProbabilities = {};

            // DISABLED: AI analysis to save API credits
            // Only use mathematical calculations instead
            // First, try AI analysis
            // const aiResponse = await this.getAIAnalysis(analysisPrompt, analysisState.vehicleContext, sessionId);
            // if (aiResponse) {
            //     diagnosticProbabilities = this.parseDiagnosticResponse(aiResponse);
            // }

            // Generate mathematical model calculations as backup/validation
            const dataStats = this.calculateDataStatistics(recentData);
            const calculatedProbabilities = DiagnosticCalculations.calculateAllDiagnostics(dataStats);

            // Merge AI and calculated probabilities (prefer AI if available, fall back to calculations)
            const finalProbabilities = { ...calculatedProbabilities };
            Object.keys(diagnosticProbabilities).forEach(key => {
                if (diagnosticProbabilities[key] !== undefined && diagnosticProbabilities[key] !== null) {
                    // Blend AI and calculated results (weighted average: 70% AI, 30% calculated)
                    if (calculatedProbabilities[key] !== undefined) {
                        finalProbabilities[key] = Math.round(
                            (diagnosticProbabilities[key] * 0.7) + (calculatedProbabilities[key] * 0.3)
                        );
                    } else {
                        finalProbabilities[key] = diagnosticProbabilities[key];
                    }
                }
            });

            // Update analysis state
            analysisState.lastAnalysisTime = Date.now();
            analysisState.diagnosticHistory.push({
                timestamp: Date.now(),
                dataPointsAnalyzed: recentData.length,
                diagnostics: finalProbabilities,
                aiAnalysis: Object.keys(diagnosticProbabilities).length > 0,
                calculatedAnalysis: true
            });

            // Keep only last 10 diagnostic history entries
            if (analysisState.diagnosticHistory.length > 10) {
                analysisState.diagnosticHistory = analysisState.diagnosticHistory.slice(-10);
            }

            // Emit diagnostic update
            this.emit('diagnosticUpdate', {
                sessionId,
                timestamp: Date.now(),
                diagnostics: finalProbabilities,
                dataPointsAnalyzed: recentData.length,
                vehicleContext: analysisState.vehicleContext,
                analysisMethod: Object.keys(diagnosticProbabilities).length > 0 ? 'hybrid' : 'calculated'
            });

            console.log(`✅ Diagnostic analysis completed for session: ${sessionId}`, finalProbabilities);

        } catch (error) {
            console.error(`❌ Diagnostic analysis failed for session ${sessionId}:`, error);
            this.emit('analysisError', { sessionId, error: error.message });
        }
    }

    // Build analysis prompt for AI
    buildAnalysisPrompt(recentData, analysisState) {
        const dataStats = this.calculateDataStatistics(recentData);
        
        return `You are a professional automotive diagnostic AI analyzing real-time OBD2 data stream. 

VEHICLE CONTEXT:
- Make/Model: ${analysisState.vehicleContext.make || 'Unknown'} ${analysisState.vehicleContext.model || 'Unknown'}
- Year: ${analysisState.vehicleContext.year || 'Unknown'}

CURRENT DATA ANALYSIS (Last ${recentData.length} data points over ${Math.round((Date.now() - analysisState.lastAnalysisTime) / 1000)} seconds):

ENGINE PARAMETERS:
- RPM: Min ${dataStats.rpm.min}, Max ${dataStats.rpm.max}, Avg ${dataStats.rpm.avg}
- Speed: Min ${dataStats.speed.min}, Max ${dataStats.speed.max}, Avg ${dataStats.speed.avg} mph
- Engine Temp: Min ${dataStats.engineTemp.min}, Max ${dataStats.engineTemp.max}, Avg ${dataStats.engineTemp.avg}°F
- Throttle Position: Min ${dataStats.throttlePosition.min}, Max ${dataStats.throttlePosition.max}, Avg ${dataStats.throttlePosition.avg}%
- Engine Load: Min ${dataStats.engineLoad.min}, Max ${dataStats.engineLoad.max}, Avg ${dataStats.engineLoad.avg}%

FUEL SYSTEM:
- Fuel Trim Short B1: Min ${dataStats.fuelTrimShortB1.min}, Max ${dataStats.fuelTrimShortB1.max}, Avg ${dataStats.fuelTrimShortB1.avg}%
- Fuel Trim Long B1: Min ${dataStats.fuelTrimLongB1.min}, Max ${dataStats.fuelTrimLongB1.max}, Avg ${dataStats.fuelTrimLongB1.avg}%

ANALYSIS HISTORY:
${analysisState.diagnosticHistory.length > 0 ? 
    analysisState.diagnosticHistory.slice(-3).map(h => 
        `- ${new Date(h.timestamp).toLocaleTimeString()}: ${Object.keys(h.diagnostics).map(k => `${k}:${h.diagnostics[k]}%`).join(', ')}`
    ).join('\n') : 
    '- No previous analysis'
}

Based on this real-time data and professional automotive diagnostic patterns, provide diagnostic probabilities as percentages for common issues. Return ONLY a JSON response in this exact format:

{
  "vacuum_leak": number,
  "fuel_mixture_rich": number,
  "fuel_mixture_lean": number,
  "egr_valve_issue": number,
  "mass_air_flow_sensor": number,
  "oxygen_sensor_b1s1": number,
  "oxygen_sensor_b1s2": number,
  "catalytic_converter": number,
  "fuel_injector_issue": number,
  "intake_manifold_issue": number,
  "pcv_valve_issue": number,
  "fuel_pump_weak": number,
  "carbon_buildup": number,
  "timing_issue": number,
  "overall_engine_health": number
}

Each probability should be 0-100 representing likelihood percentage. Focus on patterns in fuel trims, oxygen sensor data, load vs RPM relationships, and temperature trends.`;
    }

    // Get AI analysis using ResponsesAPIService
    async getAIAnalysis(prompt, vehicleContext, sessionId) {
        try {
            // Create a simple text response for diagnostic analysis
            const response = await this.responsesService.createTextFallbackResponse(
                prompt,
                vehicleContext,
                {}
            );

            return response;
        } catch (error) {
            console.error('AI analysis failed:', error);
            return null;
        }
    }

    // Parse diagnostic response from AI
    parseDiagnosticResponse(response) {
        try {
            // Extract JSON from response if it's wrapped in text
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const diagnostics = JSON.parse(jsonMatch[0]);
                
                // Validate and clean the response
                const validatedDiagnostics = {};
                for (const [key, value] of Object.entries(diagnostics)) {
                    if (typeof value === 'number' && value >= 0 && value <= 100) {
                        validatedDiagnostics[key] = Math.round(value);
                    }
                }
                
                return validatedDiagnostics;
            }
            
            console.warn('No valid JSON found in AI response');
            return {};
        } catch (error) {
            console.error('Failed to parse diagnostic response:', error);
            return {};
        }
    }

    // Calculate statistics from data points
    calculateDataStatistics(dataPoints) {
        const stats = {};
        const fields = ['rpm', 'speed', 'engineTemp', 'throttlePosition', 'engineLoad', 
                       'fuelTrimShortB1', 'fuelTrimLongB1'];

        fields.forEach(field => {
            const values = dataPoints
                .map(dp => dp[field])
                .filter(val => val !== null && val !== undefined && !isNaN(val));
            
            if (values.length > 0) {
                stats[field] = {
                    min: Math.min(...values).toFixed(1),
                    max: Math.max(...values).toFixed(1),
                    avg: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)
                };
            } else {
                stats[field] = { min: 'N/A', max: 'N/A', avg: 'N/A' };
            }
        });

        return stats;
    }

    // Build diagnostic prompt templates
    buildDiagnosticPrompts() {
        return {
            vacuum_leak: "High fuel trims (>8%), erratic idle, lean conditions",
            fuel_mixture_rich: "Negative fuel trims (<-5%), high load readings, rich conditions", 
            fuel_mixture_lean: "High positive fuel trims (>8%), lean oxygen sensor readings",
            egr_valve_issue: "High NOx levels, rough idle, fuel trim issues at idle",
            mass_air_flow_sensor: "Incorrect load calculations, fuel trim issues across RPM range",
            oxygen_sensor_b1s1: "Slow O2 sensor response, fuel trim corrections",
            catalytic_converter: "Secondary O2 sensor not switching, efficiency codes",
            fuel_injector_issue: "Cylinder-specific fuel trim issues, rough idle",
            timing_issue: "Load vs RPM mismatches, power loss, knock sensor activity"
        };
    }

    // Get current monitoring status
    getMonitoringStatus() {
        const activeSessions = Array.from(this.activeAnalysis.keys());
        return {
            isEnabled: this.isEnabled,
            activeSessions: activeSessions.length,
            sessions: activeSessions
        };
    }

    // Enable/disable the diagnostic agent
    setEnabled(enabled) {
        this.isEnabled = enabled;
        console.log(`🤖 Diagnostic Agent ${enabled ? 'enabled' : 'disabled'}`);
    }

    // Get diagnostic history for a session
    getDiagnosticHistory(sessionId) {
        const analysisState = this.activeAnalysis.get(sessionId);
        return analysisState ? analysisState.diagnosticHistory : [];
    }

    // Cleanup - stop all monitoring
    async shutdown() {
        console.log('🔄 Shutting down Real-time Diagnostic Agent...');
        
        for (const sessionId of this.activeAnalysis.keys()) {
            await this.stopMonitoring(sessionId);
        }
        
        console.log('✅ Real-time Diagnostic Agent shut down');
    }
}

// Create singleton instance
const realtimeDiagnosticAgent = new RealtimeDiagnosticAgent();

export default realtimeDiagnosticAgent;