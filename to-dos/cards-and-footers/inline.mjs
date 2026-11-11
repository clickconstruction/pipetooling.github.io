// Cards and footers (design spike): writes the shared styles, the two scripts and the two pieces of art INTO each
// mock-up page. The punch-list board serves only the .html files of a to-do, so a page must carry everything it
// needs. Edit mock.css, kit.js or mock.js, then run:  node to-dos/cards-and-footers/inline.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, name), 'utf8').trimEnd();
const dataUri = (name, mime) => `data:${mime};base64,${readFileSync(join(here, name)).toString('base64')}`;

// the whole-logo picture is only for the footer with live words, so only a page that shows one carries it
const blocksFor = (html) => ({
  'mock.css': `<style data-inline="mock.css">\n${read('mock.css')}\n</style>`,
  'kit.js':
    `<script data-inline="kit.js">\nwindow.ClickKitAssets = ${JSON.stringify({
      'mark.png': dataUri('mark.png', 'image/png'),
      ...(html.includes('data-html=') ? { 'logo-on-dark.png': dataUri('logo-on-dark.png', 'image/png') } : {}),
      'card-front.jpg': dataUri('card-front.jpg', 'image/jpeg'),
    })};\n${read('kit.js')}\n</script>`,
  'mock.js': `<script data-inline="mock.js">\n${read('mock.js')}\n</script>`,
});
const firstTime = {
  'mock.css': /<link rel="stylesheet" href="mock\.css">/,
  'kit.js': /<script src="kit\.js"><\/script>/,
  'mock.js': /<script src="mock\.js"><\/script>/,
};

for (const page of ['templates.html', 'rework.html', 'a-in-place.html', 'b-desk.html', 'c-walk.html']) {
  let html = readFileSync(join(here, page), 'utf8');
  for (const [name, block] of Object.entries(blocksFor(html))) {
    const tag = name.endsWith('.css') ? 'style' : 'script';
    const again = new RegExp(`<${tag} data-inline="${name.replace('.', '\\.')}">[\\s\\S]*?</${tag}>`);
    const target = again.test(html) ? again : firstTime[name];
    if (!target.test(html)) throw new Error(`${page}: no place for ${name}`);
    html = html.replace(target, () => block);
  }
  writeFileSync(join(here, page), html);
  console.log(`${page}: ${Math.round(html.length / 1024)} KB`);
}
