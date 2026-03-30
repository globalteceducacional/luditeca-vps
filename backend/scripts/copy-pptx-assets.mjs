import { mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';

const filesToCopy = [
  ['src/pptx/importPptxEngine.js', 'dist/pptx/importPptxEngine.js'],
  ['src/pptx/storageCompat.mjs', 'dist/pptx/storageCompat.mjs'],
];

async function main() {
  for (const [from, to] of filesToCopy) {
    const toDir = path.dirname(to);
    await mkdir(toDir, { recursive: true });
    await copyFile(from, to);
  }
  console.log('[build] pptx assets copiados para dist.');
}

main().catch((error) => {
  console.error('[build] falha ao copiar assets pptx:', error);
  process.exit(1);
});
