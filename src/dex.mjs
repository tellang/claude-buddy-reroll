import { randomSalt, roll } from './engine.mjs';
import { getPreferredVariant, normalizeCollectionEntry } from './collection.mjs';

function buildDexCriteria(targetSpecies, entry) {
  const normalized = normalizeCollectionEntry(entry);
  const preferredVariant = getPreferredVariant(normalized);

  if (preferredVariant?.salt) {
    return {
      species: targetSpecies,
      rarity: preferredVariant.bones.rarity,
      preferredSalt: preferredVariant.salt,
      source: 'saved-variant',
    };
  }

  if (normalized.bestRarity) {
    return {
      species: targetSpecies,
      rarity: normalized.bestRarity,
      source: 'rarity-match',
    };
  }

  return {
    species: targetSpecies,
    rarity: null,
    source: 'species-match',
  };
}

function matchesCriteria(result, criteria) {
  return result.bones.species === criteria.species &&
    (!criteria.rarity || result.bones.rarity === criteria.rarity);
}

export function findDexBuddy({
  userId,
  targetSpecies,
  entry,
  maxAttempts = 10000,
  randomSaltFn = randomSalt,
  rollFn = roll,
}) {
  const criteria = buildDexCriteria(targetSpecies, entry);

  if (criteria.preferredSalt) {
    const replay = {
      salt: criteria.preferredSalt,
      ...rollFn(userId, criteria.preferredSalt),
    };
    if (matchesCriteria(replay, criteria)) {
      return { found: replay, attempts: 0, criteria };
    }
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const salt = randomSaltFn();
    const result = { salt, ...rollFn(userId, salt) };
    if (matchesCriteria(result, criteria)) {
      return { found: result, attempts: attempt, criteria };
    }
  }

  return { found: null, attempts: maxAttempts, criteria };
}
