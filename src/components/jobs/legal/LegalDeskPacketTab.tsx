
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'

import { envelopeKindWords, envelopeMonthsWords, envelopeSharesWords, envelopeWentOutWords, legalLastWorkWords } from '../../../lib/legal/legalLienPaper'
import { conversationRows, conversationStateWords, conversationWho, entryRecordedByWords, isConversationEntry, legalEntryKindWords, stepProposalOf, type LegalAskFlavor } from '../../../lib/legal/legalAsks'
import LienTimelineStrip from '../LienTimelineStrip'
import { legalPaperNextDoor } from '../../../lib/legal/legalPaperNextDoor'
import LienStopPaperWindow from '../LienStopPaperWindow'
import { lienStopCounselPaper } from '../../../lib/legal/lienStopCounselPaper'
import { formatLegalMoney, type LegalAccountSummary, type LegalPacket, legalSessionWords } from '../../../lib/legal/legalPacket'
import { firmEntryWait, legalStageLabel } from '../../../lib/legal/legalMatters'
import { ageChipStyle } from '../../../lib/ageState'

import { contingencyEntries, firmFeeEntries, firmFeeRows, legalRunningLedger } from '../../../lib/legal/legalMoney'
import { ownerMailingAddressCell, propertyKindCell, propertySourceNote } from '../../../lib/legal/legalProperty'
import { LEGAL_SUPPLIERS_EMPTY_WORDS, LEGAL_SUPPLIERS_LOADING_WORDS, LEGAL_SUPPLIERS_NOTE, legalSupplierJobs, legalSuppliersSummaryWords } from '../../../lib/legal/legalSuppliers'
import { useLienJobSuppliers } from '../../../hooks/useLienJobSuppliers'
import { LienJobSuppliersCard } from '../LienJobSuppliers'

import type { LegalEntryRow } from '../../../lib/legal/legalMatters'

import { calendarYmdInAppTzFromIso } from '../../../utils/dateUtils'

import LegalMatterDocumentsPanel from './LegalMatterDocumentsPanel'
import LegalStatementsStrip from './LegalStatementsStrip'
import { openLegalMatterDocument, type LegalMatterDocumentRow } from '../../../lib/legal/legalMatterDocumentsIo'
import { supabase } from '../../../lib/supabase'
import { EVIDENCE_LANDING_GONE_WORDS } from '../../../lib/legal/evidenceLanding'

import LegalNarrativeEditor, { type NarrativeDesk } from './LegalNarrativeEditor'
import LegalTimelinePanel, { type TimelinePlanActs } from './LegalTimelinePanel'
import { buildLegalTimeline, timelineDeadlinesFromPaper, timelineDocumentsFromRows } from '../../../lib/legal/legalTimeline'
import { isVoidedEntry, officeCanVoid } from '../../../../supabase/functions/_shared/legalPortalActs'

import { exhibitDetails, exhibitsSummaryWords } from '../../../lib/legal/exhibitDetail'

import { type LegalOfferDraft, type OfferStatus } from '../../../lib/legal/legalOffers'
import { type CounselRead, type CounselReadDraft } from '../../../lib/legal/counselRead'

import type { LegalDeskProps } from './LegalDesk'
import { type Tab, TAB_LABELS, MUTED, btn, pill, Door, DeskEnvelopeAnswersBand, SectionTitle, Table, coverageText, type EntryLike } from './legalDeskShared'
import { CounselReadPanel, OffersPanel, SettlementAnswer, DeskVoidableText, DeskUndo } from './LegalDeskFirmPanels'
import { EmptyState } from '../../EmptyState'

/**
 * The Legal desk's tabs (v2.5852, the split): one component drawing whichever tab is open — Narrative, Account,
 * Paper, Evidence, With the firm, Timeline — and the act types the desk hands it. Split out of `LegalDesk.tsx` (`LegalDeskModal.tsx` until punch list #182).
 */
export type Curation = { holdBack: (key: string, reason: string) => Promise<void>; shareAgain: (key: string) => Promise<void>; shareAll: () => Promise<void>; holdFor: { key: string; reason: string } | null; setHoldFor: (v: { key: string; reason: string } | null) => void; reasons: Record<string, string>; busy: boolean } | null
export type OfficeActs = { acknowledge: (entryId: string) => Promise<void>; answerFor: { entryId: string; text: string } | null; setAnswerFor: (v: { entryId: string; text: string } | null) => void; sendAnswer: () => Promise<void>; markApplied: (entry: { id: string; amount: number | null; body: string }) => Promise<void>; busy: boolean; onOpenPipelineRow: () => void; askForm: { flavor: LegalAskFlavor; jobId: string; text: string } | null; setAskForm: (v: { flavor: LegalAskFlavor; jobId: string; text: string } | null) => void; sendAsk: () => Promise<void>; withdrawFirmAsk: (entryId: string) => Promise<void>; /** A matter exists for the account (asks hang on a matter). */ canAsk: boolean; /** v2.5847 (punch list #172): the office runs the case itself. */ inHouse: boolean; offerAdd: (draft: LegalOfferDraft) => Promise<boolean>; offerSetStatus: (entryId: string, status: OfferStatus, note: string) => Promise<boolean>; /** #85 item 20. */ answerSettlement: (entryId: string, signedOff: boolean, note: string) => Promise<void>; /** Punch list #218 PR 2: the attorney's read of how the case tries. */ setCounselRead: (d: CounselReadDraft) => Promise<boolean>; counselRead: CounselRead | null; /** #85 item 16. */ moveStage: (stage: string, entryId: string) => Promise<void>; /** #85 item 18. */ voidEntry: (entryId: string, reason: string) => Promise<boolean> } | null

/**
 * A firm entry's wait beside its pill or press (punch list #184 sweep B): LEGAL_FIRM_ENTRY_AGE, two days
 * amber, five red, from the moment the firm wrote it. An entry that no longer waits keeps its cell as it was.
 */
function withFirmWait(e: LegalEntryRow, cell: ReactNode): ReactNode {
  const wait = firmEntryWait(e)
  if (!wait) return cell
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      {cell}
      <span data-firm-wait={wait.state} title={`The firm wrote this ${new Date(e.created_at).toLocaleString()}`} style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.05rem 0.45rem', borderRadius: 7, whiteSpace: 'nowrap', ...ageChipStyle(wait.state) }}>
        {wait.label}
      </span>
    </span>
  )
}

/** The office's documents for the firm on the Evidence tab (v2.4810); null while the account has no matter. */
export type DocumentsPanel = { matterId: string; list: ReadonlyArray<LegalMatterDocumentRow>; canEdit: boolean; reload: () => void } | null
/** The Timeline tab (v2.5800): the matter's holds (a planned step held back reads held) and the office's acts, null when read only. */
export type PlanActs = { holds: Record<string, boolean>; holdReasons: Record<string, string>; acts: TimelinePlanActs | null }

export function PacketTab({ tab, onTab, packet, selected, props, openEditCustomer, curation: _curation, entries, officeActs, documents = null, narrative = null, busy = false, planActs = null, onShowOnEvidence, evidenceDoc = null, onEvidenceLanded }: { tab: Tab; onTab?: (t: Tab) => void; packet: LegalPacket; selected: LegalAccountSummary; props: LegalDeskProps; openEditCustomer: () => void; curation: Curation; entries: EntryLike[]; officeActs: OfficeActs; documents?: DocumentsPanel; /** v2.4812. */ narrative?: NarrativeDesk | null; busy?: boolean; /** v2.5800. */ planActs?: PlanActs | null; /** v2.6166: the Evidence tab opened on a document's row, lit. */ onShowOnEvidence?: (documentId: string) => void; /** v2.6166: the row the Evidence tab lands on, from the address. */ evidenceDoc?: string | null; /** v2.6166: the landed row was pressed. */ onEvidenceLanded?: () => void }) {
  const a = packet.account
  const jobOf = (id: string) => selected.jobs.find((j) => j.id === id) ?? null
  const first = selected.jobs[0] ?? null
  // A stop as evidence (v2.4800): the timeline stop whose window is open on the Paper tab, per job; the copy button's label while the record is on the clipboard.
  const [stop, setStop] = useState<{ jobId: string; index: number } | null>(null)
  const [copied, setCopied] = useState(false)
  // Supply houses on the account's jobs (punch list #175, v2.5835): the Lien window's read, fetched only while Paper is open.
  const supplierJobIds = useMemo(() => a.jobs.map((j) => j.jobId), [a.jobs])
  const suppliers = useLienJobSuppliers(supplierJobIds, tab === 'paper')
  const copyRecord = (text: string) => {
    void navigator.clipboard?.writeText(text).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 2000) }).catch(() => {})
  }
  const customerDoor = (label = 'Edit customer') => <Door label={selected.customerId ? label : 'Link a customer'} onClick={openEditCustomer} title={selected.customerId ? 'Opens Edit customer; the desk refreshes when it saves' : 'The payer is a name only — link the job to a customer record'} />

  // The narrative for the firm (v2.4812), after the hooks above.
  if (tab === 'narrative') return narrative ? <LegalNarrativeEditor narrative={narrative} busy={busy} /> : null
  if (tab === 'timeline') {
    // v2.5800: the stream (every kind) and the documents on one line around today; the kernel splits and words them.
    const nameOf = (id: string | null) => (id ? (props.users.find((u) => u.id === id)?.name ?? null) : null)
    // v2.5842 (punch list #170): the lien clock's deadlines from the Paper tab's own timelines, read only, with Record it… to the job's Lien window.
    const timeline = buildLegalTimeline({ entries, documents: documents ? timelineDocumentsFromRows(documents.list, calendarYmdInAppTzFromIso, nameOf) : [], todayYmd: packet.todayYmd, holds: planActs?.holds ?? {}, holdReasons: planActs?.holdReasons ?? {}, userNameOf: nameOf, reader: 'office', deadlines: timelineDeadlinesFromPaper(packet.paper.timelines), said: packet.theirWord.timeline, did: packet.feesAndSteps.steps, dayOfIso: calendarYmdInAppTzFromIso })
    // v2.5851: the one line — what was said (the Record of contact) and what we did (the packet's steps) fold in as lanes.
    // v2.6166: a document line's two doors — the paper itself, the way the Evidence row opens it; and the Evidence tab landed on its row.
    const openDocument = documents ? async (id: string) => {
      const row = documents.list.find((d) => d.id === id)
      if (!row) throw new Error(EVIDENCE_LANDING_GONE_WORDS)
      await openLegalMatterDocument(supabase, row)
    } : undefined
    return <LegalTimelinePanel timeline={timeline} todayYmd={packet.todayYmd} reader="office" lanes acts={planActs?.acts ?? null} onOpenEvidence={onTab ? (docId) => { if (docId && onShowOnEvidence) onShowOnEvidence(docId); else onTab('evidence') } : undefined} onOpenDocument={openDocument} onOpenLienWindow={(jobId) => { const job = jobOf(jobId); if (job) props.onOpenLienInstruments(job) }}
      doors={<>{customerDoor('Customer notes')}{first ? <Door label="They said…" onClick={() => props.onOpenPromisedPay({ jobId: first.id, jobLabel: first.hcp_number || first.click_number || '', initialYmd: null })} /> : null}<Door label="Call mode" onClick={props.onOpenCallMode} /></>} />
  }
  if (tab === 'account') {
    return (
      <div>
        <SectionTitle doors={customerDoor()}>Who owes</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 14px', fontSize: '0.84rem' }}>
          <span style={MUTED}>Payer</span><span>{a.payer.name}{a.payer.viaGc ? ' · general contractor on the job' : ''}{a.customerType ? ` · ${a.customerType}` : ''}{!a.payer.customerId ? <> {pill('name only — no customer record', 'stop')}</> : null}</span>
          <span style={MUTED}>Address</span><span>{a.customerAddress || <span style={MUTED}>none on the customer</span>}</span>
          <span style={MUTED}>Emails</span><span>{a.emails.length ? a.emails.join(', ') : <span style={MUTED}>none on file</span>}</span>
          <span style={MUTED}>Phones</span><span>{a.phones.length ? a.phones.join(', ') : <span style={MUTED}>none on file</span>}</span>
          <span style={MUTED}>Terms</span><span>{a.paymentTerms}{a.paymentTermsNote ? <span style={MUTED}> — {a.paymentTermsNote}</span> : null}</span>
        </div>
        {a.contacts.length ? (<><SectionTitle doors={customerDoor()}>Contacts</SectionTitle><Table head={['Name', 'Email', 'Phone', 'Note']} rows={a.contacts.map((c) => [c.name, c.email ?? '—', c.phone ?? '—', c.note ?? ''])} empty="" /></>) : null}
        <SectionTitle doors={first ? <Door label="Pipeline row" onClick={() => props.onFocusJob(first.id)} /> : null}>Jobs in this account</SectionTitle>
        <Table head={['Job', 'Name', 'Address', 'Age', 'Basis', 'Balance', '']} numCols={[3, 5]}
          rows={a.jobs.map((j) => [
            <b key="l">{j.label}</b>, j.name, j.address, j.agingDays == null ? '—' : `${j.agingDays}d`,
            j.contract.kind === 'signed' ? pill('signed contract', 'ok') : j.swornMissing.length === 0 ? pill('sworn account holds', 'warn') : pill(`needs ${j.swornMissing.join(', ')}`, 'stop'),
            formatLegalMoney(j.balance),
            <button key="e" type="button" onClick={() => props.onOpenEditJob(j.jobId)} style={btn}>Edit job</button>,
          ])} empty="No jobs." />
        <SectionTitle doors={<Door label="Accounts Receivable" onClick={props.onOpenAccountsReceivable} />}>Invoices and payments</SectionTitle>
        <Table head={['Date', 'Job', 'Entry', 'Amount', 'Balance']} numCols={[3, 4]} rows={legalRunningLedger(a.ledger).map((e) => [e.ymd ?? '—', e.jobLabel, e.text, <span key="a" style={{ color: e.amount < 0 ? '#1f7a3a' : undefined }}>{formatLegalMoney(e.amount)}</span>, formatLegalMoney(e.running)])} empty="No billed lines or payments recorded on these jobs." />
        <div style={{ display: 'flex', gap: 18, fontSize: '0.84rem', marginTop: 6, flexWrap: 'wrap' }}>
          <span><span style={MUTED}>Billed</span> <b>{formatLegalMoney(a.totals.billed)}</b></span>
          <span><span style={MUTED}>Paid</span> <b>{formatLegalMoney(a.totals.paid)}</b></span>
          {a.totals.writtenDown ? <span><span style={MUTED}>Written down</span> <b>{formatLegalMoney(a.totals.writtenDown)}</b></span> : null}
          <span><span style={MUTED}>Balance</span> <b>{formatLegalMoney(a.totals.balance)}</b></span>
        </div>
        <SectionTitle doors={customerDoor('Property record')}>Property record</SectionTitle>
        <Table head={['Job', 'Address', 'County', 'Owner of record', 'Owner’s mailing address', 'Legal description', 'Parcel', 'Lien-ready']}
          rows={a.properties.map((p) => [<b key="j">{p.jobLabels.join(', ')}</b>, propertySourceNote(p.source) ? <span key="a">{p.address || '—'} <span style={{ ...MUTED }}>· {propertySourceNote(p.source)}</span></span> : (p.address || '—'), p.county || '—', p.owner ? `${p.owner}${p.ownerSource === 'job_override' ? ' (job override)' : ''}` : '—', ownerMailingAddressCell(p), p.legalDescription || '—', p.parcelId || '—', p.gaps.length ? pill(`missing ${p.gaps.join(', ')}`, 'warn') : pill('complete', 'ok')])}
          empty="No jobs on this account." />
      </div>
    )
  }

  if (tab === 'paper') {
    // Each job's own property kind (#85 item 6), the same as the firm's view.
    const kindWordsOf = (jobId: string) => propertyKindCell(a.jobs.find((j) => j.jobId === jobId)?.property?.propertyKind)
    const roleWords = a.payer.viaGc ? `subcontractor under ${a.payer.name}` : 'original contractor'
    return (
      <div>
        <SectionTitle doors={first ? <Door label="Contract desk" onClick={() => props.onOpenContract(first)} /> : null}>Agreements</SectionTitle>
        <Table head={['Job', 'Agreement', 'Sworn account', '']}
          rows={a.jobs.map((j) => [
            <b key="l">{j.label}</b>,
            <span key="s" style={j.contract.kind === 'signed' ? undefined : { color: '#b42318' }}>{coverageText(j.contract)}</span>,
            j.swornMissing.length ? pill(`needs ${j.swornMissing.join(', ')}`, 'warn') : pill('holds', 'ok'),
            <button key="b" type="button" onClick={() => { const job = jobOf(j.jobId); if (job) props.onOpenContract(job) }} style={btn}>{j.contract.kind === 'signed' ? 'View' : 'Contract…'}</button>,
          ])} empty="No jobs." />
        <SectionTitle doors={first ? <Door label="Liens on the job" onClick={() => props.onOpenLienInstruments(first)} /> : null}>Where each job stands</SectionTitle>
        {packet.paper.timelines.length === 0 ? <p style={{ ...MUTED, fontSize: '0.8rem', margin: '4px 0' }}>No jobs.</p> : packet.paper.timelines.map((t) => (
          <div key={t.jobId} data-legal-job-timeline={t.jobId} style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 190px) minmax(0, 1fr)', gap: 12, padding: '8px 0', borderBottom: '1px dotted var(--border)', alignItems: 'start', fontSize: '0.82rem' }}>
            <div>
              <button type="button" onClick={() => { const job = jobOf(t.jobId); if (job) props.onOpenLienInstruments(job) }} style={{ ...btn, fontWeight: 700 }}>{t.jobLabel}</button>
              <div style={{ ...MUTED, fontSize: '0.76rem' }}>{kindWordsOf(t.jobId)} · {roleWords}{legalLastWorkWords(t.lastWorkYmd, t.lastWorkSource) ? ` · ${legalLastWorkWords(t.lastWorkYmd, t.lastWorkSource)}` : ''}</div>
              <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatLegalMoney(t.openBalance)} open</div>
              {t.retainageWords ? <div style={{ ...MUTED, fontSize: '0.76rem' }}>{t.retainageWords}</div> : null}
            </div>
            <LienTimelineStrip
              timeline={t.timeline}
              viewScope="desk"
              nextDoor={(() => {
                // v2.6104 (punch list #214, PR 1): the next step's own press at the verdict band's right — the Lien desk for a notice, the Lien window's tab for the rest.
                const door = legalPaperNextDoor(t.timeline.next)
                const job = door ? jobOf(t.jobId) : null
                return door && job ? <button type="button" data-legal-paper-next-door={door.to} onClick={() => props.onOpenLienInstruments(job, door)} style={{ ...btn, fontWeight: 700 }}>{door.label}</button> : null
              })()}
              onOpenStep={(st) => setStop({ jobId: t.jobId, index: Math.max(0, t.timeline.steps.findIndex((x) => x.key === st.key)) })}
            />
            {stop && stop.jobId === t.jobId ? (
              <LienStopPaperWindow
                steps={t.timeline.steps}
                index={stop.index}
                onIndex={(i) => setStop({ jobId: t.jobId, index: i })}
                onClose={() => setStop(null)}
                jobLabel={t.jobLabel}
                timeline={t.timeline}
                paperFor={(step) => lienStopCounselPaper({ step, steps: t.timeline.steps, packet, jobId: t.jobId, voice: 'office', act: jobOf(t.jobId) ? { label: 'Open the job’s Lien window ›', onPress: () => { const job = jobOf(t.jobId); setStop(null); if (job) props.onOpenLienInstruments(job) } } : null, onCopy: copyRecord, copyLabel: copied ? 'Copied' : 'Copy the record as text' })}
              />
            ) : null}
          </div>
        ))}
        <p style={{ ...MUTED, fontSize: '0.76rem', margin: '4px 0 0' }}>The desk's own timeline, from each job's last approved clock day (else its last work date, else its creation month, as each job's line says), its filings and the property kind; the monthly notice applies when a GC pays (Click is the subcontractor), the affidavit to both.</p>
        <SectionTitle doors={first ? <Door label="Liens on the job" onClick={() => props.onOpenLienInstruments(first)} /> : null}>Supply houses</SectionTitle>
        {(() => {
          // Punch list #175 (v2.5835): the Lien window's card per job, from the same books, so the desk knows what the houses are owed before counsel asks.
          const lines = legalSupplierJobs(packet.paper.timelines.map((t) => ({ jobId: t.jobId, jobLabel: t.jobLabel, openBalance: t.openBalance, propertyKind: a.jobs.find((j) => j.jobId === t.jobId)?.property?.propertyKind ?? '' })), suppliers.byJob)
          if (!suppliers.loaded) return <p data-legal-suppliers="loading" style={{ ...MUTED, fontSize: '0.8rem', margin: '4px 0' }}>{LEGAL_SUPPLIERS_LOADING_WORDS}</p>
          if (lines.length === 0) return <p data-legal-suppliers="none" style={{ ...MUTED, fontSize: '0.8rem', margin: '4px 0' }}>{LEGAL_SUPPLIERS_EMPTY_WORDS}</p>
          return (
            <div data-legal-suppliers="jobs" style={{ display: 'grid', gap: 8, margin: '4px 0' }}>
              <p data-legal-suppliers-summary style={{ fontSize: '0.82rem', margin: 0 }}>{legalSuppliersSummaryWords(lines)}</p>
              {lines.map((l) => (
                <div key={l.jobId} data-legal-job-suppliers={l.jobId}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', margin: '2px 0 4px' }}>{l.jobLabel}</div>
                  <LienJobSuppliersCard job={l.suppliers} propertyKind={l.propertyKind} todayYmd={packet.todayYmd} openBalance={l.openBalance} payerName={a.payer.name} jobLabel={l.jobLabel} isMobile={false} startFolded markPaid={props.canEditReview ? { onChanged: suppliers.reload } : undefined} />
                </div>
              ))}
            </div>
          )
        })()}
        <p style={{ ...MUTED, fontSize: '0.76rem', margin: '4px 0 0' }}>{LEGAL_SUPPLIERS_NOTE}</p>
        <SectionTitle doors={first ? <Door label="Liens on the job" onClick={() => props.onOpenLienInstruments(first)} /> : null}>Final demand letters</SectionTitle>
        <Table head={['Job', 'Sent', 'Method', 'Tracking', 'Deadline', 'Amount', '']} numCols={[5]}
          rows={packet.paper.demandLetters.map((d) => [
            <b key="l">{d.jobLabel}</b>, d.sentYmd ?? pill('drafted, not sent', 'warn'), d.method, d.tracking || '—',
            <span key="d">{d.deadlineYmd ?? '—'} {d.deadlinePassed ? pill('passed', 'ok') : d.sentYmd ? pill('open', 'warn') : null}</span>,
            formatLegalMoney(d.amount),
            <button key="b" type="button" onClick={() => { const job = jobOf(d.jobId); if (job) props.onOpenLienInstruments(job) }} style={btn}>Open</button>,
          ])} empty="No demand letter recorded on this account." />
        <SectionTitle>The paper that went out</SectionTitle>
        <Table head={['', 'Paper', 'Went out', 'Claim', 'Months as printed', 'Jobs and shares', 'County · recording', 'Copy']} numCols={[3]}
          rows={packet.paper.envelopes.map((e) => [<b key="a">{e.letter}</b>, envelopeKindWords(e), envelopeWentOutWords(e, packet.todayYmd), <b key="c">{formatLegalMoney(e.claim)}</b>, envelopeMonthsWords(e) || '—', envelopeSharesWords(e, formatLegalMoney), [e.county, e.recordingNumber].filter(Boolean).join(' · ') || '—', e.documentUrl ? <a key="d" href={e.documentUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--text-link)', fontWeight: 600 }}>open ›</a> : '—'])}
          subRows={packet.paper.envelopes.map((e) => (e.answers ? <DeskEnvelopeAnswersBand key={e.key} e={e} packet={packet} /> : null))}
          empty="No § 53.056 notice, affidavit or release recorded." />
        <p style={{ ...MUTED, fontSize: '0.76rem', margin: '2px 0 0' }}>One row per envelope — a paper that covered several jobs (v2.3770, v2.3777) shows every share. A month marked <i>as information</i> was named after its own window closed and is not in the claim. Under a notice: the owner's call and the pile, letter two's clock and the GC's written okay, as the Lien desk records them — the firm reads the same band.</p>
      </div>
    )
  }

  // v2.5851: the Record of contact tab lives on the Timeline as the Said lane (its holds and doors went with it).
  if (tab === 'evidence') {
    return (
      <div>
        {/* v2.6210 (punch list #220): sworn statements, above the documents the scans land in. */}
        {planActs?.acts?.swearStatement || entries.some((e) => e.kind === 'statement') ? <LegalStatementsStrip entries={entries} todayYmd={packet.todayYmd} canEdit={Boolean(planActs?.acts?.swearStatement)} acts={planActs?.acts?.editStatement && planActs.acts.swearStatement ? { swear: () => planActs.acts!.swearStatement!(packet.todayYmd), open: planActs.acts.editStatement, print: (id: string) => planActs.acts!.editStatement!(id, { print: true }), openDocument: documents ? async (id: string) => { const row = documents.list.find((d) => d.id === id); if (!row) throw new Error(EVIDENCE_LANDING_GONE_WORDS); await openLegalMatterDocument(supabase, row) } : undefined } : null} /> : null}
        {documents ? <LegalMatterDocumentsPanel matterId={documents.matterId} documents={documents.list} canEdit={documents.canEdit} onChanged={documents.reload} payerName={selected.name} landOn={evidenceDoc} onLandingDone={onEvidenceLanded} /> : null}
        <SectionTitle doors={first ? <><Door label="Reports" onClick={() => props.onOpenReports(first)} /><Door label="Sessions" onClick={() => props.onOpenSessionNotes(first)} /><Door label="Job thread" onClick={() => props.onOpenJobThread(first.id)} /></> : null}>Proof the work happened</SectionTitle>
        <Table head={['Job', 'Field reports', 'Clock sessions', 'Hours', 'Worked', 'Job notes', 'Links']} numCols={[3]}
          rows={packet.evidence.map((e) => [
            <b key="l">{e.jobLabel}</b>,
            <span key="r">{e.reports}{e.reports ? <span style={MUTED}> · {e.reportsWithGps} with GPS</span> : null}{e.latestReport ? <div style={{ ...MUTED, fontSize: '0.76rem' }}>latest {calendarYmdInAppTzFromIso(e.latestReport.createdAt)} · {e.latestReport.templateName || 'report'} · {e.latestReport.authorName}</div> : null}</span>,
            <span key="s">{legalSessionWords(e)}</span>,
            `${e.hours}h`, e.firstWorkYmd ? `${e.firstWorkYmd} → ${e.lastWorkYmd}` : '—',
            <span key="n">{e.threadNotes}{e.latestNote ? <div style={{ ...MUTED, fontSize: '0.76rem', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.latestNote.body}</div> : null}</span>,
            <span key="k" style={{ display: 'flex', gap: 6 }}>
              {e.picturesLink ? <a href={e.picturesLink} target="_blank" rel="noreferrer" style={{ fontSize: '0.78rem' }}>Photos ↗</a> : null}
              {e.driveLink ? <a href={e.driveLink} target="_blank" rel="noreferrer" style={{ fontSize: '0.78rem' }}>Drive ↗</a> : null}
              {!e.picturesLink && !e.driveLink ? <span style={MUTED}>—</span> : null}
            </span>,
          ])} empty="No jobs." />
        <p style={{ ...MUTED, fontSize: '0.78rem', marginTop: 10 }}>Only approved clock sessions count: hours, days worked, the sworn-account check and the lien dates read them. Rejected and revoked sessions are left out; the rest show as awaiting approval. A sworn account needs at least one report or session carrying GPS on the property.</p>
      </div>
    )
  }

  // The firm's fees and costs the debtor owes (item 5): the contingency is the firm's share of a recovery, said on its own line.
  const fees = firmFeeRows(entries)
  const contingency = contingencyEntries(entries)
  const userNameOf = (id: string | null) => (id ? (props.users.find((u) => u.id === id)?.name ?? null) : null)
  const feeTotal = firmFeeEntries(entries).reduce((s, e) => s + Number(e.amount ?? 0), 0)
  // #85 item 17: questions and answers leave the steps table for the conversation, each answer under its question.
  // Planned steps (v2.5800) live on the Timeline tab, so On the matter stays as it was.
  // v2.6209: a statement lives on the Timeline's Said lane, as a planned step lives on the Timeline.
  const firmSteps = entries.filter((e) => e.kind !== 'fee' && e.kind !== 'cost' && e.kind !== 'plan' && e.kind !== 'statement' && !isConversationEntry(e))
  const talk = conversationRows(entries)
  const waitingOn = (list: ReadonlyArray<LegalEntryRow>) => list.filter((e) => e.via_portal && !e.acknowledged_at).length
  const askInput: CSSProperties = { font: 'inherit', fontSize: '0.8rem', padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)' }
  const answerBox = (e: LegalEntryRow): ReactNode =>
    !officeActs ? null : officeActs.answerFor?.entryId === e.id ? (
      <span key="a" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        <input value={officeActs.answerFor.text} onChange={(ev) => officeActs.setAnswerFor({ entryId: e.id, text: ev.target.value })} placeholder="Your answer" style={{ ...askInput, width: 220 }} />
        <button type="button" onClick={() => void officeActs.sendAnswer()} disabled={officeActs.busy} style={btn}>Send</button>
        <button type="button" onClick={() => officeActs.setAnswerFor(null)} style={btn}>Cancel</button>
      </span>
    ) : (
      <button key="a" type="button" onClick={() => officeActs.setAnswerFor({ entryId: e.id, text: '' })} style={btn}>Answer…</button>
    )
  return (
    <div>
      {officeActs && officeActs.canAsk ? <CounselReadPanel read={officeActs.counselRead} busy={officeActs.busy} onSave={officeActs.setCounselRead} /> : null}
      {officeActs && officeActs.canAsk ? <OffersPanel entries={entries} todayYmd={packet.todayYmd} busy={officeActs.busy} onAdd={officeActs.offerAdd} onStatus={officeActs.offerSetStatus} onUndo={officeActs.voidEntry} /> : null}
      <SectionTitle>Attorney fees and costs{fees.length ? ` · ${formatLegalMoney(feeTotal)}` : ''}</SectionTitle>
      {fees.length ? (
        <Table head={['Date', 'Kind', 'Note', 'By', 'Amount', '']} numCols={[4]} rows={fees.map((e) => [e.occurred_on, e.kind, <DeskVoidableText key="t" e={e} />, entryRecordedByWords(e, 'office', userNameOf), <span key="a" style={isVoidedEntry(e) ? { textDecoration: 'line-through', color: 'var(--text-muted)' } : undefined}>{formatLegalMoney(Number(e.amount ?? 0))}</span>, withFirmWait(e, officeActs && officeCanVoid(e) ? <DeskUndo key="u" onUndo={(reason) => officeActs.voidEntry(e.id, reason)} /> : officeActs && e.via_portal && !e.acknowledged_at && !isVoidedEntry(e) ? (
          // #85 item 18 PR 2: a fee or cost the firm adds is acknowledged here like a step, which clears it from Needs You.
          <button key="k" type="button" onClick={() => void officeActs.acknowledge(e.id)} disabled={officeActs.busy} style={btn}>Acknowledge</button>
        ) : e.via_portal && e.acknowledged_at ? <span key="k" style={{ ...MUTED, fontSize: '0.76rem' }}>seen</span> : '')])} empty="" />
      ) : contingency.length ? null : (
        // Empty words (punch list #184, sweep C): the firm fills this list on its portal, so there is no press here.
        <div data-legal-fees-empty>
          <EmptyState compact main="No fees or costs yet." tail={entries.length ? 'The firm has not added one.' : 'No firm is on this account. When one is, the fees and costs it adds list here and roll into the total demand.'} />
        </div>
      )}
      {contingency.length ? <p data-legal-contingency style={{ ...MUTED, fontSize: '0.8rem', margin: '4px 0 0' }}>The firm’s contingency on recoveries you applied, not in the demand: {contingency.map((e) => `${formatLegalMoney(Number(e.amount ?? 0))} on ${e.occurred_on}`).join(', ')}.</p> : null}
      {talk.length ? (
        <div data-legal-conversation>
          <SectionTitle>The conversation{officeActs && waitingOn(talk.map((r) => r.entry)) ? ` · ${waitingOn(talk.map((r) => r.entry))} from the firm waiting on you` : ''}</SectionTitle>
          <Table head={['Date', 'Who', 'What was said', '']}
            rows={talk.map((r) => {
              const e = r.entry
              const s = conversationStateWords(r, 'office')
              // #85 item 20 review: sign off only while the matter is with the firm (the RPC refuses otherwise).
              const acts = !r.isAnswer && r.thread.flavor === 'settlement' && r.thread.state === 'open' && officeActs ? (
                officeActs.canAsk ? <SettlementAnswer key="s" busy={officeActs.busy} onAnswer={(yes, note) => officeActs.answerSettlement(e.id, yes, note)} /> : <span key="s" style={{ ...MUTED, fontSize: '0.76rem' }}>No longer with the firm</span>
              ) : !r.isAnswer && r.thread.askedBy === 'firm' && r.thread.state === 'open' && officeActs ? (
                answerBox(e)
              ) : !r.isAnswer && r.thread.askedBy === 'office' && r.thread.state === 'open' && officeActs ? (
                <span key="q" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  {s ? pill(s.text, s.tone) : null}
                  <button type="button" onClick={() => void officeActs.withdrawFirmAsk(e.id)} disabled={officeActs.busy} style={btn}>Withdraw</button>
                </span>
              ) : r.isAnswer && e.via_portal && !e.acknowledged_at && officeActs ? (
                <button key="k" type="button" onClick={() => void officeActs.acknowledge(e.id)} disabled={officeActs.busy} style={btn}>Acknowledge</button>
              ) : s ? pill(s.text, s.tone) : null
              return [e.occurred_on, <span key="w" style={r.isAnswer ? { paddingLeft: 16, color: 'var(--text-muted)' } : undefined}>{r.isAnswer ? '↳ ' : ''}{conversationWho(r, 'office')}</span>, e.body, withFirmWait(e, acts)]
            })}
            empty="" />
        </div>
      ) : null}
      {firmSteps.length ? (
        <>
          <SectionTitle>On the matter{officeActs && waitingOn(firmSteps) ? ` · ${waitingOn(firmSteps)} from the firm waiting on you` : ''}</SectionTitle>
          <Table head={['Date', 'Kind', 'What happened', 'By', 'Amount', '']} numCols={[4]}
            rows={firmSteps.map((e) => {
              const waiting = e.via_portal && !e.acknowledged_at && !isVoidedEntry(e)
              const acts = isVoidedEntry(e) ? pill('undone', 'neutral') : officeActs && officeCanVoid(e) ? <DeskUndo key="u" onUndo={(reason) => officeActs.voidEntry(e.id, reason)} /> : officeActs && waiting ? (
                e.kind === 'payment_received' ? (
                  <span key="p" style={{ display: 'inline-flex', gap: 6 }}>
                    <button type="button" onClick={officeActs.onOpenPipelineRow} style={btn} title="Apply it on the job with Mark Paid, then come back">Mark Paid on the row ↗</button>
                    <button type="button" onClick={() => void officeActs.markApplied(e)} disabled={officeActs.busy} style={btn}>Mark applied</button>
                  </span>
                ) : stepProposalOf(e) ? (
                  // #85 item 16: a step that would move the stage back waits on the office; the stage has not moved.
                  <span key="k" style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => void officeActs.moveStage(stepProposalOf(e)?.stage ?? '', e.id)} disabled={officeActs.busy} style={btn}>Move it back to {legalStageLabel(stepProposalOf(e)?.stage).replace('With the firm · ', '')}</button>
                    <button type="button" onClick={() => void officeActs.acknowledge(e.id)} disabled={officeActs.busy} style={btn} title="Record it, leave the stage where it is">Keep {legalStageLabel(stepProposalOf(e)?.from).replace('With the firm · ', '')}</button>
                  </span>
                ) : (
                  <button key="k" type="button" onClick={() => void officeActs.acknowledge(e.id)} disabled={officeActs.busy} style={btn}>Acknowledge</button>
                )
              ) : waiting ? pill('waiting on the office', 'warn') : e.via_portal ? pill('seen', 'ok') : null
              const proposal = stepProposalOf(e)
              return [e.occurred_on, pill(legalEntryKindWords(e), e.via_portal ? 'legal' : 'neutral'), proposal && waiting ? <span key="b">{e.body}<span style={{ ...MUTED, display: 'block', fontSize: '0.74rem' }}>The stage stays at {legalStageLabel(proposal.from).replace('With the firm · ', '')} until you choose.</span></span> : <DeskVoidableText key="b" e={e} />, entryRecordedByWords(e, 'office', userNameOf), e.amount != null ? formatLegalMoney(Number(e.amount)) : '', withFirmWait(e, acts)]
            })}
            empty="" />
        </>
      ) : null}
      {officeActs && officeActs.canAsk ? (
        <div style={{ margin: '8px 0 6px' }} data-legal-ask>
          {officeActs.askForm ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8rem' }} data-legal-ask-form>
              <select value={officeActs.askForm.flavor} onChange={(ev) => officeActs.setAskForm({ ...officeActs.askForm!, flavor: ev.target.value === 'signoff' ? 'signoff' : 'question' })} style={askInput} aria-label="What to ask">
                <option value="question">A question</option>
                <option value="signoff">Sign off on a job</option>
              </select>
              {officeActs.askForm.flavor === 'signoff' ? (
                <select value={officeActs.askForm.jobId} onChange={(ev) => officeActs.setAskForm({ ...officeActs.askForm!, jobId: ev.target.value })} style={askInput} aria-label="Job">
                  {packet.account.jobs.map((j) => <option key={j.jobId} value={j.jobId}>{j.label}</option>)}
                </select>
              ) : null}
              <input value={officeActs.askForm.text} onChange={(ev) => officeActs.setAskForm({ ...officeActs.askForm!, text: ev.target.value })} placeholder={officeActs.askForm.flavor === 'signoff' ? 'What the owner wants to do, and why counsel should say yes or not yet' : 'Your question for the firm'} style={{ ...askInput, flex: '1 1 260px', minWidth: 0 }} aria-label="The ask" />
              <button type="button" onClick={() => void officeActs.sendAsk()} disabled={officeActs.busy || !officeActs.askForm.text.trim()} style={btn}>Send to the firm</button>
              <button type="button" onClick={() => officeActs.setAskForm(null)} style={btn}>Cancel</button>
            </div>
          ) : (
            <button type="button" onClick={() => officeActs.setAskForm({ flavor: 'question', jobId: packet.account.jobs[0]?.jobId ?? '', text: '' })} style={btn} title={officeActs.inHouse ? 'A question saved for counsel: the firm reads it on its portal once the matter is released' : 'A question for the firm, or a sign-off on one job — they answer on their portal and it lands on your Needs You list'}>{officeActs.inHouse ? 'Question for counsel…' : 'Ask the firm…'}</button>
          )}
        </div>
      ) : null}
      {/* v2.5851: What we did, in order lives on the Timeline's Did and Paper lanes. */}
      <SectionTitle>What goes to the firm</SectionTitle>
      {(() => {
        const details = exhibitDetails(packet)
        return (
          <>
            <p style={{ ...MUTED, fontSize: '0.8rem', margin: '0 0 6px' }}>{exhibitsSummaryWords(details)}</p>
            {details.map((x) => (
              <details key={x.letter} data-legal-exhibit style={{ border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', margin: '0 0 6px' }}>
                <summary style={{ cursor: 'pointer', padding: '6px 10px', fontSize: '0.84rem', display: 'flex', gap: 8, alignItems: 'baseline', listStyle: 'none' }}>
                  <span style={{ ...MUTED, fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{x.section}</span>
                  {x.section.slice(4).toLowerCase() === x.title.toLowerCase() ? null : <span style={{ fontWeight: 600 }}>{x.title}</span>}
                  <span style={MUTED}>· {x.count}</span>
                </summary>
                <div style={{ padding: '0 10px 8px', borderTop: '1px solid var(--border)' }}>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: '0.8rem' }}>
                    {x.lines.map((l, i) => <li key={i}>{l}</li>)}
                    {x.more > 0 ? <li style={MUTED}>and {x.more} more</li> : null}
                  </ul>
                  {onTab ? (() => { const t: Tab = x.tab === 'their_word' ? 'timeline' : x.tab; return <div style={{ marginTop: 6 }}><Door label={`Open ${TAB_LABELS[t]}`} onClick={() => onTab(t)} /></div> })() : null}
                </div>
              </details>
            ))}
          </>
        )
      })()}
    </div>
  )
}
