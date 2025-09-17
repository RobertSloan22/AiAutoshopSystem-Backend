#!/usr/bin/env python3
"""
Verification script to test plot generation for OBD2 analysis
This ensures matplotlib is properly configured and can generate plots
"""

import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
import sys
import json

def test_basic_plot():
    """Test basic matplotlib functionality"""
    print("Testing basic matplotlib plot generation...")
    
    try:
        # Create simple plot
        x = np.linspace(0, 10, 100)
        y = np.sin(x)
        
        plt.figure(figsize=(10, 6))
        plt.plot(x, y)
        plt.title('Test Plot: Sine Wave')
        plt.xlabel('X')
        plt.ylabel('Y')
        plt.savefig('/tmp/test_basic_plot.png', dpi=150, bbox_inches='tight')
        plt.close()
        
        print("✅ Basic plot generated successfully")
        return True
    except Exception as e:
        print(f"❌ Basic plot generation failed: {e}")
        return False

def test_obd2_analysis_plots():
    """Test OBD2-specific plot generation"""
    print("\nTesting OBD2 analysis plot generation...")
    
    try:
        # Generate sample OBD2 data
        np.random.seed(42)
        time_points = 100
        time = np.arange(time_points)
        
        data = {
            'timestamp': pd.date_range('2024-01-01', periods=time_points, freq='S'),
            'rpm': 2000 + np.random.normal(0, 200, time_points),
            'speed': 60 + np.random.normal(0, 5, time_points),
            'engineTemp': 195 + np.random.normal(0, 3, time_points),
            'throttlePosition': 45 + np.random.normal(0, 10, time_points),
            'engineLoad': 65 + np.random.normal(0, 8, time_points)
        }
        
        df = pd.DataFrame(data)
        
        # Test 1: Time Series Plot
        plt.figure(figsize=(12, 8))
        
        plt.subplot(3, 1, 1)
        plt.plot(df['timestamp'], df['rpm'], 'b-', label='RPM')
        plt.ylabel('RPM')
        plt.legend()
        plt.title('OBD2 Time Series Analysis')
        
        plt.subplot(3, 1, 2)
        plt.plot(df['timestamp'], df['speed'], 'g-', label='Speed (mph)')
        plt.ylabel('Speed (mph)')
        plt.legend()
        
        plt.subplot(3, 1, 3)
        plt.plot(df['timestamp'], df['engineTemp'], 'r-', label='Engine Temp (°F)')
        plt.ylabel('Temperature (°F)')
        plt.xlabel('Time')
        plt.legend()
        
        plt.tight_layout()
        plt.savefig('/tmp/test_obd2_timeseries.png', dpi=150, bbox_inches='tight')
        plt.close()
        
        print("✅ Time series plot generated")
        
        # Test 2: Correlation Heatmap
        plt.figure(figsize=(10, 8))
        correlation_data = df[['rpm', 'speed', 'engineTemp', 'throttlePosition', 'engineLoad']].corr()
        sns.heatmap(correlation_data, annot=True, cmap='coolwarm', center=0, 
                    square=True, linewidths=1, cbar_kws={"shrink": 0.8})
        plt.title('OBD2 Parameter Correlation Heatmap')
        plt.tight_layout()
        plt.savefig('/tmp/test_obd2_correlation.png', dpi=150, bbox_inches='tight')
        plt.close()
        
        print("✅ Correlation heatmap generated")
        
        # Test 3: Box Plots for Anomaly Detection
        plt.figure(figsize=(12, 6))
        box_data = [df['rpm'], df['speed']*50, df['engineTemp']*10, 
                    df['throttlePosition']*50, df['engineLoad']*30]
        positions = [1, 2, 3, 4, 5]
        
        bp = plt.boxplot(box_data, positions=positions, patch_artist=True)
        
        for patch in bp['boxes']:
            patch.set_facecolor('lightblue')
        
        plt.xticks(positions, ['RPM', 'Speed', 'Temp', 'Throttle', 'Load'])
        plt.ylabel('Normalized Values')
        plt.title('OBD2 Parameter Distribution - Anomaly Detection')
        plt.grid(True, axis='y', alpha=0.3)
        plt.tight_layout()
        plt.savefig('/tmp/test_obd2_boxplots.png', dpi=150, bbox_inches='tight')
        plt.close()
        
        print("✅ Box plots generated")
        
        return True
        
    except Exception as e:
        print(f"❌ OBD2 plot generation failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def verify_plot_in_python_execution():
    """Generate the exact code that would be used in analysis"""
    print("\nGenerating production-ready OBD2 analysis code...")
    
    analysis_code = '''
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns

# Fetch OBD2 session data (simulated here)
session_data = {
    'rpm': [2000, 2100, 2200, 2150, 2050, 2000, 1950, 2000, 2100, 2200],
    'speed': [0, 10, 20, 30, 35, 40, 35, 30, 20, 10],
    'engineTemp': [160, 170, 180, 190, 195, 195, 195, 195, 195, 195],
    'throttlePosition': [0, 20, 40, 60, 65, 70, 65, 50, 30, 10],
    'engineLoad': [20, 30, 50, 70, 75, 80, 75, 60, 40, 25]
}

df = pd.DataFrame(session_data)

# Chart 1: Time Series
plt.figure(figsize=(12, 8))
time = range(len(df))

plt.subplot(3, 1, 1)
plt.plot(time, df['rpm'], 'b-', linewidth=2)
plt.ylabel('RPM')
plt.title('OBD2 Session Analysis - Time Series', fontsize=14, fontweight='bold')
plt.grid(True, alpha=0.3)

plt.subplot(3, 1, 2)
plt.plot(time, df['speed'], 'g-', linewidth=2)
plt.ylabel('Speed (mph)')
plt.grid(True, alpha=0.3)

plt.subplot(3, 1, 3)
plt.plot(time, df['engineTemp'], 'r-', linewidth=2)
plt.ylabel('Engine Temp (°F)')
plt.xlabel('Time (samples)')
plt.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig('/tmp/obd2_analysis_timeseries.png', dpi=150, bbox_inches='tight')
plt.close()

# Chart 2: Correlation Matrix
plt.figure(figsize=(10, 8))
corr = df.corr()
mask = np.triu(np.ones_like(corr, dtype=bool))
sns.heatmap(corr, mask=mask, annot=True, fmt='.2f', cmap='coolwarm', 
            center=0, square=True, linewidths=1, cbar_kws={"shrink": .8})
plt.title('OBD2 Parameters Correlation Matrix', fontsize=14, fontweight='bold')
plt.tight_layout()
plt.savefig('/tmp/obd2_analysis_correlation.png', dpi=150, bbox_inches='tight')
plt.close()

# Chart 3: Statistical Summary
fig, axes = plt.subplots(2, 3, figsize=(15, 10))
fig.suptitle('OBD2 Statistical Analysis - Distribution & Outliers', fontsize=16, fontweight='bold')

params = ['rpm', 'speed', 'engineTemp', 'throttlePosition', 'engineLoad']
colors = ['blue', 'green', 'red', 'orange', 'purple']

for idx, (param, color) in enumerate(zip(params, colors)):
    ax = axes[idx // 3, idx % 3]
    data = df[param]
    
    # Box plot
    bp = ax.boxplot(data, vert=True, patch_artist=True)
    bp['boxes'][0].set_facecolor(color)
    bp['boxes'][0].set_alpha(0.6)
    
    # Add mean line
    ax.axhline(y=data.mean(), color=color, linestyle='--', linewidth=2, label=f'Mean: {data.mean():.1f}')
    
    ax.set_ylabel(param)
    ax.set_title(f'{param} Distribution')
    ax.legend()
    ax.grid(True, alpha=0.3)

# Remove empty subplot
fig.delaxes(axes[1, 2])

plt.tight_layout()
plt.savefig('/tmp/obd2_analysis_statistics.png', dpi=150, bbox_inches='tight')
plt.close()

print("✅ Successfully generated 3 OBD2 analysis charts")
print("Charts saved to:")
print("  1. /tmp/obd2_analysis_timeseries.png")
print("  2. /tmp/obd2_analysis_correlation.png") 
print("  3. /tmp/obd2_analysis_statistics.png")
'''

    # Save the code for reference
    with open('/tmp/obd2_analysis_code.py', 'w') as f:
        f.write(analysis_code)
    
    print("✅ Production code template saved to /tmp/obd2_analysis_code.py")
    
    # Execute it to verify
    try:
        exec(analysis_code)
        print("✅ Production code executed successfully")
        return True
    except Exception as e:
        print(f"❌ Production code execution failed: {e}")
        return False

def main():
    """Run all verification tests"""
    print("=" * 60)
    print("OBD2 Plot Generation Verification")
    print("=" * 60)
    
    results = {
        'basic_plot': test_basic_plot(),
        'obd2_plots': test_obd2_analysis_plots(),
        'production_code': verify_plot_in_python_execution()
    }
    
    print("\n" + "=" * 60)
    print("VERIFICATION SUMMARY")
    print("=" * 60)
    
    for test, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{test}: {status}")
    
    all_passed = all(results.values())
    
    if all_passed:
        print("\n🎉 All plot generation tests passed!")
        print("The backend should be able to generate OBD2 analysis plots correctly.")
    else:
        print("\n⚠️  Some tests failed. Check the error messages above.")
        print("Common issues:")
        print("  - Missing matplotlib or dependencies")
        print("  - File permission issues in /tmp directory")
        print("  - Backend not configured for Agg backend")
    
    # Output JSON summary for programmatic use
    summary = {
        'all_tests_passed': all_passed,
        'test_results': results,
        'generated_files': [
            '/tmp/test_basic_plot.png',
            '/tmp/test_obd2_timeseries.png',
            '/tmp/test_obd2_correlation.png',
            '/tmp/test_obd2_boxplots.png',
            '/tmp/obd2_analysis_timeseries.png',
            '/tmp/obd2_analysis_correlation.png',
            '/tmp/obd2_analysis_statistics.png',
            '/tmp/obd2_analysis_code.py'
        ] if all_passed else []
    }
    
    with open('/tmp/plot_verification_results.json', 'w') as f:
        json.dump(summary, f, indent=2)
    
    print(f"\nDetailed results saved to: /tmp/plot_verification_results.json")
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())