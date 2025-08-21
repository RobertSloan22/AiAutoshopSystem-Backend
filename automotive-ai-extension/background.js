// Background service worker
let isActive = false;
let backendUrl = 'http://localhost:3001';

// Install/startup
chrome.runtime.onInstalled.addListener(() => {
  console.log('Automotive AI Extension installed');
  chrome.storage.sync.set({ 
    isActive: false,
    backendUrl: 'http://localhost:3001'
  });
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DIAGNOSTIC_DATA') {
    handleDiagnosticData(message.data, sender.tab);
  } else if (message.type === 'CAPTURE_SCREENSHOT') {
    captureScreenshot(sender.tab.id).then(sendResponse);
    return true; // Will respond asynchronously
  } else if (message.type === 'GET_STATUS') {
    chrome.storage.sync.get(['isActive'], (result) => {
      sendResponse({ isActive: result.isActive });
    });
    return true;
  }
});

// Handle diagnostic data extraction
async function handleDiagnosticData(data, tab) {
  try {
    const settings = await chrome.storage.sync.get(['isActive', 'backendUrl']);
    
    if (!settings.isActive) {
      console.log('Extension not active, skipping data send');
      return;
    }

    // Add tab information
    const enrichedData = {
      ...data,
      tabUrl: tab.url,
      tabTitle: tab.title,
      timestamp: Date.now()
    };

    // Send to your Express backend
    await sendToBackend(enrichedData);
    
  } catch (error) {
    console.error('Error handling diagnostic data:', error);
  }
}

// Capture screenshot of current tab
async function captureScreenshot(tabId) {
  try {
    const screenshot = await chrome.tabs.captureVisibleTab(null, {
      format: 'png',
      quality: 90
    });
    
    return {
      success: true,
      screenshot: screenshot,
      tabId: tabId,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Screenshot capture failed:', error);
    return { success: false, error: error.message };
  }
}

// Send data to your Express backend and create diagnostic session
async function sendToBackend(data) {
  try {
    const settings = await chrome.storage.sync.get(['backendUrl']);
    const sessionId = generateSessionId();
    
    // First, send the raw diagnostic data
    const diagnosticResponse = await fetch(`${settings.backendUrl}/api/diagnostic-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        extensionData: data,
        sessionId: sessionId
      })
    });

    if (!diagnosticResponse.ok) {
      throw new Error(`Diagnostic data endpoint error: ${diagnosticResponse.status}`);
    }

    const diagnosticResult = await diagnosticResponse.json();
    console.log('Diagnostic data sent successfully:', diagnosticResult);

    // If we have DTC codes, create a diagnostic session with agents
    if (data.dtcCodes && data.dtcCodes.length > 0) {
      try {
        const agentSessionResponse = await fetch(`${settings.backendUrl}/api/diagnostic-agents/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            dtcCode: data.dtcCodes[0], // Use first DTC code
            vehicleInfo: {
              year: extractYear(data.vehicleInfo),
              make: extractMake(data.vehicleInfo),
              model: extractModel(data.vehicleInfo),
              vin: extractVIN(data.vehicleInfo)
            },
            researchData: {
              websiteContent: data.diagnosticText,
              pageUrl: data.pageUrl,
              pageTitle: data.pageTitle,
              additionalCodes: data.dtcCodes.slice(1)
            },
            diagnosticSteps: generateBasicDiagnosticSteps(data.dtcCodes[0]),
            sessionId: sessionId
          })
        });

        if (agentSessionResponse.ok) {
          const agentResult = await agentSessionResponse.json();
          console.log('Diagnostic agent session created:', agentResult);
          
          // Store the session info for popup display
          chrome.storage.sync.set({
            lastDiagnosticSession: {
              sessionId: agentResult.sessionId,
              dtcCode: data.dtcCodes[0],
              timestamp: Date.now(),
              pageUrl: data.pageUrl
            }
          });
          
          return { ...diagnosticResult, agentSession: agentResult };
        }
      } catch (agentError) {
        console.error('Failed to create diagnostic agent session:', agentError);
        // Continue with just the diagnostic data result
      }
    }
    
    return diagnosticResult;
  } catch (error) {
    console.error('Failed to send data to backend:', error);
    throw error;
  }
}

// Helper functions to extract vehicle information
function extractYear(vehicleInfo) {
  if (!vehicleInfo || !vehicleInfo.length) return null;
  const yearMatch = vehicleInfo.find(info => /\b(19|20)\d{2}\b/.test(info));
  return yearMatch ? yearMatch.match(/\b(19|20)\d{2}\b/)[0] : null;
}

function extractMake(vehicleInfo) {
  if (!vehicleInfo || !vehicleInfo.length) return null;
  const makes = ['Ford', 'Toyota', 'Honda', 'Chevrolet', 'BMW', 'Mercedes', 'Audi', 'Volkswagen', 'Nissan', 'Hyundai', 'Kia', 'Subaru', 'Mazda', 'Volvo', 'Lexus', 'Acura', 'Infiniti', 'Cadillac', 'Buick', 'GMC', 'Jeep', 'Chrysler', 'Dodge', 'Ram'];
  for (const info of vehicleInfo) {
    for (const make of makes) {
      if (info.toLowerCase().includes(make.toLowerCase())) {
        return make;
      }
    }
  }
  return null;
}

function extractModel(vehicleInfo) {
  if (!vehicleInfo || !vehicleInfo.length) return null;
  // This is more complex - would need better parsing logic
  // For now, return the first piece of vehicle info that's not year/make
  const year = extractYear(vehicleInfo);
  const make = extractMake(vehicleInfo);
  for (const info of vehicleInfo) {
    if (!info.includes(year) && !info.includes(make) && info.length > 2) {
      return info.split(' ').slice(-1)[0]; // Take last word as model
    }
  }
  return null;
}

function extractVIN(vehicleInfo) {
  if (!vehicleInfo || !vehicleInfo.length) return null;
  const vinMatch = vehicleInfo.find(info => /VIN[:\s]+([A-HJ-NPR-Z0-9]{17})/i.test(info));
  return vinMatch ? vinMatch.match(/([A-HJ-NPR-Z0-9]{17})/)[0] : null;
}

// Generate basic diagnostic steps based on DTC code
function generateBasicDiagnosticSteps(dtcCode) {
  const steps = [
    {
      id: 'step_1',
      title: 'Visual Inspection',
      description: `Perform visual inspection related to DTC ${dtcCode}. Check for obvious damage, loose connections, or visible issues.`,
      category: 'inspection',
      estimatedTime: '10-15 minutes'
    },
    {
      id: 'step_2', 
      title: 'Check Service Bulletins',
      description: `Research any Technical Service Bulletins (TSBs) related to ${dtcCode} for this vehicle.`,
      category: 'research',
      estimatedTime: '5-10 minutes'
    },
    {
      id: 'step_3',
      title: 'Component Testing',
      description: `Test components commonly associated with ${dtcCode} using appropriate diagnostic tools.`,
      category: 'testing',
      estimatedTime: '20-30 minutes'
    },
    {
      id: 'step_4',
      title: 'Repair Verification',
      description: 'Clear codes, perform repair, and verify the fix by road testing or running system tests.',
      category: 'verification',
      estimatedTime: '15-30 minutes'
    }
  ];
  
  return steps;
}

// Generate session ID
function generateSessionId() {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Listen for tab updates to check for automotive content
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if this looks like an automotive diagnostic site
    const automotiveKeywords = [
      'diagnostic', 'obd', 'dtc', 'trouble', 'code',
      'engine', 'transmission', 'repair', 'mechanic'
    ];
    
    const urlLower = tab.url.toLowerCase();
    const titleLower = (tab.title || '').toLowerCase();
    
    const isAutomotiveRelated = automotiveKeywords.some(keyword => 
      urlLower.includes(keyword) || titleLower.includes(keyword)
    );
    
    if (isAutomotiveRelated) {
      console.log('Detected automotive content on tab:', tab.title);
    }
  }
});