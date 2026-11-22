/**
 * @file src/shared/frontmatterSchema.js
 * @version 1.0.0
 * Frontmatter YAML parser, key definitions, and strict project validation.
 * `artist` is optional and overrides the filename-derived artist (e.g. "cancionesdejuan", "AC/DC").
 */
import { parseInstrumentTuning } from './chordHarmony.js';

export const __version__ = '1.0.0';

export const BASE_REQUIRED_KEYS = [];

export const STRICT_PROJECT_NAMES = [
  'Small Hotel Room',
  'cancionesdejuan',
];

const STRICT_PROJECT_NAME_SET = new Set(STRICT_PROJECT_NAMES);

export const STRICT_PROJECT_KEYS = [
  'album',
  'author',
  'bpm',
  'isrc',
  'lang',
  'license',
  'musicians',
  'spotify',
  'track',
  'url',
];

export const TREATED_KEYS = Array.from(
  new Set([
    ...STRICT_PROJECT_KEYS,
    'artist',
    'capo',
    'downloads',
    'drop',
    'falsetto',
    'featuring',
    'highest',
    'initNote',
    'key',
    'scores',
    'time_signature',
    'title',
    'tuning',
    'writer',
    'youtube',
  ])
).sort();

export const validateAlphabeticalOrder = (keys) => {
  const sortedKeys = [...keys].sort();
  const isValid = keys.every((key, index) => key === sortedKeys[index]);

  return {
    isValid,
    expected: sortedKeys,
  };
};

export const getMissingKeys = (frontmatterData, rawFileName = '') => {
  let requiredForThisFile = [...BASE_REQUIRED_KEYS];
  let derivedArtist = frontmatterData.artist;

  if (!derivedArtist && rawFileName.includes(' - ')) {
    derivedArtist = rawFileName.split(' - ')[0].trim();
  }

  if (derivedArtist && STRICT_PROJECT_NAME_SET.has(derivedArtist)) {
    requiredForThisFile = [...requiredForThisFile, ...STRICT_PROJECT_KEYS];
  }

  return requiredForThisFile.filter(
    (reqKey) =>
      frontmatterData[reqKey] === undefined || frontmatterData[reqKey] === null
  );
};

export const validateFrontmatter = (frontmatterData, rawFileName = '') => {
  const errors = [];
  const keys = Object.keys(frontmatterData);

  const missing = getMissingKeys(frontmatterData, rawFileName);
  if (missing.length > 0) {
    errors.push(`Missing required keys: ${missing.join(', ')}`);
  }

  const { isValid, expected } = validateAlphabeticalOrder(keys);
  if (!isValid) {
    errors.push(
      `Keys are not in alphabetical order. Expected: \n${expected.join('\n')}`
    );
  }

  if (frontmatterData.tuning) {
    const tCheck = parseInstrumentTuning(String(frontmatterData.tuning), 'guitar');
    if (!tCheck.valid) {
      errors.push(tCheck.error);
    }
  }

  return errors;
};

export const parseFrontmatterFile = (rawText) => {
  const normalized = String(rawText || '').replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    return {
      hasFrontmatter: false,
      data: {},
      keyLines: {},
      bodyStartLine: 1,
      content: normalized,
    };
  }
  const endIdx = normalized.indexOf('\n---\n', 4);
  if (endIdx === -1) {
    return {
      hasFrontmatter: false,
      data: {},
      keyLines: {},
      bodyStartLine: 1,
      content: normalized,
    };
  }

  const yamlBlock = normalized.slice(4, endIdx);
  const lines = yamlBlock.split('\n');
  const rawAfterClose = normalized.slice(endIdx + 5);
  const strippedLeadingNewline = rawAfterClose.startsWith('\n');
  const bodyStartLine = lines.length + 3 + (strippedLeadingNewline ? 1 : 0);
  const content = strippedLeadingNewline ? rawAfterClose.slice(1) : rawAfterClose;
  const data = {};
  const keyLines = {};

  const parseScalar = (rawVal) => {
    const val = rawVal.trim();
    if (val === '') return '';
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      return val.slice(1, -1);
    }
    if (/^-?\d+$/.test(val)) return parseInt(val, 10);
    if (/^-?\d+\.\d+$/.test(val)) return parseFloat(val, 10);
    return val;
  };

  let currentTopKey = null;
  let currentListObj = null;

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const fileLineNumber = idx + 2;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const isIndented = /^\s/.test(line);
    const isListItem = trimmed.startsWith('- ') || trimmed === '-';

    if (!isIndented && !isListItem) {
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        const key = line.slice(0, colonIdx).trim();
        const rawVal = line.slice(colonIdx + 1).trim();
        currentTopKey = key;
        currentListObj = null;
        keyLines[key] = fileLineNumber;

        if (rawVal === '') {
          data[key] = [];
        } else {
          data[key] = parseScalar(rawVal);
        }
      }
    } else if (currentTopKey) {
      if (isListItem) {
        if (!Array.isArray(data[currentTopKey])) {
          data[currentTopKey] = [];
        }
        const afterDash = trimmed.slice(1).trim();
        const colonIdx = afterDash.indexOf(':');
        if (
          colonIdx !== -1 &&
          !afterDash.startsWith('"') &&
          !afterDash.startsWith("'")
        ) {
          const subKey = afterDash.slice(0, colonIdx).trim();
          const subVal = parseScalar(afterDash.slice(colonIdx + 1));
          currentListObj = { [subKey]: subVal };
          data[currentTopKey].push(currentListObj);
        } else if (afterDash !== '') {
          currentListObj = null;
          data[currentTopKey].push(parseScalar(afterDash));
        } else {
          currentListObj = {};
          data[currentTopKey].push(currentListObj);
        }
      } else if (currentListObj && trimmed.includes(':')) {
        const colonIdx = trimmed.indexOf(':');
        const subKey = trimmed.slice(0, colonIdx).trim();
        const subVal = parseScalar(trimmed.slice(colonIdx + 1));
        currentListObj[subKey] = subVal;
      }
    }
  }

  return {
    hasFrontmatter: true,
    data,
    keyLines,
    bodyStartLine,
    content,
  };
};
