/**
 * @file src/screens/MetronomeScreen.jsx
 * @version 2.3.3
 * Full-screen Metronome with compact 5-row layout and interactive Polyrhythm Roll Editor:
 * 1) Click: Natural/Synth + Keep on exit
 * 2) Master BPMs (- / BPM / + and range slider; double-tap BPM to reset to 120)
 * 3) Start / Stop Metronome
 * 4) Beat subdivision: Quarter (1/4), Eighth (1/8), Triplet (1/3), Sixteenth (1/16) with inline note icons
 * 5) Multi-line Polyrhythm Roll Editor (MetronomeRollEditor)
 */
import React, { useContext, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Moon, Pause, Play, RotateCcw, Sun } from 'lucide-react';
import { AppContext } from '../shared/AppContext';
import MetronomeRollEditor from '../components/MetronomeRollEditor';
import {
    addMetronomeTrack,
    cycleMetronomeTrackVoice,
    getMetronomeState,
    removeLastMetronomeTrack,
    setMetronomeBpm,
    setMetronomePersistent,
    setMetronomePlaying,
    setMetronomeSoundMode,
    setMetronomeSubdivision,
    setMetronomeTrackStepCount,
    subscribeMetronomeState,
    toggleMetronomePlaying,
    toggleMetronomeTrackStep,
} from '../shared/audioEngine';

export const __version__ = '2.3.3';

function SubdivisionIcon({ type }) {
    const commonProps = {
        height: 14,
        fill: 'currentColor',
        stroke: 'currentColor',
        style: {
            display: 'inline-block',
            verticalAlign: 'middle',
            flexShrink: 0,
            margin: '-2px 0',
        },
        'aria-hidden': 'true',
    };

    if (type === 1) {
        // Quarter note (1/4)
        return (
            <svg width="13" viewBox="0 0 20 22" {...commonProps}>
                <ellipse
                    cx="8.5"
                    cy="16.5"
                    rx="3.3"
                    ry="2.3"
                    transform="rotate(-20 8.5 16.5)"
                    stroke="none"
                />
                <line x1="11.3" y1="16" x2="11.3" y2="3.5" strokeWidth="1.9" />
            </svg>
        );
    }

    if (type === 2) {
        // Beamed eighth notes (1/8)
        return (
            <svg width="17" viewBox="0 0 26 22" {...commonProps}>
                <ellipse
                    cx="6.5"
                    cy="16.5"
                    rx="3.1"
                    ry="2.2"
                    transform="rotate(-20 6.5 16.5)"
                    stroke="none"
                />
                <ellipse
                    cx="18.5"
                    cy="16.5"
                    rx="3.1"
                    ry="2.2"
                    transform="rotate(-20 18.5 16.5)"
                    stroke="none"
                />
                <line x1="9.2" y1="16" x2="9.2" y2="4" strokeWidth="1.8" />
                <line x1="21.2" y1="16" x2="21.2" y2="4" strokeWidth="1.8" />
                <line x1="8.4" y1="4.5" x2="22" y2="4.5" strokeWidth="2.8" />
            </svg>
        );
    }

    if (type === 3) {
        // Beamed triplet (1/3)
        return (
            <svg width="20" viewBox="0 0 34 24" {...commonProps}>
                <text
                    x="18.2"
                    y="6.8"
                    textAnchor="middle"
                    fontSize="8"
                    fontWeight="800"
                    stroke="none">
                    3
                </text>
                {[5.5, 15.5, 25.5].map((cx) => (
                    <React.Fragment key={cx}>
                        <ellipse
                            cx={cx}
                            cy="19"
                            rx="2.9"
                            ry="2.1"
                            transform={`rotate(-20 ${cx} 19)`}
                            stroke="none"
                        />
                        <line
                            x1={cx + 2.5}
                            y1="18.5"
                            x2={cx + 2.5}
                            y2="9.2"
                            strokeWidth="1.7"
                        />
                    </React.Fragment>
                ))}
                <line x1="7.2" y1="9.6" x2="28.8" y2="9.6" strokeWidth="2.6" />
            </svg>
        );
    }

    // Double-beamed sixteenth notes (1/16)
    return (
        <svg width="22" viewBox="0 0 38 22" {...commonProps}>
            {[5, 13, 21, 29].map((cx) => (
                <React.Fragment key={cx}>
                    <ellipse
                        cx={cx}
                        cy="16.8"
                        rx="2.7"
                        ry="2"
                        transform={`rotate(-20 ${cx} 16.8)`}
                        stroke="none"
                    />
                    <line
                        x1={cx + 2.3}
                        y1="16.3"
                        x2={cx + 2.3}
                        y2="4"
                        strokeWidth="1.6"
                    />
                </React.Fragment>
            ))}
            <line x1="6.6" y1="4.4" x2="32" y2="4.4" strokeWidth="2.4" />
            <line x1="6.6" y1="8.1" x2="32" y2="8.1" strokeWidth="2.4" />
        </svg>
    );
}

export default function MetronomeScreen({ onBack }) {
    const { darkMode, setDarkMode } = useContext(AppContext);
    const [metroState, setMetroState] = useState(() => getMetronomeState());
    const lastBpmTapRef = useRef(0);

    useEffect(() => {
        return subscribeMetronomeState((st) => setMetroState(st));
    }, []);

    const handleBpmTap = () => {
        const now = Date.now();
        if (now - lastBpmTapRef.current < 350) {
            setMetronomeBpm(120);
            lastBpmTapRef.current = 0;
        } else {
            lastBpmTapRef.current = now;
        }
    };

    const handleBack = () => {
        const latest = getMetronomeState();
        if (!latest.persistent && latest.isPlaying) {
            setMetronomePlaying(false);
        }
        onBack();
    };

    return (
        <>
            <header className="app-header">
                <div className="header-left">
                    <button className="icon-btn" onClick={handleBack}>
                        <ArrowLeft size={22} />
                    </button>
                    <h1 className="header-title">SHR Metronome</h1>
                </div>
                <div className="header-actions">
                    <button
                        className="icon-btn"
                        title="Toggle Dark Mode"
                        onClick={() => setDarkMode(!darkMode)}>
                        {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                </div>
            </header>

            <main className="content-scroll">
                <div
                    style={{
                        maxWidth: 460,
                        margin: '0 auto',
                        padding: '12px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                    }}>
                    {/* ROW 1: Click (Natural / Synth) + Keep on exit */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 10,
                            padding: '10px 14px',
                            borderRadius: 10,
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-surface)',
                            fontSize: '0.86rem',
                        }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>
                                Click:
                            </span>
                            <div
                                style={{
                                    display: 'inline-flex',
                                    background: 'var(--bg-primary)',
                                    padding: 3,
                                    borderRadius: 8,
                                    border: '1px solid var(--border-color)',
                                }}>
                                {[
                                    { id: 'natural', label: 'Natural' },
                                    { id: 'synth', label: 'Synth' },
                                ].map((opt) => {
                                    const active = metroState.soundMode === opt.id;
                                    return (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => setMetronomeSoundMode(opt.id)}
                                            style={{
                                                padding: '4px 10px',
                                                borderRadius: 6,
                                                border: 'none',
                                                fontWeight: 700,
                                                fontSize: '0.8rem',
                                                background: active
                                                    ? 'var(--accent-color)'
                                                    : 'transparent',
                                                color: active
                                                    ? '#ffffff'
                                                    : 'var(--text-secondary)',
                                                cursor: 'pointer',
                                            }}>
                                            {opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>
                                Keep on exit:
                            </span>
                            <button
                                type="button"
                                onClick={() =>
                                    setMetronomePersistent(!metroState.persistent)
                                }
                                style={{
                                    padding: '4px 10px',
                                    borderRadius: 6,
                                    border: '1px solid var(--border-color)',
                                    fontWeight: 700,
                                    fontSize: '0.8rem',
                                    background: metroState.persistent
                                        ? 'var(--accent-color)'
                                        : 'var(--bg-primary)',
                                    color: metroState.persistent
                                        ? '#ffffff'
                                        : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                }}>
                                {metroState.persistent ? 'ON' : 'OFF'}
                            </button>
                        </div>
                    </div>

                    {/* ROW 2: Master BPM Controls */}
                    <div
                        style={{
                            padding: '12px 14px',
                            borderRadius: 10,
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-surface)',
                        }}>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: 8,
                            }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                    type="button"
                                    className="btn-primary"
                                    onClick={() => setMetronomeBpm(metroState.bpm - 5)}>
                                    -5
                                </button>
                                <button
                                    type="button"
                                    className="btn-primary"
                                    onClick={() => setMetronomeBpm(metroState.bpm - 1)}>
                                    -1
                                </button>
                            </div>

                            <div
                                title="Double-tap to reset to 120 BPM"
                                onClick={handleBpmTap}
                                style={{
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                }}>
                                <span style={{ fontSize: '1.85rem', fontWeight: 800 }}>
                                    {metroState.bpm}
                                </span>
                                <span
                                    style={{
                                        fontSize: '0.85rem',
                                        color: 'var(--text-secondary)',
                                        marginLeft: 5,
                                        fontWeight: 700,
                                    }}>
                                    BPM
                                </span>
                            </div>

                            <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                    type="button"
                                    className="btn-primary"
                                    onClick={() => setMetronomeBpm(metroState.bpm + 1)}>
                                    +1
                                </button>
                                <button
                                    type="button"
                                    className="btn-primary"
                                    onClick={() => setMetronomeBpm(metroState.bpm + 5)}>
                                    +5
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <input
                                type="range"
                                min="40"
                                max="240"
                                value={metroState.bpm}
                                onChange={(e) =>
                                    setMetronomeBpm(parseInt(e.target.value, 10))
                                }
                                onDoubleClick={() => setMetronomeBpm(120)}
                                style={{
                                    flex: 1,
                                    accentColor: 'var(--accent-color)',
                                    cursor: 'pointer',
                                }}
                            />
                            <button
                                type="button"
                                className="icon-btn"
                                title="Reset to 120 BPM"
                                onClick={() => setMetronomeBpm(120)}
                                style={{ padding: 4 }}>
                                <RotateCcw size={17} />
                            </button>
                        </div>
                    </div>

                    {/* ROW 3: Start / Stop Metronome */}
                    <button
                        type="button"
                        className="btn-primary"
                        onClick={() => toggleMetronomePlaying()}
                        style={{
                            width: '100%',
                            padding: '11px',
                            fontSize: '1rem',
                            fontWeight: 800,
                            borderRadius: 10,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            background: metroState.isPlaying
                                ? '#dc2626'
                                : 'var(--accent-color)',
                        }}>
                        {metroState.isPlaying ? (
                            <>
                                <Pause size={18} /> Stop Metronome
                            </>
                        ) : (
                            <>
                                <Play size={18} /> Start Metronome
                            </>
                        )}
                    </button>

                    {/* ROW 4: Beat subdivision */}
                    <div
                        style={{
                            padding: '10px 14px',
                            borderRadius: 10,
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-surface)',
                        }}>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: 6,
                            }}>
                            {[
                                { val: 1, label: '1/4', sub: 'Quarter' },
                                { val: 2, label: '1/8', sub: 'Eighth' },
                                { val: 3, label: '1/3', sub: 'Triplet' },
                                { val: 4, label: '1/16', sub: 'Sixteenth' },
                            ].map((opt) => {
                                const active = metroState.subdivision === opt.val;
                                return (
                                    <button
                                        key={opt.val}
                                        type="button"
                                        onClick={() => setMetronomeSubdivision(opt.val)}
                                        style={{
                                            padding: '7px 4px',
                                            borderRadius: 8,
                                            border: '1px solid var(--border-color)',
                                            fontWeight: 700,
                                            fontSize: '0.78rem',
                                            background: active
                                                ? 'var(--accent-color)'
                                                : 'var(--bg-primary)',
                                            color: active
                                                ? '#ffffff'
                                                : 'var(--text-primary)',
                                            cursor: 'pointer',
                                            lineHeight: 1.2,
                                        }}>
                                        <div>{opt.sub}</div>
                                        <div
                                            style={{
                                                fontSize: '0.7rem',
                                                opacity: 0.85,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 3,
                                            }}>
                                            <span>({opt.label})</span>
                                            <SubdivisionIcon type={opt.val} />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* ROW 5: Interactive Multi-Line Polyrhythm Roll Editor */}
                    <div
                        style={{
                            padding: '10px 14px',
                            borderRadius: 10,
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-surface)',
                        }}>
                        <MetronomeRollEditor
                            tracks={metroState.tracks}
                            currentStepByTrack={metroState.currentStepByTrack}
                            isPlaying={metroState.isPlaying}
                            onToggleStep={toggleMetronomeTrackStep}
                            onChangeTrackSteps={setMetronomeTrackStepCount}
                            onCycleTrackVoice={cycleMetronomeTrackVoice}
                            onAddTrack={addMetronomeTrack}
                            onRemoveTrack={removeLastMetronomeTrack}
                        />
                    </div>
                </div>
            </main>
        </>
    );
}
