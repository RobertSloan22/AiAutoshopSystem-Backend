// Content script - runs on all pages
let isMonitoring = false;
let observer = null;

// Initialize content script
(function() {
  console.log('Automotive AI content script loaded');
  
  // Check if extension is active
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
    if (response && response.isActive) {
      startMonitoring();
    }
  });

  // Listen for activation changes
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TOGGLE_MONITORING') {
      if (message.active) {
        startMonitoring();
      } else {
        stopMonitoring();
      }
    }
  });
})();

function startMonitoring() {
  if (isMonitoring) return;
  
  console.log('Starting automotive data monitoring');
  isMonitoring = true;
  
  // Initial scan of page
  scanForDiagnosticData();
  
  // Set up mutation observer for dynamic content
  observer = new MutationObserver((mutations) => {
    let shouldScan = false;
    
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Check if any added nodes contain text
        for (let node of mutation.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE || 
              (node.nodeType === Node.ELEMENT_NODE && node.textContent)) {
            shouldScan = true;
            break;
          }
        }
      }
    });
    
    if (shouldScan) {
      debounce(scanForDiagnosticData, 1000)();
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
}

function stopMonitoring() {
  if (!isMonitoring) return;
  
  console.log('Stopping automotive data monitoring');
  isMonitoring = false;
  
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

function scanForDiagnosticData() {
  const diagnosticData = {
    dtcCodes: extractDTCCodes(),
    vehicleInfo: extractVehicleInfo(),
    diagnosticText: extractDiagnosticText(),
    pageUrl: window.location.href,
    pageTitle: document.title,
    timestamp: Date.now()
  };
  
  // Only send if we found relevant data
  if (diagnosticData.dtcCodes.length > 0 || 
      diagnosticData.vehicleInfo.length > 0 || 
      diagnosticData.diagnosticText.length > 0) {
    
    console.log('Found diagnostic data:', diagnosticData);
    
    // Show visual indicator that data was found
    showDataFoundIndicator();
    
    chrome.runtime.sendMessage({
      type: 'DIAGNOSTIC_DATA',
      data: diagnosticData
    });
  }
}

function extractDTCCodes() {
  const text = document.body.textContent;
  const dtcPattern = /[PBUCT]\d{4}/g;
  const codes = text.match(dtcPattern) || [];
  return [...new Set(codes)]; // Remove duplicates
}

function extractVehicleInfo() {
  const text = document.body.textContent;
  const vehicleInfo = [];
  
  // Common vehicle info patterns
  const patterns = [
    /VIN[:\s]+([A-HJ-NPR-Z0-9]{17})/gi,
    /(\d{4})\s+(Ford|Toyota|Honda|Chevrolet|BMW|Mercedes|Audi|Volkswagen|Nissan|Hyundai|Kia|Subaru|Mazda|Volvo|Lexus|Acura|Infiniti|Cadillac|Buick|GMC|Jeep|Chrysler|Dodge|Ram)/gi,
    /Engine[:\s]+([^,\n]{5,30})/gi,
    /Transmission[:\s]+([^,\n]{5,30})/gi
  ];
  
  patterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      vehicleInfo.push(...matches);
    }
  });
  
  return [...new Set(vehicleInfo)];
}

function extractDiagnosticText() {
  const diagnosticKeywords = [
    'fault', 'error', 'malfunction', 'trouble', 'diagnostic',
    'engine', 'transmission', 'brake', 'abs', 'airbag',
    'misfire', 'oxygen sensor', 'catalytic converter',
    'fuel', 'ignition', 'emission'
  ];
  
  const paragraphs = document.querySelectorAll('p, div, span, td');
  const diagnosticText = [];
  
  paragraphs.forEach(element => {
    const text = element.textContent.trim();
    if (text.length > 10 && text.length < 500) {
      const lowerText = text.toLowerCase();
      if (diagnosticKeywords.some(keyword => lowerText.includes(keyword))) {
        diagnosticText.push(text);
      }
    }
  });
  
  return diagnosticText.slice(0, 10); // Limit to first 10 matches
}

// Utility function for debouncing
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Add visual indicator when data is found
function showDataFoundIndicator() {
  // Remove existing indicator
  const existing = document.getElementById('auto-ai-indicator');
  if (existing) existing.remove();
  
  // Create new indicator
  const indicator = document.createElement('div');
  indicator.id = 'auto-ai-indicator';
  indicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #4CAF50;
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  `;
  indicator.textContent = 'Automotive data detected!';
  
  document.body.appendChild(indicator);
  
  // Remove after 3 seconds
  setTimeout(() => {
    if (indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
    }
  }, 3000);
}