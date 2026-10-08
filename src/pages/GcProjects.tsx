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
import { canOpenGcProjects, canSeeGcMoney } from '../lib/gc/access'
import { GC_NEW_HERE_CONTROL, GC_NEW_HERE_GUIDE, GC_NEW_HERE_SEEN_KEY, GC_NEW_HERE_STEPS, gcNewHereTarget } from '../lib/gc/tour'
import { recordNavClick } from '../lib/navClickTelemetry'
import { SpotlightTour, spotlightTourStepsPresent, type SpotlightTourStep } from '../components/SpotlightTour'
import { useToastContext } from '../contexts/ToastContext'
import { formatErrorMessage } from '../utils/errorHandling'
import { todayYmdInAppTz } from '../utils/dateUtils'
import { GcNewProjectWindow } from '../components/gc/GcNewProject'
import { GcScopeBookWindow } from '../components/gc/GcScopeBook'
import { GcNewPlansWindow } from '../components/gc/GcNewPlans'
import { GcPlansWindow } from '../components/gc/GcPlansWindow'
import { GcQuestionsWindow } from '../components/gc/GcQuestions'
import { GcChangeOrdersWindow } from '../components/gc/GcChangeOrders'
import { withChangeOrders, type ChangeOrderRow } from '../lib/gc/changeOrderRows'
import { GcMoney } from '../components/gc/GcMoney'
import { billingStateForAll, type BillingRows } from '../lib/gc/billCustomer'
import { openQuestions } from '../lib/gc/questions'
import { Btn, Chip } from '../components/gc/gcUi'
import { BidsModeToggle } from '../components/gc/BidsModeToggle'
import { GcBoard } from '../components/gc/GcBoard'
import { GcTradePartners, type TradePartnerWrites } from '../components/gc/GcTradePartners'
import { GcTradePortals } from '../components/gc/GcTradePortals'
import { GcFollowUp, GcTradeAsks, type AskWrites } from '../components/gc/GcAskThread'
import { GcAskCompanies } from '../components/gc/GcAskCompanies'
import { GcCompareQuotes, type CompareWrites } from '../components/gc/GcCompareQuotes'
import { GcOurNumber } from '../components/gc/GcOurNumber'
import { GcProjectOutcome, type OutcomeWrites } from '../components/gc/GcProjectOutcome'
import { GcCompanyWindow } from '../components/gc/GcCompanyWindow'
import { GcCompanyOpenerContext, type CompanyOpener } from '../components/gc/gcCompanyOpener'
import { benchAnchor, followUpsToCall } from '../lib/gc/tradeViews'
import { boardStateFromRows, type BoardRows } from '../lib/gc/boardRows'
import type { PortalLang } from '../lib/gc/portalI18n'
import {
  addGcCompany,
  askGcCompanies,
  bringGcBack,
  carryGcTrade,
  answerChangeOrder,
  deleteChangeOrderDraft,
  draftChangeOrder,
  loadGcChangeOrders,
  sendChangeOrder,
  setChangeOrderPct,
  checkDriveAccess,
  createGcProject,
  declineGcAsk,
  editScopeBookLine,
  issuePlanSet,
  loadGcTeam,
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
  setGcCompanyCoverage,
  setGcCompanyLanguage,
  vetGcCompany,
  type GcPickerCustomer,
  type GcTeamMember,
  loadGcBillingRows,
} from '../lib/gc/gcIo'
import { DRIVE_RESTRICTED_WORDS } from '../components/gc/GcNewProjectDriveLink'
import { scopeBook, scopeSetsFor, type ScopeBookInput } from '../lib/gc/scopeBook'
import { scopeGaps } from '../lib/gc/plans'
import type { GcProjectView } from '../lib/gc/projectRows'
import type { GcState, ScopeBookStore } from '../lib/gc/types'
import { gcFocusFromSearch } from '../lib/gc/links'

interface Loaded {
  customers: GcPickerCustomer[]
  projects: GcProjectView[]
  store: ScopeBookStore
  team: GcTeamMember[]
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
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
  const [questionBusy, setQuestionBusy] = useState<string | null>(null)
  const [questionProblem, setQuestionProblem] = useState<string | null>(null)
  const [issuing, setIssuing] = useState(false)
  const [issueProblem, setIssueProblem] = useState<string | null>(null)

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
  const [board, setBoard] = useState<GcState | null>(null)
  const [boardProblem, setBoardProblem] = useState<string | null>(null)
  // Each company's language, for the invitation the Ask window draws (the kernels' company carries none yet).
  const [langs, setLangs] = useState<Record<string, PortalLang>>({})
  // Our number (B5-c): the money team reads it; anyone else sees each price as the trades alone.
  const [moneyShown, setMoneyShown] = useState(false)
  const takeRows = (rows: BoardRows) => {
    setBoard(boardStateFromRows(rows))
    setMoneyShown(rows.moneyShown ?? false)
    setLangs(Object.fromEntries(rows.companies.map((c) => [c.id, c.lang === 'es' ? 'es' : 'en'])))
  }
  useEffect(() => {
    if (role !== 'dev' || !loaded || loaded.projects.length === 0) return
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
  const openProjectCard = (projectId: string) => document.querySelector(`[data-gc-project="${projectId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  // Trade partners (the Board's B3-b) and Follow up (B4-b) sit beside the board for a dev: each write reads the rows again.
  const [devView, setDevView] = useState<'board' | 'partners' | 'followUp' | 'portals' | 'money'>('board')
  const refreshBoard = async () => {
    if (loaded) takeRows(await loadGcBoardRows(loaded.projects, today, { money: canSeeGcMoney(role) }))
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
  }
  // Our number (the Board's B5-c), opened on a project's card for the money team; its inputs reload the board.
  const [numberOpen, setNumberOpen] = useState<string | null>(null)
  const saveMoney = async (projectId: string, values: { generalConditions: number; contingencyPct: number; feePct: number }) => {
    await setGcProjectMoney(projectId, values)
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
  // The company window (the Board's B3-c): a company's name opens it wherever the name shows, for a dev.
  const [companyId, setCompanyId] = useState<string | null>(null)
  const companyOpener: CompanyOpener | null = role === 'dev' && board ? { openPartner: setCompanyId } : null
  const openCompany = companyId && board ? (board.partners.find((p) => p.id === companyId) ?? null) : null
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
  const toCall = board ? followUpsToCall(board) : 0
  const devPill = (view: 'board' | 'partners' | 'followUp' | 'portals' | 'money', label: string) => {
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
  const [changeBusy, setChangeBusy] = useState<string | null>(null)
  const [changeProblem, setChangeProblem] = useState<string | null>(null)
  const loadChangeOrders = useCallback(async () => {
    if (!board) return
    setChangeOrderRows(await loadGcChangeOrders(board.projects.map((p) => p.id)))
  }, [board])
  useEffect(() => {
    void loadChangeOrders().catch((e) => setChangeProblem(formatErrorMessage(e, 'The change orders did not load.')))
  }, [loadChangeOrders])
  const boardWithChanges = useMemo(() => (board ? withChangeOrders(board, changeOrderRows) : null), [board, changeOrderRows])
  const changesProject = changesProjectId ? (boardWithChanges?.projects.find((p) => p.id === changesProjectId) ?? null) : null
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

  // Money (Owner Billing's O6a): every job that is ours, with billing read when the lens opens and laid over
  // the board's projects and their change orders. Read only.
  const [moneyRows, setMoneyRows] = useState<BillingRows | null>(null)
  const [moneyProblem, setMoneyProblem] = useState<string | null>(null)
  const ourIds = useMemo(() => (board ? board.projects.filter((p) => p.stage === 'buyout' || p.stage === 'building').map((p) => p.id) : []), [board])
  useEffect(() => {
    if (devView !== 'money' || !board) return
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
  }, [devView, board, ourIds])
  const moneyState = useMemo(() => (boardWithChanges && moneyRows ? billingStateForAll(boardWithChanges, moneyRows, ourIds) : null), [boardWithChanges, moneyRows, ourIds])

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
      {role === 'dev' && loaded && loaded.projects.length > 0 && (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{devView === 'board' ? 'Project Board' : devView === 'partners' ? 'Trade partners' : devView === 'portals' ? 'Trade portals' : devView === 'money' ? 'Money' : 'Follow up'}</h2>
            <Chip tone="grey" title="Only a dev sees the board, Trade partners, Follow up, Trade portals and Money while they are built. Everyone else sees the projects below.">
              Devs only
            </Chip>
            <div role="group" aria-label="Project Board, Trade partners, Follow up, Trade portals or Money" style={{ display: 'flex', gap: '0.35rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
              {devPill('board', 'Project Board')}
              {devPill('partners', 'Trade partners')}
              {devPill('followUp', toCall > 0 ? `Follow up (${toCall})` : 'Follow up')}
              {devPill('portals', 'Trade portals')}
              {devPill('money', 'Money')}
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
              />
            ) : devView === 'partners' ? (
              <GcTradePartners state={board} writes={partnerWrites} onOpenProject={openProjectCard} onAsk={openAsk} trades={[...new Set(loaded.projects.flatMap((p) => p.trades.map((t) => t.trade)))]} />
            ) : devView === 'portals' ? (
              <GcTradePortals state={board} />
            ) : devView === 'money' ? (
              moneyState ? (
                <GcMoney state={moneyState} />
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
        // The board's reading of this project, for a dev while it is built (B5-c's outcome and Our number).
        const boardProject = role === 'dev' ? board?.projects.find((x) => x.id === p.id) : undefined
        const showNumber = boardProject && canSeeGcMoney(role)
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
              {boardWithChanges && p.stage !== 'bidding' && !p.lostOn && (
                <Btn kind="quiet" onClick={() => setChangesWindow(p.id)}>
                  {(() => {
                    const count = changeOrderRows.filter((r) => r.project_id === p.id).length
                    return count > 0 ? `Change orders · ${count}` : 'Change orders'
                  })()}
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
            </div>
            {boardProject && <GcProjectOutcome project={boardProject} writes={outcomeWrites(p.id)} />}
            {showNumber && board && numberOpen === p.id && <GcOurNumber state={board} project={boardProject} onSave={(values) => saveMoney(p.id, values)} />}
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
                  {/* The trade's asks and their stories (the Board's B4-b), for a dev while it is built. */}
                  {role === 'dev' && board && <GcTradeAsks state={board} projectId={p.id} packageId={t.id} writes={askWrites} onAsk={() => openAsk(p.id, t.id)} onCompare={() => setComparing({ projectId: p.id, packageId: t.id })} />}
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
      {openCompany && board && (
        <GcCompanyWindow
          key={openCompany.id}
          state={board}
          partner={openCompany}
          lang={langs[openCompany.id] ?? 'en'}
          onLanguage={async (lang) => {
            await setGcCompanyLanguage(openCompany.id, lang)
            await refreshBoard()
          }}
          onClose={() => setCompanyId(null)}
          onOpenProject={(projectId) => {
            setCompanyId(null)
            openProjectCard(projectId)
          }}
        />
      )}
      {comparing && board && (
        <GcCompareQuotes key={comparing.packageId} state={board} projectId={comparing.projectId} packageId={comparing.packageId} writes={compareWrites} onClose={() => setComparing(null)} />
      )}
      {asking && board && (
        <GcAskCompanies
          key={`${asking.projectId}:${asking.packageId}`}
          state={board}
          projectId={asking.projectId}
          packageId={asking.packageId}
          {...(asking.tick ? { tick: asking.tick } : {})}
          langs={langs}
          onAsk={async (companyIds) => {
            await askGcCompanies(asking.packageId, companyIds, profileName ?? '', today)
            await refreshBoard()
          }}
          onClose={() => setAsking(null)}
        />
      )}

      {changesProject && boardWithChanges && (
        <GcChangeOrdersWindow
          state={boardWithChanges}
          project={changesProject}
          today={today}
          busy={changeBusy}
          problem={changeProblem}
          onClose={() => setChangesWindow(null)}
          writes={{
            onDraft: (draft) => changeWrite('new', draftChangeOrder(changesProject.id, draft), 'The change order was not drafted.'),
            onSend: (id) => changeWrite(id, sendChangeOrder(id, today), 'The change order was not marked sent.'),
            onAnswer: (id, signed, on) => changeWrite(id, answerChangeOrder(id, signed, on), 'Their answer was not recorded.'),
            onSetPct: (id, pct) => changeWrite(id, setChangeOrderPct(id, pct), 'The percent done was not saved.'),
            onDelete: (id) => changeWrite(id, deleteChangeOrderDraft(id), 'The draft was not deleted.'),
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
            onAnswer: (id, answer) => questionWrite(id, answerQuestion(id, answer), 'The answer was not recorded.'),
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
          onClose={() => setSetWindow(null)}
          onIssue={(draft) => {
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
              await issuePlanSet({ ...draft, ...(drive ? { drive } : {}) })
              await load()
              setSetWindow(null)
              showToast(`${draft.label} is on ${setProject.name}.`, 'success')
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
  return <GcCompanyOpenerContext.Provider value={companyOpener}>{page}</GcCompanyOpenerContext.Provider>
}
