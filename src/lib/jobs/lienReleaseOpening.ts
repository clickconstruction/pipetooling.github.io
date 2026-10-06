/**
 * The Release of Lien window's opening (punch list #87 I): which bill lines a release can
 * cover, which ones the window selects when it opens, and the form it opens on. Pure; the
 * window applies the answer in its open-reset effect.
 *
 * A paid bill is a line a release can cover. It is what an unconditional waiver is for: the
 * Bill tab's *Add the unconditional ›* opens the window on a settled bill, and a bill paid in
 * full is marked paid (`mark_invoice_paid`). Before #87 the window kept only billed and
 * ready-to-bill lines, so it opened on *Conditional · progress* without that bill.
 */
import { lienWaiverFormFrom, type LienWaiverFormType } from '../jobsDocuments/lienWaiverRelease'
import { isConditionalLienForm } from './lienReleaseTracking'

/** The bill-line fields the opening reads. */
export type LienReleaseBillLine = { id: string; status?: string | null; sequence_order: number }

/** Bill lines a release can cover: every line minted for billing (billed, ready to bill or paid), in bill order. */
export function lienReleaseSelectableInvoices<T extends LienReleaseBillLine>(invoices: readonly T[] | null | undefined): T[] {
  return (invoices ?? [])
    .filter((i) => i.status === 'billed' || i.status === 'ready_to_bill' || i.status === 'paid')
    .slice()
    .sort((a, b) => a.sequence_order - b.sequence_order)
}

/** A bill line's state as the window's chip names it on hover. */
export function lienReleaseBillStatusWord(status: string | null | undefined): string {
  if (status === 'paid') return 'Paid'
  if (status === 'billed') return 'Billed'
  return 'Ready to bill'
}

/** The conditional form of the same kind: a final stays a final. */
export function conditionalFormOf(formType: LienWaiverFormType): LienWaiverFormType {
  return lienWaiverFormFrom({ conditional: true, final: formType.endsWith('final') })
}

export type LienReleaseOpening = {
  /** The bill lines the window selects. */
  invoiceIds: string[]
  formType: LienWaiverFormType
  /**
   * The v2.4582 question, asked as the window opens on an unconditional form. `preset`: the opener
   * asked for the unconditional (Stay conditional closes the window); otherwise the bill picked it
   * (Stay conditional steps back to `fallback`). Null on a conditional form.
   */
  askUnconditional: { preset: boolean; fallback: LienWaiverFormType } | null
}

/**
 * What a freshly opened window selects and opens on. A named bill the window can cover is selected
 * alone, and picks its own form unless the opener named one. With no bill named, or one the window
 * cannot cover, the window selects the billed lines, else the ready-to-bill ones. A paid line is never
 * selected unasked: it is selectable so an unconditional can name it.
 */
export function lienReleaseOpening(input: {
  selectable: readonly LienReleaseBillLine[]
  /** The row's bill: the line the opener was on. */
  invoiceId?: string | null
  /** The form the opener asked for (Issue unconditional's follow-up), else the bill picks. */
  initialFormType?: LienWaiverFormType | null
  /** The bill's own pick (`pickLienWaiverForBill(job, bill).formType`). */
  formForBill: (invoiceId: string) => LienWaiverFormType
}): LienReleaseOpening {
  const preset = input.initialFormType ?? null
  let formType: LienWaiverFormType = preset ?? 'conditional_progress'
  let askUnconditional: LienReleaseOpening['askUnconditional'] = preset && !isConditionalLienForm(preset) ? { preset: true, fallback: conditionalFormOf(preset) } : null
  const named = input.invoiceId ?? null
  if (named && input.selectable.some((i) => i.id === named)) {
    if (!preset) {
      const picked = input.formForBill(named)
      formType = picked
      if (!isConditionalLienForm(picked)) askUnconditional = { preset: false, fallback: conditionalFormOf(picked) }
    }
    return { invoiceIds: [named], formType, askUnconditional }
  }
  const billed = input.selectable.filter((i) => i.status === 'billed')
  const fallback = billed.length > 0 ? billed : input.selectable.filter((i) => i.status !== 'paid')
  return { invoiceIds: fallback.map((i) => i.id), formType, askUnconditional }
}
