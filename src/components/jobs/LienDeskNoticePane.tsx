import type React from 'react'
import { useEffect, useState } from 'react'
import { type LienDeskData, type LienDeskGc, type LienDeskJob } from '../../hooks/useLienDeskData'
import { type NoticePayPage } from '../../hooks/useNoticePayPage'
import { formatYmdMonthDay, type PromisedPayDate } from '../../lib/jobs/billedExpectedPay'
import { workMonthLabel, workMonthShort, type JobWorkMonths } from '../../lib/jobs/forecastWorkMonths'
import { coverLetterKindFor } from '../../lib/jobs/gcOnNotice'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { lienNothingBilledWords, type LienClaimBill } from '../../lib/jobs/lienClaimBills'
import { claimDeltaWords, correctionNeedsLook, correctionSetWords, type CorrectedClaim, type LienClaimCorrection } from '../../lib/jobs/lienClaimCorrection'
import { clearLienClaimCorrection, lookLienClaimCorrection, saveLienClaimCorrection } from '../../lib/jobs/lienClaimCorrectionIo'
import { LIEN_NOTICE_POLICIES, type LienDeskEntry, type LienDeskPile, type LienNoticePolicy } from '../../lib/jobs/lienDesk'
import { moneyWords } from '../../lib/moneyParts'
import { Money, MoneyText } from '../Money'
import { lienGcNoticePress } from '../../lib/jobs/lienDeskGcPicker'
import { LIEN_APPROVE_NO_MAIL_BY, LIEN_GC_GATE_NO_ADDRESS, lienFootBlockedSentence, lienGateMonthLine, lienGateShortWords, ownerSourceWords, propertyKindLine, propertyKindRuleWords, propertyKindSwitchWarning, sharedWithWords, type LienGate, type LienGateKey, type LienGateVerdict, type LienSentGatesFold } from '../../lib/jobs/lienDeskGates'
import { shortDay as footShortDay } from '../../lib/jobs/lienFootChip'
import { lienDeskJobLabel as jobLabel } from '../../lib/jobs/lienJobLabel'
import { LIEN_HOUSES_PARAGRAPH_READ_BY_COUNSEL, type LienSupplierJob } from '../../lib/jobs/lienJobSuppliers'
import { lienLastWorkDoorOffered } from '../../lib/jobs/lienLastWorkDoor'
import { lienLastWorkAffidavitMonths } from '../../lib/jobs/lienLastWorkDayPreview'
import { letterTwoKindLabel } from '../../lib/jobs/lienLetterTwo'
import { type LienMonthGrid } from '../../lib/jobs/lienMonthGrid'
import { type LienNextAct, type LienNextActDoor } from '../../lib/jobs/lienNextAct'
import { retainageInsideClaim, type LienDeskDraftFields } from '../../lib/jobs/lienNoticeDraft'
import { payPageSummary } from '../../lib/jobs/lienNoticePayPage'
import { LIEN_NOTICE_FIELD_GUIDE, wordingLineText, type LienNoticeFieldKey } from '../../lib/jobs/lienNoticePreview'
import { LIEN_RELEASE_PARAGRAPH_READ_BY_COUNSEL, type NoticeRelease } from '../../lib/jobs/lienNoticeRelease'
import { type LienNoticeSignature } from '../../lib/jobs/lienNoticeSignature'
import { type ResolvedLienProperty } from '../../lib/jobs/lienProperty'
import { type LienStripChip, type LienStripChipAct, type LienStripChipTone } from '../../lib/jobs/lienStripChips'
import { type LienTimeline, type LienTimelineStep } from '../../lib/jobs/lienTimeline'
import { ownerFromRollUnconfirmed } from '../../lib/jobs/ownerConfirm'
import { jobsSharingProperty, normalizePropertyKind, type PropertyKind } from '../../lib/jobs/propertyKind'
import { rollMailingLines } from '../../lib/jobs/rollMailingLines'
import { demandDate } from '../../lib/jobsDocuments/demandLetter'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { txCountyCadPropertyUrl, txCountyCadSearchUrl } from '../../lib/txCountyLookup'
import { type Json } from '../../types/database'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import LienClaimBills from './LienClaimBills'
import LienClaimBox from './LienClaimBox'
import LienDeskGates, { LienGatesSentFold } from './LienDeskGates'
import LienDeskMonths, { type LienDeskMonthCard } from './LienDeskMonths'
import LienDeskOwnerPane from './LienDeskOwnerPane'
import { LienStepRow } from './LienDeskSteps'
import { LienEnvelopeCard } from './LienEnvelopeCard'
import { LienJobHeading } from './LienJobNumber'
import { LienJobSuppliersCard } from './LienJobSuppliers'
import { LienLastWorkDayLine } from './LienLastWorkDayLine'
import { LienLastWorkDayWindow } from './LienLastWorkDayWindow'
import LienStopPaperWindow, { type LienStopPaper } from './LienStopPaperWindow'
import LienTimelineStrip, { LienTimelineViewSwitch } from './LienTimelineStrip'
import PropertyKindSwitch from './PropertyKindSwitch'
import type { LienPaneSectionKey } from '../../lib/jobs/lienPaneSections'
import { lienBtnStyle as btn } from './lienDeskButtonStyles'
import { lienBoxHeadStyle as boxHead, lienRowChipStyle as chip } from './lienDeskRowStyles'
import { LIEN_STRIP_COLLAPSE_PX as STRIP_COLLAPSE_PX, lienBoxStyle as boxStyle, lienLinkBtnStyle as linkBtn, lienPaperStyle as paperStyle, lienStripLabelStyle, lienStripStyle } from './lienDeskPaneStyles'

/**
 * What the notice pane reads from the Lien desk (v2.7619). The pane was one 557-line expression inside
 * `LienDesk.tsx` and read the desk's selection, context, paper, pages and presses directly. It reads the same
 * names from this one object now, so its body is unchanged. The types are the compiler's own for each name.
 * The desk builds the object on every render; the pane holds no state.
 */
export type LienNoticePaneContext = {
  paneHead: (key: LienPaneSectionKey) => JSX.Element | null
  goToSection: (key: LienPaneSectionKey) => void
  relightPane: (host: HTMLElement) => void
  data: LienDeskData | null
  todayYmd: string
  authUserId: string | null
  authName: string
  onChanged: () => void
  onOpenEditJob: (jobId: string, focus?: "property-record" | "gc" | "lien-contract") => void
  onOpenJob: ((jobId: string) => void) | undefined
  /** Put a GC on notice (v2.7806): the run window for a GC, opened by the press beside the GC's name on the job's heading. */
  onPutGcOnNotice: ((gcId: string) => void) | undefined
  onCalendarChanged: ((what: "promise" | "kind" | "last_work") => void) | undefined
  isMobile: boolean
  leader: boolean
  office: boolean
  setCheckedMonths: React.Dispatch<React.SetStateAction<ReadonlySet<string> | null>>
  coverNote: boolean
  setCoverNote: React.Dispatch<React.SetStateAction<boolean>>
  housesInLetter: boolean
  setHousesInLetter: React.Dispatch<React.SetStateAction<boolean>>
  releaseId: string | null
  setByHandOpen: React.Dispatch<React.SetStateAction<boolean>>
  rulePick: LienNoticePolicy | null
  setRulePick: React.Dispatch<React.SetStateAction<LienNoticePolicy | null>>
  detailsOpen: boolean
  setDetailsOpen: React.Dispatch<React.SetStateAction<boolean>>
  busy: boolean
  run: (label: string, fn: () => Promise<void>, done?: string) => Promise<boolean>
  touchDraft: () => void
  editing: { key: LienNoticeFieldKey; value: string; rect: { top: number; left: number; width: number; height: number; }; font: string; } | null
  setEditing: React.Dispatch<React.SetStateAction<{ key: LienNoticeFieldKey; value: string; rect: { top: number; left: number; width: number; height: number; }; font: string; } | null>>
  paperRef: React.MutableRefObject<HTMLDivElement | null>
  editInputRef: React.MutableRefObject<HTMLInputElement | null>
  payEditing: { invoiceId: string; value: string; rect: { top: number; left: number; width: number; height: number; }; font: string; } | null
  setPayEditing: React.Dispatch<React.SetStateAction<{ invoiceId: string; value: string; rect: { top: number; left: number; width: number; height: number; }; font: string; } | null>>
  payPaperRef: React.MutableRefObject<HTMLDivElement | null>
  payInputRef: React.MutableRefObject<HTMLInputElement | null>
  claimOpenSignal: number
  paneScrolled: boolean
  setPaneScrolled: React.Dispatch<React.SetStateAction<boolean>>
  stripRef: React.MutableRefObject<HTMLDivElement | null>
  paneRef: React.MutableRefObject<HTMLDivElement | null>
  activeGate: { key: LienGateKey; at: number; } | null
  pickGate: (key: LienGateKey) => void
  kindOpen: boolean
  setKindOpen: React.Dispatch<React.SetStateAction<boolean>>
  kindBusy: boolean
  setNoticeFootHome: React.Dispatch<React.SetStateAction<HTMLDivElement | null>>
  entries: LienDeskEntry[]
  suppliers: { byJob: ReadonlyMap<string, LienSupplierJob>; loaded: boolean; reload: () => void; }
  selected: LienDeskEntry | null
  job: LienDeskJob | undefined
  gc: LienDeskGc | undefined
  address: { address: string; county: string; county_source: string; created_at: string | null; customer_id: string; homestead: boolean; homestead_answered_at: string | null; id: string; is_primary: boolean; jp_precinct: string; jp_precinct_at: string | null; jp_precinct_note: string; jp_precinct_source: string; legal_description: string; lien_public_answer: string | null; lien_public_answered_at: string | null; lien_public_answered_by: string | null; lien_public_reason: string | null; note: string | null; owner_company: string; owner_confirmed_at: string | null; owner_confirmed_by: string | null; owner_email: string; owner_mailing_address: string; owner_mode: string; owner_name: string; owner_phone: string; parcel_id: string; parcel_looked_up_at: string | null; parcel_source: string; parcel_tax_year: string; property_kind: string; sequence_order: number; updated_at: string | null; } | null
  property: ResolvedLienProperty
  ownerName: string
  stopOpen: number | null
  setStopOpen: React.Dispatch<React.SetStateAction<number | null>>
  pickKind: (next: PropertyKind) => Promise<void>
  promise: PromisedPayDate | null
  gcHasPriorNotice: boolean
  wm: JobWorkMonths | null
  item: { approval_mode: string | null; approved_at: string | null; approved_by: string | null; cover_note: boolean; created_at: string; drafted_at: string; drafted_by: string | null; fields: Json; held_at: string | null; held_by: string | null; hold_reason: string; hold_until: string | null; id: string; job_id: string; kind: string; mailed_copies: Json; months: string[]; offer_by: string | null; offer_pct: number; offer_set_at: string | null; offer_set_by: string | null; printed_at: string | null; printed_by: string | null; pulled_back_at: string | null; pulled_back_by: string | null; sent_at: string | null; sent_filing_id: string | null; signed_at: string | null; signed_by: string | null; signed_fields_hash: string | null; signed_leader_confirmed_at: string | null; signed_on_device_of: string | null; signed_recorded_by: string | null; signed_witness_how: string | null; signer_printed_name: string | null; signer_signature_mode: string | null; signer_signature_storage_path: string | null; status: string; submitted_at: string | null; updated_at: string; voided_at: string | null; word_channel: string; word_note: string; } | null
  storedDraft: LienDeskDraftFields | null
  months: ReadonlySet<string>
  monthsList: string[]
  openBalance: number
  supplierJob: LienSupplierJob | undefined
  correction: LienClaimCorrection | null
  lastSentAt: string | null
  claimed: CorrectedClaim
  wordingDiff: LienNoticeFieldKey[]
  wordingEditedBy: string | null
  wordingLocked: boolean
  paneSignature: LienNoticeSignature | null
  signClearedLine: string | null
  docHtml: string
  onPaperClick: (ev: React.MouseEvent<HTMLDivElement>) => void
  commitEdit: () => void
  claimNumber: number
  noticeRelease: NoticeRelease | null
  releaseHtml: string
  coverHtml: string
  payPage: NoticePayPage
  claimBills: LienClaimBill[]
  unbilled: number
  billFromHere: () => void
  billWhy: string
  payChangedCount: number
  payHtml: string
  onPayPaperClick: (ev: React.MouseEvent<HTMLDivElement>) => void
  commitPayEdit: () => void
  pageTotal: number
  noticePageNumber: number
  noteMissed: (months: string[]) => Promise<void>
  gcOpenTotal: number
  toggleRelease: (on: boolean) => void
  partedBandNode: JSX.Element | null
  saveRule: (policy: LienNoticePolicy) => Promise<boolean>
  openPreview: () => void
  counts: Record<LienDeskPile, number> | undefined
  relightPages: (host: HTMLElement) => void
  pageLabel: (key: string, words: string, extra: { words: string; amber?: boolean; pay?: boolean; } | null) => JSX.Element
  monthCards: LienDeskMonthCard[]
  monthGrid: LienMonthGrid | null
  gates: LienGate[]
  gateVerdict: LienGateVerdict
  gateByKey: Record<LienGateKey, LienGate>
  gatesFold: LienSentGatesFold | null
  timeline: LienTimeline | null
  stopPaperFor: (step: LienTimelineStep) => LienStopPaper
  footInPane: boolean
  stripChips: LienStripChip[]
  pressStripChip: (act: LienStripChipAct) => void
  stripChipStyle: (tone: LienStripChipTone) => React.CSSProperties
  simpleApprove: boolean
  bandAct: LienNextAct | null
  onBandAct: (act: LienNextActDoor) => void | Promise<boolean>
}

/**
 * The notice pane (its own file since v2.7619, out of `LienDesk.tsx` as it stood): the strip that takes over once
 * the gates scroll away, the job's heading, the leader's one-screen approve, the path, the gates with their
 * doors, the supply houses, the months, the envelope, then the pages as the packet prints them (the cover, the
 * release, the notice with its wording typed in place, the pay page) and the footer's home. With no job picked it
 * says so.
 *
 * The paper and the box typed over it stay inside one `position: relative` container here, as the wording
 * editor needs.
 */
export function LienDeskNoticePane({ ctx }: { ctx: LienNoticePaneContext }) {
  const { data, todayYmd, authUserId, authName, onChanged, onOpenEditJob, onOpenJob, onPutGcOnNotice, onCalendarChanged, isMobile, leader, office, setCheckedMonths, coverNote, setCoverNote, housesInLetter, setHousesInLetter, releaseId, setByHandOpen, rulePick, setRulePick, detailsOpen, setDetailsOpen, busy, run, touchDraft, editing, setEditing, paperRef, editInputRef, payEditing, setPayEditing, payPaperRef, payInputRef, claimOpenSignal, paneScrolled, setPaneScrolled, stripRef, paneRef, activeGate, pickGate, kindOpen, setKindOpen, kindBusy, setNoticeFootHome, entries, suppliers, selected, job, gc, address, property, ownerName, stopOpen, setStopOpen, pickKind, promise, gcHasPriorNotice, wm, item, storedDraft, months, monthsList, openBalance, supplierJob, correction, lastSentAt, claimed, wordingDiff, wordingEditedBy, wordingLocked, paneSignature, signClearedLine, docHtml, onPaperClick, commitEdit, claimNumber, noticeRelease, releaseHtml, coverHtml, payPage, claimBills, unbilled, billFromHere, billWhy, payChangedCount, payHtml, onPayPaperClick, commitPayEdit, pageTotal, noticePageNumber, noteMissed, gcOpenTotal, toggleRelease, partedBandNode, saveRule, openPreview, counts, relightPages, pageLabel, monthCards, monthGrid, gates, gateVerdict, gateByKey, gatesFold, timeline, stopPaperFor, footInPane, stripChips, pressStripChip, stripChipStyle, simpleApprove, bandAct, onBandAct, paneHead, goToSection, relightPane } = ctx
  // The last day's window, opened from under the timeline's LAST WORK stop (v2.7684). It closes when another job is picked.
  const [lastWorkOpen, setLastWorkOpen] = useState(false)
  const selectedJobId = selected?.jobId ?? null
  // The press beside the GC's name (v2.7806): the office's, on a computer, on a job with a GC, when the desk was handed the run window.
  const gcPress = lienGcNoticePress({ office, handed: !!onPutGcOnNotice, isMobile, gcId: selected?.gcCustomerId, gcName: gc?.name })
  useEffect(() => setLastWorkOpen(false), [selectedJobId])
  const lastWorkSaved = () => (onCalendarChanged ? onCalendarChanged('last_work') : onChanged())
  // What the window weighs a typed day against: the job's label, its months with hours, the months a notice or the affidavit already names.
  const lastWorkFacts = {
    jobLabel: `${job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '' : ''} · ${(job?.job_name ?? '').trim()}`,
    clockMonths: (selected?.months ?? []).filter((m) => !m.fromCreation && !m.byHand).map((m) => m.key),
    noticedMonths: (selected?.months ?? []).filter((m) => m.noticed).map((m) => m.key),
    affidavitMonths: lienLastWorkAffidavitMonths(data?.affidavits.entries.find((a) => a.jobId === selectedJobId)),
    propertyKind: selected?.propertyKind ?? '',
  }
  return selected ? (
    <div
      ref={paneRef}
      data-lien-desk-pane
      data-lien-pane-phone={isMobile ? 'yes' : undefined}
      data-lien-pane-simple={simpleApprove && !detailsOpen ? 'yes' : undefined}
      onScroll={(ev) => {
        const next = ev.currentTarget.scrollTop > STRIP_COLLAPSE_PX
        setPaneScrolled((prev) => (prev === next ? prev : next))
        relightPages(ev.currentTarget)
        relightPane(ev.currentTarget)
      }}
      // The one column is held to the pane's width on every screen (a phone since punch list #352, PR 6; a computer since v2.7446), so a
      // bar's one line of words cannot set the pane's width and slide the whole paper sideways: an `auto` column is as wide as its widest word-run.
      style={{ position: 'relative', padding: '0 1.1rem', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.6rem', alignContent: 'start', overflow: 'auto', minWidth: 0 }}
    >
      {paneScrolled ? (
        <div
          ref={stripRef}
          className="lienDeskStrip"
          data-lien-desk-strip
          data-phone={isMobile ? 'yes' : undefined}
          // One sliding line on a phone, a wrapping strip at a desk (`lienStripStyle`, punch list #415).
          style={lienStripStyle(isMobile)}
        >
          <strong style={lienStripLabelStyle(isMobile)} title={isMobile ? jobLabel(job, selected.jobId) : undefined}>{jobLabel(job, selected.jobId)}</strong>
          {/* Every chip is a press (v2.7318): a red one opens its gate's door, the green one goes to the send, the quiet ones to their sections; the Sent chip goes back up. */}
          {stripChips.map((c) => (
            <button
              key={c.key}
              type="button"
              className="lienStripChip"
              data-lien-strip-chip={c.key}
              data-tone={c.tone}
              data-lien-desk-strip-next={c.key === 'next' ? true : undefined}
              data-lien-strip-sent={c.key === 'sent' ? true : undefined}
              title={c.title}
              onClick={() => pressStripChip(c.act)}
              style={stripChipStyle(c.tone)}
            >
              {/* The cents take no line of their own, so a chip with an amount is as tall as its neighbours. */}
              <MoneyText text={c.words} centsStyle={{ lineHeight: 0 }} />
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <button type="button" onClick={() => paneRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' })} style={isMobile ? { ...linkBtn, flex: 'none' } : linkBtn}>
            Show gates ▴
          </button>
        </div>
      ) : null}
      {/* A phone's way back is in the desk's header since punch list #352, PR 6 (it was a button here, a second one for a notice). */}
      <div data-lien-pane-keep style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.6rem', alignItems: 'baseline', paddingTop: isMobile ? '0.6rem' : '0.9rem' }}>
        <LienJobHeading label={jobLabel(job, selected.jobId)} onOpenJob={onOpenJob ? () => onOpenJob(selected.jobId) : undefined} />
        {storedDraft?.letterTwo && item ? (
          <span style={chip('var(--bg-blue-tint)', 'var(--text-blue-800)')} data-lien-letter-two-heading title="The second owner letter, on the same form to the same two recipients; the first packet stays on the record">
            the attorney’s letter · {letterTwoKindLabel(storedDraft.letterTwo.kind)}{storedDraft.letterTwo.afterSentAt ? ` · after the ${formatYmdMonthDay(calendarYmdInAppTzFromIso(storedDraft.letterTwo.afterSentAt))} packet` : ''}
          </span>
        ) : null}
        {gcPress ? (
          <>
            {/* The GC's run opens from the job (v2.7806, the owner's pick: "Build 2"): the press sits beside the GC's name, where the title bar's door was a picker of every GC. */}
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>· GC {gc?.name}</span>
            <button type="button" data-lien-gc-notice-press={gcPress.gcId} aria-label={gcPress.name} title={gcPress.hint} onClick={() => onPutGcOnNotice?.(gcPress.gcId)} style={{ alignSelf: 'center', padding: '1px 8px', border: '1px solid var(--border-amber)', borderRadius: 9999, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', font: 'inherit', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer' }}>
              <span aria-hidden="true">⚠ </span>{gcPress.words}
            </button>
            {job?.job_address ? <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>· {job.job_address}</span> : null}
          </>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            {gc?.name ? `· GC ${gc.name}` : '· no GC'} {job?.job_address ? `· ${job.job_address}` : ''}
          </span>
        )}
        {/* Steps · Windows on the title line (v2.7317): the owner's ask, out of the timeline box's corner. */}
        {!isMobile && timeline ? <span style={{ marginLeft: 'auto', alignSelf: 'center' }}><LienTimelineViewSwitch /></span> : null}
      </div>
      {simpleApprove ? (
        <div data-lien-pane-keep data-lien-approve-card style={{ display: 'grid', gap: '0.45rem', padding: '0.9rem 0.9rem 0.8rem', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-blue-tint)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Lien notice · {counts?.awaiting ?? 1} waiting on you
          </div>
          <div style={{ fontSize: '1.15rem', lineHeight: 1.25 }}>
            <strong>{formatUsdNoCents(claimed.claim)}</strong> owed by {gc?.name ?? 'the GC'}
          </div>
          <div style={{ fontSize: '1.15rem', lineHeight: 1.25 }} data-lien-approve-mail-by>
            {selected.earliestDeadline ? (
              <>
                Mail by <strong>{footShortDay(selected.earliestDeadline)}</strong>
                {selected.daysLeft != null && selected.daysLeft >= 0 ? ` · ${selected.daysLeft} ${selected.daysLeft === 1 ? 'day' : 'days'}` : selected.daysLeft != null ? ' · window closed' : ''}
              </>
            ) : (
              LIEN_APPROVE_NO_MAIL_BY
            )}
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {item?.submitted_at ? `Sent to you ${footShortDay(item.submitted_at)}. ` : ''}
            {gateVerdict.ready ? 'All four gates clear.' : `${gateVerdict.headline}.`}
          </div>
          <LienStepRow at={{ ladder: 'notice', step: 3 }} ladder="notice" viewerIsLeader />
          <button type="button" data-lien-approve-details aria-expanded={detailsOpen} onClick={() => setDetailsOpen((v) => !v)} style={{ ...linkBtn, justifySelf: 'start', fontSize: '0.875rem', fontWeight: 600, padding: '4px 0' }}>
            {detailsOpen ? 'Hide details ▴' : 'Details ▾'}
          </button>
        </div>
      ) : null}
      {paneHead('path')}
      <div data-lien-pane-body="path" style={{ display: 'grid', gap: '0.6rem' }}>
      {timeline ? (
        <div data-lien-desk-timeline style={{ ...boxStyle, padding: isMobile ? '0.5rem 0.7rem' : '0.55rem 0.8rem 0.5rem' }}>
          <LienTimelineStrip timeline={timeline} switchOutside={!isMobile} onDoor={job && 'lien_contract_ended_on' in job ? () => onOpenEditJob(selected.jobId) : undefined} onChangeLastWork={lienLastWorkDoorOffered({ office, hasJob: Boolean(job) }) ? () => setLastWorkOpen(true) : undefined} onOpenStep={(s) => setStopOpen(Math.max(0, timeline.steps.findIndex((x) => x.key === s.key)))} onAct={onBandAct} act={bandAct} />
        </div>
      ) : null}
      {/* The press under LAST WORK (v2.7684): the same window the months' Change › line saves through, opened here on the job's day. */}
      {lastWorkOpen && job ? <LienLastWorkDayWindow jobId={selected.jobId} job={job} todayYmd={todayYmd} userId={authUserId} onSaved={lastWorkSaved} onClose={() => setLastWorkOpen(false)} {...lastWorkFacts} /> : null}
      {timeline && stopOpen != null ? (
        <LienStopPaperWindow
          steps={timeline.steps}
          index={stopOpen}
          onIndex={setStopOpen}
          onClose={() => setStopOpen(null)}
          jobLabel={jobLabel(job, selected.jobId)}
          paperFor={stopPaperFor}
          timeline={timeline}
          holdFor={(step) => {
            // The hold line (v2.4806): the notice's first blocking gate, in the draft footer's own words, with its door.
            if (step.kind !== 'notice' || step.state === 'done' || step.state === 'missed' || step.fold) return null
            const blocker = gates.find((g) => g.tone === 'blocker') ?? null
            if (!blocker) return null
            return { words: lienFootBlockedSentence(blocker, months.size), short: lienGateShortWords(blocker), act: { label: `Go to gate ${blocker.n} ▴`, onPress: () => { setStopOpen(null); goToSection('gates') } } }
          }}
        />
      ) : null}

      {leader && selected.pile === 'awaiting' ? (
        <div style={boxStyle}>
          <div style={boxHead}>What you're deciding</div>
          {correction ? (
            <div style={{ fontSize: '0.8125rem', color: claimed.over ? 'var(--text-red-700)' : 'var(--text-amber-800)' }} data-lien-claim-leader-line>
              <strong>Claim set by hand: {formatUsdNoCents(claimed.claim)}</strong>
              {claimDeltaWords(claimed.delta, openBalance) ? `, ${claimDeltaWords(claimed.delta, openBalance)}` : ''} — {correctionSetWords(correction, formatYmdMonthDay)}.{correction.carry ? ' It carries to later notices and the affidavit.' : ' This notice only.'} The notice below carries it.
            </div>
          ) : null}
          {wordingDiff.length ? (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-amber-800)' }}>{wordingLineText(wordingDiff, wordingEditedBy)} from the job’s wording — the notice below carries it.</div>
          ) : null}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.25rem 1rem', fontSize: '0.8125rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Open with {gc?.name ?? 'this GC'}: </span>
              <strong>{formatUsdNoCents(gcOpenTotal)}</strong> on {entries.filter((e) => e.gcCustomerId === selected.gcCustomerId).length} {entries.filter((e) => e.gcCustomerId === selected.gcCustomerId).length === 1 ? 'job' : 'jobs'} in the desk
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Their word: </span>
              {promise ? (
                <span style={chip('var(--bg-subtle)', 'var(--text-green-800)')}>✓ promised {formatYmdMonthDay(promise.promisedYmd)}{promise.markedByName ? ` · ${promise.markedByName}` : ''}</span>
              ) : (
                'no promise on file'
              )}
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Months: </span>
              {monthsList.map(workMonthShort).join(' · ')}
              {wm ? ` — ${wm.totalHours.toLocaleString(undefined, { maximumFractionDigits: 1 })} h, ${new Set(wm.months.flatMap((m) => m.people)).size} people` : ''}
            </div>
            <div style={{ color: 'var(--text-red-600)' }}>
              If you hold: {monthsList[0] ? `${workMonthLabel(monthsList[0])}'s lien right ends ${selected.earliestDeadline ? demandDate(selected.earliestDeadline) : '—'}` : ''}
            </div>
          </div>
        </div>
      ) : null}

      {/* The gates (v2.3657): four numbered steps in fixed slots under a verdict headline. Every gate has its section (v2.3670): a gate that is not clear carries its sentence and its door, a clear one the fact the notice will use; a cell click brings its section up. */}
      </div>

      {paneHead('gates')}
      <div data-lien-pane-body="gates">
      {gatesFold ? (
        <LienGatesSentFold fold={gatesFold} />
      ) : (
      <LienDeskGates
        headless
        gates={gates}
        verdict={gateVerdict}
        active={activeGate?.key ?? null}
        activeAt={activeGate?.at ?? 0}
        onPick={pickGate}
        open={property.owner.source === 'property_record' && ownerFromRollUnconfirmed(address) ? ['owner'] : []}
        details={{
          owner: (
            <>
              {gateByKey.owner.tone !== 'ok' && gateByKey.owner.value !== 'Public property' ? (
                <div>
                  Owner of record with a mailing address{ownerName ? ` — ${ownerName}, mailing address missing` : ''} — the statute sends the notice to the owner, so this comes first.
                </div>
              ) : null}
              {gateByKey.owner.tone === 'ok'
                ? (() => {
                    // The owner on file as the envelope will read (the roll's shape, v2.3658), where it came from, and the doors to check or change it.
                    const mailing = rollMailingLines(property.owner.mailingAddress)
                    const county = (address?.county ?? '').trim()
                    const cadUrl = property.owner.source === 'property_record' ? txCountyCadPropertyUrl(county, (address?.parcel_id ?? '').trim()) || txCountyCadSearchUrl(county) : ''
                    return (
                      <>
                        <div className="lienGateFact" data-lien-gate-owner-fact>
                          <strong className="lienGateFactValue">{ownerName}</strong>
                          <span className="lienGateFactActions">
                            {cadUrl ? (
                              <button type="button" style={linkBtn} onClick={() => openInExternalBrowser(cadUrl)} title={`Check this owner on the ${county || 'county'} appraisal district site`}>
                                Check on {county || 'the county'} CAD ↗
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => onOpenEditJob(selected.jobId, property.owner.source === 'property_record' ? 'property-record' : undefined)}
                              style={{ ...btn('plain'), padding: '1px 8px', fontSize: '0.72rem' }}
                              title={property.owner.source === 'property_record' ? 'Edit Job → Property record: the owner of record lives on the property' : 'Edit Job: the owner set on this job'}
                            >
                              Change ›
                            </button>
                          </span>
                        </div>
                        <address className="lienOwnerRollAddress" style={{ fontStyle: 'normal' }}>{[mailing.careOf ? `c/o ${mailing.careOf}` : '', ...mailing.lines].filter(Boolean).join(', ')}</address>
                        {ownerSourceWords(property.owner.source) ? <div className="lienGateRowMeta">{ownerSourceWords(property.owner.source)}</div> : null}
                      </>
                    )
                  })()
                : null}
              {/* The roll's answer with Use, the Confirm on an unconfirmed nightly save, or the bond-claim sentence (v2.3450); renders nothing when the owner is fine. */}
              <LienDeskOwnerPane
                key={selected.jobId}
                job={job}
                jobId={selected.jobId}
                gcName={gc?.name ?? ''}
                gcCustomerId={selected.gcCustomerId}
                address={address}
                owner={property.owner}
                ownerName={ownerName}
                userId={authUserId}
                onChanged={onChanged}
                onOpenEditJob={onOpenEditJob}
              />
            </>
          ),
          gc:
            gateByKey.gc.tone !== 'ok' ? (
              <div className="lienGateFact">
                <span>The notice names the original contractor — set the GC on the job.</span>
                <span className="lienGateFactActions">
                  <button type="button" onClick={() => onOpenEditJob(selected.jobId)} style={{ ...btn('plain'), padding: '1px 8px', fontSize: '0.72rem' }}>
                    Set the GC ›
                  </button>
                </span>
              </div>
            ) : (
              // The GC as the notice names them, with the address the certified copy goes to.
              <>
                <div className="lienGateFact" data-lien-gate-gc-fact>
                  <strong className="lienGateFactValue">{gc?.name}</strong>
                  <span className="lienGateFactActions">
                    <button type="button" onClick={() => onOpenEditJob(selected.jobId)} style={{ ...btn('plain'), padding: '1px 8px', fontSize: '0.72rem' }} title="Edit Job: the GC on the job">
                      Change the GC ›
                    </button>
                  </span>
                </div>
                {gc?.address ? <div className="lienGateRowMeta">{gc.address}</div> : <div className="lienGateRowMeta" style={{ color: 'var(--text-amber-800)' }}>{LIEN_GC_GATE_NO_ADDRESS}</div>}
              </>
            ),
          kind: (
            // The kind as the switch the claims row and Edit Job use (v2.3667), set right here; without a linked property there is nothing to write on, so the door stays.
            (() => {
              const kindSet = Boolean((property.propertyKind ?? '').trim())
              const chooser = address && (kindOpen || !kindSet)
              const shared = data && address ? jobsSharingProperty(selected.jobId, Object.keys(data.jobsById), (id) => data.jobsById[id]?.customer_address_id) : []
              const sharedWords = sharedWithWords(shared.map((id) => effectiveJobLedgerNumber(data?.jobsById[id]?.hcp_number ?? null, data?.jobsById[id]?.click_number ?? null) || id.slice(0, 8)))
              return (
                <>
                  <div className="lienGateFact" data-lien-gate-kind-fact data-kind-open={chooser ? 'yes' : 'no'}>
                    <strong className="lienGateFactValue">{kindBusy ? 'saving…' : propertyKindLine(property.propertyKind, property.county)}</strong>
                    <span className="lienGateFactActions">
                      {!address ? (
                        <button type="button" onClick={() => onOpenEditJob(selected.jobId, 'property-record')} style={{ ...btn('plain'), padding: '1px 8px', fontSize: '0.72rem' }} title="Edit Job → Property record: link the property, then say whether it is residential or commercial">
                          Set property kind ›
                        </button>
                      ) : chooser ? (
                        kindSet ? (
                          <button type="button" onClick={() => setKindOpen(false)} style={linkBtn} data-lien-gate-kind-cancel>
                            Cancel
                          </button>
                        ) : null
                      ) : (
                        <button type="button" onClick={() => setKindOpen(true)} style={{ ...btn('plain'), padding: '1px 8px', fontSize: '0.72rem' }} data-lien-gate-kind-change title="Switch the property kind: two clicks on purpose, since every deadline on the job moves with it">
                          Change ›
                        </button>
                      )}
                    </span>
                  </div>
                  {chooser ? (
                    <div className="lienGateFact" data-lien-gate-kind-chooser>
                      <PropertyKindSwitch value={normalizePropertyKind(property.propertyKind)} onPick={(k) => { setKindOpen(false); void pickKind(k) }} disabled={kindBusy} label={`Property kind for ${jobLabel(job, selected.jobId)}`} />
                      <span className="lienGateRowMeta" style={{ flex: '1 1 16rem', minWidth: 0 }}>{propertyKindSwitchWarning(property.propertyKind)}</span>
                    </div>
                  ) : null}
                  <div className="lienGateRowMeta">{[propertyKindRuleWords(property.propertyKind), address ? 'saved on the property record' : '', sharedWords].filter(Boolean).join(' · ')}.</div>
                </>
              )
            })()
          ),
          months: (
            <>
              {gateByKey.months.tone !== 'ok' ? (
                <div className="lienGateFact">
                  <span>{gateByKey.months.value === 'No month open' ? 'No month is open to notice — every window has closed. The notice that went out is in the grid below.' : 'Tick at least one month below — the notice has to name the work it covers.'}</span>
                  <span className="lienGateFactActions">
                    <button type="button" style={linkBtn} onClick={() => paneRef.current?.querySelector('[data-lien-desk-months]')?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })}>
                      Months and deadlines ↓
                    </button>
                  </span>
                </div>
              ) : (
                // One line per work month with approved hours — the cell's list — from the same evidence as the Months card; the ticked ones say so.
                <div className="lienGateFact" data-lien-gate-months-fact>
                  <span style={{ display: 'grid', minWidth: 0 }}>
                    {monthCards.map((c) => (
                      <span key={c.key}>
                        {lienGateMonthLine(workMonthLabel(c.key), c.hours, c.crew)}
                        {c.on ? <span className="lienGateRowMeta"> · on this notice</span> : null}
                      </span>
                    ))}
                  </span>
                  <span className="lienGateFactActions">
                    <button type="button" style={linkBtn} onClick={() => paneRef.current?.querySelector('[data-lien-desk-months]')?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })}>
                      Months and deadlines ↓
                    </button>
                  </span>
                </div>
              )}
              {wm && wm.pendingSessions > 0 ? (
                <div className="lienGateRowMeta">
                  {wm.pendingSessions} {wm.pendingSessions === 1 ? 'session' : 'sessions'} awaiting approval not counted in the hours.
                </div>
              ) : null}
            </>
          ),
          // The fifth gate (v2.4969), drawn only while it blocks: nothing owed on the sent bills, money still on the job.
          billed: (
            <div className="lienGateFact" data-lien-gate-billed-fact>
              <span style={{ minWidth: 0 }}>{lienNothingBilledWords(claimBills.length)}</span>
              <span className="lienGateFactActions">
                {office ? (
                  <button type="button" style={linkBtn} disabled={Boolean(billWhy)} title={billWhy || undefined} onClick={billFromHere} data-lien-gate-bill-from-here>
                    Bill it from here ›
                  </button>
                ) : null}
                <button type="button" style={linkBtn} onClick={() => paneRef.current?.querySelector('[data-lien-claim-bills]')?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })}>
                  The bills ↓
                </button>
              </span>
            </div>
          ),
        }}
      />
      )}
      </div>

      {/* Supply houses on this job (v2.4404): a second claim can ride the same property. Not drawn when the job bought nothing. */}
      {supplierJob ? (
        <>
        {paneHead('houses')}
        <div data-lien-pane-body="houses">
        <LienJobSuppliersCard headless job={supplierJob} propertyKind={property.propertyKind ?? ''} todayYmd={todayYmd} openBalance={openBalance} payerName={gc?.name ?? ''} jobLabel={jobLabel(job, selected.jobId)} isMobile={isMobile} word={office ? { authName, onChanged: suppliers.reload } : undefined} />
        </div>
        </>
      ) : null}

      {paneHead('months')}
      <div data-lien-pane-body="months" style={{ display: 'grid', gap: '0.6rem' }}>
      {/* A carried correction nobody has looked at since the last notice (v2.3682): the paper says so and asks before it goes. */}
      {correction && correctionNeedsLook(correction, lastSentAt) ? (
        <div data-lien-claim-carry-strip style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.3rem 0.8rem', padding: '0.5rem 0.75rem', borderRadius: 9, border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', fontSize: '0.8125rem' }}>
          <span style={{ color: 'var(--text-amber-800)', minWidth: 0, flex: '1 1 20rem' }}>
            <strong>Carrying {correction.setByName || 'the office'}’s correction{correction.setAt ? ` from ${formatYmdMonthDay(calendarYmdInAppTzFromIso(correction.setAt))}` : ''}:</strong> {formatUsdNoCents(correction.amountOff)} {correction.amountOff < 0 ? 'on top' : 'off'} — “{correction.reason}”. This notice claims <strong>{formatUsdNoCents(claimed.claim)}</strong>, not the app’s {formatUsdNoCents(openBalance)}.
          </span>
          {office ? (
            <>
              <button type="button" disabled={busy} style={btn('plain', busy)} onClick={() => void run('Still true', async () => lookLienClaimCorrection(selected.jobId, authName), 'Noted — the correction stands for this notice.')} data-lien-claim-still-true>
                Still true
              </button>
              <button type="button" disabled={busy} style={btn('plain', busy)} onClick={() => void run('Clear the correction', async () => clearLienClaimCorrection(selected.jobId), 'Cleared — the notice claims the job’s figure.')}>
                Clear it
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {/* Months (#38, the ledger since #361): the last day of work, the grid (months down, papers across, this notice as the last column), the money, the notes. */}
      <LienDeskMonths
        headless
        grid={monthGrid!}
        lastWork={<LienLastWorkDayLine flat jobId={selected.jobId} job={job ?? null} todayYmd={todayYmd} canEdit={office} userId={authUserId} onSaved={lastWorkSaved} {...lastWorkFacts} />}
        onSetLastWork={lienLastWorkDoorOffered({ office, hasJob: Boolean(job) }) ? () => setLastWorkOpen(true) : undefined}
        claimNode={(foot) => (
          <LienClaimBox
            foot={foot}
            openSignal={claimOpenSignal}
            balance={openBalance}
            correction={correction}
            months={monthsList}
            office={office}
            busy={busy}
            onSave={(input) => void run('Correct the claim', async () => saveLienClaimCorrection({ jobId: selected.jobId, ...input, userId: authUserId, userName: authName }).then(touchDraft), input.amountOff > 0 ? 'The notice claims the corrected figure.' : input.amountOff < 0 ? 'Set over the balance — the leader decides this one.' : 'The notice claims the job’s figure.')}
            onClear={() => void run('Back to the job’s figure', async () => clearLienClaimCorrection(selected.jobId).then(touchDraft), 'Cleared — the notice claims the job’s figure.')}
          />
        )}
        claimTail={
          // Retainage inside the claim (v2.3753, counsel): named on the form so the owner traps it now; the figure lives on the job.
          retainageInsideClaim(claimed.claim, job?.lien_retainage_held) > 0 ? (
            <span data-lien-claim-retainage="yes">
              Includes <strong style={{ color: 'var(--text-700)' }}><Money amount={retainageInsideClaim(claimed.claim, job?.lien_retainage_held)} /></strong> unpaid retainage {gc?.name ?? 'the GC'} holds — named on the form.
              {office ? <button type="button" onClick={() => onOpenEditJob(selected.jobId, 'lien-contract')} style={{ border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 600, padding: '0 0 0 4px' }}>Change ›</button> : null}
            </span>
          ) : job?.lien_retainage_held == null && office ? (
            <span data-lien-claim-retainage="unset">
              Retainage {gc?.name ?? 'the GC'} holds: not recorded.
              <button type="button" onClick={() => onOpenEditJob(selected.jobId, 'lien-contract')} style={{ border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 600, padding: '0 0 0 4px' }}>Set on the job ›</button>
            </span>
          ) : null
        }
        bills={<LienClaimBills bills={claimBills} unbilled={unbilled} revenue={job?.revenue} loading={payPage.loading} onBill={office ? billFromHere : undefined} billWhy={billWhy} />}
        onNoteMissed={office ? (month) => void noteMissed([month]) : undefined}
        onRecordByHand={office ? () => setByHandOpen(true) : undefined}
        claim={moneyWords(claimed.claim)}
        onToggle={(key, on) => {
          const next = new Set(months)
          if (on) next.add(key)
          else next.delete(key)
          setCheckedMonths(next)
          touchDraft()
        }}
      />
      </div>

      {paneHead('envelope')}
      <div data-lien-pane-body="envelope" style={{ display: 'grid', gap: '0.6rem' }}>
      {/* The envelope as one card (v2.7427): who the paper goes to, what rides with the notice, the key to the shaded boxes and the preview door. */}
      <LienEnvelopeCard
        ownerName={ownerName || 'the owner of record'}
        contractorName={gc?.name || 'the original contractor'}
        courtesyEmail={gc?.email || null}
        cover={{
          checked: coverNote,
          disabled: item != null && item.status !== 'drafted',
          onChange: (on) => { setCoverNote(on); touchDraft() },
          title: `Counsel's cover letter for a ${coverLetterKindFor(property)} property (2026-09-22), filled for this job — the first page of the owner's copy; the GC's copy is the form only`,
        }}
        // The supply houses in the owner's letter (v2.4725, Taunya's ask): drawn only while the letter is on and a house is owed.
        houses={coverNote && supplierJob && supplierJob.owed > 0 ? { checked: housesInLetter, disabled: item != null && item.status !== 'drafted', onChange: setHousesInLetter, count: supplierJob.housesOwed, amount: formatUsdNoCents(supplierJob.owed), unread: housesInLetter && !LIEN_HOUSES_PARAGRAPH_READ_BY_COUNSEL } : null}
        // A conditional release of lien in the envelope (v2.4729, Stephen's addition): off until asked for; the tick makes the draft row, the run issues it.
        release={coverNote && selected && claimNumber > 0 ? { checked: releaseId != null, disabled: (item != null && item.status !== 'drafted') || busy, onChange: toggleRelease, amount: formatUsdNoCents(claimNumber), unread: releaseId != null && !LIEN_RELEASE_PARAGRAPH_READ_BY_COUNSEL } : null}
        lockedWords={wordingLocked ? (office ? 'Sent for approval — pull it back to a draft to change the wording.' : 'The values in a box were typed by the office; the rest is the statute’s form or filled from the job.') : null}
        onPreview={openPreview}
      />

      {/* What goes in the envelope (v2.3540): the cover page first while it is ticked, then the notice — the pages as the packet prints them. */}
      {coverHtml ? (
        <>
          {pageLabel('cover', `Page 1 of ${pageTotal} · cover letter`, null)}
          <div data-theme="light" data-lien-desk-cover style={paperStyle}>
            <div dangerouslySetInnerHTML={{ __html: coverHtml }} />
          </div>
        </>
      ) : null}
      {/* The conditional release (v2.4729): the § 53.284 form behind the letter, as the Release of Lien window would print it. */}
      {releaseHtml ? (
        <>
          {pageLabel('release', `Page ${coverHtml ? 2 : 1} of ${pageTotal} · conditional release`, { words: `· ${noticeRelease?.signature ? 'signed in the app' : 'the master signs it with the notice'} · change it in the Release of Lien window` })}
          <div data-theme="light" data-lien-desk-release style={paperStyle}>
            <div dangerouslySetInnerHTML={{ __html: releaseHtml }} />
          </div>
        </>
      ) : null}
      {pageLabel(
        'notice',
        `Page ${noticePageNumber} of ${pageTotal} · the notice`,
        { words: `· ${wordingDiff.length ? wordingLineText(wordingDiff, wordingEditedBy) : payHtml ? 'the pay codes and the invoice follow it in the packet' : "the job's unpaid invoice follows it in the packet"}`, amber: wordingDiff.length > 0 },
      )}
      {partedBandNode}
      <div data-theme="light" data-lien-desk-paper ref={paperRef} onClick={onPaperClick} style={{ ...paperStyle, position: 'relative' }}>
        <div dangerouslySetInnerHTML={{ __html: docHtml }} />
        {editing ? (
          <input
            ref={editInputRef}
            aria-label={LIEN_NOTICE_FIELD_GUIDE.find((g) => g.key === editing.key)?.label ?? editing.key}
            value={editing.value}
            onChange={(ev) => setEditing((e) => (e ? { ...e, value: ev.target.value } : e))}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') {
                ev.preventDefault()
                commitEdit()
              } else if (ev.key === 'Escape') {
                ev.preventDefault()
                setEditing(null)
              }
            }}
            onBlur={commitEdit}
            placeholder={LIEN_NOTICE_FIELD_GUIDE.find((g) => g.key === editing.key)?.source}
            data-lien-desk-paper-input
            style={{ position: 'absolute', top: editing.rect.top, left: editing.rect.left, width: Math.max(editing.rect.width, 160), minHeight: editing.rect.height, boxSizing: 'border-box', font: editing.font || 'inherit', fontWeight: 600, color: 'var(--text-strong)', padding: '0.1em 0.5em', border: '2px solid #d97706', borderRadius: 5, background: 'var(--bg-amber-tint)', outline: 'none', zIndex: 3 }}
          />
        ) : null}
      </div>
      {/* The signing record (v2.7437, Taunya's ask): the paper prints the day alone, so the desk keeps the clock, the way and whose screen here, under the paper and outside it. */}
      {paneSignature ? (
        <p data-lien-desk-signature-record style={{ margin: '-0.2rem 0 0', fontSize: '0.72rem', lineHeight: 1.5, color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text-700)' }}>The signing record, kept here and not printed.</strong> {paneSignature.auditLine}
        </p>
      ) : signClearedLine ? (
        // Sign it again (v2.7502): while the notice waits to be signed again, the record says who cleared the last signature.
        <p data-lien-desk-signature-cleared style={{ margin: '-0.2rem 0 0', fontSize: '0.72rem', lineHeight: 1.5, color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text-700)' }}>The signing record, kept here and not printed.</strong> {signClearedLine}
        </p>
      ) : null}

      {/* The pay page (punch list #35, PR 3): one code per unpaid Stripe bill, as the run prints it behind the owner's copy. Nothing on it is typed — it is filled from the bills. */}
      {payHtml ? (
        <>
          {pageLabel('pay', `Page ${pageTotal} of ${pageTotal} · pay codes`, { words: `· ${payPageSummary(payPage.rows)} · ${payChangedCount ? `${payChangedCount} ${payChangedCount === 1 ? 'line' : 'lines'} changed on this page, the bills keep their own` : wordingLocked ? 'the lines under the codes are read from the bills' : 'a shaded line is yours to change, on this page only'}`, amber: payChangedCount > 0, pay: true })}
          <div data-theme="light" data-lien-desk-pay ref={payPaperRef} onClick={onPayPaperClick} style={{ ...paperStyle, position: 'relative' }}>
            <div dangerouslySetInnerHTML={{ __html: payHtml }} />
            {payEditing ? (
              <input
                ref={payInputRef}
                aria-label="The line under this bill's code"
                value={payEditing.value}
                onChange={(ev) => setPayEditing((e) => (e ? { ...e, value: ev.target.value } : e))}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter') {
                    ev.preventDefault()
                    commitPayEdit()
                  } else if (ev.key === 'Escape') {
                    ev.preventDefault()
                    ev.stopPropagation()
                    setPayEditing(null)
                  }
                }}
                onBlur={commitPayEdit}
                placeholder="Empty prints no line"
                data-lien-desk-pay-input
                style={{ position: 'absolute', top: payEditing.rect.top, left: payEditing.rect.left, width: Math.max(payEditing.rect.width, 260), minHeight: payEditing.rect.height, boxSizing: 'border-box', font: payEditing.font || 'inherit', fontWeight: 700, color: 'var(--text-strong)', padding: '0.1em 0.5em', border: '2px solid #d97706', borderRadius: 5, background: 'var(--bg-amber-tint)', outline: 'none', zIndex: 3 }}
              />
            ) : null}
          </div>
        </>
      ) : null}

      {leader && (selected.pile === 'awaiting' || selected.pile === 'held' || selected.pile === 'to_draft') && selected.gcCustomerId ? (
        <div style={boxStyle}>
          <div style={boxHead}>Standing rule for {gc?.name ?? 'this GC'}</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8125rem' }}>
            {LIEN_NOTICE_POLICIES.map((p) => (
              <label key={p.key} title={p.hint} style={{ display: 'inline-flex', gap: 5, alignItems: 'center', padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 6, background: (rulePick ?? selected.policy) === p.key ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)' }}>
                <input type="radio" name="lien-rule" checked={(rulePick ?? selected.policy) === p.key} onChange={() => { setRulePick(p.key); void saveRule(p.key) }} />
                {p.label}
              </label>
            ))}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>A rule sets the default for every future month on every {gc?.name ?? 'GC'} job. You still see each send in your FYI list, and a live promise always comes back to you.{gcHasPriorNotice ? '' : ' “Send” starts with the second notice — this first one comes to you either way, so the office proves the addresses on real mail first.'}</div>
        </div>
      ) : null}
      </div>
      {/* The footer's section (v2.7422): the blue head, then the empty body the footer is portalled into once it is built. */}
      {footInPane ? paneHead('sign') : null}
      {footInPane ? <div ref={setNoticeFootHome} className="lienDeskFooterInPane" data-lien-pane-body="sign" data-lien-desk-foot-home /> : null}
      {/* The pane's foot room (v2.4747): a row, not the pane's bottom padding, so a section head stuck to the bottom sits on the edge with no gap under it. */}
      <div aria-hidden data-lien-desk-pane-foot style={{ height: '0.3rem' }} />
    </div>
  ) : (
    <div style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{isMobile ? '' : 'Pick a job on the left.'}</div>
  )
}
