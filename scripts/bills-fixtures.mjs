#!/usr/bin/env node
/**
 * The made-up test set for supply-house bill capture (punch list #179 PR 2, v2.6088): five bills drawn as PDFs with
 * pdf-lib, each beside the answer the model should give for it (`BILL_SCHEMA`'s shape, every amount a string of the
 * digits as printed). One data object draws the paper and writes the answer, so the two cannot drift.
 *
 *   node scripts/bills-fixtures.mjs          # writes src/test/fixtures/bills/<slug>.pdf, <slug>.answer.json, index.json
 *
 * The kernels' tests (`src/lib/materials/bills/*.test.ts`) read the answers; `scripts/bill-read-compare.mjs` sends the
 * PDFs to the deployed function with each of the two models and scores the answers against these. Every house, job,
 * person, number and amount is made up: Ridgeway Supply, Cedar Bend Pipe & Supply, Oakmont Dental, Riverbend Self
 * Storage, Todd. Dates are fixed so a re-run writes the same bytes.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(root, 'src/test/fixtures/bills')

const RIDGEWAY = { name: 'RIDGEWAY SUPPLY', address: '1480 Industrial Loop · Boerne, TX 78006', phone: '(830) 555-0142', remit: 'Remit to Ridgeway Supply, PO Box 4410, Boerne TX 78006' }
const CEDAR = { name: 'CEDAR BEND PIPE & SUPPLY', address: '902 Cedar Bend Dr · Kerrville, TX 78028', phone: '(830) 555-0199', remit: 'Remit to Cedar Bend Pipe & Supply, 902 Cedar Bend Dr, Kerrville TX 78028' }

/** A bill: what the paper prints, and the answer the model should give. */
const BILLS = [
  {
    slug: 'ridgeway-S1183420',
    note: 'The card’s bill: five lines that add to the total with the tax, PO 41207 on the ledger, the ship-to names the job.',
    house: RIDGEWAY,
    kind: 'INVOICE',
    meta: [['Invoice', 'S1183420'], ['Date', '10/22/2026'], ['PO', '41207'], ['Account', 'CLICK PLUMBING'], ['Terms', 'Net 30']],
    shipTo: ['Ship to', '418 CEDAR BEND DR', 'OAKMONT DENTAL'],
    lines: [
      ['3/4" Type L copper 20\'', '12', '48.10', '577.20'],
      ['3/4" copper 90 elbow', '40', '2.14', '85.60'],
      ['3/4" copper coupling', '30', '1.62', '48.60'],
      ['3/4" ball valve FIP', '4', '32.10', '128.40'],
      ['Solder and flux kit', '1', '39.90', '39.90'],
    ],
    totals: [['Subtotal', '879.70'], ['Tax 8.25%', '72.58'], ['TOTAL', '952.28']],
    answer: {
      house_name: 'Ridgeway Supply', document_kind: 'invoice', number: 'S1183420', date: '2026-10-22', po_text: '41207', account_ref: 'CLICK PLUMBING',
      ship_to: '418 Cedar Bend Dr, Oakmont Dental', job_text: 'Oakmont Dental', terms: 'Net 30', references_number: '',
      subtotal: '879.70', tax: '72.58', total: '952.28', page_count: 1, statement_numbers: [], notes: '',
    },
  },
  {
    slug: 'ridgeway-CM-20991',
    note: 'A credit memo for four ball valves returned, naming the invoice it credits on its RE: line.',
    house: RIDGEWAY,
    kind: 'CREDIT MEMO',
    meta: [['Credit', 'CM-20991'], ['Date', '10/23/2026'], ['RE: invoice', 'S1183420'], ['Account', 'CLICK PLUMBING'], ['Returned by', 'TODD']],
    shipTo: ['Job', 'OAKMONT DENTAL', '418 CEDAR BEND DR'],
    lines: [['3/4" ball valve FIP · returned', '4', '32.10', '128.40']],
    totals: [['Subtotal', '128.40'], ['Tax 8.25%', '10.59'], ['CREDIT', '138.99']],
    footer: 'Applied to your account',
    answer: {
      house_name: 'Ridgeway Supply', document_kind: 'credit_memo', number: 'CM-20991', date: '2026-10-23', po_text: '', account_ref: 'CLICK PLUMBING',
      ship_to: '418 Cedar Bend Dr, Oakmont Dental', job_text: 'Oakmont Dental', terms: '', references_number: 'S1183420',
      subtotal: '128.40', tax: '10.59', total: '138.99', page_count: 1, statement_numbers: [], notes: 'Returned by Todd.',
    },
  },
  {
    slug: 'ridgeway-S1183455-wrong-total',
    note: 'Seven lines that add to $1,248.10 with the tax under a printed total of $1,284.10: the sum check fails. The PO field prints the job name, not a code.',
    house: RIDGEWAY,
    kind: 'INVOICE',
    meta: [['Invoice', 'S1183455'], ['Date', '10/24/2026'], ['PO', 'OAKMONT DENTAL'], ['Account', 'CLICK PLUMBING'], ['Terms', 'Net 30']],
    shipTo: ['Ship to', '418 CEDAR BEND DR', 'OAKMONT DENTAL'],
    lines: [
      ['1/2" Type L copper 20\'', '20', '31.40', '628.00'],
      ['1/2" copper 90 elbow', '50', '1.12', '56.00'],
      ['1/2" copper tee', '30', '1.86', '55.80'],
      ['1/2" copper coupling', '40', '0.94', '37.60'],
      ['1/2" ball valve FIP', '6', '24.50', '147.00'],
      ['3" PVC DWV pipe 10\'', '8', '21.75', '174.00'],
      ['3" PVC DWV 90 elbow', '10', '5.46', '54.60'],
    ],
    totals: [['Subtotal', '1,153.00'], ['Tax 8.25%', '95.10'], ['TOTAL', '1,284.10']],
    answer: {
      house_name: 'Ridgeway Supply', document_kind: 'invoice', number: 'S1183455', date: '2026-10-24', po_text: 'OAKMONT DENTAL', account_ref: 'CLICK PLUMBING',
      ship_to: '418 Cedar Bend Dr, Oakmont Dental', job_text: 'Oakmont Dental', terms: 'Net 30', references_number: '',
      subtotal: '1153.00', tax: '95.10', total: '1284.10', page_count: 1, statement_numbers: [], notes: '',
    },
  },
  {
    slug: 'cedar-bend-CB-77102',
    note: 'A bill from another house, Cedar Bend Pipe & Supply, so the letterhead check fires when the form is open on Ridgeway Supply.',
    house: CEDAR,
    kind: 'INVOICE',
    meta: [['Invoice', 'CB-77102'], ['Date', '10/21/2026'], ['PO', '41190'], ['Account', 'CLICK PLUMBING 2208'], ['Terms', 'Net 30']],
    shipTo: ['Ship to', '2201 HILLSIDE RD', 'RIVERBEND SELF STORAGE'],
    lines: [
      ['2" PVC Sch 40 pipe 10\'', '10', '14.20', '142.00'],
      ['2" PVC coupling', '12', '1.35', '16.20'],
      ['PVC primer and cement', '1', '18.90', '18.90'],
    ],
    totals: [['Subtotal', '177.10'], ['Tax 8.25%', '14.61'], ['TOTAL', '191.71']],
    answer: {
      house_name: 'Cedar Bend Pipe & Supply', document_kind: 'invoice', number: 'CB-77102', date: '2026-10-21', po_text: '41190', account_ref: 'CLICK PLUMBING 2208',
      ship_to: '2201 Hillside Rd, Riverbend Self Storage', job_text: 'Riverbend Self Storage', terms: 'Net 30', references_number: '',
      subtotal: '177.10', tax: '14.61', total: '191.71', page_count: 1, statement_numbers: [], notes: '',
    },
  },
  {
    slug: 'ridgeway-statement-oct-2026',
    note: 'A monthly statement listing four papers with a balance forward: a statement, not a bill, one bill at a time.',
    house: RIDGEWAY,
    kind: 'STATEMENT',
    meta: [['Statement', 'ST-2026-10'], ['Date', '10/31/2026'], ['Account', 'CLICK PLUMBING'], ['Terms', 'Net 30']],
    statement: [
      ['10/22/2026', 'S1183420', 'Invoice', '952.28'],
      ['10/23/2026', 'CM-20991', 'Credit', '-138.99'],
      ['10/24/2026', 'S1183455', 'Invoice', '1,284.10'],
      ['10/28/2026', 'S1184020', 'Invoice', '410.66'],
    ],
    totals: [['Balance due', '2,508.05']],
    answer: {
      house_name: 'Ridgeway Supply', document_kind: 'statement', number: 'ST-2026-10', date: '2026-10-31', po_text: '', account_ref: 'CLICK PLUMBING',
      ship_to: '', job_text: '', terms: 'Net 30', references_number: '',
      subtotal: '', tax: '', total: '2508.05', page_count: 1, statement_numbers: ['S1183420', 'CM-20991', 'S1183455', 'S1184020'], notes: 'A statement with a balance forward, not a single bill.',
    },
  },
]

const FIXED_DATE = new Date('2026-10-29T12:00:00Z')

async function draw(bill) {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`${bill.house.name} ${bill.kind} ${bill.meta[0][1]}`)
  pdf.setProducer('PipeTooling fixtures')
  pdf.setCreator('scripts/bills-fixtures.mjs')
  pdf.setCreationDate(FIXED_DATE)
  pdf.setModificationDate(FIXED_DATE)
  const page = pdf.addPage([612, 792])
  const serif = await pdf.embedFont(StandardFonts.TimesRoman)
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold)
  const ink = rgb(0.12, 0.14, 0.17)
  const left = 54
  let y = 740
  const text = (s, x, size = 10, font = serif) => page.drawText(s, { x, y, size, font, color: ink })
  const right = (s, xRight, size = 10, font = serif) => page.drawText(s, { x: xRight - font.widthOfTextAtSize(s, size), y, size, font, color: ink })

  // Letterhead
  text(bill.house.name, left, 18, bold)
  right(bill.kind, 558, 14, bold)
  y -= 16
  text(bill.house.address, left, 9)
  text(bill.house.phone, 300, 9)
  y -= 8
  page.drawLine({ start: { x: left, y }, end: { x: 558, y }, thickness: 1.5, color: ink })
  y -= 22

  // Meta, two columns
  bill.meta.forEach(([k, v], i) => {
    const x = i % 2 === 0 ? left : 320
    text(`${k}: `, x, 10, bold)
    text(v, x + bold.widthOfTextAtSize(`${k}: `, 10), 10)
    if (i % 2 === 1) y -= 14
  })
  if (bill.meta.length % 2 === 1) y -= 14
  y -= 10

  if (bill.shipTo) {
    const [label, ...rows] = bill.shipTo
    text(label.toUpperCase(), left, 7.5, bold)
    y -= 12
    for (const r of rows) {
      text(r, left, 10)
      y -= 13
    }
    y -= 8
  }

  // The table
  const cols = bill.statement ? [left, 150, 300, 558] : [left, 360, 430, 558]
  const heads = bill.statement ? ['Date', 'Number', 'Kind', 'Amount'] : ['Item', 'Qty', 'Unit', 'Ext']
  heads.forEach((h, i) => (i === heads.length - 1 || (!bill.statement && i > 0) ? right(h.toUpperCase(), i === heads.length - 1 ? cols[i] : cols[i] + 40, 7.5, bold) : text(h.toUpperCase(), cols[i], 7.5, bold)))
  y -= 4
  page.drawLine({ start: { x: left, y }, end: { x: 558, y }, thickness: 0.8, color: ink })
  y -= 14
  const rows = bill.statement ?? bill.lines
  for (const r of rows) {
    if (bill.statement) {
      text(r[0], cols[0], 10)
      text(r[1], cols[1], 10)
      text(r[2], cols[2], 10)
      right(r[3], cols[3], 10)
    } else {
      text(r[0], cols[0], 10)
      right(r[1], cols[1] + 40, 10)
      right(r[2], cols[2] + 40, 10)
      right(r[3], cols[3], 10)
    }
    y -= 14
  }
  y -= 4
  page.drawLine({ start: { x: 380, y }, end: { x: 558, y }, thickness: 0.8, color: ink })
  y -= 14
  for (const [k, v] of bill.totals) {
    const big = k === k.toUpperCase() || k === 'Balance due'
    right(k, 470, big ? 11 : 10, big ? bold : serif)
    right(v, 558, big ? 11 : 10, big ? bold : serif)
    y -= 15
  }
  y -= 10
  text(bill.footer ?? bill.house.remit, left, 8.5)
  return pdf.save({ useObjectStreams: false })
}

mkdirSync(OUT, { recursive: true })
const index = []
for (const bill of BILLS) {
  const bytes = await draw(bill)
  writeFileSync(join(OUT, `${bill.slug}.pdf`), bytes)
  const answer = {
    ...bill.answer,
    lines: (bill.lines ?? []).map(([description, quantity, unit_price, extended]) => ({ description: description.replace(' · returned', ' returned'), quantity, unit_price, extended: extended.replace(/,/g, '') })),
  }
  // The schema's key order, so the file reads like the answer the model gives.
  const ordered = {}
  for (const k of ['house_name', 'document_kind', 'number', 'date', 'po_text', 'account_ref', 'ship_to', 'job_text', 'terms', 'references_number', 'lines', 'subtotal', 'tax', 'total', 'page_count', 'statement_numbers', 'notes']) ordered[k] = answer[k]
  writeFileSync(join(OUT, `${bill.slug}.answer.json`), JSON.stringify(ordered, null, 2) + '\n')
  index.push({ slug: bill.slug, pdf: `${bill.slug}.pdf`, answer: `${bill.slug}.answer.json`, note: bill.note })
  console.log(`bills-fixtures: ${bill.slug}.pdf (${bytes.length} bytes)`)
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n')
