// PythonExecutor.js - React component for Python code execution
import React, { useState } from 'react';

const PythonExecutor = () => {
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const executeCode = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/execute/python', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: code,
          save_plots: true
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Execution failed');
      }
      
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const predefinedExamples = {
    'Basic Math': `import numpy as np
import math

# Basic calculations
result = 2 + 2
sqrt_val = math.sqrt(16)
mean_val = np.array([1, 2, 3, 4, 5]).mean()

print(f"2 + 2 = {result}")
print(f"√16 = {sqrt_val}")
print(f"Mean of [1,2,3,4,5] = {mean_val}")`,

    'OBD2 Analysis': `import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# Sample OBD2 data
obd_data = {
    'time': np.arange(0, 60, 5),
    'rpm': [800, 1200, 1800, 2400, 2200, 1800, 1400, 1000, 900, 850, 800, 780],
    'speed': [0, 10, 25, 45, 50, 40, 30, 20, 10, 5, 0, 0],
    'temp': [85, 87, 89, 91, 93, 92, 90, 88, 86, 85, 84, 83]
}

df = pd.DataFrame(obd_data)

# Analysis
print("OBD2 Data Analysis:")
print(f"Average RPM: {df['rpm'].mean():.1f}")
print(f"Max Speed: {df['speed'].max()} km/h")
print(f"Temperature Range: {df['temp'].min()}-{df['temp'].max()}°C")

# Visualization
plt.figure(figsize=(12, 4))

plt.subplot(1, 3, 1)
plt.plot(df['time'], df['rpm'], 'r-o')
plt.title('Engine RPM')
plt.xlabel('Time (s)')
plt.ylabel('RPM')

plt.subplot(1, 3, 2)
plt.plot(df['time'], df['speed'], 'b-s')
plt.title('Vehicle Speed')
plt.xlabel('Time (s)')
plt.ylabel('Speed (km/h)')

plt.subplot(1, 3, 3)
plt.plot(df['time'], df['temp'], 'g-^')
plt.title('Engine Temperature')
plt.xlabel('Time (s)')
plt.ylabel('Temp (°C)')

plt.tight_layout()
plt.show()`,

    'Statistical Analysis': `import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from scipy import stats

# Generate sample sensor data with some patterns
np.random.seed(42)
time = np.linspace(0, 100, 200)
engine_load = 30 + 20 * np.sin(time/10) + 5 * np.random.randn(200)
fuel_flow = 2 + 0.05 * engine_load + 0.1 * np.random.randn(200)

# Statistical analysis
correlation = np.corrcoef(engine_load, fuel_flow)[0,1]
slope, intercept, r_value, p_value, std_err = stats.linregress(engine_load, fuel_flow)

print(f"Engine Load vs Fuel Flow Analysis:")
print(f"Correlation coefficient: {correlation:.3f}")
print(f"Linear regression: y = {slope:.3f}x + {intercept:.3f}")
print(f"R-squared: {r_value**2:.3f}")
print(f"P-value: {p_value:.6f}")

# Visualization
plt.figure(figsize=(12, 4))

plt.subplot(1, 2, 1)
plt.scatter(engine_load, fuel_flow, alpha=0.6)
plt.plot(engine_load, slope * engine_load + intercept, 'r-')
plt.xlabel('Engine Load (%)')
plt.ylabel('Fuel Flow (L/h)')
plt.title('Engine Load vs Fuel Flow')

plt.subplot(1, 2, 2)
plt.hist(fuel_flow, bins=20, alpha=0.7, edgecolor='black')
plt.xlabel('Fuel Flow (L/h)')
plt.ylabel('Frequency')
plt.title('Fuel Flow Distribution')

plt.tight_layout()
plt.show()`
  };

  return (
    <div className="python-executor">
      <div className="controls">
        <h3>Python Code Executor</h3>
        
        {/* Predefined Examples */}
        <div className="examples">
          <label>Quick Examples:</label>
          <div className="example-buttons">
            {Object.keys(predefinedExamples).map(example => (
              <button
                key={example}
                onClick={() => setCode(predefinedExamples[example])}
                className="example-btn"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {/* Code Input */}
        <div className="code-input">
          <label>Python Code:</label>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={15}
            cols={80}
            placeholder="Enter your Python code here..."
            className="code-textarea"
          />
        </div>

        {/* Execute Button */}
        <button 
          onClick={executeCode} 
          disabled={loading || !code.trim()}
          className="execute-btn"
        >
          {loading ? 'Executing...' : 'Execute Python Code'}
        </button>
      </div>

      {/* Results */}
      {error && (
        <div className="error">
          <h4>Error:</h4>
          <pre>{error}</pre>
        </div>
      )}

      {result && (
        <div className="results">
          <h4>Execution Results:</h4>
          
          {/* Text Output */}
          {result.output && (
            <div className="output">
              <h5>Output:</h5>
              <pre className="output-text">{result.output}</pre>
            </div>
          )}

          {/* Error Output */}
          {result.error && (
            <div className="error-output">
              <h5>Errors/Warnings:</h5>
              <pre className="error-text">{result.error}</pre>
            </div>
          )}

          {/* Generated Plots */}
          {result.plots_data && result.plots_data.length > 0 && (
            <div className="plots">
              <h5>Generated Plots:</h5>
              {result.plots_data.map((plot, index) => (
                <div key={index} className="plot-container">
                  <img 
                    src={plot.data} 
                    alt={`Generated plot ${index + 1}`}
                    className="plot-image"
                    style={{maxWidth: '100%', height: 'auto'}}
                  />
                  <p className="plot-path">Saved to: {plot.path}</p>
                </div>
              ))}
            </div>
          )}

          {/* Execution Info */}
          <div className="execution-info">
            <p><strong>Execution ID:</strong> {result.execution_id}</p>
            <p><strong>Success:</strong> {result.success ? 'Yes' : 'No'}</p>
            {result.plots_generated && (
              <p><strong>Plots Generated:</strong> {result.plots_generated}</p>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .python-executor {
          max-width: 1200px;
          margin: 20px auto;
          padding: 20px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .controls {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .examples {
          margin-bottom: 20px;
        }

        .example-buttons {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 8px;
        }

        .example-btn {
          padding: 8px 16px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .example-btn:hover {
          background: #0056b3;
        }

        .code-input {
          margin-bottom: 20px;
        }

        .code-textarea {
          width: 100%;
          font-family: 'Courier New', monospace;
          font-size: 14px;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: #ffffff;
          resize: vertical;
        }

        .execute-btn {
          padding: 12px 24px;
          background: #28a745;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          font-weight: bold;
        }

        .execute-btn:hover:not(:disabled) {
          background: #218838;
        }

        .execute-btn:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }

        .results {
          background: #ffffff;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 20px;
        }

        .error {
          background: #f8d7da;
          border: 1px solid #f5c6cb;
          color: #721c24;
          padding: 15px;
          border-radius: 4px;
          margin-bottom: 20px;
        }

        .output, .error-output {
          margin-bottom: 20px;
        }

        .output-text, .error-text {
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          padding: 12px;
          border-radius: 4px;
          font-family: 'Courier New', monospace;
          font-size: 13px;
          white-space: pre-wrap;
          overflow-x: auto;
        }

        .error-text {
          background: #fff3cd;
          border-color: #ffeaa7;
          color: #856404;
        }

        .plots {
          margin-bottom: 20px;
        }

        .plot-container {
          margin-bottom: 20px;
          text-align: center;
        }

        .plot-image {
          border: 1px solid #ddd;
          border-radius: 4px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .plot-path {
          font-size: 12px;
          color: #666;
          margin-top: 5px;
          font-family: monospace;
        }

        .execution-info {
          background: #e3f2fd;
          padding: 12px;
          border-radius: 4px;
          font-size: 14px;
        }

        h3, h4, h5 {
          margin-top: 0;
          color: #333;
        }

        label {
          font-weight: bold;
          color: #555;
        }
      `}</style>
    </div>
  );
};

export default PythonExecutor;