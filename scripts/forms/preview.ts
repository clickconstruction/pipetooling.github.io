/**
 * Contract Forms — fill a PDF from a schema and look at it.
 *
 *   npm run forms:preview -- form.pdf schema.json --out preview.pdf [--values values.json] [--png] [--boxes] [--no-flatten]
 *
 * Fills with the schema's `sample` values (or `--values`), draws a typed
 * signature "Sample Signer" into any signature box, and writes the PDF. With
 * `--png` and poppler's `pdftoppm` on the PATH, also rasterises page 1 to
 * `<out>.png` so an agent can show the owner what the signer's form will look
 * like. `--boxes` outlines every box in red (calibration). `--no-flatten`
 * keeps the fields editable so values can be read back.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import * as pdfLib from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { fillFormPdf, type FormPdfLibLike } from '../../supabase/functions/_shared/fillFormPdf'
import { buildFillPlan, sampleValues, validateFormSchema, validateFormValues, type FormSchema, type FormValues } from '../../supabase/functions/_shared/formSchema'

const args = process.argv.slice(2)
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--out', '--values'].includes(args[i - 1]!)))
const [pdfPath, schemaPath] = positional
const flag = (name: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : null
}
const out = flag('--out')
if (!pdfPath || !schemaPath || !out) {
  console.error('usage: npm run forms:preview -- <form.pdf> <schema.json> --out <preview.pdf> [--values values.json] [--png] [--boxes] [--no-flatten]')
  process.exit(2)
}
const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as FormSchema
const structural = validateFormSchema(schema)
if (structural.length > 0) {
  console.error('schema problems:', structural)
  process.exit(1)
}
const valuesPath = flag('--values')
const values: FormValues = valuesPath ? (JSON.parse(readFileSync(valuesPath, 'utf8')) as FormValues) : sampleValues(schema)
const problems = validateFormValues(schema, values)
if (problems.length > 0) console.error('note — these values would be refused at signing:', problems)

const plan = buildFillPlan(schema, values, { todayLabel: 'Sep 4, 2026', signature: { mode: 'type', text: 'Sample Signer' } })
const fontPath = resolve(process.cwd(), 'public/fonts/GreatVibes-Regular.ttf')
const cursive = existsSync(fontPath) ? readFileSync(fontPath) : null
const result = await fillFormPdf(pdfLib as unknown as FormPdfLibLike, readFileSync(pdfPath), plan, {
  cursiveFontBytes: cursive,
  fontkit,
  flatten: !args.includes('--no-flatten'),
  debugBoxes: args.includes('--boxes'),
})
writeFileSync(out, result.bytes)
console.error(`wrote ${out} (${result.bytes.byteLength} bytes, ${plan.length} op(s)${result.skipped.length ? `, skipped binds: ${result.skipped.join(', ')}` : ''})`)

if (args.includes('--png')) {
  try {
    const base = out.replace(/\.pdf$/i, '')
    execFileSync('pdftoppm', ['-r', '110', '-png', '-f', '1', '-l', '1', '-singlefile', out, base], { stdio: 'inherit' })
    console.error(`wrote ${base}.png`)
  } catch (e) {
    console.error('png skipped: pdftoppm (poppler) not available —', e instanceof Error ? e.message : String(e))
  }
}
