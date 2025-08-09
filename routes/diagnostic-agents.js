import { Agent, run } from '@openai/agents';
import express from 'express';

const router = express.Router();

// Create specialized diagnostic agents
const diagnosticInterpreterAgent = new Agent({
  name: 'diagnostic_interpreter',
  instructions: `You are an expert automotive diagnostic technician with 20+ years of experience. 
    You help technicians interpret test results, understand component readings, and make diagnostic decisions.
    
    CONTEXT AWARENESS:
    - You have full context of the vehicle information, DTC codes, and research data
    - You understand the current diagnostic step and previous step results
    - You provide practical, actionable advice based on real-world experience
    
    CAPABILITIES:
    - Interpret multimeter readings, scope traces, and component test results
    - Suggest alternative testing methods when initial approaches don't work
    - Identify patterns that indicate specific component failures
    - Recommend next steps based on test findings
    - Explain technical concepts in clear, practical terms
    
    COMMUNICATION STYLE:
    - Be concise but thorough
    - Ask clarifying questions when test results are unclear
    - Provide specific voltage/resistance ranges and specifications
    - Suggest safety precautions when needed
    - Give confidence levels for your assessments`,
});

const stepPlannerAgent = new Agent({
  name: 'step_planner',
  instructions: `You are a diagnostic workflow optimizer that adjusts diagnostic procedures based on findings.
    
    Your role is to:
    - Analyze the current step results and user findings
    - Determine if the planned next steps are still optimal
    - Suggest alternative diagnostic paths when evidence points elsewhere
    - Prioritize steps based on probability and cost-effectiveness
    - Skip unnecessary steps when findings are conclusive
    
    Consider:
    - Time efficiency and logical flow
    - Part costs and availability
    - Technician skill level and tool availability
    - Vehicle-specific known issues and patterns`,
});

const contextManagerAgent = new Agent({
  name: 'context_manager',
  instructions: `You maintain and synthesize diagnostic context across all steps.
    
    You track:
    - All previous step results and user interactions
    - Vehicle information and history
    - DTC codes and research findings
    - Test results and measurements
    - Parts replaced or eliminated
    
    You provide:
    - Complete diagnostic history summaries
    - Pattern recognition across steps
    - Contradiction detection in findings
    - Confidence assessment for diagnosis
    - Final diagnosis recommendations`,
});

// In-memory storage for diagnostic sessions (use Redis/DB in production)
const diagnosticSessions = new Map();

// Middleware to load diagnostic context
const loadDiagnosticContext = async (req, res, next) => {
  const { sessionId } = req.params;
  const session = diagnosticSessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Diagnostic session not found' });
  }
  
  req.diagnosticSession = session;
  next();
};

// Initialize a new diagnostic session
router.post('/sessions', async (req, res) => {
  try {
    const {
      dtcCode,
      vehicleInfo,
      researchData,
      diagnosticSteps,
      sessionId = `diag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    } = req.body;

    const session = {
      id: sessionId,
      dtcCode,
      vehicleInfo,
      researchData,
      diagnosticSteps,
      currentStepIndex: 0,
      stepHistory: [],
      conversationHistory: [],
      findings: {},
      confidence: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    diagnosticSessions.set(sessionId, session);

    res.json({
      success: true,
      sessionId,
      session: {
        id: session.id,
        dtcCode: session.dtcCode,
        vehicleInfo: session.vehicleInfo,
        currentStepIndex: session.currentStepIndex,
        totalSteps: session.diagnosticSteps.length,
        status: session.status
      }
    });
  } catch (error) {
    console.error('Error creating diagnostic session:', error);
    res.status(500).json({ error: 'Failed to create diagnostic session' });
  }
});

// Get current diagnostic step with context
router.get('/sessions/:sessionId/current-step', loadDiagnosticContext, async (req, res) => {
  try {
    const session = req.diagnosticSession;
    const currentStep = session.diagnosticSteps[session.currentStepIndex];
    
    if (!currentStep) {
      return res.json({
        completed: true,
        message: 'All diagnostic steps completed',
        session: {
          findings: session.findings,
          confidence: session.confidence
        }
      });
    }

    // Enhance step with context
    const enhancedStep = {
      ...currentStep,
      stepNumber: session.currentStepIndex + 1,
      totalSteps: session.diagnosticSteps.length,
      context: {
        dtcCode: session.dtcCode,
        vehicleInfo: session.vehicleInfo,
        researchData: session.researchData,
        previousFindings: session.findings,
        conversationHistory: session.conversationHistory.slice(-5) // Last 5 interactions
      }
    };

    res.json({
      success: true,
      currentStep: enhancedStep,
      session: {
        id: session.id,
        currentStepIndex: session.currentStepIndex,
        confidence: session.confidence,
        status: session.status
      }
    });
  } catch (error) {
    console.error('Error getting current step:', error);
    res.status(500).json({ error: 'Failed to get current step' });
  }
});

// Chat with diagnostic agent for current step
router.post('/sessions/:sessionId/chat', loadDiagnosticContext, async (req, res) => {
  try {
    const session = req.diagnosticSession;
    const { message, findings, testResults } = req.body;
    const currentStep = session.diagnosticSteps[session.currentStepIndex];

    if (!currentStep) {
      return res.status(400).json({ error: 'No active diagnostic step' });
    }

    // Build comprehensive context for the agent
    const diagnosticContext = {
      dtcCode: session.dtcCode,
      dtcDescription: session.researchData?.dtcCodes?.find(d => d.code === session.dtcCode)?.description,
      vehicleInfo: session.vehicleInfo,
      currentStep: {
        ...currentStep,
        stepNumber: session.currentStepIndex + 1,
        totalSteps: session.diagnosticSteps.length
      },
      researchData: session.researchData,
      previousSteps: session.stepHistory,
      currentFindings: session.findings,
      userMessage: message,
      testResults,
      findings,
      conversationHistory: session.conversationHistory.slice(-10)
    };

    // Prepare the agent input with full context
    const agentInput = `
DIAGNOSTIC CONTEXT:
- Vehicle: ${session.vehicleInfo.year} ${session.vehicleInfo.make} ${session.vehicleInfo.model}
- DTC Code: ${session.dtcCode} (${diagnosticContext.dtcDescription || 'Unknown'})
- Current Step: ${currentStep.title} (${session.currentStepIndex + 1}/${session.diagnosticSteps.length})
- Step Description: ${currentStep.description}

RESEARCH DATA:
${session.researchData?.possibleCauses ? 
  `Possible Causes: ${session.researchData.possibleCauses.map(c => `${c.cause} (${c.likelihood})`).join(', ')}` : ''}
${session.researchData?.technicalNotes?.commonIssues ? 
  `Common Issues: ${session.researchData.technicalNotes.commonIssues.join(', ')}` : ''}

PREVIOUS FINDINGS:
${Object.entries(session.findings).map(([step, result]) => `${step}: ${result}`).join('\n')}

CONVERSATION HISTORY:
${session.conversationHistory.slice(-5).map(h => `${h.role}: ${h.message}`).join('\n')}

USER MESSAGE: ${message}

${testResults ? `TEST RESULTS: ${JSON.stringify(testResults, null, 2)}` : ''}
${findings ? `NEW FINDINGS: ${JSON.stringify(findings, null, 2)}` : ''}

Please respond as an expert diagnostic technician helping to interpret these results and guide the next actions.
`;

    // Get response from diagnostic interpreter agent
    const agentResult = await run(diagnosticInterpreterAgent, agentInput);
    const agentResponse = agentResult.output;

    // Update conversation history
    session.conversationHistory.push(
      { role: 'user', message, timestamp: new Date().toISOString(), step: session.currentStepIndex },
      { role: 'agent', message: agentResponse, timestamp: new Date().toISOString(), step: session.currentStepIndex }
    );

    // Update findings if provided
    if (findings) {
      session.findings[`step_${session.currentStepIndex + 1}`] = findings;
    }

    session.updatedAt = new Date().toISOString();

    res.json({
      success: true,
      response: agentResponse,
      context: {
        stepNumber: session.currentStepIndex + 1,
        totalSteps: session.diagnosticSteps.length,
        currentFindings: session.findings
      }
    });

  } catch (error) {
    console.error('Error in diagnostic chat:', error);
    res.status(500).json({ error: 'Failed to process diagnostic chat' });
  }
});

// Update step with findings and get next step recommendation
router.post('/sessions/:sessionId/complete-step', loadDiagnosticContext, async (req, res) => {
  try {
    const session = req.diagnosticSession;
    const { findings, testResults, notes, confidence } = req.body;
    const currentStep = session.diagnosticSteps[session.currentStepIndex];

    // Record step completion
    const stepResult = {
      stepIndex: session.currentStepIndex,
      stepId: currentStep.id,
      title: currentStep.title,
      findings,
      testResults,
      notes,
      confidence,
      completedAt: new Date().toISOString()
    };

    session.stepHistory.push(stepResult);
    session.findings[`step_${session.currentStepIndex + 1}`] = findings;

    // Use step planner agent to determine next actions
    const plannerContext = `
DIAGNOSTIC SESSION SUMMARY:
- Vehicle: ${session.vehicleInfo.year} ${session.vehicleInfo.make} ${session.vehicleInfo.model}
- DTC: ${session.dtcCode}
- Completed Step: ${currentStep.title}
- Findings: ${findings}
- Test Results: ${JSON.stringify(testResults)}
- Overall Confidence: ${confidence}%

ALL FINDINGS SO FAR:
${session.stepHistory.map(s => `${s.title}: ${s.findings} (Confidence: ${s.confidence}%)`).join('\n')}

REMAINING STEPS:
${session.diagnosticSteps.slice(session.currentStepIndex + 1).map((s, i) => `${i + 1}. ${s.title}: ${s.description}`).join('\n')}

Based on these findings, should we:
1. Continue with the next planned step?
2. Skip some steps as no longer needed?
3. Add additional diagnostic steps?
4. Conclude the diagnosis?

Provide specific recommendations and reasoning.
`;

    const plannerResult = await run(stepPlannerAgent, plannerContext);
    const nextStepRecommendation = plannerResult.output;

    // Move to next step
    session.currentStepIndex++;
    session.updatedAt = new Date().toISOString();

    // Check if diagnosis is complete
    const isComplete = session.currentStepIndex >= session.diagnosticSteps.length;
    
    let response = {
      success: true,
      stepCompleted: true,
      nextStepRecommendation,
      currentStep: session.currentStepIndex,
      totalSteps: session.diagnosticSteps.length,
      isComplete
    };

    if (isComplete) {
      // Generate final diagnosis summary
      const finalContext = `
COMPLETE DIAGNOSTIC SESSION:
- Vehicle: ${session.vehicleInfo.year} ${session.vehicleInfo.make} ${session.vehicleInfo.model}
- DTC: ${session.dtcCode}

ALL COMPLETED STEPS:
${session.stepHistory.map(s => `${s.title}: ${s.findings} (Confidence: ${s.confidence}%)`).join('\n')}

CONVERSATION HISTORY:
${session.conversationHistory.map(h => `${h.role}: ${h.message}`).join('\n')}

Please provide:
1. Final diagnosis with confidence level
2. Recommended repair actions
3. Parts likely needed
4. Estimated repair time and difficulty
5. Any follow-up testing needed
`;

      const finalResult = await run(contextManagerAgent, finalContext);
      response.finalDiagnosis = finalResult.output;
      session.status = 'completed';
      session.completedAt = new Date().toISOString();
    } else {
      // Get next step details
      const nextStep = session.diagnosticSteps[session.currentStepIndex];
      response.nextStep = {
        ...nextStep,
        stepNumber: session.currentStepIndex + 1,
        context: {
          dtcCode: session.dtcCode,
          vehicleInfo: session.vehicleInfo,
          previousFindings: session.findings
        }
      };
    }

    res.json(response);

  } catch (error) {
    console.error('Error completing diagnostic step:', error);
    res.status(500).json({ error: 'Failed to complete diagnostic step' });
  }
});

// Get diagnostic session summary
router.get('/sessions/:sessionId/summary', loadDiagnosticContext, async (req, res) => {
  try {
    const session = req.diagnosticSession;

    const summary = {
      sessionId: session.id,
      dtcCode: session.dtcCode,
      vehicleInfo: session.vehicleInfo,
      status: session.status,
      progress: {
        currentStep: session.currentStepIndex,
        totalSteps: session.diagnosticSteps.length,
        completedSteps: session.stepHistory.length,
        percentage: Math.round((session.stepHistory.length / session.diagnosticSteps.length) * 100)
      },
      findings: session.findings,
      conversationHistory: session.conversationHistory,
      stepHistory: session.stepHistory,
      timestamps: {
        created: session.createdAt,
        updated: session.updatedAt,
        completed: session.completedAt
      }
    };

    res.json({ success: true, summary });
  } catch (error) {
    console.error('Error getting session summary:', error);
    res.status(500).json({ error: 'Failed to get session summary' });
  }
});

// Reset or restart diagnostic session
router.post('/sessions/:sessionId/reset', loadDiagnosticContext, async (req, res) => {
  try {
    const session = req.diagnosticSession;
    const { resetToStep = 0 } = req.body;

    session.currentStepIndex = resetToStep;
    session.stepHistory = session.stepHistory.slice(0, resetToStep);
    session.conversationHistory = session.conversationHistory.filter(h => h.step < resetToStep);
    session.findings = Object.fromEntries(
      Object.entries(session.findings).filter(([key]) => {
        const stepNum = parseInt(key.split('_')[1]);
        return stepNum <= resetToStep;
      })
    );
    session.status = 'active';
    session.updatedAt = new Date().toISOString();

    res.json({
      success: true,
      message: `Session reset to step ${resetToStep + 1}`,
      currentStep: session.currentStepIndex,
      totalSteps: session.diagnosticSteps.length
    });
  } catch (error) {
    console.error('Error resetting session:', error);
    res.status(500).json({ error: 'Failed to reset session' });
  }
});

export default router;