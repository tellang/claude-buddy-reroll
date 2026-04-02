import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const HOME = process.env.USERPROFILE || process.env.HOME || '';
const STATE_PATH = resolve(HOME, '.claude', 'buddy-reroll-state.json');
const LEGACY_KEYS = ['rolls', 'bestRarity', 'eventUses', 'collection', 'starred', 'starredAt'];

function defaultProfile() {
  return {
    rolls: [],
    bestRarity: 'common',
    eventUses: [],
    collection: {},
    starred: false,
    starredAt: null,
  };
}

function readRootState() {
  try {
    if (existsSync(STATE_PATH)) {
      return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
    }
  } catch {}
  return {};
}

function migrateLegacyIntoProfile(root, userId) {
  const hasLegacy = LEGACY_KEYS.some((key) => key in root);
  if (!hasLegacy) return;

  if (!root.profiles) root.profiles = {};
  if (!root.profiles[userId]) {
    root.profiles[userId] = {
      ...defaultProfile(),
      rolls: root.rolls || [],
      bestRarity: root.bestRarity || 'common',
      eventUses: root.eventUses || [],
      collection: root.collection || {},
      starred: root.starred === true,
      starredAt: root.starredAt || null,
    };
  }

  for (const key of LEGACY_KEYS) {
    delete root[key];
  }
}

export function loadProfileState(userId = 'anon') {
  const root = readRootState();
  migrateLegacyIntoProfile(root, userId);
  if (!root.profiles) root.profiles = {};
  return {
    ...defaultProfile(),
    ...(root.profiles[userId] || {}),
  };
}

export function saveProfileState(userId = 'anon', profile) {
  const root = readRootState();
  migrateLegacyIntoProfile(root, userId);
  if (!root.profiles) root.profiles = {};
  root.profiles[userId] = {
    ...defaultProfile(),
    ...profile,
  };
  writeFileSync(STATE_PATH, JSON.stringify(root, null, 2), 'utf-8');
}

export { STATE_PATH };
