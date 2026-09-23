import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PhysicalInvoiceIssuer } from '../../lib/physicalInvoiceIssuer'
import { buildLienRetainageNoticeBlocks, filingDocHtml, filingLetterheadFromIssuer } from '../../lib/jobsDocuments/lienFilingDocuments'
import { demandDate } from '../../lib/jobsDocuments/demandLetter'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { lienPropertyOwnerDisplayName, resolveLienProperty } from '../../lib/jobs/lienProperty'
import { canSendLienOnWord, holdUntilFor, isLienLeader, isLienOffice, submitOutcome } from '../../lib/jobs/lienDesk'
import { contractEndedWords, paymentBondWords, retainageDeadlineWords, type LienRetainageEntry } from '../../lib/jobs/lienDeskRetainage'
import { approveLienDeskItem, holdLienDeskItem, pullBackLienDeskItem, saveLienDeskDraft, sendLienDeskItemOnWord, submitLienDeskItem } from '../../lib/jobs/lienDeskIo'
import { buildLienRetainageNoticeFieldsForJob, homesteadStatementApplies, lienRetainageCoverNote } from '../../lib/jobs/lienNoticeDraft'
import { runCoverNoteBlocks } from '../../lib/jobs/lienDeskRun'
import type { LienDeskData } from '../../hooks/useLienDeskData'
import { useToastContext } from '../../contexts/ToastContext'

/**
 * The retainage pane of the Lien desk (v2.3753, punch list #33 PR 1): the
 * § 53.057 notice of claim for unpaid retainage — its gate (owner of record,
 * the GC, the day our contract on the job ended, the retainage the GC holds),
 * whether a recorded § 53.056 notice already named the retainage (the trap
 * that works now — § 53.081(c) makes a retainage-only notice wait for the
 * affidavit), the paper as the run prints it (counsel's retainage cover note,
 * then the statute's form), and the same draft → approve → send verbs as the
 * monthly notice. Approved ones ride in the desk's run.
 */

const chip = (bg: string, fg: string): React.CSSProperties => ({ display: 'inline-block', padding: '0 6px', borderRadius: 5, fontSize: '0.68rem', fontWeight: 600, lineHeight: '18px', whiteSpace: 'nowrap', background: bg, color: fg, verticalAlign: 'middle' })
const btn = (kind: 'primary' | 'green' | 'amber' | 'plain' = 'plain', disabled = false): React.CSSProperties => ({
  padding: '5px 10px',
  borderRadius: 7,
  border: `1px solid ${kind === 'plain' ? 'var(--border-strong)' : 'transparent'}`,
  background: kind === 'primary' ? 'var(--text-link)' : kind === 'green' ? 'var(--text-green-800)' : kind === 'amber' ? 'var(--text-amber-800)' : 'var(--surface)',
  color: kind === 'plain' ? 'var(--text-700)' : '#fff',
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.55 : 1,
  whiteSpace: 'nowrap',
})
const boxStyle: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 9, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.35rem', background: 'var(--surface)' }
const boxHead: React.CSSProperties = { fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }

export default function LienDeskRetainagePane({
  entry,
  data,
  todayYmd,
  authRole,
  authUserId,
  issuer,
  signerNameFor,
  onChanged,
  onOpenEditJob,
  onOpenRun,
  onShowNotices,
  footerEl,
}: {
  entry: LienRetainageEntry
  data: LienDeskData
  todayYmd: string
  authRole: string | null
  authUserId: string | null
  issuer: PhysicalInvoiceIssuer | null
  signerNameFor: (masterUserId: string | null) => string
  onChanged: () => void
  /** Edit Job — on its Property record row (the owner), or on *Our contract on this job* (the clock, the retainage). */
  onOpenEditJob: (jobId: string, focus: 'property-record' | 'lien-contract') => void
  /** The desk's run — approved retainage notices go out with the monthly ones. */
  onOpenRun: () => void
  /** Switch the desk to the notices kind on this job — where the retainage rides inside the § 53.056 claim. */
  onShowNotices: (jobId: string) => void
  /** The desk's footer strip — the pane portals its footer there (v2.3753). */
  footerEl: HTMLElement | null
}) {
  const { showToast } = useToastContext()
  const leader = isLienLeader(authRole)
  const office = isLienOffice(authRole)
  const canWord = canSendLienOnWord(authRole)
  const [busy, setBusy] = useState(false)
  const [wordOpen, setWordOpen] = useState(false)
  const [wordNote, setWordNote] = useState('')
  const [wordChannel, setWordChannel] = useState<'phone' | 'in_person' | 'text'>('phone')
  const [holdOpen, setHoldOpen] = useState<'promised' | 'call_first' | null>(null)

  const job = data.jobsById[entry.jobId]
  const gc = entry.gcCustomerId ? data.gcsById[entry.gcCustomerId] : undefined
  const address = job?.customer_address_id ? data.addressesById[job.customer_address_id] ?? null : null
  const property = useMemo(() => resolveLienProperty(address ?? null, data.ownerByJob[entry.jobId] ?? null), [address, data.ownerByJob, entry.jobId])
  const ownerName = lienPropertyOwnerDisplayName(property.owner)
  const promise = data.promisesByJob[entry.jobId] ?? null
  const jobNumber = job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—' : '—'
  const label = job ? `${jobNumber}${(job.job_name ?? '').trim() ? ` · ${(job.job_name ?? '').trim()}` : ''}` : entry.jobId.slice(0, 8)
  const item = entry.item && entry.item.status !== 'sent' && entry.item.status !== 'missed' ? entry.item : null
  const endedWords = contractEndedWords(entry.contractEndedHow, entry.contractEndedOn, formatYmdMonthDay)

  const fields = useMemo(
    () =>
      buildLienRetainageNoticeFieldsForJob({
        jobName: job?.job_name,
        jobAddress: job?.job_address,
        originalContractorName: gc?.name ?? '',
        retainageHeld: entry.retainageHeld,
        contactPerson: signerNameFor(job?.master_user_id ?? null),
        issuer,
        todayYmd,
        homesteadStatement: homesteadStatementApplies(property),
      }),
    [job, gc, entry.retainageHeld, signerNameFor, issuer, todayYmd, property],
  )
  const extras = useMemo(
    () => ({ letterhead: filingLetterheadFromIssuer(issuer), refItems: [`Job #${jobNumber}`, entry.contractEndedOn ? `Our contract ${entry.contractEndedHow ?? 'ended'} ${demandDate(entry.contractEndedOn)}` : '', demandDate(todayYmd)].filter(Boolean) }),
    [issuer, jobNumber, entry.contractEndedOn, entry.contractEndedHow, todayYmd],
  )
  const coverHtml = useMemo(
    () => filingDocHtml(runCoverNoteBlocks({ kind: 'retainage_53_057', label, months: [], fields, extras, coverNote: lienRetainageCoverNote(fields.claimantName, { inClaim: entry.inClaim, endedHow: entry.contractEndedHow }), coverLetter: null })),
    [label, fields, extras, entry.inClaim, entry.contractEndedHow],
  )
  const docHtml = useMemo(() => filingDocHtml(buildLienRetainageNoticeBlocks(fields, extras)), [fields, extras])

  const run = async (labelText: string, fn: () => Promise<void>, done: string) => {
    if (busy) return
    setBusy(true)
    try {
      await fn()
      showToast(done, 'success')
      onChanged()
    } catch (e) {
      showToast(e instanceof Error && e.message ? `${labelText}: ${e.message}` : `${labelText} failed.`, 'error')
    } finally {
      setBusy(false)
    }
  }
  const ensureDraft = () => saveLienDeskDraft({ itemId: item?.id ?? null, jobId: entry.jobId, months: [], fields: { notice: fields, gcEmail: gc?.email ?? '' }, coverNote: true, userId: authUserId, kind: 'retainage_53_057' })
  const policy = gc?.policy ?? 'ask'
  const submit = () =>
    run(
      'Send for approval',
      async () => {
        const id = await ensureDraft()
        await submitLienDeskItem(id, submitOutcome({ policy, earliestDeadline: entry.deadline }, { promiseYmd: promise?.promisedYmd ?? null, gcHasPriorNotice: Boolean(entry.gcCustomerId && data.gcsWithPriorNotice.has(entry.gcCustomerId)), gcHeldBefore: Boolean(entry.gcCustomerId && data.gcsHeldBefore.has(entry.gcCustomerId)) }, todayYmd))
      },
      policy === 'send' && !promise ? 'Approved by the standing rule — in the run.' : 'Sent for approval.',
    )
  const sendOnWord = () => run('Send on the leader’s word', async () => void (await sendLienDeskItemOnWord(await ensureDraft(), { note: wordNote, channel: wordChannel })), 'Recorded on the leader’s word — in the run.')
  const approve = () => run('Approve', async () => void (await approveLienDeskItem(item ? item.id : await ensureDraft())), 'Approved — in the run.')
  const hold = (reason: 'promised' | 'call_first') => run('Hold', async () => void (item && (await holdLienDeskItem(item.id, { reason, until: holdUntilFor(reason, entry.deadline, promise?.promisedYmd ?? null, todayYmd) }))), 'Held — the desk re-asks before the window closes.')
  const pullBack = () => run('Pull back', async () => void (item && (await pullBackLienDeskItem(item.id, authUserId))), 'Back in the office’s drafts.')

  // ---------- footer ----------
  let footer: React.ReactNode = null
  const fuse = entry.deadline ? <span style={{ color: 'var(--text-red-600)' }}>The § 53.057 window on {label} closes {demandDate(entry.deadline)}.</span> : null
  if (entry.pile === 'clock_not_started') {
    footer = (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        <span>No clock yet — the 30 days start the day our contract on this job is complete, terminated or abandoned. Type that day on the job the day it happens; do not wait for {gc?.name ?? 'the GC'} to declare it.</span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => onOpenEditJob(entry.jobId, 'lien-contract')} disabled={!office} style={btn('primary', !office)}>Set the day our contract ended ›</button>
      </div>
    )
  } else if (entry.pile === 'needs_owner' || entry.pile === 'to_draft') {
    const blocked = !entry.ready
    footer = wordOpen ? (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem' }}>
        <span>Who said it, when, and how:</span>
        <input value={wordNote} onChange={(ev) => setWordNote(ev.target.value)} placeholder="Robert, today 9:10" aria-label="Who said it and when" style={{ flex: '1 1 180px', padding: '4px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.8125rem' }} />
        {(['phone', 'in_person', 'text'] as const).map((c) => (
          <label key={c} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 6, background: wordChannel === c ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)' }}>
            <input type="radio" name="ret-word-channel" checked={wordChannel === c} onChange={() => setWordChannel(c)} />
            {c === 'phone' ? 'by phone' : c === 'in_person' ? 'in person' : 'by text'}
          </label>
        ))}
        <button type="button" onClick={sendOnWord} disabled={busy || !wordNote.trim()} style={btn('amber', busy || !wordNote.trim())}>Record it ▸</button>
        <button type="button" onClick={() => setWordOpen(false)} style={btn('plain')}>Cancel</button>
      </div>
    ) : (
      <>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          ✉ Certified mail to <strong style={{ color: 'var(--text-700)' }}>{ownerName || 'the owner of record'}</strong> and <strong style={{ color: 'var(--text-700)' }}>{gc?.name ?? 'the original contractor'}</strong> · {blocked ? 'Blocked until every gate above is clear.' : policy === 'send' && !promise ? `${gc?.name ?? 'This GC'} has a standing "send" rule — approved on submit, into the run.` : promise ? `They promised ${formatYmdMonthDay(promise.promisedYmd)} — the leader decides between paper and their word.` : 'Goes to the leader, then out with the run.'} {fuse}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ flex: 1 }} />
          {canWord ? <button type="button" onClick={() => { setWordNote(`the leader, ${demandDate(todayYmd)}`); setWordOpen(true) }} disabled={busy || blocked} style={btn('amber', busy || blocked)}>The leader said to send it ▸</button> : null}
          {leader ? (
            <button type="button" onClick={approve} disabled={busy || blocked} style={btn('green', busy || blocked)}>Approve ▸</button>
          ) : (
            <button type="button" onClick={submit} disabled={busy || blocked || !office} style={btn('primary', busy || blocked || !office)}>Send for approval ▸</button>
          )}
        </div>
      </>
    )
  } else if (entry.pile === 'awaiting') {
    footer = leader ? (
      holdOpen ? (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem' }}>
          <span>Holds until <strong>{formatYmdMonthDay(holdUntilFor(holdOpen, entry.deadline, promise?.promisedYmd ?? null, todayYmd))}</strong>, then asks again. {fuse}</span>
          <button type="button" onClick={() => hold(holdOpen)} disabled={busy} style={btn('amber', busy)}>Hold</button>
          <button type="button" onClick={() => setHoldOpen(null)} style={btn('plain')}>Cancel</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={() => setHoldOpen('promised')} disabled={busy} style={btn('plain', busy)}>Hold — they promised…</button>
          <button type="button" onClick={() => setHoldOpen('call_first')} disabled={busy} style={btn('plain', busy)}>Hold — I'll call first</button>
          <button type="button" onClick={pullBack} disabled={busy} style={btn('plain', busy)}>Back to the office</button>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={approve} disabled={busy} style={btn('green', busy)}>Approve ▸</button>
        </div>
      )
    ) : (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        <span>Waiting on the leader since {item?.submitted_at ? demandDate(item.submitted_at.slice(0, 10)) : '—'}. {fuse}</span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={pullBack} disabled={busy || !office} style={btn('plain', busy || !office)}>Pull back to draft</button>
      </div>
    )
  } else if (entry.pile === 'ready') {
    footer = (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        <span>{item?.approval_mode === 'word' ? `On the leader's word — ${item.word_note}.` : item?.approval_mode === 'rule' ? `Approved by ${gc?.name ?? 'the GC'}'s standing rule.` : 'Approved.'} In the run — it goes out with the monthly notices, one envelope per name and address. {fuse}</span>
        {leader && item?.approval_mode === 'word' ? <button type="button" onClick={pullBack} disabled={busy} style={btn('plain', busy)}>Not what I said</button> : null}
        <span style={{ flex: 1 }} />
        <button type="button" onClick={onOpenRun} disabled={!office} style={btn('primary', !office)}>Send the run ▸</button>
      </div>
    )
  } else if (entry.pile === 'held') {
    footer = (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        <span>Held{item?.hold_reason === 'promised' ? ' — they promised' : " — the leader will call first"} · asks again {item?.hold_until ? demandDate(item.hold_until) : ''}. {fuse}</span>
        <span style={{ flex: 1 }} />
        {leader ? <button type="button" onClick={approve} disabled={busy} style={btn('green', busy)}>Release the hold and approve ▸</button> : null}
        <button type="button" onClick={pullBack} disabled={busy || !office} style={btn('plain', busy || !office)}>Back to draft</button>
      </div>
    )
  } else if (entry.pile === 'sent') {
    footer = (
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        Sent{entry.item?.sent_at ? ` ${demandDate(entry.item.sent_at.slice(0, 10))}` : ''} · the notice is on the job's lien instruments.{entry.inClaim ? '' : ' The owner may withhold this retainage once they receive a copy of the filed affidavit (§ 53.081(c)) — the Affidavits tab is watching this job.'}
      </div>
    )
  } else if (entry.pile === 'missed') {
    footer = <div style={{ fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>The § 53.057 window closed {entry.deadline ? demandDate(entry.deadline) : ''} with nothing sent. {entry.inClaim ? 'The retainage was named in a § 53.056 notice, so the claim on it stands to that extent (§ 53.057(f)).' : 'Talk to the attorney about what the lien can still reach.'}</div>
  }
  const tone = entry.severity === 'red' ? chip('var(--bg-red-tint)', 'var(--text-red-600)') : entry.severity === 'amber' ? chip('var(--bg-amber-tint)', 'var(--text-amber-800)') : chip('var(--bg-subtle)', 'var(--text-muted)')

  return (
    <>
    {footerEl && footer ? createPortal(footer, footerEl) : null}
    <div style={{ padding: '0.9rem 1.1rem', display: 'grid', gap: '0.7rem', alignContent: 'start', overflow: 'auto', minWidth: 0 }} data-lien-retainage-pane>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.6rem', alignItems: 'baseline' }}>
        <strong style={{ fontSize: '1rem' }}>{label}</strong>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>· GC {gc?.name ?? ''} {job?.job_address ? `· ${job.job_address}` : ''}</span>
        <span style={tone}>§ 53.057 · {retainageDeadlineWords(entry, formatYmdMonthDay)}</span>
        <span style={chip(entry.paymentBond === 'yes' ? 'var(--bg-amber-tint)' : 'var(--bg-subtle)', entry.paymentBond === 'yes' ? 'var(--text-amber-800)' : 'var(--text-muted)')}>{paymentBondWords(entry.paymentBond)}</span>
      </div>
      <div style={boxStyle}>
        <div style={boxHead}>Before this notice can go (§ 53.057 · 30 days from the day our contract on the job ended · {endedWords})</div>
        <div style={{ display: 'grid', gap: '0.25rem', fontSize: '0.8125rem' }}>
          {entry.gates.map((g) => (
            <div key={g.key} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, color: g.ok ? 'var(--text-green-800)' : 'var(--text-red-600)' }}>{g.ok ? '✓' : '✗'}</span>
              <span>
                {g.label}
                {g.key === 'owner' && ownerName ? ` — ${ownerName}` : ''}
                {g.key === 'gc' && gc?.name ? ` — ${gc.name}` : ''}
                {g.key === 'retainage' && entry.retainageHeld > 0 ? ` — ${formatUsdNoCents(entry.retainageHeld)}` : ''}
              </span>
              {!g.ok && g.key === 'owner' ? <button type="button" onClick={() => onOpenEditJob(entry.jobId, 'property-record')} style={{ ...btn('plain'), padding: '1px 8px', fontSize: '0.72rem' }}>Property record ›</button> : null}
              {(g.key === 'contract_ended' || g.key === 'retainage') && office ? <button type="button" onClick={() => onOpenEditJob(entry.jobId, 'lien-contract')} style={{ ...btn('plain'), padding: '1px 8px', fontSize: '0.72rem' }}>{g.ok ? 'Change ›' : 'Set on the job ›'}</button> : null}
            </div>
          ))}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} data-lien-retainage-claim>
          Retainage the notice claims: <strong style={{ color: 'var(--text-700)' }}>{formatUsdNoCents(entry.retainageHeld)}</strong> · still unpaid on this job {formatUsdNoCents(entry.openBalance)}
        </div>
      </div>
      <div style={{ ...boxStyle, background: entry.inClaim ? 'var(--bg-green-tint)' : 'var(--bg-amber-tint)', borderColor: entry.inClaim ? 'var(--border-green)' : 'var(--border-amber)' }} data-lien-retainage-in-claim={entry.inClaim ? 'yes' : 'no'}>
        <div style={boxHead}>{entry.inClaim ? 'Already inside a § 53.056 claim' : 'Not yet inside a § 53.056 claim'}</div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>
          {entry.inClaim
            ? 'A recorded monthly notice on this job named this retainage in its claim, so the owner may already withhold it from the original contractor (§ 53.081(b)). This form is belt and suspenders — counsel says send it inside the 30 days anyway.'
            : 'No recorded monthly notice on this job has named this retainage. On a § 53.057 notice alone the owner may withhold only once they receive a copy of our filed lien affidavit (§ 53.081(c)) — the money is not trapped until then. Counsel: name the retainage inside the next § 53.056 claim while the job is open; the desk does that on its own once the figure is on the job.'}
        </div>
        {!entry.inClaim ? (
          <div>
            <button type="button" onClick={() => onShowNotices(entry.jobId)} style={{ ...btn('plain'), padding: '1px 8px', fontSize: '0.72rem' }}>The monthly notices on this job ›</button>
          </div>
        ) : null}
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Page 1 of 2 · cover note (counsel's retainage cover, 2026-09-22)</div>
      <div data-theme="light" style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '1.1rem 1.4rem' }}>
        <div dangerouslySetInnerHTML={{ __html: coverHtml }} />
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Page 2 of 2 · the form, as § 53.057(a-2) prescribes it</div>
      <div data-theme="light" style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '1.1rem 1.4rem' }}>
        <div dangerouslySetInnerHTML={{ __html: docHtml }} />
      </div>
    </div>
    </>
  )
}
