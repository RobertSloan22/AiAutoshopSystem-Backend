# Automotive AI Chrome Extension

This Chrome extension captures automotive diagnostic data from web pages and sends it to your AI automotive system backend.

## Features

- **Automatic Detection**: Monitors web pages for DTC codes, vehicle information, and diagnostic text
- **Visual Indicators**: Shows when diagnostic data is found on a page
- **Backend Integration**: Sends data to your diagnostic agents system
- **Session Management**: Creates diagnostic sessions automatically when DTC codes are detected
- **Screenshot Capture**: Can capture screenshots of diagnostic pages
- **Manual Scanning**: Force scan any page for diagnostic content

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the `automotive-ai-extension` folder
4. The extension should now appear in your Chrome toolbar

## Configuration

1. Click the extension icon in your toolbar
2. Set your backend URL (default: `http://localhost:3000`)
3. Click "Save Settings"
4. Click "Enable" to start monitoring

## Usage

1. **Automatic Monitoring**: Once enabled, the extension automatically scans pages for:
   - DTC codes (P0XXX, B0XXX, C0XXX, U0XXX format)
   - Vehicle information (year, make, model, VIN)
   - Diagnostic keywords and text

2. **Manual Actions**: 
   - Click "Scan Current Page" to force a scan
   - Click "Capture Screenshot" to take a screenshot

3. **Visual Feedback**: When diagnostic data is found, a green indicator appears briefly on the page

## API Integration

The extension integrates with your backend through these endpoints:

- `POST /api/diagnostic-data` - Receives captured diagnostic data
- `POST /api/diagnostic-agents/sessions` - Creates diagnostic sessions with AI agents

## Detected Automotive Sites

The extension automatically detects automotive-related websites and increases monitoring on sites containing these keywords:
- diagnostic, obd, dtc, trouble, code
- engine, transmission, repair, mechanic

## Data Privacy

- Extension only processes publicly available web content
- Data is only sent to your configured backend URL
- No data is stored locally except for configuration settings

## Troubleshooting

1. **Extension not capturing data**: 
   - Check that monitoring is enabled
   - Verify backend URL is correct and accessible
   - Check browser console for error messages

2. **Backend connection issues**:
   - Ensure your backend server is running
   - Check CORS settings allow requests from extension
   - Verify the API endpoints are available

3. **No visual indicators**:
   - Try manually scanning the page
   - Check if the page contains automotive diagnostic content
   - Look for DTC codes in P0XXX format

## Development

The extension consists of:
- `manifest.json` - Extension configuration
- `background.js` - Service worker for API communication  
- `content.js` - Runs on web pages to detect diagnostic data
- `popup.html/js/css` - Extension popup interface

To modify the extension, edit these files and reload the extension in Chrome's developer mode.