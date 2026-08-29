/**
 * Scope-sheet kernel — estimator-twin pipeline Wave 4.2 (+ RFI_LOOP_PLAN R5).
 *
 * Turns the plan substrate's note flags and the bid's open RFIs into SUGGESTED letter
 * lines — suggestions only, never auto-applied (the loss-reason doctrine): a human (or
 * the twin drafting for one) reads each suggestion against the letter and decides.
 * Open RFIs are the hard rule: RFIs are non-blocking, so any RFI still open when the
 * letter goes out MUST surface as an explicit assumption or exclusion.
 */

import type { RfiRow } from './rfiFlow'

export type SubstrateNoteLike = {
  category?: string
  text?: { value?: string } | string
  flags?: string[]
}

export type ScopeSuggestion = {
  kind: 'exclusion' | 'assumption' | 'risk'
  text: string
  source: string
}

function noteText(n: SubstrateNoteLike): string {
  if (typeof n.text === 'string') return n.text
  return n.text?.value ?? ''
}

/** Substrate note flags → suggested letter lines. Flag semantics per docs/twins/SUBSTRATE.md. */
export function substrateNotesToSuggestions(
  notes: Array<SubstrateNoteLike & { source_sheet?: string }>
): ScopeSuggestion[] {
  const out: ScopeSuggestion[] = []
  for (const n of notes) {
    const flags = n.flags ?? []
    const text = noteText(n).trim()
    if (!text) continue
    const source = n.source_sheet ? String(n.source_sheet) : (n.category ?? 'plans')
    if (flags.includes('exclusion_candidate')) {
      out.push({ kind: 'exclusion', text, source })
    } else if (flags.includes('certification_required') || flags.includes('risk')) {
      out.push({ kind: 'risk', text, source })
    }
  }
  return out
}

/** Open RFIs → the assumption lines the letter is REQUIRED to carry (R5). */
export function openRfiAssumptions(
  rfis: Array<Pick<RfiRow, 'rfi_number' | 'question' | 'status' | 'answer'>>
): ScopeSuggestion[] {
  return rfis
    .filter((r) => r.status === 'draft' || r.status === 'approved' || r.status === 'sent')
    .map((r) => ({
      kind: 'assumption' as const,
      text: `Pending RFI-${r.rfi_number}${r.status === 'sent' ? ' (sent, unanswered)' : ' (not yet sent)'}: ${r.question}`,
      source: `RFI-${r.rfi_number}`,
    }))
}
