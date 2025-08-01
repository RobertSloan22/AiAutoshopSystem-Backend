// Example configuration for enabling mathematical plotting in responses API
// This shows how to configure the code_interpreter tool for oxygen sensor data visualization

export const oxygenSensorPlottingTools = [
  {
    type: 'code_interpreter',
    container: { 
      type: 'auto' // Let OpenAI manage the container automatically
    }
  }
];

// Example API request configuration for plotting oxygen sensor data
export const createPlottingRequest = (message, oxygenSensorData = null) => {
  const requestBody = {
    messages: [
      {
        role: 'system',
        content: `You are an automotive diagnostic assistant with advanced data visualization capabilities. 
        You can create mathematical plots and graphs using Python to visualize OBD2 sensor data.
        
        When asked to visualize oxygen sensor data during acceleration, create a time-series plot showing:
        - X-axis: Time (seconds)
        - Y-axis: Voltage (0.1 to 0.9 volts)
        - Different phases: Idle (0.4-0.6V), Acceleration (rapid oscillation), Peak acceleration (1-2Hz oscillation)
        
        Use matplotlib or similar libraries to create professional automotive diagnostic plots.`
      },
      {
        role: 'user', 
        content: message
      }
    ],
    tools: oxygenSensorPlottingTools
  };

  // If actual sensor data is provided, include it
  if (oxygenSensorData) {
    requestBody.messages.push({
      role: 'user',
      content: `Here is the actual oxygen sensor data to plot: ${JSON.stringify(oxygenSensorData)}`
    });
  }

  return requestBody;
};

// Example usage for oxygen sensor visualization request
export const exampleOxygenSensorRequest = createPlottingRequest(
  `Create a time-series plot showing oxygen sensor voltage patterns during full acceleration. 
  Show the voltage ranges from 0.1V (rich) to 0.9V (lean), with stable regions around 0.4-0.6V 
  during idle/cruising, and rapid oscillations during acceleration phases.`
);

console.log('Example request configuration:', JSON.stringify(exampleOxygenSensorRequest, null, 2));