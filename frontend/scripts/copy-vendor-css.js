/**
 * Copia CSS de dependências para public/vendor (servidos via <link> em _document).
 * Evita o injector de CSS do webpack no browser (erro parentNode no Next 15 dev).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const nm = path.join(root, 'node_modules');

function copyFile(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`[copy-vendor-css] ignorado (ausente): ${src}`);
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`[copy-vendor-css] ignorado (ausente): ${src}`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dest, ent.name);
    if (ent.isDirectory()) copyDir(s, d);
    else copyFile(s, d);
  }
}

copyFile(
  path.join(nm, 'bootstrap/dist/css/bootstrap.min.css'),
  path.join(root, 'public/vendor/bootstrap.min.css')
);

copyDir(
  path.join(nm, '@fortawesome/fontawesome-free'),
  path.join(root, 'public/vendor/fontawesome-free')
);

console.log('[copy-vendor-css] bootstrap + fontawesome em public/vendor/');
