/**
 * Share a submittal revision (Submittals stage 4a — decisions 8–12): mints the bid's one
 * review room on first use, shows the room link to copy into the email chain, takes the
 * people the office already knows (a personal link each; the room recognises their email
 * if they arrive through the GC's forward), and does two things before the revision goes
 * out — Done with this file on any untrimmed vendor PDF, and a package rebuild. Marks the
 * revision shared; earlier shared revisions read superseded. Nothing is emailed by the app
 * (the owner's switch is not built); the office sends the link its own way.
 */
import { useState, type CSSProperties } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { newRoomToken, roomLink, ROOM_ROLE_LABELS, type RoomRole, type SubmittalRoomRow } from '../../lib/submittals/submittalRoom'
import { ROOM_ROLES } from '../../../supabase/functions/_shared/submittalRoomPayload'
import type { SubmittalRevisionRow } from '../../lib/submittals/submittalRevision'

const db = supabase as unknown as SupabaseClient
const Z = 10070

const btn: CSSProperties = { padding: '0.4rem 0.8rem', background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', fontWeight: 500 }
const btnPrimary: CSSProperties = { ...btn, background: '#2563eb', borderColor: '#2563eb', color: 'white', fontWeight: 600 }
const fieldLabel: CSSProperties = { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const input: CSSProperties = { padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, font: 'inherit', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-strong)', minWidth: 0 }
const smallMuted: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }

type NewPerson = { name: string; email: string; role: RoomRole; watching: boolean }
const emptyPerson = (): NewPerson => ({ name: '', email: '', role: 'architect', watching: false })

export function SubmittalShareModal({
  bidId,
  revision,
  room,
  untrimmedFiles,
  onClose,
  onDoneWithFiles,
  onBuildPackage,
  onShared,
}: {
  bidId: string
  revision: SubmittalRevisionRow
  room: SubmittalRoomRow | null
  /** Vendor PDFs on the revision not yet trimmed to the pages on rows. */
  untrimmedFiles: number
  onClose: () => void
  /** Done with this file for every untrimmed file (the tab owns the trim). */
  onDoneWithFiles: () => Promise<void>
  /** Build (or rebuild) the package (the tab owns the render). */
  onBuildPackage: () => Promise<void>
  onShared: (room: SubmittalRoomRow) => void
}) {
  const { showToast } = useToastContext()
  const { user } = useAuth()
  const [people, setPeople] = useState<NewPerson[]>([emptyPerson()])
  const [doneFiles, setDoneFiles] = useState(untrimmedFiles > 0)
  const [rebuild, setRebuild] = useState(true)
  const [busy, setBusy] = useState(false)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const existingLink = room ? roomLink(origin, room.token) : null
  const filled = people.filter((p) => p.name.trim() && p.email.trim())
  const bad = people.filter((p) => (p.name.trim() || p.email.trim()) && !(p.name.trim() && /\S+@\S+\.\S+/.test(p.email.trim())))

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      showToast('Link copied.', 'success')
    } catch {
      showToast(text, 'info')
    }
  }

  async function share() {
    if (bad.length > 0) {
      showToast('Each named person needs a name and an email.', 'error')
      return
    }
    setBusy(true)
    try {
      if (doneFiles && untrimmedFiles > 0) await onDoneWithFiles()
      if (rebuild) await onBuildPackage()
      const now = new Date().toISOString()
      let theRoom = room
      if (!theRoom) {
        const { data, error } = await db.from('bid_submittal_rooms').insert({ bid_id: bidId, token: newRoomToken(), status: 'open', shared_by: user?.id ?? null, shared_at: now }).select('*').single()
        if (error) throw error
        theRoom = data as SubmittalRoomRow
      } else if (!theRoom.shared_at) {
        const { error } = await db.from('bid_submittal_rooms').update({ shared_by: user?.id ?? null, shared_at: now }).eq('id', theRoom.id)
        if (error) throw error
        theRoom = { ...theRoom, shared_at: now, shared_by: user?.id ?? null }
      }
      if (filled.length > 0) {
        // The room's uniqueness is on lower(email) — an expression, which PostgREST's
        // on_conflict cannot name — so read who is already in and insert only the new.
        const { data: already, error: readErr } = await db.from('bid_submittal_people').select('email').eq('room_id', (theRoom as SubmittalRoomRow).id)
        if (readErr) throw readErr
        const have = new Set(((already ?? []) as Array<{ email: string }>).map((p) => p.email.toLowerCase()))
        const fresh = filled.filter((p) => !have.has(p.email.trim().toLowerCase()))
        if (fresh.length > 0) {
          const { error } = await db.from('bid_submittal_people').insert(
            fresh.map((p) => ({ room_id: (theRoom as SubmittalRoomRow).id, name: p.name.trim(), email: p.email.trim().toLowerCase(), role: p.role, may_decide: !p.watching, token: newRoomToken(), how: 'named', invited_by: user?.id ?? null })),
          )
          if (error) throw error
        }
      }
      // Earlier shared revisions read superseded; this one reads shared.
      const { error: supErr } = await db.from('bid_submittals').update({ status: 'superseded' }).eq('bid_id', bidId).eq('status', 'shared').neq('id', revision.id)
      if (supErr) throw supErr
      const { error: revErr } = await db.from('bid_submittals').update({ status: 'shared', shared_at: now, shared_by: user?.id ?? null }).eq('id', revision.id)
      if (revErr) throw revErr
      await db.from('bid_submittal_events').insert({ room_id: theRoom.id, submittal_id: revision.id, event_type: 'shared', metadata: { rev_number: revision.rev_number, named: filled.length, by: user?.id ?? null } })
      // Stage 5a: the thread reads the share as a line of its own, so the record says when each revision went up.
      await db.from('bid_submittal_messages').insert({ room_id: theRoom.id, submittal_id: revision.id, person_id: null, author_kind: 'system', author_user_id: user?.id ?? null, body: `Rev ${revision.rev_number} is up.`, kind: 'shared', tags: [], metadata: { rev_number: revision.rev_number } })
      // 6c · every shared package is filed in the bid's job folder on Drive — fire-and-forget; the tab reads the link back.
      try {
        void supabase.functions.invoke('file-submittal-package', { body: { submittal_id: revision.id } }).catch(() => {})
      } catch {
        /* a checkout without the function client — the tab's File in Drive still works */
      }
      onShared(theRoom)
      await copy(roomLink(origin, theRoom.token))
    } catch (e) {
      const msg = e && typeof e === 'object' && 'message' in e && typeof (e as { message?: unknown }).message === 'string' ? (e as { message: string }).message : ''
      showToast(msg ? `Could not share the revision — ${msg}` : 'Could not share the revision.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: Z, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '1.5rem 1rem', overflowY: 'auto' }} role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label={`Share Rev ${revision.rev_number}`} style={{ background: 'var(--surface)', borderRadius: 8, maxWidth: 640, width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', padding: '1.1rem 1.25rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }} onMouseDown={(e) => e.stopPropagation()}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-strong)' }}>Share Rev {revision.rev_number} · the review room</h3>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--text-base)', lineHeight: 1.45 }}>
            One link for this bid, the same through every revision. Send it to the GC; they forward it wherever it needs to go. Anyone can read. To decide or ask, a person says who they are. Nothing about money, the builder&apos;s account or the supply houses is on the page.
          </p>
        </div>

        <div style={{ border: '1px solid var(--border-blue)', background: 'var(--bg-blue-tint)', borderRadius: 6, padding: '0.6rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <span style={fieldLabel}>The room link</span>
          {existingLink ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <code style={{ flex: 1, minWidth: 0, fontSize: '0.75rem', color: 'var(--text-strong)', overflowWrap: 'anywhere' }} data-testid="room-link">{existingLink}</code>
              <button type="button" onClick={() => void copy(existingLink)} style={btnPrimary}>Copy</button>
            </div>
          ) : (
            <span style={smallMuted}>Minted when you share — and copied to your clipboard.</span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <span style={fieldLabel}>Know a reviewer already? Name them · optional</span>
          {people.map((p, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr auto auto', gap: '0.4rem', alignItems: 'center' }}>
              <input aria-label={`Name ${i + 1}`} placeholder="Name" value={p.name} onChange={(e) => setPeople(people.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} style={input} />
              <input aria-label={`Email ${i + 1}`} placeholder="email" value={p.email} onChange={(e) => setPeople(people.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} style={input} />
              <select aria-label={`Role ${i + 1}`} value={p.role} onChange={(e) => setPeople(people.map((x, j) => (j === i ? { ...x, role: e.target.value as RoomRole } : x)))} style={input}>
                {ROOM_ROLES.map((r) => (
                  <option key={r} value={r}>{ROOM_ROLE_LABELS[r]}</option>
                ))}
              </select>
              <label style={{ ...smallMuted, display: 'flex', gap: 4, alignItems: 'center', whiteSpace: 'nowrap' }} title="Sees everything, decides nothing — the GC's PM, usually">
                <input type="checkbox" aria-label={`Watching ${i + 1}`} checked={p.watching} onChange={(e) => setPeople(people.map((x, j) => (j === i ? { ...x, watching: e.target.checked } : x)))} /> watching
              </label>
            </div>
          ))}
          <div>
            <button type="button" onClick={() => setPeople([...people, emptyPerson()])} style={{ ...btn, fontSize: '0.75rem' }}>+ another person</button>
          </div>
          <span style={smallMuted}>Each gets a personal link, and the room recognises the email if they arrive through the GC&apos;s forward. Anyone who identifies may decide until you flip them to watching.</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', border: '1px dashed var(--border-strong)', borderRadius: 6, padding: '0.5rem 0.7rem' }}>
          <span style={fieldLabel}>Before it goes</span>
          <label style={{ fontSize: '0.8125rem', color: 'var(--text-base)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={doneFiles} disabled={untrimmedFiles === 0} onChange={(e) => setDoneFiles(e.target.checked)} />
            {untrimmedFiles > 0 ? `Keep only the pages on rows for ${untrimmedFiles} file${untrimmedFiles === 1 ? '' : 's'}, let the rest go` : 'Every vendor file is already trimmed'}
          </label>
          <label style={{ fontSize: '0.8125rem', color: 'var(--text-base)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={rebuild} onChange={(e) => setRebuild(e.target.checked)} /> Rebuild the package so the room&apos;s download matches the rows
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.6rem' }}>
          <span style={smallMuted}>No email leaves the app — paste the link into the chain you are already in.</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={onClose} style={btn}>Not now</button>
            <button type="button" disabled={busy} onClick={() => void share()} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>
              {room?.shared_at ? `Share Rev ${revision.rev_number}` : `Share Rev ${revision.rev_number} · mint the link`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
