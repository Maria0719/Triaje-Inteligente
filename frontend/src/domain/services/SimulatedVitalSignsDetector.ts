/**
 * Implementación simulada del detector de signos vitales.
 *
 * Capa: Dominio — services
 *
 * Implementa IVitalSignsDetector usando Math.random() y temporizadores
 * del navegador para generar valores plausibles sin acceder a hardware
 * real. Es el adaptador de "prueba/demo" del puerto IVitalSignsDetector.
 *
 * Nota (Fase 3): painScale y consciousnessLevel fueron eliminados de esta
 * implementación porque ahora son auto-reportados por el paciente en pasos
 * dedicados del kiosco. Este detector solo simula lo que mediría la cámara.
 *
 * Esta clase DEBE ser reemplazada en el futuro por RppgVitalSignsDetector
 * (Fase 2); PatientKioskPage no necesitará cambiar porque depende únicamente
 * del puerto IVitalSignsDetector, no de esta clase concreta.
 */

import { IVitalSignsDetector, VitalSignsMeasurement } from '@/domain/ports/IVitalSignsDetector';

/** Duración total de la medición en milisegundos. */
const MEASUREMENT_DURATION_MS = 10_000;

/** Intervalo entre actualizaciones de progreso en milisegundos. */
const PROGRESS_INTERVAL_MS = 200;

export class SimulatedVitalSignsDetector implements IVitalSignsDetector {
  private intervalId: number | null = null;
  private timeoutId: number | null = null;

  /**
   * Inicia la simulación de medición.
   * Emite progreso cada PROGRESS_INTERVAL_MS ms y resuelve con valores
   * aleatorios dentro de rangos fisiológicos normales tras MEASUREMENT_DURATION_MS ms.
   * Incluye hrv y spo2 simulados como stub para la futura Fase 2.
   *
   * @param onProgress - Recibe valores de 0 a 100 conforme avanza la medición.
   * @returns Promise con los signos vitales generados (sin dolor ni consciencia).
   */
  measure(onProgress: (progress: number) => void): Promise<VitalSignsMeasurement> {
    return new Promise(resolve => {
      const totalTicks = MEASUREMENT_DURATION_MS / PROGRESS_INTERVAL_MS; // 50 ticks
      let ticks = 0;

      this.intervalId = window.setInterval(() => {
        ticks += 1;
        const progress = Math.min(100, Math.round((ticks / totalTicks) * 100));
        onProgress(progress);
      }, PROGRESS_INTERVAL_MS);

      this.timeoutId = window.setTimeout(() => {
        window.clearInterval(this.intervalId!);
        this.intervalId = null;
        resolve({
          heartRate:      { value: Math.floor(65 + Math.random() * 46), confidence: 0.85 + Math.random() * 0.1 },  // 65–110 bpm
          respiratoryRate:{ value: Math.floor(14 + Math.random() * 9),  confidence: 0.80 + Math.random() * 0.1 },  // 14–22 rpm
          hrv:            { value: Math.floor(25 + Math.random() * 55), confidence: 0.70 + Math.random() * 0.15 }, // 25–80 ms RMSSD
          spo2:           { value: Math.floor(95 + Math.random() * 5),  confidence: 0.65 + Math.random() * 0.2 },  // 95–99 %
        });
      }, MEASUREMENT_DURATION_MS);
    });
  }

  /**
   * Detiene la medición en curso y limpia los temporizadores.
   * Seguro de llamar aunque no haya una medición activa.
   */
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
