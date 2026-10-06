// Shared helpers for the storybook scripts. Paths are built from this file's location, never from URL.pathname,
// because the workspace path contains a space.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
export const at = (...p) => join(ROOT, ...p);

export function loadConfig() {
  const cfg = JSON.parse(readFileSync(at('config.json'), 'utf8'));
  const ids = new Set();
  for (const s of cfg.scenes) {
    if (!/^[a-z][a-z0-9-]*$/.test(s.id)) throw new Error(`Scene id "${s.id}" must be lowercase letters, digits and hyphens`);
    if (ids.has(s.id)) throw new Error(`Duplicate scene id "${s.id}"`);
    ids.add(s.id);
    if (!s.narration?.trim()) throw new Error(`Scene "${s.id}" has no narration`);
  }
  return cfg;
}

// Finds the nearest .env walking up from the project (videos/<name>/ sits two levels under the workspace root).
// Values go into the returned object only; nothing is printed or written to disk.
export function loadEnv() {
  const env = { ...process.env };
  let dir = ROOT;
  for (let i = 0; i < 6; i++) {
    const f = join(dir, '.env');
    if (existsSync(f)) {
      for (const row of readFileSync(f, 'utf8').split(/\r?\n/)) {
        const m = row.match(/^\s*(?:export\s+)?([A-Za-z_][\w]*)\s*=\s*(.*?)\s*$/);
        if (!m) continue;
        let v = m[2];
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        if (!(m[1] in env)) env[m[1]] = v;
      }
      break;
    }
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  // The owner's .env spells the Gemini key "Gemini_API_Key"; accept the common spellings.
  env.GEMINI_API_KEY = env.GEMINI_API_KEY || env.Gemini_API_Key || env.GOOGLE_API_KEY || '';
  return env;
}

export function redact(message, ...secrets) {
  let s = String(message);
  for (const k of secrets) if (k) s = s.split(k).join('[redacted]');
  return s;
}

export function probeDuration(file) {
  return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim());
}
