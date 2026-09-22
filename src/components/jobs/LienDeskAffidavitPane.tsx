import { useMemo, useState } from 'react'
import type { PhysicalInvoiceIssuer } from '../../lib/physicalInvoiceIssuer'
import { buildLienAffidavitBlocks, filingDocHtml, filingLetterheadFromIssuer } from '../../lib/jobsDocuments/lienFilingDocuments'
import { demandDate } from '../../lib/jobsDocuments/demandLetter'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { lienPropertyOwnerDisplayName, resolveLienProperty } from '../../lib/jobs/lienProperty'
import { workMonthLabel, type JobWorkMonths } from '../../lib/jobs/forecastWorkMonths'
import { buildLienMonthHistory } from '../../lib/jobs/lienMonthHistory'
import { affidavitMonthRows, affidavitMonthsSentence } from '../../lib/jobs/affidavitMonths'
import { claimDeltaWords, correctedClaim, correctionSetWords } from '../../lib/jobs/lienClaimCorrection'
import { daysBetweenYmd } from '../../lib/jobs/billedExpectedPay'
import { canSendLienOnWord, holdUntilFor, isLienLeader, isLienOffice, submitOutcome } from '../../lib/jobs/lienDesk'
import type { LienAffidavitEntry } from '../../lib/jobs/lienDeskAffidavits'
import { approveLienDeskItem, holdLienDeskItem, pullBackLienDeskItem, saveLienDeskDraft, sendLienDeskItemOnWord, submitLienDeskItem } from '../../lib/jobs/lienDeskIo'
import { buildLienAffidavitFieldsForJob, buildLienNoticeFieldsForJob, homesteadStatementApplies } from '../../lib/jobs/lienNoticeDraft'
import type { LienDeskData } from '../../hooks/useLienDeskData'
import { useToastContext } from '../../contexts/ToastContext'

/**
 * The affidavit pane of the Lien desk (v2.3412): the § 53.052 gate (owner of
 * record, county + legal description, a recorded notice on sub jobs, not a
 * homestead), the affidavit as the Lien window will print it, and the same
 * draft → approve → file verbs as notices. "Filed" is recorded in the Lien
 * window (print for notarization, file with the clerk, record the filing);
 * a filed affidavit still unpaid hands the account to the Legal desk.
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

export function affidavitDeadlineWords(e: LienAffidavitEntry): string {
  if (e.daysLeft < 0) return 'window closed'
  if (e.daysLeft === 0) return 'file today'
  if (e.daysLeft === 1) return 'file by tomorrow'
  if (e.daysLeft <= 14) return `file in ${e.daysLeft}d`
  return `file by ${formatYmdMonthDay(e.deadline)}`
}

export default function LienDeskAffidavitPane({
  entry,
  data,
  workMonths = null,
  todayYmd,
  authRole,
  authUserId,
  issuer,
  signerNameFor,
  onChanged,
  onOpenEditJob,
  onOpenLienAffidavit,
  onOpenLegalDesk,
  onShowNotices,
  footerSlot,
}: {
  entry: LienAffidavitEntry
  data: LienDeskData
  /** The job's work months (the forecast kernel) — the months card (v2.3681) needs them; null while loading. */
  workMonths?: JobWorkMonths | null
  todayYmd: string
  authRole: string | null
  authUserId: string | null
  issuer: PhysicalInvoiceIssuer | null
  signerNameFor: (masterUserId: string | null) => string
  onChanged: () => void
  onOpenEditJob: (jobId: string) => void
  /** The Lien window on its affidavit tab — print for notarization, file, record. */
  onOpenLienAffidavit: (jobId: string) => void
  onOpenLegalDesk?: () => void
  /** Switch the desk to the notices kind on this job (the notice gate's door). */
  onShowNotices: (jobId: string) => void
  /** The pane renders its footer through this so the desk keeps one footer strip. */
  footerSlot: (node: React.ReactNode) => void
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
  const label = job ? `${effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—'}${(job.job_name ?? '').trim() ? ` · ${(job.job_name ?? '').trim()}` : ''}` : entry.jobId.slice(0, 8)
  const item = entry.item && entry.item.status !== 'sent' && entry.item.status !== 'missed' ? entry.item : null
  // The claim set by hand (v2.3682) carries to the affidavit: it swears to the app's balance less the correction.
  const correction = data.claimCorrectionsByJob[entry.jobId] ?? null
  const claimed = correctedClaim(entry.openBalance, correction)

  const fields = useMemo(
    () =>
      buildLienAffidavitFieldsForJob({
        jobName: job?.job_name,
        jobAddress: job?.job_address,
        isSub: entry.isSub,
        originalContractorName: gc?.name ?? '',
        originalContractorAddress: gc?.address ?? '',
        ownerName,
        ownerAddress: property.owner.mailingAddress,
        county: property.county,
        legalDescription: property.legalDescription,
        customerName: job?.customer_name,
        revenue: Number(job?.revenue ?? 0),
        paymentsMade: Number(job?.payments_made ?? 0),
        claimAmountOff: correction?.amountOff,
        lastMonth: entry.lastMonth,
        noticesRecorded: entry.gates.find((g) => g.key === 'notice')?.ok ?? false,
        contactPerson: signerNameFor(job?.master_user_id ?? null),
        issuer,
      }),
    [job, entry, gc, ownerName, property, signerNameFor, issuer, correction],
  )
  const docHtml = useMemo(
    () => filingDocHtml(buildLienAffidavitBlocks(fields, { letterhead: filingLetterheadFromIssuer(issuer), refItems: [`Job #${job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) : ''}`, `Last work month ${entry.lastMonth}`, demandDate(todayYmd)] })),
    [fields, issuer, job, entry.lastMonth, todayYmd],
  )

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
  const draftFields = () => ({ notice: buildLienNoticeFieldsForJob({ jobName: job?.job_name, jobAddress: job?.job_address, homesteadStatement: homesteadStatementApplies(property), originalContractorName: gc?.name ?? '', openBalance: claimed.claim, contactPerson: fields.claimantPersonName, issuer, todayYmd }), gcEmail: gc?.email ?? '' })
  const ensureDraft = () => saveLienDeskDraft({ itemId: item?.id ?? null, jobId: entry.jobId, months: [entry.lastMonth], fields: draftFields(), coverNote: false, userId: authUserId, kind: 'affidavit' })
  const policy = gc?.policy ?? 'ask'
  const submit = () =>
    run(
      'Send for approval',
      async () => {
        const id = await ensureDraft()
        await submitLienDeskItem(id, submitOutcome({ policy, earliestDeadline: entry.deadline }, { promiseYmd: promise?.promisedYmd ?? null, gcHasPriorNotice: Boolean(entry.gcCustomerId && data.gcsWithPriorNotice.has(entry.gcCustomerId)), gcHeldBefore: Boolean(entry.gcCustomerId && data.gcsHeldBefore.has(entry.gcCustomerId)) }, todayYmd))
      },
      policy === 'send' && !promise ? 'Approved by the standing rule — ready to file.' : 'Sent for approval.',
    )
  const sendOnWord = () => run('Send on the leader’s word', async () => void (await sendLienDeskItemOnWord(await ensureDraft(), { note: wordNote, channel: wordChannel })), 'Recorded on the leader’s word — ready to file.')
  const approve = () => run('Approve', async () => void (await approveLienDeskItem(item ? item.id : await ensureDraft())), 'Approved — ready to file.')
  const hold = (reason: 'promised' | 'call_first') => run('Hold', async () => void (item && (await holdLienDeskItem(item.id, { reason, until: holdUntilFor(reason, entry.deadline, promise?.promisedYmd ?? null, todayYmd) }))), 'Held — the desk re-asks before the window closes.')
  const pullBack = () => run('Pull back', async () => void (item && (await pullBackLienDeskItem(item.id, authUserId))), 'Back in the office’s drafts.')

  // ---------- footer ----------
  let footer: React.ReactNode = null
  const forfeit = <span style={{ color: 'var(--text-red-600)' }}>The lien right on {label} ends {demandDate(entry.deadline)}.</span>
  if (entry.pile === 'needs_property' || entry.pile === 'to_draft') {
    const blocked = !entry.ready
    footer = wordOpen ? (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem' }}>
        <span>Who said it, when, and how:</span>
        <input value={wordNote} onChange={(ev) => setWordNote(ev.target.value)} placeholder="Robert, today 9:10" aria-label="Who said it and when" style={{ flex: '1 1 180px', padding: '4px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.8125rem' }} />
        {(['phone', 'in_person', 'text'] as const).map((c) => (
          <label key={c} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 6, background: wordChannel === c ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)' }}>
            <input type="radio" name="aff-word-channel" checked={wordChannel === c} onChange={() => setWordChannel(c)} />
            {c === 'phone' ? 'by phone' : c === 'in_person' ? 'in person' : 'by text'}
          </label>
        ))}
        <button type="button" onClick={sendOnWord} disabled={busy || !wordNote.trim()} style={btn('amber', busy || !wordNote.trim())}>Record it ▸</button>
        <button type="button" onClick={() => setWordOpen(false)} style={btn('plain')}>Cancel</button>
      </div>
    ) : (
      <>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {blocked ? `Blocked until every gate above is clear.` : policy === 'send' && !promise ? `${gc?.name ?? 'This GC'} has a standing "send" rule — approved on submit.` : promise ? `They promised ${formatYmdMonthDay(promise.promisedYmd)} — the leader decides between filing and their word.` : `Goes to the leader — an affidavit is sworn and filed at the county; he signs it.`} {forfeit}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ flex: 1 }} />
          {canWord ? <button type="button" onClick={() => { setWordNote(`the leader, ${demandDate(todayYmd)}`); setWordOpen(true) }} disabled={busy || blocked} style={btn('amber', busy || blocked)}>The leader said to file it ▸</button> : null}
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
          <span>Holds until <strong>{formatYmdMonthDay(holdUntilFor(holdOpen, entry.deadline, promise?.promisedYmd ?? null, todayYmd))}</strong>, then asks again. {forfeit}</span>
          <button type="button" onClick={() => hold(holdOpen)} disabled={busy} style={btn('amber', busy)}>Hold</button>
          <button type="button" onClick={() => setHoldOpen(null)} style={btn('plain')}>Cancel</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={() => setHoldOpen('promised')} disabled={busy} style={btn('plain', busy)}>Hold — they promised…</button>
          <button type="button" onClick={() => setHoldOpen('call_first')} disabled={busy} style={btn('plain', busy)}>Hold — I'll call first</button>
          <button type="button" onClick={pullBack} disabled={busy} style={btn('plain', busy)}>Back to the office</button>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={approve} disabled={busy} style={btn('green', busy)}>Approve — file it ▸</button>
        </div>
      )
    ) : (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        <span>Waiting on the leader since {item?.submitted_at ? demandDate(item.submitted_at.slice(0, 10)) : '—'}. {forfeit}</span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={pullBack} disabled={busy || !office} style={btn('plain', busy || !office)}>Pull back to draft</button>
      </div>
    )
  } else if (entry.pile === 'ready') {
    footer = (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        <span>
          {item?.approval_mode === 'word' ? `On the leader's word — ${item.word_note}.` : item?.approval_mode === 'rule' ? `Approved by ${gc?.name ?? 'the GC'}'s standing rule.` : 'Approved.'} Print it for notarization, sign before a notary, file it with the County Clerk in {property.county || 'the property’s county'}, then record the filing — the Lien window does all three. {forfeit}
        </span>
        {leader && item?.approval_mode === 'word' ? <button type="button" onClick={pullBack} disabled={busy} style={btn('plain', busy)}>Not what I said</button> : null}
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => onOpenLienAffidavit(entry.jobId)} disabled={!office} style={btn('primary', !office)}>Open the affidavit tab ›</button>
      </div>
    )
  } else if (entry.pile === 'held') {
    footer = (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        <span>Held{item?.hold_reason === 'promised' ? ' — they promised' : " — the leader will call first"} · asks again {item?.hold_until ? demandDate(item.hold_until) : ''}. {forfeit}</span>
        <span style={{ flex: 1 }} />
        {leader ? <button type="button" onClick={approve} disabled={busy} style={btn('green', busy)}>Release the hold and approve ▸</button> : null}
        <button type="button" onClick={pullBack} disabled={busy || !office} style={btn('plain', busy || !office)}>Back to draft</button>
      </div>
    )
  } else if (entry.pile === 'filed') {
    footer = (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        <span>Filed{item?.sent_at ? ` ${demandDate(item.sent_at.slice(0, 10))}` : ''} · a copy must reach the owner and the contractor by the 5th day after filing (§ 53.055) — the Lien window records the service. {entry.openBalance > 0 ? 'Still unpaid: the account is the Legal desk’s next.' : ''}</span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => onOpenLienAffidavit(entry.jobId)} style={btn('plain')}>Record service ›</button>
        {onOpenLegalDesk && entry.openBalance > 0 ? <button type="button" onClick={onOpenLegalDesk} style={btn('primary')}>Refer to the Legal desk ›</button> : null}
      </div>
    )
  } else if (entry.pile === 'missed') {
    footer = <div style={{ fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>The affidavit window closed {demandDate(entry.deadline)} with nothing filed — the lien right on {label} is gone. {entry.openBalance > 0 && onOpenLegalDesk ? <button type="button" onClick={onOpenLegalDesk} style={{ ...btn('plain'), marginLeft: 8 }}>The Legal desk ›</button> : null}</div>
  }
  footerSlot(footer)

  return (
    <div style={{ padding: '0.9rem 1.1rem', display: 'grid', gap: '0.7rem', alignContent: 'start', overflow: 'auto', minWidth: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.6rem', alignItems: 'baseline' }}>
        <strong style={{ fontSize: '1rem' }}>{label}</strong>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{entry.isSub ? `· GC ${gc?.name ?? ''}` : '· contracted with the owner'} {job?.job_address ? `· ${job.job_address}` : ''}</span>
        <span style={chip(entry.severity === 'red' ? 'var(--bg-red-tint)' : entry.severity === 'amber' ? 'var(--bg-amber-tint)' : 'var(--bg-subtle)', entry.severity === 'red' ? 'var(--text-red-600)' : entry.severity === 'amber' ? 'var(--text-amber-800)' : 'var(--text-muted)')}>
          affidavit · {affidavitDeadlineWords(entry)}
        </span>
      </div>
      <div style={boxStyle}>
        <div style={boxHead}>Before this affidavit can be generated (§ 53.052 · window from {workMonthLabel(entry.lastMonth)}, the last month worked)</div>
        <div style={{ display: 'grid', gap: '0.25rem', fontSize: '0.8125rem' }}>
          {entry.gates.map((g) => (
            <div key={g.key} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, color: g.ok ? 'var(--text-green-800)' : 'var(--text-red-600)' }}>{g.ok ? '✓' : '✗'}</span>
              <span>{g.label}{g.key === 'owner' && ownerName ? ` — ${ownerName}` : ''}{g.key === 'legal' && property.county ? ` — ${property.county}` : ''}</span>
              {!g.ok && (g.key === 'owner' || g.key === 'legal') ? <button type="button" onClick={() => onOpenEditJob(entry.jobId)} style={{ ...btn('plain'), padding: '1px 8px', fontSize: '0.72rem' }}>Property record ›</button> : null}
              {!g.ok && g.key === 'notice' ? <button type="button" onClick={() => onShowNotices(entry.jobId)} style={{ ...btn('plain'), padding: '1px 8px', fontSize: '0.72rem' }}>Send the notice first ›</button> : null}
            </div>
          ))}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Claim: <strong style={{ color: 'var(--text-700)' }}>{formatUsdNoCents(claimed.claim)}</strong>{claimed.corrected ? <span style={{ color: 'var(--text-amber-800)' }}> set by hand{claimDeltaWords(claimed.delta, entry.openBalance) ? `, ${claimDeltaWords(claimed.delta, entry.openBalance)}` : ''}</span> : <> unpaid of {formatUsdNoCents(Number(job?.revenue ?? 0))}</>} · {entry.propertyKind === 'residential' ? 'residential (3rd-month window)' : entry.propertyKind ? 'commercial (4th-month window)' : 'property kind unknown — commercial window shown'}
        </div>
      </div>
      {/* Which months the lien will cover (v2.3681): a month whose notice window closed with nothing sent is worked but unsecured — named here, left off the lien, never re-dated. */}
      {entry.isSub && workMonths && workMonths.months.length ? (() => {
        const rpcMonths = data.rows
          .filter((r) => r.job_id === entry.jobId)
          .map((r) => ({ key: r.work_month, approvedHours: Number(r.approved_hours) || 0, deadline: r.deadline, daysLeft: daysBetweenYmd(todayYmd, r.deadline) ?? 0, noticed: r.noticed }))
        const rows = affidavitMonthRows(workMonths.months, buildLienMonthHistory(entry.jobId, data.items, rpcMonths))
        const tone = (s: (typeof rows)[number]['status']) => (s === 'lien' ? chip('var(--bg-green-tint)', 'var(--text-green-800)') : s === 'open' ? chip('var(--bg-blue-tint)', 'var(--text-blue-800)') : chip('var(--bg-amber-tint)', 'var(--text-amber-800)'))
        const word = (s: (typeof rows)[number]['status']) => (s === 'lien' ? 'on the lien' : s === 'open' ? 'window open' : 'unsecured')
        const unsecured = rows.filter((r) => r.status === 'unsecured')
        return (
          <div style={boxStyle} data-lien-affidavit-months>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.2rem 0.6rem' }}>
              <strong style={{ fontSize: '0.9rem' }}>Months the affidavit claims</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>The lien covers the months a § 53.056 notice went out for. It must state each month the work was performed.</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: '0.3rem 0.8rem', alignItems: 'baseline', fontSize: '0.8125rem' }}>
              {rows
                .filter((r) => r.status !== 'unsecured')
                .map((r) => (
                  <div key={r.key} style={{ display: 'contents' }}>
                    <strong>{workMonthLabel(r.key)}</strong>
                    <span style={{ minWidth: 0 }}>{r.words}</span>
                    <span style={tone(r.status)}>{word(r.status)}</span>
                  </div>
                ))}
            </div>
            {unsecured.length ? (
              <div style={{ display: 'grid', gap: '0.3rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                <span style={boxHead}>Worked, not noticed</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: '0.3rem 0.8rem', alignItems: 'baseline', fontSize: '0.8125rem' }}>
                  {unsecured.map((r) => (
                    <div key={r.key} style={{ display: 'contents' }}>
                      <strong style={{ color: 'var(--text-muted)' }}>{workMonthLabel(r.key)}</strong>
                      <span style={{ minWidth: 0, color: 'var(--text-600)' }}>{r.words}</span>
                      <span style={tone(r.status)}>{word(r.status)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {affidavitMonthsSentence(rows, workMonthLabel)}
              {correction ? (
                <span data-lien-affidavit-claim>
                  {' '}
                  <strong style={{ color: 'var(--text-700)' }}>The affidavit claims {formatUsdNoCents(claimed.claim)}</strong> — the app’s {formatUsdNoCents(entry.openBalance)} {correction.amountOff < 0 ? 'plus' : 'less'} the {correction.carry ? 'carried ' : ''}{formatUsdNoCents(Math.abs(correction.amountOff))} <span style={{ color: 'var(--text-amber-800)' }}>(set by hand, {correctionSetWords(correction, formatYmdMonthDay)})</span>.
                </span>
              ) : null}
            </div>
          </div>
        )
      })() : null}
      <div data-theme="light" style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '1.1rem 1.4rem' }}>
        <div dangerouslySetInnerHTML={{ __html: docHtml }} />
      </div>
    </div>
  )
}
