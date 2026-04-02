import { randomSalt, roll } from './engine.mjs';
import { getPreferredVariant, normalizeCollectionEntry } from './collection.mjs';

function buildDexCriteria(targetSpecies, entry, userId) {
  const normalized = normalizeCollectionEntry(entry, userId);
  const preferredVariant = getPreferredVariant(normalized, userId);

  if (preferredVariant?.salt) {
    return {
      species: targetSpecies,
      rarity: preferredVariant.bones.rarity,
      eye: preferredVariant.bones.eye,
      hat: preferredVariant.bones.hat,
      shiny: preferredVariant.bones.shiny,
      preferredSalt: preferredVariant.salt,
      source: 'saved-variant',
    };
  }

  if (normalized.bestRarity) {
    return {
      species: targetSpecies,
      rarity: normalized.bestRarity,
      eye: preferredVariant?.bones.eye ?? null,
      hat: preferredVariant?.bones.hat ?? null,
      shiny: preferredVariant?.bones.shiny ?? null,
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
    (!criteria.rarity || result.bones.rarity === criteria.rarity) &&
    (!criteria.eye || result.bones.eye === criteria.eye) &&
    (!criteria.hat || result.bones.hat === criteria.hat) &&
    (criteria.shiny == null || result.bones.shiny === criteria.shiny);
}

export function findDexBuddy({
  userId,
  targetSpecies,
  entry,
  maxAttempts = 10000,
  randomSaltFn = randomSalt,
  rollFn = roll,
}) {
  const criteria = buildDexCriteria(targetSpecies, entry, userId);

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
