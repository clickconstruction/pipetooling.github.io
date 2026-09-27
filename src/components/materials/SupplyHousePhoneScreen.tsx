import { useEffect, useState, type CSSProperties } from 'react'
import { telHrefFor } from '../../lib/phoneContact'
import { ScheduleSheet, ScheduleSheetAction } from '../schedule/ScheduleBlockSheet'
import {
  supplyHouseInvoiceTabCounts,
  supplyHousePhoneInvoiceRows,
  type SupplyHouseCardMoney,
  type SupplyHouseInvoiceTab,
  type SupplyHousePhoneInvoice,
} from '../../lib/materials/supplyHousePhone'
import type { AgingBucketKey } from '../../lib/supplyHouseAging'

/**
 * A supply house on a phone (v2.3888, punch list #30 PR 5c): the screen held
 * during a call with the house — the balance and Call on top, the house's
 * notes editable in place, then its invoices as rows with one amount each. A
 * row's verbs are in one bottom sheet. The desk's expanded row is unchanged.
 */

export const AGING_SEGMENT_COLOR: Record<AgingBucketKey, string> = {
  current: '#86efac',
  past1_30: '#fde68a',
  past30_60: '#fdba74',
  past60_90: '#fca5a5',
  past90plus: '#ef4444',
  noDueDate: '#9ca3af',
}

export function SupplyHouseAgingBar({ money, height = 8 }: { money: SupplyHouseCardMoney; height?: number }) {
  if (money.segments.length === 0) return null
  return (
    <span aria-hidden title={money.segments.map((s) => `${s.label} $${Math.round(s.amount).toLocaleString('en-US')}`).join(' · ')} style={{ display: 'flex', width: '100%', height, borderRadius: height / 2, overflow: 'hidden', background: 'var(--bg-subtle)' }}>
      {money.segments.map((s) => (
        <span key={s.key} style={{ display: 'block', height: '100%', width: `${Math.max(3, s.share * 100)}%`, background: AGING_SEGMENT_COLOR[s.key] }} />
      ))}
    </span>
  )
}

const btn: CSSProperties = { minHeight: 44, padding: '0 0.9rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', whiteSpace: 'nowrap' }

export type SupplyHousePhoneScreenProps = {
  house: { id: string; name: string; phone: string | null; address: string | null; notes: string | null }
  money: SupplyHouseCardMoney | null
  loading: boolean
  invoices: ReadonlyArray<SupplyHousePhoneInvoice & { link?: string | null; payment_link?: string | null }>
  jobLabel: (jobId: string) => string
  todayYmd: string
  formatMoney: (n: number) => string
  onClose: () => void
  onEditHouse: () => void
  onAddInvoice: () => void
  onMakePayment: () => void
  onTogglePaid: (invoiceId: string) => void
  onEditInvoice: (invoiceId: string) => void
  /** Saves the house's notes; resolves true when they are stored. */
  onSaveNotes: (notes: string) => Promise<boolean>
}

export function SupplyHousePhoneScreen(props: SupplyHousePhoneScreenProps) {
  const { house, money, loading, invoices, jobLabel, todayYmd, formatMoney, onClose } = props
  const [tab, setTab] = useState<SupplyHouseInvoiceTab>('unpaid')
  const [sheetId, setSheetId] = useState<string | null>(null)
  const [notes, setNotes] = useState(house.notes ?? '')
  const [notesBusy, setNotesBusy] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)

  // A different house, or the stored notes changed under us: start from what is stored.
  useEffect(() => {
    setNotes(house.notes ?? '')
    setNotesSaved(false)
  }, [house.id, house.notes])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sheetId) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, sheetId])

  const counts = supplyHouseInvoiceTabCounts(invoices)
  const rows = supplyHousePhoneInvoiceRows(invoices, tab, { todayYmd, jobLabel, formatMoney })
  const sheetInvoice = sheetId ? invoices.find((i) => i.id === sheetId) ?? null : null
  const sheetRow = sheetId ? rows.find((r) => r.id === sheetId) ?? null : null
  const notesDirty = notes !== (house.notes ?? '')

  const tabBtn = (key: SupplyHouseInvoiceTab, label: string) => {
    const active = tab === key
    return (
      <button key={key} type="button" role="tab" aria-selected={active} onClick={() => setTab(key)} style={{ flex: 1, minHeight: 40, border: 'none', borderBottom: `2px solid ${active ? 'var(--text-link)' : 'transparent'}`, background: 'none', color: active ? 'var(--text-link)' : 'var(--text-muted)', font: 'inherit', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
        {label} {counts[key]}
      </button>
    )
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={house.name} data-supply-house-phone style={{ position: 'fixed', inset: 0, zIndex: 1001, background: 'var(--bg-page)', overflowY: 'auto', padding: 'calc(0.5rem + env(safe-area-inset-top, 0px)) 0.75rem calc(5rem + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.6rem' }}>
        <button type="button" onClick={onClose} aria-label="Back to supply houses" style={{ ...btn, padding: '0 0.7rem' }}>
          ‹ Back
        </button>
        <h2 style={{ flex: 1, minWidth: 0, margin: 0, fontSize: '1.0625rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{house.name}</h2>
        <button type="button" onClick={props.onEditHouse} style={{ ...btn, padding: '0 0.7rem' }}>
          Edit
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.4rem' }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span data-supply-house-phone-balance style={{ display: 'block', fontSize: '1.5rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{money ? formatMoney(money.outstanding) : '—'}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{['open with this house', money?.payDayWords].filter(Boolean).join(' · ')}</span>
        </span>
        {(house.phone ?? '').trim() ? (
          <a href={telHrefFor(house.phone)} style={{ ...btn, background: 'var(--text-link)', borderColor: 'var(--text-link)', color: 'var(--surface)' }}>
            ☎ Call counter
          </a>
        ) : null}
      </div>
      {money ? <SupplyHouseAgingBar money={money} /> : null}
      {(house.address ?? '').trim() ? <p style={{ margin: '0.4rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{house.address}</p> : null}

      <section style={{ margin: '0.9rem 0', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.6rem 0.75rem' }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Notes on this house</span>
          <textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value)
              setNotesSaved(false)
            }}
            rows={4}
            placeholder="What they said, what was promised, who to ask for…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', fontSize: '1rem', lineHeight: 1.4, border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', resize: 'vertical' }}
          />
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <button
            type="button"
            disabled={!notesDirty || notesBusy}
            onClick={() => {
              setNotesBusy(true)
              void props.onSaveNotes(notes).then((ok) => {
                setNotesBusy(false)
                setNotesSaved(ok)
              })
            }}
            style={{ ...btn, minHeight: 40, opacity: !notesDirty || notesBusy ? 0.55 : 1, cursor: !notesDirty || notesBusy ? 'default' : 'pointer' }}
          >
            {notesBusy ? 'Saving…' : 'Save notes'}
          </button>
          <span aria-live="polite" style={{ fontSize: '0.75rem', color: notesDirty ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>{notesDirty ? 'not saved yet' : notesSaved ? 'saved to the house' : 'one shared note for the house'}</span>
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, marginBottom: '0.5rem' }}>
        <button type="button" onClick={props.onAddInvoice} style={{ ...btn, flex: 1 }}>
          Add invoice
        </button>
        <button type="button" onClick={props.onMakePayment} style={{ ...btn, flex: 1, borderColor: 'var(--border-green)', color: 'var(--text-green-700)' }}>
          Make payment
        </button>
      </div>

      <div role="tablist" aria-label="Invoices" style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '0.4rem' }}>
        {tabBtn('unpaid', 'Unpaid')}
        {tabBtn('paid', 'Paid')}
        {tabBtn('credits', 'Credits')}
      </div>
      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Reading the invoices…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{tab === 'unpaid' ? 'Nothing unpaid with this house.' : tab === 'paid' ? 'No paid invoices yet.' : 'No open credits.'}</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {rows.map((r) => (
            <li key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <button type="button" data-supply-house-phone-invoice={r.id} onClick={() => setSheetId(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 52, padding: '0.5rem 0.75rem', border: 'none', background: 'none', color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                <span style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
                  <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.title}
                    {r.pastDueDays > 0 ? <span style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: r.pastDueDays >= 60 ? 'var(--bg-red-100)' : 'var(--bg-orange-100)', color: r.pastDueDays >= 60 ? 'var(--text-red-800)' : 'var(--text-orange-800)' }}>{r.pastDueDays} d past due</span> : null}
                  </span>
                  {r.sub ? <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.sub}</span> : null}
                </span>
                <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: r.credit ? 'var(--text-green-700)' : 'inherit' }}>{r.amountWords}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {sheetInvoice && sheetRow ? (
        <ScheduleSheet title={sheetRow.title} subtitle={[sheetRow.amountWords, sheetRow.sub].filter(Boolean).join(' · ')} onClose={() => setSheetId(null)}>
          <ScheduleSheetAction
            label={sheetInvoice.is_paid ? 'Mark unpaid' : sheetRow.credit ? 'Mark applied' : 'Mark paid'}
            hint={sheetInvoice.is_paid ? 'Puts it back on the balance' : 'Takes it off the balance'}
            primary={!sheetInvoice.is_paid}
            onClick={() => {
              const id = sheetInvoice.id
              setSheetId(null)
              props.onTogglePaid(id)
            }}
          />
          {(sheetInvoice.link ?? '').trim() ? <ScheduleSheetAction label="View the invoice" hint="Opens the scan in a new tab" onClick={() => window.open(sheetInvoice.link!, '_blank', 'noopener,noreferrer')} /> : null}
          {(sheetInvoice.payment_link ?? '').trim() ? <ScheduleSheetAction label="View the receipt" hint="The payment's link, from Make Payment" onClick={() => window.open(sheetInvoice.payment_link!, '_blank', 'noopener,noreferrer')} /> : null}
          <ScheduleSheetAction
            label="Edit"
            hint="Number, dates, amount, jobs"
            onClick={() => {
              const id = sheetInvoice.id
              setSheetId(null)
              props.onEditInvoice(id)
            }}
          />
        </ScheduleSheet>
      ) : null}
    </div>
  )
}
