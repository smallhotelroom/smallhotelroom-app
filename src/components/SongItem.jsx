/**
 * @file src/components/SongItem.jsx
 * @version 2.9.0
 */
import React from 'react';

export const __version__ = '2.9.0';

const singleLineEllipsisStyle = {
    whiteSpace: 'nowrap',
    overflowX: 'clip',
    textOverflow: 'ellipsis',
    flexShrink: 0,
};

export function getScaledSongRowHeight(scale = 1) {
    return Math.max(48, Math.round(68 * scale));
}

export default function SongItem({
    id,
    name,
    band_name,
    ft_band_name,
    onNavigate,
    originStr,
    scale = 1,
}) {
    const rowHeight = getScaledSongRowHeight(scale);
    const padY = Math.max(8, Math.round(12 * scale));

    return (
        <div
            className="list-item"
            style={{
                height: `${rowHeight}px`,
                padding: `${padY}px 15px`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
            }}
            onClick={() =>
                onNavigate({
                    screen: 'Song',
                    params: { selectedSongId: id, originStr },
                })
            }>
            <div
                className="list-item-title"
                style={{
                    ...singleLineEllipsisStyle,
                    fontSize: `${scale}rem`,
                    lineHeight: 1.25,
                }}>
                {name}
            </div>
            {band_name === '' ? null : ft_band_name === '' ? (
                <div
                    className="list-item-subtitle"
                    style={{
                        ...singleLineEllipsisStyle,
                        fontSize: `${0.9 * scale}rem`,
                        lineHeight: 1.25,
                    }}>
                    {band_name}
                </div>
            ) : (
                <div
                    className="list-item-subtitle"
                    style={{
                        ...singleLineEllipsisStyle,
                        fontSize: `${0.9 * scale}rem`,
                        lineHeight: 1.25,
                    }}>
                    {ft_band_name}; {band_name}
                </div>
            )}
        </div>
    );
}
