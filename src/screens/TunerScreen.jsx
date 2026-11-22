/**
 * @file src/screens/TunerScreen.jsx
 * @version 1.3.0
 * Single-instrument Reference Ear Tuner with horizontal instrument switcher
 * (Guitar 6/7/8, Ukulele, Bass 4/5/6, Violin/Mandolin, Sax/Winds, Chromatic with octave & span controls,
 * and custom Frequency generator), Natural/Synth tone selector, optional hands-free Repeat Loop,
 * and theme-aware accent styling (Small Hotel Room / Basic).
 */
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Moon, Play, Repeat, Square, Sun, Volume2 } from 'lucide-react';
import { AppContext } from '../shared/AppContext';
import {
    SAX_WINDS_NOTES,
    UKULELE_STRINGS,
    VIOLIN_STRINGS,
    buildChromaticNotes,
    getBassStrings,
    getGuitarStrings,
    playNoteFrequency,
} from '../shared/audioEngine';

export const __version__ = '1.3.0';

const TUNER_SOUND_MODE_KEY = 'shr_tuner_sound_mode';
const TUNER_INSTRUMENT_KEY = 'shr_tuner_instrument';
const TUNER_GUITAR_STRINGS_KEY = 'shr_tuner_guitar_strings';
const TUNER_BASS_STRINGS_KEY = 'shr_tuner_bass_strings';
const TUNER_OCTAVE_KEY = 'shr_tuner_chromatic_octave';
const TUNER_OCTAVE_SPAN_KEY = 'shr_tuner_chromatic_span';
const TUNER_CUSTOM_FREQ_KEY = 'shr_tuner_custom_freq';

const MIN_CUSTOM_FREQ = 20;
const MAX_CUSTOM_FREQ = 2000;
const LOG_MIN_FREQ = Math.log(MIN_CUSTOM_FREQ);
const LOG_MAX_FREQ = Math.log(MAX_CUSTOM_FREQ);
const FREQ_PRESETS = [415, 432, 440, 442, 444];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function clampFreq(val) {
    const num = Number(val);
    if (Number.isNaN(num)) return 440;
    return Math.round(Math.max(MIN_CUSTOM_FREQ, Math.min(MAX_CUSTOM_FREQ, num)) * 10) / 10;
}

function freqToSliderPos(freq) {
    const clamped = clampFreq(freq);
    return ((Math.log(clamped) - LOG_MIN_FREQ) / (LOG_MAX_FREQ - LOG_MIN_FREQ)) * 1000;
}

function sliderPosToFreq(pos) {
    const ratio = Math.max(0, Math.min(1, Number(pos) / 1000));
    const raw = Math.exp(LOG_MIN_FREQ + ratio * (LOG_MAX_FREQ - LOG_MIN_FREQ));
    return Math.round(raw * 10) / 10;
}

function describeNearestNote(freq) {
    if (!freq || freq <= 0) return '';
    const midiFloat = 69 + 12 * Math.log2(freq / 440);
    const nearestMidi = Math.round(midiFloat);
    const cents = Math.round((midiFloat - nearestMidi) * 100);
    const noteName = NOTE_NAMES[((nearestMidi % 12) + 12) % 12];
    const octave = Math.floor(nearestMidi / 12) - 1;
    const centsStr = cents > 0 ? `+${cents}¢` : `${cents}¢`;
    return `${noteName}${octave} (${centsStr})`;
}

const GUITAR_VARIANT_SUBTITLES = {
    6: 'Standard E A D G B E',
    7: 'Standard B E A D G B E',
    8: 'Standard F# B E A D G B E',
};

const BASS_VARIANT_SUBTITLES = {
    4: 'Standard E A D G',
    5: 'Standard B E A D G',
    6: 'Standard B E A D G C',
};

const INSTRUMENT_TABS = [
    {
        id: 'guitar',
        label: 'Guitar',
        title: 'Guitar',
        subtitle: 'Standard E A D G B E',
        columns: 3,
    },
    {
        id: 'ukulele',
        label: 'Ukulele',
        title: 'Ukulele (4 Strings)',
        subtitle: 'Standard G C E A',
        columns: 2,
    },
    {
        id: 'bass',
        label: 'Bass',
        title: 'Bass',
        subtitle: 'Standard E A D G',
        columns: 2,
    },
    {
        id: 'violin',
        label: 'Violin',
        title: 'Violin / Mandolin',
        subtitle: 'Standard G D A E',
        columns: 2,
    },
    {
        id: 'winds',
        label: 'Sax / Winds',
        title: 'Saxophone & Winds',
        subtitle: 'Concert Pitch Reference',
        columns: 2,
    },
    {
        id: 'chromatic',
        label: 'Chromatic',
        title: 'Chromatic Reference',
        subtitle: 'A4 = 440.0 Hz',
        columns: 3,
    },
    {
        id: 'frequency',
        label: 'Frequency',
        title: 'Frequency Generator',
        subtitle: '20.0 – 2000.0 Hz',
        columns: 1,
    },
];

export default function TunerScreen({ onBack }) {
    const { darkMode, setDarkMode } = useContext(AppContext);

    const [soundMode, setSoundMode] = useState(() => {
        return localStorage.getItem(TUNER_SOUND_MODE_KEY) || 'natural';
    });
    const [instrumentId, setInstrumentId] = useState(() => {
        const saved = localStorage.getItem(TUNER_INSTRUMENT_KEY);
        return INSTRUMENT_TABS.some((t) => t.id === saved) ? saved : 'guitar';
    });
    const [guitarStringCount, setGuitarStringCount] = useState(() => {
        const saved = parseInt(localStorage.getItem(TUNER_GUITAR_STRINGS_KEY), 10);
        return [6, 7, 8].includes(saved) ? saved : 6;
    });
    const [bassStringCount, setBassStringCount] = useState(() => {
        const saved = parseInt(localStorage.getItem(TUNER_BASS_STRINGS_KEY), 10);
        return [4, 5, 6].includes(saved) ? saved : 4;
    });
    const [chromaticOctave, setChromaticOctave] = useState(() => {
        const saved = parseInt(localStorage.getItem(TUNER_OCTAVE_KEY), 10);
        return !Number.isNaN(saved) && saved >= 2 && saved <= 6 ? saved : 4;
    });
    const [chromaticSpan, setChromaticSpan] = useState(() => {
        const saved = parseInt(localStorage.getItem(TUNER_OCTAVE_SPAN_KEY), 10);
        return saved === 2 ? 2 : 1;
    });
    const [customFreq, setCustomFreq] = useState(() => {
        const saved = localStorage.getItem(TUNER_CUSTOM_FREQ_KEY);
        return saved !== null ? clampFreq(saved) : 440;
    });
    const [loopEnabled, setLoopEnabled] = useState(false);
    const [activeStringId, setActiveStringId] = useState(null);

    const stopVoiceRef = useRef(null);
    const loopIntervalRef = useRef(null);
    const highlightTimeoutRef = useRef(null);

    const stopCurrentSound = () => {
        if (loopIntervalRef.current) {
            clearInterval(loopIntervalRef.current);
            loopIntervalRef.current = null;
        }
        if (highlightTimeoutRef.current) {
            clearTimeout(highlightTimeoutRef.current);
            highlightTimeoutRef.current = null;
        }
        if (stopVoiceRef.current) {
            stopVoiceRef.current();
            stopVoiceRef.current = null;
        }
        setActiveStringId(null);
    };

    useEffect(() => {
        return () => stopCurrentSound();
    }, []);

    const handleModeSelect = (nextMode) => {
        setSoundMode(nextMode);
        localStorage.setItem(TUNER_SOUND_MODE_KEY, nextMode);
    };

    const handleInstrumentSelect = (nextId) => {
        if (nextId === instrumentId) return;
        stopCurrentSound();
        setInstrumentId(nextId);
        localStorage.setItem(TUNER_INSTRUMENT_KEY, nextId);
    };

    const handleGuitarStringCountSelect = (count) => {
        if (count === guitarStringCount) return;
        stopCurrentSound();
        setGuitarStringCount(count);
        localStorage.setItem(TUNER_GUITAR_STRINGS_KEY, String(count));
    };

    const handleBassStringCountSelect = (count) => {
        if (count === bassStringCount) return;
        stopCurrentSound();
        setBassStringCount(count);
        localStorage.setItem(TUNER_BASS_STRINGS_KEY, String(count));
    };

    const handleOctaveChange = (delta) => {
        const maxOct = chromaticSpan === 2 ? 5 : 6;
        const nextOct = Math.max(2, Math.min(maxOct, chromaticOctave + delta));
        if (nextOct === chromaticOctave) return;
        stopCurrentSound();
        setChromaticOctave(nextOct);
        localStorage.setItem(TUNER_OCTAVE_KEY, String(nextOct));
    };

    const handleSpanSelect = (nextSpan) => {
        if (nextSpan === chromaticSpan) return;
        stopCurrentSound();
        setChromaticSpan(nextSpan);
        localStorage.setItem(TUNER_OCTAVE_SPAN_KEY, String(nextSpan));
        if (nextSpan === 2 && chromaticOctave > 5) {
            setChromaticOctave(5);
            localStorage.setItem(TUNER_OCTAVE_KEY, '5');
        }
    };

    const updateCustomFreq = (nextVal) => {
        const clamped = clampFreq(nextVal);
        setCustomFreq(clamped);
        localStorage.setItem(TUNER_CUSTOM_FREQ_KEY, String(clamped));
        if (activeStringId === 'custom-freq') {
            stopCurrentSound();
        }
    };

    const activeInstrument =
        INSTRUMENT_TABS.find((t) => t.id === instrumentId) || INSTRUMENT_TABS[0];

    const currentNotes = useMemo(() => {
        switch (instrumentId) {
            case 'ukulele':
                return UKULELE_STRINGS;
            case 'bass':
                return getBassStrings(bassStringCount);
            case 'violin':
                return VIOLIN_STRINGS;
            case 'winds':
                return SAX_WINDS_NOTES;
            case 'chromatic':
                return buildChromaticNotes(chromaticOctave, chromaticSpan);
            case 'frequency':
                return [];
            case 'guitar':
            default:
                return getGuitarStrings(guitarStringCount);
        }
    }, [
        instrumentId,
        guitarStringCount,
        bassStringCount,
        chromaticOctave,
        chromaticSpan,
    ]);

    const triggerString = (strObj, forceLoop = loopEnabled) => {
        // If looping and tapping the already-active note, toggle it off
        if (forceLoop && activeStringId === strObj.id) {
            stopCurrentSound();
            return;
        }

        stopCurrentSound();
        setActiveStringId(strObj.id);

        const playOnce = () => {
            if (stopVoiceRef.current) {
                stopVoiceRef.current();
            }
            stopVoiceRef.current = playNoteFrequency(strObj.freq, {
                mode: soundMode,
                duration: 3.0,
            });
        };

        playOnce();

        if (forceLoop) {
            loopIntervalRef.current = setInterval(playOnce, 2500);
        } else {
            const currentId = strObj.id;
            highlightTimeoutRef.current = setTimeout(() => {
                setActiveStringId((prev) => (prev === currentId ? null : prev));
            }, 1800);
        }
    };

    const renderStringButton = (strObj) => {
        const isActive = activeStringId === strObj.id;
        return (
            <button
                key={strObj.id}
                type="button"
                onClick={() => triggerString(strObj)}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 74,
                    padding: '14px 10px',
                    borderRadius: 10,
                    border: isActive
                        ? '2px solid var(--accent-color)'
                        : '1px solid var(--border-color)',
                    background: isActive
                        ? 'rgba(var(--accent-rgb, 86, 148, 0), 0.14)'
                        : 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                    boxShadow: isActive
                        ? '0 0 0 3px rgba(var(--accent-rgb, 86, 148, 0), 0.2)'
                        : 'none',
                }}>
                <div
                    style={{
                        fontSize: instrumentId === 'winds' ? '1.1rem' : '1.35rem',
                        fontWeight: 800,
                        color: isActive
                            ? 'var(--accent-color)'
                            : 'var(--text-primary)',
                    }}>
                    {strObj.label}
                </div>
                {strObj.sublabel && (
                    <div
                        style={{
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            opacity: 0.85,
                            marginTop: 2,
                        }}>
                        {strObj.sublabel}
                    </div>
                )}
                <div
                    style={{
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        marginTop: 2,
                    }}>
                    {instrumentId === 'chromatic'
                        ? `${strObj.freq.toFixed(1)} Hz`
                        : `${strObj.note} · ${strObj.freq.toFixed(1)} Hz`}
                </div>
            </button>
        );
    };

    const maxOctave = chromaticSpan === 2 ? 5 : 6;
    const octaveRangeLabel =
        chromaticSpan === 2
            ? `C${chromaticOctave} – B${chromaticOctave + 1}`
            : `C${chromaticOctave} – B${chromaticOctave}`;

    const activeTitle =
        instrumentId === 'guitar'
            ? `Guitar (${guitarStringCount} Strings)`
            : instrumentId === 'bass'
              ? `Bass (${bassStringCount} Strings)`
              : activeInstrument.title;

    const activeSubtitle =
        instrumentId === 'guitar'
            ? GUITAR_VARIANT_SUBTITLES[guitarStringCount]
            : instrumentId === 'bass'
              ? BASS_VARIANT_SUBTITLES[bassStringCount]
              : instrumentId === 'chromatic'
                ? octaveRangeLabel
                : activeInstrument.subtitle;

    const gridColumns =
        instrumentId === 'bass' && bassStringCount === 6
            ? 3
            : activeInstrument.columns;

    const isCustomFreqPlaying = activeStringId === 'custom-freq';

    return (
        <>
            <header className="app-header">
                <div className="header-left">
                    <button className="icon-btn" onClick={onBack}>
                        <ArrowLeft size={22} />
                    </button>
                    <h1 className="header-title">SHR Tuner</h1>
                </div>
                <div className="header-actions">
                    {activeStringId && (
                        <button
                            className="icon-btn"
                            title="Stop Sound"
                            onClick={stopCurrentSound}>
                            <Square size={18} />
                        </button>
                    )}
                    <button
                        className="icon-btn"
                        title="Toggle Dark Mode"
                        onClick={() => setDarkMode(!darkMode)}>
                        {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                </div>
            </header>

            <main className="content-scroll" style={{ padding: 16 }}>
                {/* Sound & Loop Controls Bar */}
                <div
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        padding: '12px 14px',
                        borderRadius: 10,
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-surface)',
                        marginBottom: 14,
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Volume2 size={18} />
                        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Tone:</span>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                            {['natural', 'synth'].map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => handleModeSelect(m)}
                                    style={{
                                        padding: '5px 12px',
                                        borderRadius: 999,
                                        fontWeight: 700,
                                        fontSize: '0.82rem',
                                        textTransform: 'capitalize',
                                        border:
                                            soundMode === m
                                                ? '1px solid var(--accent-color)'
                                                : '1px solid var(--border-color)',
                                        background:
                                            soundMode === m
                                                ? 'var(--accent-color)'
                                                : 'transparent',
                                        color:
                                            soundMode === m
                                                ? '#ffffff'
                                                : 'var(--text-primary)',
                                        cursor: 'pointer',
                                    }}>
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            const nextLoop = !loopEnabled;
                            setLoopEnabled(nextLoop);
                            if (!nextLoop && loopIntervalRef.current) {
                                stopCurrentSound();
                            }
                        }}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 12px',
                            borderRadius: 999,
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            border: loopEnabled
                                ? '1px solid var(--accent-color)'
                                : '1px solid var(--border-color)',
                            background: loopEnabled
                                ? 'var(--accent-color)'
                                : 'transparent',
                            color: loopEnabled ? '#ffffff' : 'var(--text-primary)',
                            cursor: 'pointer',
                        }}>
                        <Repeat size={15} />
                        {loopEnabled ? 'Loop: ON' : 'Loop: OFF'}
                    </button>
                </div>

                {/* Single-Instrument Switcher Pill Bar */}
                <div
                    role="tablist"
                    aria-label="Tuner Instruments"
                    style={{
                        display: 'flex',
                        gap: 8,
                        overflowX: 'auto',
                        paddingBottom: 6,
                        marginBottom: 14,
                        WebkitOverflowScrolling: 'touch',
                    }}>
                    {INSTRUMENT_TABS.map((inst) => {
                        const isSelected = inst.id === instrumentId;
                        return (
                            <button
                                key={inst.id}
                                type="button"
                                role="tab"
                                aria-selected={isSelected}
                                onClick={() => handleInstrumentSelect(inst.id)}
                                style={{
                                    flexShrink: 0,
                                    padding: '8px 14px',
                                    borderRadius: 999,
                                    fontWeight: 700,
                                    fontSize: '0.86rem',
                                    border: isSelected
                                        ? '1px solid var(--accent-color)'
                                        : '1px solid var(--border-color)',
                                    background: isSelected
                                        ? 'var(--accent-color)'
                                        : 'var(--bg-surface)',
                                    color: isSelected
                                        ? '#ffffff'
                                        : 'var(--text-primary)',
                                    cursor: 'pointer',
                                }}>
                                {inst.label}
                            </button>
                        );
                    })}
                </div>

                {/* Active Instrument Header */}
                <div
                    style={{
                        fontWeight: 800,
                        fontSize: '1rem',
                        marginBottom: 10,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        gap: 8,
                    }}>
                    <span>{activeTitle}</span>
                    <span
                        style={{
                            fontSize: '0.8rem',
                            color: 'var(--text-secondary)',
                            fontWeight: 500,
                        }}>
                        {activeSubtitle}
                    </span>
                </div>

                {/* Guitar String-Count Variant Selector */}
                {instrumentId === 'guitar' && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-surface)',
                            marginBottom: 12,
                        }}>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                            Strings:
                        </span>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                            {[6, 7, 8].map((count) => (
                                <button
                                    key={count}
                                    type="button"
                                    onClick={() => handleGuitarStringCountSelect(count)}
                                    style={{
                                        padding: '5px 12px',
                                        borderRadius: 999,
                                        fontWeight: 700,
                                        fontSize: '0.82rem',
                                        border:
                                            guitarStringCount === count
                                                ? '1px solid var(--accent-color)'
                                                : '1px solid var(--border-color)',
                                        background:
                                            guitarStringCount === count
                                                ? 'var(--accent-color)'
                                                : 'transparent',
                                        color:
                                            guitarStringCount === count
                                                ? '#ffffff'
                                                : 'var(--text-primary)',
                                        cursor: 'pointer',
                                    }}>
                                    {count}-String
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Bass String-Count Variant Selector */}
                {instrumentId === 'bass' && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-surface)',
                            marginBottom: 12,
                        }}>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                            Strings:
                        </span>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                            {[4, 5, 6].map((count) => (
                                <button
                                    key={count}
                                    type="button"
                                    onClick={() => handleBassStringCountSelect(count)}
                                    style={{
                                        padding: '5px 12px',
                                        borderRadius: 999,
                                        fontWeight: 700,
                                        fontSize: '0.82rem',
                                        border:
                                            bassStringCount === count
                                                ? '1px solid var(--accent-color)'
                                                : '1px solid var(--border-color)',
                                        background:
                                            bassStringCount === count
                                                ? 'var(--accent-color)'
                                                : 'transparent',
                                        color:
                                            bassStringCount === count
                                                ? '#ffffff'
                                                : 'var(--text-primary)',
                                        cursor: 'pointer',
                                    }}>
                                    {count}-String
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Chromatic Octave & Span Controls */}
                {instrumentId === 'chromatic' && (
                    <div
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-surface)',
                            marginBottom: 12,
                        }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                                Octave:
                            </span>
                            <button
                                type="button"
                                className="btn-primary"
                                disabled={chromaticOctave <= 2}
                                style={{
                                    padding: '4px 10px',
                                    opacity: chromaticOctave <= 2 ? 0.45 : 1,
                                }}
                                onClick={() => handleOctaveChange(-1)}>
                                −
                            </button>
                            <span
                                style={{
                                    minWidth: 24,
                                    textAlign: 'center',
                                    fontWeight: 800,
                                    fontSize: '0.95rem',
                                }}>
                                {chromaticOctave}
                            </span>
                            <button
                                type="button"
                                className="btn-primary"
                                disabled={chromaticOctave >= maxOctave}
                                style={{
                                    padding: '4px 10px',
                                    opacity: chromaticOctave >= maxOctave ? 0.45 : 1,
                                }}
                                onClick={() => handleOctaveChange(1)}>
                                +
                            </button>
                        </div>

                        <div style={{ display: 'inline-flex', gap: 6 }}>
                            {[1, 2].map((span) => (
                                <button
                                    key={span}
                                    type="button"
                                    onClick={() => handleSpanSelect(span)}
                                    style={{
                                        padding: '5px 10px',
                                        borderRadius: 999,
                                        fontWeight: 700,
                                        fontSize: '0.8rem',
                                        border:
                                            chromaticSpan === span
                                                ? '1px solid var(--accent-color)'
                                                : '1px solid var(--border-color)',
                                        background:
                                            chromaticSpan === span
                                                ? 'var(--accent-color)'
                                                : 'transparent',
                                        color:
                                            chromaticSpan === span
                                                ? '#ffffff'
                                                : 'var(--text-primary)',
                                        cursor: 'pointer',
                                    }}>
                                    {span} Oct
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Custom Frequency Generator (Metronome-BPM-style panel) */}
                {instrumentId === 'frequency' ? (
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 16,
                            padding: '20px 16px',
                            borderRadius: 12,
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-surface)',
                        }}>
                        {/* Big Readout */}
                        <div style={{ textAlign: 'center' }}>
                            <div
                                style={{
                                    fontSize: '2.6rem',
                                    fontWeight: 800,
                                    lineHeight: 1.1,
                                    color: isCustomFreqPlaying
                                        ? 'var(--accent-color)'
                                        : 'var(--text-primary)',
                                    fontVariantNumeric: 'tabular-nums',
                                }}>
                                {customFreq.toFixed(1)}{' '}
                                <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                                    Hz
                                </span>
                            </div>
                            <div
                                style={{
                                    marginTop: 4,
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    color: 'var(--text-secondary)',
                                }}>
                                Nearest: {describeNearestNote(customFreq)}
                            </div>
                        </div>

                        {/* Stepper Row (-10, -1, +1, +10) */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexWrap: 'wrap',
                                gap: 8,
                                width: '100%',
                            }}>
                            {[-10, -1, 1, 10].map((delta) => (
                                <button
                                    key={delta}
                                    type="button"
                                    className="btn-primary"
                                    style={{
                                        minWidth: 56,
                                        padding: '8px 12px',
                                        fontWeight: 700,
                                    }}
                                    onClick={() => updateCustomFreq(customFreq + delta)}>
                                    {delta > 0 ? `+${delta}` : delta}
                                </button>
                            ))}
                        </div>

                        {/* Logarithmic Range Slider */}
                        <div style={{ width: '100%', padding: '0 4px' }}>
                            <input
                                type="range"
                                min={0}
                                max={1000}
                                step={1}
                                value={Math.round(freqToSliderPos(customFreq))}
                                aria-label="Frequency in Hz"
                                onChange={(e) =>
                                    updateCustomFreq(sliderPosToFreq(e.target.value))
                                }
                                style={{
                                    width: '100%',
                                    accentColor: 'var(--accent-color)',
                                    cursor: 'pointer',
                                }}
                            />
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    fontSize: '0.75rem',
                                    color: 'var(--text-secondary)',
                                    marginTop: 2,
                                }}>
                                <span>{MIN_CUSTOM_FREQ} Hz</span>
                                <span>440 Hz</span>
                                <span>{MAX_CUSTOM_FREQ} Hz</span>
                            </div>
                        </div>

                        {/* Quick Reference Presets */}
                        <div
                            style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                justifyContent: 'center',
                                gap: 6,
                            }}>
                            {FREQ_PRESETS.map((preset) => {
                                const isPresetActive = Math.abs(customFreq - preset) < 0.05;
                                return (
                                    <button
                                        key={preset}
                                        type="button"
                                        onClick={() => updateCustomFreq(preset)}
                                        style={{
                                            padding: '5px 11px',
                                            borderRadius: 999,
                                            fontWeight: 700,
                                            fontSize: '0.8rem',
                                            border: isPresetActive
                                                ? '1px solid var(--accent-color)'
                                                : '1px solid var(--border-color)',
                                            background: isPresetActive
                                                ? 'var(--accent-color)'
                                                : 'transparent',
                                            color: isPresetActive
                                                ? '#ffffff'
                                                : 'var(--text-primary)',
                                            cursor: 'pointer',
                                        }}>
                                        {preset} Hz
                                    </button>
                                );
                            })}
                        </div>

                        {/* Play / Stop Action Button */}
                        <button
                            type="button"
                            className="btn-primary"
                            onClick={() =>
                                isCustomFreqPlaying
                                    ? stopCurrentSound()
                                    : triggerString({
                                          id: 'custom-freq',
                                          freq: customFreq,
                                      })
                            }
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                width: '100%',
                                maxWidth: 240,
                                padding: '12px 20px',
                                fontSize: '1rem',
                                fontWeight: 800,
                                borderRadius: 10,
                                background: isCustomFreqPlaying
                                    ? '#dc2626'
                                    : 'var(--accent-color)',
                            }}>
                            {isCustomFreqPlaying ? (
                                <>
                                    <Square size={18} /> Stop
                                </>
                            ) : (
                                <>
                                    <Play size={18} /> Play {customFreq.toFixed(1)} Hz
                                </>
                            )}
                        </button>
                    </div>
                ) : (
                    /* Active Instrument Reference Grid */
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
                            gap: 10,
                        }}>
                        {currentNotes.map(renderStringButton)}
                    </div>
                )}
            </main>
        </>
    );
}
