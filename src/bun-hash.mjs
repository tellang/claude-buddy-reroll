if (typeof Bun === 'undefined' || typeof Bun.hash !== 'function') {
  throw new Error('bun-hash.mjs must run under Bun');
}

const keys = JSON.parse(process.argv[2] ?? '[]');
const hashes = keys.map(key => Number(BigInt(Bun.hash(String(key))) & 0xffffffffn));

console.log(JSON.stringify(hashes));
