import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const files = [];
function walk(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) walk(path);
    else if (
      /\.(ts|html)$/.test(path) &&
      !path.endsWith('.spec.ts') &&
      !path.endsWith('api-types.ts')
    )
      files.push(path);
  }
}
walk('src');
const forbidden = [
  /\[innerHTML\]/,
  /bypassSecurityTrust\w*/,
  /console\.(log|debug|info)\s*\(/,
  /sessionStorage/,
];
for (const path of files) {
  const source = readFileSync(path, 'utf8');
  if (forbidden.some((pattern) => pattern.test(source)))
    throw new Error('Forbidden unsafe construct in ' + path);
  if (/localStorage/.test(source) && !path.endsWith('theme.ts'))
    throw new Error('Storage is restricted to visual preferences: ' + path);
  if (/\$any\(/.test(source)) throw new Error('Untyped template access in ' + path);
}
console.info('Security source checks passed.');
