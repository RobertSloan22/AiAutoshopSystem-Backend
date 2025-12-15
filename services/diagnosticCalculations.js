// services/diagnosticCalculations.js - Enhanced diagnostic probability calculations

export class DiagnosticCalculations {
    
    // Calculate vacuum leak probability based on fuel trim patterns
    static calculateVacuumLeakProbability(dataStats) {
        let probability = 0;
        
        const fuelTrimShort = parseFloat(dataStats.fuelTrimShortB1.avg);
        const fuelTrimLong = parseFloat(dataStats.fuelTrimLongB1.avg);
        const engineLoad = parseFloat(dataStats.engineLoad.avg);
        const rpm = parseFloat(dataStats.rpm.avg);
        
        // High positive fuel trims indicate lean condition
        if (fuelTrimShort > 8) probability += 30;
        if (fuelTrimShort > 15) probability += 25;
        if (fuelTrimLong > 8) probability += 20;
        if (fuelTrimLong > 12) probability += 15;
        
        // Low load at idle with high trims suggests vacuum leak
        if (rpm < 1000 && engineLoad < 25 && fuelTrimShort > 10) {
            probability += 20;
        }
        
        return Math.min(probability, 95);
    }
    
    // Calculate fuel mixture rich condition probability
    static calculateRichMixtureProbability(dataStats) {
        let probability = 0;
        
        const fuelTrimShort = parseFloat(dataStats.fuelTrimShortB1.avg);
        const fuelTrimLong = parseFloat(dataStats.fuelTrimLongB1.avg);
        const engineLoad = parseFloat(dataStats.engineLoad.avg);
        
        // Negative fuel trims indicate rich condition
        if (fuelTrimShort < -5) probability += 25;
        if (fuelTrimShort < -10) probability += 20;
        if (fuelTrimLong < -5) probability += 20;
        if (fuelTrimLong < -8) probability += 15;
        
        // High load with negative trims
        if (engineLoad > 75 && fuelTrimShort < -3) {
            probability += 15;
        }
        
        return Math.min(probability, 95);
    }
    
    // Calculate lean mixture probability
    static calculateLeanMixtureProbability(dataStats) {
        let probability = 0;
        
        const fuelTrimShort = parseFloat(dataStats.fuelTrimShortB1.avg);
        const fuelTrimLong = parseFloat(dataStats.fuelTrimLongB1.avg);
        const engineTemp = parseFloat(dataStats.engineTemp.avg);
        
        // High positive fuel trims
        if (fuelTrimShort > 10) probability += 30;
        if (fuelTrimShort > 20) probability += 25;
        if (fuelTrimLong > 10) probability += 20;
        
        // Engine running hot with lean condition
        if (engineTemp > 210 && fuelTrimShort > 8) {
            probability += 20;
        }
        
        return Math.min(probability, 95);
    }
    
    // Calculate MAF sensor issue probability
    static calculateMAFSensorProbability(dataStats) {
        let probability = 0;
        
        const fuelTrimShort = parseFloat(dataStats.fuelTrimShortB1.avg);
        const fuelTrimLong = parseFloat(dataStats.fuelTrimLongB1.avg);
        const engineLoad = parseFloat(dataStats.engineLoad.avg);
        const throttlePosition = parseFloat(dataStats.throttlePosition.avg);
        
        // MAF issues cause fuel trim problems across RPM range
        const trimRange = Math.abs(fuelTrimShort) + Math.abs(fuelTrimLong);
        if (trimRange > 15) probability += 25;
        if (trimRange > 25) probability += 20;
        
        // Load vs throttle mismatch suggests airflow measurement issues
        if (throttlePosition > 20 && engineLoad < 30) {
            probability += 15;
        }
        
        // Consistent fuel trim corrections
        if (Math.abs(fuelTrimShort - fuelTrimLong) < 3 && Math.abs(fuelTrimShort) > 8) {
            probability += 15;
        }
        
        return Math.min(probability, 95);
    }
    
    // Calculate oxygen sensor issue probability
    static calculateO2SensorProbability(dataStats, sensorPosition = 'b1s1') {
        let probability = 0;
        
        const fuelTrimShort = parseFloat(dataStats.fuelTrimShortB1.avg);
        const fuelTrimLong = parseFloat(dataStats.fuelTrimLongB1.avg);
        const engineTemp = parseFloat(dataStats.engineTemp.avg);
        
        // O2 sensor issues cause erratic fuel trims
        if (Math.abs(fuelTrimShort) > 12) probability += 20;
        if (Math.abs(fuelTrimLong) > 8) probability += 15;
        
        // Temperature dependency for O2 sensors
        if (engineTemp < 180 && Math.abs(fuelTrimShort) > 15) {
            probability += 10; // Cold engine with trim issues
        }
        
        // Bank 1 Sensor 1 (upstream) more critical
        if (sensorPosition === 'b1s1') {
            if (Math.abs(fuelTrimShort - fuelTrimLong) > 8) {
                probability += 20;
            }
        }
        
        return Math.min(probability, 95);
    }
    
    // Calculate EGR valve issue probability
    static calculateEGRProbability(dataStats) {
        let probability = 0;
        
        const fuelTrimShort = parseFloat(dataStats.fuelTrimShortB1.avg);
        const engineLoad = parseFloat(dataStats.engineLoad.avg);
        const rpm = parseFloat(dataStats.rpm.avg);
        const engineTemp = parseFloat(dataStats.engineTemp.avg);
        
        // EGR issues often show up at idle and low load
        if (rpm < 1000 && Math.abs(fuelTrimShort) > 8) {
            probability += 15;
        }
        
        // EGR stuck open causes lean conditions at idle
        if (rpm < 1000 && fuelTrimShort > 10) {
            probability += 20;
        }
        
        // EGR stuck closed causes rich conditions under load
        if (engineLoad > 60 && fuelTrimShort < -5) {
            probability += 15;
        }
        
        // Temperature related EGR operation
        if (engineTemp > 190 && Math.abs(fuelTrimShort) > 12) {
            probability += 10;
        }
        
        return Math.min(probability, 95);
    }
    
    // Calculate catalytic converter efficiency probability
    static calculateCatalyticConverterProbability(dataStats) {
        let probability = 0;
        
        const engineTemp = parseFloat(dataStats.engineTemp.avg);
        const fuelTrimLong = parseFloat(dataStats.fuelTrimLongB1.avg);
        const engineLoad = parseFloat(dataStats.engineLoad.avg);
        
        // Cat converter efficiency degrades with temperature
        if (engineTemp > 220) probability += 15;
        if (engineTemp > 240) probability += 20;
        
        // Long term fuel trims indicate cat efficiency issues
        if (Math.abs(fuelTrimLong) > 10) probability += 15;
        
        // High load conditions stress catalytic converter
        if (engineLoad > 80 && engineTemp > 210) {
            probability += 20;
        }
        
        return Math.min(probability, 95);
    }
    
    // Calculate fuel injector issue probability
    static calculateFuelInjectorProbability(dataStats) {
        let probability = 0;
        
        const fuelTrimShort = parseFloat(dataStats.fuelTrimShortB1.avg);
        const fuelTrimLong = parseFloat(dataStats.fuelTrimLongB1.avg);
        const engineLoad = parseFloat(dataStats.engineLoad.avg);
        const rpm = parseFloat(dataStats.rpm.avg);
        
        // Injector issues cause fuel trim variations
        const trimDifference = Math.abs(fuelTrimShort - fuelTrimLong);
        if (trimDifference > 8) probability += 20;
        if (trimDifference > 12) probability += 15;
        
        // Load-dependent injector issues
        if (engineLoad > 50 && Math.abs(fuelTrimShort) > 10) {
            probability += 15;
        }
        
        // RPM-dependent issues
        if (rpm > 2000 && Math.abs(fuelTrimShort) > 8) {
            probability += 10;
        }
        
        return Math.min(probability, 95);
    }
    
    // Calculate fuel pump weakness probability
    static calculateFuelPumpProbability(dataStats) {
        let probability = 0;
        
        const engineLoad = parseFloat(dataStats.engineLoad.avg);
        const throttlePosition = parseFloat(dataStats.throttlePosition.avg);
        const fuelTrimShort = parseFloat(dataStats.fuelTrimShortB1.avg);
        const rpm = parseFloat(dataStats.rpm.avg);
        
        // Fuel pump issues show under high demand
        if (engineLoad > 70 && fuelTrimShort > 12) {
            probability += 25;
        }
        
        // High throttle position with lean condition
        if (throttlePosition > 60 && fuelTrimShort > 15) {
            probability += 20;
        }
        
        // High RPM with fuel delivery issues
        if (rpm > 3000 && fuelTrimShort > 10) {
            probability += 15;
        }
        
        return Math.min(probability, 95);
    }
    
    // Calculate overall engine health based on all parameters
    static calculateOverallEngineHealth(dataStats) {
        let healthScore = 100;
        
        const engineTemp = parseFloat(dataStats.engineTemp.avg);
        const fuelTrimShort = parseFloat(dataStats.fuelTrimShortB1.avg);
        const fuelTrimLong = parseFloat(dataStats.fuelTrimLongB1.avg);
        const engineLoad = parseFloat(dataStats.engineLoad.avg);
        
        // Temperature issues
        if (engineTemp > 220) healthScore -= 15;
        if (engineTemp > 240) healthScore -= 20;
        if (engineTemp < 160) healthScore -= 10;
        
        // Fuel trim issues
        if (Math.abs(fuelTrimShort) > 8) healthScore -= 10;
        if (Math.abs(fuelTrimShort) > 15) healthScore -= 15;
        if (Math.abs(fuelTrimLong) > 8) healthScore -= 8;
        if (Math.abs(fuelTrimLong) > 12) healthScore -= 12;
        
        // Load efficiency
        if (engineLoad > 90) healthScore -= 5; // High load stress
        
        return Math.max(healthScore, 5);
    }
    
    // Main calculation method that orchestrates all diagnostic calculations
    static calculateAllDiagnostics(dataStats) {
        return {
            vacuum_leak: this.calculateVacuumLeakProbability(dataStats),
            fuel_mixture_rich: this.calculateRichMixtureProbability(dataStats),
            fuel_mixture_lean: this.calculateLeanMixtureProbability(dataStats),
            egr_valve_issue: this.calculateEGRProbability(dataStats),
            mass_air_flow_sensor: this.calculateMAFSensorProbability(dataStats),
            oxygen_sensor_b1s1: this.calculateO2SensorProbability(dataStats, 'b1s1'),
            oxygen_sensor_b1s2: this.calculateO2SensorProbability(dataStats, 'b1s2'),
            catalytic_converter: this.calculateCatalyticConverterProbability(dataStats),
            fuel_injector_issue: this.calculateFuelInjectorProbability(dataStats),
            intake_manifold_issue: Math.round(this.calculateVacuumLeakProbability(dataStats) * 0.7), // Related to vacuum leak
            pcv_valve_issue: Math.round(this.calculateVacuumLeakProbability(dataStats) * 0.6), // Related to vacuum leak
            fuel_pump_weak: this.calculateFuelPumpProbability(dataStats),
            carbon_buildup: Math.round((this.calculateFuelInjectorProbability(dataStats) + this.calculateEGRProbability(dataStats)) * 0.4),
            timing_issue: Math.round((this.calculateMAFSensorProbability(dataStats) + this.calculateFuelInjectorProbability(dataStats)) * 0.3),
            overall_engine_health: this.calculateOverallEngineHealth(dataStats)
        };
    }
}

export default DiagnosticCalculations;