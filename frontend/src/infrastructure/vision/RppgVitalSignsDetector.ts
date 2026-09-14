/**
 * Implementación REAL del detector de signos vitales, basada en rPPG
 * (fotopletismografía remota) sobre la señal de color capturada por cámara.
 *
 * Capa: Infraestructura — vision
 *
 * Qué hace:
 *   Implementa IVitalSignsDetector (mismo puerto que SimulatedVitalSignsDetector)
 *   usando FaceCaptureService para capturar ~20 s de señal RGB facial y el
 *   pipeline de signalProcessing.ts para calcular frecuencia cardíaca,
 *   frecuencia respiratoria, HRV (RMSSD) y SpO2 estimado a partir de ella.
 *
 * Relación con el resto del sistema:
 *   - Es el adaptador "real" del puerto IVitalSignsDetector (Fase 2),
 *     reemplazando a SimulatedVitalSignsDetector en PatientKioskPage.
 *   - Usa FaceCaptureService DIRECTAMENTE (no useFaceCapture) porque necesita
 *     integrar el buffer de señal en su propio ciclo de medición y no
 *     requiere el estado React de calidad; en su lugar expone un callback
 *     `onQuality` opcional para que el kiosco muestre el mismo overlay de
 *     guía sin instanciar un segundo FaceLandmarker en paralelo (correr dos
 *     instancias de MediaPipe/GPU al mismo tiempo sería un desperdicio de
 *     recursos en hardware de kiosco).
 *   - Todo el cálculo ocurre en el navegador; el buffer de píxeles nunca
 *     se envía a un servidor.
 *
 * Por qué existe separado de signalProcessing.ts:
 *   - signalProcessing.ts contiene solo funciones puras y testeables.
 *   - Esta clase es la orquestación con estado (temporizadores, ciclo de
 *     vida de FaceCaptureService, cancelación) que las funciones puras no
 *     deben conocer.
 */

import { IVitalSignsDetector, VitalSignsMeasurement } from '@/domain/ports/IVitalSignsDetector';
import { FaceCaptureService } from './FaceCaptureService';
import type { FaceCaptureQuality, RoiSignalBuffer } from './RoiSignalTypes';
import {
  averageChannelAcrossRois,
  resampleUniform,
  detrend,
  normalize,
  applyPOS,
  bandpassFilterFFT,
  findDominantFrequency,
  detectPeaks,
  computeRRIntervalsMs,
  computeRMSSD,
  computeAcDc,
  estimateSpo2,
  clamp,
} from './signalProcessing';

// ─── Constantes ─────────────────────────────────────────────────────────────

/** Duración total de la captura de señal, en milisegundos. Ajustable. */
const CAPTURE_DURATION_MS = 20_000;

/** Intervalo entre actualizaciones de progreso, en milisegundos. */
const PROGRESS_INTERVAL_MS = 200;

/**
 * Frecuencia de muestreo a la que se reinterpola la señal antes de
 * analizarla. Se fija a un valor razonable en vez de usar approxFps
 * directamente porque approxFps puede fluctuar frame a frame; resamplear
 * a una tasa fija simplifica el resto del pipeline (bandas de frecuencia,
 * ventana de POS, etc. quedan expresadas en Hz de forma consistente).
 */
const TARGET_SAMPLE_RATE_HZ = 30;

/** Banda de frecuencia cardíaca: 0.7–4 Hz ≈ 42–240 bpm. */
const HEART_RATE_BAND_HZ: [number, number] = [0.7, 4];

/** Banda de frecuencia respiratoria: 0.1–0.5 Hz ≈ 6–30 rpm. */
const RESPIRATORY_RATE_BAND_HZ: [number, number] = [0.1, 0.5];

/** Ventana de detrend en segundos: suficiente para no confundir el pulso con drift. */
const DETREND_WINDOW_SECONDS = 1.5;

/** Mínimo de muestras reinterpoladas para intentar el análisis; por debajo, la señal es demasiado corta/pobre para producir algo confiable. */
const MIN_USABLE_SAMPLES = 16;

/** Cada frame produce 3 muestras crudas (frente + mejilla izq. + mejilla der.), ver FaceCaptureService.accumulateRois. */
const ROIS_PER_FRAME = 3;

/** Mínimo de intervalos R-R para que el RMSSD tenga algún sentido estadístico. */
const MIN_RR_INTERVALS_FOR_HRV = 8;

/**
 * Frecuencia cardíaca máxima fisiológicamente plausible, en bpm. Deriva del
 * límite superior de HEART_RATE_BAND_HZ (4 Hz = 240 bpm) para no introducir
 * un segundo número mágico desacoplado de la banda que realmente se analiza.
 */
const MAX_PLAUSIBLE_HEART_RATE_BPM = HEART_RATE_BAND_HZ[1] * 60;

/**
 * Intervalo mínimo entre picos R-R aceptados por detectPeaks, en ms
 * (periodo refractario: ~250 ms a 240 bpm). Dos picos más cerca que esto no
 * pueden corresponder a dos latidos reales — dos oscilaciones de ruido
 * separadas por menos de este intervalo se tratarían, sin este límite, como
 * dos latidos distintos y contaminarían tanto la FC como el RMSSD de HRV.
 */
const MIN_PEAK_INTERVAL_MS = 60_000 / MAX_PLAUSIBLE_HEART_RATE_BPM;

/**
 * Penalización de confidence aplicada a la frecuencia respiratoria frente a
 * la cardíaca (ver comentario en processBuffer sobre por qué FR se extrae
 * del canal verde crudo detrended en vez de la señal POS): ese mismo canal
 * también puede contener parpadeos de luz ambiente o drift de movimiento
 * lento dentro de la banda 0.1–0.5 Hz, que se verían como un "pico" de FR
 * igual de limpio que uno respiratorio real. Como no hay forma de
 * distinguirlos solo con esta señal, la confidence de FR se limita a una
 * fracción de la de FC — más conservadora a propósito.
 */
const RESPIRATORY_CONFIDENCE_PENALTY = 0.6;

// ─── Clase principal ────────────────────────────────────────────────────────

export class RppgVitalSignsDetector implements IVitalSignsDetector {
  private readonly video: HTMLVideoElement;
  private readonly onQuality?: (quality: FaceCaptureQuality) => void;

  private service: FaceCaptureService | null = null;
  private progressIntervalId: number | null = null;
  private timeoutId: number | null = null;
  private cancelled = false;

  /**
   * @param video - Elemento <video> con el stream de cámara ya activo.
   *   El detector no abre la cámara; asume que el caller (PatientKioskPage)
   *   ya la abrió y asignó a este elemento.
   * @param options.onQuality - Callback opcional invocado con la misma
   *   información de calidad que expondría useFaceCapture (rostro detectado,
   *   centrado, luz, movimiento), para que la UI muestre guía en tiempo real
   *   sin necesitar una segunda instancia de FaceCaptureService.
   */
  constructor(video: HTMLVideoElement, options?: { onQuality?: (quality: FaceCaptureQuality) => void }) {
    this.video = video;
    this.onQuality = options?.onQuality;
  }

  /**
   * Inicia la captura y el análisis. Ver el docblock del archivo para la
   * relación entre esta clase y FaceCaptureService/signalProcessing.
   *
   * @param onProgress - Recibe valores de 0 a 100 conforme avanza la captura
   *   (tiempo transcurrido / CAPTURE_DURATION_MS × 100).
   * @returns Promise que resuelve con los signos vitales calculados, o se
   *   rechaza si MediaPipe no pudo cargar (la UI debe capturar el rechazo y
   *   caer a SimulatedVitalSignsDetector como "Modo demo").
   */
  measure(onProgress: (progress: number) => void): Promise<VitalSignsMeasurement> {
    return new Promise((resolve, reject) => {
      this.cancelled = false;
      const service = new FaceCaptureService();
      this.service = service;

      let latestQuality: FaceCaptureQuality | null = null;
      const handleQuality = (quality: FaceCaptureQuality) => {
        latestQuality = quality;
        this.onQuality?.(quality);
      };

      service
        .start(this.video, handleQuality)
        .then(() => {
          if (this.cancelled) return;

          // FaceCaptureService.start() nunca lanza: si MediaPipe falló al
          // cargar, resuelve de todos modos pero deja status 'error' en el
          // último quality emitido. Ese es el único punto donde podemos
          // detectar la falla y decidir si vale la pena seguir.
          if (!latestQuality || latestQuality.status === 'error') {
            service.dispose();
            this.service = null;
            reject(new Error('No se pudo iniciar la detección facial (MediaPipe no disponible).'));
            return;
          }

          this.runCaptureWindow(service, onProgress, resolve, reject);
        })
        .catch(err => {
          service.dispose();
          this.service = null;
          reject(err instanceof Error ? err : new Error(String(err)));
        });
    });
  }

  /**
   * Cancela la medición en curso: detiene el loop de frames, libera el
   * modelo MediaPipe y limpia los temporizadores. La promesa de measure()
   * queda simplemente sin resolver (mismo patrón que SimulatedVitalSignsDetector;
   * el caller ya ignora el resultado tras cancelar).
   */
  cancel(): void {
    this.cancelled = true;
    if (this.progressIntervalId !== null) {
      window.clearInterval(this.progressIntervalId);
      this.progressIntervalId = null;
    }
    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.service) {
      this.service.stop();
      this.service.dispose();
      this.service = null;
    }
  }

  // ─── Captura ────────────────────────────────────────────────────────────

  /**
   * Programa el progreso periódico y el corte de captura a CAPTURE_DURATION_MS,
   * luego procesa el buffer acumulado y resuelve/rechaza la promesa de measure().
   */
  private runCaptureWindow(
    service: FaceCaptureService,
    onProgress: (progress: number) => void,
    resolve: (value: VitalSignsMeasurement) => void,
    reject: (reason: Error) => void,
  ): void {
    const startedAt = performance.now();

    this.progressIntervalId = window.setInterval(() => {
      const elapsed = performance.now() - startedAt;
      onProgress(clamp((elapsed / CAPTURE_DURATION_MS) * 100, 0, 100));
    }, PROGRESS_INTERVAL_MS);

    this.timeoutId = window.setTimeout(() => {
      if (this.progressIntervalId !== null) {
        window.clearInterval(this.progressIntervalId);
        this.progressIntervalId = null;
      }
      onProgress(100);

      service.stop();
      const buffer = service.getBuffer();
      service.dispose();
      this.service = null;

      if (this.cancelled) return;

      try {
        resolve(this.processBuffer(buffer));
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    }, CAPTURE_DURATION_MS);
  }

  // ─── Procesamiento de señal ─────────────────────────────────────────────

  /**
   * Convierte el RoiSignalBuffer capturado en un VitalSignsMeasurement,
   * aplicando el pipeline de signalProcessing.ts. Ver el docblock de
   * signalProcessing.ts para el detalle de cada paso (POS, FFT, picos, SpO2).
   */
  private processBuffer(buffer: RoiSignalBuffer): VitalSignsMeasurement {
    const redSeries = averageChannelAcrossRois(buffer, 'r');
    const greenSeries = averageChannelAcrossRois(buffer, 'g');
    const blueSeries = averageChannelAcrossRois(buffer, 'b');

    // targetFps: usamos approxFps real del buffer como guía, pero acotado a
    // un rango razonable [10, 30] — un dispositivo lento no debería inflar
    // artificialmente la resolución de frecuencia, y uno muy rápido no
    // necesita más de 30 Hz para señales fisiológicas de hasta 4 Hz.
    const targetFps = clamp(Math.round(buffer.approxFps || 15), 10, TARGET_SAMPLE_RATE_HZ);

    const rRaw = resampleUniform(redSeries.timestamps, redSeries.values, targetFps);
    const gRaw = resampleUniform(greenSeries.timestamps, greenSeries.values, targetFps);
    const bRaw = resampleUniform(blueSeries.timestamps, blueSeries.values, targetFps);

    if (rRaw.length < MIN_USABLE_SAMPLES) {
      // Señal insuficiente (p. ej. rostro casi nunca detectado durante los 20 s):
      // se devuelve un resultado de confianza 0 en vez de lanzar, para que la
      // UI pueda mostrar advertencias sin descartar todo el flujo.
      return this.zeroConfidenceMeasurement();
    }

    const detrendWindowSamples = Math.max(3, Math.round(DETREND_WINDOW_SECONDS * targetFps));
    const gDetrended = detrend(gRaw, detrendWindowSamples);

    // POS se aplica sobre los canales CRUDOS (no detrended/normalizados):
    // el propio algoritmo normaliza por la media de cada ventana temporal
    // (ver signalProcessing.applyPOS), lo cual asume valores de intensidad
    // de píxel reales, no una señal ya centrada en 0.
    const posSignal = applyPOS(rRaw, gRaw, bRaw, targetFps);

    // ── Frecuencia cardíaca + HRV, desde la señal de pulso (POS) ──
    const heartBandSignal = bandpassFilterFFT(posSignal, targetFps, ...HEART_RATE_BAND_HZ);
    const heartResult = findDominantFrequency(posSignal, targetFps, ...HEART_RATE_BAND_HZ);
    const peakIndices = detectPeaks(heartBandSignal, targetFps, MIN_PEAK_INTERVAL_MS);
    const rrIntervalsMs = computeRRIntervalsMs(peakIndices, targetFps);
    const rmssd = computeRMSSD(rrIntervalsMs);

    // ── Frecuencia respiratoria, desde el canal verde detrended (no POS) ──
    // POS está diseñado para SUPRIMIR componentes no pulsátiles como el
    // drift respiratorio; usarlo aquí eliminaría justo la señal que
    // buscamos. La modulación respiratoria de la intensidad (RIIV) es
    // visible directamente en el canal verde crudo una vez quitada la
    // tendencia DC de iluminación.
    //
    // RIESGO CONOCIDO: precisamente por NO pasar por POS (que sí filtra
    // ruido de movimiento agresivamente), esta banda 0.1–0.5 Hz del canal
    // verde crudo también puede contener parpadeo de luz ambiente (p. ej.
    // ciclos de un fluorescente, o variaciones de una pantalla/ventana
    // cercana) o drift lento de movimiento (el paciente reacomodándose en
    // el kiosco) — ambos caen en el mismo rango de frecuencia que una
    // respiración normal (6–30 rpm) y producirían un pico espectral
    // indistinguible de uno real. No hay, con esta sola señal, forma de
    // separar ambas causas; por eso RESPIRATORY_CONFIDENCE_PENALTY reduce
    // la confidence de FR por debajo de la de FC incluso cuando el pico
    // espectral es igual de claro.
    const respiratoryResult = findDominantFrequency(gDetrended, targetFps, ...RESPIRATORY_RATE_BAND_HZ);

    // ── SpO2 estimado: ratio-of-ratios entre rojo y azul ──
    const redBandpassed = bandpassFilterFFT(rRaw, targetFps, ...HEART_RATE_BAND_HZ);
    const blueBandpassed = bandpassFilterFFT(bRaw, targetFps, ...HEART_RATE_BAND_HZ);
    const redAcDc = computeAcDc(rRaw, redBandpassed);
    const blueAcDc = computeAcDc(bRaw, blueBandpassed);
    const spo2Value = estimateSpo2(redAcDc, blueAcDc);

    // ── Confidence heurístico ──
    // sampleQualityRatio: qué fracción de los frames CRUDOS que debería haber
    // producido una captura ideal de CAPTURE_DURATION_MS a TARGET_SAMPLE_RATE_HZ
    // realmente llegaron al buffer. Se compara contra una tasa de referencia
    // FIJA (no contra targetFps) a propósito: targetFps se deriva de
    // buffer.approxFps, que ya "absorbe" cualquier hueco de datos como una
    // tasa más baja en vez de como una duración más corta — comparar contra
    // sí mismo daría casi siempre ~1, sin importar cuánta señal falte (p. ej.
    // el rostro perdido por unos segundos porque el paciente se tapó la
    // cámara). Comparar contra la tasa de referencia fija sí capta esa
    // pérdida: un hueco de 4 s sobre 20 s reduce este ratio en ~20%.
    const rawFrameCount = buffer.samples.length / ROIS_PER_FRAME;
    const expectedRawFrames = (CAPTURE_DURATION_MS / 1000) * TARGET_SAMPLE_RATE_HZ;
    const sampleQualityRatio = clamp(rawFrameCount / expectedRawFrames, 0, 1);

    const heartRateConfidence = this.snrToConfidence(heartResult.snr, sampleQualityRatio);
    // La respiración es una señal inherentemente más débil y ruidosa que el
    // pulso, y además ambigua frente a parpadeo de luz/drift de movimiento
    // (ver comentario junto a respiratoryResult más arriba); de ahí la
    // penalización adicional fija vía RESPIRATORY_CONFIDENCE_PENALTY,
    // calibrada de forma heurística (no clínica).
    const respiratoryRateConfidence =
      this.snrToConfidence(respiratoryResult.snr, sampleQualityRatio) * RESPIRATORY_CONFIDENCE_PENALTY;
    const hrvConfidence =
      heartRateConfidence * clamp(rrIntervalsMs.length / MIN_RR_INTERVALS_FOR_HRV, 0, 1);
    // SpO2 por cámara es, en el mejor de los casos, una aproximación gruesa
    // (ver comentario de estimateSpo2); se limita su confianza a un techo
    // artificial para que nunca se lea como equivalente a un pulsioxímetro.
    const spo2Confidence = Number.isFinite(spo2Value) ? heartRateConfidence * 0.6 : 0;

    return {
      heartRate: {
        value: Math.round(clamp(heartResult.frequencyHz * 60, 30, 220)),
        confidence: heartRateConfidence,
      },
      respiratoryRate: {
        value: Math.round(clamp(respiratoryResult.frequencyHz * 60, 4, 60)),
        confidence: respiratoryRateConfidence,
      },
      hrv: {
        value: Math.round(rmssd),
        confidence: hrvConfidence,
      },
      spo2: {
        value: Number.isFinite(spo2Value) ? Math.round(spo2Value) : 0,
        confidence: spo2Confidence,
      },
    };
  }

  /**
   * Convierte un snr (relación pico/promedio-de-banda de findDominantFrequency)
   * en un confidence [0, 1], escalado además por la calidad/cantidad de
   * muestras disponibles. Los coeficientes son heurísticos: no provienen de
   * una validación clínica, solo buscan que confidence baje cuando la señal
   * es claramente pobre (poco pico, pocas muestras).
   */
  private snrToConfidence(snr: number, sampleQualityRatio: number): number {
    const snrScore = clamp((snr - 1) / 4, 0, 1);
    return clamp(snrScore * sampleQualityRatio, 0, 1);
  }

  /** Resultado de confianza 0 para cuando la señal capturada es inutilizable. */
  private zeroConfidenceMeasurement(): VitalSignsMeasurement {
    return {
      heartRate: { value: 0, confidence: 0 },
      respiratoryRate: { value: 0, confidence: 0 },
      hrv: { value: 0, confidence: 0 },
      spo2: { value: 0, confidence: 0 },
    };
  }
}
