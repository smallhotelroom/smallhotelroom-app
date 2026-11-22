/**
 * @file src/screens/BandScreen.jsx
 * @version 2.8.0
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
import SongItem from '../components/SongItem';
import SearchBar from '../components/SearchBar';
import executeQuery from '../shared/database';
import { buildMultiTokenSearchClause } from '../shared/dbMerger';
import { AppContext } from '../shared/AppContext';

export const __version__ = '2.8.0';

const bandScrollCache = new Map();

export default function BandScreen({ routeParams, onNavigate, onBack }) {
    const { selectedBandId } = routeParams;
    const {
        hideCrawlerTabsEnabled,
        listViewMode = 'list',
        toggleListViewMode,
    } = useContext(AppContext);

    const [bandModalVisible, setBandModalVisible] = useState(false);
    const [bandName, setBandName] = useState('');
    const [bandSongs, setBandSongs] = useState([]);
    const [bandFeaturing, setBandFeaturing] = useState([]);

    const [bandSearchVisible, setBandSearchVisible] = useState(false);
    const [bandOrderStr, setBandOrderStr] = useState('');
    const [bandSearchStr, setBandSearchStr] = useState('');
    const [searchInLyrics, setSearchInLyrics] = useState(false);

    const isGridView = listViewMode === 'grid';
    const scrollRef = useRef(null);
    const scrollKey = `band|${selectedBandId}|${listViewMode}|${bandOrderStr}|${bandSearchStr}|${searchInLyrics}|${hideCrawlerTabsEnabled}`;

    useEffect(() => {
        executeQuery('SELECT name FROM bands WHERE id = ?;', [selectedBandId])
            .then((data) => {
                if (data.rows.length > 0) {
                    setBandName(data.rows.item(0).name); // index 0 means we count on unique id
                }
            })
            .catch((err) => console.error(err));

        const { sqlCondition, params: searchParams } = buildMultiTokenSearchClause(
            bandSearchStr,
            'songs.search_norm',
            searchInLyrics
        );
        const hasChordsClause = hideCrawlerTabsEnabled ? ' AND songs.has_chords = 1' : '';
        const searchClause = sqlCondition ? ` AND (${sqlCondition})` : '';
        const queryParams = [selectedBandId, ...searchParams];

        const queryStr = 'SELECT id, name FROM songs WHERE band_id = ?';
        executeQuery(queryStr + hasChordsClause + searchClause + bandOrderStr + ';', queryParams)
            .then((data) => {
                setBandSongs(data.rows._array);
            })
            .catch((err) => console.error(err));

        const queryFtStr =
            'SELECT songs.id, songs.name, bands.name AS ft_band_name FROM songs_ft_bands INNER JOIN songs ON songs_ft_bands.song_id = songs.id INNER JOIN bands ON songs.band_id = bands.id WHERE songs_ft_bands.ft_band_id = ?';
        executeQuery(queryFtStr + hasChordsClause + searchClause + bandOrderStr + ';', queryParams)
            .then((data) => {
                setBandFeaturing(data.rows._array);
            })
            .catch((err) => console.error(err));
    }, [selectedBandId, bandOrderStr, bandSearchStr, searchInLyrics, hideCrawlerTabsEnabled]);

    useEffect(() => {
        if (!scrollRef.current || (bandSongs.length === 0 && bandFeaturing.length === 0)) {
            return;
        }
        const targetTop = bandScrollCache.get(scrollKey) || 0;
        const rafId = requestAnimationFrame(() => {
            if (scrollRef.current) {
                scrollRef.current.scrollTop = targetTop;
            }
        });
        return () => cancelAnimationFrame(rafId);
    }, [bandSongs, bandFeaturing, scrollKey]);

    const handleScroll = (e) => {
        if (bandSongs.length > 0 || bandFeaturing.length > 0) {
            bandScrollCache.set(scrollKey, e.currentTarget.scrollTop);
        }
    };

    const gridContainerStyle = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))',
        gap: 10,
        padding: 12,
        alignContent: 'start',
    };

    const gridCardStyle = {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        minHeight: 76,
        padding: '14px 12px',
        borderRadius: 10,
        border: '1px solid var(--border-color)',
        background: 'var(--bg-surface)',
        color: 'var(--text-primary)',
        fontSize: '1.05rem',
        lineHeight: 1.3,
        cursor: 'pointer',
        wordBreak: 'break-word',
        boxSizing: 'border-box',
    };

    const openSong = (songId) => {
        onNavigate({
            screen: 'Song',
            params: {
                selectedSongId: songId,
                originStr: bandName,
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
                    <h1 className="header-title">{bandName}</h1>
                </div>
                <div className="header-actions">
                    <button
                        className="icon-btn"
                        title="Search"
                        onClick={() => setBandSearchVisible(!bandSearchVisible)}>
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
                        onClick={() => setBandModalVisible(true)}>
                        <MoreVertical size={22} />
                    </button>
                </div>
            </header>

            {bandSearchVisible && (
                <SearchBar
                    placeholder={
                        searchInLyrics ? 'Search in band or lyrics...' : 'Search in band...'
                    }
                    value={bandSearchStr}
                    onChange={setBandSearchStr}
                    onClear={() => setBandSearchStr('')}
                    showLyricsToggle={true}
                    searchInLyrics={searchInLyrics}
                    onToggleLyrics={() => setSearchInLyrics((prev) => !prev)}
                />
            )}

            <main ref={scrollRef} className="content-scroll" onScroll={handleScroll}>
                {isGridView ? (
                    <>
                        <div style={gridContainerStyle}>
                            {bandSongs.map((item) => (
                                <div
                                    key={`song-${item.id}`}
                                    role="button"
                                    tabIndex={0}
                                    style={gridCardStyle}
                                    onClick={() => openSong(item.id)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            openSong(item.id);
                                        }
                                    }}>
                                    <div style={{ fontWeight: 700 }}>{item.name}</div>
                                </div>
                            ))}
                        </div>

                        {bandFeaturing.length > 0 && (
                            <>
                                <div className="section-header">Also featured in:</div>
                                <div style={gridContainerStyle}>
                                    {bandFeaturing.map((item) => (
                                        <div
                                            key={`ft-${item.id}`}
                                            role="button"
                                            tabIndex={0}
                                            style={gridCardStyle}
                                            onClick={() => openSong(item.id)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    openSong(item.id);
                                                }
                                            }}>
                                            <div style={{ fontWeight: 700 }}>{item.name}</div>
                                            {item.ft_band_name && (
                                                <div
                                                    style={{
                                                        fontSize: '0.88rem',
                                                        color: 'var(--text-secondary)',
                                                        marginTop: 4,
                                                    }}>
                                                    {item.ft_band_name}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </>
                ) : (
                    <>
                        {bandSongs.map((item) => (
                            <SongItem
                                key={`song-${item.id}`}
                                id={item.id}
                                name={item.name}
                                band_name=""
                                ft_band_name=""
                                onNavigate={onNavigate}
                                originStr={bandName}
                            />
                        ))}

                        {bandFeaturing.length > 0 && (
                            <>
                                <div className="section-header">Also featured in:</div>
                                {bandFeaturing.map((item) => (
                                    <SongItem
                                        key={`ft-${item.id}`}
                                        id={item.id}
                                        name={item.name}
                                        band_name={bandName}
                                        ft_band_name={item.ft_band_name}
                                        onNavigate={onNavigate}
                                        originStr={bandName}
                                    />
                                ))}
                            </>
                        )}
                    </>
                )}
            </main>

            {bandModalVisible && (
                <div className="modal-backdrop" onClick={() => setBandModalVisible(false)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                        <p style={{ marginTop: 0 }}>Order:</p>
                        <button
                            className="modal-sort-option"
                            onClick={() => {
                                setBandOrderStr(' ORDER BY songs.name');
                                setBandModalVisible(false);
                            }}>
                            Ascending: A <ArrowRight size={14} /> Z
                        </button>
                        <button
                            className="modal-sort-option"
                            onClick={() => {
                                setBandOrderStr(' ORDER BY songs.name DESC');
                                setBandModalVisible(false);
                            }}>
                            Descending: Z <ArrowRight size={14} /> A
                        </button>
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 22 }}>
                            <button
                                className="btn-primary"
                                onClick={() => setBandModalVisible(false)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
