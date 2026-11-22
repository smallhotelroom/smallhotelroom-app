/**
 * @file src/App.jsx
 * @version 2.4.0
 */
import React, { useContext, useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { AppContext, AppProvider } from './shared/AppContext';
import executeQuery from './shared/database';
import HomeScreen from './screens/HomeScreen';
import PlaylistScreen from './screens/PlaylistScreen';
import BandScreen from './screens/BandScreen';
import SongScreen from './screens/SongScreen';
import SettingsScreen from './screens/SettingsScreen';
import TunerScreen from './screens/TunerScreen';
import MetronomeScreen from './screens/MetronomeScreen';

export const __version__ = '2.4.0';

function originIdToLabel(originId) {
    if (Number(originId) === 1) return 'ZK';
    if (Number(originId) === 2) return 'LK';
    return 'SHR';
}

function AppShell() {
    const { topSpaceEnabled } = useContext(AppContext);
    const [navStack, setNavStack] = useState([{ screen: 'Home', params: {} }]);

    const navigate = ({ screen, params = {} }) => {
        setNavStack((prev) => [...prev, { screen, params }]);
    };

    const goBack = () => {
        setNavStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
    };

    // Deep-link support: `?song=<content_hash|id>&lang=<lang>`
    useEffect(() => {
        if (typeof window === 'undefined' || !window.location?.search) {
            return;
        }
        const params = new URLSearchParams(window.location.search);
        const songParam = params.get('song');
        const langParam = params.get('lang');
        if (!songParam) {
            return;
        }

        let cancelled = false;
        async function openSharedSong() {
            try {
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
                if (cancelled || res.rows.length === 0) {
                    return;
                }
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
            } catch (err) {
                console.error('Failed to open shared song link:', err);
            }
        }

        openSharedSong();
        return () => {
            cancelled = true;
        };
    }, []);

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
