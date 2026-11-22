/**
 * @file src/screens/PlaylistScreen.jsx
 * @version 2.9.0
 */
import React, { useContext, useEffect, useRef, useState } from 'react';
import {
    ArrowLeft,
    ArrowRight,
    LayoutGrid,
    List,
    MoreVertical,
    Search,
} from 'lucide-react';
import VirtualList from '../components/VirtualList';
import SongItem, { getScaledSongRowHeight } from '../components/SongItem';
import SearchBar from '../components/SearchBar';
import executeQuery from '../shared/database';
import { buildMultiTokenSearchClause } from '../shared/dbMerger';
import {
    AppContext,
    GRID_SCALE_MAX,
    GRID_SCALE_MIN,
    LIST_SCALE_MAX,
    LIST_SCALE_MIN,
} from '../shared/AppContext';
import usePinchZoom from '../shared/usePinchZoom';

export const __version__ = '2.9.0';

const GRID_PAGE_SIZE = 80;
const playlistGridScrollCache = new Map();

export default function PlaylistScreen({ routeParams, onNavigate, onBack }) {
    const { selectedPlaylistId } = routeParams;
    const {
        hideCrawlerTabsEnabled,
        listViewMode = 'list',
        toggleListViewMode,
        listScale = 1,
        setListScale,
        gridScale = 1,
        setGridScale,
    } = useContext(AppContext);

    const [playlistModalVisible, setPlaylistModalVisible] = useState(false);
    const [playlistName, setPlaylistName] = useState('');
    const [playlistSongs, setPlaylistSongs] = useState([]);

    const [playlistSearchVisible, setPlaylistSearchVisible] = useState(false);
    const [playlistOrderStr, setPlaylistOrderStr] = useState('');
    const [playlistSearchStr, setPlaylistSearchStr] = useState('');
    const [searchInLyrics, setSearchInLyrics] = useState(false);

    const isGridView = listViewMode === 'grid';
    const scrollKey = `playlist|${selectedPlaylistId}|${listViewMode}|${playlistOrderStr}|${playlistSearchStr}|${searchInLyrics}|${hideCrawlerTabsEnabled}`;

    const pinchHandlers = usePinchZoom(
        isGridView ? gridScale : listScale,
        isGridView ? setGridScale : setListScale,
        {
            min: isGridView ? GRID_SCALE_MIN : LIST_SCALE_MIN,
            max: isGridView ? GRID_SCALE_MAX : LIST_SCALE_MAX,
        }
    );

    const [visibleGridCount, setVisibleGridCount] = useState(() => {
        const saved = playlistGridScrollCache.get(scrollKey);
        return saved ? Math.max(GRID_PAGE_SIZE, saved.visibleCount) : GRID_PAGE_SIZE;
    });
    const gridScrollRef = useRef(null);

    useEffect(() => {
        const saved = playlistGridScrollCache.get(scrollKey);
        setVisibleGridCount(
            saved ? Math.max(GRID_PAGE_SIZE, saved.visibleCount) : GRID_PAGE_SIZE
        );

        executeQuery('SELECT name FROM playlists WHERE id = ?;', [selectedPlaylistId])
            .then((data) => {
                if (data.rows.length > 0) {
                    setPlaylistName(data.rows.item(0).name); // index 0 means we count on unique id
                }
            })
            .catch((err) => console.error(err));

        const { sqlCondition, params: searchParams } = buildMultiTokenSearchClause(
            playlistSearchStr,
            'songs.search_norm',
            searchInLyrics
        );
        const hasChordsClause = hideCrawlerTabsEnabled ? ' AND songs.has_chords = 1' : '';
        const searchClause = sqlCondition ? ` AND (${sqlCondition})` : '';
        const params = [selectedPlaylistId, ...searchParams];

        const queryStr =
            'SELECT songs.id, songs.name, bands.name AS band_name FROM playlists_songs INNER JOIN songs ON playlists_songs.song_id = songs.id INNER JOIN bands ON songs.band_id = bands.id WHERE playlists_songs.playlist_id = ?';
        executeQuery(queryStr + hasChordsClause + searchClause + playlistOrderStr + ';', params)
            .then((data) => {
                setPlaylistSongs(data.rows._array);
            })
            .catch((err) => console.error(err));
    }, [selectedPlaylistId, playlistOrderStr, playlistSearchStr, searchInLyrics, hideCrawlerTabsEnabled, scrollKey]);

    useEffect(() => {
        if (!isGridView || !gridScrollRef.current || playlistSongs.length === 0) {
            return;
        }
        const saved = playlistGridScrollCache.get(scrollKey);
        const targetTop = saved ? saved.scrollTop : 0;
        const rafId = requestAnimationFrame(() => {
            if (gridScrollRef.current) {
                gridScrollRef.current.scrollTop = targetTop;
            }
        });
        return () => cancelAnimationFrame(rafId);
    }, [isGridView, playlistSongs, scrollKey]);

    const handleGridScroll = (e) => {
        const el = e.currentTarget;
        let nextVisible = visibleGridCount;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 240) {
            if (visibleGridCount < playlistSongs.length) {
                nextVisible = Math.min(playlistSongs.length, visibleGridCount + GRID_PAGE_SIZE);
                setVisibleGridCount(nextVisible);
            }
        }
        if (playlistSongs.length > 0) {
            playlistGridScrollCache.set(scrollKey, {
                scrollTop: el.scrollTop,
                visibleCount: nextVisible,
            });
        }
    };

    const gridMinColPx = Math.round(148 * gridScale);
    const gridGapPx = Math.max(8, Math.round(10 * gridScale));
    const gridContainerStyle = {
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${gridMinColPx}px), 1fr))`,
        gap: gridGapPx,
        padding: Math.max(10, Math.round(12 * gridScale)),
        alignContent: 'start',
    };

    const gridCardStyle = {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        minHeight: Math.max(56, Math.round(76 * gridScale)),
        padding: `${Math.max(10, Math.round(14 * gridScale))}px ${Math.max(10, Math.round(12 * gridScale))}px`,
        borderRadius: 10,
        border: '1px solid var(--border-color)',
        background: 'var(--bg-surface)',
        color: 'var(--text-primary)',
        fontSize: `${1.05 * gridScale}rem`,
        lineHeight: 1.3,
        cursor: 'pointer',
        wordBreak: 'break-word',
        boxSizing: 'border-box',
    };

    const openSong = (item) => {
        onNavigate({
            screen: 'Song',
            params: {
                selectedSongId: item.id,
                originStr: playlistName,
            },
        });
    };

    return (
        <>
            <header className="app-header">
                <div className="header-left">
                    <button className="icon-btn" onClick={onBack}>
                        <ArrowLeft size={22} />
                    </button>
                    <h1 className="header-title">{playlistName}</h1>
                </div>
                <div className="header-actions">
                    <button
                        className="icon-btn"
                        title="Search"
                        onClick={() => setPlaylistSearchVisible(!playlistSearchVisible)}>
                        <Search size={22} />
                    </button>
                    <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Switch to ${isGridView ? 'list' : 'grid'} view`}
                        title={`Switch to ${isGridView ? 'list' : 'grid'} view`}
                        onClick={toggleListViewMode}>
                        {isGridView ? <LayoutGrid size={20} /> : <List size={20} />}
                    </button>
                    <button
                        className="icon-btn"
                        title="Sort Options"
                        onClick={() => setPlaylistModalVisible(true)}>
                        <MoreVertical size={22} />
                    </button>
                </div>
            </header>

            {playlistSearchVisible && (
                <SearchBar
                    placeholder={
                        searchInLyrics
                            ? 'Search playlist or lyrics...'
                            : 'Search in playlist (e.g. cancionesdejuan)...'
                    }
                    value={playlistSearchStr}
                    onChange={setPlaylistSearchStr}
                    onClear={() => setPlaylistSearchStr('')}
                    showLyricsToggle={true}
                    searchInLyrics={searchInLyrics}
                    onToggleLyrics={() => setSearchInLyrics((prev) => !prev)}
                />
            )}

            {isGridView ? (
                <main
                    ref={gridScrollRef}
                    className="content-scroll"
                    style={{ touchAction: 'pan-y' }}
                    onScroll={handleGridScroll}
                    {...pinchHandlers}>
                    <div style={gridContainerStyle}>
                        {playlistSongs.slice(0, visibleGridCount).map((item) => (
                            <div
                                key={item.id}
                                role="button"
                                tabIndex={0}
                                style={gridCardStyle}
                                onClick={() => openSong(item)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        openSong(item);
                                    }
                                }}>
                                <div style={{ fontWeight: 700 }}>{item.name}</div>
                                {item.band_name && (
                                    <div
                                        style={{
                                            fontSize: `${0.88 * gridScale}rem`,
                                            color: 'var(--text-secondary)',
                                            marginTop: 4,
                                        }}>
                                        {item.band_name}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </main>
            ) : (
                <VirtualList
                    items={playlistSongs}
                    itemHeight={getScaledSongRowHeight(listScale)}
                    scrollKey={scrollKey}
                    containerProps={{
                        ...pinchHandlers,
                        style: { touchAction: 'pan-y' },
                    }}
                    renderItem={(item) => (
                        <SongItem
                            id={item.id}
                            name={item.name}
                            band_name={item.band_name}
                            ft_band_name=""
                            onNavigate={onNavigate}
                            originStr={playlistName}
                            scale={listScale}
                        />
                    )}
                />
            )}

            {playlistModalVisible && (
                <div className="modal-backdrop" onClick={() => setPlaylistModalVisible(false)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                        <p style={{ marginTop: 0 }}>Order:</p>
                        <button
                            className="modal-sort-option"
                            onClick={() => {
                                setPlaylistOrderStr('');
                                setPlaylistModalVisible(false);
                            }}>
                            Original
                        </button>
                        <button
                            className="modal-sort-option"
                            onClick={() => {
                                setPlaylistOrderStr(' ORDER BY bands.name');
                                setPlaylistModalVisible(false);
                            }}>
                            Band Ascending: A <ArrowRight size={14} /> Z
                        </button>
                        <button
                            className="modal-sort-option"
                            onClick={() => {
                                setPlaylistOrderStr(' ORDER BY bands.name DESC');
                                setPlaylistModalVisible(false);
                            }}>
                            Band Descending: Z <ArrowRight size={14} /> A
                        </button>
                        <button
                            className="modal-sort-option"
                            onClick={() => {
                                setPlaylistOrderStr(' ORDER BY songs.name');
                                setPlaylistModalVisible(false);
                            }}>
                            Song Ascending: A <ArrowRight size={14} /> Z
                        </button>
                        <button
                            className="modal-sort-option"
                            onClick={() => {
                                setPlaylistOrderStr(' ORDER BY songs.name DESC');
                                setPlaylistModalVisible(false);
                            }}>
                            Song Descending: Z <ArrowRight size={14} /> A
                        </button>
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 22 }}>
                            <button
                                className="btn-primary"
                                onClick={() => setPlaylistModalVisible(false)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
