import { useEffect, useMemo, useState, type CSSProperties } from 'react'

import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { fetchPhysicalInvoiceIssuerFromAppSettings, getPhysicalInvoiceIssuerForDocument } from '../../lib/physicalInvoiceIssuer'
import { buildJobAccountMailtoUrl, jobAccountMailtoTooLong } from '../../lib/supplyHouseJobAccount'
import { composeRepEmail, repFirstName, type BidPacketFacts } from '../../lib/jobs/jobAccountRepEmail'
import { fetchBidPacketFacts } from '../../lib/jobs/bidPacketFacts'
import { logJobAccountAskByEmail } from '../../lib/jobs/logJobAccountAsk'
import { submitFindPropertyOwnerDispatchRequestForJob } from '../../lib/findPropertyOwnerDispatchRequest'
import type { JobAccountStripEntry } from '../../lib/jobs/jobAccountStrip'

type RepContact = { id: string; name: string | null; email: string; phone: string | null; label: string }

const overlay: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: '1rem' }
const box: CSSProperties = { background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 12, width: 'min(560px, 100%)', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem 1.1rem' }
const kv: CSSProperties = { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.25rem 0.75rem', fontSize: '0.8125rem' }
const k: CSSProperties = { color: 'var(--text-muted)' }
const btn: CSSProperties = { padding: '0.45rem 0.85rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 7, font: 'inherit', fontSize: '0.8125rem', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }
const primary: CSSProperties = { ...btn, background: 'var(--text-link)', borderColor: 'var(--text-link)', color: 'white', fontWeight: 600 }
const chipStyle = (on: boolean): CSSProperties => ({ padding: '0.3rem 0.75rem', borderRadius: 999, borderWidth: 1, borderStyle: 'solid', borderColor: on ? 'var(--text-link)' : 'var(--border-strong)', background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: on ? 'var(--text-blue-700)' : 'var(--text-700)', fontWeight: on ? 600 : 400, fontSize: '0.8125rem', fontFamily: 'inherit', cursor: 'pointer' })

/**
 * Job accounts from the bid (v2.3451): "Ask {rep} by email" — the estimator's
 * lane. The email is composed from what the bid knows and opens as a draft in
 * their own mail client (or copies to the clipboard), addressed to the house's
 * job-accounts rep; one honest tap afterwards logs it as `requested` on the
 * job and writes the send-log row with the bid. The owner of record is soft
 * here — the office's find-the-owner errand is one tap away.
 */
export function JobAccountRepEmailSheet({
  jobId,
  jobLabel,
  jobAddress,
  bidId,
  houses,
  onClose,
  onLogged,
}: {
  jobId: string
  jobLabel: string
  jobAddress: string | null | undefined
  bidId: string | null
  /** Houses the question can still ask (state none), in its order. */
  houses: JobAccountStripEntry[]
  onClose: () => void
  onLogged: () => void
}) {
  const { user: authUser, profileName } = useAuth()
  const { showToast } = useToastContext()
  const [houseId, setHouseId] = useState<string>(houses[0]?.houseId ?? '')
  const [reps, setReps] = useState<Record<string, RepContact | undefined>>({})
  const [facts, setFacts] = useState<BidPacketFacts | null>(null)
  const [org, setOrg] = useState(() => getPhysicalInvoiceIssuerForDocument())
  const [stage, setStage] = useState<'compose' | 'confirm'>('compose')
  const [busy, setBusy] = useState(false)
  const house = houses.find((h) => h.houseId === houseId) ?? null
  const rep = house ? reps[house.houseId] : undefined

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const ids = houses.map((h) => h.houseId)
      const [{ data: contacts }, packet] = await Promise.all([
        ids.length > 0
          ? supabase.from('supply_house_contacts').select('id, name, email, phone, label, supply_house_id, is_default').in('supply_house_id', ids).eq('role', 'job_accounts').is('archived_at', null).order('is_default', { ascending: false })
          : Promise.resolve({ data: [] as unknown[] }),
        bidId ? fetchBidPacketFacts(bidId, jobId, jobAddress) : Promise.resolve<BidPacketFacts>({ bidLabel: jobLabel, propertyName: null, address: jobAddress ?? null, startDate: null, gc: null, owner: null }),
      ])
      await fetchPhysicalInvoiceIssuerFromAppSettings().catch(() => undefined)
      if (cancelled) return
      const byHouse: Record<string, RepContact | undefined> = {}
      for (const c of (contacts ?? []) as Array<RepContact & { supply_house_id: string }>) if (!byHouse[c.supply_house_id]) byHouse[c.supply_house_id] = c
      setReps(byHouse)
      setFacts(packet)
      setOrg(getPhysicalInvoiceIssuerForDocument())
    })()
    return () => {
      cancelled = true
    }
  }, [houses, bidId, jobId, jobAddress, jobLabel])

  const email = useMemo(() => {
    if (!house || !facts) return null
    return composeRepEmail({ repFirstName: repFirstName(rep?.name ?? rep?.label ?? ''), houseName: house.houseName, facts, org: { companyName: org.companyName, officePhone: org.phone }, senderName: profileName ?? '' })
  }, [house, rep, facts, org, profileName])

  const mailto = email && rep ? buildJobAccountMailtoUrl([{ label: rep.name ?? rep.label, email: rep.email }], email.subject, email.text) : null
  const tooLong = mailto ? jobAccountMailtoTooLong(mailto) : false

  async function copy() {
    if (!email || !rep) return
    try {
      await navigator.clipboard.writeText(`To: ${rep.email}\nSubject: ${email.subject}\n\n${email.text}`)
      showToast('Copied — paste it into your email.', 'success')
      setStage('confirm')
    } catch {
      showToast('Could not copy.', 'error')
    }
  }

  async function logSent() {
    if (!house || !rep || busy || !authUser?.id) return
    setBusy(true)
    try {
      await logJobAccountAskByEmail({ jobId, houseId: house.houseId, bidId, rep, userId: authUser.id, senderName: profileName ?? '' })
      showToast(`Logged — ${house.houseName} reads requested until it is marked opened.`, 'success')
      onLogged()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not log the send.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function findOwner() {
    await submitFindPropertyOwnerDispatchRequestForJob(authUser?.id, showToast, { jobId, jobLabel, jobAddress })
  }

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={`Ask the supply house to open a job account for ${jobLabel}`} style={box} onClick={(e) => e.stopPropagation()} data-job-account-rep-email={stage}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Ask the rep to open a job account</h3>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{jobLabel}{facts?.bidLabel && facts.bidLabel !== 'this bid' ? ` · from ${facts.bidLabel}` : ''}</div>
        </div>
        {houses.length > 1 ? (
          <div role="group" aria-label="Supply house" style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {houses.map((h) => (
              <button key={h.houseId} type="button" aria-pressed={h.houseId === houseId} onClick={() => { setHouseId(h.houseId); setStage('compose') }} style={chipStyle(h.houseId === houseId)}>{h.houseName}</button>
            ))}
          </div>
        ) : null}
        {!house ? null : !facts ? (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Loading…</p>
        ) : !rep ? (
          <div style={{ padding: '0.55rem 0.7rem', borderRadius: 8, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', fontSize: '0.8125rem' }}>
            No job-accounts rep with an email on file for {house.houseName}. Add one on Materials → Supply houses → {house.houseName} → Contacts (role Job accounts), then come back — or send the ask to Dispatch instead.
          </div>
        ) : (
          <>
            <div style={kv}>
              <span style={k}>To</span><span><b>{rep.name ?? rep.label}</b> · {rep.email} <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0f766e', background: '#ccfbf1', borderRadius: 999, padding: '0 0.45rem' }}>Job accounts rep</span></span>
              <span style={k}>Property</span><span>{facts.address || jobAddress || '—'}</span>
              {facts.gc ? <><span style={k}>General contractor</span><span>{[facts.gc.company, facts.gc.contactName].filter(Boolean).join(' · ')}{facts.gc.phone ? ` · ${facts.gc.phone}` : ''} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>from the bid</span></span></> : null}
              <span style={k}>Owner of record</span>
              <span>
                {facts.owner ? `${facts.owner.name} · ${facts.owner.mailingAddress}` : (
                  <>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', borderRadius: 999, padding: '0 0.45rem' }}>not on file</span>
                    <span style={{ color: 'var(--text-muted)' }}> — the house opens on the address and the GC; the owner follows.</span>{' '}
                    <button type="button" onClick={() => void findOwner()} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.78rem', color: 'var(--text-link)', cursor: 'pointer', textDecoration: 'underline dotted' }}>Send to Dispatch — find the owner</button>
                  </>
                )}
              </span>
            </div>
            {email ? (
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.8125rem', lineHeight: 1.45, padding: '0.6rem 0.75rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)', color: 'var(--text-700)' }} data-testid="rep-email-preview">
                <b>Subject:</b> {email.subject}{'\n\n'}{email.text}
              </pre>
            ) : null}
            {stage === 'compose' ? (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button type="button" onClick={onClose} style={{ ...btn, border: 'none', color: 'var(--text-muted)' }}>Cancel</button>
                <button type="button" onClick={() => void copy()} style={btn}>Copy for email</button>
                {mailto && !tooLong ? (
                  <a href={mailto} onClick={() => setStage('confirm')} style={primary}>Email from my inbox</a>
                ) : (
                  <button type="button" onClick={() => void copy()} style={primary}>Copy for email</button>
                )}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '0.5rem', padding: '0.6rem 0.75rem', borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.8125rem' }}>The app can't see your inbox — send it there, then tell it here so {house.houseName} reads <b>requested</b> on the job.</div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button type="button" disabled={busy} onClick={() => setStage('compose')} style={{ ...btn, border: 'none', color: 'var(--text-muted)' }}>Didn't send it</button>
                  <button type="button" disabled={busy} onClick={() => void logSent()} style={primary} data-testid="rep-email-log-sent">{busy ? 'Logging…' : 'Sent — log it'}</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
