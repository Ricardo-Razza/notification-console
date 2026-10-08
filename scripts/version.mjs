import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
let revision = 'development';
try {
  revision = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
} catch {}
writeFileSync(
  'public/version.json',
  JSON.stringify({
    version: process.env.npm_package_version ?? '0.0.0',
    revision: process.env.BUILD_REVISION ?? revision,
    builtAt: new Date().toISOString(),
  }) + '\n',
);
