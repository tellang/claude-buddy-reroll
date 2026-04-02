// Terminal UI selector — zero dependencies, arrow key navigation
import { emitKeypressEvents } from 'readline';
import { padAnsiEnd, stripAnsi } from './ansi.mjs';

export function getSelectorRenderLineCount(bodyRows) {
  return bodyRows + 4;
}

/**
 * Show an interactive list selector with arrow key navigation.
 * @param {Object} options
 * @param {string} options.title - Title shown above the list
 * @param {Array<{label: string, description?: string, value: any}>} options.items
 * @param {number} [options.columns=2] - Number of columns
 * @param {number} [options.selected=0] - Initial selection index
 * @param {(item: any, meta: { cursor: number, tick: number }) => string} [options.preview] - Optional preview panel renderer
 * @param {number} [options.previewHeight=0] - Reserved preview panel height
 * @param {boolean} [options.fullscreen=false] - Render as fullscreen screen instead of in-place widget
 * @param {number} [options.animationIntervalMs=0] - Optional preview animation interval
 * @returns {Promise<{index: number, value: any} | null>} Selected item or null if cancelled
 */
export async function select({ title, items, columns = 2, selected = 0, preview = null, previewHeight = 0, fullscreen = false, animationIntervalMs = 0 }) {
  if (!process.stdin.isTTY) return null;

  const RESET = '\x1b[0m';
  const BOLD = '\x1b[1m';
  const DIM = '\x1b[2m';
  const CYAN = '\x1b[36m';
  const BG_CYAN = '\x1b[46m\x1b[30m';
  const HIDE_CURSOR = '\x1b[?25l';
  const SHOW_CURSOR = '\x1b[?25h';
  const CLEAR = '\x1b[2J\x1b[H';

  let cursor = selected;
  let tick = 0;
  const rows = Math.ceil(items.length / columns);
  const colWidth = 22;
  let renderedBodyRows = rows;
  let didFullscreenInit = false;

  function render() {
    const previewText = typeof preview === 'function' ? preview(items[cursor], { cursor, tick }) : '';
    const previewLines = previewText ? String(previewText).split('\n') : [];
    const bodyRows = Math.max(rows, previewHeight, previewLines.length);
    const totalLines = getSelectorRenderLineCount(Math.max(renderedBodyRows, bodyRows));

    if (fullscreen) {
      if (!didFullscreenInit) {
        process.stdout.write(CLEAR);
        for (let i = 0; i < totalLines; i++) process.stdout.write('\n');
        didFullscreenInit = true;
      }
      process.stdout.write(`\x1b[${totalLines}A`);
    } else {
      process.stdout.write(`\x1b[${totalLines}A`);
    }

    // Title
    process.stdout.write(`\x1b[2K  ${BOLD}${title}${RESET}\n`);
    process.stdout.write(`\x1b[2K\n`);

    for (let row = 0; row < bodyRows; row++) {
      let gridLine = '  ';

      if (row < rows) {
        for (let col = 0; col < columns; col++) {
          const idx = row * columns + col;
          if (idx >= items.length) {
            gridLine += ' '.repeat(colWidth);
            continue;
          }
          const item = items[idx];
          const num = String(idx + 1).padStart(2);
          const text = `${num}. ${item.label}`;
          const padded = padAnsiEnd(text, colWidth - 1);

          if (idx === cursor) {
            const inverted = stripAnsi(text).padEnd(colWidth - 1);
            gridLine += `${BG_CYAN} ${inverted}${RESET}`;
          } else {
            gridLine += ` ${padded}`;
          }
        }
      } else {
        gridLine += ' '.repeat(columns * colWidth);
      }

      const previewLine = previewLines[row] ? `    ${previewLines[row]}` : '';
      process.stdout.write(`\x1b[2K${gridLine}${previewLine}\n`);
    }

    // Footer
    const item = items[cursor];
    const desc = item.description ? `  ${DIM}${item.description}${RESET}` : '';
    process.stdout.write(`\x1b[2K\n\x1b[2K  ${CYAN}▶${RESET} ${items[cursor].label}${desc}\n`);
    renderedBodyRows = bodyRows;
  }

  return new Promise((resolve) => {
    process.stdout.write(HIDE_CURSOR);

    let animationTimer = null;

    if (!fullscreen) {
      const initialPreviewText = typeof preview === 'function' ? preview(items[cursor], { cursor, tick }) : '';
      const initialPreviewLines = initialPreviewText ? String(initialPreviewText).split('\n') : [];
      const totalLines = getSelectorRenderLineCount(Math.max(rows, previewHeight, initialPreviewLines.length));
      for (let i = 0; i < totalLines; i++) process.stdout.write('\n');
    }

    render();

    if (animationIntervalMs > 0) {
      animationTimer = setInterval(() => {
        tick++;
        render();
      }, animationIntervalMs);
    }

    emitKeypressEvents(process.stdin);
    if (process.stdin.setRawMode) process.stdin.setRawMode(true);
    process.stdin.resume();

    function cleanup() {
      if (process.stdin.setRawMode) process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('keypress', onKey);
      if (animationTimer) clearInterval(animationTimer);
      if (fullscreen) process.stdout.write(CLEAR);
      process.stdout.write(SHOW_CURSOR);
    }

    function onKey(str, key) {
      if (!key) return;

      if (key.name === 'up') {
        cursor = (cursor - columns + items.length) % items.length;
        tick++;
        render();
      } else if (key.name === 'down') {
        cursor = (cursor + columns) % items.length;
        tick++;
        render();
      } else if (key.name === 'left') {
        cursor = (cursor - 1 + items.length) % items.length;
        tick++;
        render();
      } else if (key.name === 'right') {
        cursor = (cursor + 1) % items.length;
        tick++;
        render();
      } else if (key.name === 'return') {
        cleanup();
        resolve({ index: cursor, value: items[cursor].value });
      } else if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
        cleanup();
        resolve(null);
      }
    }

    process.stdin.on('keypress', onKey);
  });
}
