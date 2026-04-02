import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

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

export function listKnownProfiles() {
  const root = readRootState();
  return Object.keys(root.profiles || {}).sort();
}

export function listProfileChoices(currentUserId = 'anon') {
  const ordered = [];
  const seen = new Set();

  const push = (profileId) => {
    if (!profileId || seen.has(profileId)) return;
    seen.add(profileId);
    ordered.push(profileId);
  };

  push(currentUserId);
  for (const profileId of listKnownProfiles()) push(profileId);
  return ordered;
}

export function describeProfileChoice(profileId, currentUserId = 'anon') {
  const known = new Set(listKnownProfiles());
  const isCurrent = profileId === currentUserId;
  const isSaved = known.has(profileId);
  return {
    profileId,
    isCurrent,
    isSaved,
    label: isCurrent ? 'detected Claude account' : 'saved profile data',
    detail: isCurrent
      ? (isSaved ? 'active runtime account with saved history' : 'active runtime account')
      : 'saved collection / quota snapshot',
  };
}

export function resolveKnownProfile(query = '') {
  const profiles = listKnownProfiles();
  if (!query) return null;
  const exact = profiles.find((profile) => profile === query);
  if (exact) return exact;
  const partial = profiles.filter((profile) => profile.startsWith(query));
  if (partial.length === 1) return partial[0];
  return null;
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
  const before = JSON.stringify(root);
  migrateLegacyIntoProfile(root, userId);
  if (JSON.stringify(root) !== before) {
    mkdirSync(dirname(STATE_PATH), { recursive: true });
    writeFileSync(STATE_PATH, JSON.stringify(root, null, 2), 'utf-8');
  }
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
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(root, null, 2), 'utf-8');
}

export { STATE_PATH };
