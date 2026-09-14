/**
 * Tipos del sistema de captura de señal ROI facial.
 *
 * Capa: Infraestructura — vision
 *
 * Define el "contrato de datos" que fluye entre FaceCaptureService (Fase 1)
 * y RppgVitalSignsDetector (Fase 2). Separado en su propio archivo porque:
 *   - useFaceCapture, FaceCaptureService y el futuro detector rPPG importan
 *     estos tipos sin crear dependencias circulares.
 *   - Permite a la Fase 2 consumir el buffer sin conocer cómo se recolectó.
 *
 * No contiene lógica: solo interfaces y tipos.
 */

/**
 * Nombre de la región de interés facial desde la que se muestrea el color.
 * Se elige frente y mejillas porque tienen alta densidad de capilares
 * superficiales, lo que maximiza la señal rPPG.
 */
export type RoiName = 'forehead' | 'leftCheek' | 'rightCheek';

/**
 * Una muestra de color RGB promedio tomada de una región ROI en un instante dado.
 * Se genera una entrada por ROI por frame (3 entradas por frame).
 */
export interface RoiSample {
  /** Marca de tiempo en milisegundos (performance.now()) al tomar la muestra. */
  timestamp: number;
  /** Región del rostro de la que proviene la muestra. */
  roi: RoiName;
  /** Canal rojo promedio del recuadro ROI [0, 255]. */
  r: number;
  /** Canal verde promedio del recuadro ROI [0, 255]. */
  g: number;
  /** Canal azul promedio del recuadro ROI [0, 255]. */
  b: number;
}

/**
 * Buffer acumulado de señal de color durante una sesión de captura.
 * La Fase 2 consumirá este buffer para calcular FC, FR y HRV via rPPG.
 */
export interface RoiSignalBuffer {
  /** Todas las muestras de la sesión (3 por frame: forehead, leftCheek, rightCheek). */
  samples: RoiSample[];
  /** performance.now() cuando comenzó la primera captura de frames. */
  startedAt: number;
  /** Duración transcurrida en ms (calculada en el momento de getBuffer()). */
  durationMs: number;
  /**
   * Fotogramas por segundo aproximados.
   * Calculado como (samples.length / 3) / (durationMs / 1000).
   * Necesario en Fase 2 para diseñar filtros con la frecuencia de muestreo real.
   */
  approxFps: number;
}

/** Estado del ciclo de vida del servicio de captura facial. */
export type FaceCaptureStatus = 'idle' | 'loading' | 'active' | 'error';

/**
 * Calidad de la captura facial evaluada frame a frame.
 * Se expone como estado React en useFaceCapture para mostrar
 * guías al paciente en tiempo real.
 */
export interface FaceCaptureQuality {
  /** Estado actual del servicio de captura. */
  status: FaceCaptureStatus;
  /** true si se detectó al menos un rostro en el frame. */
  faceDetected: boolean;
  /** true si la nariz (landmark #1) está centrada en el encuadre. */
  faceCentered: boolean;
  /** true si la luminancia media del frame está dentro de rango aceptable. */
  lightAdequate: boolean;
  /** true si el movimiento de la nariz entre frames es menor al umbral. */
  motionStable: boolean;
  /** Mensaje de guía en español para mostrar al paciente como overlay. */
  message: string;
}
