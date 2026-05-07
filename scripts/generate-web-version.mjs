import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const generatedDir = path.join(rootDir, 'src', 'generated');

const buildId = new Date().toISOString();
const versionPayload = {
  buildId,
  generatedAt: buildId
};

await fs.mkdir(publicDir, { recursive: true });
await fs.mkdir(generatedDir, { recursive: true });

await fs.writeFile(
  path.join(publicDir, 'version.json'),
  `${JSON.stringify(versionPayload, null, 2)}\n`,
  'utf8'
);

await fs.writeFile(
  path.join(generatedDir, 'buildVersion.js'),
  `export const CURRENT_WEB_BUILD_ID = ${JSON.stringify(buildId)};\n`,
  'utf8'
);

console.log(`Web version metadata generated: ${buildId}`);
