// pythonAPI.js - Utility functions for Python execution API
export class PythonAPI {
  constructor(baseURL = '/api') {
    this.baseURL = baseURL;
  }

  /**
   * Execute Python code directly
   * @param {string} code - Python code to execute
   * @param {object} options - Execution options
   * @returns {Promise<object>} Execution result
   */
  async executeCode(code, options = {}) {
    const {
      save_plots = true,
      plot_filename = null,
      timeout = 30000
    } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.baseURL}/execute/python`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code,
          save_plots,
          plot_filename
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Send a message to AI assistant with Python capabilities
   * @param {Array} messages - Conversation history
   * @param {object} context - Additional context
   * @returns {Promise<object>} AI response
   */
  async sendToAssistant(messages, context = {}) {
    const pythonTool = {
      type: 'function',
      function: {
        name: 'execute_python_code',
        description: 'Execute Python code with access to data analysis libraries',
        parameters: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'The Python code to execute'
            },
            save_plots: {
              type: 'boolean',
              description: 'Whether to save plots as PNG files',
              default: true
            },
            plot_filename: {
              type: 'string',
              description: 'Optional filename for plots'
            }
          },
          required: ['code']
        }
      }
    };

    const response = await fetch(`${this.baseURL}/turn_response`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages,
        tools: [pythonTool],
        ...context
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Stream responses from AI assistant
   * @param {Array} messages - Conversation history
   * @param {object} context - Additional context
   * @param {function} onMessage - Callback for each message chunk
   * @returns {Promise<void>}
   */
  async streamFromAssistant(messages, context = {}, onMessage) {
    const response = await fetch(`${this.baseURL}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: messages[messages.length - 1].content,
        vehicleContext: context.vehicleContext,
        customerContext: context.customerContext
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              onMessage(data);
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Get system health including Python capabilities
   * @returns {Promise<object>} Health status
   */
  async getHealth() {
    const response = await fetch(`${this.baseURL}/health`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Predefined Python code templates
   */
  static get templates() {
    return {
      basicMath: {
        name: 'Basic Mathematics',
        code: `import numpy as np
import math

# Basic calculations
result = 2 + 2
sqrt_val = math.sqrt(16)
mean_val = np.array([1, 2, 3, 4, 5]).mean()

print(f"2 + 2 = {result}")
print(f"√16 = {sqrt_val}")
print(f"Mean of [1,2,3,4,5] = {mean_val}")`
      },

      obd2Analysis: {
        name: 'OBD2 Data Analysis',
        code: `import pandas as pd
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

# Create visualization
plt.figure(figsize=(15, 5))

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
plt.show()`
      },

      fuelEfficiency: {
        name: 'Fuel Efficiency Calculator',
        code: `import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# Sample data: distance, fuel used, driving conditions
trips = pd.DataFrame({
    'distance_km': [50, 120, 30, 80, 200, 15, 90],
    'fuel_used_L': [4.2, 8.5, 3.1, 5.8, 14.2, 1.8, 6.5],
    'condition': ['city', 'highway', 'city', 'mixed', 'highway', 'city', 'mixed'],
    'temperature': [22, 18, 25, 20, 15, 28, 22]
})

# Calculate fuel efficiency
trips['efficiency_kmL'] = trips['distance_km'] / trips['fuel_used_L']
trips['efficiency_L100km'] = trips['fuel_used_L'] / trips['distance_km'] * 100

print("Fuel Efficiency Analysis:")
print(f"Average efficiency: {trips['efficiency_kmL'].mean():.1f} km/L")
print(f"Average consumption: {trips['efficiency_L100km'].mean():.1f} L/100km")
print("\\nBy driving condition:")
print(trips.groupby('condition')['efficiency_kmL'].agg(['mean', 'std']).round(1))

# Visualization
plt.figure(figsize=(12, 4))

plt.subplot(1, 2, 1)
condition_efficiency = trips.groupby('condition')['efficiency_kmL'].mean()
plt.bar(condition_efficiency.index, condition_efficiency.values, 
        color=['#ff7f0e', '#1f77b4', '#2ca02c'])
plt.title('Average Fuel Efficiency by Condition')
plt.ylabel('Efficiency (km/L)')

plt.subplot(1, 2, 2)
plt.scatter(trips['temperature'], trips['efficiency_kmL'], 
           c=trips['condition'].map({'city': 'red', 'highway': 'blue', 'mixed': 'green'}),
           s=100, alpha=0.7)
plt.xlabel('Temperature (°C)')
plt.ylabel('Efficiency (km/L)')
plt.title('Efficiency vs Temperature')
plt.legend(['City', 'Highway', 'Mixed'])

plt.tight_layout()
plt.show()`
      },

      diagnosticTrends: {
        name: 'Diagnostic Trend Analysis',
        code: `import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from scipy import stats

# Simulate diagnostic data over time
np.random.seed(42)
days = 30
dates = pd.date_range('2024-01-01', periods=days)

# Generate realistic automotive sensor data
base_temp = 90
temp_trend = np.linspace(0, 5, days)  # Gradual increase
temp_noise = np.random.normal(0, 2, days)
engine_temp = base_temp + temp_trend + temp_noise

# Oil pressure with some correlation to temperature
oil_pressure = 35 - (engine_temp - 90) * 0.3 + np.random.normal(0, 1.5, days)

# RPM with weekly pattern
rpm_base = 1200 + 300 * np.sin(np.arange(days) * 2 * np.pi / 7) + np.random.normal(0, 50, days)

df = pd.DataFrame({
    'date': dates,
    'engine_temp': engine_temp,
    'oil_pressure': oil_pressure,
    'avg_rpm': rpm_base
})

print("Diagnostic Trend Analysis (30 days):")
print(f"Temperature trend: {stats.linregress(range(days), engine_temp).slope:.3f}°C/day")
print(f"Oil pressure trend: {stats.linregress(range(days), oil_pressure).slope:.3f} PSI/day")
print(f"Average engine temp: {engine_temp.mean():.1f}°C")
print(f"Average oil pressure: {oil_pressure.mean():.1f} PSI")

# Create diagnostic dashboard
fig, axes = plt.subplots(2, 2, figsize=(15, 10))

# Temperature trend
axes[0,0].plot(df['date'], df['engine_temp'], 'r-', alpha=0.7)
z = np.polyfit(range(days), engine_temp, 1)
p = np.poly1d(z)
axes[0,0].plot(df['date'], p(range(days)), "r--", alpha=0.8, linewidth=2)
axes[0,0].set_title('Engine Temperature Trend')
axes[0,0].set_ylabel('Temperature (°C)')
axes[0,0].grid(True)

# Oil pressure trend  
axes[0,1].plot(df['date'], df['oil_pressure'], 'b-', alpha=0.7)
z2 = np.polyfit(range(days), oil_pressure, 1)
p2 = np.poly1d(z2)
axes[0,1].plot(df['date'], p2(range(days)), "b--", alpha=0.8, linewidth=2)
axes[0,1].set_title('Oil Pressure Trend')
axes[0,1].set_ylabel('Pressure (PSI)')
axes[0,1].grid(True)

# RPM pattern
axes[1,0].plot(df['date'], df['avg_rpm'], 'g-', alpha=0.7)
axes[1,0].set_title('Average RPM Pattern')
axes[1,0].set_ylabel('RPM')
axes[1,0].grid(True)

# Correlation analysis
axes[1,1].scatter(df['engine_temp'], df['oil_pressure'], alpha=0.7, c='purple')
axes[1,1].set_xlabel('Engine Temperature (°C)')
axes[1,1].set_ylabel('Oil Pressure (PSI)')
axes[1,1].set_title('Temperature vs Oil Pressure')
correlation = df['engine_temp'].corr(df['oil_pressure'])
axes[1,1].text(0.05, 0.95, f'Correlation: {correlation:.3f}', 
               transform=axes[1,1].transAxes, bbox=dict(boxstyle="round", facecolor='wheat'))
axes[1,1].grid(True)

plt.tight_layout()
plt.show()

# Alert system
alerts = []
if engine_temp[-1] > 95:
    alerts.append("⚠️  High engine temperature detected!")
if oil_pressure[-1] < 30:
    alerts.append("⚠️  Low oil pressure detected!")
if abs(stats.linregress(range(days), engine_temp).slope) > 0.1:
    alerts.append("⚠️  Significant temperature trend detected!")

print("\\n🚨 DIAGNOSTIC ALERTS:")
if alerts:
    for alert in alerts:
        print(alert)
else:
    print("✅ All systems within normal parameters")`
      }
    };
  }

  /**
   * Generate code for common automotive calculations
   * @param {string} type - Type of calculation
   * @param {object} params - Parameters for the calculation
   * @returns {string} Python code
   */
  static generateCode(type, params = {}) {
    const templates = this.templates;
    
    switch (type) {
      case 'fuel_efficiency':
        return templates.fuelEfficiency.code;
      case 'obd2_analysis':
        return templates.obd2Analysis.code;
      case 'diagnostic_trends':
        return templates.diagnosticTrends.code;
      case 'basic_math':
        return templates.basicMath.code;
      default:
        return `# Custom calculation
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# Add your code here
print("Hello from Python!")`;
    }
  }
}

// Export utility functions
export const pythonAPI = new PythonAPI();

export default PythonAPI;