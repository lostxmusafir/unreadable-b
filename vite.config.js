import { defineConfig } from 'vite';
import { resolve, extname } from 'path';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getHtmlEntries(dir, entries = {}) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const path = resolve(dir, file);
    const stat = fs.statSync(path);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        getHtmlEntries(path, entries);
      }
    } else if (extname(file) === '.html' && !file.startsWith('media_')) {
      const relativePath = path.replace(resolve(__dirname), '').replace(/^[\\\/]/, '');
      const name = relativePath.replace(/\.html$/, '').replace(/[\/\\]/g, '_') || 'main';
      entries[name] = path;
    }
  }
  return entries;
}

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      input: getHtmlEntries(__dirname)
    }
  }
});
