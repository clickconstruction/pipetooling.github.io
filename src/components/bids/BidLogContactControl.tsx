import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { withSupabaseRetry, formatErrorMessage } from '../../utils/errorHandling'
import { toDatetimeLocal, fromDatetimeLocal } from '../../utils/datetimeLocal'
import { ContactMethodQuickPicks } from '../shared/ContactMethodQuickPicks'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import {
  EMPTY_FOLLOWUP_PICK,
  bidFollowupColumns,
  bidIsParked,
  buildFollowupChangeEntry,
  followupDateLabel,
  followupDayStands,
  followupEntryColumns,
  followupReasonLabel,
  withFollowupSentence,
  type BidFollowupColumns,
  type FollowupPick,
} from '../../lib/bids/bidNextFollowup'
import { FollowupPickPanel, type FollowupPickPerson } from './FollowupPickPanel'

/**
 * Edit Bid → "Last Contact" (Per-GC bids Phase 1, docs/PER_GC_BID_PLAN.md): the raw
 * datetime field is gone on saved bids — a contact IS a `bids_submission_entries` row
 * (method required; the entries sync trigger derives `bids.last_contact` from method
 * entries). This control shows the derived value read-only and logs new contacts.
 * On multi-GC bids a GC picker attributes the entry (own GC = null, the ledger's rule).
 *
 * v2.4421 (punch list #80): a sent bid with no answer also shows its **call-again day**. Logging
 * a contact can set it (the same three questions as the Call queue), and **Set a day…** /
 * **Change…** moves it with no contact: a method-less note, so the clock above does not move.
 */

type GcOption = { id: string | null; name: string }

export function BidLogContactControl({
  bidId,
  lastContactLocal,
  onLogged,
  onOpenChange,
}: {
  bidId: string
  /** The form's datetime-local string ('' = never contacted). */
  lastContactLocal: string
  /** Sync the form state so Save writes the same value the trigger derives. */
  onLogged: (newLocal: string) => void
  /** Fires as the inline editor opens/closes — the parent form gates its own Save on it. */
  onOpenChange?: (open: boolean) => void
}) {
  const { showToast } = useToastContext()
  const { user: authUser } = useAuth()
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState<string | null>(null)
  const [whenLocal, setWhenLocal] = useState('')
  const [note, setNote] = useState('')
  const [gcOptions, setGcOptions] = useState<GcOption[] | null>(null)
  const [gcId, setGcId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // Call again (v2.4421): the bid's day off its row, the customer's people, and the pick in hand.
  const [bidRow, setBidRow] = useState<{ customer_id: string | null; bid_date_sent: string | null; outcome: string | null; last_contact: string | null } | null>(null)
  const [dayCols, setDayCols] = useState<BidFollowupColumns | null>(null)
  const [people, setPeople] = useState<Array<FollowupPickPerson & { customer_id: string }>>([])
  const [pick, setPick] = useState<FollowupPick>(EMPTY_FOLLOWUP_PICK)
  const [changingDay, setChangingDay] = useState(false)
  const todayYmd = todayYmdInAppTz()

  /** The bid's row: the derived last contact and the derived call-again day, read together. */
  async function readBid(): Promise<string | null> {
    const { data } = await supabase.from('bids').select('*').eq('id', bidId).maybeSingle()
    if (!data) return null
    setBidRow({ customer_id: data.customer_id ?? null, bid_date_sent: data.bid_date_sent ?? null, outcome: data.outcome ?? null, last_contact: data.last_contact ?? null })
    setDayCols(bidFollowupColumns(data))
    return data.last_contact ?? null
  }

  // A form submit while the editor is open would discard the half-entered contact —
  // keep the parent informed so it can gate its Save, and release it on unmount.
  useEffect(() => {
    onOpenChange?.(open)
    return () => onOpenChange?.(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // The form seeds from the board row, which can be stale (a contact logged since the last
  // board load) — refresh from the DB on open so Save can never write an old value back.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const lastContactIso = await readBid().catch(() => undefined)
      if (cancelled || lastContactIso === undefined) return
      onLogged(lastContactIso ? toDatetimeLocal(lastContactIso) : '')
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bidId])

  // The people a day can name: everyone on the bid's customer (and on the GC picked for a contact).
  const peopleCustomerId = gcId ?? bidRow?.customer_id ?? null
  useEffect(() => {
    if (!peopleCustomerId) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase.from('customer_contact_persons').select('id, customer_id, name, phone, note').eq('customer_id', peopleCustomerId).order('name')
      if (!cancelled && Array.isArray(data)) setPeople((prev) => [...prev.filter((p) => p.customer_id !== peopleCustomerId), ...(data as Array<FollowupPickPerson & { customer_id: string }>)])
    })()
    return () => {
      cancelled = true
    }
  }, [peopleCustomerId])
  const peopleHere = people.filter((p) => p.customer_id === peopleCustomerId)

  async function addPerson(name: string, phone: string): Promise<FollowupPickPerson | null> {
    if (!peopleCustomerId) return null
    try {
      const rows = await withSupabaseRetry(
        async () => supabase.from('customer_contact_persons').insert({ customer_id: peopleCustomerId, name, phone: phone || null }).select('id, customer_id, name, phone, note'),
        'add contact person',
      )
      const made = Array.isArray(rows) ? (rows[0] as (FollowupPickPerson & { customer_id: string }) | undefined) : undefined
      if (!made) throw new Error('nothing was saved')
      setPeople((prev) => [...prev, made])
      return made
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not add the person'), 'error')
      return null
    }
  }

  /** The day moved, or removed, with no contact: a method-less note in the log. */
  async function saveDay(next: FollowupPick) {
    if (!authUser?.id) {
      showToast('You must be signed in to change the date.', 'error')
      return
    }
    setSaving(true)
    try {
      const entry = buildFollowupChangeEntry({ bidId, userId: authUser.id, nowIso: new Date().toISOString(), pick: next, todayYmd })
      await withSupabaseRetry(async () => supabase.from('bids_submission_entries').insert(entry), 'save call-again date')
      await readBid()
      window.dispatchEvent(new Event('bid-gc-notes-changed'))
      showToast(next.ymd ? `Call again ${followupDateLabel(next.ymd, todayYmd)}.` : 'Call-again date removed.', 'success')
      setChangingDay(false)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the date'), 'error')
    } finally {
      setSaving(false)
    }
  }

  function openDayEditor() {
    const person = dayCols?.personId ? people.find((p) => p.id === dayCols.personId) : null
    setPick({ ymd: dayCols?.nextYmd ?? null, personId: person?.id ?? dayCols?.personId ?? null, personName: person?.name ?? null, reason: dayCols?.reason ?? null })
    setOpen(false)
    setChangingDay(true)
  }

  async function openEditor() {
    setOpen(true)
    setChangingDay(false)
    setPick(EMPTY_FOLLOWUP_PICK)
    setMethod(null)
    setNote('')
    setWhenLocal(toDatetimeLocal(new Date().toISOString()))
    setGcId(null)
    if (gcOptions === null) {
      // GC options only matter on multi-GC bids — versions with a customer override + recipients.
      const [vRes, rRes] = await Promise.all([
        supabase.from('bid_versions').select('customer_id').eq('bid_id', bidId).not('customer_id', 'is', null),
        supabase.from('bid_gc_recipients').select('customer_id, customers(name)').eq('bid_id', bidId),
      ])
      const ids = new Set<string>()
      for (const v of vRes.data ?? []) if (v.customer_id) ids.add(v.customer_id)
      type RecRow = { customer_id: string; customers: { name: string | null } | { name: string | null }[] | null }
      const names: Record<string, string> = {}
      for (const r of (rRes.data ?? []) as RecRow[]) {
        ids.add(r.customer_id)
        names[r.customer_id] = (Array.isArray(r.customers) ? r.customers[0]?.name : r.customers?.name) ?? '—'
      }
      const missing = [...ids].filter((id) => !names[id])
      if (missing.length > 0) {
        const { data } = await supabase.from('customers').select('id, name').in('id', missing)
        for (const c of data ?? []) names[c.id] = c.name ?? '—'
      }
      setGcOptions([{ id: null, name: "This bid's GC" }, ...[...ids].map((id) => ({ id, name: names[id] ?? '—' }))])
    }
  }

  async function save() {
    if (!method) {
      showToast('Pick how you reached them — a contact needs a method.', 'error')
      return
    }
    const iso = fromDatetimeLocal(whenLocal)
    if (!iso) {
      showToast('Pick when the contact happened.', 'error')
      return
    }
    setSaving(true)
    try {
      await withSupabaseRetry(
        async () =>
          supabase.from('bids_submission_entries').insert({
            bid_id: bidId,
            gc_customer_id: gcId,
            contact_method: method,
            // A picked day rides this row: its columns, and a plain sentence in the note.
            notes: (pick.ymd ? withFollowupSentence(note, pick, todayYmd) : note.trim()) || null,
            occurred_at: iso,
            created_by: authUser?.id ?? null,
            ...(pick.ymd ? followupEntryColumns(pick) : {}),
          }),
        'log bid contact',
      )
      // The entry insert fired the sync triggers — read the derived values back for the form.
      const derivedIso = (await readBid().catch(() => null)) ?? iso
      onLogged(toDatetimeLocal(derivedIso))
      window.dispatchEvent(new Event('bid-gc-notes-changed'))
      showToast('Contact logged.', 'success')
      setOpen(false)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not log the contact'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const multiGc = (gcOptions?.length ?? 0) > 1
  // A call-again day belongs to a sent bid still waiting on its answer.
  const tracksDay = bidRow != null && bidRow.bid_date_sent != null && bidRow.outcome == null
  // A day a later contact has spent is no day: the row shows it as unset.
  const dayStands = followupDayStands(dayCols?.nextYmd, bidRow?.last_contact ?? null)
  const parked = dayStands && bidRow != null && bidIsParked({ next_followup_on: dayCols?.nextYmd }, bidRow.last_contact, todayYmd)
  const dayPerson = dayCols?.personId ? people.find((p) => p.id === dayCols.personId) ?? null : null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ padding: '0.5rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-subtle)', fontSize: '0.875rem', color: lastContactLocal ? 'var(--text-strong)' : 'var(--text-muted)', flex: '1 1 auto', minWidth: '9rem' }}>
          {lastContactLocal ? lastContactLocal.replace('T', ' · ') : 'No contact logged yet'}
        </span>
        {!open ? (
          <button
            type="button"
            onClick={() => void openEditor()}
            style={{ font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, padding: '0.4rem 0.8rem', border: 'none', borderRadius: 5, background: '#3b82f6', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Log contact…
          </button>
        ) : null}
      </div>
      {open ? (
        <div style={{ marginTop: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0.6rem 0.7rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <ContactMethodQuickPicks onPick={(v) => setMethod(v)} />
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: method ? 'var(--text-strong)' : 'var(--text-muted)' }}>{method ?? 'How did you reach them?'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input type="datetime-local" value={whenLocal} onChange={(e) => setWhenLocal(e.target.value)} aria-label="When the contact happened" style={{ font: 'inherit', fontSize: '0.8125rem', padding: '0.3rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
            {multiGc ? (
              <select value={gcId ?? ''} onChange={(e) => setGcId(e.target.value || null)} aria-label="Which GC this contact was with" style={{ font: 'inherit', fontSize: '0.8125rem', padding: '0.3rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, maxWidth: '14rem' }}>
                {(gcOptions ?? []).map((o) => (
                  <option key={o.id ?? ''} value={o.id ?? ''}>{o.name}</option>
                ))}
              </select>
            ) : null}
          </div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was said (optional — lands in the bid's notes)" rows={2} style={{ font: 'inherit', fontSize: '0.8125rem', padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, resize: 'vertical' }} />
          {tracksDay ? (
            <FollowupPickPanel
              todayYmd={todayYmd}
              value={pick}
              onChange={setPick}
              people={peopleHere}
              onAddPerson={peopleCustomerId ? addPerson : undefined}
              saving={saving}
              actions={false}
              noDayHint={dayCols?.nextYmd ? 'No day picked: the bid keeps the day it has.' : 'No day picked: back in the call queue in 7 days.'}
            />
          ) : null}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setOpen(false)} disabled={saving} style={{ font: 'inherit', fontSize: '0.8125rem', padding: '0.35rem 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="button" onClick={() => void save()} disabled={saving || !method} style={{ font: 'inherit', fontSize: '0.8125rem', fontWeight: 700, padding: '0.35rem 0.9rem', border: 'none', borderRadius: 5, background: '#3b82f6', color: '#fff', cursor: saving ? 'wait' : 'pointer', opacity: !method ? 0.6 : 1 }}>
              {saving ? 'Logging…' : 'Log contact'}
            </button>
          </div>
        </div>
      ) : null}
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
        Contacts land in the bid's notes; only real contacts (with a method) move this clock.
      </div>
      {tracksDay ? (
        <div data-testid="bid-call-again" style={{ marginTop: '0.6rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8125rem' }}>
            <span style={{ fontWeight: 600 }}>Call again</span>
            <span style={{ color: dayStands ? 'var(--text-strong)' : 'var(--text-muted)' }}>
              {dayStands && dayCols?.nextYmd
                ? [
                    followupDateLabel(dayCols.nextYmd, todayYmd),
                    dayPerson ? `ask for ${dayPerson.name}` : null,
                    dayCols.reason && dayCols.reason !== 'other' ? followupReasonLabel(dayCols.reason) : null,
                    parked ? null : 'due',
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : 'No day set. The bid comes back to the call queue seven days after a contact.'}
            </span>
            {!changingDay ? (
              <button type="button" onClick={openDayEditor} style={{ font: 'inherit', fontSize: '0.75rem', padding: '0.2rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {dayStands ? 'Change…' : 'Set a day…'}
              </button>
            ) : null}
          </div>
          {changingDay ? (
            <FollowupPickPanel
              todayYmd={todayYmd}
              value={pick}
              onChange={setPick}
              people={peopleHere}
              onAddPerson={peopleCustomerId ? addPerson : undefined}
              saving={saving}
              saveLabel="Save the date"
              onSave={() => {
                if (pick.ymd) void saveDay(pick)
                else showToast('Pick a day to call again, or use No date.', 'error')
              }}
              onCancel={() => setChangingDay(false)}
              noDayHint="Pick a day. This is a note in the bid's log, not a contact."
              onRemove={dayStands ? () => void saveDay(EMPTY_FOLLOWUP_PICK) : undefined}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
