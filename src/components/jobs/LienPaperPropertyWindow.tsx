import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { formatErrorMessage } from '../../utils/errorHandling'
import CustomerPropertyRecordPanel from '../customers/CustomerPropertyRecordPanel'
import { draftFromRow, emptyPropertyDraft, payloadFromDraft, type PropertyDraft } from '../../lib/customers/propertyDraft'
import { cleanStoredAddress } from '../../lib/displayAddress'
import type { CustomerAddressRow } from '../../lib/jobs/lienProperty'
import type { LienPaperGap } from '../../lib/jobs/lienPaperGaps'
import type { LienDeskJob } from '../../hooks/useLienDeskData'

/**
 * Fix it from the paper (v2.4719, Taunya's ask): the property record in a window stacked over
 * the paper preview. Every property blank the paper names (county, legal description, owner of
 * record and the owner's address) is here at once, the parcel lookup runs on open when the row
 * was never looked up, and the field she pressed is focused. A job with no property linked saves
 * the job address as one on its customer (or its GC when there is no customer) and links it.
 * Done, ×, Esc and the backdrop all save; Discard throws the typing away. The parent reloads
 * the desk, so the paper redraws behind with the new values marked.
 */
type Props = {
  /** The job's own facts; the desk's row or Edit Job's form (v2.4724). */
  job: Pick<LienDeskJob, 'id' | 'job_address' | 'customer_id' | 'gc_customer_id'>
  address: CustomerAddressRow | null
  /** A linked record known only by id (Edit Job holds a slim copy): the window reads the whole row before it draws, so a save never blanks the columns the slim copy lacks. */
  loadAddressId?: string | null
  /** The job names its own owner (Edit Job's owner block), which wins over the record on the paper. */
  ownerOnJob: boolean
  /** The blank she pressed, focused on open. */
  focus: LienPaperGap['key']
  /** Above the Lien desk's paper (805) by default; Edit Job inside the Job window passes its own. */
  zIndex?: number
  /** Saved hands back the row as written, so a caller holding the record (Edit Job) can redraw it. */
  onClose: (saved: boolean, row?: CustomerAddressRow) => void
}

const FOCUS_LABEL: Partial<Record<LienPaperGap['key'], string>> = {
  county: 'Property county',
  legal: 'Property legal description',
  owner: 'Owner of record name',
  owner_address: 'Owner mailing address',
}

const btn: CSSProperties = { padding: '0.35rem 0.9rem', fontSize: '0.8125rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontWeight: 600, cursor: 'pointer' }
const note: CSSProperties = { fontSize: '0.76rem', color: 'var(--text-muted)', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 7, padding: '0.4rem 0.6rem', lineHeight: 1.45 }

export default function LienPaperPropertyWindow({ job, address: givenAddress, loadAddressId = null, ownerOnJob, focus, onClose, zIndex = 805 }: Props) {
  // On the modal stack, so the window underneath (Edit Job, the Job window) leaves Esc to this one.
  useModalStackEntry()
  const { showToast } = useToastContext()
  const jobAddress = cleanStoredAddress(job.job_address)
  const [address, setAddress] = useState<CustomerAddressRow | null>(givenAddress)
  const loading = Boolean(loadAddressId) && !address
  const [draft, setDraft] = useState<PropertyDraft>(() => (givenAddress ? draftFromRow(givenAddress) : emptyPropertyDraft(jobAddress)))
  useEffect(() => {
    if (!loadAddressId || givenAddress) return
    let live = true
    void supabase
      .from('customer_addresses')
      .select('*')
      .eq('id', loadAddressId)
      .single()
      .then(({ data, error }) => {
        if (!live) return
        if (error || !data) {
          showToast(formatErrorMessage(error, 'Could not read the property record'), 'error')
          onClose(false)
          return
        }
        const row = data as CustomerAddressRow
        setAddress(row)
        setDraft(draftFromRow(row))
      })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadAddressId, givenAddress])
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [otherJobs, setOtherJobs] = useState<number | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const homeId = job.customer_id ?? job.gc_customer_id
  const homeIsGc = !job.customer_id && Boolean(job.gc_customer_id)

  useEffect(() => {
    if (!address) return
    let live = true
    void supabase
      .from('jobs_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('customer_address_id', address.id)
      .neq('id', job.id)
      .then(({ count }) => {
        if (live) setOtherJobs(count ?? 0)
      })
    return () => {
      live = false
    }
  }, [address, job.id])

  // The pressed blank's field, focused once the panel is drawn.
  useEffect(() => {
    if (loading) return
    const label = FOCUS_LABEL[focus]
    const el = label ? bodyRef.current?.querySelector<HTMLElement>(`[aria-label="${label}"]`) : null
    el?.focus()
  }, [focus, loading])

  const save = async (): Promise<CustomerAddressRow | null> => {
    if (!dirty) return null
    if (!draft.address.trim()) {
      showToast('The property needs its address before it can be saved.', 'error')
      return null
    }
    setBusy(true)
    try {
      if (address) {
        const { data, error } = await supabase.from('customer_addresses').update(payloadFromDraft(draft)).eq('id', address.id).select('*').single()
        if (error) throw error
        showToast(`Property record saved for ${draft.address.trim()}.`, 'success')
        return (data as CustomerAddressRow | null) ?? { ...address, ...payloadFromDraft(draft) }
      }
      if (!homeId) {
        showToast('This job has no customer or GC to hold the property. Set one in Edit Job first.', 'error')
        return null
      }
      const { count } = await supabase.from('customer_addresses').select('id', { count: 'exact', head: true }).eq('customer_id', homeId)
      const { data, error } = await supabase
        .from('customer_addresses')
        .insert({ customer_id: homeId, ...payloadFromDraft(draft), sequence_order: count ?? 0 })
        .select('*')
        .single()
      if (error || !data) throw error ?? new Error('no row came back')
      const row = data as CustomerAddressRow
      const link = await supabase.from('jobs_ledger').update({ customer_address_id: row.id }).eq('id', job.id)
      if (link.error) throw link.error
      showToast(`Property saved and linked to this job.`, 'success')
      return row
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the property'), 'error')
      return null
    } finally {
      setBusy(false)
    }
  }

  const closeSaving = async () => {
    if (busy) return
    if (!dirty) return onClose(false)
    const row = await save()
    if (row) onClose(true, row)
  }
  const closeRef = useRef(closeSaving)
  closeRef.current = closeSaving

  // Esc closes this window alone (and keeps the typing); the paper underneath is paused while it is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      e.preventDefault()
      void closeRef.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const title = address ? `The property · ${address.address}` : `The property · ${jobAddress || 'no address on the job'}`
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="The property record"
      data-testid="lien-paper-property-window"
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget) void closeSaving()
      }}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 'var(--app-bottom-chrome, 0px)', paddingTop: 'var(--app-top-chrome, 0px)', background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 10, width: 'min(560px, calc(100vw - 2rem))', maxHeight: 'calc(100dvh - 3rem - var(--app-top-chrome, 0px) - var(--app-bottom-chrome, 0px))', display: 'grid', gridTemplateRows: 'auto 1fr auto', overflow: 'hidden', boxShadow: '0 18px 50px rgba(0,0,0,0.45)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.9rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{title}</h2>
          <button type="button" aria-label="Close and save" onClick={() => void closeSaving()} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)', padding: '2px 6px', lineHeight: 1 }}>×</button>
        </div>
        <div ref={bodyRef} style={{ overflow: 'auto', minHeight: 0, padding: '0.75rem 0.9rem', display: 'grid', gap: '0.6rem' }}>
          {address ? (
            otherJobs ? (
              <div style={note} data-testid="lien-paper-property-shared">
                This record is shared. <strong>{otherJobs} other {otherJobs === 1 ? 'job sits' : 'jobs sit'}</strong> at this address, and their papers read it too.
              </div>
            ) : null
          ) : loadAddressId ? null : (
            <div style={note} data-testid="lien-paper-property-new">
              No property is linked to this job yet. Saving keeps <strong>{jobAddress || 'this address'}</strong> as a property on the {homeIsGc ? 'GC' : 'customer'} and links the job to it.
            </div>
          )}
          {ownerOnJob ? (
            <div style={{ ...note, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }}>
              This job names its own owner in Edit Job. The paper reads that owner, not the one below.
            </div>
          ) : null}
          {loading ? <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Reading the property record…</p> : <CustomerPropertyRecordPanel
            address={draft.address}
            fields={draft}
            onChange={(patch) => {
              setDraft((d) => ({ ...d, ...patch }))
              setDirty(true)
            }}
            autoLookup={draft.address.trim().length > 0}
            pasteFirst
          />}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 0.9rem', borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Closing keeps what you typed.</span>
          <span style={{ display: 'flex', gap: '0.4rem' }}>
            <button type="button" data-testid="lien-paper-property-discard" disabled={busy} onClick={() => onClose(false)} style={btn}>
              Discard
            </button>
            <button type="button" data-testid="lien-paper-property-done" disabled={busy} onClick={() => void closeSaving()} style={{ ...btn, background: '#2563eb', borderColor: '#2563eb', color: '#fff' }}>
              {busy ? 'Saving…' : 'Done'}
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
