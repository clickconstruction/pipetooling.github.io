/**
 * The help sheets that print with a lien affidavit (punch list #314). Pure: the words and the HTML, nothing else.
 *
 * The office signed and notarized its first batch of short-form affidavits on 2026-11-11, and none could be filed as
 * it stood: the county blank at the top held the property's county on every sheet, no notary seal showed, and several
 * papers should have been stopped before they printed. A signed and sealed paper is never corrected by hand, so the
 * sheet has to work before the notary. The owner liked all three shapes, so all three are here:
 *
 * - `lienHelpCoverSheetHtml` — one page in front of one paper, with that job's facts (the Lien window's print);
 * - `lienHelpBatchSheetHtml` — one page in front of a batch, a row for each paper with boxes to tick (the Affidavits
 *   list's **Print N for notarization**);
 * - `lienHelpGuideCopyHtml` — the paper itself with numbered marks beside its blanks and the notes down the side, a
 *   copy to learn from that is never signed or filed.
 *
 * A help sheet is never the paper: it carries no sworn word, it is not filed as a sent copy, and every page says so.
 * The words follow `src/lib/plainWords.ts` and name each press as the screen writes it.
 */

export type LienHelpPaper = {
  /** `868 · Service Visit`, as the desk labels the job. */
  jobLabel: string
  propertyAddress: string
  /** The property's county: the clerk the paper is filed with. */
  propertyCounty: string
  /** `$2,650.00`. */
  claim: string
  /** The last day to file, in words (`Mon, Nov 16, 2026`); '' when the caller has none. */
  fileBy: string
  /** Who signs, as the paper names them. */
  signer: string
  ownerName: string
  ownerAddress: string
  /** The original contractor, '' on a job contracted with the owner (the copy goes to the owner alone). */
  contractorName: string
  contractorAddress: string
}

/** A paper the batch left out, with the reason in the desk's words. */
export type LienHelpLeftOut = { jobLabel: string; reason: string }

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The six blanks on a short-form affidavit, in the order the pen meets them. `[bold lead, the rest]`. */
export const LIEN_HELP_BLANKS: ReadonlyArray<readonly [string, string]> = [
  ['COUNTY OF, at the top.', 'The notary writes the county you are standing in when you sign. It is not the property’s county.'],
  ['The signature line.', 'The signer signs in front of the notary, and not before.'],
  ['COUNTY OF, in the notary’s block.', 'The same county as the first blank.'],
  ['The day, the month and the year.', 'The day it is signed.'],
  ['The notary’s signature and printed name.', 'Both lines.'],
  ['The notary’s seal.', 'In ink, dark enough to show on a copy. A paper with no seal goes back.'],
]

/** The same six in a few words each, for the batch sheet, where the room goes to the rows. */
export const LIEN_HELP_BLANKS_SHORT: ReadonlyArray<readonly [string, string]> = [
  ['COUNTY OF, at the top:', 'where you sign. Not the property’s county.'],
  ['Signature:', 'in front of the notary.'],
  ['COUNTY OF, notary’s block:', 'the same county.'],
  ['Day, month, year:', 'the day it is signed.'],
  ['Notary:', 'signature and printed name.'],
  ['Seal:', 'in ink that shows on a copy.'],
]

/** When to stop before signing. Each is one thing the office does not decide alone. */
export const LIEN_HELP_STOPS: ReadonlyArray<string> = [
  'The owner lives in this house. That is a homestead, and it goes to the attorney.',
  'The owner is a city, a county, a school or the State. A lien does not attach there.',
  'The owner line names an office or a job title, such as ATTN, where an owner’s name should be.',
  'A month the paper names has no notice mailed on time, or the contractor got no copy.',
  'Your stack holds more than one affidavit for the same property.',
  'Any word, name, address or amount on the paper is wrong.',
]

/** The stop list in a few words each, for the batch sheet. */
export const LIEN_HELP_STOPS_SHORT: ReadonlyArray<string> = [
  'The owner lives in the house.',
  'The owner is a city, county, school or the State.',
  'The owner line is an office or a title, such as ATTN.',
  'A month has no notice mailed on time.',
  'Anything printed on a paper is wrong.',
]

/** The rule under the stop list. */
export const LIEN_HELP_NEVER_FIX = 'A signed and sealed paper is never fixed by hand. Fix it in the app, print it again, and sign the new one.'

/** What happens after the notary. `{clerk}` is the property's county. The presses are the Lien window's own. */
export function lienHelpAfterSteps(clerkCounty: string, hasContractor: boolean): string[] {
  const clerk = clerkCounty.trim() ? `${clerkCounty.trim()} County Clerk` : 'County Clerk of the property’s county'
  return [
    `File the original with the <strong>${esc(clerk)}</strong>. That is the property’s county. The clerk charges a fee for each paper.`,
    'Write the clerk’s recording number and the day filed on the stamped copy.',
    'The same day, open the job on the Lien desk. Press <strong>Open the affidavit tab ›</strong>, then <strong>Record filing…</strong>, and type both.',
    hasContractor ? 'Mail a copy by certified mail to the owner and to the original contractor. The app shows the last day to mail.' : 'Mail a copy by certified mail to the owner. The app shows the last day to mail.',
    'Press <strong>Record service…</strong> and type the tracking numbers.',
    'Keep the clerk’s stamped copy with the job.',
  ]
}

/** The same steps in a few words each, for the guide copy's side column. */
export function lienHelpAfterStepsShort(clerkCounty: string, hasContractor: boolean): string[] {
  const clerk = clerkCounty.trim() ? `${clerkCounty.trim()} County Clerk` : 'County Clerk of the property’s county'
  return [`File with the <strong>${esc(clerk)}</strong>.`, 'In the app: <strong>Record filing…</strong>', hasContractor ? 'Mail copies to the owner and the contractor.' : 'Mail a copy to the owner.', 'In the app: <strong>Record service…</strong>']
}

/** The page's own styles. Every rule sits under `.lien-help`, so the paper beside it keeps its look. */
export const LIEN_HELP_STYLES = `
  .lien-help { font-family: system-ui, -apple-system, 'Segoe UI', Arial, sans-serif; font-size: 10.5pt; line-height: 1.35; color: #111418; break-after: page; page-break-after: always; margin-bottom: 4rem; }
  .lien-help h2 { font-size: 15pt; margin: 0; line-height: 1.15; }
  .lien-help h3 { font-size: 10.5pt; margin: 0 0 3pt; text-transform: uppercase; letter-spacing: 0.05em; }
  .lien-help p { margin: 0 0 4pt; }
  .lien-help ol, .lien-help ul { margin: 0; padding-left: 15pt; }
  .lien-help li { margin: 0 0 2.5pt; }
  .lien-help-band { display: flex; justify-content: space-between; gap: 10pt; align-items: flex-start; border: 2pt solid #111418; padding: 6pt 8pt; margin-bottom: 7pt; }
  .lien-help-tag { font-weight: 800; font-size: 9pt; letter-spacing: 0.08em; text-transform: uppercase; }
  .lien-help-facts { display: grid; grid-template-columns: repeat(4, 1fr); border: 1pt solid #111418; margin-bottom: 7pt; }
  .lien-help-facts > div { padding: 4pt 6pt; border-right: 1pt solid #111418; }
  .lien-help-facts > div:last-child { border-right: none; }
  .lien-help-k { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.06em; color: #444; }
  .lien-help-v { font-weight: 700; }
  .lien-help-box { border: 1pt solid #111418; padding: 6pt 8pt; margin-bottom: 7pt; break-inside: avoid; page-break-inside: avoid; }
  .lien-help-stop { border: 2.5pt solid #111418; background: #f1f1f1; }
  .lien-help-stop h3::before { content: 'STOP'; background: #111418; color: #fff; padding: 0 4pt; margin-right: 6pt; }
  .lien-help-two { display: grid; grid-template-columns: 1fr 1fr; gap: 7pt; }
  .lien-help-tick { display: inline-block; width: 9pt; height: 9pt; border: 1pt solid #111418; vertical-align: -1pt; }
  .lien-help-num { display: inline-flex; align-items: center; justify-content: center; width: 13pt; height: 13pt; border-radius: 50%; background: #111418; color: #fff; font: 700 8pt system-ui, Arial, sans-serif; vertical-align: 1pt; margin: 0 3pt; }
  .lien-help-small { font-size: 8.5pt; color: #333; }
  .lien-help-foot { border-top: 1pt solid #111418; margin-top: 6pt; padding-top: 3pt; font-size: 8pt; display: flex; justify-content: space-between; gap: 10pt; }
  .lien-help-rows { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8.5pt; line-height: 1.25; margin-bottom: 7pt; }
  .lien-help-rows th, .lien-help-rows td { border: 1pt solid #111418; padding: 3pt 4pt; text-align: left; vertical-align: top; }
  .lien-help-rows th { font-size: 6.5pt; text-transform: uppercase; letter-spacing: 0.03em; background: #ececec; }
  .lien-help-rows tr { break-inside: avoid; page-break-inside: avoid; }
  .lien-help-flag { font-weight: 800; }
  .lien-help-guide { display: grid; grid-template-columns: 62% 1fr; gap: 10pt; align-items: start; }
  .lien-help-guide-paper { border: 1pt solid #111418; padding: 10pt; font-family: Georgia, 'Times New Roman', serif; font-size: 9pt; line-height: 1.4; }
  @media print { .lien-help { margin: 0 -0.35in; } }
`

const band = (tag: string, title: string, right: string[]): string =>
  `<div class="lien-help-band"><div><div class="lien-help-tag">${esc(tag)}</div><h2>${esc(title)}</h2></div><div class="lien-help-small" style="text-align:right">${right.filter(Boolean).map(esc).join('<br/>')}</div></div>`

const stopBox = (title: string, items: ReadonlyArray<string>): string =>
  `<div class="lien-help-box lien-help-stop"><h3>${esc(title)}</h3><ul>${items.map((s) => `<li>${esc(s)}</li>`).join('')}</ul><p class="lien-help-small" style="margin-top:3pt">${esc(LIEN_HELP_NEVER_FIX)}</p></div>`

const blanksBox = (title: string, signer: string, blanks: ReadonlyArray<readonly [string, string]> = LIEN_HELP_BLANKS): string =>
  `<div class="lien-help-box"><h3>${esc(title)}</h3><ol>${blanks.map(([lead, rest], i) => `<li><strong>${esc(lead)}</strong> ${esc(i === 1 && signer.trim() ? `${signer.trim()} signs in front of the notary, and not before.` : rest)}</li>`).join('')}</ol></div>`

const party = (name: string, address: string): string => [name.trim(), address.trim()].filter(Boolean).map(esc).join('<br/>')

/** A, one page in front of one paper: the job's facts, when to stop, the blanks, and what happens after the notary. */
export function lienHelpCoverSheetHtml(p: LienHelpPaper, printedOn: string): string {
  const after = lienHelpAfterSteps(p.propertyCounty, Boolean(p.contractorName.trim()))
  const copies = [
    `<div class="lien-help-small"><strong>Owner</strong><br/>${party(p.ownerName, p.ownerAddress) || 'not on the paper'}</div>`,
    p.contractorName.trim() ? `<div class="lien-help-small"><strong>Original contractor</strong><br/>${party(p.contractorName, p.contractorAddress)}</div>` : '<div></div>',
  ].join('')
  return (
    `<section class="lien-help" data-lien-help="cover">` +
    band('Help sheet · do not file this page', 'Lien affidavit: before you sign', [printedOn ? `Printed ${printedOn}` : '', 'Stays with the job']) +
    `<div class="lien-help-facts">` +
    `<div><div class="lien-help-k">Job</div><div class="lien-help-v">${esc(p.jobLabel)}</div></div>` +
    `<div><div class="lien-help-k">Property</div><div class="lien-help-v">${esc(p.propertyAddress)}</div></div>` +
    `<div><div class="lien-help-k">Claim</div><div class="lien-help-v">${esc(p.claim)}</div></div>` +
    `<div><div class="lien-help-k">File by</div><div class="lien-help-v">${esc(p.fileBy || 'see the Lien desk')}</div></div>` +
    `</div>` +
    stopBox('Do not sign. Call the office first if any of these is true.', LIEN_HELP_STOPS) +
    blanksBox('The blanks. Nothing else is written on the paper.', p.signer) +
    `<div class="lien-help-box"><h3>After it is signed</h3><ol>${after.map((s) => `<li><span class="lien-help-tick"></span> ${s}</li>`).join('')}</ol><div class="lien-help-two" style="margin-top:5pt">${copies}</div></div>` +
    `<div class="lien-help-foot"><span>Help sheet for ${esc(p.jobLabel)}</span><span>The paper to sign is the next page</span></div>` +
    `</section>`
  )
}

const streetKey = (address: string): string => address.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Which papers of a batch sit on a property an earlier paper of the batch is on: the row number each repeats, by its
 * own index. One affidavit for several jobs at a property is counsel's question, so the sheet says *ask first*.
 */
export function lienHelpSameProperty(papers: ReadonlyArray<Pick<LienHelpPaper, 'propertyAddress'>>): Map<number, number> {
  const first = new Map<string, number>()
  const repeats = new Map<number, number>()
  papers.forEach((p, i) => {
    const key = streetKey(p.propertyAddress)
    if (!key) return
    const seen = first.get(key)
    if (seen === undefined) first.set(key, i)
    else repeats.set(i, seen)
  })
  return repeats
}

/** B, one page in front of a batch: the blanks and the stop list once, then a row for each paper with boxes to tick. */
export function lienHelpBatchSheetHtml(input: { papers: ReadonlyArray<LienHelpPaper>; leftOut?: ReadonlyArray<LienHelpLeftOut>; printedOn: string }): string {
  const { papers } = input
  const leftOut = input.leftOut ?? []
  const repeats = lienHelpSameProperty(papers)
  const fileBys = [...new Set(papers.map((p) => p.fileBy).filter(Boolean))]
  const tick = '<td><span class="lien-help-tick"></span></td>'
  const rows = papers
    .map((p, i) => {
      const repeat = repeats.get(i)
      const note = repeat !== undefined ? `<div class="lien-help-flag">Ask first. Same property as paper ${repeat + 1}.</div>` : ''
      const copyTo = [p.ownerName.trim(), p.contractorName.trim()].filter(Boolean).map(esc).join(' · ')
      return `<tr><td>${i + 1}</td><td><strong>${esc(p.jobLabel)}</strong><br/>${esc(p.propertyAddress)}${note}</td><td>${esc(p.claim)}</td><td>${esc(p.propertyCounty ? `${p.propertyCounty} County` : 'see the paper')}${fileBys.length > 1 && p.fileBy ? `<br/>by ${esc(p.fileBy)}` : ''}</td><td>${copyTo}</td>${tick.repeat(5)}</tr>`
    })
    .join('')
  const left = leftOut.map((l) => `<tr><td></td><td>${esc(l.jobLabel)}</td><td colspan="8" class="lien-help-flag">Not printed. ${esc(l.reason)}</td></tr>`).join('')
  const count = papers.length
  return (
    `<section class="lien-help" data-lien-help="batch">` +
    band('Help sheet · do not file this page', count === 1 ? 'Lien affidavit: this batch of 1' : `Lien affidavits: this batch of ${count}`, [input.printedOn ? `Printed ${input.printedOn}` : '', fileBys.length === 1 ? `All due ${fileBys[0]}` : '']) +
    `<div class="lien-help-two">` +
    blanksBox('Each paper has six blanks', '', LIEN_HELP_BLANKS_SHORT) +
    stopBox('Call the office first', LIEN_HELP_STOPS_SHORT) +
    `</div>` +
    `<div class="lien-help-box"><h3>After the notary, for each paper</h3><ol>` +
    `<li>File the original with the county clerk named on its row. Write the recording number on the stamped copy.</li>` +
    `<li>The same day, open the job on the Lien desk. Press <strong>Open the affidavit tab ›</strong>, then <strong>Record filing…</strong>.</li>` +
    `<li>Mail a copy by certified mail to each name on the row. The app shows the last day to mail.</li>` +
    `<li>Press <strong>Record service…</strong> and type the tracking numbers. Tick the row.</li>` +
    `</ol></div>` +
    `<table class="lien-help-rows"><colgroup><col style="width:3%"/><col style="width:27%"/><col style="width:9%"/><col style="width:9%"/><col style="width:20%"/><col style="width:6.4%"/><col style="width:6.4%"/><col style="width:6.4%"/><col style="width:6.4%"/><col style="width:6.4%"/></colgroup><tr><th>#</th><th>Job · property</th><th>Claim</th><th>File with the clerk of</th><th>Mail a copy to</th><th>Signed</th><th>Sealed</th><th>Filed</th><th>In app</th><th>Mailed</th></tr>${rows}${left}</table>` +
    `<div class="lien-help-foot"><span>Help sheet for the batch${input.printedOn ? ` printed ${esc(input.printedOn)}` : ''}</span><span>${count === 1 ? '1 paper follows this page' : `${count} papers follow this page`}</span></div>` +
    `</section>`
  )
}

const num = (n: number): string => `<span class="lien-help-num">${n}</span>`

/**
 * The paper's own HTML with a numbered mark beside each blank and beside the lines to read twice. Each mark is put
 * after words the short form always prints; a paper that lacks a line (a job contracted with the owner names no
 * months and no notices) simply gets no mark there. Returns the marks that landed, so the notes list only those.
 */
export function lienHelpMarkPaper(paperHtml: string): { html: string; marks: number[] } {
  let html = paperHtml
  const marks: number[] = []
  const mark = (n: number, find: RegExp, put: (m: string) => string) => {
    if (!find.test(html)) return
    html = html.replace(find, (m) => put(m))
    if (!marks.includes(n)) marks.push(n)
  }
  // 1: the top venue's blank (the note the form prints beside it is the anchor); 3: the notary's own venue blank.
  mark(1, /<span data-county-note[^>]*>[^<]*<\/span>/, (m) => `${m}${num(1)}`)
  mark(2, /<div style="border-bottom:1px solid currentColor;height:1\.6em"><\/div>/, (m) => `${m}${num(2)}`)
  mark(3, /STATE OF TEXAS<br\/>COUNTY OF _+<\/p>/, (m) => m.replace('</p>', `${num(3)}</p>`))
  mark(4, /SWORN TO AND SUBSCRIBED BEFORE ME on this[^<]*<\/p>/, (m) => m.replace('</p>', `${num(4)}</p>`))
  mark(5, /_{20,}<br\/>Notary Public, State of Texas<\/p>/, (m) => m.replace('</p>', `${num(5)}${num(6)}</p>`))
  if (marks.includes(5)) marks.push(6)
  mark(7, /The owner or reputed owner is[^<]*<\/p>/, (m) => m.replace('</p>', `${num(7)}</p>`))
  mark(7, /under a contract with the owner,[^<]*<\/p>/, (m) => m.replace('</p>', `${num(7)}</p>`))
  mark(8, /Payment is requested for work done[^<]*<\/p>/, (m) => m.replace('</p>', `${num(8)}</p>`))
  mark(8, /Notice of the claim was sent[^<]*<\/p>/, (m) => m.replace('</p>', `${num(8)}</p>`))
  return { html, marks: marks.sort((a, b) => a - b) }
}

/** What each mark says, in the guide copy's side column. */
export const LIEN_HELP_MARK_NOTES: Readonly<Record<number, string>> = {
  1: 'The county you sign in. It is not the property’s county.',
  2: 'The signer signs here, in front of the notary.',
  3: 'The same county as mark 1.',
  4: 'The day it is signed.',
  5: 'The notary signs, and prints a name on the line under it.',
  6: 'The seal goes beside the notary’s signature, in ink that shows on a copy.',
  7: 'A person or a company. Never ATTN, never a city, never someone who lives in the house.',
  8: 'Every month has a notice mailed on time, to the owner and to the contractor.',
}

/**
 * C, a guide copy of the paper itself: the paper's HTML with marks, the notes beside it, and a band at the top and the
 * foot that says this page is never signed or filed. `paperHtml` is the paper as the screen draws it (`filingDocHtml`).
 */
export function lienHelpGuideCopyHtml(paperHtml: string, p: Pick<LienHelpPaper, 'jobLabel' | 'fileBy' | 'propertyCounty' | 'contractorName'>): string {
  const marked = lienHelpMarkPaper(paperHtml)
  const note = (n: number) => (marked.marks.includes(n) ? `<p>${num(n)}${esc(LIEN_HELP_MARK_NOTES[n] ?? '')}</p>` : '')
  const blanks = [1, 2, 3, 4, 5, 6].map(note).join('')
  const reads = [7, 8].map(note).join('')
  const bandWords = 'Guide copy · do not sign or file this page'
  return (
    `<section class="lien-help" data-lien-help="guide">` +
    band(bandWords, 'Where the pen goes on the paper', [p.jobLabel, p.fileBy ? `File by ${p.fileBy}` : '']) +
    `<div class="lien-help-guide">` +
    `<div class="lien-help-guide-paper">${marked.html}</div>` +
    `<div>` +
    `<div class="lien-help-box"><h3>What goes in each blank</h3>${blanks}</div>` +
    (reads ? `<div class="lien-help-box lien-help-stop"><h3>Read these lines</h3>${reads}<p class="lien-help-small">If either is wrong, call the office. Do not sign. ${esc(LIEN_HELP_NEVER_FIX)}</p></div>` : '') +
    `<div class="lien-help-box"><h3>After it is signed</h3><ol>${lienHelpAfterStepsShort(p.propertyCounty, Boolean(p.contractorName.trim())).map((s) => `<li>${s}</li>`).join('')}</ol></div>` +
    `</div></div>` +
    `<div class="lien-help-band" style="margin:8pt 0 0"><div class="lien-help-tag">${esc(bandWords)}</div><div class="lien-help-small">Print the paper itself with Print for notarization</div></div>` +
    `</section>`
  )
}

/** A whole print page for a help sheet printed alone (the guide copy): light, letter, with the sheet's styles. */
export function lienHelpPrintHtml(sectionHtml: string, title: string): string {
  return `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page { size: letter; margin: 0.5in; } body { margin: 0; background: #fff; }${LIEN_HELP_STYLES} @media print { .lien-help { margin: 0; break-after: auto; page-break-after: auto; } }</style></head><body>${sectionHtml}</body></html>`
}

/** The facts a help sheet reads off an affidavit's own fields, so the sheet and the paper cannot disagree. */
export function lienHelpPaperFromFields(input: {
  jobLabel: string
  fileBy: string
  claimWords: string
  fields: { county: string; propertyAddress: string; claimantPersonName: string; ownerName: string; ownerAddress: string; originalContractorName: string; originalContractorAddress: string; isSub?: boolean }
}): LienHelpPaper {
  const f = input.fields
  const sub = f.isSub !== false
  return {
    jobLabel: input.jobLabel,
    propertyAddress: f.propertyAddress.trim(),
    propertyCounty: f.county.trim(),
    claim: input.claimWords,
    fileBy: input.fileBy,
    signer: f.claimantPersonName.trim(),
    ownerName: f.ownerName.trim(),
    ownerAddress: f.ownerAddress.trim(),
    contractorName: sub ? f.originalContractorName.trim() : '',
    contractorAddress: sub ? f.originalContractorAddress.trim() : '',
  }
}
