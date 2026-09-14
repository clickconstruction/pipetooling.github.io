import { useEffect, useState, type CSSProperties, type MouseEvent } from 'react'

import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { fetchPhysicalInvoiceIssuerFromAppSettings, getPhysicalInvoiceIssuerForDocument } from '../../lib/physicalInvoiceIssuer'
import { openedViaPhrase } from '../../lib/materials/jobSupplyHouseAccounts'
import {
  askableEntries,
  counterSentence,
  stripStateWord,
  telHref,
  type JobAccountStripEntry,
  type JobAccountStripState,
} from '../../lib/jobs/jobAccountStrip'
import { submitOpenJobAccountRequest } from '../../lib/jobs/openJobAccountDispatchRequest'

const TEAL = '#0f766e'
const TEAL_SOFT = '#ccfbf1'
const PURPLE = '#6d28d9'
const PURPLE_SOFT = '#f5f3ff'

const shortDate = (iso: string | null): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function chipStyle(state: JobAccountStripState): CSSProperties {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    borderRadius: 6,
    padding: '0.1rem 0.5rem',
    fontFamily: 'inherit',
    fontSize: '0.75rem',
    fontWeight: 600,
    lineHeight: 1.5,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'transparent',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }
  switch (state) {
    case 'open': return { ...base, background: TEAL_SOFT, color: TEAL }
    case 'requested': return { ...base, background: PURPLE_SOFT, color: PURPLE }
    case 'not_needed': return { ...base, background: 'var(--bg-muted)', color: 'var(--text-muted)', fontWeight: 500 }
    case 'none': return { ...base, background: 'transparent', color: 'var(--text-muted)', borderColor: 'var(--border-strong)', borderStyle: 'dashed', fontWeight: 500 }
  }
}

/**
 * The Job accounts strip (v2.3424): on every job card the field opens —
 * Ferguson ✓ · Reece requested · Moore none yet. Only houses that expect a
 * job account appear (plus any house the job already has one at). Tap ✓ for
 * what to say at the counter and who to call; tap "none yet" to ask the office
 * in one tap. Renders nothing when the strip is empty or not loaded.
 */
export function JobAccountsStrip({
  jobId,
  jobLabel,
  jobAddress,
  entries,
  onChanged,
  compact = false,
}: {
  jobId: string
  jobLabel: string
  jobAddress: string | null | undefined
  entries: JobAccountStripEntry[] | undefined
  /** After an ask is filed — the host refetches its strips. */
  onChanged?: () => void
  compact?: boolean
}) {
  const [sheet, setSheet] = useState<{ entry: JobAccountStripEntry } | null>(null)
  if (!entries || entries.length === 0) return null

  const stop = (e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
  }

  return (
    <div
      data-job-accounts-strip={jobId}
      onClick={stop}
      onKeyDown={(e) => e.stopPropagation()}
      style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem', marginTop: compact ? '0.25rem' : '0.4rem' }}
    >
      {!compact ? (
        <span style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', marginRight: '0.1rem' }}>
          Job accounts
        </span>
      ) : null}
      {entries.map((e) => (
        <button
          key={e.houseId}
          type="button"
          onClick={(ev) => {
            stop(ev)
            setSheet({ entry: e })
          }}
          title={e.state === 'open' ? `${e.houseName} job account open — tap for what to say at the counter` : e.state === 'none' ? `No job account at ${e.houseName} yet — tap to ask the office` : e.state === 'requested' ? `Asked ${shortDate(e.requestedAt)} — Dispatch is on it` : `Not needed: ${e.note || 'office decision'}`}
          data-job-account-state={e.state}
          style={chipStyle(e.state)}
        >
          {e.state === 'open' ? <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} /> : null}
          {e.houseName}
          <span style={{ fontWeight: e.state === 'open' ? 700 : 500 }}>{e.state === 'open' ? '✓' : `· ${stripStateWord(e.state)}`}</span>
        </button>
      ))}
      {sheet ? (
        sheet.entry.state === 'open' || sheet.entry.state === 'not_needed' ? (
          <JobAccountOpenSheet entry={sheet.entry} jobLabel={jobLabel} jobAddress={jobAddress} onClose={() => setSheet(null)} />
        ) : (
          <RequestJobAccountSheet
            jobId={jobId}
            jobLabel={jobLabel}
            jobAddress={jobAddress}
            entries={entries}
            tapped={sheet.entry}
            onClose={() => setSheet(null)}
            onSent={() => {
              setSheet(null)
              onChanged?.()
            }}
          />
        )
      ) : null}
    </div>
  )
}

const overlay: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1200, padding: '0.75rem' }
const sheetBox: CSSProperties = { background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 14, width: 'min(440px, 100%)', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: '0.7rem', padding: '0.9rem 1rem 1rem', marginBottom: 'env(safe-area-inset-bottom, 0px)' }
const grab: CSSProperties = { width: 36, height: 4, borderRadius: 2, background: 'var(--border-strong)', alignSelf: 'center' }
const kv: CSSProperties = { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.2rem 0.75rem', fontSize: '0.8125rem' }
const k: CSSProperties = { color: 'var(--text-muted)' }
const btn: CSSProperties = { padding: '0.4rem 0.8rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 7, font: 'inherit', fontSize: '0.8125rem', cursor: 'pointer', textDecoration: 'none' }

/** ✓ (and not-needed): the reference, who opened it and how, the rep to call, and the sentence for the counter. */
function JobAccountOpenSheet({ entry, jobLabel, jobAddress, onClose }: { entry: JobAccountStripEntry; jobLabel: string; jobAddress: string | null | undefined; onClose: () => void }) {
  const { showToast } = useToastContext()
  const [company, setCompany] = useState<string>(() => getPhysicalInvoiceIssuerForDocument().companyName)
  useEffect(() => {
    let cancelled = false
    void fetchPhysicalInvoiceIssuerFromAppSettings().then(() => {
      if (!cancelled) setCompany(getPhysicalInvoiceIssuerForDocument().companyName)
    })
    return () => {
      cancelled = true
    }
  }, [])
  const sentence = counterSentence({ companyName: company, address: jobAddress, accountRef: entry.accountRef })
  const tel = telHref(entry.rep?.phone)
  const notNeeded = entry.state === 'not_needed'

  async function copy() {
    try {
      await navigator.clipboard.writeText(sentence)
      showToast('Copied for the counter.', 'success')
    } catch {
      showToast('Could not copy — read it out instead.', 'warning')
    }
  }

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={`${entry.houseName} job account for ${jobLabel}`} style={sheetBox} onClick={(e) => e.stopPropagation()} data-job-account-sheet={entry.state}>
        <div style={grab} />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '0.9375rem' }}>{entry.houseName} job account</strong>
          <span style={{ ...chipStyle(entry.state), cursor: 'default' }}>{notNeeded ? 'not needed' : 'open'}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{jobLabel}</span>
        </div>
        {notNeeded ? (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-700)' }}>
            The office decided this job does not need an account at {entry.houseName}{entry.note ? `: ${entry.note}` : '.'}
          </p>
        ) : (
          <>
            <div style={kv}>
              <span style={k}>Reference</span>
              <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{entry.accountRef || '— (the house keys it on the address)'}</span>
              <span style={k}>Opened</span>
              <span>{shortDate(entry.openedAt)} · {openedViaPhrase(entry.openedVia)}</span>
              <span style={k}>Rep</span>
              <span>
                {entry.rep ? (
                  <>
                    {entry.rep.name}
                    {entry.rep.phone ? <> · {tel ? <a href={tel} style={{ color: 'var(--text-link)' }}>{entry.rep.phone}</a> : entry.rep.phone}</> : null}
                  </>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>none on file</span>
                )}
              </span>
              {entry.note ? (
                <>
                  <span style={k}>Note</span>
                  <span>{entry.note}</span>
                </>
              ) : null}
            </div>
            <div style={{ background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', borderRadius: 8, padding: '0.5rem 0.65rem', fontSize: '0.8125rem' }}>
              Tell the counter: <strong>{sentence}</strong>. Your PO code goes on the ticket as usual.
            </div>
          </>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {!notNeeded ? (
            <button type="button" onClick={() => void copy()} style={btn}>Copy for the counter</button>
          ) : null}
          {tel && entry.rep ? (
            <a href={tel} style={btn}>Call {entry.rep.name.split(' ')[0]}</a>
          ) : null}
          <button type="button" onClick={onClose} style={{ ...btn, border: 'none', color: 'var(--text-muted)' }}>Close</button>
        </div>
      </div>
    </div>
  )
}

/** "none yet" / "requested": pick the houses, say whether you are at the counter, send the office the errand. */
function RequestJobAccountSheet({
  jobId,
  jobLabel,
  jobAddress,
  entries,
  tapped,
  onClose,
  onSent,
}: {
  jobId: string
  jobLabel: string
  jobAddress: string | null | undefined
  entries: JobAccountStripEntry[]
  tapped: JobAccountStripEntry
  onClose: () => void
  onSent: () => void
}) {
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const askable = askableEntries(entries)
  const [picked, setPicked] = useState<Set<string>>(() => new Set(tapped.state === 'none' ? [tapped.houseId] : []))
  const [atCounter, setAtCounter] = useState(true)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const pickable = askable.filter((e) => e.state === 'none')
  const alreadyAsked = askable.filter((e) => e.state === 'requested')
  const tel = telHref(tapped.rep?.phone)

  async function send() {
    if (sending || picked.size === 0) return
    setSending(true)
    const houses = pickable.filter((e) => picked.has(e.houseId)).map((e) => ({ id: e.houseId, name: e.houseName, repName: e.rep?.name ?? null, repPhone: e.rep?.phone ?? null, repContactId: e.rep?.id ?? null }))
    const res = await submitOpenJobAccountRequest(authUser?.id, showToast, { jobId, jobLabel, jobAddress, houses, fromCounter: atCounter, note })
    setSending(false)
    if (res) onSent()
  }

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={`Ask the office to open a job account for ${jobLabel}`} style={sheetBox} onClick={(e) => e.stopPropagation()} data-job-account-sheet="request">
        <div style={grab} />
        <strong style={{ fontSize: '0.9375rem' }}>Ask the office to open a job account</strong>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '-0.4rem' }}>{jobLabel}{jobAddress ? ` · ${jobAddress}` : ''}</span>
        {alreadyAsked.length > 0 ? (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: PURPLE }}>
            Dispatch is on it for {alreadyAsked.map((e) => e.houseName).join(', ')}{alreadyAsked[0]?.requestedAt ? ` — asked ${shortDate(alreadyAsked[0].requestedAt)}` : ''}.
          </p>
        ) : null}
        {pickable.length > 0 ? (
          <div role="group" aria-label="Supply houses" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {pickable.map((e) => {
              const on = picked.has(e.houseId)
              return (
                <button
                  key={e.houseId}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPicked((prev) => { const next = new Set(prev); if (next.has(e.houseId)) next.delete(e.houseId); else next.add(e.houseId); return next })}
                  style={{ padding: '0.3rem 0.75rem', borderRadius: 999, border: `1px solid ${on ? '#2563eb' : 'var(--border-strong)'}`, background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: on ? 'var(--text-blue-700)' : 'var(--text-700)', fontWeight: on ? 600 : 400, fontSize: '0.8125rem', fontFamily: 'inherit', cursor: 'pointer' }}
                >
                  {e.houseName}
                </button>
              )
            })}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Every house that expects an account has been asked already.</p>
        )}
        {pickable.length > 0 ? (
          <>
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.8125rem' }}>
              <input type="checkbox" checked={atCounter} onChange={(e) => setAtCounter(e.target.checked)} />
              I'm at the counter now
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="What you're buying, roughly how much"
              aria-label="Note for the office"
              style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 7, font: 'inherit', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-strong)' }}
            />
          </>
        ) : null}
        {tapped.rep && tel ? (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Or call {tapped.houseName}'s rep yourself: <a href={tel} style={{ color: 'var(--text-link)' }}>{tapped.rep.name} · {tapped.rep.phone}</a> — the office still needs to mark it opened.
          </span>
        ) : null}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
          <button type="button" onClick={onClose} disabled={sending} style={{ ...btn, border: 'none', color: 'var(--text-muted)' }}>Cancel</button>
          {pickable.length > 0 ? (
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || picked.size === 0}
              style={{ ...btn, background: picked.size === 0 ? 'var(--bg-200)' : '#7c3aed', borderColor: picked.size === 0 ? 'var(--border-strong)' : '#7c3aed', color: picked.size === 0 ? 'var(--text-faint)' : 'white', fontWeight: 600, cursor: sending || picked.size === 0 ? 'not-allowed' : 'pointer' }}
            >
              {sending ? 'Sending…' : 'Send to Dispatch'}
            </button>
          ) : null}
        </div>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-faint)' }}>Dispatch gets it with the rep's number and marks it open in two taps. You'll get a push when it is.</span>
      </div>
    </div>
  )
}
