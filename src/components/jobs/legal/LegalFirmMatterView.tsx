import type { ReactNode } from 'react'
import { COPPER, FAINT, HAIR, INK, MUTED, NOTE_BAND, PAPER_GREEN, PAPER_RED } from '../../../lib/portal/portalTheme'
import { formatLegalMoney, type LegalPacket } from '../../../lib/legal/legalPacket'
import { envelopeAnswersWords, envelopeKindWords, envelopeMonthsWords, envelopeSharesWords, envelopeWentOutWords, type LegalEnvelope } from '../../../lib/legal/legalLienPaper'
import { firmAgreementWords, firmEntryKindWords, firmEntryStatusWords, firmNotNeededWords, firmExhibitTitle, firmFeeKindWords, firmHistoryKindWords, firmJobRecord, firmSaidKindWords, firmSaidRecordedBy } from '../../../lib/legal/legalFirmWords'
import { contingencyEntries, firmDemand, firmFeeEntries, legalRunningLedger } from '../../../lib/legal/legalMoney'
import { conversationRows, conversationStateWords, conversationWho, entryRecordedByWords, isConversationEntry } from '../../../lib/legal/legalAsks'
import { propertyKindCell, propertySourceNote } from '../../../lib/legal/legalProperty'
import LienTimelineStrip from '../LienTimelineStrip'

/**
 * The firm's view of one matter (Legal portal PR 3 → shared in v2.3363): the
 * matter card, the five tabs, and the exhibits — built from a `LegalPacket` and
 * the matter's stored entries. Two callers render it:
 *
 *   - `src/pages/LegalPortal.tsx` — the firm's page, with their acts (fees,
 *     steps, questions, payments received) injected through `acts`.
 *   - the desk's Mark attorney ready sheet — a read-only PREVIEW of exactly
 *     what the firm sees the moment a dev confirms, held entries left out.
 *
 * The packet decides what is shared: `theirWord.timeline[].shared` is the
 * office's curation, so both callers filter the same way and never disagree.
 * Styled on the customer statement's paper (pinned light by the caller).
 */

import { FIRM_TABS, FIRM_TAB_LABELS, portalBtn, portalCap, portalCard, portalH, portalNum, portalTd, portalTh, type FirmMatterLike, type FirmTab } from './legalFirmMatterViewShared'

export function PortalTable({ head, rows, empty, numCols = [], subRows = [] }: { head: string[]; rows: Array<Array<string | number | JSX.Element | null>>; empty: string; numCols?: number[]; /** A full-width row drawn under row i when set (the answers band under a notice, #41 PR 1b). */ subRows?: Array<ReactNode | null> }) {
  if (rows.length === 0) return <p style={{ color: MUTED, fontSize: 13, margin: '4px 0' }}>{empty}</p>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{head.map((x, i) => <th key={`${x}-${i}`} style={{ ...portalTh, ...(numCols.includes(i) ? { textAlign: 'right' } : null) }}>{x}</th>)}</tr></thead>
        <tbody>{rows.flatMap((r, ri) => [
          <tr key={ri}>{r.map((c, ci) => <td key={ci} style={{ ...portalTd, ...(numCols.includes(ci) ? portalNum : null), ...(ci === 0 && head[0] === 'Date' ? { whiteSpace: 'nowrap' } : null) }}>{c}</td>)}</tr>,
          ...(subRows[ri] ? [<tr key={`${ri}-sub`}><td colSpan={head.length} style={{ ...portalTd, paddingTop: 0 }}>{subRows[ri]}</td></tr>] : []),
        ])}</tbody>
      </table>
    </div>
  )
}

/** The GC the owner's answers are about — the payer when the company is the subcontractor. */
function envelopeGcName(packet: LegalPacket): string {
  return packet.account.payer.viaGc ? packet.account.payer.name : 'the GC'
}

/** Under a § 53.056 notice (#41 PR 1b): the owner's answers and the pile, letter two's clock, the GC's written okay. */
function EnvelopeAnswersBand({ e, packet, companyName }: { e: LegalEnvelope; packet: LegalPacket; companyName: string }) {
  if (!e.answers) return null
  const w = envelopeAnswersWords(e.answers, { todayYmd: packet.todayYmd, gcName: envelopeGcName(packet), formatMoney: formatLegalMoney })
  return (
    <div data-legal-envelope-answers={e.key} style={{ background: NOTE_BAND, borderRadius: 6, padding: '6px 10px', fontSize: 12.5, lineHeight: 1.45 }}>
      <div><b>The owner's answers</b> <span style={{ color: MUTED }}>· {w.owner}</span></div>
      <div><b>Letter two</b> <span style={{ color: MUTED }}>· {w.letterTwo}</span> <b style={{ marginLeft: 10 }}>GC's written okay to pay {companyName} directly:</b> <span style={{ color: MUTED }}>{w.gcOkay}</span></div>
    </div>
  )
}

/** A job's record on Account → Jobs (punch list #85, item 4): what is on file, then what is not, in red. */
function JobRecordCell({ job }: { job: LegalPacket['account']['jobs'][number] }) {
  const r = firmJobRecord(job)
  return (
    <span data-legal-job-record={job.jobId}>
      {r.onFile.join(', ')}
      {r.notOnFile.length ? <span style={{ display: 'block', color: PAPER_RED }}>Not on file: {r.notOnFile.join(', ')}</span> : null}
    </span>
  )
}

/** Where each job stands (#41 PR 1): the job's rail and its next line, the desk's own kernel on the firm's paper. */
function JobTimelines({ packet }: { packet: LegalPacket }) {
  const a = packet.account
  if (packet.paper.timelines.length === 0) return <p style={{ color: MUTED, fontSize: 13, margin: '4px 0' }}>No jobs.</p>
  // Each job's own property kind (#85 item 6): two jobs of one matter can stand on a house and a store.
  const kindWordsOf = (jobId: string) => propertyKindCell(a.jobs.find((j) => j.jobId === jobId)?.property?.propertyKind)
  const roleWords = a.payer.viaGc ? `subcontractor under ${a.payer.name}` : 'original contractor'
  return (
    <div>
      {packet.paper.timelines.map((t) => (
        <div key={t.jobId} data-legal-job-timeline={t.jobId} className="legalJobTimeline" style={{ padding: '8px 0', borderBottom: `1px dotted ${HAIR}` }}>
          <div style={{ fontSize: 12.5 }}>
            <b style={{ fontSize: 13 }}>{t.jobLabel}</b>
            <div style={{ color: MUTED, fontSize: 11.5 }}>{kindWordsOf(t.jobId)} · {roleWords}{t.lastWorkYmd ? ` · last on site ${t.lastWorkYmd}` : ''}</div>
            <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatLegalMoney(t.openBalance)} open</div>
            {t.retainageWords ? <div style={{ color: MUTED, fontSize: 11.5 }}>{t.retainageWords}</div> : null}
          </div>
          <LienTimelineStrip timeline={t.timeline} voice="firm" />
        </div>
      ))}
    </div>
  )
}

export function FirmMatterTab({ tab, packet, matter, companyName, acts }: { tab: FirmTab; packet: LegalPacket; matter: FirmMatterLike; companyName: string; acts?: ReactNode }) {
  const a = packet.account
  const h = portalH
  if (tab === 'account') {
    return (
      <div>
        <PortalTable head={['Date', 'Job', 'Entry', 'Amount', 'Balance']} numCols={[3, 4]} rows={legalRunningLedger(a.ledger).map((e) => [e.ymd ?? '—', e.jobLabel, e.text, <span key="a" style={{ color: e.amount < 0 ? PAPER_GREEN : undefined }}>{formatLegalMoney(e.amount)}</span>, formatLegalMoney(e.running)])} empty="No billed lines or payments on record." />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 18, fontSize: 13.5, padding: '8px 8px 0', fontWeight: 700 }}><span style={{ color: MUTED, fontWeight: 400 }}>Balance owed</span><span style={portalNum} data-legal-balance>{formatLegalMoney(a.totals.balance)}</span></div>
        <div style={h}>Who owes</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 12px', fontSize: 13.5 }}>
          <span style={{ color: MUTED }}>Payer</span><span>{a.payer.name}{a.payer.viaGc ? ' · general contractor on the job' : ''}{a.customerType ? ` · ${a.customerType}` : ''}</span>
          <span style={{ color: MUTED }}>Address</span><span>{a.customerAddress || '—'}</span>
          <span style={{ color: MUTED }}>Emails</span><span>{a.emails.join(', ') || 'none on file'}</span>
          <span style={{ color: MUTED }}>Phones</span><span>{a.phones.join(', ') || 'none on file'}</span>
        </div>
        {a.contacts.length ? (<><div style={h}>Contacts</div><PortalTable head={['Name', 'Email', 'Phone']} rows={a.contacts.map((c) => [c.name, c.email ?? '—', c.phone ?? '—'])} empty="" /></>) : null}
        <div style={h}>Jobs</div>
        <PortalTable head={['Job', 'Name', 'Address', 'Age', 'On file', 'Balance']} numCols={[3, 5]} rows={a.jobs.map((j) => [<b key="l">{j.label}</b>, j.name, j.address, j.agingDays == null ? '—' : `${j.agingDays}d`, <JobRecordCell key="r" job={j} />, formatLegalMoney(j.balance)])} empty="No jobs." />
        <div style={h}>Property record</div>
        <PortalTable head={['Job', 'Address', 'County', 'Owner of record', 'Legal description', 'Parcel', 'Kind']} rows={a.properties.map((p) => [<b key="j">{p.jobLabels.join(', ')}</b>, propertySourceNote(p.source) ? <span key="a">{p.address || '—'} <span style={{ color: MUTED }}>· {propertySourceNote(p.source)}</span></span> : p.address, p.county || '—', p.owner || '—', p.legalDescription || '—', p.parcelId || '—', propertyKindCell(p.propertyKind)])} empty="No property record on file." />
      </div>
    )
  }
  if (tab === 'paper') {
    return (
      <div>
        <div style={h}>Agreements</div>
        <PortalTable head={['Job', 'Agreement', '']} rows={a.jobs.map((j) => {
          const c = matter.contracts.find((x) => x.job_id === j.jobId && x.signedPdfUrl)
          const g = firmAgreementWords(j.contract)
          return [<b key="l">{j.label}</b>, <span key="s" style={{ color: g.missing ? PAPER_RED : undefined }}>{g.words}</span>, c ? <a key="p" href={c.signedPdfUrl as string} target="_blank" rel="noreferrer" style={{ color: COPPER }}>PDF ↗</a> : null]
        })} empty="No jobs." />
        <p style={{ fontSize: 12, color: MUTED, margin: '6px 0 0' }}>Each job's bill, field record and any dispute are on Account, under Jobs.</p>
        <div style={h}>Where each job stands</div>
        <JobTimelines packet={packet} />
        <div style={h}>Final demand letters</div>
        <PortalTable head={['Job', 'Sent', 'Method', 'Tracking', 'Deadline', 'Amount']} numCols={[5]} rows={packet.paper.demandLetters.map((d) => [<b key="l">{d.jobLabel}</b>, d.sentYmd ?? 'not sent', d.method, d.tracking || '—', `${d.deadlineYmd ?? '—'}${d.deadlinePassed ? ' · passed' : ''}`, formatLegalMoney(d.amount)])} empty="No demand letter sent before referral." />
        <div style={h}>The paper that went out</div>
        <PortalTable head={['', 'Paper', 'Went out', 'Claim', 'Months as printed', 'Jobs and shares', 'County · recording', 'Copy']} numCols={[3]} rows={packet.paper.envelopes.map((e) => [<b key="a" style={{ color: COPPER }}>{e.letter}</b>, envelopeKindWords(e), envelopeWentOutWords(e, packet.todayYmd), <b key="c">{formatLegalMoney(e.claim)}</b>, envelopeMonthsWords(e) || '—', envelopeSharesWords(e, formatLegalMoney), [e.county, e.recordingNumber].filter(Boolean).join(' · ') || '—', e.documentUrl ? <a key="d" href={e.documentUrl} target="_blank" rel="noreferrer" style={{ color: COPPER }}>open ↗</a> : '—'])} subRows={packet.paper.envelopes.map((e) => (e.answers ? <EnvelopeAnswersBand key={e.key} e={e} packet={packet} companyName={companyName} /> : null))} empty="No § 53.056 notice, affidavit or release recorded." />
        <p style={{ fontSize: 12, color: MUTED, margin: '6px 0 0' }}>A month marked <i>as information</i> was named on the paper after its own notice window had closed; it is not in the claim. Under a notice: the owner's answers to the letter's three questions, whether the second owner letter is due or sent, and any written okay from the GC for the owner to pay {companyName} directly. Dates above are the app's reading of Chapter 53 from each job's last day on site and the property kind.</p>
      </div>
    )
  }
  if (tab === 'their_word') {
    const tw = packet.theirWord
    // #85 item 29: everything goes unless held; the firm sees how many were held, never what or why.
    const held = Math.max(matter.heldCount ?? 0, tw.heldCount)
    return (
      <div>
        <p style={{ fontSize: 12.5, color: MUTED, margin: '4px 0 8px' }}>{companyName}'s contact record with this customer, oldest first. Calls, emails, visits, promises to pay and the note that sent it to collections.{tw.decided ? ` Promises kept: ${tw.kept} of ${tw.decided}${tw.broken ? `, ${tw.broken} broken` : ''}.` : ''}</p>
        <PortalTable head={['Date', 'Kind', 'Job', 'What was said', 'Recorded by']} rows={tw.timeline.filter((e) => e.shared).map((e) => [e.ymd, firmSaidKindWords(e.kind), e.jobLabel ?? 'account', e.text, firmSaidRecordedBy(e)])} empty="No contact on record." />
        {held > 0 ? <p data-legal-held-count style={{ fontSize: 12.5, margin: '8px 0 0' }}>The office held back <b>{held} entr{held === 1 ? 'y' : 'ies'}</b>. Ask the office if you need {held === 1 ? 'it' : 'them'}.</p> : null}
      </div>
    )
  }
  if (tab === 'evidence') {
    return (
      <div>
        <PortalTable head={['Job', 'Field reports', 'Clock sessions', 'Hours', 'Worked', 'Job notes']} numCols={[3]} rows={packet.evidence.map((e) => [<b key="l">{e.jobLabel}</b>, `${e.reports} (${e.reportsWithGps} with GPS)`, `${e.sessions} (${e.approvedSessions} approved, ${e.sessionsWithGps} with GPS)`, `${e.hours}h`, e.firstWorkYmd ? `${e.firstWorkYmd} → ${e.lastWorkYmd}` : '—', String(e.threadNotes)])} empty="No jobs." />
        <p style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>Rejected and revoked clock sessions are left out. Individual reports and sessions come with the printed packet; ask the office for the originals.</p>
      </div>
    )
  }
  const fees = firmFeeEntries(matter.entries)
  const feesTotal = firmDemand(0, matter.entries).feesTotal
  const contingency = contingencyEntries(matter.entries)
  // #85 item 17: questions and answers leave the steps table for the conversation, each answer under its question.
  const steps = matter.entries.filter((e) => e.kind !== 'fee' && e.kind !== 'cost' && !isConversationEntry(e))
  const talk = conversationRows(matter.entries)
  return (
    <div>
      <div style={h}>Fees and costs</div>
      <PortalTable head={['Date', 'Kind', 'Note', 'By', 'Amount']} numCols={[4]} rows={fees.map((e) => [e.occurred_on, firmFeeKindWords(e.kind), e.body, entryRecordedByWords(e, 'firm'), formatLegalMoney(Number(e.amount ?? 0))])} empty="None yet." />
      {fees.length ? <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 18, fontSize: 13.5, padding: '8px 8px 0', fontWeight: 700 }}><span style={{ color: MUTED, fontWeight: 400 }}>Fees and costs in the demand</span><span style={portalNum}>{formatLegalMoney(feesTotal)}</span></div> : null}
      {contingency.length ? <p data-legal-contingency style={{ fontSize: 12.5, color: MUTED, margin: '6px 0 0' }}>Your contingency on recoveries the office applied: {contingency.map((e) => `${formatLegalMoney(Number(e.amount ?? 0))} on ${e.occurred_on}`).join(', ')}. It is your share of money collected, so it is not in the demand.</p> : null}
      {acts}
      {talk.length ? (
        <div data-legal-conversation>
          <div style={h}>The conversation</div>
          <PortalTable head={['Date', 'Who', 'What was said', 'State']} rows={talk.map((r) => {
            const s = conversationStateWords(r, 'firm')
            return [r.entry.occurred_on, <span key="w" style={r.isAnswer ? { paddingLeft: 18, color: MUTED } : undefined}>{r.isAnswer ? '↳ ' : ''}{conversationWho(r, 'firm')}</span>, r.entry.body, s ? <span key="s" style={{ color: s.tone === 'warn' ? COPPER : s.tone === 'stop' ? PAPER_RED : s.tone === 'ok' ? PAPER_GREEN : MUTED }}>{s.text}</span> : '']
          })} empty="" />
        </div>
      ) : null}
      <div style={h}>On this matter</div>
      <PortalTable head={['Date', 'Kind', 'What happened', 'By', 'Status']} rows={steps.map((e) => [e.occurred_on, firmEntryKindWords(e), e.body, entryRecordedByWords(e, 'firm'), firmEntryStatusWords(e)])} empty="No steps recorded." />
      <div style={h}>Account history, oldest first</div>
      <PortalTable head={['Date', 'Job', 'Step', 'What happened']} rows={packet.feesAndSteps.steps.map((s) => [s.ymd ?? '—', s.jobLabel ?? '', firmHistoryKindWords(s.kind), s.text])} empty="No history recorded." />
    </div>
  )
}

/** The matter card (header + tab strip + the tab) and the exhibits card, exactly as the firm's page lays them out. */
export function FirmMatterView({ packet, matter, companyName, tab, onTab, acts, onPrint }: {
  packet: LegalPacket
  matter: FirmMatterLike
  /** The company the firm acts for, from the payload (the desk passes its own) — never a hard-coded brand. */
  companyName: string
  tab: FirmTab
  onTab: (t: FirmTab) => void
  /** The firm's acts on Fees & steps — the portal injects them; the desk's preview passes nothing. */
  acts?: ReactNode
  onPrint: () => void
}) {
  const { demand: totalDemand, feesTotal } = firmDemand(packet.account.totals.balance, matter.entries)
  // The county and owner line reads the first job's own property (#85 item 6), never the payer's first address.
  const firstProperty = packet.account.jobs[0]?.property ?? null
  return (
    <div>
      <div style={portalCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={portalCap}>Matter</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{matter.payerName}</div>
            <div style={{ fontSize: 12.5, color: MUTED }}>
              {packet.account.customerAddress || packet.account.jobs[0]?.address || ''}
              {firstProperty?.county ? ` · ${firstProperty.county} County` : ''}
              {firstProperty?.owner ? ` · owner of record: ${firstProperty.owner}${packet.account.jobs.length > 1 ? ` (job ${packet.account.jobs[0]?.label})` : ''}` : ''}
            </div>
            {matter.noteToFirm ? <div style={{ fontSize: 12.5, marginTop: 4, color: MUTED }}><b style={{ color: INK }}>From the office:</b> {matter.noteToFirm}</div> : null}
          </div>
          <div className="legalMatterHeadSums" style={{ textAlign: 'right' }}>
            <div style={{ ...portalNum, fontSize: 20, fontWeight: 700 }}>{formatLegalMoney(totalDemand)}</div>
            <div style={{ fontSize: 12, color: MUTED }} data-legal-demand>total demand · balance {formatLegalMoney(packet.account.totals.balance)}{feesTotal ? ` + fees and costs ${formatLegalMoney(feesTotal)}` : ''}</div>
            <button type="button" className="legalPortalWide" style={{ ...portalBtn, marginTop: 6, background: COPPER, color: '#fff' }} onClick={onPrint}>
              ⎙ Print packet
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, borderBottom: `1px solid ${HAIR}`, margin: '14px 0 12px', fontSize: 13 }}>
          {FIRM_TABS.map((t) => (
            <button key={t} type="button" onClick={() => onTab(t)} style={{ background: 'none', border: 'none', padding: '6px 12px', color: tab === t ? INK : MUTED, borderBottom: tab === t ? `2px solid ${COPPER}` : '2px solid transparent', fontWeight: tab === t ? 700 : 500, cursor: 'pointer', font: 'inherit', fontSize: 13 }}>
              {FIRM_TAB_LABELS[t]}
            </button>
          ))}
        </div>
        <FirmMatterTab tab={tab} packet={packet} matter={matter} companyName={companyName} acts={acts} />
      </div>
      <div style={{ ...portalCard, marginTop: 12 }}>
        <div style={portalCap}>Exhibits</div>
        {packet.exhibits.length ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8 }}>
            <tbody>
              {packet.exhibits.map((x) => (
                <tr key={x.letter}>
                  <td style={{ padding: '6px 4px', borderBottom: `1px dotted ${HAIR}`, color: COPPER, fontWeight: 700, width: 26 }}>{x.letter}</td>
                  <td style={{ padding: '6px 4px', borderBottom: `1px dotted ${HAIR}` }}>{firmExhibitTitle(x.title)} <span style={{ color: FAINT }}>· {x.count} item{x.count === 1 ? '' : 's'}</span></td>
                  <td style={{ padding: '6px 4px', borderBottom: `1px dotted ${HAIR}`, textAlign: 'right', fontSize: 12, color: FAINT }}>
                    {x.title === 'Signed agreements' && matter.contracts.some((c) => c.signedPdfUrl) ? matter.contracts.filter((c) => c.signedPdfUrl).map((c) => <a key={c.id} href={c.signedPdfUrl as string} target="_blank" rel="noreferrer" style={{ color: COPPER, marginLeft: 8 }}>PDF ↗</a>) : 'in the printed packet'}
                  </td>
                </tr>
              ))}
              {packet.account.jobs.some((j) => firmAgreementWords(j.contract).missing) ? <tr><td style={{ padding: '6px 4px', color: FAINT }}>—</td><td colSpan={2} style={{ padding: '6px 4px', color: PAPER_RED }}>No signed agreement on {packet.account.jobs.filter((j) => firmAgreementWords(j.contract).missing).map((j) => j.label).join(', ')}.</td></tr> : null}
              {packet.account.jobs.filter((j) => j.contract.kind === 'not_needed').map((j) => <tr key={`nn-${j.jobId}`}><td style={{ padding: '6px 4px', color: FAINT }}>—</td><td colSpan={2} style={{ padding: '6px 4px', color: MUTED }}>{j.label}: {firmNotNeededWords(j.contract.kind === 'not_needed' ? j.contract.reason : null)}.</td></tr>)}
            </tbody>
          </table>
        ) : <p style={{ color: MUTED, fontSize: 13 }}>Nothing to letter yet.</p>}
      </div>
    </div>
  )
}
