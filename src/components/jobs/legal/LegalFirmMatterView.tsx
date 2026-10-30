import { Fragment, useState, type ReactNode } from 'react'
import { COPPER, FAINT, HAIR, INK, MUTED, NOTE_BAND, PAPER_GREEN, PAPER_RED } from '../../../lib/portal/portalTheme'
import { formatLegalMoney, legalSessionWords, type LegalPacket } from '../../../lib/legal/legalPacket'
import { envelopeAnswersWords, envelopeKindWords, envelopeMonthsWords, envelopeSharesWords, envelopeWentOutWords, legalLastWorkWords, type LegalEnvelope } from '../../../lib/legal/legalLienPaper'
import { calendarYmdInAppTzFromIso } from '../../../utils/dateUtils'
import { firmAgreementWords, firmEntryKindWords, firmEntryStatusWords, firmNotNeededWords, firmExhibitTitle, firmExhibitWhere, firmFeeKindWords, firmHistoryKindWords, firmJobRecord, firmSaidKindWords, firmSaidRecordedBy } from '../../../lib/legal/legalFirmWords'
import { contingencyEntries, firmDemand, firmFeeRows, legalRunningLedger } from '../../../lib/legal/legalMoney'
import { conversationRows, conversationStateWords, conversationWho, entryRecordedByWords, isConversationEntry } from '../../../lib/legal/legalAsks'
import { ownerMailingAddressCell, propertyKindCell, propertySourceNote } from '../../../lib/legal/legalProperty'
import { legalDocumentDayWords, legalDocumentKindWords, legalDocumentSizeWords, legalDocumentStateWords, type LegalPortalDocument } from '../../../lib/legal/legalMatterDocuments'
import { legalNarrativeBandWords } from '../../../lib/legal/legalNarrative'
import { legalNarrativeHtml } from '../../../lib/legal/legalNarrativeHtml'
import { courtWords, justiceCourtCap, lienForeclosureLine, PRECINCT_NOT_YET_TITLE, venuePlaces, VENUE_SOURCE_LINE } from '../../../lib/legal/jpVenue'
import LienTimelineStrip from '../LienTimelineStrip'
import { CardCell } from './LegalCardCell'
import { LEGAL_CARD_VARS, portalSmall } from '../../../lib/legal/legalPortalCards'
import LienStopPaperWindow from '../LienStopPaperWindow'
import { lienStopCounselPaper } from '../../../lib/legal/lienStopCounselPaper'
import LegalTimelinePanel, { PORTAL_LOOK } from './LegalTimelinePanel'
import { buildLegalTimeline, timelineDeadlinesFromPaper, timelineDocumentsFromPortal } from '../../../lib/legal/legalTimeline'
import { firmVoidProblem, isVoidedEntry } from '../../../../supabase/functions/_shared/legalPortalActs'
import type { LegalEntryRow } from '../../../lib/legal/legalMatters'

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

import { FIRM_TAB_LABELS, firmTabsFor, firmTabShown, portalBtn, portalCap, portalCard, portalH, portalNum, portalTd, portalTh, type FirmMatterLike, type FirmTab } from './legalFirmMatterViewShared'
import { answeredGaps, gapAnswerByline } from '../../../lib/legal/legalGapAnswers'
import { partiesStrip } from '../../../lib/legal/legalParties'
import LegalPartiesStrip from './LegalPartiesStrip'

/**
 * Every table of the firm's matter. On a narrow box (a phone, an iPad's main column) each row folds into a card,
 * each cell its column's name beside the value (v2.4808, `legalPortalCards.ts`): the first cell leads the card in
 * bold, money is bold, a cell with nothing in it drops out, and a column with no name spans the card.
 */
export function PortalTable({ head, rows, empty, numCols = [], subRows = [] }: { head: string[]; rows: Array<Array<string | number | JSX.Element | null>>; empty: string; numCols?: number[]; /** A full-width row drawn under row i when set (the answers band under a notice, #41 PR 1b). */ subRows?: Array<ReactNode | null> }) {
  if (rows.length === 0) return <p style={{ color: MUTED, fontSize: 13, margin: '4px 0' }}>{empty}</p>
  return (
    <div className="legalCardWrap" style={{ overflowX: 'auto', ...LEGAL_CARD_VARS }}>
      <table role="table" className="legalCardTable" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead role="rowgroup"><tr role="row">{head.map((x, i) => <th key={`${x}-${i}`} role="columnheader" style={{ ...portalTh, ...(numCols.includes(i) ? { textAlign: 'right' } : null) }}>{x}</th>)}</tr></thead>
        <tbody role="rowgroup">{rows.flatMap((r, ri) => [
          <tr key={ri} role="row" data-card-has-sub={subRows[ri] ? '' : undefined}>{r.map((c, ci) => <CardCell key={ci} label={head[ci] ?? ''} num={numCols.includes(ci)} title={ci === 0} style={{ ...portalTd, ...(numCols.includes(ci) ? portalNum : null), ...(ci === 0 && head[0] === 'Date' ? { whiteSpace: 'nowrap' } : null) }}>{c}</CardCell>)}</tr>,
          ...(subRows[ri] ? [<tr key={`${ri}-sub`} role="row" data-card-sub=""><td role="cell" colSpan={head.length} style={{ ...portalTd, paddingTop: 0 }}>{subRows[ri]}</td></tr>] : []),
        ])}</tbody>
      </table>
    </div>
  )
}

/** #85 item 18: an entry's text, struck through with who undid it and why once it is voided. */
function VoidableText({ e }: { e: Pick<LegalEntryRow, 'body' | 'voided_at' | 'voided_via_portal' | 'void_reason'> }) {
  if (!e.voided_at) return <>{e.body}</>
  return (
    <span data-legal-voided>
      <span style={{ textDecoration: 'line-through', color: FAINT }}>{e.body}</span>
      <span style={{ display: 'block', fontSize: portalSmall(11.5), color: MUTED }}>undone by {e.voided_via_portal ? 'your firm' : 'the office'} {calendarYmdInAppTzFromIso(e.voided_at)}{e.void_reason ? `: ${e.void_reason}` : ''}</span>
    </span>
  )
}

/** #85 item 18: Undo… opens a reason box; the act stays on the record, struck through, out of every total. */
function UndoEntry({ entryId, onUndo }: { entryId: string; onUndo: (entryId: string, reason: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={{ ...portalBtn, padding: '2px 8px', fontSize: portalSmall(11.5) }}>Undo…</button>
  return (
    <span data-legal-undo style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input value={reason} onChange={(ev) => setReason(ev.target.value)} placeholder="Why (both sides see it)" aria-label="Why you are undoing it" style={{ font: 'inherit', fontSize: 12, padding: '3px 6px', border: `1px solid ${HAIR}`, borderRadius: 4, width: 170 }} />
      <button type="button" disabled={!reason.trim()} onClick={() => void onUndo(entryId, reason.trim()).then((ok) => { if (ok) setOpen(false) })} style={{ ...portalBtn, padding: '2px 8px', fontSize: portalSmall(11.5), background: COPPER, color: '#fff' }}>Undo it</button>
      <button type="button" onClick={() => setOpen(false)} style={{ ...portalBtn, padding: '2px 8px', fontSize: portalSmall(11.5) }}>Cancel</button>
    </span>
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
/** Gap answers (v2.5923): what the office flagged and already answered. Only answered gaps draw here — an unanswered gap is the office's own nag and never travels. */
function GapAnswersForFirm({ packet, matter }: { packet: LegalPacket; matter: FirmMatterLike }) {
  const rows = answeredGaps(packet.gaps)
  if (rows.length === 0) return null
  return (
    <div data-legal-firm-gap-answers>
      <div style={portalH}>What the office flagged, and already answered</div>
      {rows.map((g) => {
        const doc = g.answer?.documentId ? (matter.documents ?? []).find((d) => d.id === g.answer?.documentId) : null
        return (
          <div key={g.key} style={{ margin: '0 0 8px', fontSize: 13 }}>
            <span style={{ color: MUTED }}>{g.label}</span>
            <div style={{ borderLeft: `3px solid ${PAPER_GREEN}`, padding: '3px 9px', marginTop: 2, color: INK }}>
              The office: {g.answer!.text}
              {doc?.url ? <> · <a href={doc.url} target="_blank" rel="noreferrer" style={{ color: COPPER }}>📄 {doc.title} ↗</a></> : g.answer!.documentTitle ? <> · 📄 {g.answer!.documentTitle}</> : null}
              <div style={{ color: MUTED, fontSize: 11.5, marginTop: 1 }}>{gapAnswerByline(g.answer!)}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function JobTimelines({ packet }: { packet: LegalPacket }) {
  const a = packet.account
  // A stop as evidence (v2.4800): the stop whose window is open, per job; the copy button's label while the record is on the clipboard.
  const [stop, setStop] = useState<{ jobId: string; index: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 2000) }).catch(() => {})
  }
  const reach = () => {
    setStop(null)
    document.querySelector('[data-legal-reach-strip]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
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
            <div style={{ color: MUTED, fontSize: portalSmall(11.5) }}>{kindWordsOf(t.jobId)} · {roleWords}{legalLastWorkWords(t.lastWorkYmd, t.lastWorkSource) ? ` · ${legalLastWorkWords(t.lastWorkYmd, t.lastWorkSource)}` : ''}</div>
            <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatLegalMoney(t.openBalance)} open</div>
            {t.retainageWords ? <div style={{ color: MUTED, fontSize: portalSmall(11.5) }}>{t.retainageWords}</div> : null}
          </div>
          <LienTimelineStrip timeline={t.timeline} voice="firm" onOpenStep={(s) => setStop({ jobId: t.jobId, index: Math.max(0, t.timeline.steps.findIndex((x) => x.key === s.key)) })} />
          {stop && stop.jobId === t.jobId ? (
            <LienStopPaperWindow
              steps={t.timeline.steps}
              index={stop.index}
              onIndex={(i) => setStop({ jobId: t.jobId, index: i })}
              onClose={() => setStop(null)}
              jobLabel={t.jobLabel}
              timeline={t.timeline}
              paperFor={(step) => lienStopCounselPaper({ step, steps: t.timeline.steps, packet, jobId: t.jobId, voice: 'firm', act: typeof document !== 'undefined' && document.querySelector('[data-legal-reach-strip]') ? { label: 'Reach the office ›', onPress: reach } : null, onCopy: copy, copyLabel: copied ? 'Copied' : 'Copy the record as text' })}
            />
          ) : null}
        </div>
      ))}
    </div>
  )
}

export function FirmMatterTab({ tab, packet, matter, companyName, acts, onUndo, timelineActs }: { tab: FirmTab; packet: LegalPacket; matter: FirmMatterLike; companyName: string; acts?: ReactNode; /** #85 item 18: the firm undoes its own act, with a reason; absent on the desk's preview. */ onUndo?: (entryId: string, reason: string) => Promise<boolean>; /** v2.5800: the firm's own plan form under the Timeline; absent on the desk's preview. */ timelineActs?: ReactNode }) {
  if (tab === 'timeline') {
    // v2.5800: the same line the office reads, on the portal's paper; a held step never arrived, so nothing here is held.
    // v2.5842: the lien clock's deadlines on the firm's line too (the office's call: counsel reads the same clock), read only.
    const timeline = buildLegalTimeline({ entries: matter.entries, documents: timelineDocumentsFromPortal(matter.documents ?? []), todayYmd: packet.todayYmd, reader: 'firm', deadlines: timelineDeadlinesFromPaper(packet.paper.timelines) })
    return (
      <div data-legal-firm-timeline>
        <LegalTimelinePanel timeline={timeline} todayYmd={packet.todayYmd} reader="firm" look={PORTAL_LOOK} acts={onUndo ? { busy: false, undo: onUndo, canUndo: (i) => i.kind === 'plan' && i.viaPortal && !i.voided } : null} footer={timelineActs} />
      </div>
    )
  }
  if (tab === 'narrative' && matter.narrative?.markdown) {
    return (
      <div data-legal-firm-narrative>
        <p style={{ fontSize: 12.5, color: MUTED, background: NOTE_BAND, padding: '6px 10px', borderRadius: 4, margin: '4px 0 10px' }}>{legalNarrativeBandWords(matter.narrative)}</p>
        {/* eslint-disable-next-line react/no-danger -- legalNarrativeHtml: marked, then the allowlist sanitizer (no scripts, styles, forms or handlers; http(s) links only), tested */}
        <div className="legalNarrative" style={{ fontSize: 13.5, color: INK }} dangerouslySetInnerHTML={{ __html: legalNarrativeHtml(matter.narrative.markdown) }} />
      </div>
    )
  }
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
        <WhereToFile account={a} />
        <div style={h}>Property record</div>
        <PortalTable head={['Job', 'Address', 'County', 'Owner of record', 'Owner’s mailing address', 'Legal description', 'Parcel', 'Kind']} rows={a.properties.map((p) => [<b key="j">{p.jobLabels.join(', ')}</b>, propertySourceNote(p.source) ? <span key="a">{p.address || '—'} <span style={{ color: MUTED }}>· {propertySourceNote(p.source)}</span></span> : p.address, p.county || '—', p.owner || '—', ownerMailingAddressCell(p), p.legalDescription || '—', p.parcelId || '—', propertyKindCell(p.propertyKind)])} empty="No property record on file." />
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
        <GapAnswersForFirm packet={packet} matter={matter} />
        <div style={h}>Where each job stands</div>
        <JobTimelines packet={packet} />
        <div style={h}>Final demand letters</div>
        <PortalTable head={['Job', 'Sent', 'Method', 'Tracking', 'Deadline', 'Amount']} numCols={[5]} rows={packet.paper.demandLetters.map((d) => [<b key="l">{d.jobLabel}</b>, d.sentYmd ?? 'not sent', d.method, d.tracking || '—', `${d.deadlineYmd ?? '—'}${d.deadlinePassed ? ' · passed' : ''}`, formatLegalMoney(d.amount)])} empty="No demand letter sent before referral." />
        <div style={h}>The paper that went out</div>
        <PortalTable head={['', 'Paper', 'Went out', 'Claim', 'Months as printed', 'Jobs and shares', 'County · recording', 'Copy']} numCols={[3]} rows={packet.paper.envelopes.map((e) => [<b key="a" style={{ color: COPPER }}>{e.letter}</b>, envelopeKindWords(e), envelopeWentOutWords(e, packet.todayYmd), <b key="c">{formatLegalMoney(e.claim)}</b>, envelopeMonthsWords(e) || '—', envelopeSharesWords(e, formatLegalMoney), [e.county, e.recordingNumber].filter(Boolean).join(' · ') || '—', e.documentUrl ? <a key="d" href={e.documentUrl} target="_blank" rel="noreferrer" style={{ color: COPPER }}>open ↗</a> : '—'])} subRows={packet.paper.envelopes.map((e) => (e.answers ? <EnvelopeAnswersBand key={e.key} e={e} packet={packet} companyName={companyName} /> : null))} empty="No § 53.056 notice, affidavit or release recorded." />
        <p style={{ fontSize: 12, color: MUTED, margin: '6px 0 0' }}>A month marked <i>as information</i> was named on the paper after its own notice window had closed; it is not in the claim. Under a notice: the owner's answers to the letter's three questions, whether the second owner letter is due or sent, and any written okay from the GC for the owner to pay {companyName} directly. Dates above are the app's reading of Chapter 53 from each job's last day of work (its last approved clock day, else its last work date, else its creation month, as each job's line says) and the property kind.</p>
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
        <PortalTable head={['Job', 'Field reports', 'Clock sessions', 'Hours', 'Worked', 'Job notes']} numCols={[3]} rows={packet.evidence.map((e) => [<b key="l">{e.jobLabel}</b>, `${e.reports} (${e.reportsWithGps} with GPS)`, legalSessionWords(e), `${e.hours}h`, e.firstWorkYmd ? `${e.firstWorkYmd} → ${e.lastWorkYmd}` : '—', String(e.threadNotes)])} empty="No jobs." />
        <p style={{ fontSize: 12, color: MUTED, marginTop: 8 }}><b style={{ color: INK }}>Only approved clock sessions count</b>: hours, days worked and the lien dates read them. Rejected and revoked sessions are left out; sessions not yet approved show as awaiting approval. The printed packet counts the reports and sessions. Ask the office for the reports themselves.</p>
        <FirmDocuments documents={matter.documents ?? []} held={matter.heldDocumentCount ?? 0} />
      </div>
    )
  }
  const fees = firmFeeRows(matter.entries)
  const feesTotal = firmDemand(0, matter.entries).feesTotal
  const contingency = contingencyEntries(matter.entries)
  // #85 item 17: questions and answers leave the steps table for the conversation, each answer under its question.
  // Planned steps (v2.5800) live on the Timeline tab, so On this matter stays as it was.
  const steps = matter.entries.filter((e) => e.kind !== 'fee' && e.kind !== 'cost' && e.kind !== 'plan' && !isConversationEntry(e))
  const talk = conversationRows(matter.entries)
  return (
    <div>
      <div style={h}>Fees and costs</div>
      <PortalTable head={['Date', 'Kind', 'Note', 'By', 'Amount', '']} numCols={[4]} rows={fees.map((e) => [e.occurred_on, firmFeeKindWords(e.kind), <VoidableText key="t" e={e} />, entryRecordedByWords(e, 'firm'), <span key="a" style={isVoidedEntry(e) ? { textDecoration: 'line-through', color: FAINT } : undefined}>{formatLegalMoney(Number(e.amount ?? 0))}</span>, onUndo && !firmVoidProblem(e) ? <UndoEntry key="u" entryId={e.id} onUndo={onUndo} /> : ''])} empty="None yet." />
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
      <PortalTable head={['Date', 'Kind', 'What happened', 'By', 'Status']} rows={steps.map((e) => [e.occurred_on, firmEntryKindWords(e), <span key="t"><VoidableText e={e} />{onUndo && !firmVoidProblem(e) ? <span style={{ marginLeft: 8 }}><UndoEntry entryId={e.id} onUndo={onUndo} /></span> : null}</span>, entryRecordedByWords(e, 'firm'), isVoidedEntry(e) ? 'undone' : firmEntryStatusWords(e)])} empty="No steps recorded." />
      <div style={h}>Account history, oldest first</div>
      <PortalTable head={['Date', 'Job', 'Step', 'What happened']} rows={packet.feesAndSteps.steps.map((s) => [s.ymd ?? '—', s.jobLabel ?? '', firmHistoryKindWords(s.kind), s.text])} empty="No history recorded." />
    </div>
  )
}

/** The matter card (header + tab strip + the tab) and the exhibits card, exactly as the firm's page lays them out. */
/** The portal's counties for the parties strip (PR 3, v2.6175): each property's county with the balance of its jobs, largest first; no county last. The desk reads `firmForAccount`'s grouping instead. */
export function portalVenueCounties(account: Pick<LegalPacket['account'], 'properties' | 'jobs'>): Array<{ county: string; balance: number }> {
  const balanceOf = new Map(account.jobs.map((j) => [j.label, j.balance] as const))
  const by = new Map<string, number>()
  for (const p of account.properties) {
    const county = p.county.trim()
    by.set(county, (by.get(county) ?? 0) + p.jobLabels.reduce((s, l) => s + (balanceOf.get(l) ?? 0), 0))
  }
  return [...by.entries()].map(([county, balance]) => ({ county, balance })).sort((a, b) => (a.county === '') === (b.county === '') ? b.balance - a.balance : a.county === '' ? 1 : -1)
}

export function FirmMatterView({ packet, matter, companyName, tab, onTab, acts, onPrint, onUndo, timelineActs, onOpenCoverage }: {
  packet: LegalPacket
  matter: FirmMatterLike
  /** PR 3 (v2.6175): the Venue cell's door on the firm's portal — Who covers what, opened on the county. The desk's preview passes nothing, so its cells are words. */
  onOpenCoverage?: (county: string | null) => void
  /** The company the firm acts for, from the payload (the desk passes its own) — never a hard-coded brand. */
  companyName: string
  tab: FirmTab
  onTab: (t: FirmTab) => void
  /** The firm's acts on Fees & steps — the portal injects them; the desk's preview passes nothing. */
  acts?: ReactNode
  onPrint: () => void
  /** #85 item 18: the portal passes the firm's undo; the desk's preview does not. */
  onUndo?: (entryId: string, reason: string) => Promise<boolean>
  /** v2.5800: the firm's plan form under the Timeline tab — the portal injects it; the desk's preview passes nothing. */
  timelineActs?: ReactNode
}) {
  const { demand: totalDemand, feesTotal } = firmDemand(packet.account.totals.balance, matter.entries)
  // Narrative only when the office wrote one (v2.4812); a tab the matter does not show falls back to Account.
  const shownTab = firmTabShown(tab, matter)
  // The parties strip (punch list #219, v2.6175): the same three cells the desk draws, from the same kernel — the firm's portal
  // offers no office record behind them, so only the venue cell is a door, to Who covers what. Before, the line under the
  // name read the payer's address, the first job's county and its owner of record.
  const a0 = packet.account
  const strip = partiesStrip({
    payer: { name: a0.payer.name, viaGc: a0.payer.viaGc, customerId: a0.payer.customerId },
    customerType: a0.customerType,
    customerAddress: a0.customerAddress,
    customerCounty: a0.customerCounty,
    customerPrecinct: a0.customerPrecinct,
    agreements: packet.paper.agreements,
    properties: a0.properties,
    jobs: a0.jobs.map((j) => ({ label: j.label, address: j.address })),
    counties: portalVenueCounties(a0),
    balance: a0.totals.balance,
  })
  const venueCounty = portalVenueCounties(a0).find((c) => c.county)?.county ?? null
  return (
    <div>
      <div style={portalCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: '1 1 280px' }}>
            <div style={portalCap}>Matter</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{matter.payerName}</div>
            <div style={{ fontSize: 12.5, color: MUTED }} data-legal-account-line>{strip.addressLine || packet.account.customerAddress}</div>
            {/* v2.6170 (punch list #218): the firm settles for what can be had; the office's floor is retired. */}
            <div data-legal-settling style={{ fontSize: 12.5, marginTop: 6, padding: '5px 9px', background: NOTE_BAND, borderRadius: 4, color: INK }}><b>Settling:</b> Settle as you can. Record the settlement with its amount.</div>
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
        <LegalPartiesStrip strip={strip} doors={onOpenCoverage ? ['venue'] : []} onPress={(door) => { if (door === 'venue') onOpenCoverage?.(venueCounty) }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, borderBottom: `1px solid ${HAIR}`, margin: '14px 0 12px', fontSize: 13 }}>
          {firmTabsFor(matter).map((t) => (
            <button key={t} type="button" onClick={() => onTab(t)} style={{ background: 'none', border: 'none', padding: '6px 12px', color: shownTab === t ? INK : MUTED, borderBottom: shownTab === t ? `2px solid ${COPPER}` : '2px solid transparent', fontWeight: shownTab === t ? 700 : 500, cursor: 'pointer', font: 'inherit', fontSize: 13 }}>
              {FIRM_TAB_LABELS[t]}
            </button>
          ))}
        </div>
        <FirmMatterTab tab={shownTab} packet={packet} matter={matter} companyName={companyName} acts={acts} onUndo={onUndo} timelineActs={timelineActs} />
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
                    {x.title === 'Signed agreements' && matter.contracts.some((c) => c.signedPdfUrl) ? matter.contracts.filter((c) => c.signedPdfUrl).map((c) => <a key={c.id} href={c.signedPdfUrl as string} target="_blank" rel="noreferrer" style={{ color: COPPER, marginLeft: 8 }}>PDF ↗</a>) : firmExhibitWhere(x.title, { agreementPdfs: false, paperCopies: packet.paper.envelopes.some((e) => Boolean(e.documentUrl)) })}
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

/** Which court (v2.4764): the cap, both venue bases under TRCP 502.4, the lien line, the source. */
function WhereToFile({ account }: { account: LegalPacket['account'] }) {
  const cap = justiceCourtCap(account.totals.balance)
  const places = venuePlaces({ properties: account.properties, payer: { name: account.payer.name, address: account.customerAddress, county: account.customerCounty, precinct: account.customerPrecinct } })
  const notYet = <span style={{ color: PAPER_RED, fontWeight: 700 }} title={PRECINCT_NOT_YET_TITLE}>?</span>
  return (
    <div data-legal-where-to-file>
      <div style={portalH}>Where to file</div>
      <div style={{ fontSize: 13 }}><b>{cap.words.replace(/ \(.*$/, '')}</b> <span style={{ color: MUTED }}>{cap.words.slice(cap.words.indexOf('(')) || ''}</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 12px', fontSize: 12.5, marginTop: 6 }}>
        {places.map((p) => (
          <Fragment key={`${p.basis}:${p.where}`}>
            <span style={{ color: MUTED }}>{p.basisWords}</span>
            <span><b>{courtWords(p)}</b>{p.precinct ? null : <> {notYet}</>}{p.where ? <span style={{ color: MUTED }}> · {p.where}</span> : null}{p.jobLabels.length > 1 ? <span style={{ color: MUTED }}> · {p.jobLabels.join(', ')}</span> : null}</span>
          </Fragment>
        ))}
        <span style={{ color: MUTED }}>A lien foreclosure</span>
        <span>{lienForeclosureLine(places.filter((p) => p.basis === 'work').map((p) => p.county))}</span>
      </div>
      <div style={{ fontSize: portalSmall(11), color: FAINT, marginTop: 6 }}>{VENUE_SOURCE_LINE}</div>
    </div>
  )
}

/** Documents from the office (v2.4810), under the field work on the Evidence tab: each with one line on what it shows and a 15-minute link. */
function FirmDocuments({ documents, held }: { documents: ReadonlyArray<LegalPortalDocument>; held: number }) {
  if (documents.length === 0 && held === 0) return null
  return (
    <div data-legal-firm-documents>
      <div style={portalH}>Documents from the office · {documents.length}</div>
      <PortalTable
        head={['Document', 'What it shows', 'State', 'Dated · added', '']}
        rows={documents.map((d) => [
          <span key="t"><b>{d.title}</b><div style={{ fontSize: portalSmall(11.5), color: FAINT }}>{[legalDocumentKindWords(d.mime), legalDocumentSizeWords(d.sizeBytes)].filter(Boolean).join(' · ')}</div></span>,
          d.shows,
          // v2.5846: a draft is shared on purpose (the office's call) and says so; a sent paper carries its record.
          <span key="s" data-legal-firm-document-state={d.state} style={{ color: d.state === 'draft' ? COPPER : MUTED, fontWeight: d.state === 'draft' ? 600 : undefined }}>{legalDocumentStateWords(d) || 'Final'}</span>,
          <span key="a" style={{ color: MUTED, whiteSpace: 'nowrap' }}>{[legalDocumentDayWords(d), d.addedByName].filter(Boolean).join(' · ')}</span>,
          d.url ? <a key="o" href={d.url} target="_blank" rel="noopener noreferrer" style={{ color: COPPER, fontWeight: 600, whiteSpace: 'nowrap' }}>Open ↗</a> : <span key="o" style={{ color: FAINT, whiteSpace: 'nowrap' }}>on the firm's link</span>,
        ])}
        empty="No documents shown yet."
      />
      <p style={{ fontSize: 12, color: MUTED, margin: '6px 0 0' }}>Links open for 15 minutes. Reload the page for fresh ones.{held > 0 ? <> The office held back <b>{held} document{held === 1 ? '' : 's'}</b>. Ask the office if you need {held === 1 ? 'it' : 'them'}.</> : null}</p>
    </div>
  )
}
