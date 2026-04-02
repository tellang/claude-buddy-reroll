const ASCII_REPLACEMENTS = new Map([
  ['·', '.'],
  ['✦', '*'],
  ['×', 'x'],
  ['◉', 'O'],
  ['°', 'o'],
  ['★', '*'],
  ['✨', '*'],
  ['╯', '/'],
  ['╬', '+'],
  ['─', '-'],
  ['═', '='],
  ['━', '='],
  ['▓', '#'],
  ['▲', '+'],
  ['▼', '-'],
  ['✧', '*'],
]);

export function isAsciiOnlyTerminal() {
  if (process.env.BDY_FORCE_ASCII === '1') return true;
  if (process.env.BDY_FORCE_ASCII === '0') return false;
  if (process.platform !== 'win32') return false;

  const termProgram = String(process.env.TERM_PROGRAM || '').toLowerCase();
  if (process.env.PSModulePath) return true;
  if (termProgram.includes('vscode')) return false;
  if (process.env.WT_SESSION) return false;
  return true;
}

export function toTerminalSafeText(value) {
  const text = String(value);
  if (!isAsciiOnlyTerminal()) return text;

  let next = text;
  for (const [from, to] of ASCII_REPLACEMENTS) {
    next = next.split(from).join(to);
  }
  return next;
}

export function formatEye(eye) {
  return toTerminalSafeText(eye);
}

export function formatStars(stars) {
  return toTerminalSafeText(stars);
}

export function formatShinyTag(shinyTag) {
  return toTerminalSafeText(shinyTag);
}
