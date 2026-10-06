#!/usr/bin/env node
/*
 * Builds src/modules/quotes/data/verses.json (and verses-review.txt) from the
 * public-domain Arabic Van Dyck module on eBible.org (arb-vd).
 *
 * 1. Download and unzip https://ebible.org/Scriptures/arb-vd_usfm.zip
 * 2. node scripts/build-verses.cjs --source <folder with the .usfm files>
 *      [--pool src/modules/quotes/quotes-pool.json]   chapter list to use
 *      [--seed 20261006] [--max 365]
 *
 * The default --source is scripts/.cache/arb-vd_usfm.
 *
 * Rules: verse text is copied verbatim (only the USFM line padding, i.e.
 * leading and trailing whitespace, is removed). A verse is kept when it is on
 * a single line, is not a verse range, is 25 to 180 characters long (vowel
 * marks count), and has as many « as ». Every qualifying verse from the
 * chapters in the pool is used, up to --max, picked with a seeded shuffle.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const SOURCE = path.resolve(opt('source', path.join(__dirname, '.cache', 'arb-vd_usfm')));
const POOL = path.resolve(opt('pool', path.join(ROOT, 'src/modules/quotes/quotes-pool.json')));
const SEED = Number(opt('seed', '20261006'));
const MAX = Number(opt('max', '365'));
const MIN_LEN = 25;
const MAX_LEN = 180;
const OUT_JSON = path.join(ROOT, 'src/modules/quotes/data/verses.json');
const OUT_REVIEW = path.join(ROOT, 'verses-review.txt');

if (!fs.existsSync(SOURCE)) {
  console.error(
    `Source folder not found: ${SOURCE}\n` +
      'Download https://ebible.org/Scriptures/arb-vd_usfm.zip, unzip it, and pass --source <folder>.',
  );
  process.exit(1);
}
const pool = JSON.parse(fs.readFileSync(POOL, 'utf8'));
const files = fs.readdirSync(SOURCE);

function readBook(code) {
  const f = files.find((x) => x.includes(code + 'arb-vd'));
  if (!f) throw new Error(`No USFM file for ${code} in ${SOURCE}`);
  const raw = fs.readFileSync(path.join(SOURCE, f), 'utf8').replace(/^﻿/, '');
  const verses = [];
  let chapter = 0;
  let cur = null;
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\\([a-z0-9]+)\*?(?:\s|$)/);
    const marker = m ? m[1] : null;
    if (marker === 'c') {
      chapter = parseInt(line.slice(2), 10);
      cur = null;
    } else if (marker === 'v') {
      const mm = line.match(/^\\v\s+(\d+)(?:-(\d+))?\s?(.*)$/);
      cur = {
        chapter,
        verse: mm[2] ? `${mm[1]}-${mm[2]}` : parseInt(mm[1], 10),
        text: mm[3],
        lines: 1,
      };
      verses.push(cur);
    } else if (cur && marker && /^(q\d?|m|p|li\d?|d)$/.test(marker)) {
      const rest = line.replace(/^\\[a-z0-9]+\s?/, '');
      if (rest.trim()) {
        cur.lines++;
      } else if (!/^(q|q1|q2|p|m)$/.test(marker)) {
        cur = null;
      }
    } else if (!marker && cur && line.trim()) {
      cur.lines++;
    } else if (marker && !/^(q\d?|m|p|li\d?|d)$/.test(marker)) {
      cur = null;
    }
  }
  verses.forEach((v) => (v.text = v.text.replace(/^\s+|\s+$/g, '')));
  return { raw, verses };
}

const count = (s, ch) => s.split(ch).length - 1;
const candidates = [];
const stats = {}; // per "book chapter"
const excluded = { multiLine: 0, range: 0, tooShort: 0, tooLong: 0, unbalanced: 0 };

for (const entry of pool) {
  const { raw, verses } = readBook(entry.code);
  entry.raw = raw;
  for (const chapter of entry.chapters) {
    const key = `${entry.book} ${chapter}`;
    stats[key] = { inChapter: 0, kept: 0 };
    for (const v of verses.filter((x) => x.chapter === chapter)) {
      stats[key].inChapter++;
      if (v.lines > 1) { excluded.multiLine++; continue; }
      if (typeof v.verse !== 'number') { excluded.range++; continue; }
      if (v.text.length < MIN_LEN) { excluded.tooShort++; continue; }
      if (v.text.length > MAX_LEN) { excluded.tooLong++; continue; }
      if (count(v.text, '«') !== count(v.text, '»')) { excluded.unbalanced++; continue; }
      stats[key].kept++;
      candidates.push({ code: entry.code, book: entry.book, chapter, verse: v.verse, text: v.text, key });
    }
  }
}

// canonical order first, so the shuffle is the same for the same pool
const bookOrder = pool.map((e) => e.code);
candidates.sort(
  (a, b) => bookOrder.indexOf(a.code) - bookOrder.indexOf(b.code) || a.chapter - b.chapter || a.verse - b.verse,
);

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const shuffled = candidates.slice();
for (let i = shuffled.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
}
const picked = shuffled.slice(0, MAX);

// verbatim check: each text must appear exactly as-is in its source file
const rawByCode = Object.fromEntries(pool.map((e) => [e.code, e.raw]));
const notVerbatim = picked.filter((v) => !rawByCode[v.code].includes(v.text));
if (notVerbatim.length) {
  console.error(`ERROR: ${notVerbatim.length} verse(s) are not verbatim in the source`);
  process.exit(1);
}

fs.writeFileSync(
  OUT_JSON,
  JSON.stringify(picked.map((v) => ({ book: v.book, chapter: v.chapter, verse: v.verse, text: v.text })), null, 2) + '\n',
  'utf8',
);
const review = picked
  .slice()
  .sort((a, b) => bookOrder.indexOf(a.code) - bookOrder.indexOf(b.code) || a.chapter - b.chapter || a.verse - b.verse)
  .map((v) => `${v.book} ${v.chapter}:${v.verse} | ${v.text}`);
fs.writeFileSync(OUT_REVIEW, review.join('\n') + '\n', 'utf8');

console.log(`pool file: ${POOL}`);
console.log(`candidates (qualifying verses in the listed chapters): ${candidates.length}`);
console.log(`written: ${picked.length} verses (max ${MAX}, seed ${SEED})`);
console.log('excluded:', JSON.stringify(excluded));
console.log('\nper chapter (kept in file / verses in chapter):');
const pickedPer = {};
picked.forEach((v) => (pickedPer[v.key] = (pickedPer[v.key] || 0) + 1));
for (const [key, s] of Object.entries(stats)) {
  console.log(`  ${key}: ${pickedPer[key] || 0} / ${s.inChapter}${s.kept !== (pickedPer[key] || 0) ? ` (qualified ${s.kept})` : ''}`);
}
