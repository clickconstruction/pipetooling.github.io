/**
 * GC mode, the real build, the Board's B2: vetting a company new to us and the award gate (question 3), moved word for word
 * from the GC mode prototype (branch spike/gc-mode, `gcVetting.ts`).
 */
import { leveledTotal } from './bids'
import { partnerById } from './lookups'
import type { GcState, Invite, Partner, PartnerVetting, TradePackage } from './types'
import { money } from './words'

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

/** The award gate for one quote, at the price its statement of work would carry (the reducer's own test). */
export function awardGate(state: GcState, pkg: TradePackage, invite: Invite): { ok: boolean; why: string | null } {
  const partner = partnerById(state, invite.partnerId)
  if (!partner) return { ok: true, why: null }
  return canAward(partner, leveledTotal(pkg, invite) ?? pkg.budget)
}

/** Everyone on our team, for "who is deciding": the job teams' names, each once. */
export function ourTeam(state: GcState): string[] {
  return [...new Set(state.projects.flatMap((p) => p.team ?? []).map((c) => c.name))]
}
