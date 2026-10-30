/**
 * Supply-house bill capture (punch list #179 PR 2, v2.6088): the read, as the app holds it. The schema the function
 * asks with, the answer read into cents and a kind, the request it takes and its words live in
 * `supabase/functions/_shared/billRead.ts`, which this file re-exports (the way `documents/folderName.ts` re-exports
 * `whereFilesGo.ts`), so the function and the form read one definition. What is the app's alone is here: each form
 * field with where its value came from, and the shape the invoice row keeps (`supply_house_invoices.bill_read`).
 *
 * The words read, guessed and typed live in this shape and nowhere on a screen (Taunya, 2026-10-29). The form shows
 * three looks instead: green from the paper, amber a guess with a sentence, plain yours to set.
 */
import type { BillChecks } from './billChecks'

export * from '../../../../supabase/functions/_shared/billRead'
import type { BillLine, BillRead } from '../../../../supabase/functions/_shared/billRead'

/**
 * Where a field's value came from: `read`, printed on the paper and quoted; `guessed`, worked out from what the app
 * holds, with the why; `typed`, a person set or changed it; `none`, the paper could not answer it and nobody has.
 */
export type BillSource = 'read' | 'guessed' | 'typed' | 'none'

export interface BillField {
  value: string
  source: BillSource
  /** One sentence saying where a guess came from; null for the other sources. */
  why: string | null
}

/** The form's fields the fill can touch, by the names the write uses. */
export type BillFieldKey = 'kind' | 'number' | 'date' | 'amount' | 'purchaseOrder' | 'job' | 'onJobAccount' | 'dueDate' | 'creditsInvoice' | 'link'

export const BILL_FIELD_KEYS: readonly BillFieldKey[] = ['kind', 'number', 'date', 'amount', 'purchaseOrder', 'job', 'onJobAccount', 'dueDate', 'creditsInvoice', 'link']

export type BillFields = Record<BillFieldKey, BillField>

/** The read as the invoice row keeps it: `supply_house_invoices.bill_read`. Versioned so a later reader knows the shape. */
export interface BillRowRead {
  v: 1
  model: string
  /** When the model read it, ISO. */
  readAt: string
  /** The `supply_bill_reads` row, when the function wrote one. */
  readId: string | null
  file: { path: string; name: string; mime: string | null; attachmentId: string | null }
  /** The house on the letterhead, as read. */
  houseName: string
  fields: BillFields
  /** The lines as the paper printed them. The form never shows them; a later look reads them here. */
  lines: BillLine[]
  totals: { subtotalCents: number | null; taxCents: number | null; totalCents: number | null }
  checks: BillChecks
  notes: string
}

export function field(value: string, source: BillSource, why: string | null = null): BillField {
  return { value, source, why }
}

/** A field nobody and no paper has answered. */
export const EMPTY_FIELD: BillField = { value: '', source: 'none', why: null }

/** The row's read, assembled at Save from the model's answer, the fill's fields as they stand, and the checks. */
export function billRowRead(args: {
  read: BillRead
  model: string
  readAt: string
  readId: string | null
  file: BillRowRead['file']
  fields: BillFields
  checks: BillChecks
}): BillRowRead {
  const { read } = args
  return {
    v: 1,
    model: args.model,
    readAt: args.readAt,
    readId: args.readId,
    file: args.file,
    houseName: read.houseName,
    fields: args.fields,
    lines: read.lines,
    totals: { subtotalCents: read.subtotalCents, taxCents: read.taxCents, totalCents: read.totalCents },
    checks: args.checks,
    notes: read.notes,
  }
}

/** A field a person changed keeps their value and is marked so; the fill never writes over it. */
export function typedOver(fields: BillFields, key: BillFieldKey, value: string): BillFields {
  return { ...fields, [key]: field(value, 'typed') }
}

/** How many fields a person typed over, for the count line. */
export function typedCount(fields: BillFields): number {
  return BILL_FIELD_KEYS.filter((k) => fields[k].source === 'typed').length
}

/** How many fields are still a guess waiting for a look, for the count line. */
export function guessCount(fields: BillFields): number {
  return BILL_FIELD_KEYS.filter((k) => fields[k].source === 'guessed').length
}
