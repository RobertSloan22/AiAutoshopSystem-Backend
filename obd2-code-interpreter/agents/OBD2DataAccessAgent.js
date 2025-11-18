/**
 * OBD2DataAccessAgent - Retrieves and prepares OBD2 data for analysis
 * Uses gpt-4o model - fast and efficient for data retrieval
 * Has MongoDB access but CANNOT execute code
 */

import BaseAgent from '../core/BaseAgent.js';
import OBD2DataAccessTool from '../tools/OBD2DataAccessTool.js';

class OBD2DataAccessAgent extends BaseAgent {
  constructor(languageModelInterface, OBD2Data, DiagnosticSession) {
    const prompt = `You are an OBD2 data access assistant. Your role is to retrieve vehicle diagnostic data from MongoDB and prepare it for analysis.

When given a session ID:
1. Use the access_obd2_data tool to retrieve the OBD2 data
2. Provide a clear summary of the session including:
   - Session details (start time, duration, vehicle info)
   - Number of data points collected
   - Available parameters (RPM, speed, temperatures, O2 sensors, fuel trim, etc.)
   - Any DTC codes present
   - Sample of the data
3. Confirm the data has been prepared and is ready for analysis in the Docker container

Do not perform any analysis yourself - just retrieve and summarize the data.`;

    super({
      prompt,
      model: 'gpt-4o',
      languageModelInterface
    });

    this.registerTool(new OBD2DataAccessTool(OBD2Data, DiagnosticSession));
  }
}

export default OBD2DataAccessAgent;
