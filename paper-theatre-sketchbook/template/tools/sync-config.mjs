// Stamp the values HyperFrames reads before any script runs (root duration, clip
// durations, audio source and fades) from config.js into index.html and meta.json.
// Usage: node tools/sync-config.mjs [projectDir]   (check, dev and render run it first)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECT, loadConfig, sec } from './config.mjs';

export function stampIndex(html, cfg, { duration = cfg.duration, mediaStart = 0 } = {}) {
  const setAttr = (tagId, attr, value) => {
    const tagRe = new RegExp(`<[a-z]+\\b[^>]*\\bid="${tagId}"[^>]*>`);
    const tag = html.match(tagRe);
    if (!tag) throw new Error(`index.html: no element with id="${tagId}"`);
    const esc = String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const attrRe = new RegExp(`\\s${attr}=("[^"]*"|'[^']*')`);
    // JSON attributes are written with single quotes so the JSON stays readable.
    const quoted = attr === 'data-automation' ? `'${value}'` : `"${esc}"`;
    const next = attrRe.test(tag[0])
      ? tag[0].replace(attrRe, () => ` ${attr}=${quoted}`)
      : tag[0].replace(/>$/, () => ` ${attr}=${quoted}>`);
    html = html.replace(tag[0], () => next);
  };
  const m = cfg.music;
  const fadeOutAt = Math.max(m.fadeIn, duration - m.fadeOut);
  const automation = JSON.stringify({
    version: 1,
    lanes: [{ target: 'volume', points: [
      { t: 0, v: 0 }, { t: Number(sec(m.fadeIn)), v: 1 },
      { t: Number(sec(fadeOutAt)), v: 1 }, { t: Number(sec(duration)), v: 0 },
    ] }],
  });
  setAttr('root', 'data-duration', sec(duration));
  setAttr('art', 'data-duration', sec(duration));
  setAttr('art', 'aria-label', cfg.description);
  setAttr('soundtrack', 'src', m.file);
  setAttr('soundtrack', 'data-duration', sec(duration));
  setAttr('soundtrack', 'data-volume', String(m.volume));
  setAttr('soundtrack', 'data-automation', automation);
  if (mediaStart) setAttr('soundtrack', 'data-media-start', sec(mediaStart));
  html = html.replace(/<title>[^<]*<\/title>/, () => `<title>${cfg.title.replace(/</g, '&lt;')}</title>`);
  return html;
}

export function sync(dir = PROJECT) {
  const cfg = loadConfig(dir);
  const indexPath = join(dir, 'index.html');
  const before = readFileSync(indexPath, 'utf8');
  const after = stampIndex(before, cfg);
  if (after !== before) writeFileSync(indexPath, after);
  const metaPath = join(dir, 'meta.json');
  const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};
  if (meta.id !== cfg.slug || meta.name !== cfg.slug) {
    writeFileSync(metaPath, JSON.stringify({ ...meta, id: cfg.slug, name: cfg.slug }, null, 2) + '\n');
  }
  const musicPath = join(dir, cfg.music.file);
  if (!existsSync(musicPath)) {
    console.warn(`sync: ${cfg.music.file} is missing. Run "npm run assets" first.`);
  } else if (existsSync(`${musicPath}.placeholder`)) {
    const made = readFileSync(`${musicPath}.placeholder`, 'utf8').trim();
    if (made !== sec(cfg.duration)) console.warn(`sync: the silent placeholder is ${made} s long; run "npm run assets" to rebuild it at ${cfg.duration} s.`);
  }
  console.log(`sync: ${cfg.slug}, ${cfg.duration} s, ${cfg.beats.length} beats${after !== before ? ' (index.html updated)' : ''}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  sync(process.argv[2] ? resolve(process.argv[2]) : PROJECT);
}
