import { type RefObject, useEffect, useRef, useState } from 'react';
import { FaceCaptureService } from './FaceCaptureService';
import type { FaceCaptureQuality, RoiSignalBuffer } from './RoiSignalTypes';

const IDLE_QUALITY: FaceCaptureQuality = {
    status: 'idle',
    faceDetected: false,
    faceCentered: false,
    lightAdequate: true,
    motionStable: true,
    message: '',
};

/**
 * Hook React que envuelve FaceCaptureService para la capa de UI.
 *
 * - Cuando `active` pasa a true: crea el servicio, carga MediaPipe y arranca el loop.
 * - Cuando `active` pasa a false o el componente desmonta: para el loop, guarda el
 *   buffer acumulado y libera el modelo.
 *
 * RppgVitalSignsDetector (Fase 2) NO usa este hook: instancia FaceCaptureService
 * directamente, ya que implementa IVitalSignsDetector sin depender de React.
 */
export function useFaceCapture(
    videoRef: RefObject<HTMLVideoElement | null>,
    active: boolean,
): { quality: FaceCaptureQuality; buffer: RoiSignalBuffer | null } {
    const [quality, setQuality] = useState<FaceCaptureQuality>(IDLE_QUALITY);
    const [buffer, setBuffer] = useState<RoiSignalBuffer | null>(null);
    const serviceRef = useRef<FaceCaptureService | null>(null);

    useEffect(() => {
        if (!active) {
            setQuality(IDLE_QUALITY);
            return;
        }

        let cancelled = false;
        const service = new FaceCaptureService(setQuality);
        serviceRef.current = service;

        service.initialize().then(() => {
            if (cancelled) return;
            const video = videoRef.current;
            if (video) service.start(video);
        });

        return () => {
            cancelled = true;
            service.stop();
            setBuffer(service.getBuffer());
            service.dispose();
            serviceRef.current = null;
        };
    // videoRef es un objeto estable (useRef); incluirlo no provoca re-ejecuciones.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active]);

    return { quality, buffer };
}
