import numpy as np
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt

# Generate time data for a simulation
np.random.seed(0)  # For reproducibility
time = np.linspace(0, 10, 100)

# Simulated healthy fuel trim data
# Short-term fuel trim oscillates around 0% with some noise
stft = np.sin(time * 2 * np.pi) * 5 + np.random.normal(0, 0.5, len(time))

# Long-term fuel trim oscillates more slowly around 0% with less noise
ltft = np.sin(time * 0.5 * 2 * np.pi) * 2 + np.random.normal(0, 0.1, len(time))

plt.figure(figsize=(12, 6))

# Plot Short-Term Fuel Trim
plt.subplot(2, 1, 1)
plt.plot(time, stft, label='Short-Term Fuel Trim (STFT)', color='blue')
plt.axhline(y=10, color='red', linestyle='--', label='Upper Limit +10%')
plt.axhline(y=-10, color='red', linestyle='--', label='Lower Limit -10%')
plt.axhline(0, color='green', linewidth=0.5)
plt.title('Short-Term Fuel Trim Data')
plt.xlabel('Time (s)')
plt.ylabel('Fuel Trim (%)')
plt.ylim(-15, 15)
plt.legend()
plt.grid(True)

# Plot Long-Term Fuel Trim
plt.subplot(2, 1, 2)
plt.plot(time, ltft, label='Long-Term Fuel Trim (LTFT)', color='orange')
plt.axhline(y=5, color='red', linestyle='--', label='Upper Limit +5%')
plt.axhline(y=-5, color='red', linestyle='--', label='Lower Limit -5%')
plt.axhline(0, color='green', linewidth=0.5)
plt.title('Long-Term Fuel Trim Data')
plt.xlabel('Time (s)')
plt.ylabel('Fuel Trim (%)')
plt.ylim(-10, 10)
plt.legend()
plt.grid(True)

plt.tight_layout()
plt.savefig('/tmp/python_outputs/healthy_fuel_trim_data.png')
print("Plot saved to: /tmp/python_outputs/healthy_fuel_trim_data.png")
plt.close()

print("Test completed successfully!")
print("Matplotlib version:", matplotlib.__version__)
print("Numpy version:", np.__version__)