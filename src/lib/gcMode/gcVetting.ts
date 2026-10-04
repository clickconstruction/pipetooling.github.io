/**
 * GC mode — design spike: vetting a company we do not know (the owner, 2026-10-04, question 3).
 * Anyone can quote; award stays locked until the office approves them, or approves them up to a
 * dollar limit. A company with no vetting record is one we know: approved, no limit.
 */
import type { GcState, Partner, PartnerVetting } from './gcTypes'
import { money } from './gcWords'

const KNOWN: PartnerVetting = { status: 'approved' }

export function vettingOf(partner: Partner): PartnerVetting {
  return partner.vetting ?? KNOWN
}

/** Can we award this company work worth `amount`? `why` says what stops it, in a sentence. */
export function canAward(partner: Partner, amount: number): { ok: boolean; why: string | null } {
  const v = vettingOf(partner)
  if (v.status === 'new') {
    return {
      ok: false,
      why: v.form
        ? `${partner.company} is not vetted yet. Their form came in. Approve them on Trade partners first.`
        : `${partner.company} is not vetted yet. They have not sent their form.`,
    }
  }
  if (v.status === 'declined') return { ok: false, why: `We declined ${partner.company}${v.note ? `: ${v.note}` : ''}.` }
  if (v.limit !== undefined && amount > v.limit) {
    return { ok: false, why: `${partner.company} is approved up to ${money(v.limit)}. This award is ${money(amount)}.` }
  }
  return { ok: true, why: null }
}

/** A chip's words: "not vetted yet", "approved up to $250,000", "declined". Empty for a plain approval. */
export function vettingWords(partner: Partner): string {
  const v = vettingOf(partner)
  if (v.status === 'new') return v.form ? 'not vetted yet · form in' : 'not vetted yet'
  if (v.status === 'declined') return 'declined'
  return v.limit !== undefined ? `approved up to ${money(v.limit)}` : ''
}

/** Companies waiting on the office's decision, the ones whose form came in first, oldest form first. */
export function partnersToVet(state: GcState): Partner[] {
  return state.partners
    .filter((p) => vettingOf(p).status === 'new')
    .sort((a, b) => {
      const fa = a.vetting?.form?.sentOn
      const fb = b.vetting?.form?.sentOn
      if (fa && fb) return fa.localeCompare(fb)
      if (fa) return -1
      if (fb) return 1
      return a.company.localeCompare(b.company)
    })
}
