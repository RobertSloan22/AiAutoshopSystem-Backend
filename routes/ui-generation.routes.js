import express from 'express';
import OpenAI from 'openai';
// Import your authentication middleware
// import protectRoute from '../middleware/protectRoute.js';

const router = express.Router();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Structured Outputs Tool Definition for Automotive UI Generation
const generateAutomotiveUITool = {
  name: 'generate_automotive_ui',
  description: 'Generate automotive diagnostic UI components with structured data for vehicle health monitoring, OBD2 data visualization, and diagnostic analysis.',
  parameters: {
    type: 'object',
    properties: {
      component: {
        anyOf: [
          { $ref: '#/$defs/vehicle_health_dashboard' },
          { $ref: '#/$defs/obd2_multi_chart' },
          { $ref: '#/$defs/diagnostic_timeline' },
          { $ref: '#/$defs/dtc_analysis_card' },
          { $ref: '#/$defs/live_data_monitor' },
          { $ref: '#/$defs/vehicle_info_card' }
        ]
      }
    },
    required: ['component'],
    additionalProperties: false,
    $defs: {
      vehicle_health_dashboard: {
        type: 'object',
        properties: {
          name: { type: 'string', enum: ['vehicle_health_dashboard'] },
          title: { type: 'string', description: 'Title for the vehicle health dashboard' },
          overall_score: {
            type: 'number',
            minimum: 0,
            maximum: 100,
            description: 'Overall vehicle health score (0-100)'
          },
          current_data: {
            type: 'object',
            properties: {
              rpm: { type: 'number' },
              speed: { type: 'number' },
              engineTemp: { type: 'number' },
              throttlePosition: { type: 'number' },
              engineLoad: { type: 'number' },
              batteryVoltage: { type: 'number' },
              timestamp: { type: 'string' }
            },
            required: ['rpm', 'speed', 'engineTemp', 'throttlePosition', 'engineLoad', 'batteryVoltage', 'timestamp'],
            additionalProperties: false
          },
          dtc_codes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                description: { type: 'string' },
                severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
                system: { type: 'string', enum: ['engine', 'transmission', 'abs', 'airbag', 'emissions', 'other'] }
              },
              required: ['code', 'description', 'severity', 'system'],
              additionalProperties: false
            }
          },
          recommendations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                priority: { type: 'string', enum: ['immediate', 'soon', 'routine', 'monitor'] },
                action: { type: 'string' },
                estimated_cost: { type: 'string' },
                risk_level: { type: 'string', enum: ['low', 'medium', 'high'] }
              },
              required: ['priority', 'action', 'estimated_cost', 'risk_level'],
              additionalProperties: false
            }
          },
          connection_status: {
            type: 'string',
            enum: ['connected', 'disconnected', 'error', 'scanning']
          }
        },
        required: ['name', 'title', 'overall_score', 'current_data', 'dtc_codes', 'recommendations', 'connection_status'],
        additionalProperties: false
      },
      obd2_multi_chart: {
        type: 'object',
        properties: {
          name: { type: 'string', enum: ['obd2_multi_chart'] },
          title: { type: 'string' },
          parameters: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['rpm', 'speed', 'engineTemp', 'throttlePosition', 'engineLoad', 'batteryVoltage', 'fuelPressure', 'intakeTemp', 'maf', 'o2sensor']
            }
          },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                timestamp: { type: 'string' },
                rpm: { type: 'number' },
                speed: { type: 'number' },
                engineTemp: { type: 'number' },
                throttlePosition: { type: 'number' },
                engineLoad: { type: 'number' },
                batteryVoltage: { type: 'number' },
                fuelPressure: { type: 'number' },
                intakeTemp: { type: 'number' },
                maf: { type: 'number' },
                o2sensor: { type: 'number' }
              },
              required: ['timestamp', 'rpm', 'speed', 'engineTemp', 'throttlePosition', 'engineLoad', 'batteryVoltage', 'fuelPressure', 'intakeTemp', 'maf', 'o2sensor'],
              additionalProperties: false
            }
          },
          show_expected_ranges: { type: 'boolean' },
          scenario: {
            type: 'string',
            enum: ['idle', 'city_driving', 'highway', 'acceleration', 'deceleration', 'mixed', 'diagnostic']
          },
          time_range_minutes: { type: 'number' }
        },
        required: ['name', 'title', 'parameters', 'data', 'show_expected_ranges', 'scenario', 'time_range_minutes'],
        additionalProperties: false
      },
      diagnostic_timeline: {
        type: 'object',
        properties: {
          name: { type: 'string', enum: ['diagnostic_timeline'] },
          title: { type: 'string' },
          events: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                timestamp: { type: 'string' },
                event_type: {
                  type: 'string',
                  enum: ['connection', 'scan', 'dtc_found', 'dtc_cleared', 'data_reading', 'alert', 'repair', 'test']
                },
                description: { type: 'string' },
                severity: { type: 'string', enum: ['info', 'warning', 'error', 'success'] },
                system_affected: {
                  type: 'string',
                  enum: ['engine', 'transmission', 'abs', 'airbag', 'emissions', 'electrical', 'other']
                },
                data: {
                  type: 'object',
                  properties: {
                    dtc_codes: { type: 'array', items: { type: 'string' } },
                    parameter_values: { 
                      type: 'object',
                      properties: {
                        rpm: { type: 'number' },
                        speed: { type: 'number' },
                        engineTemp: { type: 'number' },
                        throttlePosition: { type: 'number' },
                        engineLoad: { type: 'number' },
                        batteryVoltage: { type: 'number' },
                        fuelPressure: { type: 'number' },
                        intakeTemp: { type: 'number' },
                        maf: { type: 'number' },
                        o2sensor: { type: 'number' }
                      },
                      required: ['rpm', 'speed', 'engineTemp', 'throttlePosition', 'engineLoad', 'batteryVoltage', 'fuelPressure', 'intakeTemp', 'maf', 'o2sensor'],
                      additionalProperties: false
                    },
                    repair_cost: { type: 'string' }
                  },
                  required: ['dtc_codes', 'parameter_values', 'repair_cost'],
                  additionalProperties: false
                }
              },
              required: ['timestamp', 'event_type', 'description', 'severity', 'system_affected', 'data'],
              additionalProperties: false
            }
          },
          show_timeline_filters: { type: 'boolean' }
        },
        required: ['name', 'title', 'events', 'show_timeline_filters'],
        additionalProperties: false
      },
      dtc_analysis_card: {
        type: 'object',
        properties: {
          name: { type: 'string', enum: ['dtc_analysis_card'] },
          dtc_code: { type: 'string' },
          description: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          system: { type: 'string', enum: ['engine', 'transmission', 'abs', 'airbag', 'emissions', 'electrical', 'other'] },
          possible_causes: { type: 'array', items: { type: 'string' } },
          diagnostic_steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                step_number: { type: 'number' },
                description: { type: 'string' },
                tools_needed: { type: 'array', items: { type: 'string' } },
                estimated_time: { type: 'string' }
              },
              required: ['step_number', 'description', 'tools_needed', 'estimated_time'],
              additionalProperties: false
            }
          },
          repair_options: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                option: { type: 'string' },
                estimated_cost: { type: 'string' },
                difficulty: { type: 'string', enum: ['easy', 'moderate', 'difficult', 'professional'] },
                estimated_time: { type: 'string' }
              },
              required: ['option', 'estimated_cost', 'difficulty', 'estimated_time'],
              additionalProperties: false
            }
          }
        },
        required: ['name', 'dtc_code', 'description', 'severity', 'system', 'possible_causes', 'diagnostic_steps', 'repair_options'],
        additionalProperties: false
      },
      live_data_monitor: {
        type: 'object',
        properties: {
          name: { type: 'string', enum: ['live_data_monitor'] },
          title: { type: 'string' },
          parameters: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  enum: ['rpm', 'speed', 'engineTemp', 'throttlePosition', 'engineLoad', 'batteryVoltage', 'fuelPressure', 'intakeTemp', 'maf', 'o2sensor']
                },
                current_value: { type: 'number' },
                unit: { type: 'string' },
                normal_range: {
                  type: 'object',
                  properties: {
                    min: { type: 'number' },
                    max: { type: 'number' }
                  },
                  required: ['min', 'max'],
                  additionalProperties: false
                },
                status: { type: 'string', enum: ['normal', 'warning', 'critical', 'unknown'] }
              },
              required: ['name', 'current_value', 'unit', 'normal_range', 'status'],
              additionalProperties: false
            }
          },
          update_frequency: { type: 'number' },
          alert_thresholds: { type: 'boolean' }
        },
        required: ['name', 'title', 'parameters', 'update_frequency', 'alert_thresholds'],
        additionalProperties: false
      },
      vehicle_info_card: {
        type: 'object',
        properties: {
          name: { type: 'string', enum: ['vehicle_info_card'] },
          title: { type: 'string' },
          vehicle_details: {
            type: 'object',
            properties: {
              year: { type: 'number' },
              make: { type: 'string' },
              model: { type: 'string' },
              vin: { type: 'string' },
              engine: { type: 'string' },
              mileage: { type: 'number' }
            },
            required: ['year', 'make', 'model', 'vin', 'engine', 'mileage'],
            additionalProperties: false
          },
          obd2_info: {
            type: 'object',
            properties: {
              protocol: { type: 'string' },
              supported_pids: { type: 'array', items: { type: 'string' } },
              connection_type: { type: 'string', enum: ['bluetooth', 'wifi', 'usb', 'unknown'] }
            },
            required: ['protocol', 'supported_pids', 'connection_type'],
            additionalProperties: false
          },
          last_scan_results: {
            type: 'object',
            properties: {
              scan_date: { type: 'string' },
              dtc_count: { type: 'number' },
              readiness_status: {
                type: 'object',
                properties: {
                  monitors_ready: { type: 'number' },
                  monitors_total: { type: 'number' }
                },
                required: ['monitors_ready', 'monitors_total'],
                additionalProperties: false
              }
            },
            required: ['scan_date', 'dtc_count', 'readiness_status'],
            additionalProperties: false
          }
        },
        required: ['name', 'title', 'vehicle_details', 'obd2_info', 'last_scan_results'],
        additionalProperties: false
      }
    }
  },
  strict: true
};

const SYSTEM_PROMPT = `You are an expert automotive diagnostic AI that generates structured UI components for vehicle diagnostics and OBD2 data visualization.

Your role is to:
1. Analyze user requests for automotive diagnostic information
2. Generate appropriate UI components based on the context and data available
3. Provide educational and actionable insights for vehicle maintenance
4. Adapt complexity level based on user expertise (novice, diy_enthusiast, technician, expert)

Guidelines:
- Always generate realistic and helpful automotive data
- Use proper automotive terminology and standards
- Consider safety implications in recommendations
- Provide clear explanations for diagnostic codes and procedures
- Generate sample data when real data is not available
- Focus on actionable insights and clear visual representation

Available UI Components:
- vehicle_health_dashboard: Overall vehicle health with scores, current data, DTCs, and recommendations
- obd2_multi_chart: Multi-parameter time-series charts for OBD2 data visualization
- diagnostic_timeline: Timeline of diagnostic events and activities
- dtc_analysis_card: Detailed analysis of specific diagnostic trouble codes
- live_data_monitor: Real-time monitoring of vehicle parameters with status indicators
- vehicle_info_card: Vehicle identification and connection information display

Always provide structured, accurate, and helpful automotive diagnostic information.`;

// POST /api/ui/generate - Generate Automotive UI with Structured Outputs
router.post('/generate', /* protectRoute, */ async (req, res) => {
  const { user_input } = req.body;

  if (!user_input) {
    return res.status(400).json({ error: 'user_input is required' });
  }

  try {
    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    const messages = [
      {
        role: 'system',
        content: SYSTEM_PROMPT
      },
      {
        role: 'user',
        content: user_input
      }
    ];

    // Create OpenAI streaming completion with structured outputs
    const stream = await openai.beta.chat.completions.stream({
      model: 'gpt-4o-2024-08-06', // Model that supports structured outputs
      messages,
      temperature: 0.1,
      tools: [{
        type: 'function',
        function: generateAutomotiveUITool
      }],
      // Force the model to use the structured output tool
      tool_choice: {
        type: 'function',
        function: { name: 'generate_automotive_ui' }
      },
      parallel_tool_calls: false
    });

    let functionArguments = '';
    let callId = '';
    let functionName = '';
    let isCollectingFunctionArgs = false;

    for await (const part of stream) {
      const delta = part.choices[0].delta;
      const finishReason = part.choices[0].finish_reason;

      if (delta.content) {
        res.write(`data: ${JSON.stringify({
          event: 'assistant_delta',
          data: delta
        })}\n\n`);
      }

      if (delta.tool_calls) {
        isCollectingFunctionArgs = true;
        if (delta.tool_calls[0].id) {
          callId = delta.tool_calls[0].id;
        }
        if (delta.tool_calls[0].function?.name) {
          functionName = delta.tool_calls[0].function.name;
        }
        functionArguments += delta.tool_calls[0].function?.arguments || '';

        res.write(`data: ${JSON.stringify({
          event: 'function_arguments_delta',
          data: {
            callId: callId,
            name: functionName,
            arguments: delta.tool_calls[0].function?.arguments
          }
        })}\n\n`);
      }

      // Handle completion of tool call
      if (finishReason === 'tool_calls' && isCollectingFunctionArgs) {
        console.log(`Structured output ${functionName} generation complete`);
        
        try {
          // Parse the structured output
          const structuredOutput = JSON.parse(functionArguments);
          
          // Send the complete structured output
          res.write(`data: ${JSON.stringify({
            event: 'function_arguments_done',
            data: {
              callId: callId,
              name: functionName,
              arguments: functionArguments,
              structuredOutput: structuredOutput
            }
          })}\n\n`);
        } catch (parseError) {
          console.error('Error parsing structured output:', parseError);
          res.write(`data: ${JSON.stringify({
            event: 'error',
            data: { message: 'Failed to parse structured output' }
          })}\n\n`);
        }

        // Reset for potential additional calls
        functionArguments = '';
        functionName = '';
        isCollectingFunctionArgs = false;
      }
    }

    res.write(`data: ${JSON.stringify({ event: 'done' })}\n\n`);
    res.end();

  } catch (error) {
    console.error('Error in automotive UI generation:', error);
    res.write(`data: ${JSON.stringify({
      event: 'error',
      data: { 
        message: error.message,
        type: 'generation_error'
      }
    })}\n\n`);
    res.end();
  }
});

// GET /api/ui/components - Get available automotive UI components
router.get('/components', /* protectRoute, */ async (req, res) => {
  try {
    const components = [
      {
        id: 'vehicle_health_dashboard',
        name: 'Vehicle Health Dashboard',
        description: 'Comprehensive dashboard showing overall vehicle health, current data, DTCs, and maintenance recommendations',
        category: 'overview'
      },
      {
        id: 'obd2_multi_chart',
        name: 'OBD2 Multi-Parameter Chart',
        description: 'Time-series visualization of multiple OBD2 parameters with expected ranges',
        category: 'data_visualization'
      },
      {
        id: 'diagnostic_timeline',
        name: 'Diagnostic Timeline',
        description: 'Timeline of diagnostic events, scans, and maintenance activities',
        category: 'history'
      },
      {
        id: 'dtc_analysis_card',
        name: 'DTC Analysis Card',
        description: 'Detailed analysis of diagnostic trouble codes with repair guidance',
        category: 'diagnostics'
      },
      {
        id: 'live_data_monitor',
        name: 'Live Data Monitor',
        description: 'Real-time monitoring of vehicle parameters with status indicators',
        category: 'monitoring'
      },
      {
        id: 'vehicle_info_card',
        name: 'Vehicle Information Card',
        description: 'Vehicle details, OBD2 connection info, and scan results',
        category: 'information'
      }
    ];

    res.json({ components });
  } catch (error) {
    console.error('Error fetching components:', error);
    res.status(500).json({ error: 'Failed to fetch components' });
  }
});

// POST /api/ui/validate - Validate structured output component data
router.post('/validate', /* protectRoute, */ async (req, res) => {
  const { component_data } = req.body;

  if (!component_data || !component_data.name) {
    return res.status(400).json({ 
      error: 'component_data with name field is required',
      valid: false 
    });
  }

  try {
    // Basic validation - in production, use a proper JSON schema validator
    const validComponentNames = [
      'vehicle_health_dashboard',
      'obd2_multi_chart', 
      'diagnostic_timeline',
      'dtc_analysis_card',
      'live_data_monitor',
      'vehicle_info_card'
    ];

    const isValid = validComponentNames.includes(component_data.name);

    res.json({
      valid: isValid,
      component_name: component_data.name,
      message: isValid 
        ? 'Component data is valid' 
        : `Invalid component name: ${component_data.name}`
    });

  } catch (error) {
    console.error('Error validating component:', error);
    res.status(500).json({ 
      error: 'Failed to validate component',
      valid: false 
    });
  }
});


export default router;