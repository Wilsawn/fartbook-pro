// Turns script lines [[startSec, endSec, "text"], ...] into a word-level Caption[] JSON
// (the @remotion/captions format, same as Whisper output), spreading words evenly.
// Usage: node scripts/make-captions.mjs captions/script-lines.json public/captions.json
import { readFileSync, writeFileSync } from 'node:fs';

const [, , input, output] = process.argv;
if (!input || !output) {
  console.error('usage: node scripts/make-captions.mjs <lines.json> <out.json>');
  process.exit(1);
}
const lines = JSON.parse(readFileSync(input, 'utf8'));
const out = [];
for (const [start, end, text] of lines) {
  const words = text.split(/\s+/).filter(Boolean);
  const step = ((end - start) * 1000) / words.length;
  words.forEach((w, i) => {
    const startMs = Math.round(start * 1000 + i * step);
    out.push({
      text: (out.length && i === 0) || i > 0 ? ' ' + w : w,
      startMs,
      endMs: Math.round(startMs + step),
      timestampMs: Math.round(startMs + step / 2),
      confidence: 1,
    });
  });
}
writeFileSync(output, JSON.stringify(out, null, 1));
console.log(`wrote ${out.length} words to ${output}`);
