/**
 * Contrato de la señal cruda de color por ROI.
 * Fase 2 consumirá estos tipos para calcular los signos vitales con rPPG.
 * No modificar sin revisar RppgVitalSignsDetector.
 */

export type RoiName = 'forehead' | 'leftCheek' | 'rightCheek';

/** Una muestra de color promediada de una ROI en un frame concreto. */
export interface RoiSample {
    /** Marca de tiempo del frame: captureTime (si rVFC lo provee) o presentationTime. En ms, performance.now()-base. */
    timestamp: number;
    roi: RoiName;
    r: number;   // 0–255, media del canal rojo en la ROI
    g: number;   // 0–255, media del canal verde
    b: number;   // 0–255, media del canal azul
}

/** Buffer de serie temporal de muestras RGB por ROI. */
export interface RoiSignalBuffer {
    samples: RoiSample[];       // ordenadas cronológicamente
    startedAt: number;          // performance.now() del primer frame procesado
    durationMs: number;         // tiempo transcurrido desde startedAt al momento de leer el buffer
    approxFps: number;          // frames reales por segundo (samples/roi/segundo)
}

export type FaceCaptureStatus = 'idle' | 'loading' | 'active' | 'error';

/** Estado de calidad del frame actual, para guiar al usuario en pantalla. */
export interface FaceCaptureQuality {
    status: FaceCaptureStatus;
    faceDetected: boolean;
    faceCentered: boolean;   // punta de nariz dentro del tercio central del frame
    lightAdequate: boolean;  // luminancia media de la frente dentro del rango aceptable
    motionStable: boolean;   // desplazamiento frame a frame por debajo del umbral
    message: string;         // guía en español para el usuario
}
