/**
 * Suite de tests de RppgVitalSignsDetector (Fase 2 — rPPG).
 *
 * Ejercita el detector con datos sintéticos (mockeando FaceCaptureService)
 * para no depender de una cámara física real, y protege con aserciones
 * concretas dos cosas que ya fallaron antes en este proyecto:
 *
 *   1. Que sampleQualityRatio siga penalizando la confidence cuando se pierde
 *      señal real (p. ej. el paciente se tapa la cámara), y no compare contra
 *      sí mismo de forma tautológica (bug histórico ya corregido — ver
 *      comentario en RppgVitalSignsDetector.processBuffer).
 *   2. Que la calibración de SNR_FOR_MAX_CONFIDENCE (recalibrada de 5 a 4 a
 *      partir de 4 mediciones reales del kiosco, rango de snr de FC
 *      2.76–3.48, ver auditoría) no vuelva a subirse sin darse cuenta a un
 *      valor que deje la confidence estructuralmente baja incluso en
 *      capturas limpias.
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

/** Acceso de test a snrToConfidence, privado en la clase — no cambia su visibilidad real. */
type SnrToConfidenceAccessor = { snrToConfidence(snr: number, sampleQualityRatio: number): number };
function accessSnrToConfidence(): SnrToConfidenceAccessor {
  return new RppgVitalSignsDetector({} as HTMLVideoElement) as unknown as SnrToConfidenceAccessor;
}

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

describe('RppgVitalSignsDetector.measure()', () => {
  it('devuelve una FC en rango fisiológico de reposo y completa el progreso en ~20s', async () => {
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

    expect(result.heartRate.value).toBeGreaterThanOrEqual(30);
    expect(result.heartRate.value).toBeLessThanOrEqual(220);
    expect(progressAt10s).toBeCloseTo(50, 0);
    expect(progressAt20s).toBe(100);
  }, 15000);

  it('la confidence de FC baja proporcionalmente cuando se pierde señal real (cámara tapada 4 de los 20s)', async () => {
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
    // sampleQualityRatio esperado: 16s de señal real sobre 20s ideales = 0.8.
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

    // La pérdida de señal debe REDUCIR la confidence, no dejarla intacta —
    // esto es lo que sampleQualityRatio existe para garantizar (ver el bug
    // histórico donde se comparaba tautológicamente contra sí mismo).
    expect(coveredResult.heartRate.confidence).toBeLessThan(cleanResult.heartRate.confidence);
    expect(coveredResult.heartRate.confidence).toBeGreaterThan(0);
    // La degradación debe ser proporcional al hueco real (~20% de datos
    // perdidos → ~20% menos confidence), no abrupta ni descontada dos veces.
    expect(coveredResult.heartRate.confidence).toBeCloseTo(cleanResult.heartRate.confidence * 0.8, 1);
  }, 15000);
});

describe('snrToConfidence — calibración SNR_FOR_MAX_CONFIDENCE', () => {
  // snr de FC despejado de 4 mediciones reales del kiosco (fps 23–28 reales,
  // ROI de muestreo 160×120px) durante el diagnóstico del Bug #1. Ninguna
  // cerca del techo original de 5, lo que motivó recalibrar
  // SNR_FOR_MAX_CONFIDENCE de 5 a 4. Ver auditoría para el despeje completo.
  const REAL_MEASUREMENTS = [
    { snr: 2.9169, ratio: 0.77, expectedConfidence: 0.492 },
    { snr: 2.8397, ratio: 0.948, expectedConfidence: 0.581 },
    { snr: 2.7626, ratio: 0.91, expectedConfidence: 0.535 },
    { snr: 3.4756, ratio: 0.942, expectedConfidence: 0.777 },
  ];

  it.each(REAL_MEASUREMENTS)(
    'snr=$snr, sampleQualityRatio=$ratio -> confidence ≈ $expectedConfidence',
    ({ snr, ratio, expectedConfidence }) => {
      expect(accessSnrToConfidence().snrToConfidence(snr, ratio)).toBeCloseTo(expectedConfidence, 2);
    },
  );

  it('satura en 1 a partir de snr = SNR_FOR_MAX_CONFIDENCE (4) con ratio perfecto', () => {
    const detector = accessSnrToConfidence();
    expect(detector.snrToConfidence(4, 1)).toBeCloseTo(1, 5);
    expect(detector.snrToConfidence(10, 1)).toBe(1); // no debe superar 1 aunque el snr sea mucho mayor
  });

  it('cae a 0 en snr <= 1 (banda plana, sin periodicidad real)', () => {
    expect(accessSnrToConfidence().snrToConfidence(1, 1)).toBe(0);
  });

  it('regresión: el snr máximo observado en datos reales (3.48) ya no debe quedar por debajo de 0.8 de confidence base — si esto falla, alguien subió SNR_FOR_MAX_CONFIDENCE de vuelta hacia el techo viejo (5)', () => {
    expect(accessSnrToConfidence().snrToConfidence(3.4756, 1)).toBeGreaterThan(0.8);
  });
});
