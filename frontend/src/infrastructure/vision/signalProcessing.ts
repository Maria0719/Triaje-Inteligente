/**
 * Módulo de procesamiento de señal para rPPG (fotopletismografía remota).
 *
 * Capa: Infraestructura — vision
 *
 * Qué hace:
 *   Convierte el RoiSignalBuffer crudo (muestras RGB por ROI y frame,
 *   ver RoiSignalTypes.ts) en signos vitales: frecuencia cardíaca (FC),
 *   frecuencia respiratoria (FR), HRV (RMSSD) y SpO2 estimado. Incluye
 *   utilidades genéricas de análisis de señal (FFT, filtrado pasa-banda,
 *   detección de picos) y el algoritmo POS para separar el pulso cardíaco
 *   del ruido de movimiento usando los 3 canales de color.
 *
 * Relación con el sistema:
 *   - Consume el RoiSignalBuffer producido por FaceCaptureService (Fase 1).
 *   - Es consumido por RppgVitalSignsDetector (Fase 2), que orquesta el
 *     pipeline completo (buffer → señal → VitalSignsMeasurement).
 *
 * Por qué existe separado:
 *   - Todas las funciones aquí son PURAS (entrada → salida, sin estado ni
 *     efectos secundarios, sin dependencias de React/DOM/MediaPipe). Esto
 *     permite testear cada paso del pipeline de forma aislada con Vitest,
 *     y mantiene RppgVitalSignsDetector enfocado en la orquestación
 *     (ciclo de vida de la cámara, progreso, confidence) en lugar de en
 *     las matemáticas de la señal.
 *   - Sin dependencias externas: la FFT y el filtrado se implementan aquí
 *     en TypeScript puro para no aumentar el tamaño del bundle.
 */

import type { RoiName, RoiSignalBuffer } from './RoiSignalTypes';

// ─── Estadística básica ────────────────────────────────────────────────────

/** Media aritmética. Devuelve 0 para un arreglo vacío. */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/** Desviación estándar poblacional. Devuelve 0 para un arreglo vacío. */
export function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  let sumSquares = 0;
  for (const v of values) sumSquares += (v - m) * (v - m);
  return Math.sqrt(sumSquares / values.length);
}

/** Restringe un valor al rango [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ─── Extracción desde el buffer ────────────────────────────────────────────

/**
 * Extrae la serie temporal de un canal de color para UNA sola ROI.
 *
 * @param buffer - Buffer acumulado por FaceCaptureService.
 * @param roi - ROI específica a extraer ('forehead' | 'leftCheek' | 'rightCheek').
 * @param channel - Canal de color ('r' | 'g' | 'b').
 * @returns Marcas de tiempo y valores del canal, en el orden en que llegaron.
 */
export function extractRoiChannelSeries(
  buffer: RoiSignalBuffer,
  roi: RoiName,
  channel: 'r' | 'g' | 'b',
): { timestamps: number[]; values: number[] } {
  const timestamps: number[] = [];
  const values: number[] = [];
  for (const sample of buffer.samples) {
    if (sample.roi !== roi) continue;
    timestamps.push(sample.timestamp);
    values.push(sample[channel]);
  }
  return { timestamps, values };
}

/**
 * Promedia un canal de color a través de las 3 ROI, agrupando por timestamp.
 * Cada frame produce 3 muestras (frente + 2 mejillas) con el MISMO timestamp;
 * promediarlas mejora la relación señal-ruido frente a usar una sola ROI,
 * porque el ruido de cada zona de piel es parcialmente independiente.
 *
 * Se agrupa por timestamp (en vez de asumir que las muestras vienen siempre
 * en tríos consecutivos) para no acoplar esta función al orden interno con
 * el que FaceCaptureService puebla el buffer.
 *
 * @param buffer - Buffer acumulado por FaceCaptureService.
 * @param channel - Canal de color a promediar.
 * @returns Marcas de tiempo únicas (orden de inserción) y valores promediados.
 */
export function averageChannelAcrossRois(
  buffer: RoiSignalBuffer,
  channel: 'r' | 'g' | 'b',
): { timestamps: number[]; values: number[] } {
  // Map preserva el orden de inserción en JS, así que iterar sus entradas
  // al final devuelve los timestamps en el mismo orden temporal del buffer.
  const groups = new Map<number, { sum: number; count: number }>();
  for (const sample of buffer.samples) {
    const entry = groups.get(sample.timestamp) ?? { sum: 0, count: 0 };
    entry.sum += sample[channel];
    entry.count += 1;
    groups.set(sample.timestamp, entry);
  }
  const timestamps: number[] = [];
  const values: number[] = [];
  for (const [timestamp, { sum, count }] of groups) {
    timestamps.push(timestamp);
    values.push(sum / count);
  }
  return { timestamps, values };
}

/**
 * Reinterpola una serie con timestamps irregulares a una rejilla temporal
 * uniforme a `targetFps`.
 *
 * Necesario porque requestVideoFrameCallback/requestAnimationFrame no
 * garantizan intervalos exactamente iguales entre frames, y tanto la FFT
 * como el filtrado pasa-banda asumen muestreo uniforme para que sus bins
 * de frecuencia sean válidos.
 *
 * @param timestamps - Marcas de tiempo en ms, crecientes.
 * @param values - Valores de la señal en esos instantes.
 * @param targetFps - Frecuencia de muestreo deseada para la salida.
 * @returns Valores interpolados linealmente sobre una rejilla uniforme.
 */
export function resampleUniform(
  timestamps: number[],
  values: number[],
  targetFps: number,
): number[] {
  if (timestamps.length < 2) return values.slice();

  const startMs = timestamps[0];
  const endMs = timestamps[timestamps.length - 1];
  const durationS = (endMs - startMs) / 1000;
  const numSamples = Math.max(2, Math.round(durationS * targetFps));
  const result: number[] = new Array(numSamples);

  let sourceIndex = 0;
  for (let i = 0; i < numSamples; i++) {
    const targetMs = startMs + (i * durationS * 1000) / (numSamples - 1);
    // Avanza el puntero de origen hasta el segmento [t0, t1] que envuelve targetMs.
    while (sourceIndex < timestamps.length - 2 && timestamps[sourceIndex + 1] < targetMs) {
      sourceIndex++;
    }
    const t0 = timestamps[sourceIndex];
    const t1 = timestamps[sourceIndex + 1] ?? t0;
    const v0 = values[sourceIndex];
    const v1 = values[sourceIndex + 1] ?? v0;
    const frac = t1 > t0 ? (targetMs - t0) / (t1 - t0) : 0;
    result[i] = v0 + (v1 - v0) * frac;
  }
  return result;
}

// ─── Preacondicionamiento ──────────────────────────────────────────────────

/**
 * Media móvil centrada. En los bordes usa una ventana progresivamente más
 * angosta (en vez de rellenar con ceros) para no distorsionar los extremos
 * de la señal.
 *
 * @param signal - Señal de entrada.
 * @param windowSize - Ancho de la ventana en muestras.
 */
export function movingAverage(signal: number[], windowSize: number): number[] {
  const half = Math.max(1, Math.floor(windowSize / 2));
  const result: number[] = new Array(signal.length);
  for (let i = 0; i < signal.length; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(signal.length - 1, i + half);
    let sum = 0;
    for (let j = start; j <= end; j++) sum += signal[j];
    result[i] = sum / (end - start + 1);
  }
  return result;
}

/**
 * Elimina la tendencia lenta (drift DC por cambios de iluminación o
 * perfusión basal) restando una media móvil de ventana ancha.
 *
 * @param signal - Señal cruda.
 * @param windowSize - Ancho de ventana en muestras (típicamente ~1–2 s de señal).
 */
export function detrend(signal: number[], windowSize: number): number[] {
  const trend = movingAverage(signal, windowSize);
  return signal.map((v, i) => v - trend[i]);
}

// ─── Ventaneo previo a la FFT ───────────────────────────────────────────────

/**
 * Ventana de Hann de longitud `length`. Se multiplica por la señal antes de
 * cualquier FFT (ver computePowerSpectrum y bandpassFilterFFT) para reducir
 * la fuga espectral (spectral leakage): sin ventana, los bordes abruptos de
 * un segmento finito equivalen a una discontinuidad periódica implícita para
 * la FFT, lo que esparce la energía de la frecuencia real hacia bins vecinos
 * y sesga tanto la estimación de findDominantFrequency como el ringing
 * (fenómeno de Gibbs) del filtro pasa-banda. Hann se eligió sobre Hamming
 * porque su lóbulo lateral cae más rápido (mejor para aislar un pico
 * angosto como el cardíaco) a costa de un lóbulo principal apenas más ancho,
 * un compromiso adecuado para señales fisiológicas de banda muy estrecha.
 */
export function hannWindow(length: number): number[] {
  if (length <= 1) return new Array(length).fill(1);
  const window = new Array(length);
  for (let i = 0; i < length; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (length - 1)));
  }
  return window;
}

/** Multiplica una señal por una ventana (elemento a elemento). */
export function applyWindow(signal: number[], window: number[]): number[] {
  return signal.map((v, i) => v * window[i]);
}

// ─── FFT (Cooley-Tukey radix-2) ─────────────────────────────────────────────

/** Menor potencia de 2 mayor o igual que n. */
export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Rellena una señal con ceros al final hasta alcanzar `length`. */
export function zeroPad(signal: number[], length: number): number[] {
  if (signal.length >= length) return signal.slice(0, length);
  return [...signal, ...new Array(length - signal.length).fill(0)];
}

/**
 * FFT radix-2 Cooley-Tukey in-place. `re`/`im` deben tener longitud potencia
 * de 2 (usar zeroPad + nextPowerOfTwo antes de llamar). Se implementa a mano
 * para no traer una dependencia externa solo por esto.
 */
export function fft(re: number[], im: number[]): void {
  const n = re.length;

  // Permutación bit-reversal: reordena las muestras para que las etapas de
  // mariposa (butterfly) de abajo puedan combinarlas in-place sin buffers
  // auxiliares.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  // Etapas de mariposa: combina pares, luego cuartetos, luego octetos, etc.
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    for (let start = 0; start < n; start += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const evenIdx = start + k;
        const oddIdx = start + k + len / 2;
        const evenRe = re[evenIdx];
        const evenIm = im[evenIdx];
        const oddRe = re[oddIdx] * curRe - im[oddIdx] * curIm;
        const oddIm = re[oddIdx] * curIm + im[oddIdx] * curRe;
        re[evenIdx] = evenRe + oddRe;
        im[evenIdx] = evenIm + oddIm;
        re[oddIdx] = evenRe - oddRe;
        im[oddIdx] = evenIm - oddIm;
        // Rota el "twiddle factor" para la siguiente pareja de esta etapa.
        const nextRe = curRe * wRe - curIm * wIm;
        const nextIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
        curIm = nextIm;
      }
    }
  }
}

/**
 * FFT inversa in-place. Reutiliza la FFT directa vía el truco estándar de
 * conjugar la entrada, transformar, conjugar la salida y escalar por 1/n
 * (evita mantener una segunda implementación de la mariposa).
 */
export function ifft(re: number[], im: number[]): void {
  const n = re.length;
  for (let i = 0; i < n; i++) im[i] = -im[i];
  fft(re, im);
  for (let i = 0; i < n; i++) {
    re[i] = re[i] / n;
    im[i] = -im[i] / n;
  }
}

// ─── Análisis en frecuencia ─────────────────────────────────────────────────

/**
 * Calcula el espectro de potencia (magnitud) de una señal real.
 * Solo se devuelven los bins de 0 Hz a Nyquist inclusive: para una señal
 * real, los bins por encima de Nyquist son el espejo conjugado de los de
 * abajo y no aportan información nueva.
 *
 * La señal se ventanea con Hann (ver hannWindow) antes de rellenarla con
 * ceros (zero-padding) hasta la siguiente potencia de 2 requerida por la
 * FFT radix-2 — p. ej. ~20 s de captura a ~30 fps son ~600 muestras, que
 * se rellenan hasta 1024. El ventaneo ocurre ANTES del zero-padding: se
 * aplica solo sobre las muestras reales, para no atenuar ceros que ya son
 * ceros.
 */
export function computePowerSpectrum(
  signal: number[],
  sampleRate: number,
): { frequencies: number[]; magnitudes: number[] } {
  const windowed = applyWindow(signal, hannWindow(signal.length));
  const paddedLength = nextPowerOfTwo(windowed.length);
  const re = zeroPad(windowed, paddedLength);
  const im = new Array(paddedLength).fill(0);
  fft(re, im);

  const halfLength = paddedLength / 2;
  const frequencies: number[] = [];
  const magnitudes: number[] = [];
  for (let i = 0; i <= halfLength; i++) {
    frequencies.push((i * sampleRate) / paddedLength);
    magnitudes.push(Math.sqrt(re[i] * re[i] + im[i] * im[i]) / paddedLength);
  }
  return { frequencies, magnitudes };
}

/**
 * Filtro pasa-banda implementado como ventana en el dominio de la frecuencia:
 * FFT → anula los bins fuera de [lowHz, highHz] (incluyendo su espejo en
 * frecuencias negativas) → FFT inversa.
 *
 * Se eligió este enfoque en vez de un Butterworth IIR clásico porque:
 *   - Evita diseñar y estabilizar a mano los coeficientes biquad de un
 *     Butterworth digital (bilinear transform), que es fácil de hacer mal
 *     sin una librería de referencia.
 *   - Reutiliza la misma FFT que ya necesitamos para hallar la frecuencia
 *     dominante, así que no añade código nuevo de bajo nivel.
 *   - Al ser una ventana "ideal" (corte abrupto en frecuencia), no introduce
 *     distorsión de fase, lo cual es conveniente para no desplazar la
 *     ubicación de los picos que luego usamos para calcular intervalos R-R.
 *
 * Ventaneo (Hann) antes de la FFT: igual que en computePowerSpectrum, se
 * aplica para reducir la fuga espectral, que en un filtro se manifiesta
 * como ringing en el dominio temporal (fenómeno de Gibbs) cerca de
 * transiciones abruptas de la señal. Efecto secundario conocido: al
 * atenuar hacia 0 los extremos de la señal de entrada, la salida también
 * queda atenuada cerca de sus dos bordes (los primeros/últimos instantes
 * de la ventana de captura). Esto puede perder algún pico en detectPeaks
 * justo en los extremos de los ~20 s capturados, pero no afecta la razón
 * AC/DC usada para SpO2 (computeAcDc/estimateSpo2) porque el canal rojo y
 * el azul se ventanean con la MISMA forma, así que el sesgo introducido
 * se cancela al dividir un ratio entre el otro.
 *
 * Después del ventaneo, la señal se rellena con ceros (zero-padding) hasta
 * la siguiente potencia de 2 (p. ej. ~600 muestras → 1024), tal como en
 * computePowerSpectrum.
 *
 * @returns La señal filtrada, recortada a la longitud original (se descarta
 *   el relleno de ceros usado internamente para la FFT).
 */
export function bandpassFilterFFT(
  signal: number[],
  sampleRate: number,
  lowHz: number,
  highHz: number,
): number[] {
  const originalLength = signal.length;
  const windowed = applyWindow(signal, hannWindow(originalLength));
  const paddedLength = nextPowerOfTwo(originalLength);
  const re = zeroPad(windowed, paddedLength);
  const im = new Array(paddedLength).fill(0);
  fft(re, im);

  for (let i = 0; i < paddedLength; i++) {
    // Los bins con índice > mitad representan frecuencias negativas
    // (espejo); se pliegan a su valor absoluto para comparar contra la banda.
    const binFreq =
      i <= paddedLength / 2
        ? (i * sampleRate) / paddedLength
        : ((paddedLength - i) * sampleRate) / paddedLength;
    if (binFreq < lowHz || binFreq > highHz) {
      re[i] = 0;
      im[i] = 0;
    }
  }

  ifft(re, im);
  return re.slice(0, originalLength);
}

/**
 * Encuentra la frecuencia dominante dentro de una banda [lowHz, highHz].
 *
 * @returns frequencyHz - Frecuencia del pico (con interpolación parabólica
 *   sub-bin para mayor precisión que la resolución fija de la FFT).
 * @returns magnitude - Magnitud del pico.
 * @returns snr - Relación pico/promedio-de-la-banda; útil como insumo para
 *   estimar la confianza de la medición (una banda "plana" sin pico claro
 *   da snr cercano a 1; un pulso limpio da snr alto).
 */
export function findDominantFrequency(
  signal: number[],
  sampleRate: number,
  lowHz: number,
  highHz: number,
): { frequencyHz: number; magnitude: number; snr: number } {
  const { frequencies, magnitudes } = computePowerSpectrum(signal, sampleRate);

  let peakIndex = -1;
  let peakMagnitude = -Infinity;
  let bandSum = 0;
  let bandCount = 0;
  for (let i = 0; i < frequencies.length; i++) {
    if (frequencies[i] < lowHz || frequencies[i] > highHz) continue;
    bandSum += magnitudes[i];
    bandCount++;
    if (magnitudes[i] > peakMagnitude) {
      peakMagnitude = magnitudes[i];
      peakIndex = i;
    }
  }

  if (peakIndex === -1 || bandCount === 0) {
    return { frequencyHz: 0, magnitude: 0, snr: 0 };
  }

  // Interpolación parabólica usando el pico y sus dos vecinos: técnica
  // estándar en detección de periodicidad para refinar la frecuencia más
  // allá de la resolución fija de bins de la FFT.
  let interpolatedFreq = frequencies[peakIndex];
  if (peakIndex > 0 && peakIndex < frequencies.length - 1) {
    const a = magnitudes[peakIndex - 1];
    const b = magnitudes[peakIndex];
    const c = magnitudes[peakIndex + 1];
    const denom = a - 2 * b + c;
    if (denom !== 0) {
      const offset = 0.5 * (a - c) / denom;
      const binWidth = frequencies[1] - frequencies[0];
      interpolatedFreq = frequencies[peakIndex] + offset * binWidth;
    }
  }

  const meanBandMagnitude = bandSum / bandCount;
  const snr = meanBandMagnitude > 0 ? peakMagnitude / meanBandMagnitude : 0;

  return { frequencyHz: interpolatedFreq, magnitude: peakMagnitude, snr };
}

// ─── Dominio temporal: picos e intervalos R-R (para HRV) ──────────────────

/**
 * Detecta picos locales en el dominio temporal para estimar los intervalos
 * entre latidos (R-R), insumo de la HRV.
 *
 * @param signal - Señal de pulso ya filtrada en la banda cardíaca.
 * @param sampleRate - Frecuencia de muestreo de `signal`.
 * @param minIntervalMs - Distancia mínima entre picos aceptados, en ms
 *   (periodo refractario fisiológico; p. ej. 250 ms ≈ 240 bpm máximo).
 * @returns Índices (en muestras) de los picos detectados.
 */
export function detectPeaks(
  signal: number[],
  sampleRate: number,
  minIntervalMs: number,
): number[] {
  if (signal.length < 3) return [];

  // Umbral heurístico: un pico debe superar la media en al menos media
  // desviación estándar para descartarse como ruido de baja amplitud.
  const threshold = mean(signal) + 0.5 * standardDeviation(signal);
  const minIntervalSamples = Math.max(1, Math.round((minIntervalMs / 1000) * sampleRate));

  const peaks: number[] = [];
  for (let i = 1; i < signal.length - 1; i++) {
    const isLocalMax = signal[i] > signal[i - 1] && signal[i] >= signal[i + 1];
    if (!isLocalMax || signal[i] < threshold) continue;

    const lastPeak = peaks[peaks.length - 1];
    if (lastPeak !== undefined && i - lastPeak < minIntervalSamples) {
      // Dos picos más cerca que el periodo refractario: es ruido, no dos
      // latidos reales. Se conserva el de mayor amplitud.
      if (signal[i] > signal[lastPeak]) peaks[peaks.length - 1] = i;
      continue;
    }
    peaks.push(i);
  }
  return peaks;
}

/** Convierte índices de picos en intervalos entre picos consecutivos, en ms. */
export function computeRRIntervalsMs(peakIndices: number[], sampleRate: number): number[] {
  const intervals: number[] = [];
  for (let i = 1; i < peakIndices.length; i++) {
    intervals.push(((peakIndices[i] - peakIndices[i - 1]) / sampleRate) * 1000);
  }
  return intervals;
}

/**
 * RMSSD (Root Mean Square of Successive Differences): la métrica de HRV
 * más común en ventanas cortas, calculada como la raíz de la media de las
 * diferencias sucesivas al cuadrado entre intervalos R-R.
 */
export function computeRMSSD(rrIntervalsMs: number[]): number {
  if (rrIntervalsMs.length < 2) return 0;
  let sumSquaredDiffs = 0;
  for (let i = 1; i < rrIntervalsMs.length; i++) {
    const diff = rrIntervalsMs[i] - rrIntervalsMs[i - 1];
    sumSquaredDiffs += diff * diff;
  }
  return Math.sqrt(sumSquaredDiffs / (rrIntervalsMs.length - 1));
}

// ─── Separación del pulso: algoritmo POS ───────────────────────────────────

/**
 * Algoritmo POS (Plane-Orthogonal-to-Skin) de Wang, den Brinker, Stuijk y
 * de Haan (2017), "Algorithmic Principles of Remote PPG".
 *
 * Por qué POS y no CHROM:
 *   CHROM (de Haan & Jeanne, 2013) combina los canales con coeficientes
 *   FIJOS que asumen una crominancia de piel estándar (Xs = 3R−2G,
 *   Ys = 1.5R+G−1.5B). POS, en cambio, proyecta la señal sobre el plano
 *   ortogonal al tono de piel ESTIMADO en cada ventana temporal (a partir
 *   de la propia señal), por lo que se adapta a variaciones de iluminación
 *   y tono de piel entre pacientes sin necesitar calibración previa. En el
 *   benchmark del propio paper, POS es más robusto que CHROM frente a
 *   movimiento residual de la cabeza mientras mantiene un costo
 *   computacional comparable (solo álgebra lineal por ventana). Para un
 *   kiosco donde no se puede garantizar quietud perfecta del paciente,
 *   esa robustez pesa más que la simplicidad ligeramente mayor de CHROM.
 *
 * Funcionamiento (resumen del paper):
 *   1. Para cada ventana deslizante de ~1.6 s, normaliza cada canal
 *      dividiendo por su media en la ventana (cancela el nivel de
 *      iluminación/tono de piel local).
 *   2. Proyecta los 3 canales normalizados sobre 2 ejes ortogonales al
 *      vector de tono de piel [1,1,1]: S1 = Gn − Bn, S2 = −2Rn + Gn + Bn.
 *   3. Combina S1 y S2 ponderando por la razón de sus desviaciones
 *      estándar, lo que alinea sus amplitudes antes de sumarlos.
 *   4. Reconstruye la señal completa sumando (overlap-add) la contribución
 *      de todas las ventanas solapadas — tal como especifica el paper,
 *      sin promediar, ya que la normalización por ventana ya deja las
 *      contribuciones en una escala comparable.
 *
 * @param rSignal - Serie temporal cruda del canal rojo (sin normalizar).
 * @param gSignal - Serie temporal cruda del canal verde.
 * @param bSignal - Serie temporal cruda del canal azul.
 * @param sampleRate - Frecuencia de muestreo de las 3 series (deben coincidir).
 * @returns Señal de pulso reconstruida (misma longitud que las de entrada).
 */
export function applyPOS(
  rSignal: number[],
  gSignal: number[],
  bSignal: number[],
  sampleRate: number,
): number[] {
  const n = rSignal.length;
  // Ventana de 1.6 s: valor recomendado por Wang et al. para capturar al
  // menos un ciclo cardíaco completo incluso a frecuencias cardíacas bajas.
  const windowLength = Math.max(3, Math.round(1.6 * sampleRate));
  const pulse = new Array(n).fill(0);

  for (let start = 0; start + windowLength <= n; start++) {
    let meanR = 0;
    let meanG = 0;
    let meanB = 0;
    for (let i = start; i < start + windowLength; i++) {
      meanR += rSignal[i];
      meanG += gSignal[i];
      meanB += bSignal[i];
    }
    meanR /= windowLength;
    meanG /= windowLength;
    meanB /= windowLength;

    // Normalización temporal por ventana (paso 1 del algoritmo): divide
    // cada canal por su propia media en la ventana. Protegido contra
    // división por cero en ventanas degeneradas (p. ej. ROI totalmente negra).
    const rNorm: number[] = [];
    const gNorm: number[] = [];
    const bNorm: number[] = [];
    for (let i = start; i < start + windowLength; i++) {
      rNorm.push(meanR !== 0 ? rSignal[i] / meanR : 0);
      gNorm.push(meanG !== 0 ? gSignal[i] / meanG : 0);
      bNorm.push(meanB !== 0 ? bSignal[i] / meanB : 0);
    }

    // Proyección ortogonal al tono de piel (paso 2, ecuación 8 del paper).
    const s1 = gNorm.map((v, i) => v - bNorm[i]);
    const s2 = rNorm.map((v, i) => -2 * v + gNorm[i] + bNorm[i]);

    // Alinea la amplitud de s1 y s2 antes de combinarlas (paso 3).
    const stdS1 = standardDeviation(s1);
    const stdS2 = standardDeviation(s2);
    const alpha = stdS2 !== 0 ? stdS1 / stdS2 : 0;

    for (let i = 0; i < windowLength; i++) {
      pulse[start + i] += s1[i] + alpha * s2[i];
    }
  }

  return pulse;
}

// ─── SpO2 estimado (ratio-of-ratios) ───────────────────────────────────────

/**
 * Calcula los componentes AC (pulsátil) y DC (basal) de un canal de color,
 * insumos del modelo de ratio-of-ratios para SpO2.
 *
 * El DC (mean(rawSignal)) asume implícitamente que la iluminación ambiente
 * y la posición del paciente permanecen estables durante toda la ventana
 * de ~20 s: es literalmente el promedio de intensidad de todo el clip. Si
 * la luz cambia (una nube, una lámpara que titila, el paciente moviéndose
 * hacia/desde la fuente de luz) durante la captura, ese cambio se mezcla
 * dentro del DC como si fuera parte de la línea de base real del tejido,
 * y desvía la razón AC/DC de cada canal de forma distinta (rojo y azul no
 * responden igual a un mismo cambio de iluminación) — lo cual sesga la
 * estimación de SpO2 más allá del error ya inherente al método. Por eso el
 * confidence de SpO2 en RppgVitalSignsDetector se limita a un techo bajo:
 * no hay forma de distinguir, solo con estos datos, un DC "limpio" de uno
 * contaminado por luz/movimiento.
 *
 * @param rawSignal - Señal cruda del canal (sin filtrar) → su media es el DC.
 * @param bandpassedSignal - Misma señal filtrada en la banda cardíaca → su
 *   desviación estándar aproxima la amplitud AC pulsátil.
 */
export function computeAcDc(
  rawSignal: number[],
  bandpassedSignal: number[],
): { ac: number; dc: number } {
  return { ac: standardDeviation(bandpassedSignal), dc: mean(rawSignal) };
}

/**
 * Estima SpO2 mediante el modelo clásico de ratio-of-ratios de dos canales:
 *   ratio = (AC_rojo / DC_rojo) / (AC_azul / DC_azul)
 *   SpO2 ≈ 110 − 25 × ratio
 *
 * IMPORTANTE — esto es una APROXIMACIÓN, NO una medición clínica:
 *   El modelo real de un pulsioxímetro usa dos longitudes de onda
 *   específicas (rojo ~660 nm e infrarrojo ~940 nm) y coeficientes de
 *   calibración propios del sensor. Aquí se usan los canales rojo y azul
 *   de una cámara RGB de consumo (sensor y filtros no calibrados para
 *   oximetría), por lo que el resultado debe tratarse siempre como
 *   ESTIMADO / NO CLÍNICO. Nunca debe usarse para decisiones médicas
 *   sin confirmación con un pulsioxímetro real.
 *
 * @returns SpO2 estimado en % (acotado a [70, 100]), o NaN si los
 *   denominadores son degenerados (canal sin señal, DC = 0, etc.).
 */
export function estimateSpo2(
  redAcDc: { ac: number; dc: number },
  blueAcDc: { ac: number; dc: number },
): number {
  if (redAcDc.dc === 0 || blueAcDc.dc === 0) return NaN;
  const ratioRed = redAcDc.ac / redAcDc.dc;
  const ratioBlue = blueAcDc.ac / blueAcDc.dc;
  if (ratioBlue === 0) return NaN;
  const ratio = ratioRed / ratioBlue;
  return clamp(110 - 25 * ratio, 70, 100);
}
