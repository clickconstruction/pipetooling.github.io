#!/usr/bin/env node
// Cards and footers (design spike): makes the email footer and the business card for one person or a whole list,
// on command, from the templates in kit.js. It draws each picture in a headless browser, so the output is the
// same drawing the mock-up pages show.
//
//   node to-dos/cards-and-footers/make.mjs --sample --out <folder>
//   node to-dos/cards-and-footers/make.mjs --people <team.json> --out <folder>
//   node to-dos/cards-and-footers/make.mjs --name "Marisol Vega" --email marisol@example.com \
//        --title "Office Manager" --mobile "(512) 555-0142" --office "(512) 555-0100" \
//        --photo <picture> --focus 0.5,0.35 --zoom 1 --out <folder>
//
// What lands in the folder, per person:
//   footer-<name>.png         the footer at 2709 x 625, the size of the designer's files
//   footer-<name>-1200.png    the same, 1200 wide, lighter for mail
//   card-<name>.pdf           the print file: front then back, 4.25 x 2.75 in, bleed and crop marks
//   card-<name>-sheet.pdf     ten to a letter page, fronts then backs, for scored card stock
//   card-<name>-back.png      the back alone at 1125 x 675 (300 to the inch, bleed included)
// and once: card-front.png, plus cards-all.pdf when more than one person was made.
//
// A list file is an array: [{ "name", "email", "title", "mobile", "office", "photo", "focus": [0.5, 0.35], "zoom": 1 }].
// A photo path is read from the list file's own folder. focus is the point of the picture that sits in the middle
// of the ring, across then down, 0 to 1. zoom 1 just covers the ring. Keep a list of real people, and their
// photos, OUTSIDE the repo.
//
// It makes what is ready and keeps going: a person with no name, no email or no photo is held, named at the end
// with the reason. --allow-no-photo makes those with the plain ring instead. --only footer or --only card makes
// one kind. --front <picture> sets the card front (it looks for the designer's full-size Front1.png by itself).
// --look picks the design. Left out, it is the look the owner chose (reworked: one orange, even lines, a title,
// and a phone on the footer). designer draws the designer's files as rebuilt. reworked-no-photo is the chosen
// look with the drawn card front.
// The words are set in Lexend, which loads from Google Fonts, so it needs the network. It stops, with the
// reason, if the font did not load: it never falls back to another typeface in silence.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

function parseArgs(argv) {
  const a = { only: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--sample' || k === '--allow-no-photo' || k === '--help') a[k.slice(2)] = true;
    else if (k.startsWith('--')) a[k.slice(2)] = argv[++i];
    else throw new Error(`Did not understand "${k}". Run with --help for the forms.`);
  }
  return a;
}

function expand(p) {
  return p.startsWith('~') ? join(homedir(), p.slice(1)) : resolve(p);
}

/** A phone number as the card prints it: (512) 555-0142, however it was typed. Not ten digits: as typed. The app's rule (`kitPhone`). */
function phoneOf(raw) {
  const typed = String(raw ?? '').trim()
  const digits = typed.replace(/\D/g, '')
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  return ten.length === 10 ? `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}` : typed
}

function slugOf(name) {
  return String(name).normalize('NFKD').replace(/[^\w\s-]/g, '').trim().toLowerCase().replace(/[\s_]+/g, '-') || 'someone';
}

function dataUri(file) {
  const mime = MIME[extname(file).toLowerCase()];
  if (!mime) throw new Error(`${file} is not a PNG, JPEG, WebP or GIF picture.`);
  return `data:${mime};base64,${readFileSync(file).toString('base64')}`;
}

/** A phone's HEIC, or a very large photo, is turned into a JPEG 1,600 px on its long side (macOS sips). */
function photoUri(file, scratch) {
  if (!existsSync(file)) throw new Error(`the photo ${file} is not there`);
  const ext = extname(file).toLowerCase();
  if (MIME[ext] && statSync(file).size < 3_000_000) return dataUri(file);
  const out = join(scratch, `${Math.random().toString(36).slice(2)}.jpg`);
  try {
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '90', '-Z', '1600', file, '--out', out], { stdio: 'ignore' });
  } catch {
    if (MIME[ext]) return dataUri(file);
    throw new Error(`the photo ${file} could not be read as a picture`);
  }
  return dataUri(out);
}

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.out || !(args.sample || args.people || args.name)) {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
  process.exit(args.help ? 0 : 1);
}
const only = args.only ? String(args.only).split(',') : ['footer', 'card'];
let lookName = args.look || null;
const outDir = expand(args.out);
mkdirSync(outDir, { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), 'cards-and-footers-'));

// the card front: the designer's full-size file when it is on this machine, else the small copy beside this script
const designerFront = join(homedir(), 'Desktop', 'Stationary', 'Front1.png');
const frontFile = args.front ? expand(args.front) : existsSync(designerFront) ? designerFront : join(here, 'card-front.jpg');
const frontIsSmall = frontFile === join(here, 'card-front.jpg');

// who to make
let asked = [];
if (args.people) {
  const file = expand(args.people);
  asked = JSON.parse(readFileSync(file, 'utf8')).map((p) => ({ ...p, photo: p.photo ? resolve(dirname(file), p.photo.replace(/^~/, homedir())) : null }));
} else if (args.name) {
  const focus = (args.focus || '0.5,0.4').split(',').map(Number);
  asked = [{ name: args.name, email: args.email, title: args.title || '', mobile: args.mobile || '', office: args.office || '', photo: args.photo ? expand(args.photo) : null, focus, zoom: Number(args.zoom || 1) }];
}

const browser = await chromium.launch();
const made = [], held = [];
let stopped = false;
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;700&display=block" rel="stylesheet">
<style>
  html, body { margin: 0; background: #fff; } svg { display: block; }
  .sheet { overflow: hidden; break-after: page; } .sheet svg { width: 100%; height: 100%; }
</style></head><body></body></html>`);
  await page.evaluate((assets) => { window.ClickKitAssets = assets; }, { 'mark.png': dataUri(join(here, 'mark.png')), 'logo-on-dark.png': dataUri(join(here, 'logo-on-dark.png')), 'card-front.jpg': dataUri(frontFile) });
  await page.addScriptTag({ path: join(here, 'kit.js') });
  const fontOk = await page.evaluate(async () => {
    try { await Promise.all([document.fonts.load('700 40px Lexend'), document.fonts.load('300 40px Lexend')]); } catch { return false; }
    return document.fonts.check('700 40px Lexend') && document.fonts.check('300 40px Lexend');
  });
  if (!fontOk) throw new Error('Lexend did not load from Google Fonts, so nothing was made. Check the network and run it again.');
  lookName = lookName || (await page.evaluate(() => window.ClickKit.CHOSEN));
  const look = await page.evaluate((n) => window.ClickKit.LOOKS[n] || null, lookName);
  if (!look) throw new Error(`There is no look called "${lookName}". The looks are: ${(await page.evaluate(() => Object.keys(window.ClickKit.LOOKS))).join(', ')}.`);

  // hand each person to the page once; the page keeps them by slug
  const people = [];
  if (args.sample) {
    for (const p of await page.evaluate(() => window.ClickKit.PEOPLE.map((q) => ({ name: q.name, hasPhoto: !!q.photo, id: q.id, email: q.email })))) {
      const slug = slugOf(p.name);
      await page.evaluate(({ id, slug }) => { (window.__P = window.__P || {})[slug] = window.ClickKit.PEOPLE.find((q) => q.id === id); }, { id: p.id, slug });
      people.push({ slug, name: p.name, email: p.email, hasPhoto: p.hasPhoto });
    }
  }
  for (const p of asked) {
    const slug = slugOf(p.name || '');
    let photo = null, why = null;
    if (p.photo) {
      try { photo = photoUri(p.photo, scratch); } catch (e) { why = e.message; }
    }
    if (why) { held.push(`${p.name || 'Someone with no name'}: ${why}.`); continue; }
    await page.evaluate(async ({ p, slug, photo }) => {
      let ph = null;
      if (photo) {
        const img = new Image(); img.src = photo; await img.decode();
        ph = { href: photo, w: img.naturalWidth, h: img.naturalHeight, fx: p.focus ? p.focus[0] : 0.5, fy: p.focus ? p.focus[1] : 0.4, zoom: p.zoom || 1 };
      }
      (window.__P = window.__P || {})[slug] = { name: p.name, email: p.email, title: p.title || '', mobile: p.mobile || '', office: p.office || '', photo: ph };
    }, { p: { ...p, mobile: phoneOf(p.mobile), office: phoneOf(p.office), photo: undefined }, slug, photo });
    people.push({ slug, name: p.name, email: p.email, hasPhoto: !!photo });
  }

  const shot = async (svgOf, arg, width, height, file) => {
    await page.setViewportSize({ width, height });
    await page.evaluate(({ fn, arg, width, look }) => { document.body.innerHTML = new Function('K', 'P', 'a', 'w', 'look', `return (${fn})(K, P, a, w, look)`)(window.ClickKit, window.__P || {}, arg, width, look); }, { fn: svgOf.toString(), arg, width, look });
    await page.waitForFunction(() => [...document.images].every((i) => i.complete));
    await page.screenshot({ path: join(outDir, file), clip: { x: 0, y: 0, width, height } });
  };
  const pdf = async (sheetsOf, arg, width, height, file) => {
    await page.evaluate(({ fn, arg, width, height, look }) => {
      const svgs = new Function('K', 'P', 'a', 'look', `return (${fn})(K, P, a, look)`)(window.ClickKit, window.__P || {}, arg, look);
      document.body.innerHTML = svgs.map((s) => `<div class="sheet" style="width:${width};height:${height}">${s}</div>`).join('');
    }, { fn: sheetsOf.toString(), arg, width, height, look });
    writeFileSync(join(outDir, file), await page.pdf({ width, height, printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } }));
  };

  const ready = [];
  for (const p of people) {
    const lacks = !p.name ? 'has no name' : !p.email ? 'has no email' : !p.hasPhoto && !args['allow-no-photo'] ? 'has no photo' : null;
    if (lacks) { held.push(`${p.name || 'Someone with no name'} ${lacks}.`); continue; }
    try {
      if (only.includes('footer')) {
        await shot((K, P, slug, w, look) => K.draw(look.footer, P[slug], { width: w }), p.slug, 2709, 625, `footer-${p.slug}.png`);
        await shot((K, P, slug, w, look) => K.draw(look.footer, P[slug], { width: w }), p.slug, 1200, 277, `footer-${p.slug}-1200.png`);
      }
      if (only.includes('card')) {
        await shot((K, P, slug, w, look) => K.draw(look.back, P[slug], { width: w }), p.slug, 1125, 675, `card-${p.slug}-back.png`);
        await pdf((K, P, slug, look) => [K.printPage(K.draw(look.front)), K.printPage(K.draw(look.back, P[slug]))], p.slug, '4.25in', '2.75in', `card-${p.slug}.pdf`);
        await pdf((K, P, slug, look) => [K.sheetOfTen(K.draw(look.front)), K.sheetOfTen(K.draw(look.back, P[slug]))], p.slug, '8.5in', '11in', `card-${p.slug}-sheet.pdf`);
      }
      ready.push(p); made.push(p.name);
    } catch (e) {
      held.push(`${p.name} failed: ${e.message.split('\n')[0]}.`);
    }
  }
  if (only.includes('card') && ready.length) {
    await shot((K, P, a, w, look) => K.draw(look.front, null, { width: w }), null, 1125, 675, 'card-front.png');
    if (ready.length > 1) {
      await pdf((K, P, slugs, look) => slugs.flatMap((s) => [K.printPage(K.draw(look.front)), K.printPage(K.draw(look.back, P[s]))]), ready.map((p) => p.slug), '4.25in', '2.75in', 'cards-all.pdf');
    }
  }
} catch (e) {
  /* a reason in plain words, not a stack */
  console.error(String(e.message).split('\n')[0]);
  stopped = true;
} finally {
  await browser.close();
  rmSync(scratch, { recursive: true, force: true });
}

if (stopped) process.exit(1);
const kinds = only.map((k) => (k === 'footer' ? 'a footer' : 'a card')).join(' and ');
console.log(made.length ? `Made ${kinds} for ${made.length} in the ${lookName} look: ${made.join(', ')}.` : 'Nothing was made.');
if (held.length) console.log(`Held ${held.length}:\n${held.map((h) => `  ${h}`).join('\n')}`);
if (made.length) console.log(`They are in ${outDir}`);
if (made.length && only.includes('card') && frontIsSmall && lookName !== 'reworked-no-photo') console.log('The card front is the small copy kept beside this script. Pass --front with the full-size file before sending a card to print.');
process.exit(made.length ? 0 : 1);
