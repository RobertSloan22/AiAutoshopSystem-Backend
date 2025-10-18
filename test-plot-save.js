import mongoose from 'mongoose';
import PythonExecutionService from './services/pythonExecutionService.js';
import dotenv from 'dotenv';

dotenv.config();

const testCode = `
import numpy as np
import matplotlib.pyplot as plt

# Generate test data
x = np.linspace(0, 10, 100)
y = np.sin(x)

plt.figure(figsize=(10, 6))
plt.plot(x, y, 'b-', label='Test Plot')
plt.title('Test Plot for MongoDB Storage')
plt.xlabel('X axis')
plt.ylabel('Y axis')
plt.legend()
plt.grid(True)
plt.savefig('test_plot.png')
print("Test plot created successfully")
`;

async function test() {
    try {
        // Connect to MongoDB
        console.log('Connecting to MongoDB:', process.env.MONGO_DB_URI);
        await mongoose.connect(process.env.MONGO_DB_URI);
        console.log('Connected to MongoDB');

        // Initialize the service
        const pythonService = new PythonExecutionService();

        // Execute Python code with options
        console.log('Executing Python code...');
        const result = await pythonService.executeCode(testCode, {
            save_plots: true,
            plot_filename: 'test_mongodb_plot',
            sessionId: 'test_session_123',
            vehicleContext: {
                year: '2020',
                make: 'Toyota',
                model: 'Camry',
                vin: 'TEST123'
            },
            customerContext: {
                name: 'Test Customer',
                dtcCode: 'P0171'
            }
        });

        console.log('\nExecution result:', JSON.stringify(result, null, 2));

        // Check MongoDB directly
        const Plot = mongoose.model('Plot');
        const count = await Plot.countDocuments();
        console.log('\nTotal plots in database:', count);

        if (count > 0) {
            const plots = await Plot.find().select('-imageData').limit(5);
            console.log('\nPlots found:');
            plots.forEach(plot => {
                console.log({
                    imageId: plot.imageId,
                    filename: plot.filename,
                    sessionId: plot.sessionId,
                    executionId: plot.executionId,
                    createdAt: plot.createdAt
                });
            });
        }

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
        process.exit(0);
    }
}

test();