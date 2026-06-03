import { IVitalSignsDetector, VitalSignsMeasurement } from '@/domain/ports/IVitalSignsDetector';

const MEASUREMENT_DURATION_MS = 10_000;
const PROGRESS_INTERVAL_MS = 200;
const TOTAL_TICKS = MEASUREMENT_DURATION_MS / PROGRESS_INTERVAL_MS; // 50

export class SimulatedVitalSignsDetector implements IVitalSignsDetector {
    private intervalId: number | null = null;
    private timeoutId: number | null = null;

    measure(onProgress: (progress: number) => void): Promise<VitalSignsMeasurement> {
        return new Promise<VitalSignsMeasurement>(resolve => {
            let ticks = 0;

            this.intervalId = window.setInterval(() => {
                ticks += 1;
                const progress = Math.min(100, Math.round((ticks / TOTAL_TICKS) * 100));
                onProgress(progress);
            }, PROGRESS_INTERVAL_MS);

            this.timeoutId = window.setTimeout(() => {
                if (this.intervalId !== null) window.clearInterval(this.intervalId);
                resolve({
                    heartRate:          { value: Math.floor(65 + Math.random() * 46) },
                    respiratoryRate:    { value: Math.floor(14 + Math.random() * 9) },
                    painScale:          { value: Math.floor(1 + Math.random() * 7) },
                    consciousnessLevel: { value: 'Alerta' },
                });
            }, MEASUREMENT_DURATION_MS);
        });
    }

    cancel(): void {
        if (this.intervalId !== null) {
            window.clearInterval(this.intervalId);
            this.intervalId = null;
        }
        if (this.timeoutId !== null) {
            window.clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }
}
