"""
OBD2 Data Analysis Agent for FastAgent Integration

This module extends the FastAgent system with specialized OBD2 data analysis capabilities.
It processes automotive diagnostic data and provides insights for vehicle health monitoring.
"""

import json
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class OBD2AnalysisAgent:
    """Advanced OBD2 data analysis agent with automotive expertise."""
    
    def __init__(self):
        self.analysis_types = {
            'performance': self._analyze_performance,
            'diagnostics': self._analyze_diagnostics,
            'fuel_efficiency': self._analyze_fuel_efficiency,
            'maintenance_prediction': self._predict_maintenance,
            'driving_behavior': self._analyze_driving_behavior,
            'general': self._general_analysis
        }
        
        # OBD2 parameter thresholds and normal ranges
        self.parameter_thresholds = {
            '010C': {'name': 'Engine RPM', 'normal_range': (600, 6500), 'critical_high': 7000},
            '010D': {'name': 'Vehicle Speed', 'normal_range': (0, 200), 'critical_high': 250},
            '0105': {'name': 'Engine Coolant Temperature', 'normal_range': (80, 105), 'critical_high': 115},
            '010F': {'name': 'Intake Air Temperature', 'normal_range': (-10, 60), 'critical_high': 80},
            '0111': {'name': 'Throttle Position', 'normal_range': (0, 100), 'critical_high': 100},
            '010B': {'name': 'Intake Manifold Pressure', 'normal_range': (20, 100), 'critical_high': 120},
            '0104': {'name': 'Engine Load', 'normal_range': (0, 85), 'critical_high': 95},
            '012F': {'name': 'Fuel Level', 'normal_range': (10, 100), 'critical_low': 5}
        }

    async def analyze_obd2_data(self, analysis_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Main analysis entry point for OBD2 data.
        
        Args:
            analysis_type: Type of analysis to perform
            data: OBD2 data including parameters, vehicle state, etc.
            
        Returns:
            Analysis results with insights and visualizations
        """
        start_time = datetime.now()
        
        try:
            # Validate input data
            if not self._validate_data(data):
                return {
                    'error': 'Invalid or insufficient data provided',
                    'success': False
                }
            
            # Convert parameters to DataFrame for analysis
            df = self._prepare_dataframe(data['parameters'])
            
            # Get analysis function
            analysis_func = self.analysis_types.get(analysis_type, self._general_analysis)
            
            # Perform analysis
            results = await analysis_func(df, data)
            
            # Add metadata
            results.update({
                'analysis_type': analysis_type,
                'processing_time': (datetime.now() - start_time).total_seconds() * 1000,
                'timestamp': datetime.now().isoformat(),
                'data_points_analyzed': len(data.get('parameters', [])),
                'vehicle_info': data.get('vehicleInfo', {}),
                'success': True
            })
            
            return results
            
        except Exception as e:
            logger.error(f"Error in OBD2 analysis: {str(e)}")
            return {
                'error': f'Analysis failed: {str(e)}',
                'success': False,
                'analysis_type': analysis_type,
                'processing_time': (datetime.now() - start_time).total_seconds() * 1000
            }

    def _validate_data(self, data: Dict[str, Any]) -> bool:
        """Validate that required data is present and properly formatted."""
        required_fields = ['parameters']
        
        for field in required_fields:
            if field not in data:
                logger.error(f"Missing required field: {field}")
                return False
        
        if not isinstance(data['parameters'], list) or len(data['parameters']) == 0:
            logger.error("No parameters data provided")
            return False
            
        return True

    def _prepare_dataframe(self, parameters: List[Dict]) -> pd.DataFrame:
        """Convert OBD2 parameters to pandas DataFrame for analysis."""
        # Create DataFrame from parameters
        df = pd.DataFrame(parameters)
        
        # Ensure timestamp column
        if 'timestamp' in df.columns:
            df['timestamp'] = pd.to_datetime(df['timestamp'])
        else:
            df['timestamp'] = pd.to_datetime('now')
        
        # Sort by timestamp
        df = df.sort_values('timestamp')
        
        # Add calculated fields
        df['value_numeric'] = pd.to_numeric(df['formattedValue'], errors='coerce')
        
        return df

    async def _analyze_performance(self, df: pd.DataFrame, data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze vehicle performance metrics."""
        results = {
            'analysis_title': 'Vehicle Performance Analysis',
            'insights': [],
            'metrics': {},
            'visualizations': []
        }
        
        # Engine RPM analysis
        rpm_data = df[df['pid'] == '010C']
        if not rpm_data.empty:
            rpm_stats = {
                'average_rpm': rpm_data['value_numeric'].mean(),
                'max_rpm': rpm_data['value_numeric'].max(),
                'rpm_variance': rpm_data['value_numeric'].var(),
                'idle_time_percentage': (rpm_data['value_numeric'] < 1000).mean() * 100
            }
            results['metrics']['engine_rpm'] = rpm_stats
            
            if rpm_stats['max_rpm'] > 6500:
                results['insights'].append({
                    'type': 'warning',
                    'message': f"High RPM detected: {rpm_stats['max_rpm']:.0f} RPM. Consider checking engine load and driving habits.",
                    'severity': 'medium'
                })
        
        # Speed analysis
        speed_data = df[df['pid'] == '010D']
        if not speed_data.empty:
            speed_stats = {
                'average_speed': speed_data['value_numeric'].mean(),
                'max_speed': speed_data['value_numeric'].max(),
                'speed_variance': speed_data['value_numeric'].var()
            }
            results['metrics']['vehicle_speed'] = speed_stats
        
        # Engine load analysis
        load_data = df[df['pid'] == '0104']
        if not load_data.empty:
            load_stats = {
                'average_load': load_data['value_numeric'].mean(),
                'max_load': load_data['value_numeric'].max(),
                'high_load_percentage': (load_data['value_numeric'] > 80).mean() * 100
            }
            results['metrics']['engine_load'] = load_stats
            
            if load_stats['high_load_percentage'] > 20:
                results['insights'].append({
                    'type': 'info',
                    'message': f"Vehicle operates at high load {load_stats['high_load_percentage']:.1f}% of the time. This may affect fuel efficiency.",
                    'severity': 'low'
                })
        
        # Generate performance visualization
        viz_path = await self._create_performance_visualization(df)
        if viz_path:
            results['visualizations'].append({
                'type': 'performance_chart',
                'path': viz_path,
                'description': 'Engine RPM, Speed, and Load over time'
            })
        
        return results

    async def _analyze_diagnostics(self, df: pd.DataFrame, data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze diagnostic trouble codes and system health."""
        results = {
            'analysis_title': 'Diagnostic Analysis',
            'insights': [],
            'metrics': {},
            'visualizations': [],
            'dtc_analysis': {}
        }
        
        # Analyze DTC codes
        dtc_codes = data.get('dtcCodes', [])
        if dtc_codes:
            results['dtc_analysis'] = {
                'total_codes': len(dtc_codes),
                'active_codes': len([dtc for dtc in dtc_codes if dtc.get('status') != 'cleared']),
                'code_breakdown': {}
            }
            
            # Categorize DTC codes
            for dtc in dtc_codes:
                code = dtc.get('code', '')
                if code.startswith('P0'):
                    category = 'Powertrain'
                elif code.startswith('B0'):
                    category = 'Body'
                elif code.startswith('C0'):
                    category = 'Chassis'
                elif code.startswith('U0'):
                    category = 'Network'
                else:
                    category = 'Unknown'
                
                if category not in results['dtc_analysis']['code_breakdown']:
                    results['dtc_analysis']['code_breakdown'][category] = 0
                results['dtc_analysis']['code_breakdown'][category] += 1
            
            # Add insights based on DTC codes
            if results['dtc_analysis']['active_codes'] > 0:
                results['insights'].append({
                    'type': 'error',
                    'message': f"Found {results['dtc_analysis']['active_codes']} active diagnostic trouble codes. Immediate attention recommended.",
                    'severity': 'high'
                })
        
        # Analyze parameter trends for diagnostic insights
        for pid, threshold_info in self.parameter_thresholds.items():
            param_data = df[df['pid'] == pid]
            if not param_data.empty:
                values = param_data['value_numeric']
                normal_range = threshold_info['normal_range']
                
                # Check for out-of-range values
                out_of_range = values[(values < normal_range[0]) | (values > normal_range[1])]
                if len(out_of_range) > 0:
                    percentage = (len(out_of_range) / len(values)) * 100
                    results['insights'].append({
                        'type': 'warning',
                        'message': f"{threshold_info['name']}: {percentage:.1f}% of readings outside normal range ({normal_range[0]}-{normal_range[1]})",
                        'severity': 'medium' if percentage < 10 else 'high'
                    })
        
        return results

    async def _analyze_fuel_efficiency(self, df: pd.DataFrame, data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze fuel efficiency patterns and provide optimization suggestions."""
        results = {
            'analysis_title': 'Fuel Efficiency Analysis',
            'insights': [],
            'metrics': {},
            'visualizations': [],
            'efficiency_score': 0
        }
        
        # Calculate efficiency metrics
        efficiency_factors = []
        
        # Engine load efficiency
        load_data = df[df['pid'] == '0104']
        if not load_data.empty:
            optimal_load_range = (20, 60)  # Generally most efficient range
            optimal_readings = load_data[
                (load_data['value_numeric'] >= optimal_load_range[0]) & 
                (load_data['value_numeric'] <= optimal_load_range[1])
            ]
            load_efficiency = len(optimal_readings) / len(load_data) * 100
            efficiency_factors.append(load_efficiency)
            
            results['metrics']['load_efficiency'] = {
                'percentage_in_optimal_range': load_efficiency,
                'average_load': load_data['value_numeric'].mean(),
                'recommendation': 'Maintain engine load between 20-60% for optimal fuel efficiency'
            }
        
        # RPM efficiency
        rpm_data = df[df['pid'] == '010C']
        if not rpm_data.empty:
            optimal_rpm_range = (1500, 3000)  # Generally most efficient range
            optimal_rpm_readings = rpm_data[
                (rpm_data['value_numeric'] >= optimal_rpm_range[0]) & 
                (rpm_data['value_numeric'] <= optimal_rpm_range[1])
            ]
            rpm_efficiency = len(optimal_rpm_readings) / len(rpm_data) * 100
            efficiency_factors.append(rpm_efficiency)
            
            results['metrics']['rpm_efficiency'] = {
                'percentage_in_optimal_range': rpm_efficiency,
                'average_rpm': rpm_data['value_numeric'].mean()
            }
        
        # Speed efficiency
        speed_data = df[df['pid'] == '010D']
        if not speed_data.empty:
            # Highway speeds (80-120 km/h) are generally most efficient
            optimal_speed_range = (80, 120)
            highway_readings = speed_data[
                (speed_data['value_numeric'] >= optimal_speed_range[0]) & 
                (speed_data['value_numeric'] <= optimal_speed_range[1])
            ]
            speed_efficiency = len(highway_readings) / len(speed_data) * 100
            efficiency_factors.append(speed_efficiency)
            
            # Analyze acceleration patterns
            speed_changes = speed_data['value_numeric'].diff().abs()
            aggressive_acceleration = (speed_changes > 10).sum()  # Speed changes > 10 km/h
            
            results['metrics']['speed_efficiency'] = {
                'percentage_highway_speed': speed_efficiency,
                'average_speed': speed_data['value_numeric'].mean(),
                'aggressive_acceleration_events': aggressive_acceleration
            }
            
            if aggressive_acceleration > len(speed_data) * 0.1:  # More than 10% of readings
                results['insights'].append({
                    'type': 'warning',
                    'message': f"Detected {aggressive_acceleration} aggressive acceleration events. Smoother acceleration can improve fuel efficiency by 10-15%.",
                    'severity': 'medium'
                })
        
        # Calculate overall efficiency score
        if efficiency_factors:
            results['efficiency_score'] = sum(efficiency_factors) / len(efficiency_factors)
            
            if results['efficiency_score'] > 70:
                efficiency_rating = "Excellent"
            elif results['efficiency_score'] > 50:
                efficiency_rating = "Good"
            elif results['efficiency_score'] > 30:
                efficiency_rating = "Fair"
            else:
                efficiency_rating = "Poor"
            
            results['insights'].append({
                'type': 'info',
                'message': f"Overall fuel efficiency rating: {efficiency_rating} ({results['efficiency_score']:.1f}/100)",
                'severity': 'low'
            })
        
        return results

    async def _predict_maintenance(self, df: pd.DataFrame, data: Dict[str, Any]) -> Dict[str, Any]:
        """Predict maintenance needs based on OBD2 data patterns."""
        results = {
            'analysis_title': 'Predictive Maintenance Analysis',
            'insights': [],
            'metrics': {},
            'visualizations': [],
            'maintenance_recommendations': []
        }
        
        # Analyze coolant temperature trends
        coolant_data = df[df['pid'] == '0105']
        if not coolant_data.empty:
            avg_temp = coolant_data['value_numeric'].mean()
            max_temp = coolant_data['value_numeric'].max()
            
            if avg_temp > 95:
                results['maintenance_recommendations'].append({
                    'component': 'Cooling System',
                    'urgency': 'medium',
                    'description': f'Average coolant temperature is {avg_temp:.1f}°C. Consider checking coolant level and thermostat.',
                    'estimated_cost': '$150-300'
                })
            
            if max_temp > 110:
                results['maintenance_recommendations'].append({
                    'component': 'Cooling System',
                    'urgency': 'high',
                    'description': f'Maximum coolant temperature reached {max_temp:.1f}°C. Immediate inspection recommended.',
                    'estimated_cost': '$200-500'
                })
        
        # Analyze engine load patterns for wear prediction
        load_data = df[df['pid'] == '0104']
        if not load_data.empty:
            high_load_percentage = (load_data['value_numeric'] > 80).mean() * 100
            
            if high_load_percentage > 30:
                results['maintenance_recommendations'].append({
                    'component': 'Engine Oil',
                    'urgency': 'medium',
                    'description': f'High engine load detected {high_load_percentage:.1f}% of the time. Consider more frequent oil changes.',
                    'estimated_cost': '$50-100'
                })
        
        # Analyze RPM patterns for transmission health
        rpm_data = df[df['pid'] == '010C']
        if not rpm_data.empty:
            rpm_variance = rpm_data['value_numeric'].var()
            
            if rpm_variance > 500000:  # High variance indicates rough idling
                results['maintenance_recommendations'].append({
                    'component': 'Engine Tuning',
                    'urgency': 'medium',
                    'description': 'High RPM variance detected. Engine tuning or idle adjustment may be needed.',
                    'estimated_cost': '$100-250'
                })
        
        # Vehicle age-based recommendations
        vehicle_info = data.get('vehicleInfo', {})
        vehicle_year = vehicle_info.get('year')
        if vehicle_year:
            current_year = datetime.now().year
            vehicle_age = current_year - vehicle_year
            
            if vehicle_age > 5:
                results['maintenance_recommendations'].append({
                    'component': 'General Maintenance',
                    'urgency': 'low',
                    'description': f'Vehicle is {vehicle_age} years old. Consider comprehensive inspection of belts, hoses, and fluids.',
                    'estimated_cost': '$200-400'
                })
        
        return results

    async def _analyze_driving_behavior(self, df: pd.DataFrame, data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze driving patterns and provide behavior insights."""
        results = {
            'analysis_title': 'Driving Behavior Analysis',
            'insights': [],
            'metrics': {},
            'visualizations': [],
            'behavior_score': 0
        }
        
        behavior_factors = []
        
        # Analyze speed patterns
        speed_data = df[df['pid'] == '010D']
        if not speed_data.empty:
            # Speed consistency
            speed_changes = speed_data['value_numeric'].diff().abs()
            smooth_driving_percentage = (speed_changes < 5).mean() * 100  # Changes < 5 km/h
            behavior_factors.append(smooth_driving_percentage)
            
            results['metrics']['speed_consistency'] = {
                'smooth_driving_percentage': smooth_driving_percentage,
                'average_speed_change': speed_changes.mean()
            }
            
            # Speeding analysis
            if 'location' in data and data['location']:
                # Assume urban speed limit of 50 km/h for analysis
                speeding_events = (speed_data['value_numeric'] > 60).sum()
                speeding_percentage = (speeding_events / len(speed_data)) * 100
                
                results['metrics']['speeding'] = {
                    'speeding_events': speeding_events,
                    'speeding_percentage': speeding_percentage
                }
                
                if speeding_percentage > 10:
                    results['insights'].append({
                        'type': 'warning',
                        'message': f"Speeding detected in {speeding_percentage:.1f}% of driving time. Consider adhering to speed limits for safety and fuel efficiency.",
                        'severity': 'medium'
                    })
        
        # Analyze throttle patterns
        throttle_data = df[df['pid'] == '0111']
        if not throttle_data.empty:
            # Aggressive acceleration detection
            throttle_changes = throttle_data['value_numeric'].diff()
            aggressive_accel = (throttle_changes > 20).sum()  # Throttle increases > 20%
            
            gentle_driving_percentage = ((throttle_changes < 10) & (throttle_changes > -10)).mean() * 100
            behavior_factors.append(gentle_driving_percentage)
            
            results['metrics']['acceleration_patterns'] = {
                'gentle_driving_percentage': gentle_driving_percentage,
                'aggressive_acceleration_events': aggressive_accel
            }
        
        # Calculate overall behavior score
        if behavior_factors:
            results['behavior_score'] = sum(behavior_factors) / len(behavior_factors)
            
            if results['behavior_score'] > 80:
                behavior_rating = "Excellent"
            elif results['behavior_score'] > 60:
                behavior_rating = "Good"
            elif results['behavior_score'] > 40:
                behavior_rating = "Fair"
            else:
                behavior_rating = "Needs Improvement"
            
            results['insights'].append({
                'type': 'info',
                'message': f"Driving behavior rating: {behavior_rating} ({results['behavior_score']:.1f}/100)",
                'severity': 'low'
            })
        
        return results

    async def _general_analysis(self, df: pd.DataFrame, data: Dict[str, Any]) -> Dict[str, Any]:
        """Perform general analysis combining multiple aspects."""
        results = {
            'analysis_title': 'Comprehensive Vehicle Analysis',
            'insights': [],
            'metrics': {},
            'visualizations': [],
            'summary': {}
        }
        
        # Run all analysis types and combine results
        performance_results = await self._analyze_performance(df, data)
        diagnostic_results = await self._analyze_diagnostics(df, data)
        efficiency_results = await self._analyze_fuel_efficiency(df, data)
        maintenance_results = await self._predict_maintenance(df, data)
        behavior_results = await self._analyze_driving_behavior(df, data)
        
        # Combine insights
        all_insights = (
            performance_results.get('insights', []) +
            diagnostic_results.get('insights', []) +
            efficiency_results.get('insights', []) +
            maintenance_results.get('insights', []) +
            behavior_results.get('insights', [])
        )
        
        # Sort by severity
        severity_order = {'high': 0, 'medium': 1, 'low': 2}
        results['insights'] = sorted(all_insights, key=lambda x: severity_order.get(x.get('severity', 'low'), 2))
        
        # Combine metrics
        results['metrics'] = {
            'performance': performance_results.get('metrics', {}),
            'diagnostics': diagnostic_results.get('metrics', {}),
            'fuel_efficiency': efficiency_results.get('metrics', {}),
            'maintenance': maintenance_results.get('maintenance_recommendations', []),
            'driving_behavior': behavior_results.get('metrics', {})
        }
        
        # Create summary
        results['summary'] = {
            'total_insights': len(results['insights']),
            'high_priority_issues': len([i for i in results['insights'] if i.get('severity') == 'high']),
            'efficiency_score': efficiency_results.get('efficiency_score', 0),
            'behavior_score': behavior_results.get('behavior_score', 0),
            'maintenance_items': len(maintenance_results.get('maintenance_recommendations', []))
        }
        
        return results

    async def _create_performance_visualization(self, df: pd.DataFrame) -> Optional[str]:
        """Create performance visualization chart."""
        try:
            # Create output directory if it doesn't exist
            os.makedirs('/tmp/output', exist_ok=True)
            
            # Set up the plot
            plt.style.use('seaborn-v0_8')
            fig, axes = plt.subplots(3, 1, figsize=(12, 10))
            fig.suptitle('Vehicle Performance Analysis', fontsize=16, fontweight='bold')
            
            # RPM chart
            rpm_data = df[df['pid'] == '010C']
            if not rpm_data.empty:
                axes[0].plot(rpm_data['timestamp'], rpm_data['value_numeric'], 'b-', linewidth=2)
                axes[0].set_title('Engine RPM Over Time')
                axes[0].set_ylabel('RPM')
                axes[0].grid(True, alpha=0.3)
                axes[0].axhline(y=6500, color='r', linestyle='--', alpha=0.7, label='High RPM Warning')
                axes[0].legend()
            
            # Speed chart
            speed_data = df[df['pid'] == '010D']
            if not speed_data.empty:
                axes[1].plot(speed_data['timestamp'], speed_data['value_numeric'], 'g-', linewidth=2)
                axes[1].set_title('Vehicle Speed Over Time')
                axes[1].set_ylabel('Speed (km/h)')
                axes[1].grid(True, alpha=0.3)
            
            # Engine load chart
            load_data = df[df['pid'] == '0104']
            if not load_data.empty:
                axes[2].plot(load_data['timestamp'], load_data['value_numeric'], 'orange', linewidth=2)
                axes[2].set_title('Engine Load Over Time')
                axes[2].set_ylabel('Load (%)')
                axes[2].set_xlabel('Time')
                axes[2].grid(True, alpha=0.3)
                axes[2].axhline(y=80, color='r', linestyle='--', alpha=0.7, label='High Load Warning')
                axes[2].legend()
            
            plt.tight_layout()
            
            # Save the plot
            timestamp = int(datetime.now().timestamp())
            filename = f'performance_analysis_{timestamp}.png'
            filepath = f'/tmp/output/{filename}'
            plt.savefig(filepath, dpi=300, bbox_inches='tight')
            plt.close()
            
            return filepath
            
        except Exception as e:
            logger.error(f"Error creating performance visualization: {str(e)}")
            return None

# Global instance for FastAgent integration
obd2_agent = OBD2AnalysisAgent()

async def analyze_obd2_data(analysis_type: str, data: Dict[str, Any], options: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    FastAgent-compatible function for OBD2 data analysis.
    
    Args:
        analysis_type: Type of analysis to perform
        data: OBD2 data to analyze
        options: Additional analysis options
        
    Returns:
        Analysis results
    """
    try:
        return await obd2_agent.analyze_obd2_data(analysis_type, data)
    except Exception as e:
        logger.error(f"OBD2 analysis error: {str(e)}")
        return {
            'error': f'Analysis failed: {str(e)}',
            'success': False,
            'analysis_type': analysis_type
        }