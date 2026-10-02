/**
 * Who answered, when the office types a reviewer's decision (Submittals stage 5b): a person
 * already on the room, the bid's GC, one of the GC's contacts on file, or someone else with a
 * name and, if the office has one, an email. One row's answer window and the whole-submittal
 * approval both ask it the same way (`reviewerPick.ts`).
 *
 * Entering a call writes records and sends nothing, and the picker says so where the email is
 * typed: the address is how the room knows the person, and the room never shows it.
 */
import type { CSSProperties } from 'react'

import { ROOM_ROLE_LABELS, ROOM_ROLES, type RoomRole } from '../../../supabase/functions/_shared/submittalRoomPayload'
import { contactsOffered, gcOffered, NO_REVIEWER_SOURCES, type ReviewerPick, type ReviewerSources } from '../../lib/submittals/reviewerPick'
import type { SubmittalPersonRow } from '../../lib/submittals/submittalRoom'

const quiet: CSSProperties = { flex: '1 1 100%', fontSize: '0.75rem', color: 'var(--text-muted)' }
const field: CSSProperties = { padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, font: 'inherit', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-strong)' }

export function SubmittalReviewerPicker({ people, value, onChange, sources = NO_REVIEWER_SOURCES }: { people: ReadonlyArray<SubmittalPersonRow>; value: ReviewerPick; onChange: (next: ReviewerPick) => void; /** the bid's GC and its contacts on file */ sources?: ReviewerSources }) {
  const contacts = contactsOffered(people, sources)
  return (
    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
      <select aria-label="Who answered" value={value.person} onChange={(e) => onChange({ ...value, person: e.target.value })} style={{ ...field, maxWidth: '100%' }}>
        {people.filter((p) => !p.closed_at).map((p) => (
          <option key={p.id} value={p.id}>{p.name} · {ROOM_ROLE_LABELS[(p.role as RoomRole) ?? 'other'] ?? p.role}</option>
        ))}
        {gcOffered(people, sources) ? <option value="gc">{sources.gcName?.trim()} · the GC on this bid</option> : null}
        {contacts.map((c) => (
          <option key={c.id} value={`contact:${c.id}`}>{c.name.trim()}{sources.gcName?.trim() ? ` · at ${sources.gcName.trim()}` : ''}</option>
        ))}
        <option value="new">Someone else…</option>
      </select>
      {value.person === 'new' ? (
        <>
          <input aria-label="Reviewer name" placeholder="Name" value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} style={{ ...field, flex: 1, minWidth: 120 }} />
          <input aria-label="Reviewer email" placeholder="their email, if you have it" type="email" value={value.email} onChange={(e) => onChange({ ...value, email: e.target.value })} style={{ ...field, flex: 1.4, minWidth: 160 }} />
          <select aria-label="Reviewer role" value={value.role} onChange={(e) => onChange({ ...value, role: e.target.value as RoomRole })} style={field}>
            {ROOM_ROLES.map((r) => <option key={r} value={r}>{ROOM_ROLE_LABELS[r]}</option>)}
          </select>
        </>
      ) : null}
      <span style={quiet} data-testid="reviewer-no-contact">
        Only for the record. Nobody is emailed or contacted.
        {value.person === 'new' ? ' The email is optional. It stays in the office. It tells the room who they are if they open it later.' : ''}
      </span>
    </div>
  )
}
