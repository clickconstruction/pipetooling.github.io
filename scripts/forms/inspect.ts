/**
 * Contract Forms — list a PDF's fillable fields.
 *
 *   npm run forms:inspect -- path/to/form.pdf [--json]
 *
 * Prints page sizes and every AcroForm field with its page, rectangle (PDF
 * points, origin bottom-left), kind, and max length. `--json` prints the raw
 * `ReadPdfFieldsResult` for piping into other tools. Runs under vite-node so
 * it imports the same kernel the app and the edge function use.
 */
import { readFileSync } from 'node:fs'
import * as pdfLib from 'pdf-lib'
import { readPdfFields, type FormPdfLibLike } from '../../supabase/functions/_shared/fillFormPdf'

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith('--'))
if (!file) {
  console.error('usage: npm run forms:inspect -- <form.pdf> [--json]')
  process.exit(2)
}
const result = await readPdfFields(pdfLib as unknown as FormPdfLibLike, readFileSync(file))
if (args.includes('--json')) {
  console.log(JSON.stringify(result, null, 2))
} else {
  console.log(`${result.pages.length} page(s): ${result.pages.map((p) => `${p.width}×${p.height}`).join(', ')}`)
  console.log(`${result.fields.length} field(s)`)
  for (const f of result.fields) {
    const r = f.rect
    console.log(`  p${f.page} ${f.kind.padEnd(8)} x=${r.x} y=${r.y} w=${r.w} h=${r.h}${f.maxLength ? ` max=${f.maxLength}` : ''}  ${f.name}`)
  }
}
