import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ChevronRight, Link2, Mail, Scale } from 'lucide-react'
import type { JobWithDetails } from '../../../types/jobWithDetails'
import type { JobContractCoverage } from '../../../lib/jobs/jobContractCoverage'

import { newAskMeta, officeAnswerMeta, type LegalAskFlavor } from '../../../lib/legal/legalAsks'

import { formatLegalMoney, groupCollectionsByPayer, quickNet, sortAccountsByNet, type LegalAccountSummary, type LegalGap, type LegalPayerKey } from '../../../lib/legal/legalPacket'
import { feeModelOf, heldOverridesOf, legalStageLabel, releaseRecipients, WEEKDAY_LABELS, matterAwaitsClose, matterIsClosed, matterIsInHouse, matterIsWithFirm, heldReasonsOf, withHold, type LegalMatterRow } from '../../../lib/legal/legalMatters'
import { buildLegalPacketPrintHtml } from '../../../lib/legal/legalPacketPrint'
import { deskQuestions } from '../../../lib/legal/deskQuestions'
import { CONTINGENCY_ENTRY_META, contingencyEntryBody } from '../../../lib/legal/legalMoney'

import { FirmMatterView } from './LegalFirmMatterView'
import type { FirmTab } from './legalFirmMatterViewShared'
import type { LegalFirmRow } from '../../../lib/legal/legalMatters'
import { INK as PORTAL_INK, MUTED as PORTAL_MUTED, PAPER as PORTAL_PAPER, PORTAL_FONT } from '../../../lib/portal/portalTheme'
import { printAndFile } from '../../../lib/sent/sentCopiesIo'
import { calendarYmdInAppTzFromIso, todayYmdInAppTz } from '../../../utils/dateUtils'
import { useEditCustomerModal } from '../../../contexts/EditCustomerModalContext'
import { useToastContext } from '../../../contexts/ToastContext'
import { legalRpc, legalRpcData, type LegalMattersData } from '../../../hooks/useLegalMatters'
import { supabase } from '../../../lib/supabase'
import { listLegalMatterDocuments } from '../../../lib/legal/legalMatterDocumentsIo'
import { answersNarrativeMarkdown, gapAnswerByline, LEGAL_GAP_ANSWER_MAX } from '../../../lib/legal/legalGapAnswers'

import type { LegalMatterDocumentRow } from '../../../lib/legal/legalMatterDocumentsIo'
import { legalPortalDocumentFromRow, type LegalPortalDocument } from '../../../lib/legal/legalMatterDocuments'
import { type NarrativeDesk } from './LegalNarrativeEditor'

import { buildLegalTimeline, eventsNarrativeMarkdown, planHoldKey, timelineDocumentsFromRows, type LegalEventDraft, type LegalPlanDraft } from '../../../lib/legal/legalTimeline'

import AccountWriteDownPanel, { type WriteDownHeld } from './AccountWriteDownPanel'
import { writeDownResultWords } from '../../../lib/legal/accountWriteDown'

import LegalPortalLinkButton from './LegalPortalLinkButton'
import LegalFirmWindow from './LegalFirmWindow'
import { LegendButton } from '../../help/LegendButton'
import { DeskLegendCard } from '../../help/LegendCard'
import { LEGAL_DESK_LEGEND } from '../../../lib/legal/legalDeskLegend'
import LegalDeskMapView from './LegalDeskMapView'
import LegalFirmsWindow from './LegalFirmsWindow'
import { useLegalMapCases } from '../../../hooks/useLegalMapCases'
import { assignmentsFromCountiesByFirm, countyWords } from '../../../lib/legal/firmCounties'
import { LEGAL_NOTHING_IN_COLLECTIONS } from '../../../lib/legal/firmMap'
import { EmptyState } from '../../EmptyState'
import { cityOfAddress, firmForAccount, firmOf, firmSegmentWords, releaseHoldWords, switchWords, venueLineWords, type FirmForAccount, type VenueJob } from '../../../lib/legal/firmForAccount'
import { suggestTxCountyForCity } from '../../../lib/txCountyLookup'
import { jobOpenBalance } from '../../../lib/legal/legalPacket'
import { LEGAL_READ_FAILED_WORDS, LEGAL_READ_MISSING_WORDS } from '../../../lib/legal/legalTablesRead'
import { legalIntakeUnseen } from '../../../lib/legal/legalFirmIntake'
import { inHouseWords, isOfferEntry, offerAmountOf, offerMetaOf, type LegalOfferDraft, type OfferStatus } from '../../../lib/legal/legalOffers'
import { counselReadMetaFromDraft, currentCounselRead, type CounselReadDraft } from '../../../lib/legal/counselRead'
import { isVoidedEntry } from '../../../../supabase/functions/_shared/legalPortalActs'
import { moneyBars } from '../../../lib/legal/moneyBars'
import LegalMoneyBars from './LegalMoneyBars'
import { confirmJobOwnerContract, setJobGcFromCustomer } from '../../../lib/legal/subJobIo'
import type { LegalPaperNextDoor } from '../../../lib/legal/legalPaperNextDoor'
import { setGcDoneWords } from '../../../lib/legal/suspectedSubJob'
import { formatErrorMessage } from '../../../utils/errorHandling'
import { legalNotReachingLine } from '../../../lib/legal/legalNotifyLedger'
import { useLegalPacketData } from './useLegalPacketData'

import { TABS, type Tab, TAB_LABELS, MUTED, NUM, TH, TD, btn, btnPrimary, FIRM_GROUP, SEG, FIRM_SEG, FIRM_SEG_NONE, VIEW_SEG, VIEW_SEG_ON, type DeskView, EMPTY_COUNTIES, EMPTY_MATTERS, SEG_RED, SEG_AMBER, sheetInput, pill, FIX_LABEL, type Sheet, daysAgo } from './legalDeskShared'
import { type PlanActs, PacketTab } from './LegalDeskPacketTab'
import { ErrorDoorButton, ErrorDoorCard } from '../../help/ErrorDoor'
import { LEGAL_DESK_DEFAULT_TAB } from '../../../lib/legal/legalDeskRoute'

/**
 * The Legal desk (PR 1 v2.3293 read side; PR 2 v2.3313 the gate): the office's
 * review of every Collections account BEFORE anything is released to an
 * attorney. The five tabs the firm's portal mirrors — Account · Paper · Their
 * word · Evidence · Fees & steps — under the theory an attorney could plead,
 * what Click keeps after the firm's cut, and the gap list a firm asks about
 * first. Every door opens the surface that owns the record.
 *
 * Two exits: a dev's **Mark attorney ready** IS the release (stage → referred,
 * the firm's portal picks it up); **Write down…** opens the agreed write-down
 * and closes the matter. The office asks a dev with one click. Every "what
 * was said" entry goes to counsel unless the office holds it back with a
 * reason (#85 item 29), stored on the matter.
 *
 * A page since punch list #182: `/legal-desk` (`pages/LegalDeskPage.tsx`), the account, the tab and the view in the
 * address. Its doors are the Collections header's ⚖ Legal, the stage bar's scales and the ☰ Section tools row on the
 * Pipeline, the Lien desk and the Dashboard's law-firm lines; the old `?legal=` links redirect there. Until PR 3 of that
 * move it was a window over the Pipeline (`LegalDeskModal`), with a ✕ and a full screen button.
 */
/** The desk's own sheets and windows stand on this layer, above the phone dock (700) as `check:window-z` asks. */
const DESK_LAYER_Z = 760

/** The pinned tab strip's height on a phone: a tab's content stops this far below the account's top edge. */
const TAB_STRIP_PHONE_HEIGHT = 40

/** **← Accounts** on a phone: the page door's look, so the two doors read as one control. */
const ACCOUNTS_DOOR: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 10px', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flex: 'none' }

export type LegalDeskProps = {
  /** Every job the board has in Collections (all payers). */
  collectionsJobs: JobWithDetails[]
  /** Punch list #94 (v2.4794): the Collections jobs the office gave up on — the rail's *Given up on* group, never released to the firm. */
  uncollectibleJobs?: JobWithDetails[]
  /** The board still fetching the billed/Collections scope — show a wait, not an empty rail. */
  jobsLoading?: boolean
  contractCoverage: ReadonlyMap<string, JobContractCoverage>
  users: ReadonlyArray<{ id: string; name: string | null }>
  companyName: string
  /** `?account=<payer key>` — which account to open on. */
  initialPayerKey?: LegalPayerKey | null
  /** `&tab=` — which tab to open on (the office's Needs You card lands on the firm's acts). A tab gone from the address is the default tab. */
  initialTab?: Tab | 'their_word' | null
  /** The page's door back, drawn before the title. */
  backDoor?: ReactNode
  /** The view the address asks for (`?view=map`). */
  initialView?: DeskView | null
  /**
   * Punch list #182 (PR 3): `'stacked'` on a phone. With no account in the address the rail is the whole desk, a list; an
   * account named there is the whole desk, with **← Accounts** in place of the page's door. `'columns'` is the rail beside
   * the account.
   */
  layout?: 'columns' | 'stacked'
  /** Stacked: a press on an account in the list. The page writes it into the address as a new entry, so Back is the list. */
  onOpenAccount?: (key: LegalPayerKey) => void
  /** Stacked: **← Accounts**. The page goes back to the list. */
  onShowList?: () => void
  /**
   * The page hears the account, the tab and the view, once the account is resolved, and writes the address. With no
   * account open (a phone's list) a press on Accounts or Map tells it too, the account `null`.
   */
  onAddressChange?: (address: { account: LegalPayerKey | null; tab: Tab; view: DeskView }) => void
  /** The stored side (PR 2): matters, the firm, entries. Absent in tests / before the migration. */
  legal?: LegalMattersData | null
  /** Only a dev marks attorney-ready and pulls back. */
  canMarkReady?: boolean
  /** Office roles curate: held entries, ask a dev, write down. */
  canEditReview?: boolean
  /** Only a dev changes the collections law firm (RLS on `legal_firms`); the firm window is read only for everyone else. Defaults to `canMarkReady`. */
  canEditFirm?: boolean
  onOpenContract: (job: JobWithDetails) => void
  /** Opens the job's Lien window; with a door (v2.6104, the Paper tab's next step), the Lien desk on the job or the window on a tab. */
  onOpenLienInstruments: (job: JobWithDetails, door?: LegalPaperNextDoor) => void
  onOpenEditJob: (jobId: string) => void
  onOpenCallMode: () => void
  onOpenAccountsReceivable: () => void
  onOpenSessionNotes: (job: JobWithDetails) => void
  onOpenReports: (job: JobWithDetails) => void
  onOpenJobThread: (jobId: string) => void
  onOpenPromisedPay: (args: { jobId: string; jobLabel: string; initialYmd: string | null }) => void
  onFocusJob: (jobId: string) => void
  /** After a write-down succeeds — reload the board so balances and the row follow. */
  onAfterWriteDown: () => void | Promise<void>
}

export default function LegalDesk(props: LegalDeskProps) {
  const { collectionsJobs, uncollectibleJobs = [], jobsLoading = false, contractCoverage, users, companyName, initialPayerKey = null, initialTab = null, legal = null, canMarkReady = false, canEditReview = false, canEditFirm = canMarkReady, backDoor = null, initialView = null, onAddressChange, layout = 'columns', onOpenAccount, onShowList } = props
  const stacked = layout === 'stacked'
  const { showToast } = useToastContext()
  const editCustomer = useEditCustomerModal()
  const todayYmd = todayYmdInAppTz()
  const rawAccounts = useMemo(() => groupCollectionsByPayer(collectionsJobs, contractCoverage, todayYmd), [collectionsJobs, contractCoverage, todayYmd])
  // v2.4794: the accounts the office gave up on — read like any other, never marked attorney-ready.
  const rawGivenUp = useMemo(() => groupCollectionsByPayer(uncollectibleJobs, contractCoverage, todayYmd), [uncollectibleJobs, contractCoverage, todayYmd])
  const firmNames = useMemo(() => new Map((legal?.firms ?? []).map((f) => [f.id, f.name] as const)), [legal?.firms])
  const assignments = useMemo(() => assignmentsFromCountiesByFirm(legal?.countiesByFirm ?? EMPTY_COUNTIES), [legal?.countiesByFirm])
  // v2.5792 (punch list #144 PR 2): every job's venue county — the property record's, else where its geocode falls — shared with the Map.
  const mapCases = useLegalMapCases({ accounts: rawAccounts, givenUp: rawGivenUp, byPayerKey: legal?.byPayerKey ?? EMPTY_MATTERS, firmNames }, Boolean(legal?.available))
  /** The office's switch on a two-county account: the firm id picked for this release; cleared when the account changes. */
  const [firmOverride, setFirmOverride] = useState<string | null>(null)
  /**
   * Which firm an account belongs to and why (`firmForAccount`): a released matter's own firm, else the firm covering the
   * venue county (the record's, else the geocode's, else a guess from the address's city), else none — never a default.
   */
  const firmFor = useCallback((a: LegalAccountSummary, override: string | null = null): FirmForAccount<LegalFirmRow> => {
    const m = legal?.byPayerKey.get(a.key)
    const jobs: VenueJob[] = a.jobs.map((j) => {
      const placed = mapCases.countyByJobId.get(j.id)
      const guess = placed ? '' : suggestTxCountyForCity(cityOfAddress(j.job_address))
      return { jobId: j.id, label: j.hcp_number || (j.click_number == null ? '' : String(j.click_number)) || '—', county: placed?.county ?? guess, from: placed ? placed.from : guess ? 'address' : 'none', balance: jobOpenBalance(j) }
    })
    return firmForAccount({ jobs, matterFirmId: matterIsWithFirm(m) || matterAwaitsClose(m) ? m?.firm_id ?? null : null, assignments, firms: legal?.firms ?? [], override })
  }, [legal?.byPayerKey, legal?.firms, mapCases.countyByJobId, assignments])
  // The rail's "keeps ~" reads each account's own firm's fee model.
  const accounts = useMemo(() => sortAccountsByNet(rawAccounts, (a) => quickNet(a.balance, feeModelOf(firmOf(firmFor(a))))), [rawAccounts, firmFor])
  const givenUpAccounts = useMemo(() => sortAccountsByNet(rawGivenUp, (a) => quickNet(a.balance, feeModelOf(firmOf(firmFor(a))))), [rawGivenUp, firmFor])
  const [selectedKey, setSelectedKey] = useState<LegalPayerKey | null>(null)
  const [tab, setTab] = useState<Tab>('account')
  /** Accounts or Map (v2.5784). */
  const [view, setView] = useState<DeskView>('accounts')
  const [gapsOpen, setGapsOpen] = useState(true)
  /** The account-level write-down panel under the header, the desk's second exit (v2.5760). */
  const [writeDownOpen, setWriteDownOpen] = useState(false)
  const [sheet, setSheet] = useState<Sheet>(null)
  /** Gap answers (v2.5920): the open Answer… sheet, and the matter's documents for its picker. */
  const [gapAnswerSheet, setGapAnswerSheet] = useState<{ key: string; label: string; text: string; documentId: string } | null>(null)
  const [gapAnswerDocs, setGapAnswerDocs] = useState<Array<{ id: string; title: string }>>([])
  const [gapAnswerBusy, setGapAnswerBusy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [answerFor, setAnswerFor] = useState<{ entryId: string; text: string } | null>(null)
  /** Ask the firm (#41 PR 3): a question, or a sign-off on one job. */
  const [askForm, setAskForm] = useState<{ flavor: LegalAskFlavor; jobId: string; text: string } | null>(null)
  const [emailsOpen, setEmailsOpen] = useState(false)
  /** The firm's window (v2.4711), opened from the firm's name in the header or the release sheet. */
  const [firmOpen, setFirmOpen] = useState(false)
  /** Firms… (v2.5792): the Settings block over the desk — add a firm, color its counties. A dev's door. */
  const [firmsOpen, setFirmsOpen] = useState(false)
  // The ? and its card (punch list #187 PR 4): what each part of the desk holds, beside the full screen button.
  const [legendOpen, setLegendOpen] = useState(false)
  // The door on the read failure (punch list #187 PR 6).
  const [readDoorOpen, setReadDoorOpen] = useState(false)
  const readFamily = typeof navigator !== 'undefined' && navigator.onLine === false ? 'network' : 'unknown'
  /** Hold back… on the Their word tab (#85 item 29): which entry, and the office's reason. */
  const [holdFor, setHoldFor] = useState<{ key: string; reason: string } | null>(null)
  /** The Mark attorney ready sheet's preview: the firm's own view of this account, held entries left out (v2.3363). */
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewTab, setPreviewTab] = useState<FirmTab>('account')

  useEffect(() => {
    // A given-up account is an account too (punch list #182): on the page its key comes back through the address, and a
    // lookup in the open accounts alone sent the selection back to the first of them, so it could never be opened.
    const known = (key: LegalPayerKey | null) => key != null && (accounts.some((a) => a.key === key) || givenUpAccounts.some((a) => a.key === key))
    const wanted = known(initialPayerKey) ? initialPayerKey : null
    // Stacked (a phone, punch list #182 PR 3): no account in the address is the list, so nothing is picked for it.
    setSelectedKey((prev) => wanted ?? (stacked ? null : known(prev) ? prev : (accounts[0]?.key ?? null)))
    if (initialTab) setTab(initialTab === 'their_word' ? 'timeline' : initialTab)
  }, [initialPayerKey, initialTab, accounts, givenUpAccounts, stacked])
  // The address is the truth (punch list #182). A tab word gone from it (Back, a pasted link) means the default tab; the
  // view follows `?view=`.
  useEffect(() => {
    setTab(initialTab ? (initialTab === 'their_word' ? 'timeline' : initialTab) : LEGAL_DESK_DEFAULT_TAB)
  }, [initialTab])
  useEffect(() => {
    if (!initialView) return
    setView(initialView)
  }, [initialView])

  const selected: LegalAccountSummary | null = accounts.find((a) => a.key === selectedKey) ?? givenUpAccounts.find((a) => a.key === selectedKey) ?? null
  // The page writes the address from these three, once the account is resolved (never from an empty rail, which would
  // drop a pasted `?account=` before the rows arrive).
  const selectedKeyResolved = selected?.key ?? null
  // Written only when the desk's own account, tab or view changes (punch list #182, PR 3). Keyed on the page's callback
  // too, an address changed from outside (Back, ← Accounts) re-ran this in the same commit, before the selection had
  // followed it, and wrote the old account straight back.
  const onAddressChangeRef = useRef(onAddressChange)
  /** Where a tab's content starts: on a phone a tab press brings it up under the pinned strip. */
  const tabContentRef = useRef<HTMLDivElement | null>(null)
  /** Counts a phone's tab presses, so the scroll runs after the press's render, the open tab's press too. */
  const [tabPresses, setTabPresses] = useState(0)
  useEffect(() => {
    if (tabPresses === 0) return
    tabContentRef.current?.scrollIntoView?.({ block: 'start' })
  }, [tabPresses])
  onAddressChangeRef.current = onAddressChange
  useEffect(() => {
    if (!selectedKeyResolved) return
    onAddressChangeRef.current?.({ account: selectedKeyResolved, tab, view })
  }, [selectedKeyResolved, tab, view])
  /** Accounts or Map. With an account open the effect above writes the address; on a phone's list, with none, the press does (v2.5984). */
  const pressView = (next: DeskView) => {
    setView(next)
    if (!selectedKeyResolved) onAddressChangeRef.current?.({ account: null, tab, view: next })
  }
  const selectedGivenUp = selected != null && givenUpAccounts.some((a) => a.key === selected.key)
  const matter: LegalMatterRow | null = selected ? (legal?.byPayerKey.get(selected.key) ?? null) : null
  const holdOverrides = useMemo(() => heldOverridesOf(matter), [matter])
  useEffect(() => setFirmOverride(null), [selectedKey])
  /** The selected account's firm and why (v2.5792); with nothing selected, the oldest active firm as before. */
  const selectedFirm = useMemo(() => (selected ? firmFor(selected, firmOverride) : null), [selected, firmFor, firmOverride])
  const firm: LegalFirmRow | null = selectedFirm ? firmOf(selectedFirm) : (legal?.firm ?? null)
  const fee = useMemo(() => feeModelOf(firm), [firm])
  const releaseHold = selectedFirm ? releaseHoldWords(selectedFirm) : null
  const venueLine = selectedFirm ? venueLineWords(selectedFirm) : null
  const seg = selectedFirm ? firmSegmentWords(selectedFirm) : { main: firm ? firm.name : 'No firm yet', tail: '', amber: !firm }
  /** The shown firm's people (`legal_firm_recipients.firm_id`); rows from before the column count for every firm. */
  const firmRecipients = useMemo(() => (legal?.recipients ?? []).filter((r) => !r.firm_id || !firm || r.firm_id === firm.id), [legal?.recipients, firm])
  const { packet, loading, failed, reload } = useLegalPacketData(selected, users, selected != null, holdOverrides, fee, matter?.id ?? null)


  const stage = matter?.stage ?? 'review'
  // #85 item 16: a firm end (settled · uncollectible · dismissed) stays with the firm until the office closes it.
  const withFirm = matterIsWithFirm(matter)
  // v2.5847 (punch list #172): the office runs the case itself — offers and questions for counsel open before any release.
  const inHouse = matterIsInHouse(matter)
  const closed = matterIsClosed(matter)
  const awaitsClose = matterAwaitsClose(matter)
  // Punch list #218 PR 2: the attorney's read of how the case tries — the latest read entry, the firm's or ours.
  const counselRead = currentCounselRead(matter ? (legal?.entriesByMatter.get(matter.id) ?? []) : [], (id) => (id ? (props.users.find((u) => u.id === id)?.name ?? null) : null))
  const stored = Boolean(legal?.available)
  const groups: Array<{ cap: string; list: LegalAccountSummary[] }> = [
    // v2.5849: *Under review* — the office reads this rail more than a dev does.
    { cap: 'Under review', list: accounts.filter((a) => { const m = legal?.byPayerKey.get(a.key); return !m || (!matterIsWithFirm(m) && !matterIsClosed(m) && !matterIsInHouse(m)) }).sort((x, y) => Number(Boolean(legal?.byPayerKey.get(y.key)?.review_requested_at)) - Number(Boolean(legal?.byPayerKey.get(x.key)?.review_requested_at))) },
    { cap: 'In house', list: accounts.filter((a) => matterIsInHouse(legal?.byPayerKey.get(a.key))) },
    { cap: 'With the firm', list: accounts.filter((a) => matterIsWithFirm(legal?.byPayerKey.get(a.key))) },
    { cap: 'Closed', list: accounts.filter((a) => matterIsClosed(legal?.byPayerKey.get(a.key))) },
    { cap: 'Given up on', list: givenUpAccounts },
  ]

  const firstJob = selected?.jobs[0] ?? null
  const jobById = (id: string | null) => (id ? (selected?.jobs.find((j) => j.id === id) ?? firstJob) : firstJob)
  const jobIds = selected?.jobs.map((j) => j.id) ?? []
  const openEditCustomer = () => {
    if (selected?.customerId && editCustomer) editCustomer.openEditCustomerModal(selected.customerId, { onSaved: reload })
    else if (firstJob) props.onOpenEditJob(firstJob.id)
  }
  const fixGap = (g: LegalGap) => {
    const job = jobById(g.jobId)
    switch (g.fix) {
      case 'contract': if (job) props.onOpenContract(job); return
      case 'lien_instruments': if (job) props.onOpenLienInstruments(job); return
      case 'edit_job': if (job) props.onOpenEditJob(job.id); return
      case 'collections_note': if (job) props.onOpenEditJob(job.id); return
      case 'edit_customer': openEditCustomer(); return
      case 'call_mode': props.onOpenCallMode(); return
      case 'write_down': setWriteDownOpen(true); return
      case 'set_gc': void setGcFromNote(g); return
      default: return
    }
  }
  const jobLabelOf = (job: JobWithDetails) => packet?.account.jobs.find((j) => j.jobId === job.id)?.label ?? (job.hcp_number ?? '').trim() ?? job.id
  /** Punch list #166 (v2.5840): the one-press move — the customer into the GC slot (the database clears the customer link and sends the bills to the GC). */
  const setGcFromNote = async (g: LegalGap) => {
    const job = jobById(g.jobId)
    if (!job || !selected?.customerId) return
    try {
      await setJobGcFromCustomer(job.id, selected.customerId)
      showToast(setGcDoneWords(selected.name, jobLabelOf(job)), 'success')
      // The payer changed, so the board regroups the account: the same reload a write-down asks for.
      void props.onAfterWriteDown()
      reload()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not set the GC'), 'error')
    }
  }
  /** Punch list #166: the office's answer — this job really is ours with the owner; the note goes and stays gone. */
  const confirmOwnerContract = async (g: LegalGap) => {
    const job = jobById(g.jobId)
    if (!job) return
    try {
      await confirmJobOwnerContract(job.id)
      showToast(`Noted: ${jobLabelOf(job)} is ours with the owner. The note is put away.`, 'success')
      reload()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the answer'), 'error')
    }
  }
  /** Gap answers (v2.5920): one line the attorney reads instead of the hole, stored by the gap's own key. */
  const openGapAnswer = async (g: LegalGap) => {
    setGapAnswerSheet({ key: g.key, label: g.label, text: g.answer && !g.answer.auto ? g.answer.text : '', documentId: g.answer?.documentId ?? '' })
    if (matter?.id) {
      try {
        const rows = await listLegalMatterDocuments(supabase)
        setGapAnswerDocs(rows.filter((r) => r.matter_id === matter.id).map((r) => ({ id: r.id, title: r.title })))
      } catch {
        setGapAnswerDocs([])
      }
    } else setGapAnswerDocs([])
  }
  const saveGapAnswer = async () => {
    if (!gapAnswerSheet || !selected) return
    setGapAnswerBusy(true)
    try {
      const r = await legalRpcData('legal_answer_gap', { p_payer_key: selected.key, p_customer_id: selected.customerId, p_payer_name: selected.name, p_job_ids: jobIds, p_gap_key: gapAnswerSheet.key, p_answer: gapAnswerSheet.text.trim(), p_document_id: gapAnswerSheet.documentId || null, p_label: gapAnswerSheet.label })
      if (r.error) {
        showToast(`Could not save the answer: ${r.error}`, 'error')
        return
      }
      showToast('Answered — the attorney reads this line beside the gap.', 'success')
      setGapAnswerSheet(null)
      await legal?.reload()
      reload()
    } finally {
      setGapAnswerBusy(false)
    }
  }
  const clearGapAnswer = async (g: LegalGap) => {
    if (!matter?.id) return
    const err = await legalRpc('legal_clear_gap_answer', { p_matter_id: matter.id, p_gap_key: g.key })
    if (err) {
      showToast(`Could not clear the answer: ${err}`, 'error')
      return
    }
    showToast('Answer cleared.', 'info')
    reload()
  }
  const printPacket = () => {
    if (!packet) return
    // A print counts as a send (docs/SENT_COPIES.md): the packet for counsel is filed on its jobs and its payer.
    const filing = { kind: 'legal_packet', title: `Legal packet for ${packet.account.payer.name}`, recipientName: 'Counsel', jobIds: packet.account.jobs.map((j) => j.jobId), customerId: packet.account.payer.customerId }
    if (!printAndFile(buildLegalPacketPrintHtml(packet, { preparedOn: todayYmd, companyName }), filing)) showToast('Your browser blocked the print window. Allow pop-ups for this site and try again.', 'error')
  }

  // --- the stored acts (PR 2) ------------------------------------------------
  const run = async (label: string, fn: () => Promise<string | null>) => {
    if (!selected) return
    setBusy(true)
    try {
      const err = await fn()
      if (err) {
        showToast(`${label}: ${err}`, 'error')
        return false
      }
      await legal?.reload()
      return true
    } finally {
      setBusy(false)
    }
  }
  const saveReview = (args: { heldOverrides?: Record<string, unknown>; requestReview?: boolean; note?: string }) =>
    legalRpc('legal_matter_save_review', {
      p_payer_key: selected?.key,
      p_customer_id: selected?.customerId,
      p_payer_name: selected?.name,
      p_job_ids: jobIds,
      p_held_overrides: args.heldOverrides ?? null,
      p_request_review: args.requestReview ?? null,
      p_review_note: args.note ?? null,
    })
  /** The narrative for the firm (v2.4812): saved on the matter, which is made first when the account has none. */
  const saveNarrative = (markdown: string) => run('Narrative', async () => {
    let matterId = matter?.id ?? null
    if (!matterId) {
      const made = await legalRpcData('legal_matter_save_review', { p_payer_key: selected?.key, p_customer_id: selected?.customerId, p_payer_name: selected?.name, p_job_ids: jobIds, p_held_overrides: null, p_request_review: null, p_review_note: null })
      if (made.error) return made.error
      matterId = typeof made.data?.matter_id === 'string' ? made.data.matter_id : null
      if (!matterId) return 'The matter could not be made'
    }
    return legalRpc('legal_set_narrative', { p_matter_id: matterId, p_markdown: markdown })
  })
  const narrativeDesk: NarrativeDesk = {
    markdown: matter?.narrative_md ?? '',
    updatedOn: matter?.narrative_updated_at ? calendarYmdInAppTzFromIso(matter.narrative_updated_at) : '',
    updatedByName: (matter?.narrative_updated_by ? users.find((u) => u.id === matter.narrative_updated_by)?.name : null) ?? '',
    canEdit: stored && canEditReview,
    save: async (markdown) => Boolean(await saveNarrative(markdown)),
    // v2.5836 (punch list #167): the recorded events as a dated list, for *Insert the events*.
    eventsMarkdown: matter ? eventsNarrativeMarkdown(buildLegalTimeline({ entries: legal?.entriesByMatter.get(matter.id) ?? [], documents: timelineDocumentsFromRows(legal?.documentsByMatter.get(matter.id) ?? [], calendarYmdInAppTzFromIso), todayYmd, reader: 'office' }), todayYmd) : '',
    // v2.5923: the answered gaps as a list, for *Insert the answers*.
    answersMarkdown: packet ? answersNarrativeMarkdown(packet.gaps) : '',
  }
  /** #85 item 29: everything goes to counsel; the office holds one entry back, with a reason, or shares it again. */
  const holdBack = async (key: string, reason: string) => {
    if (!reason.trim()) return
    const ok = await run('Hold back', () => saveReview({ heldOverrides: withHold(matter, key, reason) }))
    if (ok) setHoldFor(null)
  }
  const shareAgain = async (key: string) => {
    await run('Share', () => saveReview({ heldOverrides: withHold(matter, key, null) }))
  }
  const shareAll = async () => {
    await run('Share all', () => saveReview({ heldOverrides: {} }))
  }
  /** Punch list #172 (v2.5847): run it in house — an office role, one line of why; the matter is made when the account has none. */
  const confirmInHouse = async () => {
    if (sheet?.kind !== 'in_house' || !selected) return
    const ok = await run('Run it in house', () => legalRpc('legal_set_in_house', { p_payer_key: selected.key, p_customer_id: selected.customerId, p_payer_name: selected.name, p_job_ids: jobIds, p_why: sheet.note.trim() }))
    if (ok) {
      setSheet(null)
      showToast('In house — offers and questions for counsel are open on Fees & steps.', 'success')
      await legal?.reload()
    }
  }
  const leaveInHouse = async () => {
    if (!matter) return
    const ok = await run('Back to review', () => legalRpc('legal_leave_in_house', { p_matter_id: matter.id }))
    if (ok) { showToast('Back under review.', 'info'); await legal?.reload() }
  }
  /** Offers (punch list #172): made or received, with the day it expires on the Timeline. */
  const offerAdd = async (draft: LegalOfferDraft): Promise<boolean> => {
    const ok = await run('Log an offer', async () => {
      const m = await ensureMatterId()
      if (m.error || !m.id) return m.error ?? 'The matter could not be made'
      return legalRpc('legal_offer_add', { p_matter_id: m.id, p_direction: draft.direction, p_amount: offerAmountOf(draft.amountText), p_on: draft.on, p_expires_on: draft.expiresOn || null, p_notes: draft.notes.trim() })
    })
    if (ok) showToast(draft.expiresOn ? 'Logged — the offer and the day it expires are on the Timeline.' : 'Logged — the offer is on the Timeline.', 'success')
    return Boolean(ok)
  }
  const offerSetStatus = async (entryId: string, status: OfferStatus, note: string): Promise<boolean> =>
    Boolean(await run('Offer status', () => legalRpc('legal_offer_set_status', { p_entry_id: entryId, p_status: status, p_note: note })))
  /** Punch list #218 PR 2: the office records the attorney's read of how the case tries — the same note entry the firm writes from its portal. */
  const setCounselRead = async (d: CounselReadDraft): Promise<boolean> => {
    const read = counselReadMetaFromDraft(d)
    if (!read) return false
    const ok = await run('Save the read', async () => {
      const m = await ensureMatterId()
      if (m.error || !m.id) return m.error ?? 'The matter could not be made'
      return legalRpc('legal_set_counsel_read', { p_matter_id: m.id, p_tries: read.tries, p_why: read.why, p_cost_to_try: read.costToTry, p_months: read.months })
    })
    if (ok) showToast('Saved — the read shows on Can we sue?, and the firm reads it on its portal.', 'success')
    return Boolean(ok)
  }
  const confirmReady = async () => {
    if (sheet?.kind !== 'ready' || !firm) return
    const ok = await run('Attorney-ready', async () => {
      const r = await legalRpcData('legal_mark_attorney_ready', { p_payer_key: selected?.key, p_customer_id: selected?.customerId, p_payer_name: selected?.name, p_job_ids: jobIds, p_firm_id: firm.id, p_handling_name: sheet.handling, p_note: sheet.note })
      return r.error ?? null
    })
    if (ok) {
      setSheet(null)
      showToast(`${selected?.name} is attorney-ready — it is with ${firm.name} now.`, 'success')
    }
  }
  const confirmAsk = async () => {
    if (sheet?.kind !== 'ask') return
    const ok = await run('Ask a dev', () => saveReview({ requestReview: true, note: sheet.note }))
    if (ok) {
      setSheet(null)
      showToast('Asked — it moves to the top of the dev’s Needs You card.', 'success')
    }
  }
  const withdrawAsk = async () => {
    const ok = await run('Withdraw', () => saveReview({ requestReview: false }))
    if (ok) showToast('Request withdrawn.', 'info')
  }
  const confirmPull = async () => {
    if (sheet?.kind !== 'pull' || !matter) return
    const ok = await run('Pull back', () => legalRpc('legal_pull_back', { p_matter_id: matter.id, p_note: sheet.note }))
    if (ok) {
      setSheet(null)
      showToast(`${selected?.name} pulled back — the firm keeps a read-only page with your reason.`, 'info')
    }
  }
  /** #85 item 16: the firm's end moved the stage; the office's close is the end of the matter. */
  const confirmClose = async () => {
    if (sheet?.kind !== 'close' || !matter) return
    const ok = await run('Close', () => legalRpc('legal_close_matter', { p_matter_id: matter.id, p_stage: matter.stage, p_note: sheet.note }))
    if (ok) {
      setSheet(null)
      showToast(`${selected?.name} closed as ${legalStageLabel(matter.stage).toLowerCase()} — it leaves the firm's portal.`, 'success')
    }
  }
  const acknowledge = async (entryId: string) => {
    await run('Acknowledge', () => legalRpc('legal_acknowledge_entry', { p_entry_id: entryId }))
  }
  const sendAnswer = async () => {
    if (!answerFor || !matter) return
    const text = answerFor.text.trim()
    if (!text) return
    const ok = await run('Answer', async () => (await legalRpc('legal_add_entry', { p_matter_id: matter.id, p_kind: 'answer', p_body: text, p_meta: officeAnswerMeta(answerFor.entryId) })) ?? (await legalRpc('legal_acknowledge_entry', { p_entry_id: answerFor.entryId })))
    if (ok) {
      setAnswerFor(null)
      showToast('Answer sent — the firm sees it on their portal.', 'success')
    }
  }
  const sendAsk = async () => {
    if (!askForm || !matter) return
    const text = askForm.text.trim()
    if (!text) return
    const job = askForm.flavor === 'signoff' ? packet?.account.jobs.find((j) => j.jobId === askForm.jobId) ?? null : null
    const ok = await run('Ask the firm', () => legalRpc('legal_add_entry', { p_matter_id: matter.id, p_kind: 'question', p_body: text, p_meta: newAskMeta({ flavor: askForm.flavor, jobId: job?.jobId ?? null, jobLabel: job?.label ?? '' }) }))
    if (ok) {
      setAskForm(null)
      // v2.5847: in house there is no firm yet — the question waits for counsel and travels with the release.
      showToast(inHouse ? 'Saved for counsel — the firm reads it on its portal once the matter is released.' : askForm.flavor === 'signoff' ? 'Asked — the firm sees it on their portal; their sign-off lands on your Needs You list.' : 'Asked — the firm sees it on their portal; their answer lands on your Needs You list.', 'success')
    }
  }
  /** #85 item 20: sign off a settlement ask from before v2.6170 retired the floor (moves the stage to settled), or say not yet. */
  const answerSettlement = async (entryId: string, signedOff: boolean, note: string) => {
    const ok = await run(signedOff ? 'Sign off' : 'Not yet', () => legalRpc('legal_answer_settlement', { p_entry_id: entryId, p_signed_off: signedOff, p_note: note }))
    if (ok) showToast(signedOff ? 'Signed off — the matter is settled, and the firm is told.' : 'Sent — the firm sees your answer; the stage stays.', signedOff ? 'success' : 'info')
  }
  /** #85 item 18: undo an entry the office wrote, with a reason the firm reads. */
  const voidEntry = async (entryId: string, reason: string): Promise<boolean> => {
    const ok = await run('Undo', () => legalRpc('legal_void_entry', { p_entry_id: entryId, p_reason: reason }))
    if (ok) showToast('Undone — it stays on the record, struck through, out of every total.', 'info')
    return Boolean(ok)
  }
  /** The matter row an act hangs on (v2.5800): made first through the review save when the account has none yet. */
  const ensureMatterId = async (): Promise<{ id: string | null; error: string | null }> => {
    if (matter?.id) return { id: matter.id, error: null }
    const made = await legalRpcData('legal_matter_save_review', { p_payer_key: selected?.key, p_customer_id: selected?.customerId, p_payer_name: selected?.name, p_job_ids: jobIds, p_held_overrides: null, p_request_review: null, p_review_note: null })
    if (made.error) return { id: null, error: made.error }
    const id = typeof made.data?.matter_id === 'string' ? made.data.matter_id : null
    return id ? { id, error: null } : { id: null, error: 'The matter could not be made' }
  }
  /** The Timeline tab's planned steps (v2.5800): plan one, change one, say one happened. */
  const planAdd = async (draft: LegalPlanDraft): Promise<boolean> => {
    const ok = await run('Plan a step', async () => {
      const m = await ensureMatterId()
      if (m.error || !m.id) return m.error ?? 'The matter could not be made'
      // v2.5842: the deadline the step serves rides along only when one is picked, so a plain step still saves before the push.
      return legalRpc('legal_plan_add', { p_matter_id: m.id, p_on: draft.on, p_body: draft.body, p_notes: draft.notes, ...(draft.deadlineKey ? { p_deadline_key: draft.deadlineKey } : {}) })
    })
    if (ok) showToast('Planned — it is on the timeline.', 'success')
    return Boolean(ok)
  }
  const planUpdate = async (entryId: string, draft: LegalPlanDraft): Promise<boolean> =>
    Boolean(await run('Change the step', () => legalRpc('legal_plan_update', { p_entry_id: entryId, p_on: draft.on, p_body: draft.body, p_notes: draft.notes, ...(draft.deadlineKey !== undefined ? { p_deadline_key: draft.deadlineKey ?? '' } : {}) })))
  const planMarkDone = async (entryId: string, doneOn: string, note: string): Promise<boolean> => {
    const ok = await run('Mark done', () => legalRpc('legal_plan_mark_done', { p_entry_id: entryId, p_done_on: doneOn, p_note: note }))
    if (ok) showToast('Marked done — it stays on the line, on the day it was done.', 'success')
    return Boolean(ok)
  }
  /** Punch list #167 (v2.5836): record what happened — an event on its day, with the documents that prove it. */
  const eventAdd = async (draft: LegalEventDraft): Promise<boolean> => {
    const ok = await run('Record what happened', async () => {
      const m = await ensureMatterId()
      if (m.error || !m.id) return m.error ?? 'The matter could not be made'
      return legalRpc('legal_event_add', { p_matter_id: m.id, p_on: draft.on, p_body: draft.body, p_notes: draft.notes, p_document_ids: draft.documentIds })
    })
    if (ok) showToast('Recorded — it is on the timeline, on the day it happened.', 'success')
    return Boolean(ok)
  }
  const matterDocuments = matter ? (legal?.documentsByMatter.get(matter.id) ?? []) : []
  const planActs: PlanActs = {
    holds: holdOverrides,
    holdReasons: heldReasonsOf(matter),
    acts: stored && canEditReview ? { busy, add: planAdd, addEvent: eventAdd, documents: matterDocuments.map((d) => ({ id: d.id, title: d.title })), update: planUpdate, markDone: planMarkDone, undo: voidEntry, canUndo: (i) => (i.kind === 'plan' || i.kind === 'event') && !i.voided && !i.viaPortal, hold: matter ? { holdBack, shareAgain } : undefined } : null,
  }
  /** #85 item 16: accept a firm step that would have moved the stage back. */
  const moveStage = async (stageTo: string, entryId: string) => {
    if (!matter) return
    const ok = await run('Move the stage', () => legalRpc('legal_set_stage', { p_matter_id: matter.id, p_stage: stageTo, p_entry_id: entryId }))
    if (ok) showToast(`Stage moved to ${legalStageLabel(stageTo).replace('With the firm · ', '')}.`, 'success')
  }
  const withdrawFirmAsk = async (entryId: string) => {
    const ok = await run('Withdraw', () => legalRpc('legal_acknowledge_entry', { p_entry_id: entryId }))
    if (ok) showToast('Withdrawn — the firm no longer sees it.', 'info')
  }
  /** A payment the firm reported, applied by the office through Mark Paid on the job: record the recovery and the firm's cut on the matter. */
  const markApplied = async (entry: { id: string; amount: number | null; body: string }) => {
    if (!matter) return
    const amt = Number(entry.amount ?? 0)
    const cut = Math.round(amt * fee.contingencyPct * 100) / 100
    const ok = await run('Apply', async () => {
      const e1 = await legalRpc('legal_add_entry', { p_matter_id: matter.id, p_kind: 'recovery_applied', p_amount: amt, p_body: `Applied to the job — ${entry.body || 'payment received by counsel'}` })
      if (e1) return e1
      if (cut > 0) {
        // Tagged so the firm's demand leaves it out: it is the firm's share of money collected, not a cost the debtor owes (#85 item 5).
        const e2 = await legalRpc('legal_add_entry', { p_matter_id: matter.id, p_kind: 'cost', p_amount: cut, p_body: contingencyEntryBody(fee.contingencyPct, formatLegalMoney(amt)), p_meta: CONTINGENCY_ENTRY_META })
        if (e2) return e2
      }
      return legalRpc('legal_acknowledge_entry', { p_entry_id: entry.id })
    })
    if (ok) showToast(`Recorded: ${formatLegalMoney(amt)} applied, the firm's ${formatLegalMoney(cut)} as a legal cost on the matter.`, 'success')
  }

  const afterAccountWriteDown = async (done: number, held: WriteDownHeld[]) => {
    setWriteDownOpen(false)
    showToast(writeDownResultWords(done, held), held.length ? 'info' : 'success')
    if (done > 0) await afterWriteDown()
  }
  const afterWriteDown = async () => {
    await props.onAfterWriteDown()
    if (stored && selected) {
      // Record the exit on the matter (create it first when the desk never touched this account).
      const err = (await saveReview({})) ?? null
      if (!err) {
        const m = legal?.byPayerKey.get(selected.key)
        const id = m?.id
        if (id) await legalRpc('legal_close_matter', { p_matter_id: id, p_stage: 'written_down', p_note: 'Agreed write-down on the bill line' })
        else {
          await legal?.reload()
          const m2 = legal?.byPayerKey.get(selected.key)
          if (m2) await legalRpc('legal_close_matter', { p_matter_id: m2.id, p_stage: 'written_down', p_note: 'Agreed write-down on the bill line' })
        }
        await legal?.reload()
      }
    }
    reload()
  }

  const w = packet?.worth ?? null
  const requestedDays = daysAgo(matter?.review_requested_at, todayYmd)
  const requesterName = matter?.review_requested_by ? (users.find((u) => u.id === matter.review_requested_by)?.name ?? 'the office') : null
  const recipients = releaseRecipients(firm, sheet?.kind === 'ready' ? sheet.handling : '', firmRecipients)
  // The shown firm's own pause (`paused_at` rides on the row); the hook's flag still answers for the oldest firm.
  const firmPaused = Boolean((firm as { paused_at?: string | null } | null)?.paused_at) || (firm?.id === legal?.firm?.id && Boolean(legal?.firmPaused))
  // v2.4662 (punch list #85 item 26): people whose emails have stopped going through.
  const notReaching = firmRecipients.filter((r) => r.send_failed_since && !r.paused_at).length
  const setFirmPaused = async (paused: boolean) => { await run(paused ? 'Pause' : 'Resume', () => legalRpc('legal_firm_set_paused', { p_firm_id: firm?.id, p_paused: paused })) }
  const removeRecipient = async (id: string, name: string) => { await run('Remove', () => legalRpc('legal_firm_recipient_remove', { p_recipient_id: id })); showToast(`${name} removed from the firm's list.`, 'info') }

  // v2.4794: an account the office gave up on is read, never released — whatever the legal tables say.
  const headerActs: ReactNode = selectedGivenUp ? (
    pill('Given up on — not for the firm', 'neutral')
  ) : !stored ? (
    legal?.readState === 'failed' ? (
      // v2.5780: a read that did not go through says so and offers the way back; it is not the migration missing.
      <>
        <span data-legal-read-failed style={{ fontSize: '0.76rem', color: '#9a6700', display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {LEGAL_READ_FAILED_WORDS} · <ErrorDoorButton family={readFamily} open={readDoorOpen} onToggle={setReadDoorOpen} /> ·
          <button type="button" onClick={() => void legal.reload()} disabled={legal.loading} style={{ ...btn, height: 22, fontSize: '0.7rem' }}>{legal.loading ? 'Reading…' : 'Retry'}</button>
        </span>
        {readDoorOpen ? <ErrorDoorCard family={readFamily} onClose={() => setReadDoorOpen(false)} style={{ flexBasis: '100%' }} /> : null}
      </>
    ) : (
      <span style={{ ...MUTED, fontSize: '0.76rem' }}>{LEGAL_READ_MISSING_WORDS}</span>
    )
  ) : withFirm ? (
    <>
      {awaitsClose
        ? pill(`${legalStageLabel(stage)} · reported by ${firm?.name ?? 'the firm'} · open until you close it`, 'legal')
        : pill(`With ${firm?.name ?? 'the firm'} since ${calendarYmdInAppTzFromIso(matter?.released_at ?? '')} · ${legalStageLabel(stage).replace('With the firm · ', '')}`, 'legal')}
      {awaitsClose && canEditReview ? <button type="button" onClick={() => setSheet({ kind: 'close', note: '' })} disabled={busy} style={btnPrimary}>Close the matter…</button> : null}
      {canMarkReady ? <button type="button" onClick={() => setSheet({ kind: 'pull', note: '' })} style={btn}>Pull back</button> : null}
    </>
  ) : closed ? (
    pill(`${legalStageLabel(stage)} ${calendarYmdInAppTzFromIso(matter?.closed_at ?? '')}${matter?.closed_reason ? ` · ${matter.closed_reason}` : ''}`, 'neutral')
  ) : (
    <>
      {matter?.pulled_at ? pill(`Pulled back ${calendarYmdInAppTzFromIso(matter.pulled_at)}${matter.pulled_reason ? ` · ${matter.pulled_reason}` : ''}`, 'neutral') : null}
      {inHouse ? <span data-legal-in-house>{pill(inHouseWords(matter?.in_house_at ? calendarYmdInAppTzFromIso(matter.in_house_at) : '', matter?.in_house_why ?? ''), 'legal')}</span> : null}
      {matter?.review_requested_at ? pill(`${requesterName} asked for a dev${requestedDays != null ? ` · ${requestedDays}d ago` : ''}`, 'blue') : null}
      {canMarkReady ? (
        releaseHold ? (
          // v2.5792: no firm for this account's county — the release waits, and the line says what fixes it.
          <>
            <button type="button" disabled title={releaseHold} style={{ ...btnPrimary, opacity: 0.5, cursor: 'default' }} data-legal-release-held>⚖ Mark attorney ready…</button>
            <span data-legal-release-hold style={{ fontSize: '0.76rem', color: '#9a6700' }}>{releaseHold}</span>
          </>
        ) : (
          <button type="button" onClick={() => setSheet({ kind: 'ready', handling: firm?.handling_name ?? '', note: '' })} disabled={busy} style={btnPrimary}>⚖ Mark attorney ready…</button>
        )
      ) : canEditReview ? (
        matter?.review_requested_at ? (
          <button type="button" onClick={() => void withdrawAsk()} disabled={busy} style={btn}>Withdraw the request</button>
        ) : (
          <button type="button" onClick={() => setSheet({ kind: 'ask', note: '' })} disabled={busy} style={btn}>Ask a dev to review…</button>
        )
      ) : null}
      {stored && canEditReview && !inHouse ? <button type="button" onClick={() => setSheet({ kind: 'in_house', note: '' })} disabled={busy} style={btn} data-legal-in-house-door title="Run the case from the office while counsel is away or not yet engaged: the settlement floor, offers and questions for counsel open">Run it in house…</button> : null}
      {stored && canEditReview && inHouse ? <button type="button" onClick={() => void leaveInHouse()} disabled={busy} style={btn} data-legal-in-house-leave>Back to review</button> : null}
      {canEditReview ? <button type="button" onClick={() => setWriteDownOpen((o) => !o)} aria-expanded={writeDownOpen} style={btn} data-legal-write-down-door>Write it down…</button> : null}
    </>
  )

  // The desk itself: the panel, then the sheets and windows it opens over itself. The frame around it is the page's
  // (punch list #182) or the window's (below): the same desk either way.
  // The desk itself, inside its panel: the header and the view. The panel and the frame around it are the page's or the
  // window's (below, punch list #182): the same desk either way.
  // The six tabs (v2.5851). On a phone (punch list #182, PR 3) they lead the account and stay pinned while it scrolls (at
  // -12 px, the pane's top padding, so nothing shows above them), the
  // row scrolls sideways, and a press brings that tab's content up under them, as the mock-up's phone frame drew; on a
  // computer they sit under the fix list as before, the row able to scroll when a narrow window cannot hold all six.
  const pressTab = (t: Tab) => {
    setTab(t)
    if (stacked) setTabPresses((n) => n + 1)
  }
  const tabStrip = (
    <div role="tablist" aria-label="Packet sections" data-legal-desk-tabs
      style={stacked
        ? { display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', overflowX: 'auto', position: 'sticky', top: -12, zIndex: 1, background: 'var(--surface)', margin: '-12px -12px 10px', padding: '0 6px' }
        : { display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', overflowX: 'auto', margin: '16px 0 4px' }}>
      {TABS.map((t) => (
        <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => pressTab(t)}
          style={{ flex: 'none', whiteSpace: 'nowrap', border: 'none', background: 'none', padding: '8px 12px', fontSize: '0.84rem', fontWeight: tab === t ? 600 : 500, color: tab === t ? 'var(--text)' : 'var(--text-muted)', borderBottom: tab === t ? '2px solid var(--text-base)' : '2px solid transparent', cursor: 'pointer' }}>
          {TAB_LABELS[t]}
        </button>
      ))}
    </div>
  )

  const panelInner = (
    <>
        {/* The header (v2.5750, the owner's call): the scales and "Legal Desk"; the firm's three doors — the firm itself, its
            emails, its portal link — as one group whose first segment is the firm's name (until then a blue chip inside the
            sentence, beside two emoji boxes); the ✕ borderless, as the Lien desk's. Emails is one quiet word until emails to
            the firm are paused or an address bounces, when the segment says so in red or amber. The group and the ✕ wrap
            together under the title when the row is tight. */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: stacked ? '8px 10px' : '10px 14px', padding: stacked ? '10px 12px' : '12px 16px', borderBottom: '1px solid var(--border)' }}>
          {/* Stacked, an account is the whole desk: its door back is the list, in the page door's place (punch list #182 PR 3). */}
          {stacked && selected ? (
            <button type="button" onClick={onShowList} data-legal-desk-accounts aria-label="Back to the accounts" style={ACCOUNTS_DOOR}>
              <span aria-hidden="true">←</span> Accounts
            </button>
          ) : backDoor}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flex: stacked ? '1 1 150px' : '1 1 260px', minWidth: 0 }}>
            <Scale size={20} strokeWidth={2} aria-hidden="true" style={{ flex: 'none', marginTop: 3, color: 'var(--text-700)' }} />
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 700, lineHeight: 1.3 }}>Legal Desk</h2>
              {/* A phone keeps the title and drops the sentence under it, so the account starts higher. */}
              {stacked ? null : <div style={{ ...MUTED, fontSize: '0.78rem', lineHeight: 1.45 }}>Collections accounts, the way the firm would receive them. Three paths: run it in house, mark it attorney-ready (a dev — that is what puts it with the firm), or write it down.</div>}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%', minWidth: 0, flexWrap: stacked ? 'wrap' : undefined }}>
            <div role="group" aria-label="View" data-legal-view-group style={FIRM_GROUP}>
              <button type="button" className="legalDeskSeg" onClick={() => pressView('accounts')} aria-pressed={view === 'accounts'} data-legal-view="accounts" style={view === 'accounts' ? VIEW_SEG_ON : VIEW_SEG}>Accounts</button>
              <button type="button" className="legalDeskSeg" onClick={() => pressView('map')} aria-pressed={view === 'map'} data-legal-view="map" title="Every Collections account on the county map, with the firm that covers each county" style={{ ...(view === 'map' ? VIEW_SEG_ON : VIEW_SEG), borderLeft: '1px solid var(--border)' }}>Map</button>
            </div>
            {stored ? (
              <div data-legal-firm-group style={stacked ? { ...FIRM_GROUP, order: 1 } : FIRM_GROUP}>
                {/* v2.5792: the first segment is this account's firm and the county that picked it (`firmSegmentWords`); amber when
                    the county is unknown, uncovered, or no firm stands — its door is then the one that fixes it. */}
                <button
                  type="button"
                  className="legalDeskSeg"
                  onClick={() => {
                    if (!seg.amber) { setFirmOpen(true); return }
                    if (selectedFirm?.kind === 'unknown') { openEditCustomer(); return }
                    if (canEditFirm) setFirmsOpen(true)
                    else setFirmOpen(true)
                  }}
                  data-legal-firm-door={firm ? 'firm' : 'none'}
                  data-legal-firm-kind={selectedFirm?.kind ?? ''}
                  aria-label={firm ? `The collections law firm: ${firm.name}${legalIntakeUnseen(firm) ? ', new answers from the firm' : ''}` : seg.amber && selectedFirm && selectedFirm.kind !== 'no_firms' ? `${seg.main}. ${releaseHold ?? ''}`.trim() : 'Set up the collections law firm'}
                  title={firm ? `${venueLine ?? 'The firm'}: its details, its fee model and our particulars for filing` : releaseHold ?? 'No collections law firm is set up yet'}
                  style={seg.amber ? FIRM_SEG_NONE : FIRM_SEG}
                >
                  {firm ? (
                    <>
                      {/* The name and its quiet county tail are one clipped run (punch list #182, a follow-up): a tight segment
                          shortens the tail first, since the ellipsis eats from the end, and the name only after it. As two
                          flex items the nowrap tail kept its whole width while the name shrank to nothing and the tail bled
                          under Emails, the whole firm gone from a phone's header. */}
                      <span data-legal-firm-words style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {seg.main}
                        {seg.tail ? <span data-legal-firm-county style={{ fontWeight: 500, color: 'var(--text-muted)', marginLeft: 6 }}>{seg.tail}</span> : null}
                      </span>
                      {legalIntakeUnseen(firm) ? <span data-legal-firm-intake-new aria-hidden title="The firm sent its answers to Start here" style={{ width: 7, height: 7, borderRadius: 999, background: '#9a5b2b', display: 'inline-block', flex: 'none' }} /> : null}
                      <ChevronRight size={13} strokeWidth={2} aria-hidden="true" style={{ flex: 'none', color: 'var(--text-muted)' }} />
                    </>
                  ) : selectedFirm?.kind === 'unknown' ? `${seg.main}${canEditReview ? ' · Edit customer…' : ''}` : canEditFirm ? `${seg.main} · Firms…` : seg.main}
                </button>
                {selectedFirm?.kind === 'covered'
                  ? selectedFirm.others.map((o) => (
                      <button key={o.firm.id} type="button" className="legalDeskSeg" onClick={() => setFirmOverride(o.firm.id)} data-legal-firm-switch={o.firm.id} title={`${o.firm.name} covers ${countyWords(o.county.county)}, where ${o.county.jobLabels.join(', ')} ${o.county.jobLabels.length === 1 ? 'is' : 'are'} (${formatLegalMoney(o.county.balance)}). Release to them instead.`} style={SEG}>
                        {switchWords(o)}
                      </button>
                    ))
                  : null}
                {firm && canEditReview ? (
                  <button type="button" className="legalDeskSeg" onClick={() => setEmailsOpen(true)} data-legal-firm-emails={firmPaused ? 'paused' : notReaching ? 'not-reaching' : 'ok'} aria-label={`Firm’s emails${firmPaused ? ', paused' : ''}${notReaching ? `, ${notReaching} not reaching` : ''}`} title="Who at the firm hears from us, by their own rules" style={{ ...SEG, ...(firmPaused ? SEG_RED : notReaching ? SEG_AMBER : {}) }}>
                    <Mail size={15} strokeWidth={2} aria-hidden="true" style={{ flex: 'none', color: firmPaused || notReaching ? 'inherit' : 'var(--text-muted)' }} />
                    Emails{firmPaused ? ' · paused' : ''}{notReaching ? ` · ${notReaching} not reaching` : ''}
                  </button>
                ) : null}
                {firm && canEditReview ? (
                  <LegalPortalLinkButton
                    firmId={firm.id}
                    firmName={firm.name}
                    triggerClassName="legalDeskSeg"
                    triggerStyle={SEG}
                    triggerLabel={<><Link2 size={15} strokeWidth={2} aria-hidden="true" style={{ flex: 'none', color: 'var(--text-muted)' }} />Portal link</>}
                  />
                ) : null}
              </div>
            ) : null}
            {stored && canEditFirm ? (
              <button type="button" onClick={() => setFirmsOpen(true)} data-legal-firms-door title="Add a firm and color the counties each one covers" style={{ ...btn, height: 30, borderRadius: 8, fontSize: '0.76rem', borderColor: 'var(--border-strong)' }}>Firms…</button>
            ) : null}
            <LegendButton legend={LEGAL_DESK_LEGEND} open={legendOpen} onToggle={setLegendOpen} />
          </div>
        </div>
        {legendOpen ? <DeskLegendCard legend={LEGAL_DESK_LEGEND} phone={stacked} onClose={() => setLegendOpen(false)} style={{ margin: '10px 16px 0' }} /> : null}

        {view === 'map' ? (
          <LegalDeskMapView
            cases={mapCases.cases}
            loading={mapCases.loading}
            firms={legal?.activeFirms ?? []}
            countiesByFirm={legal?.countiesByFirm ?? new Map()}
            stacked={stacked}
            onOpenCase={(key) => {
              setView('accounts')
              if (stacked && onOpenAccount) onOpenAccount(key)
              else { setSelectedKey(key); setTab('account') }
            }}
          />
        ) : (
        <div style={{ display: 'grid', gridTemplateColumns: stacked ? 'minmax(0, 1fr)' : 'minmax(220px, 300px) 1fr', minHeight: 0 }}>
          {/* Stacked: the rail is the list while no account is picked, and the account is the whole desk once one is. */}
          {stacked && selected ? null : (
          <div data-legal-desk-rail style={{ borderRight: stacked ? 'none' : '1px solid var(--border)', overflowY: 'auto', padding: 10 }}>
            <div style={{ ...MUTED, fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 6px 2px' }}>
              {accounts.length} account{accounts.length === 1 ? '' : 's'} · {formatLegalMoney(accounts.reduce((s, a) => s + a.balance, 0))} · by what Click would keep
            </div>
            {accounts.length === 0 && givenUpAccounts.length === 0 ? (
              // Empty words (punch list #184, sweep C): nothing in Collections is the good state, said as the Map says it.
              jobsLoading ? <p style={{ ...MUTED, fontSize: '0.84rem', padding: 6 }}>Loading Collections…</p> : <EmptyState compact main={LEGAL_NOTHING_IN_COLLECTIONS} />
            ) : null}
            {groups.map((g) =>
              g.list.length === 0 ? null : (
                <div key={g.cap}>
                  <div style={{ ...MUTED, fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '10px 6px 6px' }}>{g.cap} · {g.list.length}</div>
                  {g.list.map((a) => {
                    const on = a.key === selectedKey
                    const m = legal?.byPayerKey.get(a.key)
                    const net = quickNet(a.balance, fee)
                    return (
                      <button key={a.key} type="button" onClick={() => { if (stacked && onOpenAccount) onOpenAccount(a.key); else { setSelectedKey(a.key); setTab('account') } }} aria-pressed={on}
                        style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 10px', width: '100%', textAlign: 'left', padding: '8px 10px', marginBottom: 6, border: `1px solid ${on ? 'var(--border-strong)' : 'var(--border)'}`, borderRadius: 6, background: on ? 'var(--bg-muted)' : 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.86rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                        <span style={{ ...NUM, fontSize: '0.86rem', fontWeight: 600 }}>{formatLegalMoney(a.balance)}</span>
                        <span style={{ ...MUTED, fontSize: '0.74rem' }}>{a.jobs.length} job{a.jobs.length === 1 ? '' : 's'}{a.viaGc ? ' · GC pays' : ''}{a.signedJobs < a.jobs.length ? ` · ${a.jobs.length - a.signedJobs} no contract` : ' · signed'}</span>
                        <span style={{ ...MUTED, ...NUM, fontSize: '0.74rem' }}>{m && matterIsWithFirm(m) ? legalStageLabel(m.stage).replace('With the firm · ', '') : `keeps ~${formatLegalMoney(Math.max(0, net))}`}</span>
                        <span style={{ ...MUTED, fontSize: '0.72rem', gridColumn: '1 / -1' }}>
                          {m?.review_requested_at && !matterIsWithFirm(m) && !matterIsClosed(m) ? <span style={{ color: 'var(--text-blue-700)' }}>asked for a dev · </span> : null}
                          {a.reviewDays == null ? '' : `${a.reviewDays}d in Collections`}{a.oldestDays != null ? ` · oldest bill ${a.oldestDays}d` : ''}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ),
            )}
          </div>
          )}

          {stacked && !selected ? null : (
          <div style={{ overflowY: 'auto', padding: stacked ? '12px 12px 24px' : '14px 18px 24px', minWidth: 0 }}>
            {!selected ? null : (
              <>
                {stacked ? tabStrip : null}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{selected.name}</div>
                    <div style={{ ...MUTED, fontSize: '0.8rem' }}>
                      {selected.jobs.map((j) => j.hcp_number || j.click_number).filter(Boolean).join(' · ')}{packet?.account.customerAddress ? ` · ${packet.account.customerAddress}` : ''}
                      {venueLine && !selectedGivenUp ? <><br /><span data-legal-venue-line>{venueLine}</span></> : null}
                      {matter?.review_requested_at && !withFirm && !closed ? <><br /><span style={{ color: 'var(--text-blue-700)' }}>{requesterName} asked for a dev’s eyes{requestedDays != null ? ` ${requestedDays}d ago` : ''}{matter.review_request_note ? `: “${matter.review_request_note}”` : ''}</span></> : null}
                      {withFirm && matter?.note_to_firm ? <><br /><span style={MUTED}>Note to the firm: “{matter.note_to_firm}”</span></> : null}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ ...NUM, fontSize: '1.3rem', fontWeight: 700 }}>{formatLegalMoney(selected.balance)}</div>
                    <div style={{ ...MUTED, fontSize: '0.76rem' }}>balance{selected.oldestDays == null ? '' : ` · oldest ${selected.oldestDays}d`}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
                    {packet ? pill(packet.readiness.label, packet.readiness.stops > 0 ? 'stop' : packet.readiness.warns > 0 ? 'warn' : 'ok') : null}
                    <button type="button" onClick={printPacket} disabled={!packet} style={{ ...btn, opacity: packet ? 1 : 0.5 }}>⎙ Print packet</button>
                    <span style={{ flex: 1 }} />
                    {headerActs}
                  </div>
                </div>

                {loading && !packet ? <p style={{ ...MUTED, fontSize: '0.84rem' }}>Assembling the packet…</p> : null}
                {failed.length > 0 ? (
                  <p style={{ fontSize: '0.8rem', color: '#9a6700', margin: '8px 0 0' }}>
                    Couldn’t load {failed.join(', ')} — those sections read empty here, not in the record.{' '}
                    <button type="button" onClick={reload} style={{ ...btn, height: 22, fontSize: '0.7rem' }}>Retry</button>
                  </p>
                ) : null}

                {writeDownOpen && packet && selected ? <AccountWriteDownPanel jobs={selected.jobs} lines={packet.account.jobs} onDone={afterAccountWriteDown} onCancel={() => setWriteDownOpen(false)} /> : null}

                {packet && w ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, margin: '12px 0 0' }}>
                    {deskQuestions(packet, counselRead).map((c) => (
                      <div key={c.label} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', background: 'var(--surface)' }}>
                        <div style={{ ...MUTED, fontSize: '0.66rem', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>{c.label}</div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>{c.answer}{c.chip ? pill(c.chip.text, c.chip.tone) : null}</div>
                        {c.why ? <div style={{ ...MUTED, fontSize: '0.72rem' }}>{c.why}</div> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                {packet && w && w.balance > 0.004 ? (
                  // v2.6105 (punch list #214, PR 2): the same money as bars — the open bills by part, the claim with every standing offer marked, what is left after the firm's cut.
                  <LegalMoneyBars
                    bars={moneyBars({
                      bills: w.openBills.map((b) => ({ key: b.invoiceId, jobId: b.jobId, jobLabel: b.jobLabel, ymd: b.ymd, text: b.text, open: b.open })),
                      retainageOnBillsByJob: new Map(Object.entries(w.retainageOnBillsByJob)),
                      retainageAdded: w.retainageAdded,
                      balance: w.balance,
                      claim: w.claim,
                      contingencyPct: w.contingencyPct,
                      fee: w.fee,
                      filingCost: w.filingCost,
                      net: w.net,
                      offers: (matter ? (legal?.entriesByMatter.get(matter.id) ?? []) : []).filter((e) => isOfferEntry(e) && !isVoidedEntry(e)).map((e) => {
                        const meta = offerMetaOf(e.meta)
                        return { key: e.id, direction: meta.direction, amount: Number(e.amount ?? 0), status: meta.status, ymd: e.occurred_on, expiresOn: meta.expiresOn }
                      }),
                    })}
                  />
                ) : null}

                {packet && packet.gaps.length > 0 ? (
                  <div style={{ margin: '12px 0 0', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-muted)' }}>
                    <button type="button" onClick={() => setGapsOpen((o) => !o)} aria-expanded={gapsOpen} style={{ ...btn, borderStyle: 'none', background: 'none', width: '100%', justifyContent: 'flex-start', height: 34, padding: '0 12px', fontSize: '0.82rem', fontWeight: 600 }}>
                      <span aria-hidden>{gapsOpen ? '▼' : '▶'}</span> Before this goes to an attorney · {packet.readiness.stops} to fix{packet.readiness.warns ? ` · ${packet.readiness.warns} to know about` : ''}{packet.readiness.answered ? ` · ${packet.readiness.answered} answered` : ''}
                    </button>
                    {gapsOpen ? (
                      <ul style={{ listStyle: 'none', margin: 0, padding: '0 12px 10px', display: 'grid', gap: 6 }}>
                        {/* Gap answers (v2.5920): a red gap stays in place with its answer riding under it; an answered note moves to the Answered group below. */}
                        {[...packet.gaps.filter((g) => g.severity === 'stop' || !g.answer), ...packet.gaps.filter((g) => g.severity === 'warn' && g.answer)].map((g, i, list) => {
                          const answeredGroup = g.severity === 'warn' && Boolean(g.answer)
                          const groupStarts = answeredGroup && (i === 0 || !(list[i - 1]?.severity === 'warn' && list[i - 1]?.answer))
                          const answerLine = g.answer ? (
                            <div data-legal-gap-answer-line={g.key} style={{ margin: '4px 0 0', padding: '4px 9px', borderLeft: '3px solid #1f7a3a', background: 'var(--bg-muted)', borderRadius: '0 6px 6px 0' }}>
                              The office: {g.answer.text}
                              {g.answer.documentId ? <> · <button type="button" onClick={() => setTab('evidence')} style={{ ...btn, borderStyle: 'none', background: 'none', padding: 0, height: 'auto', color: 'var(--text-link)' }} title="The document is under Evidence">📄 {g.answer.documentTitle || 'document'}</button></> : null}
                              <div style={{ ...MUTED, fontSize: '0.76rem', marginTop: 2 }}>
                                {gapAnswerByline(g.answer)}
                                {!g.answer.auto ? <> · <button type="button" data-legal-gap-answer-edit={g.key} onClick={() => void openGapAnswer(g)} style={{ ...btn, borderStyle: 'none', background: 'none', padding: 0, height: 'auto', fontSize: '0.76rem' }}>Edit</button> · <button type="button" data-legal-gap-answer-clear={g.key} onClick={() => void clearGapAnswer(g)} style={{ ...btn, borderStyle: 'none', background: 'none', padding: 0, height: 'auto', fontSize: '0.76rem' }}>Clear</button></> : null}
                              </div>
                            </div>
                          ) : null
                          const answerSheetBlock = gapAnswerSheet?.key === g.key ? (
                            <div data-legal-gap-answer-sheet style={{ margin: '6px 0 2px', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
                              <div style={{ fontWeight: 600, marginBottom: 4 }}>Answer it — what the office knows</div>
                              <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)' }}>One line the attorney should read beside this gap
                                <input type="text" value={gapAnswerSheet.text} maxLength={LEGAL_GAP_ANSWER_MAX} onChange={(e) => setGapAnswerSheet((s) => (s ? { ...s, text: e.target.value } : s))} style={sheetInput} aria-label="The answer" placeholder="No paper exists: the GC ordered the work by text on May 12" />
                              </label>
                              <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)' }}>Evidence document that shows it (optional)
                                <select value={gapAnswerSheet.documentId} onChange={(e) => setGapAnswerSheet((s) => (s ? { ...s, documentId: e.target.value } : s))} style={sheetInput} aria-label="Document that shows it">
                                  <option value="">None</option>
                                  {gapAnswerDocs.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                                </select>
                              </label>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                <button type="button" data-legal-gap-answer-save onClick={() => void saveGapAnswer()} disabled={gapAnswerBusy || !gapAnswerSheet.text.trim()} style={{ ...btnPrimary, opacity: gapAnswerBusy || !gapAnswerSheet.text.trim() ? 0.5 : 1 }}>{gapAnswerBusy ? 'Saving…' : 'Save the answer'}</button>
                                <button type="button" onClick={() => setGapAnswerSheet(null)} style={btn}>Cancel</button>
                                {g.severity === 'stop' ? <span style={{ ...MUTED, fontSize: '0.76rem' }}>A red gap stays red until it is fixed — the answer rides under it either way.</span> : null}
                              </div>
                            </div>
                          ) : null
                          return (
                            <li key={g.key}>
                              {groupStarts ? <div style={{ ...MUTED, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', margin: '6px 0 2px' }}>Answered — out of the counts, still on the record</div> : null}
                              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'start', fontSize: '0.82rem' }}>
                                {answeredGroup ? pill('answered', 'ok') : pill(g.severity === 'stop' ? 'fix' : 'note', g.severity)}
                                <span>
                                  {answeredGroup ? <span style={MUTED}>{g.label}</span> : g.chip ? <><span data-legal-gap-chip={g.key} title={`${g.label} — ${g.detail}`}>{pill(g.chip, g.severity)}</span> <span style={MUTED}>{g.brief ?? g.detail}</span></> : <><b>{g.label}</b> <span style={MUTED}>— {g.detail}</span></>}
                                  {answerLine}
                                  {answerSheetBlock}
                                </span>
                                <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                  {g.fix === 'set_gc' ? (
                                    <>
                                      <button type="button" data-legal-gap-set-gc={g.jobId ?? ''} onClick={() => fixGap(g)} style={btnPrimary} title="Moves the customer into the GC/Builder slot in one press; the customer slot clears and the bills go to the GC">{FIX_LABEL[g.fix]}</button>
                                      <button type="button" data-legal-gap-owner-contract={g.jobId ?? ''} onClick={() => void confirmOwnerContract(g)} style={btn} title="Keeps the job as it is and puts this note away">Ours with the owner</button>
                                    </>
                                  ) : g.fix !== 'none' ? <button type="button" onClick={() => fixGap(g)} style={btn}>{FIX_LABEL[g.fix]}</button> : null}
                                  {!g.answer || g.answer.auto ? <button type="button" data-legal-gap-answer-open={g.key} onClick={() => void openGapAnswer(g)} style={btn} title="One line the attorney reads beside this gap — for a fact that is true and known, like work done on a handshake">Answer…</button> : null}
                                </span>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    ) : null}
                  </div>
                ) : packet ? <div style={{ margin: '12px 0 0', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.82rem', color: '#1f7a3a' }}>✓ No gaps — an attorney would have everything they ask for first.</div> : null}

                {stacked ? null : tabStrip}

                <div ref={tabContentRef} style={{ scrollMarginTop: TAB_STRIP_PHONE_HEIGHT }}>
                {packet ? (
                  <PacketTab tab={tab} onTab={setTab} packet={packet} selected={selected} props={props} openEditCustomer={openEditCustomer}
                    curation={stored && canEditReview ? { holdBack, shareAgain, shareAll, holdFor, setHoldFor, reasons: heldReasonsOf(matter), busy } : null} entries={matter ? (legal?.entriesByMatter.get(matter.id) ?? []) : []}
                    officeActs={stored && canEditReview ? { acknowledge, answerFor, setAnswerFor, sendAnswer, markApplied, busy, onOpenPipelineRow: () => { if (firstJob) props.onFocusJob(firstJob.id) }, askForm: matter ? askForm : null, setAskForm, sendAsk, withdrawFirmAsk, canAsk: matterIsWithFirm(matter) || inHouse, inHouse, offerAdd, offerSetStatus, answerSettlement, setCounselRead, counselRead, moveStage, voidEntry } : null}
                    documents={matter ? { matterId: matter.id, list: legal?.documentsByMatter.get(matter.id) ?? [], canEdit: stored && canEditReview, reload: () => void legal?.reload() } : null}
                    narrative={narrativeDesk} busy={busy} planActs={planActs} />
                ) : null}
                </div>
              </>
            )}
          </div>
          )}
        </div>
        )}
    </>
  )

  // The sheets and windows the desk opens over itself, each a backdrop and a panel of its own. A sheet's panel stops a
  // click so it never reaches the sheet's own backdrop; the backdrops' stops are from the window days (v2.4352) and cost
  // nothing on the page.
  const sheets = (
    <>
      {sheet?.kind === 'ready' && selected && packet ? (
        <div role="presentation" onClick={(e) => { e.stopPropagation(); setSheet(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: DESK_LAYER_Z + 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(14px + var(--app-top-chrome, 0px)) 14px 14px' }}>
          <div role="dialog" aria-modal="true" aria-label="Mark attorney-ready" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 10, padding: 18, maxWidth: 620, width: '100%', boxShadow: '0 12px 40px rgba(0,0,0,0.28)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Mark {selected.name} attorney-ready?</h3>
            {!firm ? (
              <p style={{ fontSize: '0.86rem', color: '#b42318', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {releaseHold ?? 'No firm is set up yet.'}
                {stored ? <button type="button" onClick={() => { setSheet(null); if (canEditFirm) setFirmsOpen(true); else setFirmOpen(true) }} style={btn}>{canEditFirm ? 'Firms…' : 'See the firm…'}</button> : null}
              </p>
            ) : (
              <>
                <p style={{ ...MUTED, fontSize: '0.84rem', margin: '0 0 8px' }}>
                  This is the release. The matter goes to <b>{firm.name}</b> the moment you confirm — {selected.jobs.length} job{selected.jobs.length === 1 ? '' : 's'}, {formatLegalMoney(selected.balance)}, theory <b>{packet.theory.label}</b>, exhibits A–{packet.exhibits[packet.exhibits.length - 1]?.letter ?? 'A'}.
                  {packet.theirWord.heldCount ? <> <b>{packet.theirWord.heldCount} entr{packet.theirWord.heldCount === 1 ? 'y is' : 'ies are'} held back</b> from the firm.</> : null}
                </p>
                {packet.worth.verdict === 'not worth it' ? <p style={{ fontSize: '0.84rem', color: '#b42318', margin: '0 0 8px' }}><b>Click keeps {formatLegalMoney(packet.worth.net)}.</b> The firm’s cut and costs eat what is left. Write down / stop pursuing is the other exit.</p> : null}
                {packet.readiness.stops ? <p style={{ fontSize: '0.84rem', color: '#b42318', margin: '0 0 8px' }}><b>{packet.readiness.stops} red gap{packet.readiness.stops === 1 ? '' : 's'} still open</b> — {packet.gaps.filter((g) => g.severity === 'stop').map((g) => g.label).join('; ')}. You can mark anyway; the packet says so on its cover sheet.</p> : null}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 10px' }}>
                  <button type="button" onClick={() => { setPreviewTab('account'); setPreviewOpen(true) }} style={btn}>Preview what the firm sees ↗</button>
                  <span style={{ ...MUTED, fontSize: '0.78rem' }}>Their page for this account, all five tabs, held entries left out.</span>
                </div>
                <label style={{ fontSize: '0.84rem', display: 'block' }}>Handling person at the firm<input value={sheet.handling} onChange={(e) => setSheet({ ...sheet, handling: e.target.value })} placeholder={firm.handling_name || 'Who at the firm takes it'} style={sheetInput} /></label>
                <div style={{ fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}><span>Who hears about it, by their own rules</span><button type="button" onClick={() => setEmailsOpen(true)} style={{ ...btn, height: 22, fontSize: '0.7rem', textTransform: 'none', letterSpacing: 0 }}>Firm’s emails ↗</button></div>
                {recipients.length ? recipients.map((r) => <div key={r.email} style={{ fontSize: '0.84rem', padding: '5px 0', borderTop: '1px solid var(--border)' }}>{pill(r.bucket === 'now' ? 'Email now' : r.bucket === 'digest' ? 'In their digest' : r.bucket === 'unconfirmed' ? 'Not confirmed' : 'Not emailed', r.bucket === 'now' ? 'legal' : r.bucket === 'unconfirmed' ? 'warn' : 'neutral')} <b>{r.name}</b> <span style={MUTED}>{r.email} · {r.why}</span></div>) : <p style={{ ...MUTED, fontSize: '0.82rem' }}>Nobody at the firm is on the list — nobody is emailed; the matter still appears on their portal.</p>}
                {firmPaused ? <p style={{ fontSize: '0.82rem', color: '#b42318', margin: '6px 0 0' }}>All emails to the firm are paused — the matter still appears on their portal; nobody is emailed.</p> : null}
                <label style={{ fontSize: '0.84rem', display: 'block', marginTop: 8 }}>Note for the firm (optional)<textarea value={sheet.note} onChange={(e) => setSheet({ ...sheet, note: e.target.value })} rows={2} placeholder="e.g. Pursue the GC first; the owner disputes nothing." style={sheetInput} /></label>
              </>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" onClick={() => setSheet(null)} style={btn}>Cancel</button>
              <button type="button" onClick={() => void confirmReady()} disabled={!firm || busy} style={{ ...btnPrimary, opacity: !firm || busy ? 0.5 : 1 }}>{packet.readiness.stops ? 'Mark ready anyway' : 'Mark attorney ready'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {previewOpen && sheet?.kind === 'ready' && selected && packet && firm ? (
        <div role="presentation" onClick={(e) => { e.stopPropagation(); setPreviewOpen(false) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: DESK_LAYER_Z + 12, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(14px + var(--app-top-chrome, 0px)) 14px 14px' }}>
          <div role="dialog" aria-modal="true" aria-label="What the firm will see" data-theme="light" onClick={(e) => e.stopPropagation()} style={{ background: PORTAL_PAPER, color: PORTAL_INK, fontFamily: PORTAL_FONT, borderRadius: 8, padding: 16, maxWidth: 980, width: '100%', maxHeight: 'min(92vh, 100%)', overflow: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.35)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>What {firm.name} will see the moment you confirm</div>
                <div style={{ fontSize: 12.5, color: PORTAL_MUTED }}>
                  Preview only — nothing is released yet. Same five tabs, same records, built the way their page builds them.
                  {packet.theirWord.heldCount ? <> <b style={{ color: PORTAL_INK }}>{packet.theirWord.heldCount} held entr{packet.theirWord.heldCount === 1 ? 'y is' : 'ies are'} left out.</b></> : ' Every entry goes in.'}
                  {sheet.note.trim() ? ' Your note for the firm shows under the matter.' : ''}
                </div>
              </div>
              <button type="button" onClick={() => setPreviewOpen(false)} style={{ ...btn, color: PORTAL_INK, borderColor: PORTAL_MUTED, background: 'transparent' }}>Close preview</button>
            </div>
            <FirmMatterView
              packet={packet}
              companyName={companyName}
              matter={{ payerName: selected.name, noteToFirm: sheet.note, contracts: [], entries: matter ? (legal?.entriesByMatter.get(matter.id) ?? []).filter((e) => e.kind !== 'plan' || holdOverrides[planHoldKey(e.id)] !== true) : [], ...previewDocuments(matter ? (legal?.documentsByMatter.get(matter.id) ?? []) : [], props.users), narrative: narrativeDesk.markdown.trim() ? { markdown: narrativeDesk.markdown, updatedOn: narrativeDesk.updatedOn, updatedByName: narrativeDesk.updatedByName } : null }}
              tab={previewTab}
              onTab={setPreviewTab}
              onPrint={printPacket}
            />
          </div>
        </div>
      ) : null}

      {sheet?.kind === 'ask' && selected ? (
        <div role="presentation" onClick={(e) => { e.stopPropagation(); setSheet(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: DESK_LAYER_Z + 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(14px + var(--app-top-chrome, 0px)) 14px 14px' }}>
          <div role="dialog" aria-modal="true" aria-label="Ask a dev to review" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 10, padding: 18, maxWidth: 520, width: '100%', boxShadow: '0 12px 40px rgba(0,0,0,0.28)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Ask a dev to review {selected.name}</h3>
            <p style={{ ...MUTED, fontSize: '0.84rem' }}>Puts this account at the top of the dev’s Needs You card with your note. Keep working the gaps meanwhile.</p>
            <textarea value={sheet.note} onChange={(e) => setSheet({ ...sheet, note: e.target.value })} rows={3} placeholder="e.g. Demand deadline passed, contract on file — ready for your eyes." style={sheetInput} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setSheet(null)} style={btn}>Cancel</button>
              <button type="button" onClick={() => void confirmAsk()} disabled={busy} style={btnPrimary}>Ask</button>
            </div>
          </div>
        </div>
      ) : null}

      {sheet?.kind === 'in_house' && selected ? (
        <div role="presentation" onClick={(e) => { e.stopPropagation(); setSheet(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: DESK_LAYER_Z + 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(14px + var(--app-top-chrome, 0px)) 14px 14px' }}>
          <div role="dialog" aria-modal="true" aria-label="Run it in house" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 10, padding: 18, maxWidth: 520, width: '100%', boxShadow: '0 12px 40px rgba(0,0,0,0.28)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Run {selected.name} in house</h3>
            <p style={{ ...MUTED, fontSize: '0.84rem' }}>The office works the case itself for now. An offers log and questions for counsel open on Fees &amp; steps; Mark attorney ready carries them to the firm later. One line on why.</p>
            <textarea value={sheet.note} onChange={(e) => setSheet({ ...sheet, note: e.target.value })} rows={2} placeholder="e.g. Counsel away until Nov 3." aria-label="Why the office runs it" style={sheetInput} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setSheet(null)} style={btn}>Cancel</button>
              <button type="button" onClick={() => void confirmInHouse()} disabled={busy} style={btnPrimary}>Run it in house</button>
            </div>
          </div>
        </div>
      ) : null}

      {sheet?.kind === 'pull' && selected ? (
        <div role="presentation" onClick={(e) => { e.stopPropagation(); setSheet(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: DESK_LAYER_Z + 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(14px + var(--app-top-chrome, 0px)) 14px 14px' }}>
          <div role="dialog" aria-modal="true" aria-label="Pull back from the firm" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 10, padding: 18, maxWidth: 520, width: '100%', boxShadow: '0 12px 40px rgba(0,0,0,0.28)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Pull {selected.name} back from {firm?.name ?? 'the firm'}?</h3>
            <p style={{ ...MUTED, fontSize: '0.84rem' }}>The account returns to review. The firm keeps a read-only page with your reason, their own fees and steps, and the conversation; the account's records leave their portal. They are emailed the reason.</p>
            <textarea value={sheet.note} onChange={(e) => setSheet({ ...sheet, note: e.target.value })} rows={2} placeholder="Why (the firm reads this)" aria-label="Why you are pulling it back" style={sheetInput} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setSheet(null)} style={btn}>Cancel</button>
              <button type="button" onClick={() => void confirmPull()} disabled={busy || !sheet.note.trim()} style={{ ...btnPrimary, opacity: busy || !sheet.note.trim() ? 0.5 : 1 }}>Pull back</button>
            </div>
          </div>
        </div>
      ) : null}
      {sheet?.kind === 'close' && selected && matter ? (
        <div role="presentation" onClick={(e) => { e.stopPropagation(); setSheet(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: DESK_LAYER_Z + 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(14px + var(--app-top-chrome, 0px)) 14px 14px' }}>
          <div role="dialog" aria-modal="true" aria-label="Close the matter" data-legal-close-sheet onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 10, padding: 18, maxWidth: 520, width: '100%', boxShadow: '0 12px 40px rgba(0,0,0,0.28)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Close {selected.name} as {legalStageLabel(matter.stage).toLowerCase()}?</h3>
            <p style={{ ...MUTED, fontSize: '0.84rem' }}>The firm recorded it. Close it once any payment they hold is applied on the job and their last costs are in. The matter leaves their portal and moves to Closed here.</p>
            <textarea value={sheet.note} onChange={(e) => setSheet({ ...sheet, note: e.target.value })} rows={2} placeholder="A note for the record (optional)" style={sheetInput} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setSheet(null)} style={btn}>Cancel</button>
              <button type="button" onClick={() => void confirmClose()} disabled={busy} style={btnPrimary}>Close the matter</button>
            </div>
          </div>
        </div>
      ) : null}

      {firmOpen && stored ? (
        <LegalFirmWindow firm={firm} matters={legal?.matters ?? []} recipients={firmRecipients} canEdit={canEditFirm} onClose={() => setFirmOpen(false)} onSaved={() => { void legal?.reload() }} onShowAccount={(key) => { setFirmOpen(false); setSelectedKey(key); setTab('account') }} zIndex={DESK_LAYER_Z + 14} />
      ) : null}
      {firmsOpen && stored ? <LegalFirmsWindow onClose={() => setFirmsOpen(false)} onSaved={() => { void legal?.reload() }} zIndex={DESK_LAYER_Z + 14} /> : null}
      {emailsOpen && firm ? (
        <div role="presentation" onClick={(e) => { e.stopPropagation(); setEmailsOpen(false) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: DESK_LAYER_Z + 12, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(14px + var(--app-top-chrome, 0px)) 14px 14px' }}>
          <div role="dialog" aria-modal="true" aria-label="Who at the firm hears from us" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 10, padding: 18, maxWidth: 640, width: '100%', boxShadow: '0 12px 40px rgba(0,0,0,0.28)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '1rem' }}>✉ Who at {firm.name} hears from us</h3>
            <p style={{ ...MUTED, fontSize: '0.8rem', margin: '0 0 10px' }}>Managed by the firm on their portal’s Notifications page. The office keeps two overrides: pause everything, and remove a person. A new address is inert until they click their confirmation; every email carries a one-click stop.</p>
            {firmRecipients.length === 0 ? <p style={{ fontSize: '0.84rem' }}>Nobody on the list yet — nothing is emailed until the firm adds its people on the portal’s Notifications page. Send them their link from Portal link, beside the firm’s name in the header: its email asks them to add their people.</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={TH}>Person</th><th style={TH}>Hears</th><th style={TH}>Scope</th><th style={TH}>Status</th><th style={TH}></th></tr></thead>
                <tbody>
                  {firmRecipients.map((r) => (
                    <tr key={r.id}>
                      <td style={TD}><b>{r.name}</b><div style={{ ...MUTED, fontSize: '0.76rem' }}>{r.email}{r.role ? ` · ${r.role}` : ''}</div>{r.send_failed_since && !r.paused_at ? <div data-legal-not-reaching style={{ color: '#b42318', fontSize: '0.76rem', marginTop: 2 }}>{legalNotReachingLine({ email: r.email, sinceYmd: calendarYmdInAppTzFromIso(r.send_failed_since), error: r.send_error, confirmed: Boolean(r.confirmed_at), mode: r.mode }, 'office')}</div> : null}</td>
                      <td style={TD}>{r.mode === 'digest' ? `${WEEKDAY_LABELS[r.digest_weekday] ?? 'Mon'} ${r.digest_time} digest` : 'right away'}</td>
                      <td style={TD}>{r.scope === 'mine' ? 'only their matters' : 'every matter'}</td>
                      <td style={TD}>{r.paused_at ? pill('stopped', 'neutral') : r.send_failed_since ? pill('not reaching', 'warn') : r.confirmed_at ? pill('confirmed', 'ok') : pill('not confirmed', 'warn')}</td>
                      <td style={TD}><button type="button" onClick={() => void removeRecipient(r.id, r.name)} disabled={busy} style={btn}>Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
              {firmPaused ? <button type="button" onClick={() => void setFirmPaused(false)} disabled={busy} style={btnPrimary}>Resume emails to the firm</button> : <button type="button" onClick={() => void setFirmPaused(true)} disabled={busy} style={{ ...btn, color: '#b42318', borderColor: '#b42318' }}>Pause all emails to the firm</button>}
              <span style={{ ...MUTED, fontSize: '0.76rem' }}>{firmPaused ? 'Paused — events queue and send when you resume.' : 'A new account referred, an office answer, a pull-back: each person hears right away or in their digest.'}</span>
              <span style={{ flex: 1 }} />
              <button type="button" onClick={() => setEmailsOpen(false)} style={btn}>Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )

  // The page's frame (punch list #182): the desk fills whatever height the page gives it; nothing is dimmed, and the
  // sheets open over the page.
  return (
    <div data-legal-desk-page style={{ height: '100%', minHeight: 0, display: 'grid', gridTemplateRows: 'minmax(0, 1fr)' }}>
      <section aria-label="Legal Desk — Collections accounts reviewed before release to an attorney" data-legal-desk-panel="page"
        // The ? card (punch list #187) is a third row while it is open: two fixed rows squeezed it to 0 px over the rail. The one
        // column is held to the panel: an implicit one grew to the firm group's width on a phone and pushed the rail past the edge.
        style={{ background: 'var(--surface)', color: 'var(--text)', width: '100%', height: '100%', minHeight: 0, display: 'grid', gridTemplateRows: legendOpen ? 'auto auto minmax(0, 1fr)' : 'auto minmax(0, 1fr)', gridTemplateColumns: 'minmax(0, 1fr)', overflow: 'hidden', border: '1px solid var(--border)', borderRadius: 10 }}>
        {panelInner}
      </section>
      {sheets}
    </div>
  )
}

function previewDocuments(rows: ReadonlyArray<LegalMatterDocumentRow>, users: ReadonlyArray<{ id: string; name: string | null }>): { documents: LegalPortalDocument[]; heldDocumentCount: number } {
  const nameOf = (id: string | null) => (id ? users.find((u) => u.id === id)?.name ?? '' : '')
  return {
    documents: rows.filter((r) => !r.held_reason.trim()).map((r) => legalPortalDocumentFromRow(r, nameOf(r.added_by), '', calendarYmdInAppTzFromIso)),
    heldDocumentCount: rows.filter((r) => r.held_reason.trim()).length,
  }
}
