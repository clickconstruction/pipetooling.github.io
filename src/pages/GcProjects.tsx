/**
 * GC mode, the real build, step 4: the GC projects page, open to the office and estimators since
 * door 1 (v2.4832, `canOpenGcProjects`). It lists every GC project as the kernels read it (the
 * sets, the sheets, the trades with their scope lines and the gaps), and holds the New project
 * window. `src/lib/gc/gcIo.ts` does the reading
 * and the one write; the window and the kernels decide the rest.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { GC_MONEY_TEAM, canOpenGcProjects, canSeeGcMoney, canSendGcTradeEmail, canUseGcBoardWrites, canUseGcBuilding } from '../lib/gc/access'
import { inviteEmailRequest, type NewAsk } from '../lib/gc/askEmail'
import { packageHasTab } from '../lib/gc/bids'
import { GC_NEW_HERE_CONTROL, GC_NEW_HERE_GUIDE, GC_NEW_HERE_SEEN_KEY, GC_NEW_HERE_STEPS, gcNewHereTarget } from '../lib/gc/tour'
import { recordNavClick } from '../lib/navClickTelemetry'
import { SpotlightTour, spotlightTourStepsPresent, type SpotlightTourStep } from '../components/SpotlightTour'
import { useToastContext } from '../contexts/ToastContext'
import { formatErrorMessage } from '../utils/errorHandling'
import { calendarYmdInAppTzFromIso, todayYmdInAppTz } from '../utils/dateUtils'
import { GcNewProjectWindow } from '../components/gc/GcNewProject'
import { GcScopeBookWindow } from '../components/gc/GcScopeBook'
import { GcNewPlansWindow } from '../components/gc/GcNewPlans'
import { GcPlansWindow } from '../components/gc/GcPlansWindow'
import { GcQuestionsWindow, type AnswerReach } from '../components/gc/GcQuestions'
import { GcChangeOrdersWindow } from '../components/gc/GcChangeOrders'
import { GcScheduleWindow } from '../components/gc/GcScheduleWindow'
import { withChangeOrders, withChangeRequests, type ChangeOrderRow, type ChangeRequestRow } from '../lib/gc/changeOrderRows'
import { GcDailyLogWindow } from '../components/gc/GcDailyLog'
import { dailyLogPayload, withCrewClockIns, withDailyLogs, type CrewOnSiteRow, type DailyLogRow } from '../lib/gc/dailyLogRows'
import { loadGcCrewOnSite, loadGcDailyLogs, saveGcDailyLog } from '../lib/gc/dailyLogIo'
import { crewJobsHeld, generalConditionsHolder, heldByOthers, withCrewPercents, type CrewJobRead } from '../lib/gc/crewJobRows'
import { linkCrewJob, loadCrewJobs, searchCrewJobs, suggestCrewJobs, type CrewJobLink } from '../lib/gc/crewJobIo'
import type { OwnCrewWrites } from '../components/gc/GcOwnCrew'
import { GcSubmittalsWindow } from '../components/gc/GcSubmittalsWindow'
import { submittalRoundExtras, tradeSpecSections, withSubmittals, type SubmittalTables } from '../lib/gc/submittalRows'
import { addSubmittal, answerSubmittal, loadGcSubmittals, markSubmittalSent, sendSubmittalToArchitect, submittalCameIn } from '../lib/gc/submittalsIo'
import { GcRfisWindow } from '../components/gc/GcRfisWindow'
import { rfiExtras, withRfis, type RfiTables } from '../lib/gc/rfiRows'
import { addRfi, answerRfi, loadGcRfis, markRfiSent, sendRfiToArchitect, startRfiChangeOrder } from '../lib/gc/rfisIo'
import { GcDrawsWindow } from '../components/gc/GcDrawsWindow'
import { drawExtras, NO_DRAWS, withDraws, withTradeChanges, type DrawTables } from '../lib/gc/drawRows'
import { NO_WAIVER_FILES, waiverFilesByDraw, type WaiverFile } from '../lib/gc/tradeFiles'
import { loadGcWaiverFiles } from '../lib/gc/tradeFilesIo'
import {
  approveDraw,
  approveDrawLess,
  chargeTrade,
  drawCameIn,
  drawWaiverIn,
  emailTheTrade,
  loadGcDraws,
  payDraw,
  sendDrawBack,
  sendTradeChange,
  settleBackCharge,
  takeBackCharge,
} from '../lib/gc/drawsIo'
import { changeEmail, chargeEmail, drawEmailFor, lessEmail, paidEmail, type DrawEmail, type DrawEmailTo } from '../lib/gc/drawEmail'
import { retainageHeldNow } from '../lib/gc/building'
import { acceptedEmail, finalInEmail } from '../lib/gc/closeoutEmail'
import { GcCloseoutWindow } from '../components/gc/GcCloseoutWindow'
import { GcStartWindow, type StartPresses, type StartTold } from '../components/gc/GcStartWindow'
import { acceptWork, approveRetainage, changeSignedIn, closeJob, finalPayAppCameIn } from '../lib/gc/closeoutIo'
import { addPunchItem, checkPunchItem, loadGcPunch, punchFixedIn, removePunchItem } from '../lib/gc/punchIo'
import { GcPunchWindow } from '../components/gc/GcPunchWindow'
import type { PunchWrites } from '../components/gc/GcPunchList'
import { withPunch, type PunchRow } from '../lib/gc/punchRows'
import type { ScheduleRead } from '../lib/gc/schedule/rows'
import { missingLogs } from '../lib/gc/buildingLog'
import { GcMoney } from '../components/gc/GcMoney'
import { GcMoneyMondayEmail, type MoneyMondayIo } from '../components/gc/GcMoneyMondayEmail'
import { GcBillCustomerWindow } from '../components/gc/GcBillCustomer'
import { billingStateFor, billingStateForAll, finalPayAppForm, finalPayAppSendPayload, payAppSendPayload, withSchedules, type BillingRows } from '../lib/gc/billCustomer'
import { loadSchedule, type ScheduleReads } from '../lib/gc/scheduleIo'
import type { WeeklyReportWrites } from '../components/gc/GcWeeklyReport'
import { weeklyReportRetryRow, withWeeklyReports, type WeeklyReportRow, type WeeklyReportSend } from '../lib/gc/weeklyReportRows'
import { loadGcWeeklyReports, recordWeeklyReport, sendWeeklyReport } from '../lib/gc/weeklyReportsIo'
import { ownerContractWorthNow, ownerFinalPayAppToSend, ownerPayApp, ownerPayAppForm, ownerPayAppParties, ownerPayAppsSent, ownerPayAppToSend, projectChangeOrders } from '../lib/gc/ownerBilling'
import { downloadPayAppExcel, downloadPayAppPdf, payAppPdf } from '../lib/gc/payAppFileWriters'
import { payAppFileName } from '../lib/gc/payAppFile'
import {
  certifiedMail,
  certifiedMailFacts,
  certifyAskMail,
  changeOrderMail,
  changeOrderMailFacts,
  contractMail,
  contractMailFacts,
  gcCustomerEmailRefusal,
  interestBillMail,
  interestBillMailFacts,
  payAppMail,
  payAppMailFacts,
  type BillEmailed,
} from '../lib/gc/customerEmail'
import { GC_CUSTOMER_EMAIL_FILED_AS } from '../../supabase/functions/_shared/gcCustomerEmails'
import { pdfBase64, sendGcCustomerEmail } from '../lib/gc/customerEmailIo'
import { unbilledPayments } from '../lib/gc/ownerBillingRows'
import { payReminderEmail } from '../lib/gc/ownerBillingRemind'
import LienReleaseModal from '../components/jobs/LienReleaseModal'
import { fetchJobWithDetailsById } from '../lib/fetchJobWithDetailsById'
import type { JobWithDetails } from '../types/jobWithDetails'
import { openQuestions, questionsCloseOn, type PlanQuestionView } from '../lib/gc/questions'
import { answerEmail, answerRecipients, answerSentWords, tradeMailLang } from '../lib/gc/tradeEmail'
import { emailTheAnswer, sendGcTradeEmail } from '../lib/gc/tradeEmailIo'
import { Btn, Chip } from '../components/gc/gcUi'
import { BidsModeToggle } from '../components/gc/BidsModeToggle'
import { GcBoard } from '../components/gc/GcBoard'
import { GcTradePartners, type TradePartnerWrites } from '../components/gc/GcTradePartners'
import { GcFollowUp, GcTradeAsks, type AskWrites } from '../components/gc/GcAskThread'
import { GcAskCompanies } from '../components/gc/GcAskCompanies'
import { GcCompareQuotes, type CompareWrites } from '../components/gc/GcCompareQuotes'
import { GcTradeSow, type SowWrites } from '../components/gc/GcTradeSow'
import { GcBidTabs } from '../components/gc/GcBidTabs'
import { GcOurNumber } from '../components/gc/GcOurNumber'
import { ownWorkJobIds, type OwnWorkCosts } from '../lib/gc/ownWorkCost'
import { loadOwnWorkCosts } from '../lib/gc/ownWorkCostIo'
import { GcProjectOutcome, type OutcomeWrites } from '../components/gc/GcProjectOutcome'
import { GcCompanyWindow } from '../components/gc/GcCompanyWindow'
import { GcTheirPortal } from '../components/gc/GcTheirPortal'
import { loadCompanyPaperEntries, recordCompanyInsurance, sendCompanyPaper, type CompanyPaperEntries } from '../lib/gc/papersIo'
import { GcCompanyOpenerContext, type CompanyAt, type CompanyOpener } from '../components/gc/gcCompanyOpener'
import { GcCustomerOpenerContext, type CustomerAt, type CustomerOpener } from '../components/gc/gcCustomerOpener'
import { GcCustomerWindow } from '../components/gc/GcCustomerWindow'
import type { ContractSendInput, ContractSendOutcome } from '../components/gc/GcCustomerContractSend'
import { sendGcOwnerContract } from '../lib/gc/ownerContractIo'
import { mintCustomerPortalLink } from '../lib/portal/mintCustomerPortalLink'
import { benchAnchor } from '../lib/gc/tradeViews'
import { allPeople } from '../lib/gc/projectPeople'
import { boardStateFromRows, type BoardRows } from '../lib/gc/boardRows'
import type { PortalLang } from '../lib/gc/portalI18n'
import { setEmailSummary, type SetEmailCompany, type SetEmailInvite, type SetEmailRecipient, type SetEmailResult } from '../lib/gc/setEmail'
import {
  addGcCompany,
  askGcCompanies,
  awardGcTrade,
  bringGcBack,
  carryGcTrade,
  answerChangeOrder,
  deleteChangeOrderDraft,
  draftChangeOrder,
  draftChangeOrderFromRequest,
  emailChangeAsk,
  loadGcChangeOrders,
  loadGcChangeOrderEmails,
  loadGcChangeRequestEmails,
  loadGcChangeRequests,
  sendChangeOrder,
  setChangeOrderPct,
  turnDownChangeRequest,
  checkDriveAccess,
  createGcProject,
  declineGcAsk,
  editScopeBookLine,
  issuePlanSet,
  loadGcTeam,
  listMoneyMondayRequests,
  applyMoneyMondayPlan,
  previewMoneyMonday,
  sendMoneyMondayTest,
  answerQuestion,
  markQuestionSent,
  recordQuestion,
  sendQuestionToArchitect,
  loadGcPickerCustomers,
  loadGcBoardRows,
  loadGcProjects,
  loadScopeBookStore,
  logGcAskContact,
  makeDriveFolders,
  markGcBidSent,
  markGcLost,
  markGcWon,
  mergeScopeBookLines,
  saveScopeBookLine,
  saveScopeSet,
  setGcAskExclusionCovers,
  setGcAskPlugs,
  setGcAskTakenAlternates,
  setGcProjectMoney,
  setGcGeneralConditionsJob,
  searchPipelineJobs,
  shareGcBidTab,
  setGcCompanyCoverage,
  setGcCompanyLanguage,
  vetGcCompany,
  loadSetEmailParties,
  sendSetEmails,
  type GcPickerCustomer,
  type GcTeamMember,
  linkPayAppWaiver,
  loadGcBillingRows,
  recordAcceptance,
  recordCertificate,
  remindCustomerToPay,
  setOwnerPayDays,
  setOwnerLateInterest,
  setOwnerLateFinish,
  sendOwnerInterestBill,
  recordGcPayment,
  recordGcPromise,
  sendOwnerPayApp,
  setOwnerRetainage,
  sendGcSow,
  takeBillOffCard,
  loadGcStartTold,
  setGcProjectStartItem,
  signGcOwnerContract,
  startGcProject,
} from '../lib/gc/gcIo'
import { fetchGcCardBillOn } from '../lib/gc/cardBillSetting'
import { sowEmailRequest } from '../lib/gc/sowEmail'
import { startEmailRequest, startRecipients } from '../lib/gc/startEmail'
import { gcTradeEmailRefusal, type ChangeAskEmailStage } from '../lib/gc/tradeEmail'
import { DRIVE_RESTRICTED_WORDS } from '../components/gc/GcNewProjectDriveLink'
import { scopeBook, scopeSetsFor, type ScopeBookInput } from '../lib/gc/scopeBook'
import { scopeGaps } from '../lib/gc/plans'
import type { GcProjectView } from '../lib/gc/projectRows'
import type { DailyLog, GcProject, GcState, ScopeBookStore, TradeChangeRequest } from '../lib/gc/types'
import { partnerById } from '../lib/gc/lookups'
import { gcFocusFromSearch, gcViewFromSearch } from '../lib/gc/links'

interface Loaded {
  customers: GcPickerCustomer[]
  projects: GcProjectView[]
  store: ScopeBookStore
  team: GcTeamMember[]
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

/** The Monday money email's reads and writes (O7b), gcIo's, one object for the page's life; each is read when called. */
const MONEY_MONDAY_IO: MoneyMondayIo = {
  list: () => listMoneyMondayRequests(),
  apply: (plan) => applyMoneyMondayPlan(plan),
  preview: () => previewMoneyMonday(),
  test: () => sendMoneyMondayTest(),
}

export default function GcProjects() {
  const { user, role, profileName, loading: authLoading } = useAuth()
  // New here? opens itself on a first visit, once per browser; a blocked storage means no auto open.
  const [tourOpen, setTourOpen] = useState<null | 'first-visit' | 'button'>(() => {
    try {
      return window.localStorage.getItem(GC_NEW_HERE_SEEN_KEY) ? null : 'first-visit'
    } catch {
      return null
    }
  })
  /** The furthest stop the open walk reached, for the close's record. */
  const tourFurthest = useRef(0)
  const { showToast } = useToastContext()
  const [params, setParams] = useSearchParams()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [loadProblem, setLoadProblem] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [createProblem, setCreateProblem] = useState<string | null>(null)
  const [justMade, setJustMade] = useState<string | null>(null)
  /** A set whose Drive link is being checked, as `<projectId>:<rev>`. */
  const [checking, setChecking] = useState<string | null>(null)
  const today = todayYmdInAppTz()
  const windowOpen = params.get('new') === '1'
  /** The scope book's window: `book=1`, and `trade=<trade>&project=<id>` to save that scope as a set. */
  const bookOpen = params.get('book') === '1'
  const bookTrade = params.get('trade')
  const bookProjectId = params.get('project')
  /** The new-plans window: `set=<projectId>`. The plans window: `plans=<projectId>`. */
  const setProjectId = params.get('set')
  const plansProjectId = params.get('plans')
  /** The questions window: `questions=<projectId>`. */
  const questionsProjectId = params.get('questions')
  /** The schedule's window (the schedule's PR 7b): `schedule=<projectId>`, a dev's until the schedule's PR 10. */
  const scheduleProjectId = params.get('schedule')
  const [questionBusy, setQuestionBusy] = useState<string | null>(null)
  const [questionProblem, setQuestionProblem] = useState<string | null>(null)
  const [issuing, setIssuing] = useState(false)
  const [issueProblem, setIssueProblem] = useState<string | null>(null)
  /** Step 7: who was asked on the project in the new-plans window, read when it opens. */
  const [setParties, setSetParties] = useState<{ invites: SetEmailInvite[]; companies: SetEmailCompany[] } | null>(null)
  /** Step 7: a set that is on, while some of its emails did not go out. */
  const [pendingSends, setPendingSends] = useState<{
    setId: string
    projectId: string
    set: { label: string; project: string; note: string; sheets: string[]; quoteDueOn: string | null }
    recipients: SetEmailRecipient[]
    results: SetEmailResult[]
  } | null>(null)
  // A report belongs to the window it was made in: a window on another project, or none, starts clean.
  useEffect(() => {
    setPendingSends(null)
    setSetParties(null)
  }, [setProjectId])
  useEffect(() => {
    const packageIds = setProjectId ? (loaded?.projects.find((p) => p.id === setProjectId)?.trades.map((t) => t.id) ?? []) : []
    if (packageIds.length === 0) return
    let live = true
    void loadSetEmailParties(packageIds)
      .then((parties) => {
        if (live) setSetParties(parties)
      })
      .catch(() => {
        // Not readable for this role yet (the Board's tables are dev only until door 2): nobody hears.
      })
    return () => {
      live = false
    }
  }, [setProjectId, loaded])

  const load = useCallback(async () => {
    try {
      const [customers, projects, store, team] = await Promise.all([loadGcPickerCustomers(), loadGcProjects(), loadScopeBookStore(), loadGcTeam()])
      setLoaded({ customers, projects, store, team })
      setLoadProblem(null)
    } catch (e) {
      setLoadProblem(formatErrorMessage(e, 'The GC projects did not load.'))
    }
  }, [])

  useEffect(() => {
    if (!canOpenGcProjects(role)) return
    void load()
  }, [role, load])

  // The Project Board (the Board's B3): a dev sees it above the projects while it is built; door 1's
  // list stays for everyone until the board's own door opens it to the office.
  const [boardRead, setBoardRead] = useState<GcState | null>(null)
  const [boardProblem, setBoardProblem] = useState<string | null>(null)
  // Each company's language, for the invitation the Ask window draws (the kernels' company carries none yet).
  const [langs, setLangs] = useState<Record<string, PortalLang>>({})
  // Our number (B5-c): the money team reads it; anyone else sees each price as the trades alone.
  const [moneyShown, setMoneyShown] = useState(false)
  const takeRows = (rows: BoardRows) => {
    setBoardRead(boardStateFromRows(rows))
    setMoneyShown(rows.moneyShown ?? false)
    setLangs(Object.fromEntries(rows.companies.map((c) => [c.id, c.lang === 'es' ? 'es' : 'en'])))
  }
  useEffect(() => {
    if (!canOpenGcProjects(role) || !loaded || loaded.projects.length === 0) return
    let live = true
    loadGcBoardRows(loaded.projects, today, { money: canSeeGcMoney(role) })
      .then((rows) => {
        if (!live) return
        takeRows(rows)
        setBoardProblem(null)
      })
      .catch((e) => {
        if (live) setBoardProblem(formatErrorMessage(e, 'The board did not load.'))
      })
    return () => {
      live = false
    }
  }, [role, loaded, today])
  // Our own crew's percent from its Pipeline job (Building's U8): read for a dev and the money team (O9's gate, gc 5's
  // ask) and laid over the board itself, so every window reads one percent, the Schedule's among them (call 12).
  const crewLinks = useMemo<CrewJobLink[]>(
    () => (loaded ? loaded.projects.flatMap((p) => p.trades.flatMap((t) => (t.ours && t.jobLedgerId ? [{ packageId: t.id, jobId: t.jobLedgerId }] : []))) : []),
    [loaded],
  )
  const [crewReads, setCrewReads] = useState<CrewJobRead[]>([])
  useEffect(() => {
    if (!canUseGcBuilding(role) && !canSeeGcMoney(role)) return
    let live = true
    loadCrewJobs(crewLinks)
      .then((reads) => {
        if (live) setCrewReads(reads)
      })
      .catch((e) => {
        if (live) setBoardProblem(formatErrorMessage(e, 'Our own crew’s Pipeline jobs did not load.'))
      })
    return () => {
      live = false
    }
  }, [crewLinks, role])
  const board = useMemo(() => (boardRead ? withCrewPercents(boardRead, crewReads) : null), [boardRead, crewReads])
  // What the Schedule reads over the board (its PR 16): the job's daily logs and our crew's clock-ins, Building's, for
  // whoever may use Building; Ask for the days and the money lines for the money team; the trades' percents behind the
  // draws gate (O9). Memoized, since a new one reads the schedule again.
  const scheduleReads = useMemo<ScheduleReads>(
    () => ({ logs: canUseGcBuilding(role), money: canSeeGcMoney(role), draws: canUseGcBuilding(role) || canSeeGcMoney(role), today }),
    [role, today],
  )
  /** Each linked trade our own crew does, by its id, to its Pipeline job's number (null until read). */
  const crewJobLabels = useMemo(
    () => Object.fromEntries(crewLinks.map((l) => [l.packageId, crewReads.find((r) => r.packageId === l.packageId)?.label ?? null])),
    [crewLinks, crewReads],
  )
  const openProjectCard = (projectId: string) => document.querySelector(`[data-gc-project="${projectId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  // Trade partners (the Board's B3-b) and Follow up (B4-b) sit beside the board for a dev: each write reads the rows again.
  // `?view=followUp` (the Dashboard's Needs you line, v2.4941) opens on Follow up.
  const [devView, setDevView] = useState<'board' | 'partners' | 'followUp' | 'money'>(() => gcViewFromSearch(params))
  /** Read the board again; answers what it read, for a press that emails from the rows as they are now (P5c-4). */
  const refreshBoard = async (): Promise<GcState | null> => {
    if (!loaded) return null
    const rows = await loadGcBoardRows(loaded.projects, today, { money: canSeeGcMoney(role) })
    takeRows(rows)
    return boardStateFromRows(rows)
  }
  // What a trade carries sits on the trade (`gc_trade_packages`), which only the projects' load reads.
  // A new `loaded` reloads the board too (the effect above).
  const reloadProjects = async () => {
    const projects = await loadGcProjects()
    setLoaded((was) => (was ? { ...was, projects } : was))
  }
  // The Ask window (the Board's B4-a): a job's trade, with these companies ticked. Unset: everyone in range.
  const [asking, setAsking] = useState<{ projectId: string; packageId: string; tick?: string[] } | null>(null)
  const openAsk = (projectId: string, packageId: string, tick?: string[]) => setAsking({ projectId, packageId, ...(tick ? { tick } : {}) })
  // Compare quotes (the Board's B5-b): one trade's quotes side by side, and what it carries.
  const [comparing, setComparing] = useState<{ projectId: string; packageId: string } | null>(null)
  const compareWrites: CompareWrites = {
    setPlugs: async (inviteId, plugs) => {
      await setGcAskPlugs(inviteId, plugs)
      await refreshBoard()
    },
    setCovers: async (inviteId, covers) => {
      await setGcAskExclusionCovers(inviteId, covers)
      await refreshBoard()
    },
    setTakenAlternates: async (inviteId, labels) => {
      await setGcAskTakenAlternates(inviteId, labels)
      await refreshBoard()
    },
    carry: async (packageId, carry) => {
      await carryGcTrade(packageId, carry)
      await reloadProjects()
    },
    // Award (B6-a-ii): a dev's only while the Board is built, as `gc_award` says. It writes the trade, so the projects reload.
    ...(role === 'dev'
      ? {
          award: async (inviteId: string, estimatorId: string | null) => {
            await awardGcTrade(inviteId, estimatorId)
            await reloadProjects()
          },
        }
      : {}),
  }
  // A trade's statement of work (B6-a-ii): Send marks it sent, and emails it when asked (the box shows once the
  // Portal's sign screen is live). A refused email is said after the board reads the send.
  const sowWrites: SowWrites = {
    send: async (packageId, email) => {
      const sowId = await sendGcSow(packageId, today)
      let refused: string | null = null
      if (email && canSendGcTradeEmail(role) && board) {
        const project = board.projects.find((p) => p.packages.some((k) => k.id === packageId))
        const pkg = project?.packages.find((k) => k.id === packageId)
        const companyId = pkg?.invites.find((i) => i.id === pkg.awardedInviteId)?.partnerId
        const req = project && companyId ? sowEmailRequest(board, project.id, packageId, sowId, langs[companyId] ?? 'en') : null
        const answer = req ? await sendGcTradeEmail(req) : null
        if (answer && !answer.ok) refused = `Sent to their portal. The email did not go: ${gcTradeEmailRefusal(answer.key)}`
      }
      await refreshBoard()
      if (refused) throw new Error(refused)
    },
  }
  // Our number (the Board's B5-c), opened on a project's card for the money team; its inputs reload the board.
  const [numberOpen, setNumberOpen] = useState<string | null>(null)
  const saveMoney = async (projectId: string, values: { generalConditions: number; contingencyPct: number; feePct: number }) => {
    await setGcProjectMoney(projectId, values)
    await refreshBoard()
  }
  // Our own work's Pipeline jobs (Owner Billing's O11b and O11a): the job general conditions are spent on, named on Our
  // number, and each crew trade's (U8's links), read the Costs tab's own way for the money team, so Money's margin and
  // Closeout count what they really cost. Labor dollars only with pay access (loadOwnWorkCosts asks); a failed read
  // leaves them at their price and budget.
  const nameGcJob = async (projectId: string, jobId: string | null) => {
    await setGcGeneralConditionsJob(projectId, jobId)
    await refreshBoard()
  }
  const crewJobs = useMemo(() => Object.fromEntries(crewLinks.map((l) => [l.packageId, l.jobId])), [crewLinks])
  const ownWorkKey = useMemo(() => (board && canSeeGcMoney(role) ? ownWorkJobIds(board.projects, crewJobs).sort().join(',') : ''), [board, role, crewJobs])
  const [ownWorkRead, setOwnWorkRead] = useState<OwnWorkCosts | undefined>(undefined)
  useEffect(() => {
    if (!ownWorkKey) {
      setOwnWorkRead(undefined)
      return
    }
    const ids = ownWorkKey.split(',')
    let live = true
    loadOwnWorkCosts(ids)
      .then((read) => {
        if (live) setOwnWorkRead(read)
      })
      .catch(() => {
        if (live) setOwnWorkRead({ payAccess: true, byJob: Object.fromEntries(ids.map((id) => [id, 'error' as const])) })
      })
    return () => {
      live = false
    }
  }, [ownWorkKey])
  // What the margin reads: the spend, and which Pipeline job each crew trade runs on. The money team's alone. While the
  // read is out, the links stand with no spend, so a linked crew says it waits for its job rather than that it has none.
  const ownWork = useMemo<OwnWorkCosts | undefined>(() => {
    if (!canSeeGcMoney(role) || !ownWorkKey) return undefined
    return ownWorkRead ? { ...ownWorkRead, crewJobs } : { payAccess: true, byJob: {}, crewJobs }
  }, [ownWorkRead, ownWorkKey, crewJobs, role])
  // Each project's general conditions job, for the pickers that hold a job once (U8's and Our number's). Only the money
  // team's board carries them.
  const gcJobsOf = useMemo(() => Object.fromEntries((board?.projects ?? []).filter((p) => p.generalConditionsJobId).map((p) => [p.id, p.generalConditionsJobId ?? null])), [board])
  const ownWorkLabel = (jobId: string | null | undefined): string | null => {
    const read = jobId ? ownWork?.byJob[jobId] : undefined
    return read && read !== 'error' ? read.label : null
  }
  // Bid tabs (the Board's B5-d), opened on a project's card for a dev; sharing reloads the board.
  const [tabsOpen, setTabsOpen] = useState<string | null>(null)
  const shareTab = async (packageId: string, showNames: boolean) => {
    await shareGcBidTab(packageId, showNames)
    await refreshBoard()
  }
  // How a bid ends (B5-c): each writes gc_projects, so the projects load again and the board after them.
  const outcomeWrites = (projectId: string): OutcomeWrites => ({
    bidSent: async () => {
      await markGcBidSent(projectId)
      await reloadProjects()
    },
    won: async () => {
      await markGcWon(projectId)
      await reloadProjects()
    },
    lost: async (why, wonBy, note) => {
      await markGcLost(projectId, why, wonBy, note)
      await reloadProjects()
    },
    bringBack: async () => {
      await bringGcBack(projectId)
      await reloadProjects()
    },
  })
  // The company window (the Board's B3-c): a company's name opens it wherever the name shows, for the GC office (door 2).
  const [companyId, setCompanyId] = useState<string | null>(null)
  // Where it opens (B6-b-ii's follow-up): a tab and a paper with its send, as a not-ready bar on the schedule asks.
  const [companyAt, setCompanyAt] = useState<CompanyAt | null>(null)
  const companyOpener: CompanyOpener | null =
    canOpenGcProjects(role) && board
      ? {
          openPartner: (id, at) => {
            setCompanyId(id)
            setCompanyAt(at ?? null)
          },
        }
      : null
  const openCompany = companyId && board ? (board.partners.find((p) => p.id === companyId) ?? null) : null
  // The customer's window (the Board's B6-d-ii): a dev's while the Board is built, opened from Get started's contract
  // row and the board's customer names. Our contract's send goes with Our number's price by line, so it needs that read.
  const [customerWin, setCustomerWin] = useState<{ id: string; at: CustomerAt | null } | null>(null)
  const customerOpener: CustomerOpener | null = canUseGcBoardWrites(role) && board ? { openCustomer: (id, at) => setCustomerWin({ id, at: at ?? null }) } : null
  const openCustomer = customerWin && board ? (board.customers.find((c) => c.id === customerWin.id) ?? null) : null
  // With its tick (B6-d-iii-b), the send emails them: their portal link made first if they have none (call D6, the
  // merged link, as every door makes one), then gc-customer-email's contract kind, which attaches the send's own file.
  // A refusal is said after the board reads the send, which stays on record either way.
  const sendContract =
    canUseGcBoardWrites(role) && canSeeGcMoney(role) && moneyShown
      ? async (projectId: string, input: ContractSendInput): Promise<ContractSendOutcome> => {
          // Email it now (Owner Billing's call): the newest send as it is, emailed with nothing sent anew.
          const sendId = input.sendId ?? (await sendGcOwnerContract({ projectId, ...input }))
          let outcome: ContractSendOutcome = { words: 'On record with its price and file. No email went: they find it when they open their portal.' }
          const project = board?.projects.find((x) => x.id === projectId)
          if (input.email && board && project) {
            try {
              await mintCustomerPortalLink(project.customerId, 'all')
              const mail = contractMail(contractMailFacts(board, project, { mode: input.mode, price: input.total, signBy: input.signBy, note: input.note }))
              const answer = await sendGcCustomerEmail({ projectId, kind: 'contract', sourceId: sendId, subject: mail.subject, lines: mail.lines, pdf: null })
              if (answer.ok) outcome = { words: `On record, and sent to ${answer.to || answer.email}.` }
              else {
                const why = gcCustomerEmailRefusal(answer.key)
                outcome = { words: `On record. The email did not go: ${why}`, notEmailed: why }
              }
            } catch (e) {
              const why = `Their portal link was not made: ${formatErrorMessage(e, 'try again')}`
              outcome = { words: `On record. No email went. ${why}`, notEmailed: why }
            }
          }
          await refreshBoard()
          return outcome
        }
      : undefined
  // The Contract Book's entries a company is sent (B6-b-ii), read once someone who writes the Board opens a company.
  const [paperEntries, setPaperEntries] = useState<CompanyPaperEntries | null>(null)
  useEffect(() => {
    if (!openCompany || !canUseGcBoardWrites(role) || paperEntries) return
    let live = true
    loadCompanyPaperEntries()
      .then((e) => live && setPaperEntries(e))
      .catch(() => live && setPaperEntries({ msa: null, w9: null }))
    return () => {
      live = false
    }
  }, [openCompany, role, paperEntries])
  const partnerWrites: TradePartnerWrites = {
    addCompany: async (draft) => {
      await addGcCompany(draft)
      await refreshBoard()
    },
    vetCompany: async (companyId, status, limit, note) => {
      await vetGcCompany(companyId, status, limit, note)
      await refreshBoard()
    },
    setCoverage: async (companyId, address, maxMiles) => {
      await setGcCompanyCoverage(companyId, address, maxMiles)
      await refreshBoard()
    },
  }
  const askWrites: AskWrites = {
    logContact: async (ask, how, note, promisedBy) => {
      await logGcAskContact({ ...ask, on: today, byName: profileName ?? '', how, note, promisedBy })
      await refreshBoard()
    },
    decline: async (inviteId, why, reason, note) => {
      await declineGcAsk(inviteId, why, reason, note)
      await refreshBoard()
    },
  }
  // Who else? on a Follow up card: Trade partners, at that trade's card.
  const showTrade = (trade: string) => {
    setDevView('partners')
    requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(benchAnchor(trade))?.scrollIntoView({ behavior: 'smooth', block: 'start' })))
  }
  // Follow up's badge is the one count (the Board's B2b-ii-b, call E1): everyone we wait on, once a person across their
  // jobs, as the Dashboard's Follow up line reads it from these same rows. Each board row shows its job's share.
  const toCall = board ? allPeople(board).count : 0
  const devPill = (view: 'board' | 'partners' | 'followUp' | 'money', label: string) => {
    const on = devView === view
    return (
      <button
        type="button"
        aria-pressed={on}
        onClick={() => setDevView(view)}
        style={{
          padding: '0.3rem 0.8rem',
          borderRadius: 999,
          border: `1px solid ${on ? 'var(--text-blue-500)' : 'var(--border-strong)'}`,
          background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
          color: on ? 'var(--text-blue-500)' : 'var(--text-600)',
          fontWeight: on ? 600 : 400,
          cursor: 'pointer',
          fontSize: '0.85rem',
        }}
      >
        {label}
      </button>
    )
  }

  // The walk shows once the page has loaded, so a stop never points at a card still loading. Its
  // stops are read from the page after that render: an anchor not on it drops out unless the stop
  // says what will show there.
  const tourShowing = tourOpen !== null && loaded !== null
  const [tourSteps, setTourSteps] = useState<SpotlightTourStep[] | null>(null)
  useEffect(() => {
    if (!tourShowing || !tourOpen) {
      setTourSteps(null)
      return
    }
    const steps = spotlightTourStepsPresent(GC_NEW_HERE_STEPS)
    tourFurthest.current = 0
    setTourSteps(steps)
    try {
      window.localStorage.setItem(GC_NEW_HERE_SEEN_KEY, '1')
    } catch {
      // No storage: the walk may open itself again next visit.
    }
    recordNavClick(user?.id, role, GC_NEW_HERE_CONTROL, gcNewHereTarget({ kind: 'opened', by: tourOpen, of: steps.length }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourShowing])
  const closeTour = () => {
    if (tourSteps) recordNavClick(user?.id, role, GC_NEW_HERE_CONTROL, gcNewHereTarget({ kind: 'closed', furthest: tourFurthest.current, of: tourSteps.length }))
    setTourOpen(null)
  }

  const bookInput = useMemo<ScopeBookInput | null>(
    () => (loaded ? { projects: loaded.projects, store: loaded.store, pastJobs: [], today } : null),
    [loaded, today],
  )
  const book = useMemo(() => (bookInput ? scopeBook(bookInput) : []), [bookInput])

  // `?focus=<id>` (v2.4846, `gcProjectHref`): a GC project opened from elsewhere, such as the
  // Projects page, scrolls to its card and is outlined for two seconds.
  const focusId = gcFocusFromSearch(params)
  useEffect(() => {
    if (!loaded || !focusId) return
    const card = document.querySelector<HTMLElement>(`[data-gc-project="${CSS.escape(focusId)}"]`)
    if (!card) return
    // A card can be taller than the screen: its top comes into view, below the app's top bar.
    card.style.scrollMarginTop = '5rem'
    card.scrollIntoView({ block: 'start' })
    card.style.outline = '2px solid var(--text-violet-700)'
    const t = window.setTimeout(() => {
      card.style.outline = ''
    }, 2000)
    return () => window.clearTimeout(t)
  }, [loaded, focusId])

  // Change orders to the customer (Owner Billing's O3-ui): read beside the board for a dev, laid over
  // the board's projects (boardProjectFromView maps the rest), and opened at `changes=<projectId>`.
  const changesProjectId = params.get('changes')
  const [changeOrderRows, setChangeOrderRows] = useState<ChangeOrderRow[]>([])
  const [changeEmails, setChangeEmails] = useState<{ source_id: string; recipient_name: string | null; sent_at: string }[]>([])
  // The trades' asks for a change (O3b), and the day each email about one went to its company, by key.
  const [changeRequestRows, setChangeRequestRows] = useState<ChangeRequestRow[]>([])
  const [askEmails, setAskEmails] = useState<{ key: string; on: string }[]>([])
  const [changeBusy, setChangeBusy] = useState<string | null>(null)
  const [changeProblem, setChangeProblem] = useState<string | null>(null)
  const loadChangeOrders = useCallback(async () => {
    // Change orders are the money team's (the Owner Billing door): nobody else reads them.
    if (!board || !canSeeGcMoney(role)) return
    const projectIds = board.projects.map((p) => p.id)
    const rows = await loadGcChangeOrders(projectIds)
    setChangeOrderRows(rows)
    // Who each was emailed to (O4b-2), from its sent copies.
    setChangeEmails(await loadGcChangeOrderEmails(rows.map((r) => r.id)))
    // The asks are dev only until the trade wave (P4a's policy), so anyone else reads none.
    const asks = await loadGcChangeRequests(projectIds)
    setChangeRequestRows(asks)
    setAskEmails(await loadGcChangeRequestEmails(asks.map((r) => r.id)))
  }, [board, role])
  useEffect(() => {
    void loadChangeOrders().catch((e) => setChangeProblem(formatErrorMessage(e, 'The change orders did not load.')))
  }, [loadChangeOrders])
  // The trades' draws (Building's U6b), read for every job on the board so Money, Bill the customer and Closeout read the
  // same draws the Draws window shows. A dev writes them while Building is built; the money team reads them since O9, so
  // a leader's or the controller's bill bills each trade's reported work. Anyone else reads none.
  const [drawTables, setDrawTables] = useState<DrawTables>(NO_DRAWS)
  const [drawProblem, setDrawProblem] = useState<string | null>(null)
  const loadDraws = useCallback(async (): Promise<DrawTables> => {
    if (!board || !(canUseGcBuilding(role) || canSeeGcMoney(role))) return NO_DRAWS
    const tables = await loadGcDraws(board.projects.flatMap((p) => p.packages.map((k) => k.id)))
    setDrawTables(tables)
    return tables
  }, [board, role])
  useEffect(() => {
    void loadDraws().catch((e) => setDrawProblem(formatErrorMessage(e, 'The draws did not load.')))
  }, [loadDraws])
  // The draws lie innermost, so the change orders' trade side (`withTradeChanges`) lands on the change orders
  // `withChangeOrders` lays over whole, and every reader of the board below reads the trades' money.
  const boardWithChanges = useMemo(
    () => (board ? withChangeRequests(withTradeChanges(withChangeOrders(withDraws(board, drawTables), changeOrderRows), drawTables), changeRequestRows) : null),
    [board, drawTables, changeOrderRows, changeRequestRows],
  )
  const changesProject = changesProjectId ? (boardWithChanges?.projects.find((p) => p.id === changesProjectId) ?? null) : null
  const changeEmailed = useMemo(() => {
    const out: Record<string, { to: string; on: string }[]> = {}
    for (const e of changeEmails) (out[e.source_id] ??= []).push({ to: e.recipient_name ?? '', on: calendarYmdInAppTzFromIso(e.sent_at) })
    return out
  }, [changeEmails])
  const askEmailed = useMemo(() => Object.fromEntries(askEmails.map((e) => [e.key, e.on])), [askEmails])
  const setChangesWindow = (projectId: string | null) => {
    const next = new URLSearchParams(params)
    if (projectId) next.set('changes', projectId)
    else next.delete('changes')
    setParams(next, { replace: true })
    setChangeProblem(null)
  }
  /** A change order write: run it, read the change orders again, and say the problem in the window if there is one. */
  const changeWrite = (id: string, work: Promise<unknown>, failed: string) => {
    setChangeBusy(id)
    setChangeProblem(null)
    void work
      .then(() => loadChangeOrders())
      .catch((e) => setChangeProblem(formatErrorMessage(e, failed)))
      .finally(() => setChangeBusy(null))
  }
  /** A write that also emails (O3b): the words it returns, an email that did not go, are said after the read. */
  const changeWriteSaying = (id: string, work: () => Promise<string | null>, failed: string) => {
    setChangeBusy(id)
    setChangeProblem(null)
    void (async () => {
      try {
        const said = await work()
        await loadChangeOrders()
        if (said) setChangeProblem(said)
      } catch (e) {
        setChangeProblem(formatErrorMessage(e, failed))
      } finally {
        setChangeBusy(null)
      }
    })()
  }
  /**
   * Tell a company where its ask for a change stands (O3b), once a stage: null when the email went or went before, else
   * the words for the window.
   */
  const tellAsk = async (
    state: GcState,
    project: GcProject,
    request: TradeChangeRequest,
    stage: ChangeAskEmailStage,
    changeOrder: { number: number; cost: number } | null = null,
  ): Promise<string | null> => {
    const trade = project.packages.find((k) => k.id === request.packageId)?.trade ?? ''
    const answer = await emailChangeAsk({ projectId: project.id, project: project.name, trade, request, stage, changeOrder })
    if (!answer || answer.ok) return null
    return `${partnerById(state, request.partnerId)?.company ?? 'The company'} did not get the email. ${gcTradeEmailRefusal(answer.key)}`
  }

  // The daily log (Building's U3a-ii): read beside the board for a dev, laid over the board's projects
  // (boardProjectFromView maps the rest), and opened at `log=<projectId>`. A save writes no gc_projects
  // row, so only the logs are read again.
  const logProjectId = params.get('log')
  const [dailyLogRows, setDailyLogRows] = useState<DailyLogRow[]>([])
  const [logBusy, setLogBusy] = useState(false)
  const [logProblem, setLogProblem] = useState<string | null>(null)
  // Our own crew's clock-ins (Building's U8): for a job with a linked crew, from its first day to today, read with the
  // logs and laid in right after them, so the log window and the chart read one count.
  const [crewRows, setCrewRows] = useState<CrewOnSiteRow[]>([])
  const loadDailyLogs = useCallback(async () => {
    // Building is a dev's while it is built (canUseGcBuilding): nobody else reads its tables.
    if (!boardRead || !canUseGcBuilding(role)) return
    const building = boardRead.projects.filter((p) => p.stage === 'building')
    setDailyLogRows(await loadGcDailyLogs(building.map((p) => p.id)))
    const linked = new Set(crewLinks.map((l) => l.packageId))
    const counted = building.flatMap((p) => (p.startedOn && p.packages.some((k) => linked.has(k.id)) ? [{ id: p.id, from: p.startedOn }] : []))
    setCrewRows((await Promise.all(counted.map((p) => loadGcCrewOnSite(p.id, p.from, today)))).flat())
  }, [boardRead, role, crewLinks, today])
  useEffect(() => {
    void loadDailyLogs().catch((e) => setLogProblem(formatErrorMessage(e, 'The daily logs did not load.')))
  }, [loadDailyLogs])
  const boardWithLogs = useMemo(() => (board ? withCrewClockIns(withDailyLogs(board, dailyLogRows), crewRows) : null), [board, dailyLogRows, crewRows])
  const logProject = logProjectId ? (boardWithLogs?.projects.find((p) => p.id === logProjectId) ?? null) : null
  const setLogWindow = (projectId: string | null) => {
    const next = new URLSearchParams(params)
    if (projectId) next.set('log', projectId)
    else next.delete('log')
    setParams(next, { replace: true })
    setLogProblem(null)
  }
  /** A day's log saved, then the logs read again. False keeps the window's form as typed, the problem above it. */
  const saveLog = async (projectId: string, log: Omit<DailyLog, 'writtenOn'>): Promise<boolean> => {
    setLogBusy(true)
    setLogProblem(null)
    try {
      await saveGcDailyLog(dailyLogPayload(projectId, log, today))
      await loadDailyLogs()
      return true
    } catch (e) {
      setLogProblem(formatErrorMessage(e, 'The daily log was not saved.'))
      return false
    } finally {
      setLogBusy(false)
    }
  }

  // The weekly report (Building's U7c): a card on the Daily log window. When the window opens it reads what the report
  // reads: the job's sent reports, submittals and schedule, and for the money team its customer's bills (the late
  // finish's words); the logs and the change orders are on the page already. Each send reads the reports again.
  const [weeklyRows, setWeeklyRows] = useState<{ id: string; rows: WeeklyReportRow[] } | null>(null)
  const [weeklyRead, setWeeklyRead] = useState<{ id: string; submittals: SubmittalTables; schedule: GcProject['schedule'] | null; bills: BillingRows | null } | null>(null)
  const loadWeekly = useCallback(async () => {
    if (!logProjectId || !canUseGcBuilding(role)) return
    setWeeklyRows({ id: logProjectId, rows: await loadGcWeeklyReports([logProjectId]) })
  }, [logProjectId, role])
  useEffect(() => {
    void loadWeekly().catch((e) => setLogProblem(formatErrorMessage(e, 'The weekly reports did not load.')))
  }, [loadWeekly])
  useEffect(() => {
    if (!logProjectId || !board || !canUseGcBuilding(role)) return
    let live = true
    Promise.all([loadGcSubmittals([logProjectId]), loadSchedule(board, logProjectId).catch(() => null), canSeeGcMoney(role) ? loadGcBillingRows([logProjectId]) : Promise.resolve(null)])
      .then(([submittals, read, bills]) => {
        if (live) setWeeklyRead({ id: logProjectId, submittals, schedule: read?.project.schedule ?? null, bills })
      })
      .catch((e) => {
        if (live) setLogProblem(formatErrorMessage(e, 'What the weekly report reads did not load.'))
      })
    return () => {
      live = false
    }
  }, [logProjectId, board, role])
  const weeklyState = useMemo(() => {
    if (!boardWithLogs || !logProjectId) return null
    let s = withChangeOrders(boardWithLogs, changeOrderRows)
    if (weeklyRead && weeklyRead.id === logProjectId) {
      s = withSubmittals(s, weeklyRead.submittals)
      if (weeklyRead.bills) s = billingStateFor(s, logProjectId, weeklyRead.bills)
      s = withSchedules(s, new Map([[logProjectId, weeklyRead.schedule]]))
    }
    return weeklyRows && weeklyRows.id === logProjectId ? withWeeklyReports(s, weeklyRows.rows) : s
  }, [boardWithLogs, logProjectId, changeOrderRows, weeklyRead, weeklyRows])
  const weeklyProject = logProjectId ? (weeklyState?.projects.find((p) => p.id === logProjectId) ?? null) : null
  /** A company row not sent yet that this send goes again on, else a new one. */
  const weeklyRowFor = async (s: WeeklyReportSend): Promise<string> => weeklyReportRetryRow(weeklyRows?.id === s.projectId ? weeklyRows.rows : [], s)?.id ?? recordWeeklyReport(s, today)
  const weeklyWrites: WeeklyReportWrites = {
    onSentFromMe: (s) => {
      void recordWeeklyReport(s, today)
        .then(loadWeekly)
        .catch((e) => setLogProblem(formatErrorMessage(e, 'The weekly report was not kept.')))
    },
    onSendFromCompany: async (s) => {
      const answer = await sendWeeklyReport(s, await weeklyRowFor(s))
      await loadWeekly()
      return answer
    },
    onTest: async (s) => {
      const answer = await sendWeeklyReport(s, await weeklyRowFor(s), true)
      await loadWeekly()
      return answer
    },
  }

  // The punch list (Building's U3b-ii): a dev's on a job being built, opened at `punch=<projectId>`, behind Building's gate
  // alone, since at Building's door it goes to the schedule's team while Closeout stays the money team's. It reads the
  // job's punch list when the window opens. Closeout shows the same lists and reads them with its own.
  const punchProjectId = params.get('punch')
  const [punchRowsRead, setPunchRowsRead] = useState<{ id: string; rows: PunchRow[] } | null>(null)
  const [punchBusy, setPunchBusy] = useState<string | null>(null)
  const [punchProblem, setPunchProblem] = useState<string | null>(null)
  const loadPunch = useCallback(async () => {
    if (!punchProjectId || !canUseGcBuilding(role)) return
    setPunchRowsRead({ id: punchProjectId, rows: await loadGcPunch([punchProjectId]) })
  }, [punchProjectId, role])
  useEffect(() => {
    void loadPunch().catch((e) => setPunchProblem(formatErrorMessage(e, 'The punch list did not load.')))
  }, [loadPunch])
  const punchBoard = useMemo(
    () => (board && punchProjectId ? withPunch(board, punchRowsRead && punchRowsRead.id === punchProjectId ? punchRowsRead.rows : []) : null),
    [board, punchProjectId, punchRowsRead],
  )
  const punchProject = punchProjectId ? (punchBoard?.projects.find((p) => p.id === punchProjectId) ?? null) : null
  const setPunchWindow = (projectId: string | null) => {
    const next = new URLSearchParams(params)
    if (projectId) next.set('punch', projectId)
    else next.delete('punch')
    setParams(next, { replace: true })
    setPunchProblem(null)
  }
  /** The punch list's presses for a window: each runs, then that window's own reads run again, and a refusal shows there. */
  const punchWritesFor = (setBusy: (id: string | null) => void, setProblem: (problem: string | null) => void, reread: () => Promise<unknown>): PunchWrites => {
    const run = (busyId: string, work: () => Promise<unknown>, failed: string) => {
      setBusy(busyId)
      setProblem(null)
      void work()
        .then(reread)
        .catch((e) => setProblem(formatErrorMessage(e, failed)))
        .finally(() => setBusy(null))
    }
    return {
      onAdd: (packageId, item) => run(packageId, () => addPunchItem(packageId, item), 'The item was not added.'),
      onRemove: (itemId) => run(itemId, () => removePunchItem(itemId), 'The item was not taken off.'),
      onFixedIn: (itemId) => run(itemId, () => punchFixedIn(itemId), 'The item was not recorded fixed.'),
      onCheck: (itemId, fixed, note) => run(itemId, () => checkPunchItem(itemId, fixed, note), fixed ? 'The item was not checked.' : 'The item was not sent back.'),
    }
  }

  // The submittal register (Building's U4b): a dev's on a job being built, opened at `submittals=<projectId>`. It reads the
  // job's register and its schedule when the window opens, so a submittal is needed by the first start of the work it
  // holds. A press writes no gc_projects row, so only the register and the schedule are read again.
  const submittalsProjectId = params.get('submittals')
  const [submittalTables, setSubmittalTables] = useState<SubmittalTables>({ submittals: [], holds: [], rounds: [] })
  const [submittalRead, setSubmittalRead] = useState<ScheduleRead | null>(null)
  const [submittalBusy, setSubmittalBusy] = useState<string | null>(null)
  const [submittalProblem, setSubmittalProblem] = useState<string | null>(null)
  const loadSubmittals = useCallback(async () => {
    if (!board || !canUseGcBuilding(role) || !submittalsProjectId) return
    const tables = await loadGcSubmittals([submittalsProjectId])
    setSubmittalTables(tables)
    setSubmittalRead(await loadSchedule(withSubmittals(board, tables), submittalsProjectId))
  }, [board, role, submittalsProjectId])
  useEffect(() => {
    void loadSubmittals().catch((e) => setSubmittalProblem(formatErrorMessage(e, 'The submittals did not load.')))
  }, [loadSubmittals])
  const setSubmittalsWindow = (projectId: string | null) => {
    const next = new URLSearchParams(params)
    if (projectId) next.set('submittals', projectId)
    else next.delete('submittals')
    setParams(next, { replace: true })
    setSubmittalProblem(null)
  }
  /** A submittal press: run it, read the register again, and say the problem in the window if there is one. */
  const submittalWrite = (id: string, work: Promise<unknown>, failed: string) => {
    setSubmittalBusy(id)
    setSubmittalProblem(null)
    void work
      .then(() => loadSubmittals())
      .catch((e) => setSubmittalProblem(formatErrorMessage(e, failed)))
      .finally(() => setSubmittalBusy(null))
  }

  // RFIs (Building's U5b): a dev's on a job being built, opened at `rfis=<projectId>`. It reads the job's RFIs and its
  // schedule when the window opens, so an RFI is needed before the first start of the work it holds. The change orders
  // are laid over as they are read, so a started one reads by its number for the money team, who alone read them.
  const rfisProjectId = params.get('rfis')
  const [rfiTables, setRfiTables] = useState<RfiTables>({ rfis: [], holds: [] })
  const [rfiRead, setRfiRead] = useState<ScheduleRead | null>(null)
  const [rfiBusy, setRfiBusy] = useState<string | null>(null)
  const [rfiProblem, setRfiProblem] = useState<string | null>(null)
  const loadRfis = useCallback(async () => {
    if (!board || !canUseGcBuilding(role) || !rfisProjectId) return
    const tables = await loadGcRfis([rfisProjectId])
    setRfiTables(tables)
    setRfiRead(await loadSchedule(withRfis(board, tables), rfisProjectId))
  }, [board, role, rfisProjectId])
  useEffect(() => {
    void loadRfis().catch((e) => setRfiProblem(formatErrorMessage(e, 'The RFIs did not load.')))
  }, [loadRfis])
  const rfiView = useMemo(() => {
    if (!rfiRead || rfiRead.project.id !== rfisProjectId) return null
    const state = withChangeOrders(rfiRead.state, changeOrderRows)
    return { state, project: state.projects.find((p) => p.id === rfiRead.project.id) ?? rfiRead.project }
  }, [rfiRead, rfisProjectId, changeOrderRows])
  const setRfisWindow = (projectId: string | null) => {
    const next = new URLSearchParams(params)
    if (projectId) next.set('rfis', projectId)
    else next.delete('rfis')
    setParams(next, { replace: true })
    setRfiProblem(null)
  }
  /** An RFI press: run it, read the RFIs again, and say the problem in the window if there is one. */
  const rfiWrite = (id: string, work: Promise<unknown>, failed: string) => {
    setRfiBusy(id)
    setRfiProblem(null)
    void work
      .then(() => loadRfis())
      .catch((e) => setRfiProblem(formatErrorMessage(e, failed)))
      .finally(() => setRfiBusy(null))
  }

  // Draws (Building's U6b): the trades' money on a job being built, opened at `draws=<projectId>`, and at a back-charge
  // with `&charge=<id>`, for a dev on the money team. Each press reads the draws again. It emails the trade only with
  // the window's tick on, which starts off (the sends start off), and from the rows just read.
  const drawsProjectId = params.get('draws')
  const drawsChargeId = params.get('charge')
  const drawsProject = drawsProjectId ? (boardWithChanges?.projects.find((p) => p.id === drawsProjectId) ?? null) : null
  const [drawBusy, setDrawBusy] = useState<string | null>(null)
  const [drawEmailOn, setDrawEmailOn] = useState(false)
  /** Our own crew's Pipeline job, picked on Draws (Building's U8): a dev's while Building is built. A link reads the trades again. */
  const ownCrewWrites = useMemo<OwnCrewWrites>(
    () => ({
      onLink: async (packageId, jobId) => {
        setDrawBusy(packageId)
        setDrawProblem(null)
        try {
          await linkCrewJob(packageId, jobId)
          const projects = await loadGcProjects()
          setLoaded((was) => (was ? { ...was, projects } : was))
          return true
        } catch (e) {
          setDrawProblem(formatErrorMessage(e, 'Our crew’s Pipeline job was not saved.'))
          return false
        } finally {
          setDrawBusy(null)
        }
      },
      onSearch: searchCrewJobs,
      onSuggest: (packageId) => {
        const project = loaded?.projects.find((p) => p.trades.some((t) => t.id === packageId))
        const trade = project?.trades.find((t) => t.id === packageId)
        return project && trade ? suggestCrewJobs(project.id, trade.ownBidId) : Promise.resolve([])
      },
    }),
    [loaded],
  )
  const setDrawsWindow = (projectId: string | null) => {
    const next = new URLSearchParams(params)
    if (projectId) next.set('draws', projectId)
    else {
      next.delete('draws')
      next.delete('charge')
    }
    setParams(next, { replace: true })
    setDrawProblem(null)
  }
  /**
   * A draw press: run it, read the draws again, then send the email it makes from the fresh rows when the tick is on.
   * A refused email is said in the window after the press is saved.
   */
  const drawWrite = <T,>(busyId: string, packageId: string, work: Promise<T>, failed: string, email?: (project: GcProject, to: DrawEmailTo, done: T) => DrawEmail | null) => {
    setDrawBusy(busyId)
    setDrawProblem(null)
    void work
      .then(async (done) => {
        const tables = await loadDraws()
        if (!email || !drawEmailOn || !canSendGcTradeEmail(role) || !board || !drawsProjectId) return
        const state = withTradeChanges(withChangeOrders(withDraws(board, tables), changeOrderRows), tables)
        const project = state.projects.find((p) => p.id === drawsProjectId)
        const to = project ? drawEmailFor(project, packageId) : null
        if (!project || !to) return
        const answer = await emailTheTrade(to.companyId, (lang) => email(project, { ...to, lang }, done))
        if (answer && !answer.ok) throw new Error(`It is saved. The email did not go: ${gcTradeEmailRefusal(answer.key)}`)
      })
      .catch((e) => setDrawProblem(formatErrorMessage(e, failed)))
      .finally(() => setDrawBusy(null))
  }
  const sowOf = (project: GcProject, packageId: string) => project.packages.find((k) => k.id === packageId)?.sow
  const drawOf = (project: GcProject, packageId: string, drawId: string) => sowOf(project, packageId)?.draws.find((d) => d.id === drawId)
  const chargeOf = (project: GcProject, packageId: string, chargeId: string) => sowOf(project, packageId)?.backCharges?.find((c) => c.id === chargeId)

  // Closeout (Building's U6d): each trade's last steps and closing the job, opened at `closeout=<projectId>` for a dev on
  // the money team. It reads the customer's bills, since their retainage on us opens the trades', and the job's punch
  // list, which holds Accept the work. Both lie over the board with the draws. Each press reads again what it wrote.
  const closeoutProjectId = params.get('closeout')
  const [closeoutBills, setCloseoutBills] = useState<{ id: string; rows: BillingRows } | null>(null)
  const [closeoutPunch, setCloseoutPunch] = useState<{ id: string; rows: PunchRow[] } | null>(null)
  const [closeoutBusy, setCloseoutBusy] = useState<string | null>(null)
  const [closeoutProblem, setCloseoutProblem] = useState<string | null>(null)
  const loadCloseout = useCallback(async () => {
    if (!closeoutProjectId || !canUseGcBuilding(role) || !canSeeGcMoney(role)) return
    const [rows, punch] = await Promise.all([loadGcBillingRows([closeoutProjectId]), loadGcPunch([closeoutProjectId])])
    setCloseoutBills({ id: closeoutProjectId, rows })
    setCloseoutPunch({ id: closeoutProjectId, rows: punch })
  }, [closeoutProjectId, role])
  useEffect(() => {
    void loadCloseout().catch((e) => setCloseoutProblem(formatErrorMessage(e, 'The customer’s bills or the punch list did not load.')))
  }, [loadCloseout])
  const closeoutBillsRead = closeoutBills !== null && closeoutBills.id === closeoutProjectId
  // The waivers a trade signed in its portal, as the PDFs the portal filed (Portal P5a-2): read for the job whose Draws
  // or Closeout window is open, when it opens and again after each read of the draws. One that does not load links nothing.
  const waiverFilesFor = drawsProjectId ?? closeoutProjectId
  const [waiverFiles, setWaiverFiles] = useState<{ id: string; files: ReadonlyMap<string, WaiverFile[]> } | null>(null)
  useEffect(() => {
    if (!waiverFilesFor || !canUseGcBuilding(role) || !canSeeGcMoney(role)) return
    let live = true
    loadGcWaiverFiles(waiverFilesFor)
      .then((rows) => {
        if (live) setWaiverFiles({ id: waiverFilesFor, files: waiverFilesByDraw(rows) })
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [waiverFilesFor, drawTables, role])
  const openWaiverFiles = waiverFiles && waiverFiles.id === waiverFilesFor ? waiverFiles.files : NO_WAIVER_FILES
  const closeoutState = useMemo(() => {
    if (!boardWithChanges || !closeoutProjectId) return null
    const billed = closeoutBills && closeoutBills.id === closeoutProjectId ? billingStateFor(boardWithChanges, closeoutProjectId, closeoutBills.rows) : boardWithChanges
    return withPunch(billed, closeoutPunch && closeoutPunch.id === closeoutProjectId ? closeoutPunch.rows : [])
  }, [boardWithChanges, closeoutProjectId, closeoutBills, closeoutPunch])
  const closeoutProject = closeoutProjectId ? (closeoutState?.projects.find((p) => p.id === closeoutProjectId) ?? null) : null
  const setCloseoutWindow = (projectId: string | null) => {
    const next = new URLSearchParams(params)
    if (projectId) next.set('closeout', projectId)
    else next.delete('closeout')
    setParams(next, { replace: true })
    setCloseoutProblem(null)
  }
  /** From Closeout to Bill the customer, where the customer's payment of our retainage is recorded. */
  const closeoutToBill = (projectId: string) => {
    const next = new URLSearchParams(params)
    next.delete('closeout')
    next.set('bill', projectId)
    setParams(next, { replace: true })
    setBillProblem(null)
  }
  /**
   * A closeout press: run it, then read again the draws, the customer's bills and the punch list, and the board for an
   * acceptance or the projects for a closed job. When the Draws window's tick is on it emails the trade: a release marked
   * paid, and since the Portal's P5c-4 the work accepted and a final pay application that came in. Each email is built
   * from the rows read again (the board as just read for an acceptance) and keyed once per record.
   */
  const closeoutWrite = <T,>(
    busyId: string,
    work: Promise<T>,
    failed: string,
    reread: { board?: boolean; projects?: boolean } = {},
    mail?: { packageId: string; kind: 'paid'; drawId: string } | { packageId: string; kind: 'accepted' | 'finalIn' },
  ) => {
    setCloseoutBusy(busyId)
    setCloseoutProblem(null)
    void work
      .then(async (result) => {
        const [tables, , fresh] = await Promise.all([loadDraws(), loadCloseout(), reread.board ? refreshBoard() : null, reread.projects ? reloadProjects() : null])
        if (!mail || !drawEmailOn || !canSendGcTradeEmail(role) || !board || !closeoutProjectId) return
        const state = withTradeChanges(withChangeOrders(withDraws(fresh ?? board, tables), changeOrderRows), tables)
        const project = state.projects.find((p) => p.id === closeoutProjectId)
        const to = project ? drawEmailFor(project, mail.packageId) : null
        const sow = project ? sowOf(project, mail.packageId) : undefined
        if (!to || !sow) return
        // The paid release by its id; the final that came in by the id its verb answered.
        const drawId = mail.kind === 'paid' ? mail.drawId : String(result)
        const draw = sow.draws.find((d) => d.id === drawId)
        const build = (lang: PortalLang): DrawEmail | null =>
          mail.kind === 'accepted'
            ? acceptedEmail({ ...to, lang }, sow, retainageHeldNow(sow))
            : !draw
              ? null
              : mail.kind === 'paid'
                ? paidEmail({ ...to, lang }, draw)
                : finalInEmail({ ...to, lang }, draw)
        const answer = await emailTheTrade(to.companyId, build)
        if (answer && !answer.ok) throw new Error(`It is saved. The email did not go: ${gcTradeEmailRefusal(answer.key)}`)
      })
      .catch((e) => setCloseoutProblem(formatErrorMessage(e, failed)))
      .finally(() => setCloseoutBusy(null))
  }

  // Money (Owner Billing's O6a): every job that is ours, with billing read when the lens opens and laid over
  // the board's projects and their change orders. Read only.
  const [moneyRows, setMoneyRows] = useState<BillingRows | null>(null)
  const [moneyProblem, setMoneyProblem] = useState<string | null>(null)
  const ourIds = useMemo(() => (board ? board.projects.filter((p) => p.stage === 'buyout' || p.stage === 'building').map((p) => p.id) : []), [board])
  useEffect(() => {
    if (devView !== 'money' || !board || !canSeeGcMoney(role)) return
    let live = true
    setMoneyProblem(null)
    loadGcBillingRows(ourIds)
      .then((rows) => {
        if (live) setMoneyRows(rows)
      })
      .catch((e) => {
        if (live) setMoneyProblem(formatErrorMessage(e, 'The money did not load.'))
      })
    return () => {
      live = false
    }
  }, [devView, board, ourIds, role])
  // Their schedules (O6b-3), read beside the money only while the lens is open, all at once: each job's late finish
  // counts from them. A job whose read fails shows as having none.
  const [moneySchedules, setMoneySchedules] = useState<Map<string, GcProject['schedule'] | null> | null>(null)
  useEffect(() => {
    if (devView !== 'money' || !board || !canSeeGcMoney(role)) return
    let live = true
    setMoneySchedules(null)
    void Promise.all(
      ourIds.map((id) =>
        loadSchedule(board, id)
          .then((read) => [id, read?.project.schedule ?? null] as const)
          .catch(() => [id, null] as const),
      ),
    ).then((pairs) => {
      if (live) setMoneySchedules(new Map(pairs))
    })
    return () => {
      live = false
    }
  }, [devView, board, ourIds, role])
  const moneyState = useMemo(() => {
    const laid = boardWithChanges && moneyRows ? billingStateForAll(boardWithChanges, moneyRows, ourIds) : null
    return laid && moneySchedules ? withSchedules(laid, moneySchedules) : laid
  }, [boardWithChanges, moneyRows, ourIds, moneySchedules])

  // Bill the customer (Owner Billing's O4a): the project's terms, its price as signed and its bills, read when
  // the window opens at `bill=<projectId>` and laid over the board's project with its change orders. The money
  // team's, like Change orders (the Owner Billing door).
  const billProjectId = params.get('bill')
  const [billRows, setBillRows] = useState<BillingRows | null>(null)
  const [billBusy, setBillBusy] = useState<string | null>(null)
  const [billProblem, setBillProblem] = useState<string | null>(null)
  const loadBill = useCallback(async () => {
    if (!billProjectId || !canSeeGcMoney(role)) {
      setBillRows(null)
      return
    }
    setBillRows(await loadGcBillingRows([billProjectId]))
  }, [billProjectId, role])
  useEffect(() => {
    void loadBill().catch((e) => setBillProblem(formatErrorMessage(e, 'The bills did not load.')))
  }, [loadBill])
  // The job's schedule (O6b-3), read when the window opens, so its late finish counts. A failed read shows none.
  const [billSchedule, setBillSchedule] = useState<{ id: string; schedule: GcProject['schedule'] | null } | null>(null)
  useEffect(() => {
    if (!billProjectId || !board || !canSeeGcMoney(role)) return
    let live = true
    loadSchedule(board, billProjectId)
      .then((read) => {
        if (live) setBillSchedule({ id: billProjectId, schedule: read?.project.schedule ?? null })
      })
      .catch(() => {
        if (live) setBillSchedule({ id: billProjectId, schedule: null })
      })
    return () => {
      live = false
    }
  }, [billProjectId, board, role])
  const billScheduleRead = billSchedule !== null && billSchedule.id === billProjectId
  // Pay by card's switch (O8c), the app_settings row the owner turns on: read when the window opens. Unknown is off.
  const [billCardOfferOn, setBillCardOfferOn] = useState(false)
  useEffect(() => {
    if (!billProjectId || !canSeeGcMoney(role)) return
    let live = true
    fetchGcCardBillOn()
      .then((on) => {
        if (live) setBillCardOfferOn(on)
      })
      .catch(() => {
        if (live) setBillCardOfferOn(false)
      })
    return () => {
      live = false
    }
  }, [billProjectId, role])
  const billState = useMemo(() => {
    const laid = boardWithChanges && billProjectId && billRows ? billingStateFor(boardWithChanges, billProjectId, billRows) : null
    return laid && billSchedule && billSchedule.id === billProjectId ? withSchedules(laid, new Map([[billProjectId, billSchedule.schedule]])) : laid
  }, [boardWithChanges, billProjectId, billRows, billSchedule])
  const billProject = billProjectId ? (billState?.projects.find((p) => p.id === billProjectId) ?? null) : null
  // Money in on the billing job (O5c): each sent one's bill, our unconditional waivers naming it, and a payment that names no bill.
  const billOwn = billProjectId ? billRows?.billing.get(billProjectId) : undefined
  const billJobId = billRows?.terms.find((t) => t.project_id === billProjectId)?.billing_job_id ?? null
  const billInvoiceOf = (number: number) => billOwn?.payApps.find((a) => a.number === number)?.invoice_id ?? null
  const billUnconditional = useMemo(
    () =>
      Object.fromEntries(
        (billOwn?.payApps ?? []).map((a) => [
          a.number,
          (billOwn?.money?.waivers ?? []).filter((w) => w.form_type.startsWith('unconditional') && a.invoice_id !== null && w.invoice_ids.includes(a.invoice_id)).length,
        ]),
      ),
    [billOwn],
  )
  const billUnbilled = useMemo(() => unbilledPayments(billOwn?.money), [billOwn])
  // Who each sent one was emailed to and when (O4b), from its sent copies: the pay application's own, then the certified bill.
  const billEmailed = useMemo(() => {
    const out: Record<number, BillEmailed[]> = {}
    for (const a of billOwn?.payApps ?? []) {
      const sent = (billOwn?.emails ?? []).filter((e) => e.source_id === a.id)
      if (sent.length > 0)
        out[a.number] = sent.map((e) => ({
          what: e.kind === GC_CUSTOMER_EMAIL_FILED_AS.certified ? 'certified' : 'payApp',
          to: e.recipient_name ?? '',
          on: calendarYmdInAppTzFromIso(e.sent_at),
        }))
    }
    return out
  }, [billOwn])
  // Who each interest bill was emailed to and when (O6b-2), from its sent copies.
  const billInterestEmailed = useMemo(() => {
    const out: Record<number, { to: string; on: string }[]> = {}
    for (const b of billOwn?.interestBills ?? []) {
      const sent = (billOwn?.interestEmails ?? []).filter((e) => e.source_id === b.id)
      if (sent.length > 0) out[b.number] = sent.map((e) => ({ to: e.recipient_name ?? '', on: calendarYmdInAppTzFromIso(e.sent_at) }))
    }
    return out
  }, [billOwn])
  const setBillWindow = (projectId: string | null) => {
    const next = new URLSearchParams(params)
    if (projectId) next.set('bill', projectId)
    else next.delete('bill')
    setParams(next, { replace: true })
    setBillProblem(null)
  }
  // Get started (the Board's B6-c-ii): `start=<projectId>`, a dev's until award's door, as gc_start_project is. Its
  // job's schedule is read when it opens, as Bill the customer's is, so the schedule step counts; who was told the job
  // started comes from the trade messages under its key.
  const startProjectId = params.get('start')
  const setStartWindow = (projectId: string | null) => {
    const next = new URLSearchParams(params)
    if (projectId) next.set('start', projectId)
    else next.delete('start')
    setParams(next, { replace: true })
  }
  const [startRead, setStartRead] = useState<{ id: string; schedule: GcProject['schedule'] | null; told: string[] } | null>(null)
  useEffect(() => {
    if (!startProjectId || !board || role !== 'dev') return
    let live = true
    Promise.all([loadSchedule(board, startProjectId).catch(() => null), loadGcStartTold(startProjectId).catch(() => [])])
      .then(([read, told]) => {
        if (live) setStartRead({ id: startProjectId, schedule: read?.project.schedule ?? null, told })
      })
    return () => {
      live = false
    }
  }, [startProjectId, board, role])
  const startState = useMemo(
    () => (board && startRead && startRead.id === startProjectId ? withSchedules(board, new Map([[startRead.id, startRead.schedule]])) : null),
    [board, startRead, startProjectId],
  )
  const startProject = startState?.projects.find((x) => x.id === startProjectId && (x.stage === 'buyout' || x.stage === 'building')) ?? null
  const startToldNames = useMemo(
    () => (startRead && board ? startRead.told.map((id) => board.partners.find((x) => x.id === id)?.company ?? 'A company') : []),
    [startRead, board],
  )
  /** Tell each company awarded on the job that it started, once each (the key), naming any the email did not reach. */
  const tellStarted = async (projectId: string): Promise<StartTold> => {
    if (!board) return { told: [], missed: [] }
    const already = new Set(await loadGcStartTold(projectId))
    const told: string[] = []
    const missed: StartTold['missed'] = []
    for (const r of startRecipients(board, projectId)) {
      if (already.has(r.companyId)) {
        told.push(r.company)
        continue
      }
      const req = canSendGcTradeEmail(role) ? startEmailRequest(board, projectId, r.companyId, tradeMailLang(langs[r.companyId])) : null
      const answer = req ? await sendGcTradeEmail(req) : null
      if (answer?.ok) told.push(r.company)
      else missed.push({ company: r.company, why: gcTradeEmailRefusal(answer?.key ?? 'officeOnly') })
    }
    return { told, missed }
  }
  const startPresses = (projectId: string): StartPresses => ({
    start: async (anyway) => {
      await startGcProject(projectId, anyway)
      // Started is saved whatever the emails do; the window names any company they missed.
      await reloadProjects()
      return tellStarted(projectId)
    },
    tellAgain: () => tellStarted(projectId),
    setPermit: async (done) => {
      await setGcProjectStartItem(projectId, { permit_on: done ? today : null })
      await reloadProjects()
    },
    setStartDate: async (date) => {
      await setGcProjectStartItem(projectId, { start_date: date })
      await reloadProjects()
    },
    // Our contract's price by line is Our number's, so Mark it signed is the money team's, with Our number read.
    ...(canSeeGcMoney(role) && moneyShown
      ? {
          signContract: async (signed: boolean) => {
            const project = board?.projects.find((x) => x.id === projectId)
            await signGcOwnerContract(projectId, signed ? today : null, signed && project ? ownerContractWorthNow(project) : null)
            await reloadProjects()
          },
        }
      : {}),
    award: (packageId) => setComparing({ projectId, packageId }),
    // The statement of work is sent on the trade's card: the window steps aside and the card scrolls into view.
    openSow: (packageId) => {
      setStartWindow(null)
      window.setTimeout(() => document.querySelector(`[data-gc-trade-sow="${packageId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
    },
  })
  /** A Bill the customer press: run it, read the bills again when it wrote, and say the problem in the window. */
  const billWrite = (id: string, work: () => Promise<unknown>, failed: string, reload = true) => {
    setBillBusy(id)
    setBillProblem(null)
    void work()
      .then(() => (reload ? loadBill() : undefined))
      .catch((e) => setBillProblem(formatErrorMessage(e, failed)))
      .finally(() => setBillBusy(null))
  }
  // Our conditional waiver with a sent pay application (O4a-4): the Pipeline's own waiver window on the
  // billing job, filled in with what the bill asked and its bill day, since no bill exists until the certificate.
  const [waiverFor, setWaiverFor] = useState<{
    job: JobWithDetails
    payAppId: string
    /** Our conditional waiver goes before the bill exists: what it asked and its bill day. */
    ask: { amount: number; throughDate: string } | null
    /** Our unconditional waiver (O5c) names the bill the payments came on. */
    invoiceId: string | null
    formType: 'conditional_progress' | 'conditional_final' | 'unconditional_progress' | 'unconditional_final'
  } | null>(null)
  const openWaiver = (number: number) => {
    if (!billProjectId) return
    const row = billRows?.billing.get(billProjectId)?.payApps.find((a) => a.number === number)
    const jobId = billRows?.terms.find((t) => t.project_id === billProjectId)?.billing_job_id
    if (!row || !jobId) return
    billWrite(
      `waiver-${number}`,
      async () => {
        const job = await fetchJobWithDetailsById(jobId)
        if (!job) throw new Error('The billing job did not load.')
        // Our final pay application goes with our conditional waiver on final payment (O7a).
        setWaiverFor({ job, payAppId: row.id, ask: { amount: Math.round(Number(row.due) * 100) / 100, throughDate: row.period_to }, invoiceId: null, formType: row.final ? 'conditional_final' : 'conditional_progress' })
      },
      'The waiver did not open.',
      false,
    )
  }
  // Our unconditional waiver for what they paid (O5c): the same window on the bill, the final form on the final pay application.
  const openUnconditional = (number: number) => {
    const row = billOwn?.payApps.find((a) => a.number === number)
    if (!row?.invoice_id || !billJobId) return
    const invoiceId = row.invoice_id
    billWrite(
      `unconditional-${number}`,
      async () => {
        const job = await fetchJobWithDetailsById(billJobId)
        if (!job) throw new Error('The billing job did not load.')
        setWaiverFor({ job, payAppId: row.id, ask: null, invoiceId, formType: row.final ? 'unconditional_final' : 'unconditional_progress' })
      },
      'The waiver did not open.',
      false,
    )
  }

  if (authLoading) return null
  if (!canOpenGcProjects(role)) return <Navigate to="/dashboard" replace />

  const setWindow = (open: boolean) => {
    const next = new URLSearchParams(params)
    if (open) next.set('new', '1')
    else next.delete('new')
    setParams(next, { replace: true })
  }
  const setBook = (open: { trade?: string; projectId?: string } | null) => {
    const next = new URLSearchParams(params)
    for (const k of ['book', 'trade', 'project']) next.delete(k)
    if (open) {
      next.set('book', '1')
      if (open.trade) next.set('trade', open.trade)
      if (open.projectId) next.set('project', open.projectId)
    }
    setParams(next, { replace: true })
  }
  const bookProject = bookProjectId ? (loaded?.projects.find((p) => p.id === bookProjectId) ?? null) : null
  const setProject = setProjectId ? (loaded?.projects.find((p) => p.id === setProjectId) ?? null) : null
  const plansProject = plansProjectId ? (loaded?.projects.find((p) => p.id === plansProjectId) ?? null) : null
  const questionsProject = questionsProjectId ? (loaded?.projects.find((p) => p.id === questionsProjectId) ?? null) : null
  const setQuestionsWindow = (projectId: string | null) => {
    const next = new URLSearchParams(params)
    if (projectId) next.set('questions', projectId)
    else next.delete('questions')
    setParams(next, { replace: true })
    setQuestionProblem(null)
  }
  /**
   * Who hears an answer by email (the Portal lane's P3-b): the companies on the question's trade from the board's
   * company record, which only a dev loads. Without it the answer is recorded and carried, and no email goes.
   */
  const answerReach: AnswerReach | null =
    board && questionsProject
      ? {
          canSend: canSendGcTradeEmail(role),
          recipients: (packageId) => answerRecipients(board, questionsProject.id, packageId),
          companyName: (id) => board.partners.find((p) => p.id === id)?.company ?? null,
        }
      : null
  /** An answer to each company ticked, in its language; the window reloads either way, and names any it did not reach. */
  const emailAnswer = async (questionId: string, answer: string, to: string[]) => {
    const project = questionsProject
    if (!project || to.length === 0) return
    const q: PlanQuestionView | undefined = project.questions.find((x) => x.id === questionId)
    const trade = project.trades.find((t) => t.id === q?.packageId)?.trade ?? 'the job'
    const setLabel = q?.inSetId ? (project.planSets.find((s) => s.id === q.inSetId)?.label ?? null) : null
    const r = await emailTheAnswer({
      projectId: project.id,
      questionId,
      to: to.map((companyId) => ({ companyId, company: answerReach?.companyName(companyId) ?? 'A company', lang: tradeMailLang(langs[companyId]) })),
      email: (lang) => answerEmail({ project: project.name, trade, question: q?.text ?? '', answer, setLabel }, lang),
    })
    const words = answerSentWords(
      r.sent.map((x) => x.company),
      r.refused,
    )
    if (words.done) showToast(words.done, 'success')
    if (words.problem) {
      await load()
      throw new Error(words.problem)
    }
  }
  /** A question write: run it, reload, and say the problem in the window if there is one. */
  const questionWrite = (id: string | null, work: Promise<unknown>, failed: string) => {
    setQuestionBusy(id ?? 'new')
    setQuestionProblem(null)
    void work
      .then(() => load())
      .catch((e) => setQuestionProblem(formatErrorMessage(e, failed)))
      .finally(() => setQuestionBusy(null))
  }
  const setPlansWindow = (projectId: string | null) => {
    const next = new URLSearchParams(params)
    if (projectId) next.set('plans', projectId)
    else next.delete('plans')
    setParams(next, { replace: true })
  }
  const setScheduleWindow = (projectId: string | null) => {
    const next = new URLSearchParams(params)
    if (projectId) next.set('schedule', projectId)
    else next.delete('schedule')
    setParams(next, { replace: true })
  }
  // The schedule reads the board's job: a dev's only, as the gc_schedule_* tables are until the schedule's PR 10 (G-133).
  const scheduleProject = scheduleProjectId && role === 'dev' ? (board?.projects.find((x) => x.id === scheduleProjectId) ?? null) : null
  const setSetWindow = (projectId: string | null) => {
    const next = new URLSearchParams(params)
    if (projectId) next.set('set', projectId)
    else next.delete('set')
    setParams(next, { replace: true })
    setIssueProblem(null)
  }
  const bookTradeView = bookProject && bookTrade ? (bookProject.trades.find((t) => t.trade === bookTrade) ?? null) : null
  const current = bookProject && bookTradeView ? { trade: bookTradeView.trade, lines: bookTradeView.scope.map((l) => l.label), projectName: bookProject.name, projectId: bookProject.id } : null
  const after = (work: Promise<void>, failed: string) => {
    void work.then(() => load()).catch((e) => showToast(formatErrorMessage(e, failed), 'error'))
  }

  const page = (
    <div style={{ padding: '1rem', display: 'grid', gap: '1rem', maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span data-tour="gc-mode-switch" style={{ display: 'inline-flex' }}>
          <BidsModeToggle mode="gc" />
        </span>
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>GC projects</h1>
        <Chip tone="grey" title="GC mode is new. Tell the office what you find.">
          Being built
        </Chip>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Btn kind="quiet" dataTour="gc-new-here" onClick={() => setTourOpen('button')} disabled={!loaded}>
            New here?
          </Btn>
          <Btn kind="quiet" dataTour="gc-scope-book" onClick={() => setBook({})} disabled={!loaded}>
            Open the scope book
          </Btn>
          <Btn kind="primary" dataTour="gc-new-project" onClick={() => setWindow(true)} disabled={!loaded}>
            New project
          </Btn>
        </div>
      </div>
      <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        Each project as the window left it: its sets of plans, its sheets, its trades with their scope lines and the gaps. Who to ask comes with the company record.
      </div>

      {loadProblem && <div style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{loadProblem}</div>}
      {/* Door 2: the Board for the GC office. Each company's portal link is in its window (Their portal), a dev's until the trade wave. */}
      {canOpenGcProjects(role) && loaded && loaded.projects.length > 0 && (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{devView === 'board' ? 'Project Board' : devView === 'partners' ? 'Trade partners' : devView === 'money' && canSeeGcMoney(role) ? 'Money' : 'Follow up'}</h2>
            <div role="group" aria-label={canSeeGcMoney(role) ? 'Project Board, Trade partners, Follow up or Money' : 'Project Board, Trade partners or Follow up'} style={{ display: 'flex', gap: '0.35rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
              {devPill('board', 'Project Board')}
              {devPill('partners', 'Trade partners')}
              {devPill('followUp', toCall > 0 ? `Follow up (${toCall})` : 'Follow up')}
              {/* Money is the money team's (the Owner Billing door). */}
              {canSeeGcMoney(role) && devPill('money', 'Money')}
            </div>
          </div>
          {board ? (
            devView === 'board' ? (
              <GcBoard
                state={board}
                onOpen={openProjectCard}
                onPlans={(id) => setPlansWindow(id)}
                onCompare={(projectId, packageId) => setComparing({ projectId, packageId })}
                moneyShown={moneyShown}
                folderUrls={Object.fromEntries(loaded.projects.filter((p) => p.driveFolderUrl).map((p) => [p.id, p.driveFolderUrl]))}
                onChase={() => setDevView('followUp')}
              />
            ) : devView === 'partners' ? (
              <GcTradePartners state={board} writes={partnerWrites} onOpenProject={openProjectCard} onAsk={openAsk} trades={[...new Set(loaded.projects.flatMap((p) => p.trades.map((t) => t.trade)))]} />
            ) : devView === 'money' && canSeeGcMoney(role) ? (
              moneyState ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '1rem' }}>
                  <GcMoney state={moneyState} schedulesRead={moneySchedules !== null} own={ownWork} />
                  {user && loaded && (
                    <GcMoneyMondayEmail
                      me={{ id: user.id, name: profileName ?? '' }}
                      team={loaded.team.filter((p) => (GC_MONEY_TEAM as readonly string[]).includes(p.role))}
                      io={MONEY_MONDAY_IO}
                    />
                  )}
                </div>
              ) : moneyProblem ? (
                <div style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{moneyProblem}</div>
              ) : (
                <div style={{ fontSize: '0.875rem' }}>Loading the money…</div>
              )
            ) : (
              <GcFollowUp state={board} writes={askWrites} onWhoElse={showTrade} />
            )
          ) : boardProblem ? (
            <div style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{boardProblem}</div>
          ) : (
            <div style={{ fontSize: '0.875rem' }}>Loading the board…</div>
          )}
          <h2 style={{ margin: '0.5rem 0 0', fontSize: '1.1rem' }}>Each project</h2>
        </div>
      )}
      {!loaded && !loadProblem && <div style={{ fontSize: '0.875rem' }}>Loading…</div>}
      {loaded && loaded.projects.length === 0 && <div style={{ fontSize: '0.875rem' }}>No GC project yet. Press New project when the first plans come in.</div>}

      {loaded?.projects.map((p, cardIndex) => {
        /** The walk points at the first card only, so each anchor is on the page once. */
        const tour = (anchor: string) => (cardIndex === 0 ? anchor : undefined)
        const gaps = scopeGaps(p.trades.map((t) => ({ trade: t.trade, scope: t.scope.map((s) => s.label), excludes: t.excludes })))
        const newest = p.planSets[p.planSets.length - 1]
        // The board's reading of this project, for the GC office since door 2 (B5-c's outcome strip, B5-d's bid
        // tabs); Our number stays the money team's.
        const boardProject = canOpenGcProjects(role) ? board?.projects.find((x) => x.id === p.id) : undefined
        const showNumber = boardProject && canSeeGcMoney(role)
        const tabs = boardProject ? boardProject.packages.filter(packageHasTab).length : 0
        return (
          <div key={p.id} data-gc-project={p.id} data-tour={tour('gc-project-card')} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.9rem 1rem', display: 'grid', gap: '0.6rem', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '1.02rem' }}>{p.name}</strong>
              <Chip tone={justMade === p.id ? 'green' : 'grey'}>{p.stage}</Chip>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{p.address}</span>
              {p.bidDue && <span style={{ fontSize: '0.85rem' }}>bid due {p.bidDue}</span>}
              <Btn kind="quiet" dataTour={tour('gc-plans')} onClick={() => setPlansWindow(p.id)}>
                The plans
              </Btn>
              <Btn kind="quiet" dataTour={tour('gc-questions')} onClick={() => setQuestionsWindow(p.id)}>
                Questions about the plans{openQuestions(p).length > 0 ? ` · ${openQuestions(p).length} open` : ''}
              </Btn>
              {!p.lostOn && (
                <Btn kind="quiet" dataTour={tour('gc-new-set')} onClick={() => setSetWindow(p.id)}>
                  A new set of plans came in
                </Btn>
              )}
              {role === 'dev' && board && (
                <Btn kind="quiet" onClick={() => setScheduleWindow(p.id)}>
                  Schedule
                </Btn>
              )}
              {canSeeGcMoney(role) && boardWithChanges && p.stage !== 'bidding' && !p.lostOn && (
                <Btn kind="quiet" onClick={() => setChangesWindow(p.id)}>
                  {(() => {
                    const count = changeOrderRows.filter((r) => r.project_id === p.id).length
                    return count > 0 ? `Change orders · ${count}` : 'Change orders'
                  })()}
                </Btn>
              )}
              {/* The daily log (Building's U3a-ii): a dev's, on a job being built (the view's own stage, so a closed job has none). */}
              {canUseGcBuilding(role) && boardWithLogs && p.stage === 'building' && (
                <Btn kind="quiet" onClick={() => setLogWindow(p.id)}>
                  {(() => {
                    const project = boardWithLogs.projects.find((x) => x.id === p.id)
                    const missed = project ? missingLogs(project, today).length : 0
                    return missed > 0 ? `Daily log · ${missed} missed` : 'Daily log'
                  })()}
                </Btn>
              )}
              {/* The punch list (Building's U3b-ii): a dev's, on a job being built. */}
              {canUseGcBuilding(role) && board && p.stage === 'building' && (
                <Btn kind="quiet" onClick={() => setPunchWindow(p.id)}>
                  Punch list
                </Btn>
              )}
              {/* The submittal register (Building's U4b): a dev's, on a job being built. */}
              {canUseGcBuilding(role) && board && p.stage === 'building' && (
                <Btn kind="quiet" onClick={() => setSubmittalsWindow(p.id)}>
                  Submittals
                </Btn>
              )}
              {/* RFIs (Building's U5b): a dev's, on a job being built. */}
              {canUseGcBuilding(role) && board && p.stage === 'building' && (
                <Btn kind="quiet" onClick={() => setRfisWindow(p.id)}>
                  RFIs
                </Btn>
              )}
              {/* Draws (Building's U6b): a dev's on the money team, on a job being built. */}
              {canUseGcBuilding(role) && canSeeGcMoney(role) && boardWithChanges && p.stage === 'building' && (
                <Btn kind="quiet" onClick={() => setDrawsWindow(p.id)}>
                  Draws
                </Btn>
              )}
              {/* Closeout (Building's U6d): a dev's on the money team, on a job being built or closed. */}
              {canUseGcBuilding(role) && canSeeGcMoney(role) && boardWithChanges && (p.stage === 'building' || p.stage === 'closed') && (
                <Btn kind="quiet" onClick={() => setCloseoutWindow(p.id)}>
                  Closeout
                </Btn>
              )}
              {/* Get started (the Board's B6-c-ii): a dev's on a won job until award's door, as gc_start_project is. */}
              {role === 'dev' && board && (p.stage === 'buyout' || p.stage === 'building') && !p.lostOn && (
                <Btn kind="quiet" onClick={() => setStartWindow(p.id)}>
                  Get started
                </Btn>
              )}
              {canSeeGcMoney(role) && boardWithChanges && p.stage !== 'bidding' && !p.lostOn && (
                <Btn kind="quiet" onClick={() => setBillWindow(p.id)}>
                  Bill the customer
                </Btn>
              )}
              {(p.sqFt || p.sizeNote) && (
                <span style={{ fontSize: '0.85rem' }}>{[p.sqFt ? `${p.sqFt.toLocaleString('en-US')} sq ft` : '', p.sizeNote].filter(Boolean).join(' ')}</span>
              )}
              {showNumber && (
                <Btn kind="quiet" onClick={() => setNumberOpen(numberOpen === p.id ? null : p.id)}>
                  {numberOpen === p.id ? 'Hide our number' : 'Our number'}
                </Btn>
              )}
              {tabs > 0 && (
                <Btn kind="quiet" onClick={() => setTabsOpen(tabsOpen === p.id ? null : p.id)}>
                  {tabsOpen === p.id ? 'Hide the bid tabs' : `Bid tabs (${tabs})`}
                </Btn>
              )}
            </div>
            {boardProject && <GcProjectOutcome project={boardProject} writes={outcomeWrites(p.id)} />}
            {showNumber && board && numberOpen === p.id && (
              <GcOurNumber
                state={board}
                project={boardProject}
                onSave={(values) => saveMoney(p.id, values)}
                gcJob={{
                  jobLabel: ownWorkLabel(boardProject.generalConditionsJobId),
                  heldBy: loaded ? heldByOthers(crewJobsHeld(loaded.projects, p.id, gcJobsOf), generalConditionsHolder(p.id)) : {},
                  onName: (jobId) => nameGcJob(p.id, jobId),
                  search: searchPipelineJobs,
                }}
              />
            )}
            {boardProject && board && tabs > 0 && tabsOpen === p.id && <GcBidTabs state={board} project={boardProject} share={shareTab} />}
            <div style={{ fontSize: '0.85rem' }}>
              {p.planSets.length} {p.planSets.length === 1 ? 'set' : 'sets'} of plans
              {newest ? `, newest ${newest.label} of ${newest.issuedOn}` : ''}. {p.sheets.length} {p.sheets.length === 1 ? 'sheet' : 'sheets'}
              {p.specs.length > 0 ? `, ${p.specs.length} ${p.specs.length === 1 ? 'section' : 'sections'}` : ''}.
            </div>
            {(
              <div data-tour={tour('gc-drive')} style={{ fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {p.driveFolderUrl ? (
                  <a href={p.driveFolderUrl} target="_blank" rel="noreferrer">
                    The job folder in Drive
                  </a>
                ) : (
                  <Btn
                    kind="quiet"
                    disabled={checking === `${p.id}:folders`}
                    onClick={() => {
                      setChecking(`${p.id}:folders`)
                      void makeDriveFolders(p.id)
                        .then(async (folders) => {
                          await load()
                          if (!folders.plansShared) showToast(`The folders are made, but Plans could not be shared with anyone with the link: ${folders.reason ?? 'Drive said no'}.`, 'error')
                        })
                        .catch((e) => showToast(formatErrorMessage(e, 'The Drive folders were not made.'), 'error'))
                        .finally(() => setChecking(null))
                    }}
                  >
                    {checking === `${p.id}:folders` ? 'Making the folder…' : 'Make the Drive folder'}
                  </Btn>
                )}
                {newest?.drive.url && (
                  <>
                    <a href={newest.drive.url} target="_blank" rel="noreferrer">
                      {newest.label}'s plans
                    </a>
                    <span style={{ color: newest.drive.access === 'anyone' ? 'var(--text-green-700)' : newest.drive.access === 'restricted' || newest.drive.checkedOn ? 'var(--text-red-700)' : 'var(--text-muted)' }}>
                      {newest.drive.access === 'anyone'
                        ? `Anyone with the link can open it, checked ${newest.drive.checkedOn ?? ''}.`
                        : newest.drive.access === 'restricted'
                          ? `Only some people can open it, checked ${newest.drive.checkedOn ?? ''}. Please correct. ${DRIVE_RESTRICTED_WORDS}`
                          : newest.drive.checkedOn
                            ? `Our helper could not see this link on ${newest.drive.checkedOn}. Share it with the intake service account, or move the plans into the job folder.`
                            : 'Who can open it is not checked yet.'}
                    </span>
                    <Btn
                      kind="quiet"
                      disabled={checking === `${p.id}:${newest.rev}`}
                      onClick={() => {
                        setChecking(`${p.id}:${newest.rev}`)
                        void checkDriveAccess(newest.drive.url, { projectId: p.id, rev: newest.rev })
                          .then(async (v) => {
                            await load()
                            if (!v.seen && v.note) showToast(v.note, 'error')
                          })
                          .catch((e) => showToast(formatErrorMessage(e, 'The link was not checked.'), 'error'))
                          .finally(() => setChecking(null))
                      }}
                    >
                      {checking === `${p.id}:${newest.rev}` ? 'Checking…' : newest.drive.access === null ? 'Check the link' : 'Check again'}
                    </Btn>
                  </>
                )}
              </div>
            )}
            <div style={{ display: 'grid', gap: '0.4rem' }}>
              {p.trades.map((t) => (
                <div key={t.id} style={{ display: 'grid', gap: '0.15rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <strong>{t.trade}</strong>
                    {t.ours && <Chip tone="blue">ours</Chip>}
                    {t.budget > 0 && <span style={{ color: 'var(--text-muted)' }}>{money(t.budget)}</span>}
                    <span style={{ color: 'var(--text-muted)' }}>
                      {t.scope.length} scope {t.scope.length === 1 ? 'line' : 'lines'}
                      {t.excludes.length > 0 ? `, leaves out ${t.excludes.length}` : ''}
                    </span>
                    {t.scope.length > 0 && (
                      <Btn kind="quiet" onClick={() => setBook({ trade: t.trade, projectId: p.id })}>
                        Save as a set
                      </Btn>
                    )}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-muted)' }}>
                    {t.scope.map((s) => (
                      <li key={s.id}>
                        {s.label}
                        {s.sheets && s.sheets.length > 0 ? ` · ${s.sheets.join(', ')}` : ''}
                        {s.specs && s.specs.length > 0 ? ` · ${s.specs.join(', ')}` : ''}
                      </li>
                    ))}
                  </ul>
                  {/* The trade's statement of work once it is awarded (B6-a-ii): a dev and, since O9, the money team read one. Only
                      a dev sends it until the award door. */}
                  {canOpenGcProjects(role) && board && <GcTradeSow state={board} projectId={p.id} packageId={t.id} writes={sowWrites} canSend={canUseGcBoardWrites(role)} canEmail={canSendGcTradeEmail(role)} />}
                  {/* The trade's asks and their stories (the Board's B4-b), for a dev while it is built. */}
                  {canOpenGcProjects(role) && board && <GcTradeAsks state={board} projectId={p.id} packageId={t.id} writes={askWrites} onAsk={() => openAsk(p.id, t.id)} onCompare={() => setComparing({ projectId: p.id, packageId: t.id })} />}
                </div>
              ))}
            </div>
            {gaps.length > 0 && (
              <div data-tour={tour('gc-gaps')} style={{ fontSize: '0.85rem', color: 'var(--text-red-700)' }}>
                {gaps.length} {gaps.length === 1 ? 'gap' : 'gaps'}: {gaps.map((g) => `${g.trade} leaves out ${g.label} for ${g.by}`).join('. ')}.
              </div>
            )}
          </div>
        )
      })}

      {tourSteps && (
        <SpotlightTour
          steps={tourSteps}
          onClose={closeTour}
          onStep={(i) => {
            tourFurthest.current = Math.max(tourFurthest.current, i)
          }}
          guideHref={GC_NEW_HERE_GUIDE.href}
          guideLabel={GC_NEW_HERE_GUIDE.label}
        />
      )}

      {plansProject && <GcPlansWindow project={plansProject} onClose={() => setPlansWindow(null)} />}
      {startProject && startState && (
        <GcStartWindow
          key={startProject.id}
          state={startState}
          project={startProject}
          presses={startPresses(startProject.id)}
          told={startToldNames}
          ownBidHref={(packageId) => {
            // Our own crew's Trades mode bid, on its Pricing tab.
            const bidId = loaded?.projects.find((x) => x.id === startProject.id)?.trades.find((t) => t.id === packageId)?.ownBidId
            return bidId ? `/bids?tab=pricing&bidId=${encodeURIComponent(bidId)}` : null
          }}
          covered={comparing !== null || openCompany !== null || openCustomer !== null}
          onOpenSchedule={() => {
            const next = new URLSearchParams(params)
            next.delete('start')
            next.set('schedule', startProject.id)
            setParams(next, { replace: true })
          }}
          onClose={() => setStartWindow(null)}
        />
      )}
      {scheduleProject && board && (
        <GcScheduleWindow
          key={scheduleProject.id}
          state={board}
          project={scheduleProject}
          by={profileName ?? 'The office'}
          canMove={role === 'dev'}
          canPull={canUseGcBuilding(role)}
          canTell={canSendGcTradeEmail(role)}
          reads={scheduleReads}
          onClose={() => setScheduleWindow(null)}
        />
      )}
      {openCustomer && board && (
        <GcCustomerWindow
          key={`${openCustomer.id}:${customerWin?.at?.doc ?? ''}:${customerWin?.at?.send ? 'send' : ''}`}
          state={board}
          customer={openCustomer}
          {...(customerWin?.at ? { at: customerWin.at } : {})}
          {...(sendContract ? { sendContract } : {})}
          canEmail={canSeeGcMoney(role)}
          onOpenProject={(projectId) => {
            setCustomerWin(null)
            openProjectCard(projectId)
          }}
          onClose={() => setCustomerWin(null)}
        />
      )}
      {openCompany && board && (
        <GcCompanyWindow
          key={`${openCompany.id}:${companyAt?.tab ?? ''}:${companyAt?.doc ?? ''}:${companyAt?.send ? 'send' : ''}`}
          state={board}
          partner={openCompany}
          lang={langs[openCompany.id] ?? 'en'}
          onLanguage={async (lang) => {
            await setGcCompanyLanguage(openCompany.id, lang)
            await refreshBoard()
          }}
          {...(companyAt ? { at: companyAt } : {})}
          onClose={() => {
            setCompanyId(null)
            setCompanyAt(null)
          }}
          // Their portal stays a dev's until the trade wave: its links' table is dev only (door 2).
          portal={role === 'dev' ? <GcTheirPortal companyId={openCompany.id} /> : undefined}
          // Its papers' sends and certificate (B6-b-ii): the Board's writes (canUseGcBoardWrites, O9), as B6-b-i's functions
          // are a dev's today. Each reads the board again.
          papers={
            canUseGcBoardWrites(role)
              ? {
                  entries: paperEntries,
                  onSend: async (step, by, note) => {
                    const outcome = await sendCompanyPaper({ state: board, partner: openCompany, step, by, note, lang: langs[openCompany.id] ?? 'en', entries: paperEntries ?? { msa: null, w9: null } })
                    if (outcome.ok || outcome.recorded) await refreshBoard()
                    return outcome
                  },
                  onRecordInsurance: async (expiresOn, url) => {
                    await recordCompanyInsurance(openCompany.id, expiresOn, url)
                    await refreshBoard()
                  },
                }
              : undefined
          }
          // Log a contact on Activity (B2b-iv): a line of the company's own in the call log, as Follow up signs its lines.
          onLogContact={async (how, note) => {
            await logGcAskContact({ companyId: openCompany.id, inviteId: null, on: today, byName: profileName ?? '', how, note, promisedBy: null })
            await refreshBoard()
          }}
          onOpenProject={(projectId) => {
            setCompanyId(null)
            openProjectCard(projectId)
          }}
        />
      )}
      {comparing && board && (
        <GcCompareQuotes
          key={comparing.packageId}
          state={board}
          projectId={comparing.projectId}
          packageId={comparing.packageId}
          writes={compareWrites}
          team={{ team: loaded?.team ?? [], me: user?.id ?? null }}
          onClose={() => setComparing(null)}
        />
      )}
      {asking && board && (
        <GcAskCompanies
          key={`${asking.projectId}:${asking.packageId}`}
          state={board}
          projectId={asking.projectId}
          packageId={asking.packageId}
          {...(asking.tick ? { tick: asking.tick } : {})}
          langs={langs}
          emails={canSendGcTradeEmail(role)}
          onAsk={async (companyIds, email) => {
            // A dev's press with the window's tick on emails each new ask its invitation (P3's sender); otherwise the asks are saved.
            const send = email && canSendGcTradeEmail(role)
              ? async (ask: NewAsk) => {
                  const req = inviteEmailRequest(board, asking.projectId, asking.packageId, ask, tradeMailLang(langs[ask.companyId]))
                  return req ? sendGcTradeEmail(req) : { ok: false as const, key: 'notFound' as const, detail: null }
                }
              : null
            const outcomes = await askGcCompanies(asking.packageId, companyIds, profileName ?? '', today, send)
            await refreshBoard()
            return outcomes
          }}
          onClose={() => setAsking(null)}
        />
      )}

      {canSeeGcMoney(role) && changesProject && boardWithChanges && (
        <GcChangeOrdersWindow
          state={boardWithChanges}
          project={changesProject}
          today={today}
          busy={changeBusy}
          problem={changeProblem}
          emailed={changeEmailed}
          askEmailed={askEmailed}
          onClose={() => setChangesWindow(null)}
          writes={{
            onDraft: (draft) => changeWrite('new', draftChangeOrder(changesProject.id, draft), 'The change order was not drafted.'),
            onSend: (id, email) => {
              // The tick (off to start) also emails it to the customer to sign by reply (O4b-2). The change orders are
              // read again either way, and an email that did not go is said after.
              const co = projectChangeOrders(changesProject).find((c) => c.id === id)
              setChangeBusy(id)
              setChangeProblem(null)
              void (async () => {
                try {
                  await sendChangeOrder(id, today)
                  let emailProblem: string | null = null
                  if (email && co) {
                    const mail = changeOrderMail(changeOrderMailFacts(boardWithChanges, changesProject, co))
                    const a = await sendGcCustomerEmail({ projectId: changesProject.id, kind: 'change_order', sourceId: id, subject: mail.subject, lines: mail.lines, pdf: null })
                    if (!a.ok) emailProblem = `The change order is marked sent, but its email did not go. ${gcCustomerEmailRefusal(a.key)}`
                  }
                  // Made of a trade's ask (O3b): the company hears it went to the customer, with its part.
                  const asked = (changesProject.changeRequests ?? []).find((r) => r.changeOrderId === id)
                  if (asked && co) {
                    const told = await tellAsk(boardWithChanges, changesProject, asked, 'sent', { number: co.number, cost: co.cost })
                    if (told) emailProblem = `${emailProblem ?? 'The change order is marked sent.'} ${told}`
                  }
                  await loadChangeOrders()
                  if (emailProblem) setChangeProblem(emailProblem)
                } catch (e) {
                  setChangeProblem(formatErrorMessage(e, 'The change order was not marked sent.'))
                } finally {
                  setChangeBusy(null)
                }
              })()
            },
            onAnswer: (id, signed, on) => {
              const co = projectChangeOrders(changesProject).find((c) => c.id === id)
              const asked = (changesProject.changeRequests ?? []).find((r) => r.changeOrderId === id)
              changeWriteSaying(
                id,
                async () => {
                  await answerChangeOrder(id, signed, on)
                  // The customer said no to a change order made of a trade's ask (O3b): the company hears it.
                  if (signed || !asked || !co) return null
                  const told = await tellAsk(boardWithChanges, changesProject, asked, 'no', { number: co.number, cost: co.cost })
                  return told ? `Their answer is recorded. ${told}` : null
                },
                'Their answer was not recorded.',
              )
            },
            onSetPct: (id, pct) => changeWrite(id, setChangeOrderPct(id, pct), 'The percent done was not saved.'),
            onDelete: (id) => changeWrite(id, deleteChangeOrderDraft(id), 'The draft was not deleted.'),
            onDraftFromRequest: (requestId, draft) => changeWrite(requestId, draftChangeOrderFromRequest(requestId, draft), 'The change order was not made.'),
            onTurnDown: (requestId, note) => {
              const request = (changesProject.changeRequests ?? []).find((r) => r.id === requestId)
              changeWriteSaying(
                requestId,
                async () => {
                  await turnDownChangeRequest(requestId, note)
                  if (!request) return null
                  const told = await tellAsk(boardWithChanges, changesProject, { ...request, turnedDown: { on: today, note } }, 'down')
                  return told ? `It is turned down. ${told}` : null
                },
                'The ask was not turned down.',
              )
            },
            onTell: (requestId, stage) => {
              const request = (changesProject.changeRequests ?? []).find((r) => r.id === requestId)
              const co = request ? projectChangeOrders(changesProject).find((c) => c.id === request.changeOrderId) : undefined
              if (!request || !co) return
              changeWriteSaying(co.id, () => tellAsk(boardWithChanges, changesProject, request, stage, { number: co.number, cost: co.cost }), 'The email did not go.')
            },
          }}
        />
      )}

      {canUseGcBuilding(role) && logProject && boardWithLogs && (
        <GcDailyLogWindow
          state={boardWithLogs}
          project={logProject}
          today={today}
          busy={logBusy}
          problem={logProblem}
          onSave={(log) => saveLog(logProject.id, log)}
          weekly={weeklyState && weeklyProject ? { state: weeklyState, project: weeklyProject, me: profileName ?? null, writes: weeklyWrites } : null}
          ourCrew={{ rows: crewRows, jobs: crewJobLabels }}
          onClose={() => setLogWindow(null)}
        />
      )}

      {canUseGcBuilding(role) && punchProject && punchBoard && (
        <GcPunchWindow
          state={punchBoard}
          project={punchProject}
          writes={punchWritesFor(setPunchBusy, setPunchProblem, loadPunch)}
          busy={punchBusy}
          problem={punchProblem}
          onClose={() => setPunchWindow(null)}
        />
      )}

      {canUseGcBuilding(role) && submittalsProjectId && submittalRead && (
        <GcSubmittalsWindow
          state={submittalRead.state}
          project={submittalRead.project}
          extras={submittalRoundExtras(submittalTables)}
          sections={Object.fromEntries((loaded?.projects.find((x) => x.id === submittalsProjectId)?.trades ?? []).map((t) => [t.id, tradeSpecSections(t.scope)]))}
          checkLink={async (url) => (await checkDriveAccess(url)).access}
          busy={submittalBusy}
          problem={submittalProblem}
          onClose={() => setSubmittalsWindow(null)}
          writes={{
            onAdd: (draft) => submittalWrite('new', addSubmittal(draft), 'The submittal was not added.'),
            onCameIn: (round) => submittalWrite(round.submittalId, submittalCameIn(round), 'The round was not recorded.'),
            onSendToArchitect: (id) =>
              submittalWrite(
                id,
                sendSubmittalToArchitect(id).then((r) => showToast(`Sent to ${r.to}.`, 'success')),
                'The submittal was not sent.',
              ),
            onMarkSent: (id) => submittalWrite(id, markSubmittalSent(id), 'It was not marked sent.'),
            onAnswer: (id, answer, note) => submittalWrite(id, answerSubmittal(id, answer, note), 'The answer was not recorded.'),
          }}
        />
      )}

      {canUseGcBuilding(role) && rfisProjectId && rfiView && (
        <GcRfisWindow
          state={rfiView.state}
          project={rfiView.project}
          extras={rfiExtras(rfiTables)}
          lineSheets={Object.fromEntries((loaded?.projects.find((x) => x.id === rfisProjectId)?.trades ?? []).flatMap((t) => t.scope.map((l) => [l.id, l.sheets])))}
          canStartChangeOrders={canSeeGcMoney(role)}
          busy={rfiBusy}
          problem={rfiProblem}
          onClose={() => setRfisWindow(null)}
          writes={{
            onAsk: (draft) => rfiWrite('new', addRfi(draft), 'The question was not added.'),
            onSendToArchitect: (id) => rfiWrite(id, sendRfiToArchitect(id).then((r) => showToast(`Sent to ${r.to}.`, 'success')), 'The RFI was not sent.'),
            onMarkSent: (id) => rfiWrite(id, markRfiSent(id), 'It was not marked sent.'),
            onAnswer: (id, answer) => rfiWrite(id, answerRfi(id, answer), 'The answer was not recorded.'),
            // The draft opens in Change orders, to price and send (the money team's), which says its own read's problem.
            onStartChangeOrder: (rfi) =>
              rfiWrite(
                rfi.id,
                startRfiChangeOrder(rfiView.project, rfi).then(() => {
                  const next = new URLSearchParams(params)
                  next.delete('rfis')
                  next.set('changes', rfiView.project.id)
                  setParams(next, { replace: true })
                  void loadChangeOrders().catch((e) => setChangeProblem(formatErrorMessage(e, 'The change orders did not load.')))
                }),
                'The change order was not started.',
              ),
          }}
        />
      )}

      {canUseGcBuilding(role) && canSeeGcMoney(role) && drawsProject && boardWithChanges && (
        <GcDrawsWindow
          state={boardWithChanges}
          project={drawsProject}
          extras={drawExtras(drawTables)}
          waiverFiles={openWaiverFiles}
          chargeId={drawsChargeId}
          checkLink={async (url) => (await checkDriveAccess(url)).access}
          emailTick={canSendGcTradeEmail(role) ? { on: drawEmailOn, onChange: setDrawEmailOn } : null}
          busy={drawBusy}
          problem={drawProblem}
          ownCrew={{
            reads: crewReads,
            linked: crewLinks.map((l) => l.packageId),
            held: loaded ? crewJobsHeld(loaded.projects, drawsProject.id, gcJobsOf) : [],
            ...(canUseGcBuilding(role) ? { writes: ownCrewWrites } : {}),
          }}
          onClose={() => setDrawsWindow(null)}
          writes={{
            onCameIn: (d) => drawWrite(d.packageId, d.packageId, drawCameIn(d), 'The pay application was not recorded.'),
            onApprove: (packageId, drawId) => drawWrite(drawId, packageId, approveDraw(drawId), 'It was not approved.'),
            onApproveLess: (packageId, drawId, weApprove, note) =>
              drawWrite(drawId, packageId, approveDrawLess(drawId, weApprove, note), 'It was not approved.', (project, to) => {
                const draw = drawOf(project, packageId, drawId)
                return draw ? lessEmail(to, draw) : null
              }),
            onSendBack: (packageId, drawId, weSee, note) => drawWrite(drawId, packageId, sendDrawBack(drawId, weSee, note), 'It was not sent back.'),
            onPay: (packageId, drawId) =>
              drawWrite(drawId, packageId, payDraw(drawId), 'It was not marked paid.', (project, to) => {
                const draw = drawOf(project, packageId, drawId)
                return draw ? paidEmail(to, draw) : null
              }),
            onWaiverIn: (packageId, drawId) => drawWrite(drawId, packageId, drawWaiverIn(drawId), 'The waiver was not recorded.'),
            onCharge: (packageId, c) =>
              drawWrite(packageId, packageId, chargeTrade(packageId, c.amount, c.reason, c.photoUrl), 'They were not charged.', (project, to, chargeId) => {
                const charge = chargeOf(project, packageId, chargeId)
                return charge ? chargeEmail(to, charge, 'sent') : null
              }),
            onSettleCharge: (packageId, chargeId, keep, note) =>
              drawWrite(chargeId, packageId, settleBackCharge(chargeId, keep, note), keep ? 'The charge was not kept.' : 'The charge was not dropped.', (project, to) => {
                const charge = chargeOf(project, packageId, chargeId)
                return charge ? chargeEmail(to, charge, 'settled') : null
              }),
            onTakeCharge: (packageId, chargeId, drawId) =>
              drawWrite(chargeId, packageId, takeBackCharge(chargeId, drawId), 'The charge was not taken off the draw.', (project, to) => {
                const charge = chargeOf(project, packageId, chargeId)
                return charge ? chargeEmail(to, charge, 'taken', drawOf(project, packageId, drawId)?.number ?? null) : null
              }),
            onSendChange: (packageId, changeOrderId) =>
              drawWrite(changeOrderId, packageId, sendTradeChange(changeOrderId), 'The change was not sent.', (project, to) => {
                const co = project.changeOrders?.find((x) => x.id === changeOrderId)
                return co ? changeEmail(to, co) : null
              }),
            // U6d: their signature on paper adds a line to their statement of work, which the board reads.
            onChangeSignedIn: (packageId, changeOrderId, file) =>
              drawWrite(
                changeOrderId,
                packageId,
                changeSignedIn(changeOrderId, file).then(async (line) => {
                  await refreshBoard()
                  return line
                }),
                'Their signature was not recorded.',
              ),
          }}
        />
      )}

      {canUseGcBuilding(role) && canSeeGcMoney(role) && closeoutProject && closeoutState && (
        <GcCloseoutWindow
          state={closeoutState}
          project={closeoutProject}
          own={ownWork}
          extras={drawExtras(drawTables)}
          waiverFiles={openWaiverFiles}
          checkLink={async (url) => (await checkDriveAccess(url)).access}
          emailTick={canSendGcTradeEmail(role) ? { on: drawEmailOn, onChange: setDrawEmailOn } : null}
          billsRead={closeoutBillsRead}
          busy={closeoutBusy}
          problem={closeoutProblem}
          onSeeBill={() => closeoutToBill(closeoutProject.id)}
          punchWrites={punchWritesFor(setCloseoutBusy, setCloseoutProblem, loadCloseout)}
          onClose={() => setCloseoutWindow(null)}
          writes={{
            onAccept: (packageId) => closeoutWrite(packageId, acceptWork(packageId), 'The work was not accepted.', { board: true }, { packageId, kind: 'accepted' }),
            onFinalCameIn: (d) => closeoutWrite(d.packageId, finalPayAppCameIn(d), 'The final pay application was not recorded.', {}, { packageId: d.packageId, kind: 'finalIn' }),
            onApproveRelease: (_packageId, drawId) => closeoutWrite(drawId, approveRetainage(drawId), 'The release was not approved.'),
            onPay: (packageId, drawId) => closeoutWrite(drawId, payDraw(drawId), 'It was not marked paid.', {}, { packageId, kind: 'paid', drawId }),
            onWaiverIn: (_packageId, drawId) => closeoutWrite(drawId, drawWaiverIn(drawId), 'Their final release was not recorded.'),
            onCloseJob: () => closeoutWrite(closeoutProject.id, closeJob(closeoutProject.id), 'The job was not closed.', { projects: true }),
          }}
        />
      )}

      {/* The waiver window sits below ours (z 1100), so Bill the customer steps aside while it is open. */}
      {canSeeGcMoney(role) && billProject && billState && !waiverFor && (
        <GcBillCustomerWindow
          state={billState}
          project={billProject}
          today={today}
          busy={billBusy}
          problem={billProblem}
          waived={(billRows?.billing.get(billProject.id)?.payApps ?? []).filter((a) => a.conditional_waiver_id !== null).map((a) => a.number)}
          unconditional={billUnconditional}
          unbilled={billUnbilled}
          emailed={billEmailed}
          interestEmailed={billInterestEmailed}
          scheduleRead={billScheduleRead}
          cardOfferOn={billCardOfferOn}
          onClose={() => setBillWindow(null)}
          writes={{
            onSend: (email) => {
              // Send files it; the tick (off to start) also emails it to the customer and the architect with its form
              // (O4b). The bills are read again either way, and an email that did not go is said after.
              const draft = ownerPayApp(billState, billProject)
              const form = ownerPayAppForm(billState, billProject, 'draft')
              setBillBusy('send')
              setBillProblem(null)
              void (async () => {
                try {
                  const id = await sendOwnerPayApp(billProject.id, payAppSendPayload(draft, today))
                  let emailProblem: string | null = null
                  if (email && form) {
                    try {
                      // The form as it went: the draft's figures, dated the day Send recorded, as a later download draws it.
                      const record = ownerPayAppToSend(draft, today)
                      const sentForm = { ...form, sentOn: record.sentOn }
                      const parties = ownerPayAppParties(billState, billProject, sentForm)
                      const pdf = { filename: payAppFileName(parties, 'pdf'), base64: pdfBase64(await payAppPdf(sentForm.app, parties)) }
                      const facts = payAppMailFacts(billState, billProject, record)
                      for (const [kind, mail] of [['pay_app', payAppMail(facts)], ['certify_ask', certifyAskMail(facts)]] as const) {
                        const a = await sendGcCustomerEmail({ projectId: billProject.id, kind, sourceId: id, subject: mail.subject, lines: mail.lines, pdf })
                        if (!a.ok && !emailProblem) emailProblem = `The pay application went, but an email did not. ${gcCustomerEmailRefusal(a.key)}`
                      }
                    } catch (e) {
                      emailProblem = formatErrorMessage(e, 'The pay application went, but its email did not.')
                    }
                  }
                  await loadBill()
                  if (emailProblem) setBillProblem(emailProblem)
                } catch (e) {
                  setBillProblem(formatErrorMessage(e, 'The pay application did not go.'))
                } finally {
                  setBillBusy(null)
                }
              })()
            },
            onCertify: (number, amount, on, note, email) => {
              const id = billRows?.billing.get(billProject.id)?.payApps.find((a) => a.number === number)?.id
              const app = ownerPayAppsSent(billProject).find((a) => a.number === number)
              if (!id) return
              // The tick (off to start) also emails the customer the certified bill (O4b-2), when there is one: nothing
              // certified makes no bill. The bills are read again either way, and an email that did not go is said after.
              setBillBusy(`cert-${number}`)
              setBillProblem(null)
              void (async () => {
                try {
                  await recordCertificate(id, amount, on, note)
                  let emailProblem: string | null = null
                  if (email && app && amount > 0) {
                    const mail = certifiedMail(certifiedMailFacts(billState, billProject, app, amount, on))
                    const a = await sendGcCustomerEmail({ projectId: billProject.id, kind: 'certified', sourceId: id, subject: mail.subject, lines: mail.lines, pdf: null })
                    if (!a.ok) emailProblem = `The certificate is recorded, but its email did not go. ${gcCustomerEmailRefusal(a.key)}`
                  }
                  await loadBill()
                  if (emailProblem) setBillProblem(emailProblem)
                } catch (e) {
                  setBillProblem(formatErrorMessage(e, 'The certificate was not recorded.'))
                } finally {
                  setBillBusy(null)
                }
              })()
            },
            onRemind: (number, by, note) => {
              const id = billRows?.billing.get(billProject.id)?.payApps.find((a) => a.number === number)?.id
              if (!id) return
              // The reminder is filed first, with its note on the chase list (O5b); then gc-customer-email sends it in the
              // words it was filed with. The bills are read again either way, and an email that did not go is said after.
              const customer = billState.customers.find((c) => c.id === billProject.customerId)
              const mail = payReminderEmail(billState, customer, billProject, number, by, note)
              setBillBusy(`remind-${number}`)
              setBillProblem(null)
              void (async () => {
                try {
                  const reminderId = await remindCustomerToPay(id, today, by, note, mail.subject, mail.lines)
                  const a = await sendGcCustomerEmail({ projectId: billProject.id, kind: 'reminder', sourceId: reminderId, subject: mail.subject, lines: mail.lines, pdf: null })
                  await loadBill()
                  if (!a.ok) setBillProblem(`The reminder is filed, but its email did not go. ${gcCustomerEmailRefusal(a.key)}`)
                } catch (e) {
                  setBillProblem(formatErrorMessage(e, 'The reminder was not filed.'))
                } finally {
                  setBillBusy(null)
                }
              })()
            },
            onAccept: (on, byName, note) => billWrite('accept', () => recordAcceptance(billProject.id, on, byName, note), 'The acceptance was not recorded.'),
            onSendFinal: (email) => {
              // Our final pay application (O7a): every line done, nothing held, it asks for the rest. The tick, off to start,
              // also emails it with its form, as Send's. The bills are read again either way, and an email that did not go is said after.
              const record = ownerFinalPayAppToSend(billState, billProject, today)
              const form = finalPayAppForm(billState, billProject, today)
              setBillBusy('send-final')
              setBillProblem(null)
              void (async () => {
                try {
                  const id = await sendOwnerPayApp(billProject.id, finalPayAppSendPayload(billState, billProject, today))
                  let emailProblem: string | null = null
                  if (email && form) {
                    try {
                      const parties = ownerPayAppParties(billState, billProject, form)
                      const pdf = { filename: payAppFileName(parties, 'pdf'), base64: pdfBase64(await payAppPdf(form.app, parties)) }
                      const facts = payAppMailFacts(billState, billProject, record)
                      for (const [kind, mail] of [['pay_app', payAppMail(facts)], ['certify_ask', certifyAskMail(facts)]] as const) {
                        const a = await sendGcCustomerEmail({ projectId: billProject.id, kind, sourceId: id, subject: mail.subject, lines: mail.lines, pdf })
                        if (!a.ok && !emailProblem) emailProblem = `The final pay application went, but an email did not. ${gcCustomerEmailRefusal(a.key)}`
                      }
                    } catch (e) {
                      emailProblem = formatErrorMessage(e, 'The final pay application went, but its email did not.')
                    }
                  }
                  await loadBill()
                  if (emailProblem) setBillProblem(emailProblem)
                } catch (e) {
                  setBillProblem(formatErrorMessage(e, 'The final pay application did not go.'))
                } finally {
                  setBillBusy(null)
                }
              })()
            },
            onSetRetainage: (pct, step) => billWrite('retainage', () => setOwnerRetainage(billProject.id, pct, step), 'The retainage was not saved.'),
            onSetPayDays: (days) => billWrite('paydays', () => setOwnerPayDays(billProject.id, days), 'The days to pay were not saved.'),
            onSetInterest: (pct) => billWrite('interest', () => setOwnerLateInterest(billProject.id, pct), 'The interest was not saved.'),
            onSetLateFee: (perDay) => billWrite('latefee', () => setOwnerLateFinish(billProject.id, perDay), 'The late fee was not saved.'),
            onBillInterest: (amount, email) => {
              // The interest bill is filed first, with its bill on the billing job (O6b-2); the tick, off to start, emails
              // it to the customer. The bills are read again either way, and an email that did not go is said after.
              setBillBusy('bill-interest')
              setBillProblem(null)
              void (async () => {
                try {
                  const id = await sendOwnerInterestBill(billProject.id, amount)
                  let emailProblem: string | null = null
                  if (email) {
                    const mail = interestBillMail(interestBillMailFacts(billState, billProject, amount))
                    const a = await sendGcCustomerEmail({ projectId: billProject.id, kind: 'interest_bill', sourceId: id, subject: mail.subject, lines: mail.lines, pdf: null })
                    if (!a.ok) emailProblem = `The interest bill is filed, but its email did not go. ${gcCustomerEmailRefusal(a.key)}`
                  }
                  await loadBill()
                  if (emailProblem) setBillProblem(emailProblem)
                } catch (e) {
                  setBillProblem(formatErrorMessage(e, 'The interest bill was not filed.'))
                } finally {
                  setBillBusy(null)
                }
              })()
            },
            onDownload: (which, kind) => {
              const form = ownerPayAppForm(billState, billProject, which)
              if (!form) return
              const parties = ownerPayAppParties(billState, billProject, form)
              billWrite('file', () => (kind === 'xlsx' ? downloadPayAppExcel : downloadPayAppPdf)(form.app, parties), 'The form did not download.', false)
            },
            onWaiver: openWaiver,
            onPaid: (number) => {
              const invoiceId = billInvoiceOf(number)
              if (invoiceId) billWrite(`pay-${number}`, () => recordGcPayment(invoiceId, null, today), 'The payment was not recorded.')
            },
            onPayPart: (number, amount) => {
              const invoiceId = billInvoiceOf(number)
              if (invoiceId) billWrite(`pay-${number}`, () => recordGcPayment(invoiceId, amount, today), 'The payment was not recorded.')
            },
            // Back to a check bill (O8c): gc-card-bill's undo door voids the Stripe invoice and takes the fee off.
            onCardUndo: (number) => {
              const invoiceId = billInvoiceOf(number)
              if (invoiceId) billWrite(`card-${number}`, () => takeBillOffCard(invoiceId), 'The bill did not go back to a check bill.')
            },
            onPromise: (number, by, note, channel) => {
              if (billJobId) billWrite(`promise-${number}`, () => recordGcPromise(billJobId, by, note, channel), 'When they said they will pay was not recorded.')
            },
            onUnconditional: openUnconditional,
          }}
        />
      )}

      {canSeeGcMoney(role) && waiverFor && (
        <LienReleaseModal
          open
          job={waiverFor.job}
          invoice={waiverFor.invoiceId ? (waiverFor.job.invoices.find((i) => i.id === waiverFor.invoiceId) ?? null) : null}
          invoiceIds={waiverFor.invoiceId ? [waiverFor.invoiceId] : []}
          initialFormType={waiverFor.formType}
          ask={waiverFor.ask}
          signerNameFallback={(profileName ?? '').trim()}
          onClose={() => setWaiverFor(null)}
          onIssued={(releaseId) => {
            // The conditional one links to its pay application once; an unconditional one names its bill, so the bills are read again.
            if (waiverFor.ask) {
              if (releaseId) billWrite('waiver', () => linkPayAppWaiver(waiverFor.payAppId, releaseId), 'The waiver was made, but not linked to its pay application.')
            } else billWrite('waiver', () => Promise.resolve(), 'The bills did not load.')
          }}
        />
      )}

      {questionsProject && loaded && (
        <GcQuestionsWindow
          project={questionsProject}
          architectName={loaded.customers.find((c) => c.id === questionsProject.architectId)?.name ?? null}
          today={today}
          busy={questionBusy}
          problem={questionProblem}
          answerReach={answerReach}
          onClose={() => setQuestionsWindow(null)}
          writes={{
            onRecord: (q) => questionWrite(null, recordQuestion({ projectId: questionsProject.id, ...q }), 'The question was not recorded.'),
            onSendToArchitect: (id) =>
              questionWrite(
                id,
                sendQuestionToArchitect(id).then((r) => showToast(`Sent to ${r.to}.`, 'success')),
                'The question was not sent.',
              ),
            onMarkSent: (id) => questionWrite(id, markQuestionSent(id, today), 'The question was not marked sent.'),
            onAnswer: (id, answer, to) =>
              questionWrite(
                id,
                answerQuestion(id, answer).then(() => emailAnswer(id, answer, to)),
                to.length > 0 ? 'The answer was not sent.' : 'The answer was not recorded.',
              ),
            onSendAnswer: (id, to) => {
              const answer = questionsProject.questions.find((x) => x.id === id)?.answer ?? ''
              questionWrite(id, emailAnswer(id, answer, to), 'The answer was not sent.')
            },
          }}
        />
      )}

      {setProject && loaded && (
        <GcNewPlansWindow
          project={setProject}
          book={book}
          team={loaded.team}
          today={today}
          issuing={issuing}
          problem={issueProblem}
          parties={setParties}
          canSend={canSendGcTradeEmail(role)}
          sendReport={pendingSends ? { summary: setEmailSummary(pendingSends.results), failed: pendingSends.results.filter((r) => r.outcome === 'failed').length } : null}
          onRetrySends={() => {
            if (!pendingSends) return
            const again = pendingSends.recipients.filter((r) => pendingSends.results.some((x) => x.companyId === r.companyId && x.outcome === 'failed'))
            setIssuing(true)
            void sendSetEmails({ setId: pendingSends.setId, projectId: pendingSends.projectId, set: pendingSends.set, recipients: again })
              .then((retried) => {
                const results = pendingSends.results.map((r) => retried.find((x) => x.companyId === r.companyId) ?? r)
                if (results.some((r) => r.outcome === 'failed')) setPendingSends({ ...pendingSends, results })
                else {
                  setPendingSends(null)
                  setSetWindow(null)
                  showToast(setEmailSummary(results), 'success')
                }
              })
              .catch((e) => showToast(formatErrorMessage(e, 'The emails did not go out.'), 'error'))
              .finally(() => setIssuing(false))
          }}
          onClose={() => setSetWindow(null)}
          onIssue={(draft, emailTo) => {
            setIssuing(true)
            setIssueProblem(null)
            void (async () => {
              // The set's Drive link is checked first, like the first set's; a link the helper cannot see is still recorded.
              let drive = draft.drive
              if (drive) {
                try {
                  const v = await checkDriveAccess(drive.url)
                  drive = { url: drive.url, access: v.access, checkedOn: v.checkedOn }
                } catch {
                  drive = { url: drive.url, access: null, checkedOn: null }
                }
              }
              const setId = await issuePlanSet({ ...draft, ...(drive ? { drive } : {}) })
              // Step 7: the set is on; now each company asked on the job hears, once.
              let results: SetEmailResult[] = []
              const set = { label: draft.label, project: setProject.name, note: draft.note, sheets: draft.sheets, quoteDueOn: questionsCloseOn(setProject) }
              if (emailTo.length > 0) results = await sendSetEmails({ setId, projectId: setProject.id, set, recipients: emailTo })
              await load()
              if (results.some((r) => r.outcome === 'failed')) {
                setPendingSends({ setId, projectId: setProject.id, set, recipients: emailTo, results })
                return
              }
              setSetWindow(null)
              showToast(`${draft.label} is on ${setProject.name}.${results.length > 0 ? ` ${setEmailSummary(results)}` : ''}`, 'success')
            })()
              .catch((e) => setIssueProblem(formatErrorMessage(e, 'The set was not put on the project.')))
              .finally(() => setIssuing(false))
          }}
        />
      )}

      {bookOpen && loaded && bookInput && (
        <GcScopeBookWindow
          input={bookInput}
          onClose={() => setBook(null)}
          startTrade={bookTrade ?? undefined}
          current={current}
          writes={{
            onSave: (trade, words, spec) => after(saveScopeBookLine(trade, words, spec), 'The line was not saved.'),
            onEdit: (trade, words, to) => after(editScopeBookLine(trade, words, to), 'The line was not changed.'),
            onMerge: (trade, from, into) => after(mergeScopeBookLines(trade, from, into), 'The lines were not folded.'),
            onSaveSet: (trade, name, lines, fromProjectId) => after(saveScopeSet(trade, name, lines, fromProjectId), 'The set was not saved.'),
          }}
        />
      )}

      {windowOpen && loaded && bookInput && (
        <GcNewProjectWindow
          customers={loaded.customers}
          book={book}
          setsFor={(trade) => scopeSetsFor(bookInput, trade)}
          today={today}
          creating={creating}
          problem={createProblem}
          onClose={() => setWindow(false)}
          onSaveToBook={(trade, words, spec) => {
            void saveScopeBookLine(trade, words, spec)
              .then(() => load())
              .catch((e) => showToast(formatErrorMessage(e, 'The line was not saved.'), 'error'))
          }}
          onCreate={(draft) => {
            setCreating(true)
            setCreateProblem(null)
            void createGcProject(draft)
              .then(async (id) => {
                await load()
                setJustMade(id)
                setWindow(false)
                showToast(`${draft.name} is made.`, 'success')
                // Its folder in Drive, with Plans and Team only inside (step 5). A failure is said, never a stop.
                try {
                  const folders = await makeDriveFolders(id)
                  await load()
                  if (!folders.plansShared) showToast(`The folders are made, but Plans could not be shared with anyone with the link: ${folders.reason ?? 'Drive said no'}.`, 'error')
                } catch (e) {
                  showToast(formatErrorMessage(e, 'The Drive folders were not made.'), 'error')
                }
              })
              .catch((e) => setCreateProblem(formatErrorMessage(e, 'The project was not made.')))
              .finally(() => setCreating(false))
          }}
        />
      )}
    </div>
  )
  // A company's name opens its window wherever it shows (the Board's B3-c), for a dev.
  return (
    <GcCompanyOpenerContext.Provider value={companyOpener}>
      <GcCustomerOpenerContext.Provider value={customerOpener}>{page}</GcCustomerOpenerContext.Provider>
    </GcCompanyOpenerContext.Provider>
  )
}
