const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

export function stripAnsi(value = '') {
  return String(value).replace(ANSI_PATTERN, '');
}

export function visibleLength(value = '') {
  return stripAnsi(value).length;
}

export function padAnsiEnd(value, width, fill = ' ') {
  const text = String(value);
  const visible = visibleLength(text);
  if (visible >= width) return text;
  return text + fill.repeat(width - visible);
}
