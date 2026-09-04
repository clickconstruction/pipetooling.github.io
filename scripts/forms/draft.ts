/**
 * Contract Forms — draft a FormSchema from a PDF's own fields.
 *
 *   npm run forms:draft -- path/to/form.pdf --out schema.json
 *
 * Every text field becomes a bound text box, sibling checkboxes become one
 * exactly-one group, in reading order. Labels are placeholders: the next step
 * is for a dev or an agent to rewrite them, promote digit fields into masked
 * `digits` boxes, add `signature` / `date` / `constant` boxes for lines the
 * PDF has no field for, and mark sensitive boxes. Then `forms:preview`, then
 * import into the Form Studio.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import * as pdfLib from 'pdf-lib'
import { readPdfFields, type FormPdfLibLike } from '../../supabase/functions/_shared/fillFormPdf'
import { draftSchemaFromPdfFields, validateFormSchema } from '../../supabase/functions/_shared/formSchema'

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith('--'))
const outIdx = args.indexOf('--out')
const out = outIdx >= 0 ? args[outIdx + 1] : null
if (!file) {
  console.error('usage: npm run forms:draft -- <form.pdf> [--out schema.json]')
  process.exit(2)
}
const info = await readPdfFields(pdfLib as unknown as FormPdfLibLike, readFileSync(file))
const schema = draftSchemaFromPdfFields(info.fields, info.pages)
const problems = validateFormSchema(schema)
if (problems.length > 0) {
  console.error('draft has structural problems:', problems)
  process.exit(1)
}
const json = JSON.stringify(schema, null, 2)
if (out) {
  writeFileSync(out, json)
  console.error(`wrote ${out}: ${schema.boxes.length} boxes, ${schema.groups.length} group(s) from ${info.fields.length} field(s)`)
} else console.log(json)
