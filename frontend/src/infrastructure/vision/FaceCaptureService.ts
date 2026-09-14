/**
 * Servicio de captura facial con MediaPipe FaceLandmarker.
 *
 * Capa: Infraestructura — vision
 *
 * Responsabilidades:
 *   1. Carga lazy del modelo MediaPipe FaceLandmarker (runningMode: 'VIDEO').
 *   2. Loop de procesamiento de frames usando requestVideoFrameCallback (con
 *      fallback a requestAnimationFrame si el navegador no lo soporta).
 *   3. Por frame: detección de 478 landmarks → evaluación de calidad → extracción
 *      de 3 ROI (frente, mejilla izq, mejilla der) → muestreo de color RGB → buffer.
 *   4. Degradación elegante: si MediaPipe falla al cargar, el kiosco sigue
 *      funcionando con vitales simulados (SimulatedVitalSignsDetector).
 *
 * Relación con el resto del sistema:
 *   - useFaceCapture (Fase 1) envuelve esta clase para exponer quality como
 *     estado React.
 *   - RppgVitalSignsDetector (Fase 2) usará esta clase directamente para
 *     calcular FC/FR/HRV desde el buffer acumulado.
 *   - No depende de React ni del dominio; es infraestructura pura.
 *
 * Privacidad: el video del paciente se procesa únicamente en memoria local.
 * Ningún frame se envía a servidores externos. El modelo WASM corre en el
 * navegador del usuario. Las únicas peticiones de red son la carga del modelo
 * y el WASM desde CDN pública (activos de código, no datos del paciente).
 */

import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type {
  FaceCaptureQuality,
  FaceCaptureStatus,
  RoiName,
  RoiSignalBuffer,
} from './RoiSignalTypes';

// ─── Constantes ───────────────────────────────────────────────────────────────

/** URL del directorio WASM de MediaPipe Tasks Vision en jsDelivr CDN. */
const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';

/** URL del modelo FaceLandmarker (float16, 478 landmarks). */
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

/** Ancho del canvas de muestreo. Reducido para minimizar el costo de getImageData. */
const SAMPLE_CANVAS_WIDTH = 160;

/** Alto del canvas de muestreo. */
const SAMPLE_CANVAS_HEIGHT = 120;

/**
 * Tamaño del recuadro ROI como fracción del ancho/alto del canvas.
 * 0.08 × 160 = ~13 px de ancho; 0.08 × 120 = ~10 px de alto.
 */
const ROI_BOX_FRACTION = 0.08;

/**
 * Umbral de desplazamiento normalizado (0–1) de la nariz entre frames
 * para considerar la cabeza como "estable".
 */
const MOTION_THRESHOLD = 0.015;

/** Luminancia mínima aceptable (0–255). Por debajo: demasiado oscuro. */
const MIN_LUMINANCE = 40;

/** Luminancia máxima aceptable (0–255). Por encima: sobreexpuesto. */
const MAX_LUMINANCE = 220;

// ─── Tipos auxiliares ───────────────────────────────────────────────────────
//
// requestVideoFrameCallback/cancelVideoFrameCallback y VideoFrameCallbackMetadata
// ya forman parte de lib.dom.d.ts en la versión de TypeScript de este proyecto
// (declarados directamente sobre HTMLVideoElement), así que no se necesita una
// interfaz local que los augmente — de hecho, una versión local más angosta
// del tipo entra en conflicto con la declaración global real. Disponible en
// tiempo de ejecución en Chrome 83+, Edge y Safari 15.4+.

// Alias local para los puntos de landmark de MediaPipe (x, y, z normalizados 0–1).
type Landmark = { x: number; y: number; z: number };

// ─── Clase principal ──────────────────────────────────────────────────────────

export class FaceCaptureService {
  private faceLandmarker: FaceLandmarker | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  /** Buffer interno mutable; se retorna una copia en getBuffer(). */
  private buffer: RoiSignalBuffer = { samples: [], startedAt: 0, durationMs: 0, approxFps: 0 };

  private frameHandle: number | null = null;
  /** true si el loop usa requestVideoFrameCallback; false si usa rAF. */
  private useRVFC = false;
  private running = false;
  private video: HTMLVideoElement | null = null;
  private onQualityUpdate: ((quality: FaceCaptureQuality) => void) | null = null;
  /** Posición de la nariz en el frame anterior, para calcular movimiento. */
  private prevNoseLandmark: Landmark | null = null;
  private status: FaceCaptureStatus = 'idle';

  // ─── API pública ────────────────────────────────────────────────────────────

  /**
   * Inicia la captura facial. Carga MediaPipe de forma lazy y arranca el loop.
   * Si MediaPipe falla, emite status 'error' con mensaje "Modo demo activo"
   * y retorna sin lanzar excepción (el kiosco sigue con vitales simulados).
   *
   * @param video - Elemento <video> con el stream de la cámara.
   * @param onQualityUpdate - Callback invocado cada frame con la calidad actual.
   */
  async start(
    video: HTMLVideoElement,
    onQualityUpdate: (quality: FaceCaptureQuality) => void,
  ): Promise<void> {
    this.video = video;
    this.onQualityUpdate = onQualityUpdate;
    this.status = 'loading';
    this.emitQuality({
      faceDetected: false,
      faceCentered: false,
      lightAdequate: false,
      motionStable: false,
      message: 'Cargando detector facial...',
    });

    // Canvas offscreen (nunca se añade al DOM) con willReadFrequently para
    // optimizar las llamadas frecuentes a getImageData (CPU-based rendering).
    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_CANVAS_WIDTH;
    canvas.height = SAMPLE_CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      this.status = 'error';
      this.emitQuality({
        faceDetected: false,
        faceCentered: false,
        lightAdequate: false,
        motionStable: false,
        message: 'Modo demo activo',
      });
      return;
    }
    this.canvas = canvas;
    this.ctx = ctx;

    try {
      const fileset = await FilesetResolver.forVisionTasks(WASM_CDN);
      this.faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: 'GPU', // WebGL cuando está disponible; falla → catch → modo demo
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });
    } catch (err) {
      console.error('[FaceCaptureService] MediaPipe load failed:', err);
      this.status = 'error';
      this.emitQuality({
        faceDetected: false,
        faceCentered: false,
        lightAdequate: false,
        motionStable: false,
        message: 'Modo demo activo',
      });
      return; // El kiosco sigue con SimulatedVitalSignsDetector
    }

    this.status = 'active';
    this.running = true;
    this.buffer = { samples: [], startedAt: performance.now(), durationMs: 0, approxFps: 0 };
    this.startLoop();
  }

  /**
   * Detiene el loop de frames. Seguro de llamar aunque no haya sesión activa.
   * Llamar dispose() después para liberar el modelo MediaPipe.
   */
  stop(): void {
    this.running = false;
    if (this.frameHandle !== null) {
      if (this.useRVFC && this.video) {
        this.video.cancelVideoFrameCallback(this.frameHandle);
      } else {
        cancelAnimationFrame(this.frameHandle);
      }
      this.frameHandle = null;
    }
  }

  /**
   * Retorna una copia instantánea del buffer con durationMs y approxFps calculados.
   * Seguro de llamar antes, durante o después de una sesión.
   */
  getBuffer(): RoiSignalBuffer {
    const durationMs =
      this.buffer.startedAt > 0 ? performance.now() - this.buffer.startedAt : 0;
    // Dividir por 3: cada frame produce exactamente 3 muestras (forehead + 2 cheeks)
    const frames = this.buffer.samples.length / 3;
    const approxFps = durationMs > 0 ? frames / (durationMs / 1000) : 0;
    return {
      samples: [...this.buffer.samples], // snapshot para proteger contra mutaciones en curso
      startedAt: this.buffer.startedAt,
      durationMs,
      approxFps,
    };
  }

  /**
   * Libera todos los recursos: detiene el loop, cierra el modelo MediaPipe y
   * nullifica las referencias al video y al canvas.
   */
  dispose(): void {
    this.stop();
    if (this.faceLandmarker) {
      this.faceLandmarker.close();
      this.faceLandmarker = null;
    }
    this.video = null;
    this.onQualityUpdate = null;
    this.canvas = null;
    this.ctx = null;
  }

  // ─── Implementación del loop ────────────────────────────────────────────────

  /**
   * Elige el mecanismo de loop según soporte del navegador:
   * - requestVideoFrameCallback (rVFC): sincronizado con frames reales del video,
   *   timestamps precisos (Chrome 83+, Edge, Safari 15.4+).
   * - requestAnimationFrame: fallback universal, no garantiza un frame nuevo por tick.
   */
  private startLoop(): void {
    if (!this.video) return;
    const video = this.video;

    if ('requestVideoFrameCallback' in video) {
      this.useRVFC = true;
      const loop = (now: DOMHighResTimeStamp) => {
        if (!this.running) return;
        this.processFrame(now);
        this.frameHandle = video.requestVideoFrameCallback(loop);
      };
      this.frameHandle = video.requestVideoFrameCallback(loop);
    } else {
      this.useRVFC = false;
      const loop = (now: DOMHighResTimeStamp) => {
        if (!this.running) return;
        this.processFrame(now);
        this.frameHandle = requestAnimationFrame(loop);
      };
      this.frameHandle = requestAnimationFrame(loop);
    }
  }

  /**
   * Procesa un frame: detecta landmarks → evalúa calidad → acumula señal ROI.
   * @param timestamp - Marca de tiempo del frame (performance.now() o rVFC.presentationTime).
   */
  private processFrame(timestamp: DOMHighResTimeStamp): void {
    if (!this.video || !this.faceLandmarker || !this.ctx || !this.canvas) return;
    // readyState < 2 significa que el video aún no tiene datos de frame disponibles
    if (this.video.readyState < 2) return;

    // Dibuja el frame actual al canvas reducido UNA sola vez por tick,
    // luego extrae los píxeles en memoria para todos los cálculos siguientes.
    this.ctx.drawImage(this.video, 0, 0, SAMPLE_CANVAS_WIDTH, SAMPLE_CANVAS_HEIGHT);
    const imageData = this.ctx.getImageData(0, 0, SAMPLE_CANVAS_WIDTH, SAMPLE_CANVAS_HEIGHT);

    // detectForVideo requiere el mismo HTMLVideoElement en cada llamada (runningMode: VIDEO)
    const result = this.faceLandmarker.detectForVideo(this.video, timestamp);
    const landmarks: Landmark[] | undefined = result.faceLandmarks[0];
    const faceDetected = (landmarks?.length ?? 0) > 0;

    const { adequate: lightAdequate, dark: isDark } = this.checkLuminance(imageData);
    let faceCentered = false;
    let motionStable = false;

    if (faceDetected && landmarks) {
      // Landmark #1 = punta de la nariz. Se usa como ancla de posición y movimiento
      // porque es estable bajo cambios de expresión y orientación moderada.
      const nose = landmarks[1];
      faceCentered = Math.abs(nose.x - 0.5) < 0.20 && Math.abs(nose.y - 0.5) < 0.25;

      if (this.prevNoseLandmark) {
        const dx = Math.abs(nose.x - this.prevNoseLandmark.x);
        const dy = Math.abs(nose.y - this.prevNoseLandmark.y);
        motionStable = dx < MOTION_THRESHOLD && dy < MOTION_THRESHOLD;
      } else {
        // Primer frame con rostro detectado: sin referencia previa, se asume estable
        motionStable = true;
      }
      this.prevNoseLandmark = nose;

      // Acumular muestras de color aunque la calidad no sea perfecta;
      // la Fase 2 puede filtrar o ponderar las muestras según los flags de calidad.
      this.accumulateRois(landmarks, imageData, timestamp);
    } else {
      this.prevNoseLandmark = null;
    }

    this.emitQuality(
      this.buildQualityFields(faceDetected, faceCentered, lightAdequate, motionStable, isDark),
    );
  }

  // ─── Extracción de ROI ──────────────────────────────────────────────────────

  /**
   * Calcula los centros de los 3 recuadros ROI a partir de los landmarks y
   * empuja una muestra de color por ROI al buffer interno.
   *
   * Índices del modelo MediaPipe FaceLandmarker 478 puntos:
   *   #10  — centro de la frente superior (entre la línea capilar y las cejas).
   *          Zona con alta densidad de capilares superficiales para rPPG.
   *   #234 — borde exterior del pómulo izquierdo.
   *   #454 — borde exterior del pómulo derecho.
   *   #4   — punto de referencia en el puente nasal.
   *
   * Los centros de las mejillas se calculan como el punto medio entre el landmark
   * del pómulo (#234 / #454) y el puente nasal (#4). Usar solo el pómulo colocaría
   * el ROI demasiado cerca del borde; el promedio apunta al centro de la piel de la mejilla.
   */
  private accumulateRois(
    landmarks: Landmark[],
    imageData: ImageData,
    timestamp: number,
  ): void {
    const rois: Array<{ roi: RoiName; cx: number; cy: number }> = [
      {
        roi: 'forehead',
        cx: landmarks[10].x,
        cy: landmarks[10].y,
      },
      {
        roi: 'leftCheek',
        cx: (landmarks[234].x + landmarks[4].x) / 2,
        cy: (landmarks[234].y + landmarks[4].y) / 2,
      },
      {
        roi: 'rightCheek',
        cx: (landmarks[454].x + landmarks[4].x) / 2,
        cy: (landmarks[454].y + landmarks[4].y) / 2,
      },
    ];

    for (const { roi, cx, cy } of rois) {
      const { r, g, b } = this.sampleRoi(imageData, cx, cy);
      this.buffer.samples.push({ timestamp, roi, r, g, b });
    }
  }

  /**
   * Calcula el promedio RGB de un recuadro ROI centrado en (cx, cy).
   *
   * @param imageData - Datos de píxeles del canvas completo (SAMPLE_CANVAS_WIDTH × SAMPLE_CANVAS_HEIGHT).
   * @param cx - Centro X normalizado [0, 1].
   * @param cy - Centro Y normalizado [0, 1].
   * @returns Valores RGB promedio [0, 255].
   */
  private sampleRoi(
    imageData: ImageData,
    cx: number,
    cy: number,
  ): { r: number; g: number; b: number } {
    const pixelCX = Math.round(cx * SAMPLE_CANVAS_WIDTH);
    const pixelCY = Math.round(cy * SAMPLE_CANVAS_HEIGHT);

    // halfW/halfH: mitad del lado del recuadro ROI en píxeles del canvas reducido
    const halfW = Math.max(1, Math.round((ROI_BOX_FRACTION * SAMPLE_CANVAS_WIDTH) / 2));
    const halfH = Math.max(1, Math.round((ROI_BOX_FRACTION * SAMPLE_CANVAS_HEIGHT) / 2));

    // Clamp para no salir del canvas
    const x0 = Math.max(0, pixelCX - halfW);
    const x1 = Math.min(SAMPLE_CANVAS_WIDTH - 1, pixelCX + halfW);
    const y0 = Math.max(0, pixelCY - halfH);
    const y1 = Math.min(SAMPLE_CANVAS_HEIGHT - 1, pixelCY + halfH);

    let r = 0, g = 0, b = 0, count = 0;
    const { data } = imageData;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const idx = (y * SAMPLE_CANVAS_WIDTH + x) * 4; // RGBA → canal en bytes 0,1,2
        r += data[idx];
        g += data[idx + 1];
        b += data[idx + 2];
        count++;
      }
    }
    if (count === 0) return { r: 0, g: 0, b: 0 };
    return { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) };
  }

  // ─── Evaluación de calidad ──────────────────────────────────────────────────

  /**
   * Comprueba si la luminancia promedio del frame está dentro del rango aceptable.
   * Muestrea cada 4 píxeles (stride=16 bytes) para reducir el trabajo por frame.
   *
   * @returns adequate - true si la luminancia está entre MIN_LUMINANCE y MAX_LUMINANCE.
   * @returns dark - true si es demasiado oscuro (para diferenciar el mensaje de guía).
   */
  private checkLuminance(imageData: ImageData): { adequate: boolean; dark: boolean } {
    const { data } = imageData;
    let total = 0;
    let count = 0;
    // Stride de 16 bytes = 4 píxeles por paso; reduce el trabajo ~75% con error < 1%
    for (let i = 0; i < data.length; i += 16) {
      total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      count++;
    }
    const avgLuminance = count > 0 ? total / count : 0;
    return {
      adequate: avgLuminance >= MIN_LUMINANCE && avgLuminance <= MAX_LUMINANCE,
      dark: avgLuminance < MIN_LUMINANCE,
    };
  }

  /**
   * Construye los campos de calidad con mensaje de guía en español.
   * El orden de prioridad de los mensajes sigue la lógica de corrección:
   *   la luz se verifica primero porque sin iluminación adecuada la detección
   *   facial no funciona de todos modos.
   */
  private buildQualityFields(
    faceDetected: boolean,
    faceCentered: boolean,
    lightAdequate: boolean,
    motionStable: boolean,
    isDark: boolean,
  ): Omit<FaceCaptureQuality, 'status'> {
    let message: string;
    if (!lightAdequate) {
      message = isDark ? 'Busca un ambiente más iluminado' : 'Evita luces directas sobre tu rostro';
    } else if (!faceDetected) {
      message = 'Coloca tu rostro frente a la cámara';
    } else if (!faceCentered) {
      message = 'Centra tu rostro en el encuadre';
    } else if (!motionStable) {
      message = 'Mantén la cabeza quieta';
    } else {
      message = 'Mantén la posición';
    }
    return { faceDetected, faceCentered, lightAdequate, motionStable, message };
  }

  /** Emite el estado de calidad actual al callback registrado en start(). */
  private emitQuality(fields: Omit<FaceCaptureQuality, 'status'>): void {
    this.onQualityUpdate?.({ ...fields, status: this.status });
  }
}
