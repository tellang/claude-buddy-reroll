import { padAnsiEnd } from './ansi.mjs';
import { BUDDY_LORE, wrapLore } from './buddy-lore.mjs';
import {
  getLatestVariant,
  getPreferredVariant,
  getRarityCompletion,
  getShinyVariant,
  normalizeCollectionEntry,
} from './collection.mjs';
import { maskUserId } from './context.mjs';
import { RARITY_STARS } from './engine.mjs';
import { renderSprite } from './sprites.mjs';
import { formatEye, formatStars, toTerminalSafeText } from './terminal.mjs';

const GALLERY_PAGE_SIZE = 4;

function fitLine(value, width) {
  return padAnsiEnd(toTerminalSafeText(String(value)).slice(0, width), width);
}

function summarizeVariant(variant) {
  if (!variant) return '--';
  const hat = variant.bones.hat === 'none' ? '(none)' : variant.bones.hat;
  return `${formatStars(RARITY_STARS[variant.bones.rarity])} ${formatEye(variant.bones.eye)} ${hat}`;
}

function getVariantTags(variant, preferredVariant, latestVariant) {
  if (!variant) return [];
  return [
    preferredVariant && variant.salt === preferredVariant.salt ? 'BEST' : null,
    latestVariant && variant.salt === latestVariant.salt ? 'LATEST' : null,
    variant.bones.shiny ? 'SHINY' : null,
  ].filter(Boolean);
}

function pushUniqueVariant(ordered, seen, variant) {
  if (!variant?.salt || seen.has(variant.salt)) return;
  seen.add(variant.salt);
  ordered.push(variant);
}

function makeBox(title, lines, width = 28) {
  const innerWidth = width - 4;
  const output = [
    `+${'-'.repeat(width - 2)}+`,
    `| ${fitLine(title, innerWidth)} |`,
    `+${'-'.repeat(width - 2)}+`,
  ];

  for (const line of lines) {
    output.push(`| ${fitLine(line, innerWidth)} |`);
  }

  output.push(`+${'-'.repeat(width - 2)}+`);
  return output;
}

function joinColumns(leftLines, rightLines, leftWidth = 28, gap = '  ') {
  const totalRows = Math.max(leftLines.length, rightLines.length);
  const output = [];

  for (let row = 0; row < totalRows; row++) {
    const left = leftLines[row] || ' '.repeat(leftWidth);
    const right = rightLines[row] || '';
    output.push(`${left}${gap}${right}`);
  }

  return output;
}

export function createProfileLensOptions(currentUserId, knownProfiles = []) {
  const dedupedProfiles = Array.from(new Set([currentUserId, ...knownProfiles].filter(Boolean)));

  return dedupedProfiles.map((profileId, index) => {
    const isDetected = profileId === currentUserId;
    const isSaved = knownProfiles.includes(profileId);

    return {
      profileId,
      kind: isDetected ? 'detected' : 'saved',
      shortLabel: isDetected ? 'Detected Claude account' : 'Saved profile data',
      description: isDetected
        ? (isSaved
            ? 'Detected Claude account with saved collection data'
            : 'Detected Claude account; saved collection data not created yet')
        : 'Browse stored collection data from another Claude account',
      selectable: true,
      defaultSelected: index === 0,
    };
  });
}

export function buildProfileLensItems({ detectedUserId, currentUserId, knownProfiles = [] } = {}) {
  const liveUserId = detectedUserId || currentUserId || 'anon';
  return createProfileLensOptions(liveUserId, knownProfiles).map((option) => ({
    label: `${option.kind === 'detected' ? '[LIVE]' : '[SAVED]'} ${maskUserId(option.profileId)}`,
    description: option.kind === 'detected'
      ? `Detected Claude account: ${option.description}`
      : `Saved profile data: ${option.description}`,
    value: option.profileId,
  }));
}

export function formatProfileBadge(userId) {
  return maskUserId(userId);
}

export function resolveDexFocusIndex(variantCount, requestedIndex = null) {
  if (!variantCount) return 0;
  if (!Number.isInteger(requestedIndex)) return 0;
  return Math.max(0, Math.min(variantCount - 1, requestedIndex));
}

export function stepDexFocusIndex(currentIndex, variantCount, delta) {
  if (!variantCount) return 0;
  const start = resolveDexFocusIndex(variantCount, currentIndex);
  return (start + delta + variantCount) % variantCount;
}

export function getDexPreviewModel(species, entry, { focusIndex = null, tick = 0 } = {}) {
  const normalized = normalizeCollectionEntry(entry);
  const preferredVariant = getPreferredVariant(normalized);
  const latestVariant = getLatestVariant(normalized);
  const shinyVariant = getShinyVariant(normalized);
  const orderedVariants = [];
  const seenSalts = new Set();

  pushUniqueVariant(orderedVariants, seenSalts, preferredVariant);
  pushUniqueVariant(orderedVariants, seenSalts, latestVariant);
  pushUniqueVariant(orderedVariants, seenSalts, shinyVariant);
  const sortedVariants = [...normalized.variants].sort((a, b) => {
    const rarityDelta = RARITY_STARS[b.bones.rarity].length - RARITY_STARS[a.bones.rarity].length;
    if (rarityDelta !== 0) return rarityDelta;
    const shinyDelta = Number(b.bones.shiny) - Number(a.bones.shiny);
    if (shinyDelta !== 0) return shinyDelta;
    return (b.discoveredAt || 0) - (a.discoveredAt || 0);
  });

  for (const variant of sortedVariants) {
    pushUniqueVariant(orderedVariants, seenSalts, variant);
  }

  const resolvedFocusIndex = resolveDexFocusIndex(orderedVariants.length, focusIndex);
  const galleryStart = Math.floor(resolvedFocusIndex / GALLERY_PAGE_SIZE) * GALLERY_PAGE_SIZE;
  const visibleVariants = orderedVariants.slice(galleryStart, galleryStart + GALLERY_PAGE_SIZE);
  const focusedVariant = orderedVariants[resolvedFocusIndex] || null;
  const rarityTrack = getRarityCompletion(normalized).map(({ rarity, found }) =>
    `${found ? '[x]' : '[ ]'} ${rarity.padEnd(9)} ${formatStars(RARITY_STARS[rarity])}`.trimEnd(),
  );
  const spriteLines = focusedVariant
    ? toTerminalSafeText(renderSprite(
      species,
      formatEye(focusedVariant.bones.eye),
      focusedVariant.bones.hat,
      tick,
    )).split('\n')
    : [];

  return {
    species,
    entry: normalized,
    orderedVariants,
    focusIndex: resolvedFocusIndex,
    galleryStart,
    visibleVariants,
    focusedVariant,
    preferredVariant,
    latestVariant,
    shinyVariant,
    rarityTrack,
    spriteLines,
    galleryPage: orderedVariants.length === 0 ? 1 : Math.floor(galleryStart / GALLERY_PAGE_SIZE) + 1,
    galleryPages: Math.max(1, Math.ceil(orderedVariants.length / GALLERY_PAGE_SIZE)),
  };
}

export function getDexPreviewVariants(entry) {
  return getDexPreviewModel(entry?.variants?.[0]?.bones?.species || entry?.species || 'unknown', entry).orderedVariants;
}

export function getDexPreviewState(entry, { focusIndex = null, focusedFormIndex = null, tick = 0 } = {}) {
  const requestedFocus = Number.isInteger(focusedFormIndex) ? focusedFormIndex : focusIndex;
  const model = getDexPreviewModel(entry?.variants?.[0]?.bones?.species || entry?.species || 'unknown', entry, {
    focusIndex: requestedFocus,
    tick,
  });
  return {
    ordered: model.orderedVariants,
    orderedVariants: model.orderedVariants,
    visibleVariants: model.visibleVariants,
    galleryStart: model.galleryStart,
    preferredVariant: model.preferredVariant,
    latestVariant: model.latestVariant,
    shinyVariant: model.shinyVariant,
    focusedVariant: model.focusedVariant,
    focusedFormIndex: model.focusIndex,
    focusIndex: model.focusIndex,
    hasManualFocus: Number.isInteger(requestedFocus),
    tick,
  };
}

export function handleDexFocusInput(arg1, arg2 = null, arg3 = '') {
  const str = typeof arg1 === 'string' ? arg1 : arg3;
  const entry = typeof arg1 === 'string' ? arg2 : arg1;
  const focusedFormIndex = typeof arg1 === 'string' ? arg3 : arg2;
  const previewState = getDexPreviewState(entry, { focusIndex: focusedFormIndex });
  const orderedVariants = previewState.orderedVariants;
  if (!orderedVariants.length) return { handled: false, focusIndex: focusedFormIndex };
  if (/^[1-4]$/.test(str)) {
    const requested = Number(str) - 1;
    return requested < previewState.visibleVariants.length
      ? { handled: true, focusIndex: previewState.galleryStart + requested }
      : { handled: false, focusIndex: focusedFormIndex };
  }
  if (str === '0') return { handled: true, focusIndex: null };
  if (str === '[') return { handled: true, focusIndex: stepDexFocusIndex(focusedFormIndex, orderedVariants.length, -1) };
  if (str === ']') return { handled: true, focusIndex: stepDexFocusIndex(focusedFormIndex, orderedVariants.length, 1) };
  return { handled: false, focusIndex: focusedFormIndex };
}

export function buildDexPreview(species, entry, {
  focusIndex = null,
  focusedFormIndex = null,
  tick = 0,
  viewedProfileId = 'anon',
  detectedProfileId = null,
  detectedUserId = 'anon',
  currentUserId = 'anon',
} = {}) {
  const resolvedFocusIndex = Number.isInteger(focusedFormIndex) ? focusedFormIndex : focusIndex;
  const liveUserId = detectedProfileId || detectedUserId || currentUserId;
  const model = getDexPreviewModel(species, entry, { focusIndex: resolvedFocusIndex, tick });

  if (!model.focusedVariant) {
    const left = makeBox('PROFILE LENS', [
      `viewing ${maskUserId(viewedProfileId)}`,
      `live    ${maskUserId(liveUserId)}`,
      '',
      'No saved form yet.',
      'Run gacha first to',
      'unlock this species.',
    ]);
    const right = makeBox('NEXT STEP', [
      'Use current account',
      'gacha or reroll to',
      'discover this species,',
      'then reopen dex.',
      '',
      'Apply stays bound to',
      'the detected account.',
    ]);

    return [
      'DEX PREVIEW',
      `${species.toUpperCase()} ${formatStars(RARITY_STARS.common)}`,
      `Viewing ${maskUserId(viewedProfileId)} -> Applying on ${maskUserId(liveUserId)}`,
      ...joinColumns(left, right),
    ].join('\n');
  }

  const focusedTags = getVariantTags(model.focusedVariant, model.preferredVariant, model.latestVariant);
  const spriteBox = makeBox('FOCUSED FORM', [
    ...model.spriteLines,
    '',
    `rarity ${model.focusedVariant.bones.rarity}`,
    `eye    ${formatEye(model.focusedVariant.bones.eye)}`,
    `hat    ${model.focusedVariant.bones.hat === 'none' ? '(none)' : model.focusedVariant.bones.hat}`,
    `tags   ${focusedTags.join(' / ') || 'FORM'}`,
  ]);
  const lensBox = makeBox('PROFILE LENS', [
    `Viewing ${maskUserId(viewedProfileId)}`,
    `Applying on ${maskUserId(liveUserId)}`,
    `forms   ${model.orderedVariants.length}`,
    `focus   ${model.focusIndex + 1}/${model.orderedVariants.length} ${resolvedFocusIndex == null ? 'default' : 'manual'}`,
    `page    ${model.galleryPage}/${model.galleryPages}`,
    '',
    viewedProfileId === liveUserId
      ? 'Browsing the live account.'
      : 'Browsing saved data only.',
  ]);

  const flavorBox = makeBox('FLAVOR', wrapLore(BUDDY_LORE[species] || '', 20, 4));
  const statusBox = makeBox('STATUS', [
    `focus  ${summarizeVariant(model.focusedVariant)}`,
    `best   ${summarizeVariant(model.preferredVariant)}`,
    `latest ${summarizeVariant(model.latestVariant)}`,
    `shiny  ${model.shinyVariant ? 'yes' : 'no'}`,
    '',
    `apply  ${maskUserId(liveUserId)}`,
    viewedProfileId === liveUserId ? 'source live profile' : 'source saved profile',
  ]);

  const rarityBox = makeBox('RARITY TRACK', model.rarityTrack);
  const galleryLines = model.visibleVariants.map((variant, index) => {
    const absoluteIndex = model.galleryStart + index;
    const marker = absoluteIndex === model.focusIndex ? '>' : ' ';
    const tags = getVariantTags(variant, model.preferredVariant, model.latestVariant).join('/');
    return `${marker}${index + 1}. ${summarizeVariant(variant)}${tags ? ` ${tags}` : ''}`;
  });
  while (galleryLines.length < GALLERY_PAGE_SIZE) galleryLines.push('--');
  galleryLines.push('');
  galleryLines.push(`slots ${model.galleryStart + 1}-${Math.min(model.galleryStart + GALLERY_PAGE_SIZE, model.orderedVariants.length)} of ${model.orderedVariants.length}`);
  galleryLines.push('Form keys: 1-4 focus, 0 auto');
  const galleryBox = makeBox('FORM GALLERY', galleryLines);

  return [
    'DEX PREVIEW',
    `${species.toUpperCase()} ${formatStars(RARITY_STARS[model.focusedVariant.bones.rarity])}`,
    `Viewing ${maskUserId(viewedProfileId)} -> Applying on ${maskUserId(liveUserId)}`,
    ...joinColumns(spriteBox, lensBox),
    ...joinColumns(flavorBox, statusBox),
    ...joinColumns(rarityBox, galleryBox),
  ].join('\n');
}
