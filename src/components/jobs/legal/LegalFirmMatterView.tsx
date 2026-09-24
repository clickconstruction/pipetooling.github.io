import type { ReactNode } from 'react'
import { COPPER, FAINT, HAIR, INK, MUTED, NOTE_BAND, PAPER_GREEN, PAPER_RED } from '../../../lib/portal/portalTheme'
import { formatLegalMoney, type LegalPacket } from '../../../lib/legal/legalPacket'
import { envelopeAnswersWords, envelopeKindWords, envelopeMonthsWords, envelopeSharesWords, envelopeWentOutWords, type LegalEnvelope } from '../../../lib/legal/legalLienPaper'
import { legalEntryKindWords } from '../../../lib/legal/legalAsks'
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
          <tr key={ri}>{r.map((c, ci) => <td key={ci} style={{ ...portalTd, ...(numCols.includes(ci) ? portalNum : null) }}>{c}</td>)}</tr>,
          ...(subRows[ri] ? [<tr key={`${ri}-sub`}><td colSpan={head.length} style={{ ...portalTd, paddingTop: 0 }}>{subRows[ri]}</td></tr>] : []),
        ])}</tbody>
      </table>
    </div>
  )
}

/** The GC the owner's answers are about — the payer when Click is the subcontractor. */
function envelopeGcName(packet: LegalPacket): string {
  return packet.account.payer.viaGc ? packet.account.payer.name : 'the GC'
}

/** Under a § 53.056 notice (#41 PR 1b): the owner's answers and the pile, letter two's clock, the GC's written okay. */
function EnvelopeAnswersBand({ e, packet }: { e: LegalEnvelope; packet: LegalPacket }) {
  if (!e.answers) return null
  const w = envelopeAnswersWords(e.answers, { todayYmd: packet.todayYmd, gcName: envelopeGcName(packet), formatMoney: formatLegalMoney })
  return (
    <div data-legal-envelope-answers={e.key} style={{ background: NOTE_BAND, borderRadius: 6, padding: '6px 10px', fontSize: 12.5, lineHeight: 1.45 }}>
      <div><b>The owner's answers</b> <span style={{ color: MUTED }}>· {w.owner}</span></div>
      <div><b>Letter two</b> <span style={{ color: MUTED }}>· {w.letterTwo}</span> <b style={{ marginLeft: 10 }}>GC's written okay to pay Click direct:</b> <span style={{ color: MUTED }}>{w.gcOkay}</span></div>
    </div>
  )
}

/** Where each job stands (#41 PR 1): the job's rail and its next line, the desk's own kernel on the firm's paper. */
function JobTimelines({ packet }: { packet: LegalPacket }) {
  const a = packet.account
  if (packet.paper.timelines.length === 0) return <p style={{ color: MUTED, fontSize: 13, margin: '4px 0' }}>No jobs.</p>
  const kind = a.properties[0]?.propertyKind
  const kindWords = kind === 'residential' ? 'residential' : kind ? 'non-residential' : 'property kind unknown'
  const roleWords = a.payer.viaGc ? `subcontractor under ${a.payer.name}` : 'original contractor'
  return (
    <div>
      {packet.paper.timelines.map((t) => (
        <div key={t.jobId} data-legal-job-timeline={t.jobId} style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 190px) minmax(0, 1fr)', gap: 12, padding: '8px 0', borderBottom: `1px dotted ${HAIR}`, alignItems: 'start' }}>
          <div style={{ fontSize: 12.5 }}>
            <b style={{ fontSize: 13 }}>{t.jobLabel}</b>
            <div style={{ color: MUTED, fontSize: 11.5 }}>{kindWords} · {roleWords}{t.lastWorkYmd ? ` · last on site ${t.lastWorkYmd}` : ''}</div>
            <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatLegalMoney(t.openBalance)} open</div>
            {t.retainageWords ? <div style={{ color: MUTED, fontSize: 11.5 }}>{t.retainageWords}</div> : null}
          </div>
          <LienTimelineStrip timeline={t.timeline} />
        </div>
      ))}
    </div>
  )
}

export function FirmMatterTab({ tab, packet, matter, acts }: { tab: FirmTab; packet: LegalPacket; matter: FirmMatterLike; acts?: ReactNode }) {
  const a = packet.account
  const h = portalH
  if (tab === 'account') {
    return (
      <div>
        <PortalTable head={['Date', 'Entry', 'Amount']} numCols={[2]} rows={a.ledger.map((e) => [e.ymd ?? '—', e.text, <span key="a" style={{ color: e.amount < 0 ? PAPER_GREEN : undefined }}>{formatLegalMoney(e.amount)}</span>])} empty="No billed lines or payments on record." />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 18, fontSize: 13.5, padding: '8px 8px 0', fontWeight: 700 }}><span style={{ color: MUTED, fontWeight: 400 }}>Balance</span><span style={portalNum}>{formatLegalMoney(a.totals.balance)}</span></div>
        <div style={h}>Who owes</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 12px', fontSize: 13.5 }}>
          <span style={{ color: MUTED }}>Payer</span><span>{a.payer.name}{a.payer.viaGc ? ' · general contractor on the job' : ''}{a.customerType ? ` · ${a.customerType}` : ''}</span>
          <span style={{ color: MUTED }}>Address</span><span>{a.customerAddress || '—'}</span>
          <span style={{ color: MUTED }}>Emails</span><span>{a.emails.join(', ') || 'none on file'}</span>
          <span style={{ color: MUTED }}>Phones</span><span>{a.phones.join(', ') || 'none on file'}</span>
          <span style={{ color: MUTED }}>Terms with Click</span><span>{a.paymentTerms}</span>
        </div>
        {a.contacts.length ? (<><div style={h}>Contacts</div><PortalTable head={['Name', 'Email', 'Phone']} rows={a.contacts.map((c) => [c.name, c.email ?? '—', c.phone ?? '—'])} empty="" /></>) : null}
        <div style={h}>Jobs</div>
        <PortalTable head={['Job', 'Name', 'Address', 'Age', 'Basis', 'Balance']} numCols={[3, 5]} rows={a.jobs.map((j) => [<b key="l">{j.label}</b>, j.name, j.address, j.agingDays == null ? '—' : `${j.agingDays}d`, j.contract.kind === 'signed' ? 'signed contract' : j.swornMissing.length === 0 ? 'sworn account holds' : `needs ${j.swornMissing.join(', ')}`, formatLegalMoney(j.balance)])} empty="No jobs." />
        <div style={h}>Property record</div>
        <PortalTable head={['Address', 'County', 'Owner of record', 'Legal description', 'Parcel', 'Kind']} rows={a.properties.map((p) => [p.address, p.county || '—', p.owner || '—', p.legalDescription || '—', p.parcelId || '—', p.propertyKind === 'residential' ? 'residential' : p.propertyKind ? 'non-residential' : '—'])} empty="No property record on file." />
      </div>
    )
  }
  if (tab === 'paper') {
    return (
      <div>
        <div style={h}>Agreements and theory</div>
        <PortalTable head={['Job', 'Agreement', 'Sworn account', '']} rows={a.jobs.map((j) => {
          const c = matter.contracts.find((x) => x.job_id === j.jobId && x.signedPdfUrl)
          return [<b key="l">{j.label}</b>, <span key="s" style={{ color: j.contract.kind === 'signed' ? undefined : PAPER_RED }}>{j.contract.kind === 'signed' ? `Signed${j.contract.signedAt ? ` ${j.contract.signedAt.slice(0, 10)}` : ''}${j.contract.signerName ? ` by ${j.contract.signerName}` : ''} · ${j.contract.source}` : j.contract.kind === 'sent' ? 'Sent, never signed' : 'None on file'}</span>, j.swornMissing.length ? `needs ${j.swornMissing.join(', ')}` : 'holds — bill received, GPS evidence, no dispute', c ? <a key="p" href={c.signedPdfUrl as string} target="_blank" rel="noreferrer" style={{ color: COPPER }}>PDF ↗</a> : null]
        })} empty="No jobs." />
        <div style={h}>Where each job stands</div>
        <JobTimelines packet={packet} />
        <div style={h}>Final demand letters</div>
        <PortalTable head={['Job', 'Sent', 'Method', 'Tracking', 'Deadline', 'Amount']} numCols={[5]} rows={packet.paper.demandLetters.map((d) => [<b key="l">{d.jobLabel}</b>, d.sentYmd ?? 'not sent', d.method, d.tracking || '—', `${d.deadlineYmd ?? '—'}${d.deadlinePassed ? ' · passed' : ''}`, formatLegalMoney(d.amount)])} empty="No demand letter on record from Click." />
        <div style={h}>The paper that went out</div>
        <PortalTable head={['', 'Paper', 'Went out', 'Claim', 'Months as printed', 'Jobs and shares', 'County · recording', 'Copy']} numCols={[3]} rows={packet.paper.envelopes.map((e) => [<b key="a" style={{ color: COPPER }}>{e.letter}</b>, envelopeKindWords(e), envelopeWentOutWords(e, packet.todayYmd), <b key="c">{formatLegalMoney(e.claim)}</b>, envelopeMonthsWords(e) || '—', envelopeSharesWords(e, formatLegalMoney), [e.county, e.recordingNumber].filter(Boolean).join(' · ') || '—', e.documentUrl ? <a key="d" href={e.documentUrl} target="_blank" rel="noreferrer" style={{ color: COPPER }}>open ↗</a> : '—'])} subRows={packet.paper.envelopes.map((e) => (e.answers ? <EnvelopeAnswersBand key={e.key} e={e} packet={packet} /> : null))} empty="No § 53.056 notice, affidavit or release recorded." />
        <p style={{ fontSize: 12, color: MUTED, margin: '6px 0 0' }}>A month marked <i>as information</i> was named on the paper after its own notice window had closed; it is not in the claim. Under a notice: the owner's answers to the three questions the letter asks (and counsel's pile), whether the second owner letter is due or sent, and any written okay from the GC for the owner to pay Click directly. Dates above are the app's reading of Chapter 53 from each job's last day on site and the property kind.</p>
      </div>
    )
  }
  if (tab === 'their_word') {
    const tw = packet.theirWord
    return (
      <div>
        <p style={{ fontSize: 12.5, color: MUTED, margin: '4px 0 8px' }}>Everything the office has on record with this customer that it chose to share — contacts, promises{tw.decided ? ` (keeps ${tw.kept} of ${tw.decided}${tw.broken ? `, ${tw.broken} broken` : ''})` : ''}, collection calls, and why it was parked — oldest first.</p>
        <PortalTable head={['Date', 'Kind', 'Job', 'What was said', 'By']} rows={tw.timeline.filter((e) => e.shared).map((e) => [e.ymd, e.kind === 'note' ? 'collections' : e.kind, e.jobLabel ?? 'account', e.text, e.by ?? 'the customer'])} empty="Nothing on record that the office shared." />
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
  const fees = matter.entries.filter((e) => e.kind === 'fee' || e.kind === 'cost')
  const steps = matter.entries.filter((e) => e.kind !== 'fee' && e.kind !== 'cost')
  return (
    <div>
      <div style={h}>Fees and costs</div>
      <PortalTable head={['Date', 'Kind', 'Note', 'Amount']} numCols={[3]} rows={fees.map((e) => [e.occurred_on, e.kind, e.body, formatLegalMoney(Number(e.amount ?? 0))])} empty="None yet." />
      {acts}
      <div style={h}>On this matter</div>
      <PortalTable head={['Date', 'Kind', 'What happened', 'Office']} rows={steps.map((e) => [e.occurred_on, legalEntryKindWords(e), e.body, e.via_portal ? (e.acknowledged_at ? 'seen' : 'waiting on the office') : e.kind === 'question' ? (e.acknowledged_at ? 'withdrawn' : 'asks you') : 'the office'])} empty="No steps recorded." />
      <div style={h}>What Click did, in order</div>
      <PortalTable head={['Date', 'Job', 'Step', 'What happened']} rows={packet.feesAndSteps.steps.map((s) => [s.ymd ?? '—', s.jobLabel ?? '', s.kind, s.text])} empty="No steps recorded." />
    </div>
  )
}

/** The matter card (header + tab strip + the tab) and the exhibits card, exactly as the firm's page lays them out. */
export function FirmMatterView({ packet, matter, tab, onTab, acts, onPrint }: {
  packet: LegalPacket
  matter: FirmMatterLike
  tab: FirmTab
  onTab: (t: FirmTab) => void
  /** The firm's acts on Fees & steps — the portal injects them; the desk's preview passes nothing. */
  acts?: ReactNode
  onPrint: () => void
}) {
  const totalDemand = packet.account.totals.balance + matter.entries.filter((e) => e.kind === 'fee' || e.kind === 'cost').reduce((s, e) => s + Number(e.amount ?? 0), 0)
  return (
    <div>
      <div style={portalCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={portalCap}>Matter</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{matter.payerName}</div>
            <div style={{ fontSize: 12.5, color: MUTED }}>
              {packet.account.customerAddress || packet.account.jobs[0]?.address || ''}
              {packet.account.properties[0]?.county ? ` · ${packet.account.properties[0].county} County` : ''}
              {packet.account.properties[0]?.owner ? ` · owner of record: ${packet.account.properties[0].owner}` : ''}
              {' · theory: '}<b style={{ color: INK }}>{packet.theory.label}</b>
            </div>
            {matter.noteToFirm ? <div style={{ fontSize: 12.5, marginTop: 4, color: MUTED }}><b style={{ color: INK }}>From Click:</b> {matter.noteToFirm}</div> : null}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ ...portalNum, fontSize: 20, fontWeight: 700 }}>{formatLegalMoney(totalDemand)}</div>
            <div style={{ fontSize: 12, color: MUTED }}>total demand · balance {formatLegalMoney(packet.account.totals.balance)}</div>
            <button type="button" style={{ ...portalBtn, marginTop: 6, background: COPPER, color: '#fff' }} onClick={onPrint}>
              ⎙ Print packet
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${HAIR}`, margin: '14px 0 12px', fontSize: 13 }}>
          {FIRM_TABS.map((t) => (
            <button key={t} type="button" onClick={() => onTab(t)} style={{ background: 'none', border: 'none', padding: '6px 12px', color: tab === t ? INK : MUTED, borderBottom: tab === t ? `2px solid ${COPPER}` : '2px solid transparent', fontWeight: tab === t ? 700 : 500, cursor: 'pointer', font: 'inherit', fontSize: 13 }}>
              {FIRM_TAB_LABELS[t]}
            </button>
          ))}
        </div>
        <FirmMatterTab tab={tab} packet={packet} matter={matter} acts={acts} />
      </div>
      <div style={{ ...portalCard, marginTop: 12 }}>
        <div style={portalCap}>Exhibits</div>
        {packet.exhibits.length ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8 }}>
            <tbody>
              {packet.exhibits.map((x) => (
                <tr key={x.letter}>
                  <td style={{ padding: '6px 4px', borderBottom: `1px dotted ${HAIR}`, color: COPPER, fontWeight: 700, width: 26 }}>{x.letter}</td>
                  <td style={{ padding: '6px 4px', borderBottom: `1px dotted ${HAIR}` }}>{x.title} <span style={{ color: FAINT }}>· {x.count} item{x.count === 1 ? '' : 's'}</span></td>
                  <td style={{ padding: '6px 4px', borderBottom: `1px dotted ${HAIR}`, textAlign: 'right', fontSize: 12, color: FAINT }}>
                    {x.title === 'Signed agreements' && matter.contracts.some((c) => c.signedPdfUrl) ? matter.contracts.filter((c) => c.signedPdfUrl).map((c) => <a key={c.id} href={c.signedPdfUrl as string} target="_blank" rel="noreferrer" style={{ color: COPPER, marginLeft: 8 }}>PDF ↗</a>) : 'in the printed packet'}
                  </td>
                </tr>
              ))}
              {packet.account.jobs.some((j) => j.contract.kind !== 'signed') ? <tr><td style={{ padding: '6px 4px', color: FAINT }}>—</td><td colSpan={2} style={{ padding: '6px 4px', color: PAPER_RED }}>No signed agreement on {packet.account.jobs.filter((j) => j.contract.kind !== 'signed').map((j) => j.label).join(', ')}{packet.theory.key === 'sworn' ? ' — proceeds as a sworn account' : ''}</td></tr> : null}
            </tbody>
          </table>
        ) : <p style={{ color: MUTED, fontSize: 13 }}>Nothing to letter yet.</p>}
      </div>
    </div>
  )
}
