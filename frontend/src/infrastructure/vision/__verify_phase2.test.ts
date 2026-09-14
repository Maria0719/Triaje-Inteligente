/**
 * Script temporal de verificación manual de Fase 2 (rPPG). NO es parte del
 * conjunto de tests del proyecto — se elimina después de reportar resultados.
 *
 * Ejercita RppgVitalSignsDetector con datos sintéticos (mockeando
 * FaceCaptureService) para obtener números concretos sin depender de una
 * cámara física real, que este entorno no tiene.
 */
import { describe, it, expect, vi } from 'vitest';
import type { RoiName, RoiSample, RoiSignalBuffer } from './RoiSignalTypes';
import type { FaceCaptureQuality } from './RoiSignalTypes';

const mockState = vi.hoisted(() => ({ buffer: null as RoiSignalBuffer | null }));

vi.mock('./FaceCaptureService', () => {
  class MockFaceCaptureService {
    async start(_video: unknown, onQualityUpdate: (q: FaceCaptureQuality) => void) {
      onQualityUpdate({
        status: 'active',
        faceDetected: true,
        faceCentered: true,
        lightAdequate: true,
        motionStable: true,
        message: 'ok',
      });
    }
    stop() {}
    dispose() {}
    getBuffer(): RoiSignalBuffer {
      return mockState.buffer!;
    }
  }
  return { FaceCaptureService: MockFaceCaptureService };
});

const { RppgVitalSignsDetector } = await import('./RppgVitalSignsDetector');

const ROIS: RoiName[] = ['forehead', 'leftCheek', 'rightCheek'];

/**
 * Genera un RoiSignalBuffer sintético con un componente pulsátil sinusoidal
 * a `bpm`, ruido moderado por ROI, y opcionalmente un hueco sin muestras
 * (simulando rostro no detectado, p. ej. cámara tapada con la mano).
 */
function generateSyntheticBuffer(opts: {
  durationS: number;
  fps: number;
  bpm: number;
  gapStartS?: number;
  gapDurationS?: number;
}): RoiSignalBuffer {
  const { durationS, fps, bpm, gapStartS, gapDurationS } = opts;
  const samples: RoiSample[] = [];
  const totalFrames = Math.round(durationS * fps);
  const freqHz = bpm / 60;
  const dc = { r: 150, g: 130, b: 110 };
  const amp = { r: 1.0, g: 2.0, b: 0.6 }; // verde con mayor modulación pulsátil, como en piel real
  const noiseAmp = 0.3;

  for (let i = 0; i < totalFrames; i++) {
    const t = i / fps;
    if (gapStartS !== undefined && gapDurationS !== undefined && t >= gapStartS && t < gapStartS + gapDurationS) {
      continue; // sin rostro detectado -> FaceCaptureService no empuja muestras
    }
    const timestamp = t * 1000;
    const pulse = Math.sin(2 * Math.PI * freqHz * t);
    for (const roi of ROIS) {
      samples.push({
        timestamp,
        roi,
        r: dc.r + amp.r * pulse + (Math.random() - 0.5) * noiseAmp,
        g: dc.g + amp.g * pulse + (Math.random() - 0.5) * noiseAmp,
        b: dc.b + amp.b * pulse + (Math.random() - 0.5) * noiseAmp,
      });
    }
  }

  return {
    samples,
    startedAt: 0,
    durationMs: durationS * 1000,
    approxFps: (samples.length / ROIS.length) / durationS,
  };
}

describe('Verificación manual Fase 2', () => {
  it('1) FC en rango fisiológico de reposo + 2) tiempo de captura ~20s', async () => {
    vi.useFakeTimers();
    mockState.buffer = generateSyntheticBuffer({ durationS: 20, fps: 30, bpm: 72 });

    const detector = new RppgVitalSignsDetector({} as HTMLVideoElement);
    const progressCalls: number[] = [];

    const resultPromise = detector.measure(p => progressCalls.push(p));

    // Deja que el .then() de service.start() corra y arme runCaptureWindow
    // (setInterval/setTimeout) antes de avanzar el reloj falso.
    await vi.advanceTimersByTimeAsync(0);

    await vi.advanceTimersByTimeAsync(10_000);
    const progressAt10s = progressCalls[progressCalls.length - 1];

    await vi.advanceTimersByTimeAsync(10_000);
    const progressAt20s = progressCalls[progressCalls.length - 1];

    const result = await resultPromise;
    vi.useRealTimers();

    console.log('--- CHEQUEO 1: FC en rango fisiológico ---');
    console.log('heartRate.value =', result.heartRate.value, 'bpm');
    console.log('heartRate.confidence =', result.heartRate.confidence);
    console.log('--- CHEQUEO 2: tiempo de captura ---');
    console.log('progress a los 10s =', progressAt10s);
    console.log('progress a los 20s =', progressAt20s);
    console.log('total de llamadas a onProgress =', progressCalls.length);

    expect(result.heartRate.value).toBeGreaterThanOrEqual(30);
  }, 15000);

  it('3) confidence de FC baja al tapar la cámara 4s de los 20s', async () => {
    vi.useFakeTimers();

    // Escenario limpio: 20s completos de señal a 72 bpm.
    mockState.buffer = generateSyntheticBuffer({ durationS: 20, fps: 30, bpm: 72 });
    const cleanDetector = new RppgVitalSignsDetector({} as HTMLVideoElement);
    const cleanPromise = cleanDetector.measure(() => {});
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(20_000);
    const cleanResult = await cleanPromise;

    // Escenario "tapado": mismos 20s, pero sin ninguna muestra entre el
    // segundo 8 y el 12 (4s sin rostro detectado, como al cubrir la cámara).
    mockState.buffer = generateSyntheticBuffer({
      durationS: 20,
      fps: 30,
      bpm: 72,
      gapStartS: 8,
      gapDurationS: 4,
    });
    const coveredDetector = new RppgVitalSignsDetector({} as HTMLVideoElement);
    const coveredPromise = coveredDetector.measure(() => {});
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(20_000);
    const coveredResult = await coveredPromise;

    vi.useRealTimers();

    console.log('--- CHEQUEO 3: confidence al tapar la cámara ---');
    console.log('ANTES  (20s limpios)      -> heartRate.confidence =', cleanResult.heartRate.confidence, ' heartRate.value =', cleanResult.heartRate.value);
    console.log('DESPUÉS (4s tapada, 8-12s) -> heartRate.confidence =', coveredResult.heartRate.confidence, ' heartRate.value =', coveredResult.heartRate.value);

    expect(true).toBe(true); // este test es de reporte, no de assert estricto
  }, 15000);
});
