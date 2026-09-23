import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { retainageDeadlineFor } from '../../lib/jobs/lienDeadlines'
import { LIEN_CONTRACT_ENDED_HOW, parseContractEndedHow, parsePaymentBond, paymentBondWords, type LienContractEndedHow, type LienPaymentBond } from '../../lib/jobs/lienDeskRetainage'
import { JobFormFactRow } from './JobFormFactRow'

/**
 * Edit Job → *Our contract on this job* (v2.3753, punch list #33 PR 1): the
 * three lien facts the desk cannot derive — the day OUR contract on the job
 * was completed, terminated or abandoned (it starts the 30-day § 53.057
 * retainage clock; suggested from the last approved clock day, never
 * inferred), the retainage the GC holds back under the subcontract, and
 * whether a payment bond is on the project. Shown on jobs with a GC. Written
 * straight to the job as you pick, like the Share-this-bill tick — never
 * through the autosave slice.
 */

type Loaded = {
  endedOn: string
  endedHow: LienContractEndedHow | null
  retainage: string
  bond: LienPaymentBond
  lastWorkDate: string | null
}

const seg = (on: boolean, disabled = false): CSSProperties => ({ padding: '3px 10px', border: '1px solid var(--border-strong)', background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: on ? 'var(--text-blue-800)' : 'var(--text-700)', fontWeight: on ? 600 : 500, fontSize: '0.8125rem', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1 })
const segGroup: CSSProperties = { display: 'inline-flex', borderRadius: 6, overflow: 'hidden' }
const chip = (bg: string, fg: string): CSSProperties => ({ display: 'inline-block', padding: '0 6px', borderRadius: 5, fontSize: '0.68rem', fontWeight: 600, lineHeight: '18px', whiteSpace: 'nowrap', background: bg, color: fg, verticalAlign: 'middle', marginLeft: 6 })

export function JobFormLienContractRow({ jobId, gcName, expanded, onToggle, flash, anchorRef }: { jobId: string | null; gcName: string; expanded: boolean; onToggle: () => void; flash: boolean; anchorRef?: React.Ref<HTMLDivElement> }) {
  const { showToast } = useToastContext()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [retainageDraft, setRetainageDraft] = useState('')
  const [dateDraft, setDateDraft] = useState('')

  useEffect(() => {
    if (!jobId) return
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase.from('jobs_ledger').select('last_work_date, lien_contract_ended_on, lien_contract_ended_how, lien_retainage_held, lien_payment_bond' as '*').eq('id', jobId).maybeSingle()
      if (cancelled) return
      if (error || !data) {
        // The columns land with the migration; until then the row says so instead of failing the form.
        setUnavailable(true)
        return
      }
      const r = data as unknown as { last_work_date: string | null; lien_contract_ended_on: string | null; lien_contract_ended_how: string | null; lien_retainage_held: number | string | null; lien_payment_bond: string | null }
      const next: Loaded = {
        endedOn: r.lien_contract_ended_on ?? '',
        endedHow: parseContractEndedHow(r.lien_contract_ended_how),
        retainage: r.lien_retainage_held == null ? '' : String(Number(r.lien_retainage_held)),
        bond: parsePaymentBond(r.lien_payment_bond),
        lastWorkDate: r.last_work_date ? String(r.last_work_date).slice(0, 10) : null,
      }
      setLoaded(next)
      setRetainageDraft(next.retainage)
      setDateDraft(next.endedOn || next.lastWorkDate || '')
    })()
    return () => {
      cancelled = true
    }
  }, [jobId])

  async function save(patch: Record<string, unknown>, apply: (l: Loaded) => Loaded, what: string) {
    if (!jobId || !loaded || busy) return
    const before = loaded
    setLoaded(apply(loaded))
    setBusy(true)
    const { error } = await supabase.from('jobs_ledger').update(patch as never).eq('id', jobId)
    setBusy(false)
    if (error) {
      setLoaded(before)
      showToast(`Could not save ${what}: ${error.message}`, 'error')
    }
  }
  const setEnded = (how: LienContractEndedHow | null) => {
    if (!loaded) return
    if (how == null) {
      void save({ lien_contract_ended_on: null, lien_contract_ended_how: null, lien_contract_ended_set_by: null, lien_contract_ended_set_at: null }, (l) => ({ ...l, endedOn: '', endedHow: null }), 'the contract state')
      return
    }
    const day = (dateDraft || loaded.lastWorkDate || '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      showToast('Pick the day our contract ended first.', 'error')
      return
    }
    void save({ lien_contract_ended_on: day, lien_contract_ended_how: how, lien_contract_ended_set_at: new Date().toISOString() }, (l) => ({ ...l, endedOn: day, endedHow: how }), 'the contract state')
  }
  const setDate = (day: string) => {
    setDateDraft(day)
    if (!loaded?.endedHow || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return
    void save({ lien_contract_ended_on: day, lien_contract_ended_set_at: new Date().toISOString() }, (l) => ({ ...l, endedOn: day }), 'the day our contract ended')
  }
  const commitRetainage = () => {
    if (!loaded) return
    const t = retainageDraft.replace(/[$,\s]/g, '')
    if (t === '') {
      if (loaded.retainage !== '') void save({ lien_retainage_held: null }, (l) => ({ ...l, retainage: '' }), 'the retainage')
      return
    }
    const n = Number(t)
    if (!Number.isFinite(n) || n < 0) {
      showToast('Retainage is a dollar figure, 0 or more.', 'error')
      setRetainageDraft(loaded.retainage)
      return
    }
    if (String(n) === loaded.retainage) return
    void save({ lien_retainage_held: n }, (l) => ({ ...l, retainage: String(n) }), 'the retainage')
  }
  const setBond = (bond: LienPaymentBond) => void save({ lien_payment_bond: bond }, (l) => ({ ...l, bond }), 'the payment bond')

  const deadline = loaded?.endedOn ? retainageDeadlineFor(loaded.endedOn) : ''
  const retainageN = loaded && loaded.retainage !== '' ? Number(loaded.retainage) : null
  const value = unavailable ? (
    <span style={{ color: 'var(--text-muted)' }}>available after the next update lands</span>
  ) : !loaded ? (
    '…'
  ) : (
    <span>
      {loaded.endedHow ? (
        <>
          <span style={{ textTransform: 'capitalize' }}>{loaded.endedHow}</span> · {formatYmdMonthDay(loaded.endedOn)}
          {deadline ? <span style={{ color: 'var(--text-muted)' }}> · § 53.057 by {formatYmdMonthDay(deadline)}</span> : null}
        </>
      ) : (
        <span style={{ color: 'var(--text-muted)' }}>Still open</span>
      )}
      {retainageN != null && retainageN > 0 ? <span style={chip('var(--bg-amber-tint)', 'var(--text-amber-800)')}>retainage {formatUsdNoCents(retainageN)}</span> : retainageN === 0 ? <span style={chip('var(--bg-subtle)', 'var(--text-muted)')}>no retainage</span> : null}
      {loaded.bond !== 'unknown' ? <span style={chip('var(--bg-subtle)', 'var(--text-muted)')}>{paymentBondWords(loaded.bond)}</span> : null}
    </span>
  )

  return (
    <>
      {anchorRef ? <div ref={anchorRef} data-fact-row-anchor="lien-contract" /> : null}
      <div style={{ borderRadius: 6, boxShadow: flash ? '0 0 0 2px var(--surface), 0 0 0 4px var(--text-link)' : 'none', transition: 'box-shadow 0.4s ease' }} data-fact-row-ring={flash ? 'yes' : 'no'} data-testid="lien-contract-row">
        <JobFormFactRow label="Our contract on this job" value={value} expanded={expanded} onToggle={onToggle}>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.875rem' }}>Our contract on this job (feeds the lien clock — the § 53.057 retainage notice is due 30 days after it ends)</label>
          {unavailable || !loaded ? (
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{unavailable ? 'These facts arrive with the next database update.' : 'Loading…'}</p>
          ) : (
            <div style={{ display: 'grid', gap: '0.6rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 0.9rem', alignItems: 'center' }}>
                <span role="group" aria-label="Contract state" style={segGroup}>
                  <button type="button" onClick={() => setEnded(null)} disabled={busy} style={seg(loaded.endedHow == null, busy)} aria-pressed={loaded.endedHow == null}>Still open</button>
                  {LIEN_CONTRACT_ENDED_HOW.map((h) => (
                    <button key={h.key} type="button" onClick={() => setEnded(h.key)} disabled={busy} style={seg(loaded.endedHow === h.key, busy)} aria-pressed={loaded.endedHow === h.key}>{h.label}</button>
                  ))}
                </span>
                <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: '0.8125rem' }}>
                  Date
                  <input type="date" aria-label="Day our contract ended" value={dateDraft} onChange={(e) => setDate(e.target.value)} disabled={busy} style={{ padding: '0.3rem 0.4rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                </label>
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {loaded.endedHow && deadline ? (
                  <>Starts the 30-day § 53.057 retainage clock: <strong style={{ color: 'var(--text-700)' }}>mail by {formatYmdMonthDay(deadline)}</strong>. </>
                ) : (
                  <>The day our work on this job is done — or the day we treat the subcontract as terminated or abandoned — starts the 30-day clock. Do not wait for {gcName || 'the GC'} to declare completion. </>
                )}
                {loaded.lastWorkDate ? <>Suggested from the last approved clock day, {formatYmdMonthDay(loaded.lastWorkDate)} — confirm or change it.</> : 'No approved clock day on this job to suggest from.'}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.2rem', alignItems: 'flex-end' }}>
                <label style={{ display: 'grid', gap: 3, fontSize: '0.8125rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Retainage {gcName || 'the GC'} holds back, still unpaid</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span>$</span>
                    <input aria-label="Retainage the GC holds" value={retainageDraft} onChange={(e) => setRetainageDraft(e.target.value)} onBlur={commitRetainage} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} placeholder="not recorded" disabled={busy} style={{ width: '9rem', padding: '0.3rem 0.4rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 4, textAlign: 'right' }} />
                  </span>
                </label>
                <label style={{ display: 'grid', gap: 3, fontSize: '0.8125rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Payment bond on this project</span>
                  <span role="group" aria-label="Payment bond" style={segGroup}>
                    {(['yes', 'no', 'unknown'] as const).map((b) => (
                      <button key={b} type="button" onClick={() => setBond(b)} disabled={busy} style={seg(loaded.bond === b, busy)} aria-pressed={loaded.bond === b}>{b === 'yes' ? 'Yes' : b === 'no' ? 'No' : 'Unknown'}</button>
                    ))}
                  </span>
                </label>
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>The retainage is named inside every § 53.056 notice the desk sends on this job, and is what the § 53.057 form claims. Counsel: check each job for a bond before telling an owner to hold 10 percent. Saved on the job as you pick.</p>
            </div>
          )}
        </JobFormFactRow>
      </div>
    </>
  )
}
