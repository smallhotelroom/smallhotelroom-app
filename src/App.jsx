/**
 * @file src/App.jsx
 * @version 2.7.1
 */
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { AppContext, AppProvider } from './shared/AppContext';
import executeQuery from './shared/database';
import HomeScreen from './screens/HomeScreen';
import PlaylistScreen from './screens/PlaylistScreen';
import BandScreen from './screens/BandScreen';
import SongScreen from './screens/SongScreen';
import SettingsScreen from './screens/SettingsScreen';
import TunerScreen from './screens/TunerScreen';
import MetronomeScreen from './screens/MetronomeScreen';

export const __version__ = '2.7.1';

const SCREEN_TO_PATH = {
    Home: '/',
    Settings: '/settings',
    Metronome: '/metronome',
    Tuner: '/tuner',
};

const PATH_TO_SCREEN = {
    '/settings': 'Settings',
    '/metronome': 'Metronome',
    '/tuner': 'Tuner',
};

function normalizePath(pathname) {
    if (!pathname) return '/';
    const cleaned = pathname.toLowerCase().replace(/\/+$/, '');
    return cleaned || '/';
}

function extractSongParamFromPath(pathname) {
    if (!pathname) return null;
    const match = pathname.match(/^\/song\/([^/?#]+)\/?$/i);
    return match ? decodeURIComponent(match[1]) : null;
}

function getInitialNavStack() {
    if (typeof window === 'undefined' || Capacitor.isNativePlatform()) {
        return [{ screen: 'Home', params: {} }];
    }
    const screen = PATH_TO_SCREEN[normalizePath(window.location.pathname)];
    if (screen) {
        return [
            { screen: 'Home', params: {} },
            { screen, params: {} },
        ];
    }
    return [{ screen: 'Home', params: {} }];
}

function syncBrowserUrl(screen, { replace = false } = {}) {
    if (typeof window === 'undefined' || Capacitor.isNativePlatform()) {
        return;
    }
    const targetPath = SCREEN_TO_PATH[screen];
    if (!targetPath) {
        return;
    }
    const currentPath = normalizePath(window.location.pathname);
    if (currentPath !== targetPath || window.location.search) {
        const method = replace ? 'replaceState' : 'pushState';
        window.history[method]({ screen }, '', targetPath);
    }
}

function originIdToLabel(originId) {
    if (Number(originId) === 1) return 'ZK';
    if (Number(originId) === 2) return 'LK';
    return 'SHR';
}

function AppShell() {
    const { topSpaceEnabled } = useContext(AppContext);
    const [navStack, setNavStack] = useState(getInitialNavStack);

    const navigate = ({ screen, params = {} }) => {
        setNavStack((prev) => [...prev, { screen, params }]);
        syncBrowserUrl(screen);
    };

    const goBack = () => {
        setNavStack((prev) => {
            if (prev.length <= 1) return prev;
            const next = prev.slice(0, -1);
            const topScreen = next[next.length - 1].screen;
            syncBrowserUrl(topScreen);
            return next;
        });
    };

    const openIncomingUrl = useCallback(async (rawUrl) => {
        if (!rawUrl) return;
        try {
            const parsed = new URL(rawUrl);
            const songParam = extractSongParamFromPath(parsed.pathname);
            const langParam = parsed.searchParams.get('lang');

            if (songParam) {
                let res = await executeQuery(
                    'SELECT id, origin_id FROM songs WHERE content_hash = ? LIMIT 1;',
                    [songParam]
                );
                if (res.rows.length === 0 && /^\d+$/.test(songParam)) {
                    res = await executeQuery(
                        'SELECT id, origin_id FROM songs WHERE id = ? LIMIT 1;',
                        [parseInt(songParam, 10)]
                    );
                }
                if (res.rows.length > 0) {
                    const row = res.rows.item(0);
                    setNavStack([
                        { screen: 'Home', params: {} },
                        {
                            screen: 'Song',
                            params: {
                                selectedSongId: row.id,
                                originStr: originIdToLabel(row.origin_id),
                                initialLang: langParam || null,
                            },
                        },
                    ]);
                }
                return;
            }

            const screen = PATH_TO_SCREEN[normalizePath(parsed.pathname)];
            if (screen) {
                setNavStack([
                    { screen: 'Home', params: {} },
                    { screen, params: {} },
                ]);
            }
        } catch (err) {
            console.error('Failed to handle incoming app URL:', err);
        }
    }, []);

    // Browser Back / Forward support for showcase and song routes
    useEffect(() => {
        if (typeof window === 'undefined' || Capacitor.isNativePlatform()) {
            return;
        }
        const handlePopState = () => {
            if (extractSongParamFromPath(window.location.pathname)) {
                openIncomingUrl(window.location.href);
                return;
            }
            const screen = PATH_TO_SCREEN[normalizePath(window.location.pathname)];
            if (screen) {
                setNavStack([
                    { screen: 'Home', params: {} },
                    { screen, params: {} },
                ]);
            } else {
                setNavStack([{ screen: 'Home', params: {} }]);
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [openIncomingUrl]);

    // Web deep-link support: `/song/<content_hash|id>` (with optional `?lang=<lang>`)
    useEffect(() => {
        if (typeof window === 'undefined' || Capacitor.isNativePlatform()) {
            return;
        }
        if (extractSongParamFromPath(window.location.pathname)) {
            openIncomingUrl(window.location.href);
        }
    }, [openIncomingUrl]);

    // Native Android App Links support (cold start + warm start)
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) {
            return;
        }
        let urlListenerHandle = null;

        CapApp.getLaunchUrl()
            .then((launch) => {
                if (launch?.url) {
                    openIncomingUrl(launch.url);
                }
            })
            .catch(() => {});

        CapApp.addListener('appUrlOpen', (event) => {
            if (event?.url) {
                openIncomingUrl(event.url);
            }
        }).then((handle) => {
            urlListenerHandle = handle;
        });

        return () => {
            if (urlListenerHandle) {
                urlListenerHandle.remove();
            }
        };
    }, [openIncomingUrl]);

    useEffect(() => {
        let listenerHandle = null;
        CapApp.addListener('backButton', () => {
            setNavStack((prev) => {
                if (prev.length > 1) {
                    return prev.slice(0, -1);
                }
                CapApp.exitApp();
                return prev;
            });
        }).then((handle) => {
            listenerHandle = handle;
        });

        return () => {
            if (listenerHandle) {
                listenerHandle.remove();
            }
        };
    }, []);

    const currentRoute = navStack[navStack.length - 1];
    const isSongScreen = currentRoute.screen === 'Song';

    return (
        <div className="app-shell">
            {currentRoute.screen === 'Home' && <HomeScreen onNavigate={navigate} />}
            {currentRoute.screen === 'Playlist' && (
                <PlaylistScreen
                    routeParams={currentRoute.params}
                    onNavigate={navigate}
                    onBack={goBack}
                />
            )}
            {currentRoute.screen === 'Band' && (
                <BandScreen
                    routeParams={currentRoute.params}
                    onNavigate={navigate}
                    onBack={goBack}
                />
            )}
            {isSongScreen && (
                <SongScreen
                    routeParams={currentRoute.params}
                    onNavigate={navigate}
                    onBack={goBack}
                />
            )}
            {currentRoute.screen === 'Settings' && <SettingsScreen onBack={goBack} />}
            {currentRoute.screen === 'Tuner' && <TunerScreen onBack={goBack} />}
            {currentRoute.screen === 'Metronome' && <MetronomeScreen onBack={goBack} />}

            {/* Opaque Bottom System Bar spacer for all screens except SongScreen (which uses its own bottom gradient) */}
            {topSpaceEnabled && !isSongScreen && (
                <div
                    className="portrait-only-bottom-bar"
                    style={{
                        height: '48px',
                        flexShrink: 0,
                        backgroundColor: 'var(--bg-surface)',
                        borderTop: '1px solid var(--border-color)',
                        zIndex: 100,
                    }}
                />
            )}
        </div>
    );
}

export default function App() {
    return (
        <AppProvider>
            <AppShell />
        </AppProvider>
    );
}
