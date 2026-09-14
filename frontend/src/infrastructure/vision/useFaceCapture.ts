/**
 * Hook React para captura facial de signos vitales (Fase 1).
 *
 * Capa: Infraestructura — vision
 *
 * Envuelve FaceCaptureService en una interfaz React limpia:
 *   - Gestiona el ciclo de vida del servicio (create → start → stop → dispose)
 *     sincronizado con el prop `active`.
 *   - Expone `quality` como estado React para disparar re-renders por frame.
 *   - Expone `buffer` acumulado (sin ser estado React, para evitar re-renders).
 *
 * Relación con el resto del sistema:
 *   - PatientKioskPage lo usa para mostrar feedback de calidad durante la captura.
 *   - RppgVitalSignsDetector (Fase 2) usará FaceCaptureService directamente,
 *     no este hook, porque necesita control más fino del ciclo de vida.
 *
 * Por qué existe separado de FaceCaptureService:
 *   - Separación de responsabilidades: el servicio no conoce React;
 *     el hook no conoce MediaPipe ni canvas.
 */

import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { FaceCaptureService } from './FaceCaptureService';
import type { FaceCaptureQuality, RoiSignalBuffer } from './RoiSignalTypes';

// ─── Valores por defecto ──────────────────────────────────────────────────────

const DEFAULT_QUALITY: FaceCaptureQuality = {
  status: 'idle',
  faceDetected: false,
  faceCentered: false,
  lightAdequate: false,
  motionStable: false,
  message: 'Esperando cámara...',
};

const EMPTY_BUFFER: RoiSignalBuffer = {
  samples: [],
  startedAt: 0,
  durationMs: 0,
  approxFps: 0,
};

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Gestiona la captura facial mientras `active` es true.
 *
 * @param videoRef - Ref al elemento <video> con el stream de la cámara.
 * @param active   - true = iniciar captura; false = detener y liberar recursos.
 * @returns quality - Estado de calidad actualizado cada frame (trigger de re-render).
 * @returns buffer  - Snapshot del buffer de señal acumulado (no provoca re-renders).
 *
 * NOTA: RppgVitalSignsDetector (Fase 2) instanciará FaceCaptureService directamente
 * sin pasar por este hook, ya que necesita integrar el buffer en su propio ciclo
 * de medición y no requiere el estado React de calidad.
 */
export function useFaceCapture(
  videoRef: RefObject<HTMLVideoElement | null>,
  active: boolean,
): { quality: FaceCaptureQuality; buffer: RoiSignalBuffer } {
  const [quality, setQuality] = useState<FaceCaptureQuality>(DEFAULT_QUALITY);

  // buffer en ref (no estado) para que su actualización no provoque re-renders
  const bufferRef = useRef<RoiSignalBuffer>(EMPTY_BUFFER);
  const serviceRef = useRef<FaceCaptureService | null>(null);

  useEffect(() => {
    if (!active) {
      setQuality(DEFAULT_QUALITY);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    const service = new FaceCaptureService();
    serviceRef.current = service;

    // start() es async pero los errores de MediaPipe los maneja internamente
    // emitiendo status 'error'. El catch aquí cubre fallos inesperados del runtime.
    service.start(video, setQuality).catch(err => {
      console.error('[useFaceCapture] Unexpected error in start():', err);
      setQuality({
        status: 'error',
        faceDetected: false,
        faceCentered: false,
        lightAdequate: false,
        motionStable: false,
        message: 'Modo demo activo',
      });
    });

    return () => {
      service.stop();
      // Guardar snapshot del buffer antes de dispose() para que siga disponible
      // después de que el componente desmonte o active cambie a false.
      bufferRef.current = service.getBuffer();
      service.dispose();
      serviceRef.current = null;
    };
  }, [active, videoRef]);

  return { quality, buffer: bufferRef.current };
}
