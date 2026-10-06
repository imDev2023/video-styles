// Shared by the Node tools: find the project folder and read config.js.
// Paths come from fileURLToPath, never URL.pathname: the workspace path has a space,
// and .pathname would keep it as %20 and create a wrongly named folder.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const PROJECT = fileURLToPath(new URL('..', import.meta.url));

export function loadConfig(dir = PROJECT) {
  const sandbox = {};
  sandbox.globalThis = sandbox;
  vm.runInNewContext(readFileSync(join(dir, 'config.js'), 'utf8'), sandbox, { filename: 'config.js' });
  if (!sandbox.VIDEO) throw new Error('config.js must assign root.VIDEO');
  return sandbox.VIDEO;
}

// Seconds as a short decimal string, for attributes.
export const sec = (x) => String(Math.round(x * 1000) / 1000);
