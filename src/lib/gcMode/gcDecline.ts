/**
 * GC mode — design spike: why a company is out of an ask (the owner, 2026-10-04: "if I click one
 * of these buttons I would like to record a reason that stays with the job and the sub"). The
 * office picks a reason and may add their words; it shows on the job's Trades tab and on the
 * company's line on Trade partners.
 */
import type { DeclineReason, DeclineReasonNote, GcProject, GcState, Invite, TradePackage } from './gcTypes'
import { shortDate } from './gcWords'

export const DECLINE_REASONS: { key: DeclineReason; label: string }[] = [
  { key: 'busy', label: 'too busy' },
  { key: 'far', label: 'too far' },
  { key: 'size', label: 'too big or too small' },
  { key: 'scope', label: 'not their kind of work' },
  { key: 'terms', label: 'our terms, bonding or insurance' },
  { key: 'other', label: 'something else' },
]

export function declineReasonLabel(reason: DeclineReason): string {
  return DECLINE_REASONS.find((r) => r.key === reason)?.label ?? reason
}

/** "too busy: crews are on a hospital job". The note alone when the reason is 'other'. */
export function declineReasonWords(r: DeclineReasonNote): string {
  if (r.reason === 'other') return r.note || declineReasonLabel('other')
  return r.note ? `${declineReasonLabel(r.reason)}: ${r.note}` : declineReasonLabel(r.reason)
}

/** The log's words: 'too busy, "both crews are on a school job"', or their words alone for 'other'. */
export function declineLogWords(reason: DeclineReason, note: string): string {
  if (reason === 'other') return note ? `"${note}"` : declineReasonLabel('other')
  return note ? `${declineReasonLabel(reason)}, "${note}"` : declineReasonLabel(reason)
}

/** The chip's words for a company that is out: "will not do it · too busy", or "passed" from their portal. */
export function declinedWords(invite: Invite): string {
  const head = invite.declinedWhy === 'wont' ? 'will not do it' : invite.declinedWhy === 'cant' ? 'cannot do it' : 'passed'
  return invite.declineReason ? `${head} · ${declineReasonLabel(invite.declineReason.reason)}` : head
}

/** The hover's sentence: the reason in full and the day it was written down. */
export function declinedTitle(invite: Invite): string | undefined {
  const r = invite.declineReason
  return r ? `${declineReasonWords(r)}. Written down ${shortDate(r.on)}.` : undefined
}

export interface PartnerDecline {
  project: GcProject
  pkg: TradePackage
  invite: Invite
}

/** Every ask a company is out of, with a reason written down, newest first: their record on Trade partners. */
export function partnerDeclines(state: GcState, partnerId: string): PartnerDecline[] {
  const out: PartnerDecline[] = []
  for (const project of state.projects) {
    for (const pkg of project.packages) {
      for (const invite of pkg.invites) {
        if (invite.partnerId === partnerId && invite.status === 'declined' && invite.declineReason) out.push({ project, pkg, invite })
      }
    }
  }
  return out.sort((a, b) => (b.invite.declineReason?.on ?? '').localeCompare(a.invite.declineReason?.on ?? ''))
}
