/**
 * Puerto (interfaz) para la detección de signos vitales por cámara.
 *
 * Capa: Dominio — ports
 *
 * Define el contrato que cualquier implementación de medición de signos
 * vitales debe cumplir (simulada, rPPG, dispositivo externo, etc.).
 * La página PatientKioskPage depende únicamente de esta interfaz; las
 * implementaciones concretas viven en domain/services.
 *
 * Nota de diseño (Fase 3):
 *   painScale y consciousnessLevel fueron eliminados porque el paciente
 *   los auto-reporta en pasos dedicados del kiosco. El detector solo mide
 *   lo que la cámara puede cuantificar objetivamente.
 */

/** Resultado de una medición por cámara de signos vitales. */
export interface VitalSignsMeasurement {
  heartRate: { value: number; confidence?: number };
  respiratoryRate: { value: number; confidence?: number };
  /** HRV (RMSSD en ms) — solo disponible con detector rPPG real (Fase 2). */
  hrv?: { value: number; confidence?: number };
  /** SpO2 estimado por ratio-of-ratios — SIEMPRE marcar como no clínico. */
  spo2?: { value: number; confidence?: number };
}

export interface IVitalSignsDetector {
  /**
   * Inicia la medición de signos vitales y notifica el progreso.
   *
   * @param onProgress - Callback invocado periódicamente con un valor
   *   entre 0 y 100 que representa el avance global de la medición.
   * @returns Promise que resuelve con los valores medidos al completarse.
   */
  measure(onProgress: (progress: number) => void): Promise<VitalSignsMeasurement>;

  /**
   * Cancela la medición en curso y libera todos los recursos (timers,
   * streams, etc.) que la implementación haya adquirido.
   */
  cancel(): void;
}
