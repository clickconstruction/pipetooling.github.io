/**
 * Enter from paper (Contract Forms PR 6) — the pure parts of filing a form a
 * sub filled out by hand: what is still missing, which scans we accept, and
 * the request the edge function receives. Missing required boxes never block
 * filing (warn, never block); they are listed on the record instead.
 */

import { isFilled, type FormBox, type FormSchema, type FormValues } from './formSchema'

export const PAPER_SCAN_MAX_BYTES = 8 * 1024 * 1024
export const PAPER_SCAN_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
}

export type MissingRequired = { key: string; label: string }

/** Required boxes (and required groups / one-of sets) the keyed answers leave empty. */
export function missingRequired(schema: FormSchema, values: FormValues): MissingRequired[] {
  const out: MissingRequired[] = []
  const groupsSeen = new Set<string>()
  const oneOfsSeen = new Set<string>()
  const sorted = [...schema.boxes].sort((a, b) => a.order - b.order)
  for (const b of sorted) {
    if (b.type === 'constant' || b.type === 'signature' || (b.type === 'date' && (b.dateMode ?? 'today') === 'today')) continue
    if (b.type === 'checkbox' && b.group) {
      if (groupsSeen.has(b.group)) continue
      groupsSeen.add(b.group)
      const g = schema.groups.find((x) => x.key === b.group)
      if (g?.required && !schema.boxes.some((x) => x.group === b.group && values[x.key] === true)) out.push({ key: `group:${g.key}`, label: g.label })
      continue
    }
    if (b.oneOf) {
      if (oneOfsSeen.has(b.oneOf)) continue
      oneOfsSeen.add(b.oneOf)
      const o = schema.oneOfs.find((x) => x.key === b.oneOf)
      if (o?.required && !schema.boxes.some((x) => x.oneOf === b.oneOf && isFilled(values[x.key]))) out.push({ key: `oneof:${o.key}`, label: o.label })
      continue
    }
    if (b.required && !isFilled(values[b.key])) out.push({ key: b.key, label: b.label || b.key })
  }
  return out
}

export type ScanCheck = { ok: true; ext: string } | { ok: false; error: string }

/** A photo or PDF of the paper, small enough to post in one request. */
export function checkScanFile(file: { type: string; size: number; name: string }): ScanCheck {
  const ext = PAPER_SCAN_MIME_TYPES[file.type] ?? (/\.(jpe?g)$/i.test(file.name) ? 'jpg' : /\.png$/i.test(file.name) ? 'png' : /\.pdf$/i.test(file.name) ? 'pdf' : /\.heic$/i.test(file.name) ? 'heic' : null)
  if (!ext) return { ok: false, error: 'Use a photo (JPG, PNG, HEIC) or a PDF of the paper.' }
  if (file.size <= 0) return { ok: false, error: 'That file is empty.' }
  if (file.size > PAPER_SCAN_MAX_BYTES) return { ok: false, error: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is 8 MB. A phone photo at normal quality is fine.` }
  return { ok: true, ext }
}

export type PaperEntryRequest = {
  action: 'file'
  book_entry_id: string
  person_name: string
  person_id: string | null
  formValues: FormValues
  signer_printed_name: string
  signed_on_ymd: string
  attested: true
  skip_boxes: boolean
  scan: { base64: string; mime: string; filename: string } | null
}

/** Everything the function needs; `formValues` is dropped when the office skips the boxes. */
export function buildPaperEntryRequest(input: {
  bookEntryId: string
  personName: string
  personId: string | null
  values: FormValues
  signerPrintedName: string
  signedOnYmd: string
  skipBoxes: boolean
  scan: { base64: string; mime: string; filename: string } | null
}): PaperEntryRequest {
  return {
    action: 'file',
    book_entry_id: input.bookEntryId,
    person_name: input.personName.trim(),
    person_id: input.personId,
    formValues: input.skipBoxes ? {} : input.values,
    signer_printed_name: input.signerPrintedName.trim(),
    signed_on_ymd: input.signedOnYmd,
    attested: true,
    skip_boxes: input.skipBoxes,
    scan: input.scan,
  }
}

/** Can this be filed? The scan is required when the boxes are skipped (otherwise nothing is filed). */
export function paperEntryBlockers(input: { signerPrintedName: string; signedOnYmd: string; attested: boolean; hasScan: boolean; skipBoxes: boolean; anyValue: boolean }): string[] {
  const out: string[] = []
  if (!input.signerPrintedName.trim()) out.push('Who signed the paper (printed name).')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.signedOnYmd)) out.push('The date written on the paper.')
  if (!input.attested) out.push('Confirm you typed it exactly as written.')
  if (input.skipBoxes && !input.hasScan) out.push('Attach the scan when you skip the boxes, or there is nothing to file.')
  if (!input.skipBoxes && !input.anyValue && !input.hasScan) out.push('Type at least one answer or attach the scan.')
  return out
}

/** The boxes a staff member types into: everything the sub would, in order (constants and auto dates excluded). */
export function keyableBoxes(schema: FormSchema): FormBox[] {
  return [...schema.boxes].filter((b) => b.type !== 'constant' && b.type !== 'signature' && !(b.type === 'date' && (b.dateMode ?? 'today') === 'today')).sort((a, b) => a.order - b.order)
}
