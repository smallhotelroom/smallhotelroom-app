/**
 * @file src/shared/syntaxPalettes.js
 * @version 1.0.0
 * Theme-Aware Syntax Highlighting Palettes (Linter + SongScreen + PDF).
 */

export const __version__ = '1.0.0';

// Order: Basic (Default), Small Hotel Room
export const COLOR_THEMES = [
  {
    id: 'basic',
    label: 'Basic',
    accentColor: '#2563eb',
    accentHover: '#1d4ed8',
    accentRgb: '37, 99, 235',
  },
  {
    id: 'shr',
    label: 'Small Hotel Room',
    accentColor: '#569400',
    accentHover: '#457a00',
    accentRgb: '86, 148, 0',
  },
];

export const SYNTAX_PALETTE_BY_THEME = {
  // 1. Default: "Basic" (Chords = Blue, [choir] = Green, Purple modifiers, Blueish (...) tint)
  basic: {
    dark: {
      parenBg: 'rgba(121, 192, 255, 0.06)',
      parenSymbol: '#b392f0',
      chord: '#79c0ff',
      modifier: '#b392f0',
      directive: '#d29922',
      choir: '#7ee787',
    },
    light: {
      parenBg: 'rgba(9, 105, 218, 0.06)',
      parenSymbol: '#6e40c9',
      chord: '#0969da',
      modifier: '#6e40c9',
      directive: '#b45309',
      choir: '#1a7f37',
    },
    pdfBw: {
      parenBg: 'transparent',
      parenSymbol: '#6e6e6e',
      chord: '#000000',
      modifier: '#6e6e6e',
      directive: '#4b5563',
      choir: '#525252',
    },
  },
  // 2. "Small Hotel Room" (Chords = SHR Green, [choir] = Blue, Brown modifiers, Greenish (...) tint)
  shr: {
    dark: {
      parenBg: 'rgba(118, 199, 0, 0.08)',
      parenSymbol: '#c69055',
      chord: '#76c700',
      modifier: '#c69055',
      directive: '#d29922',
      choir: '#79c0ff',
    },
    light: {
      parenBg: 'rgba(86, 148, 0, 0.08)',
      parenSymbol: '#8b5a2b',
      chord: '#569400',
      modifier: '#8b5a2b',
      directive: '#b45309',
      choir: '#0969da',
    },
    pdfBw: {
      parenBg: 'transparent',
      parenSymbol: '#6e6e6e',
      chord: '#000000',
      modifier: '#6e6e6e',
      directive: '#4b5563',
      choir: '#525252',
    },
  },
};

export const getSyntaxPalette = (themeId = 'basic') => {
  if (themeId === 'shr') return SYNTAX_PALETTE_BY_THEME.shr;
  return SYNTAX_PALETTE_BY_THEME.basic;
};

// Default export for Linter / PDF backwards compatibility (defaults to "Basic")
export const SYNTAX_PALETTE = SYNTAX_PALETTE_BY_THEME.basic;
