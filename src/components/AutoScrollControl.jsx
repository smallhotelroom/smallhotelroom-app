/**
 * @file src/components/AutoScrollControl.jsx
 * @version 1.1.0
 * Self-contained 60fps Auto-Scroll header pill and vertical speed popover for SongScreen.
 * Uses the song's `targetDurationSeconds` when provided, falling back to 3:30 (210s).
 */
import React, { useEffect, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { APP_DEFAULTS } from '../shared/AppContext';

export const __version__ = '1.1.0';

const SCROLL_SPEED_STORAGE_KEY = 'shr_scroll_speed';
const DEFAULT_TARGET_DURATION_SECONDS =
    APP_DEFAULTS.scroll_target_duration_seconds || 210; // 3 minutes 30 seconds at 1.0x

export default function AutoScrollControl({
    scrollContainerRef,
    speedMenuOpen,
    setSpeedMenuOpen,
    targetDurationSeconds = null,
}) {
    const [autoScrollActive, setAutoScrollActive] = useState(false);
    const [scrollSpeed, setScrollSpeed] = useState(() => {
        const saved = parseFloat(localStorage.getItem(SCROLL_SPEED_STORAGE_KEY));
        return !Number.isNaN(saved) && saved >= 0.0 && saved <= 3.0
            ? saved
            : APP_DEFAULTS.default_scroll_speed ?? 1.0;
    });

    const effectiveDurationSeconds =
        Number(targetDurationSeconds) > 0
            ? Number(targetDurationSeconds)
            : DEFAULT_TARGET_DURATION_SECONDS;

    const updateScrollSpeed = (nextVal) => {
        const clamped = Math.max(0.0, Math.min(3.0, Math.round(nextVal * 10) / 10));
        setScrollSpeed(clamped);
        localStorage.setItem(SCROLL_SPEED_STORAGE_KEY, String(clamped));
    };

    const handleTogglePlay = () => {
        setAutoScrollActive((prev) => !prev);
    };

    // Smooth 60fps Auto-Scroll loop dynamically scaled so 1.0x = song duration (or 3:30 default)
    useEffect(() => {
        if (!autoScrollActive) {
            return;
        }
        let animationFrameId;
        let lastTime = performance.now();
        let subPixelAccumulator = 0;

        const step = (now) => {
            const dt = (now - lastTime) / 1000;
            lastTime = now;

            const el = scrollContainerRef?.current;
            if (el) {
                const totalScrollableDistance = Math.max(
                    0,
                    el.scrollHeight - el.clientHeight
                );
                if (totalScrollableDistance > 0 && scrollSpeed > 0) {
                    const basePixelsPerSecond =
                        totalScrollableDistance / effectiveDurationSeconds;
                    const pixelsPerSecond = basePixelsPerSecond * scrollSpeed;

                    subPixelAccumulator += pixelsPerSecond * dt;
                    if (subPixelAccumulator >= 1) {
                        const wholePixels = Math.floor(subPixelAccumulator);
                        el.scrollTop += wholePixels;
                        subPixelAccumulator -= wholePixels;

                        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
                            setAutoScrollActive(false);
                            return;
                        }
                    }
                }
            }
            animationFrameId = requestAnimationFrame(step);
        };

        animationFrameId = requestAnimationFrame(step);
        return () => cancelAnimationFrame(animationFrameId);
    }, [autoScrollActive, scrollSpeed, scrollContainerRef, effectiveDurationSeconds]);

    return (
        <div className="autoscroll-anchor">
            <div className={`autoscroll-pill ${autoScrollActive ? 'active' : ''}`}>
                <button
                    className="autoscroll-play-btn"
                    title={autoScrollActive ? 'Pause Auto-Scroll' : 'Start Auto-Scroll'}
                    onClick={handleTogglePlay}>
                    {autoScrollActive ? <Pause size={15} /> : <Play size={15} />}
                </button>
                <button
                    className="autoscroll-speed-trigger"
                    title="Adjust Scroll Speed"
                    onClick={() => setSpeedMenuOpen((o) => !o)}>
                    {scrollSpeed.toFixed(1)}x
                </button>
            </div>

            {speedMenuOpen && (
                <div
                    className="autoscroll-vertical-popover"
                    style={{ zIndex: 20001 }}
                    onClick={(e) => e.stopPropagation()}>
                    <button
                        className="autoscroll-step-btn"
                        title="Faster (+0.1x)"
                        onClick={() => updateScrollSpeed(scrollSpeed + 0.1)}>
                        +
                    </button>
                    <div
                        className="autoscroll-vertical-slider-wrap"
                        onDoubleClick={() => updateScrollSpeed(1.0)}
                        title="Double-click to reset to 1.0x">
                        <input
                            type="range"
                            className="autoscroll-vertical-slider"
                            min="0.0"
                            max="3.0"
                            step="0.1"
                            value={scrollSpeed}
                            onChange={(e) =>
                                updateScrollSpeed(parseFloat(e.target.value))
                            }
                            onDoubleClick={() => updateScrollSpeed(1.0)}
                        />
                    </div>
                    <span
                        style={{
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            userSelect: 'none',
                        }}
                        title="Double-click to reset to 1.0x"
                        onDoubleClick={() => updateScrollSpeed(1.0)}>
                        {scrollSpeed.toFixed(1)}x
                    </span>
                    <button
                        className="autoscroll-step-btn"
                        title="Slower (-0.1x)"
                        onClick={() => updateScrollSpeed(scrollSpeed - 0.1)}>
                        -
                    </button>
                </div>
            )}
        </div>
    );
}
