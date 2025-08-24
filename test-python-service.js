import PythonExecutionService from './services/pythonExecutionService.js';

async function testPythonExecution() {
  const pythonService = new PythonExecutionService();
  
  // Wait a bit for initialization
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const testCode = `
import matplotlib.pyplot as plt
import numpy as np

# Generate test data
x = np.linspace(0, 10, 100)
y = np.sin(x)

# Create plot
plt.figure(figsize=(10, 6))
plt.plot(x, y, 'b-', linewidth=2)
plt.title('Test Plot: Sine Wave')
plt.xlabel('X axis')
plt.ylabel('Y axis')
plt.grid(True, alpha=0.3)
plt.show()

print("Plot generation completed successfully!")
`;

  console.log('Testing Python execution with plot generation...');
  
  try {
    const result = await pythonService.executeCode(testCode, {
      save_plots: true,
      plot_filename: 'test_sine_wave'
    });
    
    console.log('Execution result:', result);
    
    if (result.success) {
      console.log('✅ Python execution successful!');
      console.log('Output:', result.output);
      if (result.plots && result.plots.length > 0) {
        console.log('✅ Plots generated:', result.plots);
      } else {
        console.log('⚠️ No plots were generated');
      }
    } else {
      console.log('❌ Python execution failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error during Python execution:', error);
  }
  
  process.exit(0);
}

testPythonExecution();