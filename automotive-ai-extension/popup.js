// Popup script
document.addEventListener('DOMContentLoaded', async () => {
    const toggleBtn = document.getElementById('toggleBtn');
    const toggleText = document.getElementById('toggleText');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const backendUrlInput = document.getElementById('backendUrl');
    const saveSettingsBtn = document.getElementById('saveSettings');
    const captureBtn = document.getElementById('captureBtn');
    const scanBtn = document.getElementById('scanBtn');
    const extractionCount = document.getElementById('extractionCount');
    const lastActivity = document.getElementById('lastActivity');
  
    // Load current settings
    const settings = await chrome.storage.sync.get([
      'isActive', 
      'backendUrl', 
      'extractionCount', 
      'lastActivity',
      'lastDiagnosticSession'
    ]);
  
    // Update UI with current settings
    const isActive = settings.isActive || false;
    backendUrlInput.value = settings.backendUrl || 'http://localhost:3001';
    extractionCount.textContent = settings.extractionCount || 0;
    lastActivity.textContent = settings.lastActivity || 'Never';

    // Show last diagnostic session info if available
    if (settings.lastDiagnosticSession) {
      const session = settings.lastDiagnosticSession;
      const sessionTime = new Date(session.timestamp).toLocaleString();
      lastActivity.textContent = `${sessionTime} (DTC: ${session.dtcCode})`;
    }
  
    updateStatus(isActive);
  
    // Toggle monitoring
    toggleBtn.addEventListener('click', async () => {
      const newState = !isActive;
      await chrome.storage.sync.set({ isActive: newState });
      
      // Send message to all tabs
      const tabs = await chrome.tabs.query({});
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'TOGGLE_MONITORING',
          active: newState
        }).catch(() => {
          // Ignore errors for tabs that don't have content script
        });
      });
  
      updateStatus(newState);
      window.location.reload(); // Refresh popup
    });
  
    // Save settings
    saveSettingsBtn.addEventListener('click', async () => {
      const backendUrl = backendUrlInput.value.trim();
      
      if (!backendUrl) {
        alert('Please enter a backend URL');
        return;
      }
  
      await chrome.storage.sync.set({ backendUrl });
      
      // Show confirmation
      const originalText = saveSettingsBtn.textContent;
      saveSettingsBtn.textContent = 'Saved!';
      saveSettingsBtn.style.background = '#4CAF50';
      
      setTimeout(() => {
        saveSettingsBtn.textContent = originalText;
        saveSettingsBtn.style.background = '';
      }, 1500);
    });
  
    // Capture screenshot
    captureBtn.addEventListener('click', async () => {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        const result = await chrome.runtime.sendMessage({
          type: 'CAPTURE_SCREENSHOT'
        });
  
        if (result.success) {
          // Update stats
          const currentCount = parseInt(extractionCount.textContent) + 1;
          const now = new Date().toLocaleTimeString();
          
          await chrome.storage.sync.set({
            extractionCount: currentCount,
            lastActivity: now
          });
          
          extractionCount.textContent = currentCount;
          lastActivity.textContent = now;
          
          // Show success
          captureBtn.textContent = '✅ Captured!';
          setTimeout(() => {
            captureBtn.textContent = '📸 Capture Screenshot';
          }, 1500);
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        console.error('Screenshot failed:', error);
        captureBtn.textContent = '❌ Failed';
        setTimeout(() => {
          captureBtn.textContent = '📸 Capture Screenshot';
        }, 1500);
      }
    });
  
    // Scan current page
    scanBtn.addEventListener('click', async () => {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Inject and execute content script
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          function: forceScan
        });
        
        scanBtn.textContent = '✅ Scanned!';
        setTimeout(() => {
          scanBtn.textContent = '🔍 Scan Current Page';
        }, 1500);
        
      } catch (error) {
        console.error('Scan failed:', error);
        scanBtn.textContent = '❌ Failed';
        setTimeout(() => {
          scanBtn.textContent = '🔍 Scan Current Page';
        }, 1500);
      }
    });
  
    function updateStatus(active) {
      if (active) {
        statusDot.className = 'status-dot active';
        statusText.textContent = 'Active';
        toggleText.textContent = 'Disable';
        toggleBtn.className = 'toggle-btn active';
      } else {
        statusDot.className = 'status-dot inactive';
        statusText.textContent = 'Inactive';
        toggleText.textContent = 'Enable';
        toggleBtn.className = 'toggle-btn';
      }
    }
  });
  
  // Function to inject for manual scanning
  function forceScan() {
    // This function runs in the context of the webpage
    if (window.scanForDiagnosticData) {
      window.scanForDiagnosticData();
    } else {
      console.log('Content script not loaded or scan function not available');
    }
  }