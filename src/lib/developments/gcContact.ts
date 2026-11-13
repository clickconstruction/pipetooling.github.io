/**
 * The GC contact, edited in place on the Development page (the Gray Fox spike, 2026-11-02). The head reads
 * the contact off the newest bid that names one (`sitePeople`), and until now the only way to add or change
 * it was that bid's Edit tab. The sheet writes the three fields onto every bid of the site that carries no
 * contact or carries the one being changed, so the head reads it whichever bid is newest and no bid keeps a
 * stale name. A bid that names a different person keeps it. Pure.
 */
import type { MemberBid } from './overview'

export type GcContactValues = { name: string; phone: string | null; email: string | null }

export type GcContactBefore = { id: string; gc_contact_name: string | null; gc_contact_phone: string | null; gc_contact_email: string | null }

/** The bids the sheet writes to: those with no contact, and those carrying the contact being changed (by name). */
export function gcContactTargets(bids: readonly Pick<MemberBid, 'id' | 'gc_contact_name' | 'gc_contact_phone' | 'gc_contact_email'>[], current: { name: string } | null): GcContactBefore[] {
  const cur = (current?.name ?? '').trim().toLowerCase()
  return bids
    .filter((b) => {
      const name = (b.gc_contact_name ?? '').trim()
      return name.length < 2 || (cur !== '' && name.toLowerCase() === cur)
    })
    .map((b) => ({ id: b.id, gc_contact_name: b.gc_contact_name ?? null, gc_contact_phone: b.gc_contact_phone ?? null, gc_contact_email: b.gc_contact_email ?? null }))
}

/** A draft the sheet can send: a name of two letters or more; the phone and the email may be blank. */
export function gcContactDraftProblem(v: { name: string; email: string }): string | null {
  if (v.name.trim().length < 2) return 'The name needs two letters or more.'
  const e = v.email.trim()
  if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'The email does not read as one.'
  return null
}

export function gcContactValues(v: { name: string; phone: string; email: string }): GcContactValues {
  return { name: v.name.trim(), phone: v.phone.trim() || null, email: v.email.trim() || null }
}

/** The toast after the write: *Jane Doe is the GC contact on 15 bids.* */
export function gcContactDoneWords(name: string, count: number): string {
  return `${name} is the GC contact on ${count} ${count === 1 ? 'bid' : 'bids'}.`
}
