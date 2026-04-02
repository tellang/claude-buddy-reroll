// Terminal UI selector — zero dependencies, arrow key navigation
import { emitKeypressEvents } from 'readline';

/**
 * Show an interactive list selector with arrow key navigation.
 * @param {Object} options
 * @param {string} options.title - Title shown above the list
 * @param {Array<{label: string, description?: string, value: any}>} options.items
 * @param {number} [options.columns=2] - Number of columns
 * @param {number} [options.selected=0] - Initial selection index
 * @returns {Promise<{index: number, value: any} | null>} Selected item or null if cancelled
 */
export async function select({ title, items, columns = 2, selected = 0 }) {
  if (!process.stdin.isTTY) return null;

  const RESET = '\x1b[0m';
  const BOLD = '\x1b[1m';
  const DIM = '\x1b[2m';
  const CYAN = '\x1b[36m';
  const BG_CYAN = '\x1b[46m\x1b[30m';
  const HIDE_CURSOR = '\x1b[?25l';
  const SHOW_CURSOR = '\x1b[?25h';

  let cursor = selected;
  const rows = Math.ceil(items.length / columns);
  const colWidth = 22;

  function render() {
    // Move cursor up to overwrite previous render (except first time)
    const totalLines = rows + 3; // title + blank + rows + footer
    process.stdout.write(`\x1b[${totalLines}A`);

    // Title
    process.stdout.write(`\x1b[2K  ${BOLD}${title}${RESET}\n`);
    process.stdout.write(`\x1b[2K\n`);

    // Grid
    for (let row = 0; row < rows; row++) {
      let line = '  ';
      for (let col = 0; col < columns; col++) {
        const idx = row * columns + col;
        if (idx >= items.length) {
          line += ' '.repeat(colWidth);
          continue;
        }
        const item = items[idx];
        const num = String(idx + 1).padStart(2);
        const text = `${num}. ${item.label}`;
        const padded = text.padEnd(colWidth - 1);

        if (idx === cursor) {
          line += `${BG_CYAN} ${padded}${RESET}`;
        } else {
          line += ` ${padded}`;
        }
      }
      process.stdout.write(`\x1b[2K${line}\n`);
    }

    // Footer
    const item = items[cursor];
    const desc = item.description ? `  ${DIM}${item.description}${RESET}` : '';
    process.stdout.write(`\x1b[2K\n\x1b[2K  ${CYAN}▶${RESET} ${items[cursor].label}${desc}\n`);
  }

  return new Promise((resolve) => {
    process.stdout.write(HIDE_CURSOR);

    // Print initial blank lines so render() can overwrite
    const totalLines = rows + 3;
    for (let i = 0; i < totalLines; i++) process.stdout.write('\n');

    render();

    emitKeypressEvents(process.stdin);
    if (process.stdin.setRawMode) process.stdin.setRawMode(true);
    process.stdin.resume();

    function cleanup() {
      if (process.stdin.setRawMode) process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('keypress', onKey);
      process.stdout.write(SHOW_CURSOR);
    }

    function onKey(str, key) {
      if (!key) return;

      if (key.name === 'up') {
        cursor = (cursor - columns + items.length) % items.length;
        render();
      } else if (key.name === 'down') {
        cursor = (cursor + columns) % items.length;
        render();
      } else if (key.name === 'left') {
        cursor = (cursor - 1 + items.length) % items.length;
        render();
      } else if (key.name === 'right') {
        cursor = (cursor + 1) % items.length;
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
