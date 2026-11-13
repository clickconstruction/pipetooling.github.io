/**
 * A painted map on paper (punch list #345, PR 4b): one Letter page for a gate guard, a delivery
 * ticket or the binder in the truck. Pure: it builds the page's HTML from what it is handed. The
 * page carries its own pictures, so the copy that is filed opens the same a year on.
 *
 * A printed map is a copy. It says the day it was made, and when a link is out it carries a code
 * back to the map as it is today.
 */
import { PAINTED_MAP_COPY_WORDS } from './paintedMapPicture'

export type PrintPlace = { number: number; name: string; words: string; photo: string | null }
export type PaintedMapPrintInput = {
  company: { name: string; phone: string }
  name: string
  words: string
  /** The map alone, as a `data:` address. Null when it could not be drawn: the page prints its words. */
  picture: string | null
  places: ReadonlyArray<PrintPlace>
  /** Each line's length in words: `About 870 ft, give or take 10 ft · drawn by hand`. */
  lines: ReadonlyArray<string>
  /** The link's address and its code as SVG markup, when a link is out on this device. */
  link: { url: string; qrSvg: string; endsWords: string } | null
  /** `Made Nov 13, 2026`. */
  madeWords: string
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
/** A `data:` picture address and nothing else: a page that is filed must not reach out for a picture. */
const dataPicture = (src: string | null): string | null => (src && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(src) ? src : null)

export function buildPaintedMapPrintHtml(i: PaintedMapPrintInput): string {
  const picture = dataPicture(i.picture)
  const places = i.places
    .map((p) => {
      const photo = dataPicture(p.photo)
      return `<tr><td class="n"><span>${p.number}</span></td><td><b>${esc(p.name)}</b>${p.words.trim() ? `<div class="w">${esc(p.words)}</div>` : ''}</td><td class="ph">${photo ? `<img src="${photo}" alt="">` : ''}</td></tr>`
    })
    .join('')
  const lines = i.lines.map((l) => `<div class="len">${esc(l)}</div>`).join('')
  const code = i.link
    ? `<div class="code"><div class="qr">${i.link.qrSvg}</div><div><b>Scan for the map as it is today.</b><div class="w">${esc(i.link.url.replace(/^https?:\/\//, ''))}</div>${i.link.endsWords ? `<div class="w">${esc(i.link.endsWords)}</div>` : ''}</div></div>`
    : ''
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(i.name)}</title><style>
@page { size: letter; margin: 0.5in; }
* { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111827; background: #ffffff; font-size: 12pt; line-height: 1.35; }
.head { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #111827; padding-bottom: 6px; }
.head b { font-size: 13pt; }
.head span { font-size: 10pt; color: #4b5563; }
h1 { font-size: 20pt; margin: 12px 0 2px; }
.words { margin: 0 0 8px; color: #374151; }
.map { width: 100%; border: 1px solid #9ca3af; border-radius: 6px; display: block; }
.nomap { border: 1px dashed #9ca3af; border-radius: 6px; padding: 14px; color: #4b5563; }
table { width: 100%; border-collapse: collapse; margin-top: 10px; }
tr { break-inside: avoid; }
td { vertical-align: top; padding: 6px 4px; border-bottom: 1px solid #d1d5db; }
td.n { width: 34px; }
td.n span { display: inline-block; width: 24px; height: 24px; line-height: 21px; text-align: center; border: 2px solid #111827; border-radius: 50%; font-weight: 700; font-size: 10.5pt; }
td.ph { width: 1.5in; text-align: right; }
td.ph img { max-width: 1.4in; max-height: 1.05in; border-radius: 4px; border: 1px solid #d1d5db; }
.w { color: #374151; font-size: 10.5pt; }
.len { margin-top: 8px; font-size: 11pt; }
.guide { color: #4b5563; font-size: 9.5pt; margin-top: 2px; }
.code { display: flex; gap: 14px; align-items: center; margin-top: 14px; padding: 10px; border: 1px solid #9ca3af; border-radius: 6px; break-inside: avoid; }
.qr svg { width: 1.25in; height: 1.25in; display: block; }
.foot { margin-top: 12px; color: #4b5563; font-size: 9.5pt; }
</style></head><body>
<div class="head"><b>${esc(i.company.name)}</b><span>${esc(i.company.phone)}</span></div>
<h1>${esc(i.name)}</h1>
${i.words.trim() ? `<p class="words">${esc(i.words)}</p>` : ''}
${picture ? `<img class="map" src="${picture}" alt="The painted map, from above">` : `<div class="nomap">The picture of the map did not load. The places below are still right.</div>`}
${places ? `<table>${places}</table>` : ''}
${lines}${lines ? `<div class="guide">${esc(PAINTED_MAP_COPY_WORDS.guide)}</div>` : ''}
${code}
<div class="foot">${esc([i.madeWords, i.link ? PAINTED_MAP_COPY_WORDS.stale : PAINTED_MAP_COPY_WORDS.staleNoCode].filter(Boolean).join('. ').replace(/\.\./g, '.'))}</div>
</body></html>`
}

/** What the filing calls the page: the Documents list reads this. */
export function paintedMapPrintTitle(mapName: string): string {
  return `Painted map: ${mapName}`
}
/** The kind a printed painted map is filed under. */
export const PAINTED_MAP_PRINT_KIND = 'painted_map_print'
