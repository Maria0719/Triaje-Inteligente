import { ConsciousnessLevel } from '@/domain/entities/Patient';

export interface VitalSignsMeasurement {
    heartRate:          { value: number;             confidence?: number };
    respiratoryRate:    { value: number;             confidence?: number };
    painScale:          { value: number;             confidence?: number };
    consciousnessLevel: { value: ConsciousnessLevel; confidence?: number };
}

export interface IVitalSignsDetector {
    /** Runs the measurement, calling onProgress with 0–100 as it proceeds. */
    measure(onProgress: (progress: number) => void): Promise<VitalSignsMeasurement>;
    /** Cancels an in-progress measurement. Safe to call even if never started. */
    cancel(): void;
}
