// Claude Code Buddy — ASCII sprite definitions
// Each sprite is 5 lines tall, ~12 chars wide
// {E} is replaced with the chosen eye character
// Hats are rendered as a separate line above the sprite body.

export const SPRITES = {
  duck: {
    frames: [
      '    __    \n >(·  )=  \n  (    )  \n   ) /    \n  (_/     ',
      '   __     \n >( {E} )= \n  (    )  \n   / (    \n  (_\\     ',
    ],
  },
  goose: {
    frames: [
      '   _      \n  / )     \n >(  `> = \n  (    )  \n  _) \\_)  ',
      '    _     \n   ( \\    \n =( <` {E})<\n   (    ) \n   (_/(_  ',
    ],
  },
  blob: {
    frames: [
      '          \n  (~~~~)  \n (· ·  )  \n  ( __ )  \n  ~~~~~~  ',
      '          \n (~~~~~~) \n({E}  {E}  )\n (  __  ) \n  ~~~~~~  ',
    ],
  },
  cat: {
    frames: [
      ' /\\_/\\\\   \n( ·  · )  \n >  ^  <  \n /|  |\\\\  \n(_|  |_)  ',
      ' /\\_/\\\\   \n( {E}  · ) \n >  ^  <~ \n /|  |\\\\  \n(_/  \\_)  ',
    ],
  },
  dragon: {
    frames: [
      '  ^   ^   \n (· · )~  \n  > W <   \n /|  |\\\\  \n~ ~~  ~~ ~',
      ' ^  ^  ^  \n( {E}  · )~~\n >> W <<  \n/ |  | \\\\ \n ~~ ~~  ~~',
    ],
  },
  octopus: {
    frames: [
      '  _____   \n (· · · ) \n  \\___/   \n /|||||\\\\  \n~ ~ ~ ~ ~ ',
      '  _____   \n ({E} · · )\n  /___\\\\   \n /|/|/|\\\\  \n ~ ~ ~ ~~ ',
    ],
  },
  owl: {
    frames: [
      ' (  v  )  \n((· · ))  \n (> O <)  \n  |   |   \n  ^   ^   ',
      ' /( v )\\\\ \n(( {E} · )) \n (( O ))  \n  /   \\\\   \n  ^   ^   ',
    ],
  },
  penguin: {
    frames: [
      '  _____   \n ( · · )  \n (>   <)  \n  |   |   \n _|___|_  ',
      '   _____  \n  ( {E}  · ) \n <(   )>  \n   | |    \n  _|_|__  ',
    ],
  },
  turtle: {
    frames: [
      '  _____   \n /· · · \\ \n| (___) | \n \\_____/  \n  u   u   ',
      '   _____  \n  /{E} · ·\\\\\n | (___)  |\n  \\_____/  \n   u_ _u   ',
    ],
  },
  snail: {
    frames: [
      '   ____   \n  (· · )  \n @(    )@ \n  (    )  \n   ~~~~   ',
      '    ____  \n   ({E} · ) \n@=(    )@  \n   (    )  \n    ~~~~~  ',
    ],
  },
  ghost: {
    frames: [
      '  _____   \n (· · · ) \n |     |  \n |  ~  |  \n  ~~~~~~  ',
      '   _____  \n  ({E} · · ) \n  |     |  \n  | ~~~ |  \n   ~~~~~~  ',
    ],
  },
  axolotl: {
    frames: [
      ' vvv vvv  \n (· · · ) \n (> u <)  \n  |   |   \n ~~ ~ ~~  ',
      'vvv  vvv  \n( {E} · · )\n <( u )>  \n  /   \\\\   \n ~~~ ~~~  ',
    ],
  },
  capybara: {
    frames: [
      '  _____   \n (·   · ) \n (       )\n  |   |   \n  u   u   ',
      '   _____  \n  ({E}   · )\n  (     __)\n   |   |   \n   u   u   ',
    ],
  },
  cactus: {
    frames: [
      ' \\ | /    \n  (· ·)   \n--|   |-- \n  |   |   \n _|___|_  ',
      '  \\|/     \n  ({E} ·)   \n -|   |-- \n --|  |   \n  _|___|_ ',
    ],
  },
  robot: {
    frames: [
      ' [=====]  \n [· · · ] \n [_____]  \n  |   |   \n [=] [=]  ',
      ' [=^===]  \n [ {E} · · ]\n [__-__]  \n  /   \\\\   \n [=] [=]  ',
    ],
  },
  rabbit: {
    frames: [
      ' | . . |  \n (·   · ) \n (  ___) )\n  |   |   \n (_) (_)  ',
      ' || . ||  \n ({E}   · ) \n ( (___  )\n  /   \\\\   \n (_)_(_)  ',
    ],
  },
  mushroom: {
    frames: [
      ' (o . o)  \n (· · · ) \n  |   |   \n  | . |   \n  |___|   ',
      '  (o.o)   \n ({E} · · ) \n   |   |   \n  / . .\\\\  \n   |___|   ',
    ],
  },
  chonk: {
    frames: [
      '  _____   \n (·     ·)\n (  ~~~  )\n  |     | \n  u     u ',
      '   _____  \n  ({E}    ·)\n  ( ~~~~~ )\n   |     | \n   u_   _u ',
    ],
  },
};

// Hat sprites — single line, centered to ~12 chars wide
export const HAT_SPRITES = {
  none:      '          ',
  crown:     '  vVVVv   ',
  tophat:    ' [_____]  ',
  propeller: '  -o-o-   ',
  halo:      '  ( ° )   ',
  wizard:    '   /\\     ',
  beanie:    '  (~~~)   ',
  tinyduck:  '  <(·)>   ',
};

/**
 * Compose a full sprite string with an optional hat line above the body.
 *
 * @param {string} species - species key from SPRITES
 * @param {string} eye     - eye character to inject at {E}
 * @param {string} hat     - hat key from HAT_SPRITES
 * @param {number} frame   - 0 or 1 (animation frame index)
 * @returns {string}       - composed sprite
 */
export function renderSprite(species, eye, hat, frame = 0) {
  const spriteFrames = SPRITES[species]?.frames;
  if (!spriteFrames) throw new Error(`Unknown species: ${species}`);

  const frameIndex = frame % spriteFrames.length;
  const raw = spriteFrames[frameIndex];

  const lines = raw.split('\n');
  const hatLine = HAT_SPRITES[hat] ?? HAT_SPRITES.none;
  const body = lines.join('\n').replace('{E}', eye);
  return `${hatLine}\n${body}`;
}
