import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type {
    FaceCaptureQuality,
    FaceCaptureStatus,
    RoiName,
    RoiSample,
    RoiSignalBuffer,
} from './RoiSignalTypes';

// ── requestVideoFrameCallback types (not yet in TS 5.8 lib.dom.d.ts) ────────

interface VideoFrameCallbackMetadata {
    captureTime?: DOMHighResTimeStamp;
    presentationTime: DOMHighResTimeStamp;
    expectedDisplayTime: DOMHighResTimeStamp;
    width: number;
    height: number;
    mediaTime: number;
    presentedFrames: number;
}

type VideoWithRVFC = HTMLVideoElement & {
    requestVideoFrameCallback(
        cb: (now: DOMHighResTimeStamp, metadata: VideoFrameCallbackMetadata) => void,
    ): number;
    cancelVideoFrameCallback(handle: number): void;
};

// ── CDN / model assets ───────────────────────────────────────────────────────
//
// DESPLIEGUE: estos assets se cargan desde CDN y requieren acceso a internet.
// Para kioscos hospitalarios en redes restringidas o sin conexión, copia los
// archivos a /public/mediapipe/ y actualiza las constantes a rutas relativas.
// Guía oficial: https://developers.google.com/mediapipe/solutions/setup_web#serving_wasm
// La versión del CDN DEBE coincidir con la versión instalada del paquete npm.
const MEDIAPIPE_WASM_URL =
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const FACE_LANDMARKER_MODEL_URL =
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// ── Sampling canvas dimensions ────────────────────────────────────────────────
//
// Canvas offscreen en el que se muestrea el color de cada ROI.
// Menor resolución = menos CPU por frame.
// Mayor resolución = más píxeles promediados por ROI → mejor SNR para rPPG.
// Ajustar en Fase 2 si la señal sale ruidosa; 160×120 es el punto de partida.
export const SAMPLE_CANVAS_WIDTH = 160;
export const SAMPLE_CANVAS_HEIGHT = 120;

// ── Tuning constants ──────────────────────────────────────────────────────────

// Fracción del canvas que define el semiancho/semialto de cada ROI
const ROI_HALF_W_FRAC = 0.10; // ≈ 16 px en canvas de 160 px
const ROI_HALF_H_FRAC = 0.09; // ≈ 11 px en canvas de 120 px

const LIGHT_MIN_LUMINANCE = 40;   // 0–255; por debajo = demasiado oscuro
const LIGHT_MAX_LUMINANCE = 220;  // 0–255; por encima = sobreexpuesto
const MOTION_THRESHOLD_PX = 3;    // píxeles del canvas entre frames consecutivos
const CENTER_MARGIN = 0.30;        // la nariz debe estar dentro de [CM, 1-CM] en cada eje

// Índices de landmarks del modelo FaceLandmarker de 478 puntos de MediaPipe
const LM_FOREHEAD_CENTER  = 10;   // centro superior de la frente
const LM_NOSE_TIP         = 4;    // punta de la nariz (ancla para mejillas y centrado)
const LM_LEFT_SILHOUETTE  = 234;  // silhouette izquierda del rostro a nivel de mejilla
const LM_RIGHT_SILHOUETTE = 454;  // silhouette derecha del rostro a nivel de mejilla

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Programa el siguiente frame: usa requestVideoFrameCallback si está disponible
 * (dispara una vez por frame real de cámara, da timestamps precisos de captura),
 * con fallback a requestAnimationFrame (dispara al ritmo de la pantalla).
 *
 * Con rVFC: usa captureTime si está disponible (cuándo captó la cámara el frame),
 * si no presentationTime (cuándo el browser lo entregó). Ambos son monótonos
 * crecientes en ms y sirven para detectForVideo.
 *
 * Devuelve una función de cancelación.
 */
function scheduleNextFrame(
    video: HTMLVideoElement,
    onFrame: (timestamp: number) => void,
): () => void {
    if ('requestVideoFrameCallback' in video) {
        let handle: number;
        const cb = (_now: DOMHighResTimeStamp, meta: VideoFrameCallbackMetadata) => {
            onFrame(meta.captureTime ?? meta.presentationTime);
            handle = (video as VideoWithRVFC).requestVideoFrameCallback(cb);
        };
        handle = (video as VideoWithRVFC).requestVideoFrameCallback(cb);
        return () => (video as VideoWithRVFC).cancelVideoFrameCallback(handle);
    }

    // rAF fallback: puede procesar frames duplicados si la pantalla corre más
    // rápido que la cámara, pero el guard de timestamp en processFrame los filtra.
    let rafId: number;
    const cb = () => {
        onFrame(performance.now());
        rafId = requestAnimationFrame(cb);
    };
    rafId = requestAnimationFrame(cb);
    return () => cancelAnimationFrame(rafId);
}

function buildQualityMessage(
    status: FaceCaptureStatus,
    faceDetected: boolean,
    faceCentered: boolean,
    lightAdequate: boolean,
    motionStable: boolean,
): string {
    if (status === 'loading') return 'Iniciando análisis facial…';
    if (status === 'error')   return 'Análisis facial no disponible (modo demo)';
    if (!faceDetected)        return 'Pon el rostro frente a la cámara';
    if (!faceCentered)        return 'Centra el rostro en la imagen';
    if (!lightAdequate)       return 'Necesitas más luz o evita el contraluz';
    if (!motionStable)        return 'Mantén el rostro quieto';
    return 'Perfecto, mantén la posición';
}

// ── FaceCaptureService ────────────────────────────────────────────────────────

/**
 * Servicio de captura facial (capa infrastructure).
 *
 * Responsabilidades:
 *  1. Carga el modelo MediaPipe FaceLandmarker de forma lazy.
 *  2. Corre un loop cuadro a cuadro sobre un <video> (vía rVFC con fallback a rAF).
 *  3. Por frame: detecta landmarks → extrae ROIs → muestrea color RGB en un canvas
 *     offscreen reducido → acumula RoiSignalBuffer.
 *  4. Emite FaceCaptureQuality en cada frame para que la UI guíe al usuario.
 *
 * Diseñado para ser usado directamente por RppgVitalSignsDetector (Fase 2) sin
 * depender de React. La capa React usa el hook useFaceCapture como envoltorio.
 *
 * Degradación: si MediaPipe falla al cargar, status queda en 'error' y start()
 * no hace nada; el kiosko sigue funcionando con SimulatedVitalSignsDetector.
 */
export class FaceCaptureService {
    private landmarker: FaceLandmarker | null = null;
    private readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D;
    private samples: RoiSample[] = [];
    private startedAt = 0;
    private lastTimestamp = -1;
    private prevNoseTip: { x: number; y: number } | null = null;
    private cancelFrame: (() => void) | null = null;
    private readonly onQuality: (q: FaceCaptureQuality) => void;

    constructor(onQuality: (q: FaceCaptureQuality) => void) {
        this.onQuality = onQuality;
        this.canvas = document.createElement('canvas');
        this.canvas.width = SAMPLE_CANVAS_WIDTH;
        this.canvas.height = SAMPLE_CANVAS_HEIGHT;
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    }

    /**
     * Carga el modelo MediaPipe de forma asíncrona.
     * Emite status 'loading' → 'active' (o 'error' si falla).
     * Seguro llamar varias veces; la segunda llamada no hace nada si ya cargó.
     */
    async initialize(): Promise<void> {
        if (this.landmarker) return;
        this.emitQuality('loading', false, false, false, false);
        try {
            const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
            this.landmarker = await FaceLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: FACE_LANDMARKER_MODEL_URL,
                    delegate: 'GPU',
                },
                // VIDEO: mantiene contexto temporal entre frames (necesario para rPPG).
                // Los timestamps de detectForVideo deben ser estrictamente crecientes en ms.
                runningMode: 'VIDEO',
                numFaces: 1,
            });
            // Emitir estado inicial sin cara aún detectada
            this.emitQuality('active', false, false, true, true);
        } catch (err) {
            console.error('[FaceCaptureService] No se pudo cargar MediaPipe:', err);
            this.emitQuality('error', false, false, false, false);
        }
    }

    /** Inicia el loop de captura sobre el elemento <video> proporcionado. */
    start(video: HTMLVideoElement): void {
        if (!this.landmarker) return; // initialize() no se completó o falló
        this.samples = [];
        this.startedAt = performance.now();
        this.lastTimestamp = -1;
        this.prevNoseTip = null;
        this.cancelFrame = scheduleNextFrame(video, (ts) => this.processFrame(video, ts));
    }

    /** Detiene el loop. El buffer queda disponible vía getBuffer(). */
    stop(): void {
        this.cancelFrame?.();
        this.cancelFrame = null;
    }

    /** Devuelve una copia inmutable del buffer acumulado hasta este momento. */
    getBuffer(): RoiSignalBuffer {
        const now = performance.now();
        const durationMs = this.startedAt > 0 ? now - this.startedAt : 0;
        const foreheadSamples = this.samples.filter(s => s.roi === 'forehead').length;
        const approxFps = durationMs > 0 ? (foreheadSamples / durationMs) * 1000 : 0;
        return {
            samples: [...this.samples],
            startedAt: this.startedAt,
            durationMs,
            approxFps,
        };
    }

    /** Libera el modelo y el canvas. Llama a stop() si el loop sigue corriendo. */
    dispose(): void {
        this.stop();
        try { this.landmarker?.close(); } catch { /* ignorar errores al cerrar */ }
        this.landmarker = null;
    }

    // ── Frame processing ──────────────────────────────────────────────────────

    private processFrame(video: HTMLVideoElement, timestamp: number): void {
        // Esperar a que el video tenga datos (puede pasar si rAF se dispara antes que la cámara)
        if (video.readyState < 2) return;

        // Guard de monotonía: MediaPipe lanza error si timestamp <= el anterior
        if (timestamp <= this.lastTimestamp) return;
        this.lastTimestamp = timestamp;

        // 1. Dibujar frame actual al canvas reducido (para muestreo de color)
        this.ctx.drawImage(video, 0, 0, SAMPLE_CANVAS_WIDTH, SAMPLE_CANVAS_HEIGHT);

        // 2. Detectar landmarks desde el elemento <video> (resolución completa → mejor precisión)
        const result = this.landmarker!.detectForVideo(video, timestamp);
        const lms = result.faceLandmarks[0];

        if (!lms || lms.length < 478) {
            this.emitQuality('active', false, false, true, true);
            return;
        }

        const lmForehead = lms[LM_FOREHEAD_CENTER];
        const lmNose     = lms[LM_NOSE_TIP];
        const lmLeft     = lms[LM_LEFT_SILHOUETTE];
        const lmRight    = lms[LM_RIGHT_SILHOUETTE];

        // 3. Centros de las ROI en coordenadas del canvas reducido
        const hw = Math.max(1, Math.round(SAMPLE_CANVAS_WIDTH  * ROI_HALF_W_FRAC));
        const hh = Math.max(1, Math.round(SAMPLE_CANVAS_HEIGHT * ROI_HALF_H_FRAC));

        const rois: Array<{ name: RoiName; cx: number; cy: number }> = [
            {
                name: 'forehead',
                cx: lmForehead.x * SAMPLE_CANVAS_WIDTH,
                cy: lmForehead.y * SAMPLE_CANVAS_HEIGHT,
            },
            {
                // Punto medio entre la silhouette izquierda y la nariz
                name: 'leftCheek',
                cx: ((lmLeft.x + lmNose.x) / 2) * SAMPLE_CANVAS_WIDTH,
                cy: ((lmLeft.y + lmNose.y) / 2) * SAMPLE_CANVAS_HEIGHT,
            },
            {
                // Punto medio entre la silhouette derecha y la nariz
                name: 'rightCheek',
                cx: ((lmRight.x + lmNose.x) / 2) * SAMPLE_CANVAS_WIDTH,
                cy: ((lmRight.y + lmNose.y) / 2) * SAMPLE_CANVAS_HEIGHT,
            },
        ];

        // 4. Muestrear color e insertar en el buffer
        const roiColors = rois.map(roi => ({
            name: roi.name,
            ...this.sampleRoi(roi.cx, roi.cy, hw, hh),
        }));

        for (const { name, r, g, b } of roiColors) {
            this.samples.push({ timestamp, roi: name, r, g, b });
        }

        // 5. Métricas de calidad
        const faceCentered =
            lmNose.x > CENTER_MARGIN && lmNose.x < 1 - CENTER_MARGIN &&
            lmNose.y > CENTER_MARGIN && lmNose.y < 1 - CENTER_MARGIN;

        // Luminancia de la ROI de frente (zona más estable, sin pelo ni sombras laterales)
        const { r: fr, g: fg, b: fb } = roiColors[0];
        const luminance = fr * 0.299 + fg * 0.587 + fb * 0.114;
        const lightAdequate = luminance > LIGHT_MIN_LUMINANCE && luminance < LIGHT_MAX_LUMINANCE;

        let motionStable = true;
        if (this.prevNoseTip) {
            const dx = (lmNose.x - this.prevNoseTip.x) * SAMPLE_CANVAS_WIDTH;
            const dy = (lmNose.y - this.prevNoseTip.y) * SAMPLE_CANVAS_HEIGHT;
            motionStable = Math.hypot(dx, dy) < MOTION_THRESHOLD_PX;
        }
        this.prevNoseTip = { x: lmNose.x, y: lmNose.y };

        this.emitQuality('active', true, faceCentered, lightAdequate, motionStable);
    }

    /** Lee el promedio R/G/B de una región rectangular en el canvas offscreen. */
    private sampleRoi(
        cx: number,
        cy: number,
        hw: number,
        hh: number,
    ): { r: number; g: number; b: number } {
        const x = Math.max(0, Math.round(cx - hw));
        const y = Math.max(0, Math.round(cy - hh));
        const w = Math.min(SAMPLE_CANVAS_WIDTH  - x, hw * 2);
        const h = Math.min(SAMPLE_CANVAS_HEIGHT - y, hh * 2);
        if (w <= 0 || h <= 0) return { r: 128, g: 128, b: 128 };

        const { data } = this.ctx.getImageData(x, y, w, h);
        let r = 0, g = 0, b = 0;
        const n = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
        }
        return { r: r / n, g: g / n, b: b / n };
    }

    private emitQuality(
        status: FaceCaptureStatus,
        faceDetected: boolean,
        faceCentered: boolean,
        lightAdequate: boolean,
        motionStable: boolean,
    ): void {
        this.onQuality({
            status,
            faceDetected,
            faceCentered,
            lightAdequate,
            motionStable,
            message: buildQualityMessage(
                status, faceDetected, faceCentered, lightAdequate, motionStable,
            ),
        });
    }
}
