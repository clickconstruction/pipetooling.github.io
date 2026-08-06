import { useMemo, useState } from 'react'
import type { StageRow } from '../../lib/jobsStagesBoard'
import { buildGcReviewRollup, type GcReviewGroup, type GcReviewGroupBy } from '../../lib/gcReviewRollup'
import {
  buildGcStatementEmailHtml,
  buildGcStatementEmailText,
  gcStatementEmailSubject,
} from '../../lib/jobsDocuments/gcStatementEmail'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import GcHardHatIcon from '../icons/GcHardHatIcon'
import DevelopmentHouseIcon from '../icons/DevelopmentHouseIcon'

export type SendGcStatementPayload = {
  gcCustomerId: string | null
  gcName: string
  groupBy: GcReviewGroupBy
  toEmail: string
  subject: string
  emailHtml: string
  emailText: string
  total: number
  jobCount: number
}

type JobsGcReviewModalProps = {
  open: boolean
  onClose: () => void
  billedActiveRows: StageRow[]
  collectionsRows: StageRow[]
  /** Shell glue: build the statement HTML and open the print window (toast on popup block). */
  onPrint: (groups: GcReviewGroup[], groupBy: GcReviewGroupBy) => void
  /** Shell glue: copy the GC-facing statement (rich HTML + plain text) for pasting into an email (v2.1414). */
  onCopyForEmail: (group: GcReviewGroup, groupBy: GcReviewGroupBy) => void
  /** Shell transport for the Email… dialog: invoke send-gc-statement-email (v2.1416). */
  onSendStatement: (payload: SendGcStatementPayload) => Promise<{ ok: boolean; error?: string }>
  /** Prefill for the Email… dialog's To field (customers.contact_info email; '' when unknown). */
  emailForGc: (gcCustomerId: string) => string
  /** "Last sent" hints per GC customer id (ISO timestamps), loaded by the shell when the modal opens. */
  lastSentByGcId: Record<string, string>
}

/**
 * GC Review (v2.1181): Billed Awaiting Payment grouped by the job's GC — each
 * General Contractor's outstanding total and their customers' bill-out dates.
 * A "Group by" pill toggle re-runs the same rollup by the job's DEVELOPMENT
 * instead (shown only when a row has one). Same overlay pattern as the "by
 * Job Name" modal in JobsStagesTab; rollup math lives in the pure
 * gcReviewRollup kernel so the grand total reconciles with the section header
 * by construction.
 */
export function JobsGcReviewModal({
  open,
  onClose,
  billedActiveRows,
  collectionsRows,
  onPrint,
  onCopyForEmail,
  onSendStatement,
  emailForGc,
  lastSentByGcId,
}: JobsGcReviewModalProps) {
  const [includeCollections, setIncludeCollections] = useState(false)
  const [groupBy, setGroupBy] = useState<GcReviewGroupBy>('gc')
  /** Email… dialog state — one group at a time; To/Subject editable before Send. */
  const [emailDialogGroup, setEmailDialogGroup] = useState<GcReviewGroup | null>(null)
  const [emailDialogTo, setEmailDialogTo] = useState('')
  const [emailDialogSubject, setEmailDialogSubject] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const anyDevelopment = useMemo(
    () => [...billedActiveRows, ...collectionsRows].some((r) => r.job.development?.id),
    [billedActiveRows, collectionsRows],
  )
  const effectiveGroupBy: GcReviewGroupBy = anyDevelopment ? groupBy : 'gc'
  const byDevelopment = effectiveGroupBy === 'development'
  const rollup = useMemo(
    () => buildGcReviewRollup(billedActiveRows, collectionsRows, { includeCollections, groupBy: effectiveGroupBy }),
    [billedActiveRows, collectionsRows, includeCollections, effectiveGroupBy],
  )
  if (!open) return null
  const EntityIcon = byDevelopment ? DevelopmentHouseIcon : GcHardHatIcon
  const groupByPillStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.2rem 0.6rem',
    fontSize: '0.75rem',
    fontWeight: 500,
    fontFamily: 'inherit',
    border: 'none',
    borderRadius: 999,
    cursor: 'pointer',
    background: active ? 'var(--bg-blue-tint)' : 'transparent',
    color: active ? 'var(--text-link)' : 'var(--text-muted)',
  })
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={byDevelopment ? 'GC Review — Billed Awaiting Payment by Development' : 'GC Review — Billed Awaiting Payment by General Contractor'}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          padding: '1.5rem',
          borderRadius: 8,
          minWidth: 360,
          maxWidth: 720,
          width: 'calc(100vw - 2rem)',
          maxHeight: '85vh',
          overflow: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <EntityIcon size={18} style={{ color: 'var(--text-muted)' }} />
            GC Review
          </h2>
          {anyDevelopment ? (
            <span
              role="group"
              aria-label="Group rows by"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.15rem',
                padding: '0.15rem',
                border: '1px solid var(--border)',
                borderRadius: 999,
                flexShrink: 0,
              }}
            >
              <button type="button" onClick={() => setGroupBy('gc')} aria-pressed={!byDevelopment} style={groupByPillStyle(!byDevelopment)}>
                By GC
              </button>
              <button
                type="button"
                onClick={() => setGroupBy('development')}
                aria-pressed={byDevelopment}
                style={groupByPillStyle(byDevelopment)}
              >
                By Development
              </button>
            </span>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            ×
          </button>
        </div>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {byDevelopment ? (
            <>Billed Awaiting Payment grouped by each job&rsquo;s development, with bill-out dates. Set a development in Edit Job → Project | Plans | Bid | Development.</>
          ) : (
            <>Billed Awaiting Payment grouped by each job&rsquo;s GC/Builder, with bill-out dates. Set a GC in Edit Job → Customer.</>
          )}
        </p>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', marginBottom: '1rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={includeCollections}
            onChange={() => setIncludeCollections((p) => !p)}
            style={{ margin: 0 }}
          />
          Include Collections ({rollup.collectionsCount} · ${formatCurrency(rollup.collectionsTotal)})
        </label>
        {rollup.groups.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>No billed jobs awaiting payment.</p>
        ) : (
          rollup.groups.map((g) => (
            <div key={g.key} style={{ marginBottom: '1.25rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                  padding: '0.4rem 0.5rem',
                  background: 'var(--bg-subtle)',
                  borderRadius: 6,
                  marginBottom: '0.35rem',
                }}
              >
                {g.isNoGc ? (
                  <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{g.gcName}</span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                    <EntityIcon size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    {g.gcName}
                  </span>
                )}
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  {g.jobCount} job{g.jobCount === 1 ? '' : 's'} · ${formatCurrency(g.subtotal)} outstanding
                  {g.oldestAgeDays != null ? ` · oldest ${g.oldestAgeDays}d` : ''}
                </span>
                {!g.isNoGc && g.gcId && lastSentByGcId[g.gcId] ? (
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    last sent {new Date(lastSentByGcId[g.gcId]!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                ) : null}
                {!g.isNoGc ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEmailDialogGroup(g)
                      setEmailDialogTo(!byDevelopment && g.gcId ? emailForGc(g.gcId) : '')
                      setEmailDialogSubject(
                        gcStatementEmailSubject(g, new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })),
                      )
                      setEmailError(null)
                    }}
                    title={`Email the ${g.gcName} statement from the app`}
                    aria-label={`Email statement for ${g.gcName}`}
                    style={{
                      marginLeft: 'auto',
                      padding: '0.2rem 0.6rem',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      border: '1px solid var(--border-strong)',
                      borderRadius: 4,
                      background: 'var(--surface)',
                      cursor: 'pointer',
                      color: 'var(--text-700)',
                    }}
                  >
                    Email…
                  </button>
                ) : null}
                {!g.isNoGc ? (
                  <button
                    type="button"
                    onClick={() => onCopyForEmail(g, effectiveGroupBy)}
                    title={`Copy the ${g.gcName} statement to paste into an email`}
                    aria-label={`Copy statement for ${g.gcName} for email`}
                    style={{
                      marginLeft: 0,
                      padding: '0.2rem 0.6rem',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      border: '1px solid var(--border-strong)',
                      borderRadius: 4,
                      background: 'var(--surface)',
                      cursor: 'pointer',
                      color: 'var(--text-700)',
                    }}
                  >
                    Copy for email
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onPrint([g], effectiveGroupBy)}
                  title={`Print the ${g.gcName} statement`}
                  aria-label={`Print statement for ${g.gcName}`}
                  style={{
                    marginLeft: g.isNoGc ? 'auto' : 0,
                    padding: '0.2rem 0.6rem',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    border: '1px solid var(--border-strong)',
                    borderRadius: 4,
                    background: 'var(--surface)',
                    cursor: 'pointer',
                    color: 'var(--text-700)',
                  }}
                >
                  Print
                </button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '0.2rem 0.4rem', fontWeight: 500 }}>Customer</th>
                    <th style={{ padding: '0.2rem 0.4rem', fontWeight: 500 }}>Job</th>
                    <th style={{ padding: '0.2rem 0.4rem', fontWeight: 500 }}>Billed on</th>
                    <th style={{ padding: '0.2rem 0.4rem', fontWeight: 500, textAlign: 'right' }}>Days</th>
                    <th style={{ padding: '0.2rem 0.4rem', fontWeight: 500, textAlign: 'right' }}>Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r) => (
                    <tr key={r.key} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.3rem 0.4rem' }}>
                        {r.customerName}
                        {r.inCollections ? (
                          <span
                            style={{
                              marginLeft: 6,
                              padding: '0.05rem 0.35rem',
                              fontSize: '0.6875rem',
                              fontWeight: 600,
                              borderRadius: 4,
                              background: 'var(--bg-red-tint)',
                              color: 'var(--text-red-700)',
                            }}
                          >
                            Collections
                          </span>
                        ) : null}
                      </td>
                      <td style={{ padding: '0.3rem 0.4rem', color: 'var(--text-muted)' }}>
                        {r.hcp}
                        {r.jobName ? ` · ${r.jobName}` : ''}
                      </td>
                      <td style={{ padding: '0.3rem 0.4rem', whiteSpace: 'nowrap' }}>{r.referenceDateDisplay}</td>
                      <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {r.ageDays != null ? `${r.ageDays}d` : '—'}
                      </td>
                      <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        ${formatCurrency(r.remaining)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            borderTop: '2px solid var(--border-strong)',
            paddingTop: '0.6rem',
            fontWeight: 600,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
            Total
            {rollup.groups.length > 0 ? (
              <button
                type="button"
                onClick={() => onPrint(rollup.groups, effectiveGroupBy)}
                title={byDevelopment ? 'Print every development section as one report' : 'Print every GC section as one report'}
                style={{
                  padding: '0.2rem 0.6rem',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  background: 'var(--surface)',
                  cursor: 'pointer',
                  color: 'var(--text-700)',
                }}
              >
                Print all
              </button>
            ) : null}
          </span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>${formatCurrency(rollup.grandTotal)}</span>
        </div>
      </div>
      {emailDialogGroup ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Email statement to ${emailDialogGroup.gcName}`}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 61,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !emailSending) setEmailDialogGroup(null)
          }}
        >
          <div style={{ background: 'var(--surface)', padding: '1.25rem 1.5rem', borderRadius: 8, minWidth: 340, maxWidth: 520, width: 'calc(100vw - 3rem)' }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>Email statement to {emailDialogGroup.gcName}</h3>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>To</label>
            <input
              type="email"
              value={emailDialogTo}
              onChange={(e) => setEmailDialogTo(e.target.value)}
              placeholder="accounting@example.com"
              disabled={emailSending}
              style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', marginBottom: '0.6rem' }}
            />
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>Subject</label>
            <input
              type="text"
              value={emailDialogSubject}
              onChange={(e) => setEmailDialogSubject(e.target.value)}
              disabled={emailSending}
              style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box', marginBottom: '0.6rem' }}
            />
            <div style={{ border: '1px solid var(--border)', borderRadius: 4, padding: '0.5rem 0.65rem', fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Statement preview — {emailDialogGroup.jobCount} job{emailDialogGroup.jobCount === 1 ? '' : 's'}, ${formatCurrency(emailDialogGroup.subtotal)} · job addresses, bill-sent dates and amounts owed. Sent from
              team@noreply.pipetooling.com with your email as reply-to.
            </div>
            {emailError ? (
              <p style={{ margin: '0 0 0.6rem', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{emailError}</p>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                disabled={emailSending}
                onClick={() => setEmailDialogGroup(null)}
                style={{ padding: '0.4rem 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={emailSending || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDialogTo.trim())}
                onClick={() => {
                  const g = emailDialogGroup
                  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  setEmailSending(true)
                  setEmailError(null)
                  void onSendStatement({
                    gcCustomerId: byDevelopment ? null : g.gcId,
                    gcName: g.gcName,
                    groupBy: effectiveGroupBy,
                    toEmail: emailDialogTo.trim(),
                    subject: emailDialogSubject.trim() || gcStatementEmailSubject(g, dateStr),
                    emailHtml: buildGcStatementEmailHtml(g, { dateStr, groupBy: effectiveGroupBy }),
                    emailText: buildGcStatementEmailText(g, { dateStr }),
                    total: g.subtotal,
                    jobCount: g.jobCount,
                  }).then((res) => {
                    setEmailSending(false)
                    if (res.ok) {
                      setEmailDialogGroup(null)
                    } else {
                      setEmailError(res.error || 'Send failed — try again.')
                    }
                  })
                }}
                style={{
                  padding: '0.4rem 0.9rem',
                  border: 'none',
                  borderRadius: 4,
                  background: '#3b82f6',
                  color: 'white',
                  cursor: emailSending ? 'wait' : 'pointer',
                  fontWeight: 500,
                }}
              >
                {emailSending ? 'Sending…' : 'Send statement'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
