/**
 * @file src/shared/audioEngine.js
 * @version 2.11.2
 * Web Audio API synthesis engine for Small Hotel Room:
 * - Tuner reference definitions (`GUITAR_STRINGS`, `UKULELE_STRINGS`, `BASS_STRINGS`,
 *   `VIOLIN_STRINGS`, `SAX_WINDS_NOTES`, `getGuitarStrings`, `getBassStrings`,
 *   `buildChromaticNotes`) & `playNoteFrequency` with click-free fade-out `stop()` callback
 * - Polyphonic guitar/ukulele chord strumming (quantized to Track A count 1 when metronome is active)
 * - Multi-track Polyrhythm Metronome scheduler:
 *   - Track A defines the master beat cycle ("A follows BPM": each step on A = 1 beat at master BPM)
 *   - Beat 1 of Track A is 3-state: 0 = Off, 1 = Normal, 2 = Accent (paired voice that shifts with track voice)
 *   - All other steps are 2-state: 0 = Off, 1 = Normal (track voice)
 *   - Supports up to 12 tracks (A..L) and up to 32 steps per track
 */
import { APP_DEFAULTS } from './AppContext';

export const __version__ = '2.11.2';

let audioCtx = null;

export function getAudioContext() {
    if (!audioCtx && typeof window !== 'undefined') {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }
    return audioCtx;
}

// --- TUNER INSTRUMENT CONSTANTS (with unique `id` fields for active button state) ---
export const GUITAR_STRINGS = [
    { id: 'g-6E', string: 6, note: 'E2', label: '6E', freq: 82.41, midi: 40 },
    { id: 'g-5A', string: 5, note: 'A2', label: '5A', freq: 110.0, midi: 45 },
    { id: 'g-4D', string: 4, note: 'D3', label: '4D', freq: 146.83, midi: 50 },
    { id: 'g-3G', string: 3, note: 'G3', label: '3G', freq: 196.0, midi: 55 },
    { id: 'g-2B', string: 2, note: 'B3', label: '2B', freq: 246.94, midi: 59 },
    { id: 'g-1e', string: 1, note: 'E4', label: '1e', freq: 329.63, midi: 64 },
];

export const GUITAR_EXTRA_STRINGS = {
    7: { id: 'g-7B', string: 7, note: 'B1', label: '7B', freq: 61.74, midi: 35 },
    8: { id: 'g-8F#', string: 8, note: 'F#1', label: '8F#', freq: 46.25, midi: 30 },
};

export function getGuitarStrings(stringCount = 6) {
    const count = Number(stringCount);
    if (count === 8) {
        return [GUITAR_EXTRA_STRINGS[8], GUITAR_EXTRA_STRINGS[7], ...GUITAR_STRINGS];
    }
    if (count === 7) {
        return [GUITAR_EXTRA_STRINGS[7], ...GUITAR_STRINGS];
    }
    return GUITAR_STRINGS;
}

export const UKULELE_STRINGS = [
    { id: 'u-4G', string: 4, note: 'G4', label: '4G', freq: 392.0, midi: 67 },
    { id: 'u-3C', string: 3, note: 'C4', label: '3C', freq: 261.63, midi: 60 },
    { id: 'u-2E', string: 2, note: 'E4', label: '2E', freq: 329.63, midi: 64 },
    { id: 'u-1A', string: 1, note: 'A4', label: '1A', freq: 440.0, midi: 69 },
];

export const BASS_STRINGS = [
    { id: 'b-4E', string: 4, note: 'E1', label: '4E', freq: 41.2, midi: 28 },
    { id: 'b-3A', string: 3, note: 'A1', label: '3A', freq: 55.0, midi: 33 },
    { id: 'b-2D', string: 2, note: 'D2', label: '2D', freq: 73.42, midi: 38 },
    { id: 'b-1G', string: 1, note: 'G2', label: '1G', freq: 98.0, midi: 43 },
];

export function getBassStrings(stringCount = 4) {
    const count = Number(stringCount);
    if (count === 6) {
        return [
            { id: 'b6-6B', string: 6, note: 'B0', label: '6B', freq: 30.87, midi: 23 },
            { id: 'b6-5E', string: 5, note: 'E1', label: '5E', freq: 41.2, midi: 28 },
            { id: 'b6-4A', string: 4, note: 'A1', label: '4A', freq: 55.0, midi: 33 },
            { id: 'b6-3D', string: 3, note: 'D2', label: '3D', freq: 73.42, midi: 38 },
            { id: 'b6-2G', string: 2, note: 'G2', label: '2G', freq: 98.0, midi: 43 },
            { id: 'b6-1C', string: 1, note: 'C3', label: '1C', freq: 130.81, midi: 48 },
        ];
    }
    if (count === 5) {
        return [
            { id: 'b5-5B', string: 5, note: 'B0', label: '5B', freq: 30.87, midi: 23 },
            ...BASS_STRINGS,
        ];
    }
    return BASS_STRINGS;
}

export const VIOLIN_STRINGS = [
    { id: 'v-4G', string: 4, note: 'G3', label: '4G', freq: 196.0, midi: 55 },
    { id: 'v-3D', string: 3, note: 'D4', label: '3D', freq: 293.66, midi: 62 },
    { id: 'v-2A', string: 2, note: 'A4', label: '2A', freq: 440.0, midi: 69 },
    { id: 'v-1E', string: 1, note: 'E5', label: '1E', freq: 659.25, midi: 76 },
];

export const SAX_WINDS_NOTES = [
    {
        id: 'w-Bb4',
        note: 'Bb4',
        label: 'Concert Bb',
        sublabel: 'Alto G · Tenor C',
        freq: 466.16,
        midi: 70,
    },
    {
        id: 'w-A4',
        note: 'A4',
        label: 'Concert A',
        sublabel: 'Alto F# · Tenor B',
        freq: 440.0,
        midi: 69,
    },
    {
        id: 'w-C4',
        note: 'C4',
        label: 'Concert C',
        sublabel: 'Alto A · Tenor D',
        freq: 261.63,
        midi: 60,
    },
    {
        id: 'w-F4',
        note: 'F4',
        label: 'Concert F',
        sublabel: 'Alto D · Tenor G',
        freq: 349.23,
        midi: 65,
    },
];

const CHROMATIC_NOTE_NAMES = [
    'C',
    'C#',
    'D',
    'D#',
    'E',
    'F',
    'F#',
    'G',
    'G#',
    'A',
    'A#',
    'B',
];

export function buildChromaticNotes(startOctave = 4, octaveCount = 1) {
    const baseOct = Math.max(1, Math.min(6, Math.round(Number(startOctave) || 4)));
    const count = Math.max(1, Math.min(2, Math.round(Number(octaveCount) || 1)));
    const notes = [];

    for (let o = 0; o < count; o++) {
        const oct = baseOct + o;
        if (oct > 7) break;
        for (let semi = 0; semi < 12; semi++) {
            const midi = (oct + 1) * 12 + semi;
            const freq = 440 * Math.pow(2, (midi - 69) / 12);
            const name = CHROMATIC_NOTE_NAMES[semi];
            notes.push({
                id: `chr-${name}${oct}`,
                note: `${name}${oct}`,
                label: `${name}${oct}`,
                ...(midi === 60 ? { sublabel: '(middle C)' } : {}),
                freq,
                midi,
            });
        }
    }
    return notes;
}

export const MAX_METRONOME_TRACKS = 12;
export const MAX_METRONOME_STEPS = 32;
const VOICE_ORDER = ['mid', 'low', 'sub', 'high'];

/**
 * Returns the paired accent voice for a given track voice so the accented beat
 * shifts alongside the track voice and never overlaps with normal beats:
 * mid -> high, low -> mid, sub -> low, high -> sub.
 */
export function getAccentVoiceForTrack(trackVoice = 'mid') {
    const idx = VOICE_ORDER.indexOf(trackVoice);
    const safeIdx = idx >= 0 ? idx : 0;
    return VOICE_ORDER[(safeIdx - 1 + VOICE_ORDER.length) % VOICE_ORDER.length];
}

/**
 * Builds the roll pattern for the Beat Subdivision buttons:
 * - Track A (4 steps, 'mid'): [2, 1, 1, 1] (Beat 1 Accent + Beats 2-4 Quarter Pulse)
 * - Track B (4*sub steps, 'low', when sub > 1): complementary off-beat subdivisions
 */
export function buildQuick44Tracks(subdivision = 1) {
    const sub = Number(subdivision) || 1;
    const baseTracks = [
        {
            id: 'A',
            label: 'A',
            voice: 'mid',
            steps: [2, 1, 1, 1],
        },
    ];

    if (sub <= 1) {
        return baseTracks;
    }

    const totalSubSteps = 4 * sub; // 8 for 1/8, 12 for 1/3, 16 for 1/16
    const bSteps = [];
    for (let i = 0; i < totalSubSteps; i++) {
        bSteps.push(i % sub !== 0 ? 1 : 0);
    }

    return [
        ...baseTracks,
        {
            id: 'B',
            label: 'B',
            voice: 'low',
            steps: bSteps,
        },
    ];
}

// --- METRONOME STATE & SUBSCRIPTION STORE ---
const BPM_STORAGE_KEY = 'shr_metronome_bpm';
const SUBDIV_STORAGE_KEY = 'shr_metronome_subdiv';
const SOUND_STORAGE_KEY = 'shr_metronome_sound';
const PERSIST_STORAGE_KEY = 'shr_metronome_persistent';

function loadInitialSubdivision() {
    if (typeof localStorage !== 'undefined') {
        const saved = parseInt(localStorage.getItem(SUBDIV_STORAGE_KEY), 10);
        if ([1, 2, 3, 4].includes(saved)) return saved;
    }
    return APP_DEFAULTS?.default_metronome_subdivision || 1;
}

const initialSubdiv = loadInitialSubdivision();

const metronomeState = {
    isPlaying: false,
    bpm: (() => {
        if (typeof localStorage !== 'undefined') {
            const saved = parseInt(localStorage.getItem(BPM_STORAGE_KEY), 10);
            if (!Number.isNaN(saved) && saved >= 30 && saved <= 260) return saved;
        }
        return APP_DEFAULTS?.default_metronome_bpm || 120;
    })(),
    subdivision: initialSubdiv, // 1 = 1/4, 2 = 1/8, 3 = 1/3, 4 = 1/16, 0 = Custom roll
    soundMode: (() => {
        if (typeof localStorage !== 'undefined') {
            const saved = localStorage.getItem(SOUND_STORAGE_KEY);
            if (saved === 'natural' || saved === 'synth') return saved;
        }
        return APP_DEFAULTS?.default_metronome_sound || 'natural';
    })(),
    persistent: (() => {
        if (typeof localStorage !== 'undefined') {
            const saved = localStorage.getItem(PERSIST_STORAGE_KEY);
            if (saved !== null) return saved === 'true';
        }
        return APP_DEFAULTS?.default_metronome_persistent ?? true;
    })(),
    tracks: buildQuick44Tracks(initialSubdiv),
    currentStepByTrack: buildQuick44Tracks(initialSubdiv).map(() => -1),
    currentBeat: -1,
    currentSubBeat: 0,
};

const listeners = new Set();
const beatListeners = new Set();

function notifyListeners() {
    const snapshot = {
        ...metronomeState,
        tracks: metronomeState.tracks.map((t) => ({
            ...t,
            steps: [...t.steps],
        })),
        currentStepByTrack: [...metronomeState.currentStepByTrack],
    };
    listeners.forEach((fn) => fn(snapshot));
}

function notifyBeatListeners() {
    const beatPayload = {
        beat: metronomeState.currentBeat,
        subBeat: metronomeState.currentSubBeat,
        isPlaying: metronomeState.isPlaying,
        currentStepByTrack: [...metronomeState.currentStepByTrack],
    };
    beatListeners.forEach((fn) => fn(beatPayload));
}

export function getMetronomeState() {
    return {
        ...metronomeState,
        tracks: metronomeState.tracks.map((t) => ({
            ...t,
            steps: [...t.steps],
        })),
        currentStepByTrack: [...metronomeState.currentStepByTrack],
    };
}

export function subscribeMetronomeState(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function subscribeMetronomeBeat(listener) {
    beatListeners.add(listener);
    return () => beatListeners.delete(listener);
}

/**
 * Schedules a single metronome click sound at `time` (in AudioContext seconds).
 */
function scheduleMetronomeClickAt(ctx, time, voice = 'high', soundMode = 'natural') {
    if (soundMode === 'synth') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const freq =
            voice === 'high'
                ? 1174.66
                : voice === 'mid'
                  ? 880.0
                  : voice === 'low'
                    ? 659.25
                    : 523.25; // D6 / A5 / E5 / C5
        const peakGain =
            voice === 'high'
                ? 0.36
                : voice === 'mid'
                  ? 0.27
                  : voice === 'low'
                    ? 0.19
                    : 0.22;
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.linearRampToValueAtTime(peakGain, time + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.055);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + 0.06);
        return;
    }

    // 'natural' woodblock / rimshot click
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const startFreq =
        voice === 'high'
            ? 1480
            : voice === 'mid'
              ? 1080
              : voice === 'low'
                ? 780
                : 580;
    const endFreq =
        voice === 'high'
            ? 580
            : voice === 'mid'
              ? 430
              : voice === 'low'
                ? 320
                : 230;
    const peakGain =
        voice === 'high'
            ? 0.45
            : voice === 'mid'
              ? 0.32
              : voice === 'low'
                ? 0.21
                : 0.26;
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(endFreq, time + 0.028);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(peakGain, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.042);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.048);
}

// --- LOOKAHEAD SCHEDULER (Track A follows BPM; all other tracks subdivide the cycle) ---
let schedulerTimerId = null;
let schedulerGeneration = 0;
let masterCycleAnchorTime = 0;
let nextTrackStepTimes = [];
let nextTrackStepIndices = [];
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.1;

function resetSchedulerCursors(ctx) {
    schedulerGeneration += 1;
    const now = ctx ? ctx.currentTime + 0.03 : 0;
    masterCycleAnchorTime = now;
    nextTrackStepTimes = metronomeState.tracks.map(() => now);
    nextTrackStepIndices = metronomeState.tracks.map(() => 0);
}

/**
 * Returns the delay in seconds until the next Track A beat.
 * Returns 0 if the metronome is not playing or if called within 15ms of a beat.
 */
export function getNextMetronomeBeatDelaySec(ctx = getAudioContext()) {
    if (!metronomeState.isPlaying || !ctx) return 0;

    const now = ctx.currentTime;
    if (now <= masterCycleAnchorTime) {
        return Math.max(0, masterCycleAnchorTime - now);
    }

    const beatDurationSec = 60 / Math.max(30, metronomeState.bpm);
    const elapsed = now - masterCycleAnchorTime;
    const remainder = elapsed % beatDurationSec;

    // 15ms grace window right after a beat so on-time taps trigger immediately
    if (remainder < 0.015) {
        return 0;
    }

    return beatDurationSec - remainder;
}

/**
 * Returns the delay in seconds until the next count 1 of line 1 (Track A, step 0).
 * Returns 0 if the metronome is not playing or if called within 15ms after count 1.
 */
export function getNextMetronomeBarDelaySec(ctx = getAudioContext()) {
    if (!metronomeState.isPlaying || !ctx) return 0;

    const now = ctx.currentTime;
    if (now <= masterCycleAnchorTime) {
        return Math.max(0, masterCycleAnchorTime - now);
    }

    const masterBeatsInBar = Math.max(
        1,
        metronomeState.tracks[0]?.steps?.length || 4
    );
    const barDurationSec =
        (60 / Math.max(30, metronomeState.bpm)) * masterBeatsInBar;
    const elapsed = now - masterCycleAnchorTime;
    const remainder = elapsed % barDurationSec;

    // 15ms grace window right after count 1 so on-time taps trigger immediately
    if (remainder < 0.015) {
        return 0;
    }

    return barDurationSec - remainder;
}

function runSchedulerTick() {
    if (!metronomeState.isPlaying) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const currentGen = schedulerGeneration;

    // Track A follows BPM: each step on Track A is 1 beat at master BPM!
    const masterBeatsInBar = Math.max(
        1,
        metronomeState.tracks[0]?.steps?.length || 4
    );
    const barDurationSec =
        (60 / Math.max(30, metronomeState.bpm)) * masterBeatsInBar;

    for (let tIdx = 0; tIdx < metronomeState.tracks.length; tIdx++) {
        const track = metronomeState.tracks[tIdx];
        const numSteps = Math.max(1, track.steps.length);
        const stepDurationSec = barDurationSec / numSteps;

        while (nextTrackStepTimes[tIdx] < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
            const stepIndex = nextTrackStepIndices[tIdx] % numSteps;
            const stepTime = nextTrackStepTimes[tIdx];
            const stepLevel = Number(track.steps[stepIndex]) || 0;

            if (stepLevel > 0) {
                const baseVoice =
                    track.voice || VOICE_ORDER[tIdx % VOICE_ORDER.length];
                const voiceToPlay =
                    stepLevel === 2
                        ? getAccentVoiceForTrack(baseVoice)
                        : baseVoice;
                scheduleMetronomeClickAt(
                    ctx,
                    stepTime,
                    voiceToPlay,
                    metronomeState.soundMode
                );
            }

            const delayMs = Math.max(0, (stepTime - ctx.currentTime) * 1000);
            const capturedTrackIdx = tIdx;
            const capturedStepIdx = stepIndex;

            setTimeout(() => {
                if (!metronomeState.isPlaying || currentGen !== schedulerGeneration) return;
                if (
                    metronomeState.currentStepByTrack[capturedTrackIdx] !==
                    capturedStepIdx
                ) {
                    metronomeState.currentStepByTrack[capturedTrackIdx] =
                        capturedStepIdx;
                    if (capturedTrackIdx === 0) {
                        metronomeState.currentBeat = capturedStepIdx;
                        metronomeState.currentSubBeat = 0;
                    }
                    notifyListeners();
                    notifyBeatListeners();
                }
            }, delayMs);

            nextTrackStepTimes[tIdx] += stepDurationSec;
            nextTrackStepIndices[tIdx] = (stepIndex + 1) % numSteps;
        }
    }
}

export function setMetronomePlaying(shouldPlay) {
    const nextPlay = Boolean(shouldPlay);
    if (nextPlay === metronomeState.isPlaying) return;

    if (nextPlay) {
        const ctx = getAudioContext();
        if (!ctx) return;
        metronomeState.isPlaying = true;
        metronomeState.currentStepByTrack = metronomeState.tracks.map(() => 0);
        metronomeState.currentBeat = 0;
        metronomeState.currentSubBeat = 0;
        resetSchedulerCursors(ctx);
        runSchedulerTick();
        schedulerTimerId = setInterval(runSchedulerTick, LOOKAHEAD_MS);
    } else {
        schedulerGeneration += 1;
        metronomeState.isPlaying = false;
        metronomeState.currentStepByTrack = metronomeState.tracks.map(() => -1);
        metronomeState.currentBeat = -1;
        metronomeState.currentSubBeat = 0;
        if (schedulerTimerId) {
            clearInterval(schedulerTimerId);
            schedulerTimerId = null;
        }
    }
    notifyListeners();
    notifyBeatListeners();
}

export function toggleMetronomePlaying() {
    setMetronomePlaying(!metronomeState.isPlaying);
    return metronomeState.isPlaying;
}

export function startMetronome() {
    setMetronomePlaying(true);
}

export function stopMetronome() {
    setMetronomePlaying(false);
}

export function setMetronomeBpm(nextBpm) {
    const clamped = Math.max(30, Math.min(260, Math.round(Number(nextBpm) || 120)));
    const changed = clamped !== metronomeState.bpm;
    metronomeState.bpm = clamped;
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(BPM_STORAGE_KEY, String(clamped));
    }
    if (changed && metronomeState.isPlaying) {
        const ctx = getAudioContext();
        if (ctx) {
            metronomeState.currentStepByTrack = metronomeState.tracks.map(() => 0);
            metronomeState.currentBeat = 0;
            metronomeState.currentSubBeat = 0;
            resetSchedulerCursors(ctx);
            runSchedulerTick();
        }
        notifyListeners();
        notifyBeatListeners();
        return;
    }
    notifyListeners();
}

export function setMetronomeSubdivision(nextSubdiv) {
    const valid = [1, 2, 3, 4].includes(Number(nextSubdiv)) ? Number(nextSubdiv) : 1;
    metronomeState.subdivision = valid;
    metronomeState.tracks = buildQuick44Tracks(valid);
    metronomeState.currentStepByTrack = metronomeState.tracks.map(() =>
        metronomeState.isPlaying ? 0 : -1
    );
    if (metronomeState.isPlaying && audioCtx) {
        resetSchedulerCursors(audioCtx);
    }
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SUBDIV_STORAGE_KEY, String(valid));
    }
    notifyListeners();
    notifyBeatListeners();
}

export function toggleMetronomeTrackStep(trackIdx, stepIdx) {
    const track = metronomeState.tracks[trackIdx];
    if (!track || stepIdx < 0 || stepIdx >= track.steps.length) return;
    const current = Number(track.steps[stepIdx]) || 0;
    if (trackIdx === 0 && stepIdx === 0) {
        // Beat 1 of Track A: 0 (Off) -> 1 (Normal) -> 2 (Accent) -> 0
        track.steps[stepIdx] = (current + 1) % 3;
    } else {
        // All other steps: 0 (Off) <-> 1 (Normal)
        track.steps[stepIdx] = current > 0 ? 0 : 1;
    }
    metronomeState.subdivision = 0;
    notifyListeners();
}

export function setMetronomeTrackStepCount(trackIdx, nextCount) {
    const track = metronomeState.tracks[trackIdx];
    if (!track) return;
    const clamped = Math.max(
        1,
        Math.min(MAX_METRONOME_STEPS, Math.round(Number(nextCount) || 4))
    );
    if (clamped === track.steps.length) return;

    if (clamped < track.steps.length) {
        track.steps = track.steps.slice(0, clamped);
    } else {
        while (track.steps.length < clamped) {
            track.steps.push(1);
        }
    }
    metronomeState.subdivision = 0;
    if (metronomeState.isPlaying && audioCtx) {
        resetSchedulerCursors(audioCtx);
    }
    notifyListeners();
    notifyBeatListeners();
}

export function cycleMetronomeTrackVoice(trackIdx) {
    const track = metronomeState.tracks[trackIdx];
    if (!track) return;
    const currIdx = VOICE_ORDER.indexOf(track.voice || 'mid');
    track.voice = VOICE_ORDER[(currIdx + 1) % VOICE_ORDER.length];
    notifyListeners();
}

export function addMetronomeTrack() {
    if (metronomeState.tracks.length >= MAX_METRONOME_TRACKS) return;
    const nextIdx = metronomeState.tracks.length;
    const label = String.fromCharCode(65 + nextIdx);
    const defaultVoice = VOICE_ORDER[nextIdx % VOICE_ORDER.length];
    const defaultStepsCount = nextIdx === 1 ? 3 : 5;

    metronomeState.tracks.push({
        id: label,
        label,
        voice: defaultVoice,
        steps: new Array(defaultStepsCount).fill(1),
    });
    metronomeState.currentStepByTrack.push(metronomeState.isPlaying ? 0 : -1);
    metronomeState.subdivision = 0;
    if (metronomeState.isPlaying && audioCtx) {
        resetSchedulerCursors(audioCtx);
    }
    notifyListeners();
    notifyBeatListeners();
}

export function removeLastMetronomeTrack() {
    if (metronomeState.tracks.length <= 1) return;
    metronomeState.tracks.pop();
    metronomeState.currentStepByTrack.pop();
    metronomeState.subdivision = 0;
    if (metronomeState.isPlaying && audioCtx) {
        resetSchedulerCursors(audioCtx);
    }
    notifyListeners();
    notifyBeatListeners();
}

export function setMetronomeSoundMode(nextMode) {
    const valid = nextMode === 'synth' ? 'synth' : 'natural';
    metronomeState.soundMode = valid;
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SOUND_STORAGE_KEY, valid);
    }
    notifyListeners();
}

export function setMetronomePersistent(nextPersist) {
    const boolVal = Boolean(nextPersist);
    metronomeState.persistent = boolVal;
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(PERSIST_STORAGE_KEY, String(boolVal));
    }
    notifyListeners();
}

// --- POLYPHONIC CHORD STRUM & REFERENCE PITCH GENERATOR ---
export function playReferenceNote(
    freqHz,
    { mode = 'natural', duration = 1.6, startTimeOffset = 0, gainScale = 0.28 } = {}
) {
    const ctx = getAudioContext();
    if (!ctx || !freqHz) return () => {};

    const now = ctx.currentTime + Math.max(0, startTimeOffset);
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    if (mode === 'synth') {
        osc1.type = 'sawtooth';
        osc2.type = 'triangle';
        osc2.detune.setValueAtTime(4, now);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freqHz * 4, now);
    } else {
        osc1.type = 'triangle';
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freqHz * 2, now);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freqHz * 6, now);
        filter.frequency.exponentialRampToValueAtTime(freqHz * 1.5, now + duration * 0.75);
    }

    osc1.frequency.setValueAtTime(freqHz, now);
    if (mode === 'synth') {
        osc2.frequency.setValueAtTime(freqHz, now);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainScale, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration + 0.02);
    osc2.stop(now + duration + 0.02);

    let stopped = false;
    return () => {
        if (stopped) return;
        stopped = true;
        try {
            const t = ctx.currentTime;
            gain.gain.cancelScheduledValues(t);
            gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), t);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
            osc1.stop(t + 0.03);
            osc2.stop(t + 0.03);
        } catch {
            // Oscillators may already have stopped
        }
    };
}

export function playNoteFrequency(freqHz, options = {}) {
    if (typeof options === 'number') {
        return playReferenceNote(freqHz, {
            mode: metronomeState.soundMode,
            duration: options,
        });
    }
    return playReferenceNote(freqHz, {
        mode: options.mode || metronomeState.soundMode,
        duration: options.duration || 1.8,
        ...options,
    });
}

export function playPolyphonicChord(
    frequencies = [],
    {
        mode = 'natural',
        duration = 2.1,
        strumSpreadSec = 0.038,
        quantizeToMetronome = true,
    } = {}
) {
    if (!Array.isArray(frequencies) || frequencies.length === 0) return;
    const ctx = getAudioContext();
    const quantizeDelay = quantizeToMetronome
        ? getNextMetronomeBarDelaySec(ctx)
        : 0;
    const perNoteGain = Math.min(0.24, 0.75 / Math.sqrt(frequencies.length));
    frequencies.forEach((freq, idx) => {
        playReferenceNote(freq, {
            mode,
            duration,
            startTimeOffset: quantizeDelay + idx * strumSpreadSec,
            gainScale: perNoteGain,
        });
    });
}
