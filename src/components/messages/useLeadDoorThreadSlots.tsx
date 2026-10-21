/**
 * Punch list #140 PR 8: a lead's doors above the words of their thread (`threadSlots.tsx`'s `aboveLines`): **Book a
 * visit** and **Start an estimate**, with the hint that either takes them off Leads. Drawn only while the person is a
 * lead; the presses are `useLeadDoors`, run inside the slot's own component so it reads the open thread's lines for
 * their newest words. Modelled on R7's sort card (`useNewLaneThreadSlots`).
 */
import { useMemo, type CSSProperties } from 'react'
import type { Contact } from '../../lib/contacts/kernel'
import { LEAD_DOOR_WORDS, newestInboundWords } from '../../lib/messages/leadDoors'
import type { LeadDoorsIo } from '../../lib/messages/leadDoorsIo'
import { useOpenThread } from '../gc/messages/openThread'
import type { ThreadSlots } from '../gc/messages/threadSlots'
import { useLeadDoors } from './useLeadDoors'

export type LeadDoorThreadSlots = Pick<ThreadSlots, 'aboveLines'>

const strip: CSSProperties = { display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.45rem 0.9rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-blue-tint)', fontSize: '0.85rem' }
const door: CSSProperties = { border: '1px solid var(--border-strong)', borderRadius: 999, padding: '0.25rem 0.7rem', background: 'var(--surface)', color: 'var(--text-link)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', font: 'inherit' }

export function LeadDoorsAbove({ contact, io }: { contact: Contact; io?: LeadDoorsIo }) {
  const open = useOpenThread()
  const doors = useLeadDoors(io)
  const words = newestInboundWords(open?.lines ?? [], contact.id)
  const target = { contactId: contact.id, contact, words }
  const busy = doors.pressing !== null
  return (
    <div data-lead-doors style={strip}>
      <button type="button" style={door} title={LEAD_DOOR_WORDS.bookTip} disabled={busy} onClick={() => void doors.book(target)}>
        {LEAD_DOOR_WORDS.book}
      </button>
      <button type="button" style={door} title={LEAD_DOOR_WORDS.estimateTip} disabled={busy} onClick={() => void doors.startEstimate(target)}>
        {LEAD_DOOR_WORDS.estimate}
      </button>
      <span style={{ color: 'var(--text-muted)' }}>{LEAD_DOOR_WORDS.hint}</span>
    </div>
  )
}

export function useLeadDoorThreadSlots(io?: LeadDoorsIo): LeadDoorThreadSlots {
  return useMemo<LeadDoorThreadSlots>(
    () => ({ aboveLines: (c) => (c.kind === 'lead' ? <LeadDoorsAbove key={`lead-doors:${c.id}`} contact={c} io={io} /> : null) }),
    [io],
  )
}
