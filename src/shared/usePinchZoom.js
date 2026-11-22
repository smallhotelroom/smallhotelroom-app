/**
 * @file src/shared/usePinchZoom.js
 * @version 1.0.0
 * Lightweight two-finger pinch-to-zoom hook with double-click reset.
 */
import { useRef } from 'react';

export const __version__ = '1.0.0';

export default function usePinchZoom(scale, setScale, { min = 0.75, max = 1.7, defaultScale = 1 } = {}) {
    const startDistRef = useRef(null);
    const startScaleRef = useRef(scale);

    const onTouchStart = (e) => {
        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            startDistRef.current = Math.hypot(dx, dy);
            startScaleRef.current = scale;
        }
    };

    const onTouchMove = (e) => {
        if (e.touches.length === 2 && startDistRef.current) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.hypot(dx, dy);
            const ratio = dist / startDistRef.current;
            const next = Math.max(min, Math.min(max, startScaleRef.current * ratio));
            setScale(Math.round(next * 100) / 100);
        }
    };

    const onTouchEnd = (e) => {
        if (e.touches.length < 2) {
            startDistRef.current = null;
        }
    };

    const onDoubleClick = () => {
        if (scale !== defaultScale) {
            setScale(defaultScale);
        }
    };

    return {
        onTouchStart,
        onTouchMove,
        onTouchEnd,
        onDoubleClick,
    };
}
