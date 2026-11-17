import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'
import { prospectsPagePadding } from '../lib/prospects/pagePadding'
import { pageTabStyle } from '../lib/pageTabStyle'
import { isOwnerOrDev } from '../lib/doorRoles'
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { myTimeWindows, sumTimerSeconds } from '../lib/prospects/prospectTimerSums'
import {
  indexAfterOtherRowLeft,
  insertColdest,
  queueAfterRemoval,
  type CallingOrderMode,
} from '../lib/prospects/callingOrder'
import { findRetaggableNote, type CallInteractionType } from '../lib/prospects/callLogState'
import { useAuth } from '../hooks/useAuth'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { resolveCompanyOwnerUserId } from '../lib/companyOwner'
import { useToastContext } from '../contexts/ToastContext'
import { useConfirmDialog, usePromptDialog } from '../contexts/ConfirmDialogContext'
import { useNewCustomerModal } from '../contexts/NewCustomerModalContext'
import {
  canAccessProspectPipeline,
  customerDraftFromProspect,
  markProspectConverted,
  markProspectOnBench,
  sourceProspectOf,
} from '../lib/prospects/prospectConversion'
import { readRememberedProspectsTopTab, rememberProspectsTopTab, resolveProspectsLanding } from '../lib/prospects/prospectsLanding'
import { PROSPECT_KINDS, PROSPECT_KIND_WORDS, benchDraftFromProspect, kindFromUrlKey, prospectLandedToast, urlKeyForKind, type BenchDraft, type ProspectKind } from '../lib/prospects/prospectKinds'
import { addGcCompany, askGcCompanies } from '../lib/gc/gcIo'
import { kindFromSearch } from '../lib/prospects/laneLoad'
import { doubleLaneParams, type CompanyDouble } from '../lib/prospects/companyDouble'
import { prospectTitle, type OkToText } from '../lib/prospects/personBlock'
import { stillQueued } from '../lib/prospects/subsLane'
import { gcNeeds } from '../lib/prospects/gcNeeds'
import { cardClockTicks, emptyLaneWords } from '../lib/prospects/deckWords'
import { type EmptyStateWords } from '../components/EmptyState'
import { emptyWords, emptyWordsWithPress } from '../lib/emptyWords'
import { useZzTestJobsHidden } from '../lib/jobs/zzTestJobSwitch'
import { GcCallScriptWindow } from '../components/gc/GcCallScriptWindow'
import { jobToHandOn, newProjectSeedFromLead } from '../lib/prospects/gcLeadLane'
import { setProspectJobStatus } from '../lib/prospects/gcLeadLaneIo'
import { ProspectBenchModal } from '../components/prospects/ProspectBenchModal'
import { ProspectsResearchTab } from '../components/prospects/ProspectsResearchTab'
import { canResearchPermits } from '../lib/research/permitResearch'
import { permitsLinkCleared } from '../lib/research/permitsLink'
import { ProspectCallbackModal } from '../components/prospects/ProspectCallbackModal'
import { ProspectsActivityTab } from '../components/prospects/ProspectsActivityTab'
import { ProspectsConvertTab } from '../components/prospects/ProspectsConvertTab'
import { EditProspectWindow } from '../components/prospects/EditProspectWindow'
import { NewProspectWindow } from '../components/prospects/NewProspectWindow'
import { useEditProspectWindow } from '../components/prospects/useEditProspectWindow'
import { useNewProspectWindow } from '../components/prospects/useNewProspectWindow'
import { DIDNT_ANSWER_MOVE_NEXT_KEY, ProspectsFollowUpTab } from '../components/prospects/ProspectsFollowUpTab'
import { ProspectsListTab } from '../components/prospects/ProspectsListTab'
import { useProspectListTab } from '../components/prospects/useProspectListTab'
import { ProspectCopyBlankFieldsModal } from '../components/prospects/ProspectCopyBlankFieldsModal'
import { ProspectCopyTemplateEditModal } from '../components/prospects/ProspectCopyTemplateEditModal'
import { useProspectCopyTemplates } from '../components/prospects/useProspectCopyTemplates'
import { useCallRun } from '../components/prospects/useCallRun'
import { useCallingLock } from '../components/prospects/useCallingLock'
import { useProspectConvert } from '../components/prospects/useProspectConvert'
import { useProspectDoubles } from '../components/prospects/useProspectDoubles'
import { useProspectJobs } from '../components/prospects/useProspectJobs'
import { useProspectsData } from '../components/prospects/useProspectsData'
import { useSubsBench } from '../components/prospects/useSubsBench'
import { useSubsBoardData } from '../components/prospects/useSubsBoardData'
import { ProspectMyTimeModal } from '../components/prospects/ProspectMyTimeModal'
import { ProspectTimerHistoryModal } from '../components/prospects/ProspectTimerHistoryModal'
import { SubsBoard } from '../components/prospects/SubsBoard'
import { SubsPathStrip } from '../components/prospects/SubsPathStrip'
import { subRecords } from '../lib/prospects/subRecord'
import { tradeKey } from '../lib/prospects/subsLane'
import { callbackHourFor, callbackWords, runCallbackNote, runCallbackTitle, runFromSearch, runHref } from '../lib/prospects/callRun'
import { benchAskFor, benchAskedToast, type BenchAsk } from '../lib/prospects/benchAsk'
import TeamProspectsTab from '../components/prospects/TeamProspectsTab'
import { useMyHiringShares } from '../hooks/useMyHiringShares'
import { todayYmdInAppTz } from '../utils/dateUtils'
import { formatErrorMessage } from '../utils/errorHandling'
import { releaseCallingLock } from '../lib/prospects/callingLockIo'
import { type Prospect, type ProspectComment } from '../lib/prospects/prospectRow'

type ProspectsTopTab = 'customers' | 'team' | 'research'

type ProspectsTab = 'follow-up' | 'board' | 'prospect-list' | 'convert' | 'activity'

const PROSPECTS_TABS: ProspectsTab[] = ['follow-up', 'board', 'prospect-list', 'convert', 'activity']

const tabStyle = (active: boolean) => ({
  ...pageTabStyle(active),
  padding: '0.5rem 0.6rem',
  fontSize: '0.9375rem',
})



export default function Prospects() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user: authUser, role: authRole, loading: authLoading, estimatorProspectsAccess, teamProspectsAccess } = useAuth()
  // A phone has no room for the desk's margins: the page keeps a thin edge and gives the rest to its cards.
  const isMobile = useIsMobile()
  // The ZZ rule for prospects (v2.5583): a ZZ-named company is a dev's test row, hidden from every role but dev.
  const hideZz = useZzTestJobsHidden(authRole)
  // v2.3805: a column share opens the Hiring pill too — the board then renders trimmed (`shared`).
  const { sharedRoleIds: myHiringShares, loading: hiringSharesLoading } = useMyHiringShares(authUser?.id)
  const canOpenHiring = teamProspectsAccess || myHiringShares.length > 0
  // Research (punch list #292): the permit ledger opens to the office and every estimator, flagged or not.
  const canResearch = canResearchPermits(authRole)
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const promptDialog = usePromptDialog()
  const newCustomerModal = useNewCustomerModal()
  const [searchParams, setSearchParams] = useSearchParams()
  const [topTab, setTopTab] = useState<ProspectsTopTab>('customers')
  const [activeTab, setActiveTab] = useState<ProspectsTab>('follow-up')
  // Which kind of company the deck is finding (v2.5559): customers, jobs to GC or subs. `?kind=`.
  // The lane from the link before the first load (v2.5578): starting on the customer deck and reading
  // `?kind=` afterwards raced two loads, and a refresh could paint the Customers deck under a lane's tab.
  const [kind, setKind] = useState<ProspectKind>(() => kindFromSearch(location.search))
  const kindWords = PROSPECT_KIND_WORDS[kind]
  // Add to the bench ✓ (v2.5559): the sub's card as the bench's Add a company.
  const [benchDraft, setBenchDraft] = useState<{ prospect: Prospect; draft: BenchDraft; ask: BenchAsk | null } | null>(null)
  const [benchSaving, setBenchSaving] = useState(false)
  const [benchError, setBenchError] = useState<string | null>(null)
  // The Subs lane (v2.5560): the bench's trades and how many each can count on (null: not read, or
  // refused), the bench's companies for the double check, the lane's whole queue for the counts,
  // and the call script's window.
  // New Prospect's open flag and its kind sit here, above the lane reads that follow them.
  const [newProspectModalOpen, setNewProspectModalOpen] = useState(false)
  const [newKind, setNewKind] = useState<ProspectKind>('customer')
  // The bench (v2.5560), read by `useSubsBench` when the lane or New Prospect's kind is Subs.
  const { benchTrades, gcBench, benchCompanies, benchQuoted, gcPlans } = useSubsBench(kind, newKind, authUser?.id ?? null)
  // What the Subs Board reads beside the lane's rows, and its pin writes.
  const { inboundProspectIds, laneCallbacks, setLaneCallbacks, lanePins, loadLaneRanks, loadLaneExtras, dropOnBoard, unpinOnBoard } = useSubsBoardData({ userId: authUser?.id ?? null })
  // The lane's data: the deck and the list, the card that is up, the call-history sets, the two loaders, the calling order.
  // `mergeJobs` is the jobs hook's, called further down; a loader only runs after the render that made both.
  const data = useProspectsData({
    kind,
    userId: authUser?.id ?? null,
    hideZz,
    searchParams,
    setSearchParams,
    benchTrades,
    mergeJobs: (ids) => mergeJobs(ids),
    loadLaneRanks,
    loadLaneExtras,
  })
  const {
    followUpProspects,
    setFollowUpProspects,
    currentProspectIndex,
    setCurrentProspectIndex,
    currentProspect,
    currentProspectId,
    followUpLoading,
    prospectListProspects,
    setProspectListProspects,
    prospectListLoading,
    prospectLastCallMap,
    laneAllRows,
    setLaneAllRows,
    laneQueueAll,
    answeredProspectIds,
    laneCallRows,
    calledProspectIds,
    callingOrderMode,
    loadFollowUpProspects,
    loadProspectListProspects,
    updateUrlProspectId,
    markCalledLocally,
  } = data
  /** The calling order's switch: the data hook reloads the deck in the new order, and the phone's order sheet folds. */
  const switchCallingOrder = (mode: CallingOrderMode) => {
    if (data.switchCallingOrder(mode)) setShowCallingOrder(false)
  }
  const subRecordMap = useMemo(() => subRecords({ calls: laneCallRows, inbound: inboundProspectIds }), [laneCallRows, inboundProspectIds])
  const [scriptOpen, setScriptOpen] = useState(false)
  const tradeFilter = searchParams.get('trade')
  // The path onto the bench (v2.5807, punch list #153): every sub row for the strip's counts, who has answered,
  // which bench companies have quoted, the projects a set of plans could be for (the For picker, `?for=`), and
  // which of the list's groups are open.
  const plansFor = searchParams.get('for')
  const plansPick = kind === 'sub' && plansFor ? gcPlans.find((c) => c.id === plansFor) ?? null : null
  // The board and the run (v2.5808): the lane's call rows for each sub's record, the lines back on their threads, the
  // upcoming callbacks, the run the link names (`?run=`), what the run did so far, and the text press's state.
  const run = kind === 'sub' ? runFromSearch(location.search) : null
  // The Jobs to GC lane (v2.5561): each lead's jobs, how much GC work is in flight (null: not read, or
  // refused), the customers for the double check, and the customer a new lead is linked to.
  const { gcWork, gcBidding, customerDoubles, prospectDoubles } = useProspectDoubles({ kind, newKind, newProspectModalOpen, userId: authUser?.id ?? null })

  // Follow Up state
  const [comments, setComments] = useState<ProspectComment[]>([])
  const [callbackModalOpen, setCallbackModalOpen] = useState(false)
  const [commentInputValue, setCommentInputValue] = useState('')
  const [commentInputRef, setCommentInputRef] = useState<HTMLTextAreaElement | null>(null)
  const [saving, setSaving] = useState(false)
  const [scheduledCallback, setScheduledCallback] = useState<{ callback_date: string; note: string | null } | null>(null)
  const [followUpTimerSeconds, setFollowUpTimerSeconds] = useState(0)

  // Edit form state
  // The person we call and the company under them (v2.5601), the two blocks both windows share.

  // Callback form state

  // Prospect List state
  const [followUpNotes, setFollowUpNotes] = useState('')
  const [followUpNotesSaving, setFollowUpNotesSaving] = useState(false)

  // Per-user quick notes (e.g. "left voicemail") - below comments textarea, above saved comments
  const [quickNotes, setQuickNotes] = useState<Array<{ id: string; label: string; sequence_order: number }>>([])

  // Per-user preference: move to next prospect when Didn't Answer is clicked
  const [didntAnswerMoveNext, setDidntAnswerMoveNext] = useState(false)

  const [showCallingOrder, setShowCallingOrder] = useState(false)

  // Ref to ignore stale loadComments responses when prospect changes quickly
  const loadCommentsForProspectRef = useRef<string | null>(null)

  // Timer history modal
  const [timerHistoryModalOpen, setTimerHistoryModalOpen] = useState(false)

  // My time modal
  const [myTimeModalOpen, setMyTimeModalOpen] = useState(false)
  const [myTimeTodaySeconds, setMyTimeTodaySeconds] = useState(0)

  // Total time spent on current prospect (sum of past timer events for this prospect)
  const [prospectLedgerSeconds, setProspectLedgerSeconds] = useState(0)

  // Total time spent per prospect for Prospect List (prospect_id -> seconds)

  // New Prospect modal state
  /** May we text? on the card (v2.5606): the chip opens the three answers. */
  const [textAskOpen, setTextAskOpen] = useState(false)


  // Activity tab state (dev and assistant) - last 30 days
  /** The caller's own name off `users`: the copy templates, the bench's ask and the run's text sign with it. */
  const [authUserName, setAuthUserName] = useState<string>('')
  /** The week the Activity tab's pager is on. It stays here so it survives a visit to another tab. */
  const [weekOffset, setWeekOffset] = useState(0)
  const canAccessActivityTab = authRole === 'dev' || isAssistantLike(authRole)

  useEffect(() => {
    // The per-user grants arrive with the role; deciding a cold landing before
    // they settle would send every Hiring holder to the calling deck.
    if (authLoading || hiringSharesLoading) return
    const params = new URLSearchParams(location.search)
    const tab = params.get('tab')
    // A door from elsewhere (the bench's Find N more, v2.5559): `?tab=subs` or `?tab=gc-leads` names the kind.
    const aliasKind: ProspectKind | null = tab === 'subs' ? 'sub' : tab === 'gc-leads' ? 'gc_lead' : null
    if (aliasKind) {
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'follow-up')
        next.set('kind', urlKeyForKind(aliasKind))
        return next
      }, { replace: true })
      return
    }
    const urlKind = kindFromUrlKey(params.get('kind'))
    if (urlKind !== kind) setKind(urlKind)
    if (tab === 'team') {
      // Top-level Team tab: the prospective-hires board (per-user users.team_prospects_access, or a column share)
      if (canOpenHiring) {
        setTopTab('team')
      } else {
        setSearchParams((p) => {
          const next = new URLSearchParams(p)
          next.set('tab', 'follow-up')
          return next
        }, { replace: true })
        setTopTab('customers')
        setActiveTab('follow-up')
      }
    } else if (tab === 'permits' || tab === 'research') {
      // The Permits tab (punch list #292; named Research until v2.6787, so the old key still opens it).
      if (canResearch) {
        setTopTab('research')
        if (tab === 'research') {
          setSearchParams((p) => {
            const next = new URLSearchParams(p)
            next.set('tab', 'permits')
            return next
          }, { replace: true })
        }
      } else {
        setSearchParams((p) => {
          const next = new URLSearchParams(p)
          next.set('tab', 'follow-up')
          return next
        }, { replace: true })
        setTopTab('customers')
        setActiveTab('follow-up')
      }
    } else if (tab && PROSPECTS_TABS.includes(tab as ProspectsTab)) {
      if ((tab === 'activity' && !canAccessActivityTab) || (tab === 'convert' && urlKind !== 'customer') || (tab === 'board' && urlKind !== 'sub')) {
        setSearchParams((p) => {
          const next = new URLSearchParams(p)
          next.set('tab', 'follow-up')
          return next
        }, { replace: true })
        setTopTab('customers')
        setActiveTab('follow-up')
      } else {
        setTopTab('customers')
        setActiveTab(tab as ProspectsTab)
      }
    } else if (!tab) {
      // No tab named (the nav link): a Hiring holder who cannot work the
      // customer deck lands on Hiring, not a live prospect card with a timer
      // (v2.2910, J25-F1). Kernel: resolveProspectsLanding.
      const followUpOk = !!authUser && canAccessProspectPipeline(authRole, estimatorProspectsAccess)
      const landing = resolveProspectsLanding({
        canAccessFollowUp: followUpOk,
        teamProspectsAccess: canOpenHiring,
        remembered: readRememberedProspectsTopTab(),
      })
      // An estimator with no Prospects flag has one door here: Permits (punch list #292).
      const dest = landing === 'follow-up' && !followUpOk && canResearch ? 'permits' : landing
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', dest)
        return next
      }, { replace: true })
    }
  }, [location.search, setSearchParams, authLoading, hiringSharesLoading, authUser, authRole, estimatorProspectsAccess, canAccessActivityTab, canOpenHiring, canResearch, kind])

  // Open New Prospect modal when navigating from Dashboard button
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('newProspect') === 'true') {
      setNewProspectModalOpen(true)
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.delete('newProspect')
        return next
      }, { replace: true })
    }
  }, [location.search, setSearchParams])

  // The strip counts the lane as it stands: a sub the deck took off (an outcome, a delete) leaves the count with it.
  const deckIds = new Set(followUpProspects.map((p) => p.id))
  const laneQueueNow = kind === 'sub' ? stillQueued(laneQueueAll, deckIds, tradeFilter) : []
  // The panel over the Subs deck (v2.5782): every trade short of quotes or short on the bench, then the book's.
  const gcNeedsNow = kind === 'sub' ? gcNeeds(gcBench.benches, laneQueueNow, gcBench.ownTrades) : null
  /** The Prospect List with nothing to list: a search's own Clear the search, else the lane's empty words and New Prospect. */
  const prospectListEmpty = (): EmptyStateWords => {
    if (prospectListSearchQuery.trim()) {
      return emptyWordsWithPress(emptyWords({ kind: 'filter', noun: kind === 'sub' ? 'subs' : 'prospects', query: prospectListSearchQuery }), { onPress: () => setProspectListSearchQuery('') })
    }
    const words = emptyLaneWords(kind, null)
    return { main: words.main, next: { label: words.doorLabel, onPress: openNewProspect }, tail: words.tail }
  }
  /** Open it on a prospect double (v2.5579): the form closes and the card opens on its own lane. */
  function openDoubleProspect(twin: Extract<CompanyDouble, { door: 'open_prospect' }>) {
    const lane = doubleLaneParams(twin)
    setNewProspectModalOpen(false)
    rememberProspectsTopTab('follow-up')
    setTopTab('customers')
    setActiveTab('follow-up')
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('tab', 'follow-up')
      if (lane.kind) next.set('kind', lane.kind)
      else next.delete('kind')
      next.set('prospect_id', lane.prospect_id)
      next.delete('trade')
      return next
    })
  }

  const setTradeFilter = (trade: string | null) => {
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      if (trade) next.set('trade', trade)
      else next.delete('trade')
      next.delete('prospect_id')
      return next
    })
  }

  /** The For picker (v2.5807): the project a set of plans is for, carried on `?for=` so every sub-tab reads it. */
  const setPlansFor = (id: string | null) => {
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      if (id) next.set('for', id)
      else next.delete('for')
      return next
    })
  }

  const setTab = (tab: ProspectsTab) => {
    rememberProspectsTopTab('follow-up')
    setTopTab('customers')
    setActiveTab(tab)
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.set('tab', tab)
      next.delete('prospect_id')
      return next
    })
  }

  /** The three kind pills (v2.5559): the same deck, finding a different kind of company. */
  const setKindTab = (next: ProspectKind) => {
    rememberProspectsTopTab('follow-up')
    setTopTab('customers')
    setKind(next)
    const tab: ProspectsTab = (activeTab === 'convert' && next !== 'customer') || (activeTab === 'board' && next !== 'sub') ? 'follow-up' : activeTab
    setActiveTab(tab)
    setSearchParams((p) => {
      const params = new URLSearchParams(p)
      params.set('tab', tab)
      if (next === 'customer') params.delete('kind')
      else params.set('kind', urlKeyForKind(next))
      params.delete('prospect_id')
      // The Subs lane's trade filter (v2.5560) is the lane's own; another lane never carries it.
      if (next !== 'sub') {
        params.delete('trade')
        params.delete('for')
      }
      return params
    })
  }

  const openResearchTab = () => {
    setTopTab('research')
    setSearchParams((p) => {
      // The tab's name opens it on Skim: what Builders left on the address from an earlier visit is dropped.
      const next = permitsLinkCleared(p)
      next.set('tab', 'permits')
      next.delete('prospect_id')
      return next
    })
  }

  const openTeamTab = () => {
    rememberProspectsTopTab('team')
    setTopTab('team')
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.set('tab', 'team')
      next.delete('prospect_id')
      return next
    })
  }

  async function loadComments(prospectId: string) {
    const { data, error } = await supabase
      .from('prospect_comments')
      .select('id, prospect_id, created_by, created_at, comment_text, interaction_type, created_by_user:users!prospect_comments_created_by_fkey(name, email)')
      .eq('prospect_id', prospectId)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[Prospects] loadComments failed:', error)
      setComments([])
      return
    }
    if (loadCommentsForProspectRef.current !== prospectId) return
    setComments((data ?? []) as ProspectComment[])
  }

  async function loadMyTimeToday() {
    if (!authUser?.id) return
    const { startOfToday, endOfToday } = myTimeWindows(new Date())
    const { data } = await (supabase as any)
      .from('prospect_timer_events')
      .select('timer_seconds')
      .eq('user_id', authUser.id)
      .gte('created_at', startOfToday.toISOString())
      .lte('created_at', endOfToday.toISOString())
    setMyTimeTodaySeconds(sumTimerSeconds((data ?? []) as { timer_seconds: number }[]))
  }

  /** Call first · Normal · Later (v2.5809), on a board card or the deck's card. */
  async function savePriority(prospect: Prospect, value: 1 | null | 3) {
    if ((prospect.priority ?? null) === value) return
    const { error } = await supabase.from('prospects').update({ priority: value }).eq('id', prospect.id)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    const patch = (p: Prospect) => (p.id === prospect.id ? { ...p, priority: value } : p)
    setFollowUpProspects((prev) => prev.map(patch))
    setProspectListProspects((prev) => prev.map(patch))
    setLaneAllRows((prev) => prev.map(patch))
  }

  async function loadQuickNotes() {
    if (!authUser?.id) return
    const { data } = await supabase
      .from('user_prospect_quick_notes')
      .select('id, label, sequence_order')
      .eq('user_id', authUser.id)
      .order('sequence_order')
    setQuickNotes((data ?? []) as Array<{ id: string; label: string; sequence_order: number }>)
  }

  useEffect(() => {
    if (authUser?.id) {
      loadQuickNotes()
      supabase.from('users').select('name').eq('id', authUser.id).maybeSingle().then(({ data }) => {
        setAuthUserName((data as { name: string } | null)?.name ?? '')
      })
    } else {
      setAuthUserName('')
    }
  }, [authUser?.id])

  useEffect(() => {
    if (topTab === 'customers' && activeTab === 'follow-up' && authUser?.id) {
      loadFollowUpProspects()
      loadMyTimeToday()
    }
  }, [topTab, activeTab, authUser?.id, searchParams, kind, benchTrades])

  useEffect(() => {
    if ((activeTab === 'prospect-list' || activeTab === 'convert' || activeTab === 'board') && authUser?.id) {
      loadProspectListProspects()
    }
  }, [activeTab, authUser?.id, kind])

  // Source success (v2.5560): the Activity tab of a new kind reads the lane's rows by where we found them.
  useEffect(() => {
    if (activeTab === 'activity' && kind !== 'customer' && authUser?.id) {
      loadProspectListProspects()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, authUser?.id, kind])

  // The Prospect List tab's own state. It is called here, not inside the tab, so the search and the open sections
  // survive a visit to another tab.
  const list = useProspectListTab({
    active: activeTab === 'prospect-list',
    userId: authUser?.id ?? null,
    searchParams,
    setSearchParams,
    prospectListProspects,
    prospectLastCallMap,
    showDeck: () => setActiveTab('follow-up'),
  })
  const { prospectListSearchQuery, setProspectListSearchQuery } = list
  // The Edit Prospect window: its boxes, its leave guard and its writes. It edits the deck's card, or a row from the list or the Board.
  const editWin = useEditProspectWindow({
    currentProspect,
    followUpProspects,
    currentProspectIndex,
    saving,
    setSaving,
    setFollowUpProspects,
    setProspectListProspects,
    setCurrentProspectIndex,
    setFollowUpTimerSeconds,
    updateUrlProspectId,
  })
  const { editModalOpen, editingProspect, openEditModal, openEditModalForProspect } = editWin
  // The New Prospect window: its boxes, its leave guard, the double's answer and its save.
  const newWin = useNewProspectWindow({
    kind,
    newKind,
    setNewKind,
    newProspectModalOpen,
    setNewProspectModalOpen,
    saving,
    setSaving,
    userId: authUser?.id ?? null,
    prospectDoubles,
    benchCompanies,
    customerDoubles,
    getEffectiveMasterId,
    setKindTab,
    reloadLane: async () => {
      await loadFollowUpProspects()
      await loadProspectListProspects()
    },
  })
  const { openNewProspect, openAddSub } = newWin

  // The Convert tab's engine. It is called here, not inside the tab, so the picked prospect and the typed cards
  // survive a visit to another tab.
  const convert = useProspectConvert({
    active: activeTab === 'convert',
    prospectListProspects,
    followUpProspects,
    prospectLastCallMap,
    authUserId: authUser?.id ?? null,
    authRole,
    onConverted: (prospectId) => {
      setProspectListProspects((prev) => prev.map((p) => (p.id === prospectId ? { ...p, prospect_fit_status: 'converted' } : p)))
      setFollowUpProspects((prev) => prev.filter((p) => p.id !== prospectId))
    },
  })

  // The advisory calling lock: taken on intent (a dial, the composer, an outcome, a callback), never on view.
  const { lockHeldBy, takeCallingLock } = useCallingLock({ onDeck: topTab === 'customers' && activeTab === 'follow-up', currentProspectId, userId: authUser?.id ?? null, authRole })
  // What the run has done so far: its notes, its receipt flag, the callback a missed call set, the text press.
  const { runOutcomes, runDone, setRunDone, runCallbackAt, setRunCallbackAt, runTextState, noteRunOutcome, sendRunText } = useCallRun({
    run,
    userId: authUser?.id ?? null,
    authUserName,
    projectName: plansPick?.name ?? null,
    currentProspectId,
    loadComments,
  })
  // The Customers lane's three email templates: their words, the presses, the two windows' state.
  const copy = useProspectCopyTemplates({ userId: authUser?.id ?? null, userEmail: authUser?.email, authUserName, currentProspect, comments })
  // A lead's jobs and the Jobs box's writes. The loaders above call `mergeJobs`; it is theirs by the time they run.
  const { jobsByProspect, mergeJobs, addJobFor, editJobFor, changeJob, markJobLost, removeJob } = useProspectJobs({ userId: authUser?.id ?? null, currentProspectId })
  useEffect(() => {
    setTextAskOpen(false)
  }, [currentProspectId])

  useEffect(() => {
    setFollowUpNotes(currentProspect?.notes ?? '')
  }, [currentProspect?.id, currentProspect?.notes])

  async function saveFollowUpNotes() {
    if (!currentProspect || followUpNotesSaving) return
    setFollowUpNotesSaving(true)
    const { error } = await supabase
      .from('prospects')
      .update({ notes: followUpNotes.trim() || null })
      .eq('id', currentProspect.id)
    if (!error) {
      const updated = { ...currentProspect, notes: followUpNotes.trim() || null }
      setFollowUpProspects((prev) =>
        prev.map((p) => (p.id === currentProspect.id ? updated : p))
      )
      setProspectListProspects((prev) =>
        prev.map((p) => (p.id === currentProspect.id ? updated : p))
      )
    }
    setFollowUpNotesSaving(false)
  }

  function cancelFollowUpNotes() {
    setFollowUpNotes(currentProspect?.notes ?? '')
  }

  // The caller's own fresh plain note on the current prospect — Didn't Answer /
  // Answered will retag it into the call (see callLogState.ts), and the
  // composer says so while that holds.
  const retaggableNote =
    authUser?.id && currentProspect
      ? findRetaggableNote(comments.filter((c) => c.prospect_id === currentProspect.id), authUser.id, Date.now())
      : null

  useEffect(() => {
    if (currentProspect?.id) {
      loadCommentsForProspectRef.current = currentProspect.id
      loadComments(currentProspect.id)
    } else {
      loadCommentsForProspectRef.current = null
      setComments([])
    }
  }, [currentProspect?.id])

  async function loadProspectLedgerSeconds(prospectId: string) {
    if (!authUser?.id) return
    const { data } = await (supabase as any)
      .from('prospect_timer_events')
      .select('timer_seconds')
      .eq('user_id', authUser.id)
      .eq('prospect_id', prospectId)
    setProspectLedgerSeconds(sumTimerSeconds((data ?? []) as Array<{ timer_seconds: number }>))
  }

  useEffect(() => {
    if (currentProspect?.id && authUser?.id) {
      loadProspectLedgerSeconds(currentProspect.id)
    } else {
      setProspectLedgerSeconds(0)
    }
  }, [currentProspect?.id, authUser?.id])

  const loadScheduledCallback = useCallback(async () => {
    if (!currentProspect?.id || !authUser?.id) {
      setScheduledCallback(null)
      return
    }
    const now = new Date().toISOString()
    const { data } = await supabase
      .from('prospect_callbacks')
      .select('callback_date, note')
      .eq('prospect_id', currentProspect.id)
      .eq('user_id', authUser.id)
      .gte('callback_date', now)
      .order('callback_date', { ascending: true })
      .limit(1)
      .maybeSingle()
    const row = data as { callback_date?: string; note?: string | null } | null
    if (row?.callback_date) {
      setScheduledCallback({ callback_date: row.callback_date, note: row.note ?? null })
    } else {
      setScheduledCallback(null)
    }
  }, [currentProspect?.id, authUser?.id])

  useEffect(() => {
    loadScheduledCallback()
  }, [loadScheduledCallback])

  // Follow Up timer: counts up while on tab, resets when user leaves and comes back
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setFollowUpTimerSeconds(0)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // The card's clock ticks only while a card is up (v2.5581): an empty lane used to count, then stamp its minutes on the first card added.
  useEffect(() => {
    if (!cardClockTicks({ onDeck: topTab === 'customers' && activeTab === 'follow-up', visible: document.visibilityState === 'visible', hasCard: !!currentProspect })) return
    const interval = setInterval(() => {
      setFollowUpTimerSeconds((s) => s + 1)
    }, 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topTab, activeTab, currentProspect?.id])

  // Auto-resize comment textarea as text wraps
  useEffect(() => {
    const el = commentInputRef
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.max(72, el.scrollHeight) + 'px'
  }, [commentInputValue, commentInputRef])

  // Load "Didn't Answer move next" preference from localStorage
  useEffect(() => {
    if (!authUser?.id) return
    const stored = localStorage.getItem(DIDNT_ANSWER_MOVE_NEXT_KEY(authUser.id))
    setDidntAnswerMoveNext(stored === 'true')
  }, [authUser?.id])

  function openCallbackModal() {
    takeCallingLock('callback')
    setCallbackModalOpen(true)
  }

  async function saveCallback(callbackDate: string, callbackTime: string, callbackNote: string) {
    if (!currentProspect || !authUser?.id || saving) return
    const dateTime = new Date(`${callbackDate}T${callbackTime}`).toISOString()
    const title = runCallbackTitle(currentProspect.company_name, currentProspect.contact_name)
    setSaving(true)
    const { error } = await supabase.from('prospect_callbacks').insert({
      prospect_id: currentProspect.id,
      user_id: authUser.id,
      callback_date: dateTime,
      title,
      note: callbackNote.trim() || null,
    })
    if (!error) {
      setCallbackModalOpen(false)
      loadScheduledCallback()
    }
    setSaving(false)
  }

  async function saveTimerEvent(buttonName: 'no_longer_fit' | 'next_prospect' | 'cant_reach' | 'converted') {
    if (!authUser?.id || !currentProspect) return
    await (supabase as any).from('prospect_timer_events').insert({
      user_id: authUser.id,
      prospect_id: currentProspect.id,
      timer_seconds: followUpTimerSeconds,
      button_name: buttonName,
    })
  }

  async function handleNoLongerFit() {
    if (!currentProspect || !authUser?.id || saving) return
    setSaving(true)
    const prospectId = currentProspect.id
    const { error: updErr } = await supabase
      .from('prospects')
      .update({ prospect_fit_status: 'not_a_fit' })
      .eq('id', prospectId)
    if (updErr) {
      setSaving(false)
      return
    }
    await saveTimerEvent('no_longer_fit')
    releaseCallingLock(prospectId, authUser.id)
    loadMyTimeToday()
    noteRunOutcome(prospectId, 'not_a_fit')
    await supabase.from('prospect_comments').insert({
      prospect_id: currentProspect.id,
      created_by: authUser.id,
      comment_text: 'Marked as not a fit',
      interaction_type: 'no_longer_fit',
    })
    const left = queueAfterRemoval(followUpProspects, currentProspectIndex, currentProspect.id)
    setFollowUpProspects(left.queue)
    setCurrentProspectIndex(left.index)
    setFollowUpTimerSeconds(0)
    updateUrlProspectId(left.nextId)
    setSaving(false)
  }

  async function handleCantReach() {
    if (!currentProspect || !authUser?.id || saving) return
    setSaving(true)
    const prospectId = currentProspect.id
    const { error } = await supabase
      .from('prospects')
      .update({ prospect_fit_status: 'cant_reach' })
      .eq('id', prospectId)
    if (error) {
      setSaving(false)
      return
    }
    await saveTimerEvent('cant_reach')
    releaseCallingLock(prospectId, authUser.id)
    loadMyTimeToday()
    noteRunOutcome(prospectId, 'cant_reach')
    const updated = { ...currentProspect, prospect_fit_status: 'cant_reach' as const }
    setProspectListProspects((prev) => prev.map((p) => (p.id === currentProspect.id ? updated : p)))
    const left = queueAfterRemoval(followUpProspects, currentProspectIndex, currentProspect.id)
    setFollowUpProspects(left.queue)
    setCurrentProspectIndex(left.index)
    setFollowUpTimerSeconds(0)
    updateUrlProspectId(left.nextId)
    setSaving(false)
  }

  /**
   * "Converted ✓" (v2.2879, J34-F4): they became a customer — so make one.
   * Opens the global Add customer modal prefilled from this prospect with the
   * prospect pre-linked; Save creates the customer, marks the prospect
   * converted (the shared `markProspectConverted` tail) and hands the new row
   * back here, where the queue advances. Cancel writes nothing (decision #17).
   */
  function handleConverted() {
    if (!currentProspect || !authUser?.id || saving) return
    if (!newCustomerModal) return
    const prospect = currentProspect
    newCustomerModal.openNewCustomerModal({
      initialValues: customerDraftFromProspect(prospect),
      sourceProspect: sourceProspectOf(prospect),
      conversionLane: 'follow-up',
      onCreated: (customer, meta) => {
        const convertedId = meta?.convertedProspectId ?? null
        if (convertedId !== prospect.id) {
          // The user unlinked the prospect (or the mark failed): the customer
          // exists, the prospect stays in the queue — say so and stop.
          showToast(`Customer ${customer.name || ''} created — ${prospect.company_name || 'the prospect'} is still in the calling queue`, 'info')
          return
        }
        // saveTimerEvent closes over this render's prospect + timer seconds —
        // the values as of the click, which is what the ledger wants.
        void saveTimerEvent('converted')
        releaseCallingLock(prospect.id, authUser.id)
        loadMyTimeToday()
        const updated = { ...prospect, prospect_fit_status: 'converted' as const }
        setProspectListProspects((prev) => prev.map((p) => (p.id === prospect.id ? updated : p)))
        const left = queueAfterRemoval(followUpProspects, currentProspectIndex, prospect.id)
        setFollowUpProspects(left.queue)
        setCurrentProspectIndex(left.index)
        setFollowUpTimerSeconds(0)
        updateUrlProspectId(left.nextId)
        showToast(prospectLandedToast(prospect.kind, prospect.company_name || '', customer.name || ''), 'success')
      },
    })
  }

  /**
   * The job a landing can be asked on (v2.5810): the run's trade and package on the deck; on the board, with a project
   * picked, the first of the sub's trades the project buys out.
   */
  function benchAskForProspect(p: Prospect): BenchAsk | null {
    const projectName = plansPick?.name ?? null
    if (run && p.id === currentProspect?.id) return benchAskFor(run, projectName)
    if (!plansPick || !projectName) return null
    for (const trade of p.trades ?? []) {
      const packageId = plansPick.packageByTrade[tradeKey(trade)]
      if (packageId) return { projectName, trade: plansPick.trades.find((t) => tradeKey(t) === tradeKey(trade)) ?? trade, packageId }
    }
    return null
  }

  /** Add to the bench ✓ (v2.5559): the sub's card as the bench's Add a company, filled in. Since v2.5807 a list row presses it too. */
  function openBenchModal(p?: Prospect) {
    const prospect = p ?? currentProspect
    if (!prospect || !authUser?.id || saving) return
    setBenchError(null)
    setBenchDraft({ prospect, draft: benchDraftFromProspect(prospect), ask: benchAskForProspect(prospect) })
  }

  async function handleBenchSave(draft: BenchDraft, askNow: boolean) {
    const prospect = benchDraft?.prospect ?? null
    const ask = askNow ? benchDraft?.ask ?? null : null
    if (!prospect || !authUser?.id || benchSaving) return
    setBenchSaving(true)
    setBenchError(null)
    try {
      const companyId = await addGcCompany(draft)
      const marked = await markProspectOnBench(prospect.id, companyId, draft.name, authUser.id)
      if (!marked.ok) {
        // The company is on the bench; the prospect stays in the queue — say so and stop.
        showToast(`${draft.name} is on the bench — ${prospect.company_name || 'the prospect'} is still in the calling queue`, 'info')
        setBenchDraft(null)
        return
      }
      // The ask on landing (v2.5810): the ask Trade partners makes, on the job's package; the invitation goes out as asks do
      // today (a dev sends it from Trade partners, else the ask carries the note). A refusal here leaves the landing whole.
      let asked = false
      let askSent = false
      if (ask) {
        try {
          const outcomes = await askGcCompanies(ask.packageId, [companyId], authUserName || authUser.email || '', todayYmdInAppTz(), null)
          asked = true
          askSent = outcomes.some((o) => o.sent)
        } catch (err) {
          showToast(`${draft.name} is on the bench, but the ask did not save: ${formatErrorMessage(err, 'try it from Trade partners')}`, 'error')
        }
      }
      // From the deck the card advances as every landing does; from a list row (v2.5807) the caches are patched and the deck
      // keeps its card, so the list never jumps to Follow Up.
      const onDeck = currentProspect?.id === prospect.id
      if (onDeck) void saveTimerEvent('converted')
      releaseCallingLock(prospect.id, authUser.id)
      loadMyTimeToday()
      const updated = { ...prospect, prospect_fit_status: 'converted' as const, converted_gc_company_id: companyId }
      setProspectListProspects((prev) => prev.map((p) => (p.id === prospect.id ? updated : p)))
      setLaneAllRows((prev) => prev.map((p) => (p.id === prospect.id ? updated : p)))
      const left = queueAfterRemoval(followUpProspects, currentProspectIndex, prospect.id)
      setFollowUpProspects(left.queue)
      if (onDeck) {
        setCurrentProspectIndex(left.index)
        setFollowUpTimerSeconds(0)
        updateUrlProspectId(left.nextId)
      } else {
        const stays = indexAfterOtherRowLeft(followUpProspects, currentProspectIndex, prospect.id)
        if (stays !== currentProspectIndex) setCurrentProspectIndex(stays)
      }
      setBenchDraft(null)
      noteRunOutcome(prospect.id, 'bench', { asked })
      showToast(asked && ask ? benchAskedToast(draft.name, ask.projectName, askSent) : prospectLandedToast('sub', draft.name, ''), 'success')
    } catch (err) {
      setBenchError(formatErrorMessage(err, 'That did not save.'))
    } finally {
      setBenchSaving(false)
    }
  }

  /** The lead's deck after a landing (v2.5561): out of the queue, the caches patched, the next card up. */
  function leaveQueueAsLanded(prospect: Prospect, patch: Partial<Prospect>) {
    if (!authUser?.id) return
    void saveTimerEvent('converted')
    releaseCallingLock(prospect.id, authUser.id)
    loadMyTimeToday()
    const updated = { ...prospect, prospect_fit_status: 'converted' as const, ...patch }
    setProspectListProspects((prev) => prev.map((p) => (p.id === prospect.id ? updated : p)))
    const left = queueAfterRemoval(followUpProspects, currentProspectIndex, prospect.id)
    setFollowUpProspects(left.queue)
    setCurrentProspectIndex(left.index)
    setFollowUpTimerSeconds(0)
    updateUrlProspectId(left.nextId)
  }

  /**
   * Asked us ✓ (v2.5561): the lead becomes a customer (the one on file when linked, else Add customer),
   * the job with the soonest bid is marked asked, and New project opens with it filled in.
   */
  function handleAskedUs() {
    if (!currentProspect || !authUser?.id || saving) return
    const prospect = currentProspect
    const landed = async (customer: { id: string; name: string | null }) => {
      const job = jobToHandOn(jobsByProspect[prospect.id] ?? [])
      if (job) {
        try {
          await setProspectJobStatus(job.id, 'asked')
        } catch {
          /* the job keeps reading open; the project still opens */
        }
      }
      leaveQueueAsLanded(prospect, { converted_customer_id: customer.id })
      showToast(prospectLandedToast('gc_lead', prospect.company_name || '', customer.name || ''), 'success')
      navigate('/gc?new=1', { state: { newProjectSeed: newProjectSeedFromLead(prospect, job, customer.id) } })
    }
    if (prospect.customer_id) {
      // Already a customer: no second record. Mark the prospect and go.
      void markProspectConverted(prospect.id, prospect.customer_id, prospect.company_name || '', authUser.id).then((res) => {
        if (!res.ok) {
          showToast(`${prospect.company_name || 'The prospect'} could not be marked: ${res.error}`, 'error')
          return
        }
        void landed({ id: prospect.customer_id as string, name: prospect.company_name })
      })
      return
    }
    if (!newCustomerModal) return
    newCustomerModal.openNewCustomerModal({
      initialValues: customerDraftFromProspect(prospect),
      sourceProspect: sourceProspectOf(prospect),
      conversionLane: 'follow-up',
      onCreated: (customer, meta) => {
        if ((meta?.convertedProspectId ?? null) !== prospect.id) {
          showToast(`Customer ${customer.name || ''} created — ${prospect.company_name || 'the prospect'} is still in the calling queue`, 'info')
          return
        }
        void landed({ id: customer.id, name: customer.name })
      },
    })
  }

  async function handleSendBack(p: Prospect) {
    if (saving) return
    setSaving(true)
    const { error } = await supabase
      .from('prospects')
      .update({ prospect_fit_status: null })
      .eq('id', p.id)
    if (!error) {
      setProspectListProspects((prev) => prev.map((x) => (x.id === p.id ? { ...x, prospect_fit_status: null } : x)))
      setFollowUpProspects((prev) => insertColdest(prev, { ...p, prospect_fit_status: null }))
    }
    setSaving(false)
  }

  async function handleNotAFitFromList(p: Prospect) {
    if (saving) return
    setSaving(true)
    const { error } = await supabase
      .from('prospects')
      .update({ prospect_fit_status: 'not_a_fit' })
      .eq('id', p.id)
    if (!error) {
      setProspectListProspects((prev) => prev.map((x) => (x.id === p.id ? { ...x, prospect_fit_status: 'not_a_fit' } : x)))
    }
    setSaving(false)
  }

  async function handleDeleteFromList(p: Prospect) {
    if (saving) return
    if (
      !(await confirmDialog({
        message: `Delete prospect "${p.company_name || 'Unknown'}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
      }))
    )
      return
    setSaving(true)
    const { error } = await supabase.from('prospects').delete().eq('id', p.id)
    if (!error) {
      setFollowUpProspects((prev) => prev.filter((x) => x.id !== p.id))
      setProspectListProspects((prev) => prev.filter((x) => x.id !== p.id))
    }
    setSaving(false)
  }

  // Where the call row comes from: the typed text, or — with an empty
  // composer — the caller's own fresh plain note, retagged into the call
  // (callers type the result and press Enter, which files a plain note; the
  // outcome button then used to add a boilerplate "Contacted" beside it).
  // prospect_comments has select/insert/delete policies but no UPDATE, so a
  // retag is insert-then-delete: the new row carries the note's text and its
  // original timestamp, and the old row goes only once the new one is in.
  async function writeCallOutcome(prospectId: string, type: CallInteractionType, fallbackText: string): Promise<boolean> {
    if (!authUser?.id) return false
    const typed = commentInputValue.trim()
    const retag = typed
      ? null
      : findRetaggableNote(comments.filter((c) => c.prospect_id === prospectId), authUser.id, Date.now())
    const { error } = await supabase.from('prospect_comments').insert({
      prospect_id: prospectId,
      created_by: authUser.id,
      comment_text: retag ? retag.comment_text : typed || fallbackText,
      interaction_type: type,
      ...(retag?.created_at ? { created_at: retag.created_at } : {}),
    })
    if (error) {
      showToast(error.message, 'error')
      return false
    }
    if (retag) {
      const { error: delErr } = await supabase.from('prospect_comments').delete().eq('id', retag.id)
      if (delErr) showToast(`Logged the call, but the note it replaced could not be removed: ${delErr.message}`, 'error')
    }
    return true
  }

  /** Pass on a board card (v2.5808): Not a fit, after one question, since the board has no undo of its own. */
  async function passFromBoard(p: Prospect) {
    const ok = await confirmDialog({ message: `${prospectTitle(p)}: not a company we would hire? It leaves the queue. Send back on the Prospect List returns it.`, confirmLabel: 'Pass' })
    if (!ok) return
    await handleNotAFitFromList(p)
    setLaneAllRows((prev) => prev.map((x) => (x.id === p.id ? { ...x, prospect_fit_status: 'not_a_fit' } : x)))
  }

  async function handleDidntAnswer() {
    if (!currentProspect || !authUser?.id || saving) return
    takeCallingLock('outcome')
    setSaving(true)
    const ok = await writeCallOutcome(currentProspect.id, 'didnt_answer', 'Prospect did not answer')
    if (ok) {
      const now = new Date().toISOString()
      await supabase.from('prospects').update({ last_contact: now }).eq('id', currentProspect.id)
      setFollowUpProspects((prev) =>
        prev.map((p) => (p.id === currentProspect.id ? { ...p, last_contact: now } : p))
      )
      markCalledLocally(currentProspect.id, 'didnt_answer', now)
      await loadComments(currentProspect.id)
      setCommentInputValue('')
      if (run) {
        // In a run (v2.5808) a missed call sets the callback and offers the text; the caller moves on with Next in the run.
        const at = callbackHourFor(new Date())
        const { error: cbErr } = await supabase.from('prospect_callbacks').insert({
          prospect_id: currentProspect.id,
          user_id: authUser.id,
          callback_date: at.toISOString(),
          title: runCallbackTitle(currentProspect.company_name, currentProspect.contact_name),
          note: runCallbackNote(run.trade, plansPick?.name ?? null),
        })
        if (cbErr) showToast(`The call is logged, but the callback did not save: ${cbErr.message}`, 'error')
        else {
          setRunCallbackAt(at)
          void loadScheduledCallback()
          setLaneCallbacks((prev) => ({ ...prev, [currentProspect.id]: callbackWords(at, new Date()) }))
        }
        noteRunOutcome(currentProspect.id, 'didnt_answer')
      } else if (didntAnswerMoveNext && followUpProspects.length > 1) {
        handleNextProspect(true)
      }
    }
    setSaving(false)
  }

  async function handleAnswered() {
    if (!currentProspect || !authUser?.id || saving) return
    takeCallingLock('outcome')
    setSaving(true)
    const ok = await writeCallOutcome(currentProspect.id, 'answered', 'Contacted')
    if (ok) {
      const now = new Date().toISOString()
      // Auto-warm (v2.2458): a conversation is what warmth measures, so an
      // Answered bumps it by one — no more manual counter on the workstation.
      const newWarmth = (currentProspect.warmth_count ?? 0) + 1
      await supabase.from('prospects').update({ last_contact: now, warmth_count: newWarmth }).eq('id', currentProspect.id)
      setFollowUpProspects((prev) =>
        prev.map((p) => (p.id === currentProspect.id ? { ...p, last_contact: now, warmth_count: newWarmth } : p))
      )
      setProspectListProspects((prev) =>
        prev.map((p) => (p.id === currentProspect.id ? { ...p, last_contact: now, warmth_count: newWarmth } : p))
      )
      markCalledLocally(currentProspect.id, 'answered', now)
      await loadComments(currentProspect.id)
      setCommentInputValue('')
      noteRunOutcome(currentProspect.id, 'answered')
    }
    setSaving(false)
  }

  async function handleAddComment() {
    if (!currentProspect || !authUser?.id || saving) return
    const text = commentInputValue.trim()
    if (!text) return
    setSaving(true)
    const { error } = await supabase.from('prospect_comments').insert({
      prospect_id: currentProspect.id,
      created_by: authUser.id,
      comment_text: text,
      interaction_type: 'user_comment',
    })
    if (!error) {
      const now = new Date().toISOString()
      await supabase.from('prospects').update({ last_contact: now }).eq('id', currentProspect.id)
      setFollowUpProspects((prev) =>
        prev.map((p) => (p.id === currentProspect.id ? { ...p, last_contact: now } : p))
      )
      await loadComments(currentProspect.id)
      setCommentInputValue('')
    }
    setSaving(false)
  }

  function handleQuickNoteClick(label: string) {
    setCommentInputValue(label)
  }

  async function handleAddQuickNote() {
    if (!authUser?.id) return
    const label = await promptDialog({ message: 'Quick note label:', confirmLabel: 'Add' })
    if (!label?.trim()) return
    const { error } = await supabase.from('user_prospect_quick_notes').insert({
      user_id: authUser.id,
      label: label.trim(),
      sequence_order: quickNotes.length,
    })
    if (!error) await loadQuickNotes()
    else showToast(error.message, 'error')
  }

  async function handleDeleteQuickNote(id: string) {
    if (!authUser?.id) return
    const { error } = await supabase.from('user_prospect_quick_notes').delete().eq('id', id)
    if (!error) await loadQuickNotes()
    else showToast(error.message, 'error')
  }

  async function handleNextProspect(skipTimerEvent?: boolean) {
    if (run && currentProspectIndex >= followUpProspects.length - 1) {
      // The run's last card (v2.5808): the receipt, never a wrap back to the first.
      if (!skipTimerEvent && currentProspect && authUser?.id) {
        await saveTimerEvent('next_prospect')
        releaseCallingLock(currentProspect.id, authUser.id)
        loadMyTimeToday()
      }
      setRunDone(true)
      return
    }
    if (followUpProspects.length <= 1) return
    if (!skipTimerEvent && currentProspect && authUser?.id) {
      await saveTimerEvent('next_prospect')
      releaseCallingLock(currentProspect.id, authUser.id)
      loadMyTimeToday()
    }
    const nextIdx = (currentProspectIndex + 1) % followUpProspects.length
    setCurrentProspectIndex(nextIdx)
    setFollowUpTimerSeconds(0)
    updateUrlProspectId(followUpProspects[nextIdx]?.id ?? null)
  }

  async function getEffectiveMasterId(): Promise<string | null> {
    if (!authUser?.id) return null
    // One company (v2.2972): every prospect is stamped with the company owner account.
    return resolveCompanyOwnerUserId(supabase, authUser.id)
  }

  /** May we text? (v2.5606): the answer asked on the call, saved from the card; quo-send reads it. */
  async function saveOkToText(prospect: Prospect, value: OkToText) {
    setTextAskOpen(false)
    if (prospect.ok_to_text === value) return
    const { error } = await supabase.from('prospects').update({ ok_to_text: value }).eq('id', prospect.id)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    setFollowUpProspects((prev) => prev.map((p) => (p.id === prospect.id ? { ...p, ok_to_text: value } : p)))
    setProspectListProspects((prev) => prev.map((p) => (p.id === prospect.id ? { ...p, ok_to_text: value } : p)))
  }


  // ---------- The path onto the bench (v2.5807, punch list #153, PR 1) ----------

  /** The strip over the Subs lane, drawn by `SubsPathStrip` over the deck, the list and the Board. */
  const subsStrip = (rows: readonly Prospect[], calledIds: ReadonlySet<string>) => (
    <SubsPathStrip rows={rows} calledIds={calledIds} answeredIds={answeredProspectIds} quotedCompanyIds={benchQuoted} />
  )

  const canAccessFollowUp = !!authUser && canAccessProspectPipeline(authRole, estimatorProspectsAccess)

  if (authLoading) {
    return (
      <div style={{ padding: '1rem 1.5rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      </div>
    )
  }

  if (authRole === 'estimator' && !estimatorProspectsAccess && topTab !== 'research') {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>
          You don’t have access to Prospects. Ask a dev to open your desk in People and tick Prospects under Extra access.
        </p>
        <p style={{ color: 'var(--text-muted)' }}>
          The permit ledger is open to you: <Link to="/prospects?tab=permits">Permits</Link>.
        </p>
      </div>
    )
  }

  return (
    <div style={{ padding: prospectsPagePadding(isMobile) }}>
      {/* Tabs left, page title right — same top-row pattern as Jobs / People */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', marginBottom: isMobile ? '0.5rem' : '1rem', overflow: 'hidden' }}>
        <div style={{ flex: 1, minWidth: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: 'max-content' }}>
            {canAccessFollowUp && PROSPECT_KINDS.map((k) => (
              <button key={k} type="button" onClick={() => setKindTab(k)} style={pageTabStyle(topTab === 'customers' && kind === k)}>
                {PROSPECT_KIND_WORDS[k].tab}
              </button>
            ))}
            {canOpenHiring && (
              <button type="button" onClick={openTeamTab} style={pageTabStyle(topTab === 'team')}>
                Hiring
              </button>
            )}
            {canResearch && (
              <button type="button" onClick={openResearchTab} style={pageTabStyle(topTab === 'research')}>
                Permits
              </button>
            )}
          </div>
        </div>
        <h1 style={{ margin: 0, marginLeft: '1rem', flexShrink: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-strong)' }}>Prospects</h1>
      </div>

      {topTab === 'customers' && (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', borderBottom: '2px solid var(--border)', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setTab('follow-up')}
          style={tabStyle(activeTab === 'follow-up')}
        >
          Follow Up
        </button>
        {kind === 'sub' && (
          <>
            <span style={{ color: 'var(--text-faint)', padding: '0 0.1rem', position: 'relative', top: '-1px', fontSize: '0.875rem' }}>|</span>
            <button type="button" onClick={() => setTab('board')} style={tabStyle(activeTab === 'board')}>
              Board
            </button>
          </>
        )}
        <span style={{ color: 'var(--text-faint)', padding: '0 0.1rem', position: 'relative', top: '-1px', fontSize: '0.875rem' }}>|</span>
        <button
          type="button"
          onClick={() => setTab('prospect-list')}
          style={tabStyle(activeTab === 'prospect-list')}
        >
          Prospect List
        </button>
        {kind === 'customer' && (
          <>
            <span style={{ color: 'var(--text-faint)', padding: '0 0.1rem', position: 'relative', top: '-1px', fontSize: '0.875rem' }}>|</span>
            <button
              type="button"
              onClick={() => setTab('convert')}
              style={tabStyle(activeTab === 'convert')}
            >
              Convert
            </button>
          </>
        )}
        {canAccessActivityTab && (
          <>
            <span style={{ color: 'var(--text-faint)', padding: '0 0.1rem', position: 'relative', top: '-1px', fontSize: '0.875rem' }}>|</span>
            <button
              type="button"
              onClick={() => setTab('activity')}
              style={tabStyle(activeTab === 'activity')}
            >
              Activity
            </button>
          </>
        )}
        {canAccessFollowUp && (
          <button
            type="button"
            onClick={openNewProspect}
            style={{ marginLeft: 'auto', marginBottom: '0.35rem', padding: '0.4rem 0.9rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
          >
            New Prospect
          </button>
        )}
      </div>
      )}

      {topTab === 'team' && canOpenHiring && authUser?.id && (
        <TeamProspectsTab authUserId={authUser.id} isDev={authRole === 'dev'} canEditOnboarding={isOwnerOrDev(authRole)} resolveMasterId={getEffectiveMasterId} shared={!teamProspectsAccess} />
      )}

      {topTab === 'research' && canResearch && authUser?.id && <ProspectsResearchTab authUserId={authUser.id} />}

      {topTab === 'customers' && activeTab === 'follow-up' && (
        <ProspectsFollowUpTab
          authUserId={authUser?.id ?? null}
          kind={kind}
          kindWords={kindWords}
          canAccessFollowUp={canAccessFollowUp}
          saving={saving}
          followUpLoading={followUpLoading}
          followUpProspects={followUpProspects}
          currentProspect={currentProspect}
          currentProspectIndex={currentProspectIndex}
          calledProspectIds={calledProspectIds}
          callingOrderMode={callingOrderMode}
          showCallingOrder={showCallingOrder}
          comments={comments}
          commentInputValue={commentInputValue}
          retaggableNote={retaggableNote}
          quickNotes={quickNotes}
          followUpNotes={followUpNotes}
          followUpNotesSaving={followUpNotesSaving}
          scheduledCallback={scheduledCallback}
          followUpTimerSeconds={followUpTimerSeconds}
          myTimeTodaySeconds={myTimeTodaySeconds}
          prospectLedgerSeconds={prospectLedgerSeconds}
          didntAnswerMoveNext={didntAnswerMoveNext}
          lockHeldBy={lockHeldBy}
          textAskOpen={textAskOpen}
          copy={copy}
          tradeFilter={tradeFilter}
          plansFor={plansFor}
          plansPick={plansPick}
          laneAllRows={laneAllRows}
          benchTrades={benchTrades}
          gcNeedsNow={gcNeedsNow}
          gcWork={gcWork}
          gcBidding={gcBidding}
          jobsByProspect={jobsByProspect}
          run={run}
          runOutcomes={runOutcomes}
          runDone={runDone}
          runCallbackAt={runCallbackAt}
          runTextState={runTextState}
          setShowCallingOrder={setShowCallingOrder}
          setCurrentProspectIndex={setCurrentProspectIndex}
          setFollowUpTimerSeconds={setFollowUpTimerSeconds}
          setCommentInputValue={setCommentInputValue}
          setCommentInputRef={setCommentInputRef}
          setFollowUpNotes={setFollowUpNotes}
          setDidntAnswerMoveNext={setDidntAnswerMoveNext}
          setTextAskOpen={setTextAskOpen}
          setScriptOpen={setScriptOpen}
          setTimerHistoryModalOpen={setTimerHistoryModalOpen}
          setMyTimeModalOpen={setMyTimeModalOpen}
          setNewProspectModalOpen={setNewProspectModalOpen}
          subsStrip={subsStrip}
          setTradeFilter={setTradeFilter}
          openAddSub={openAddSub}
          switchCallingOrder={switchCallingOrder}
          updateUrlProspectId={updateUrlProspectId}
          takeCallingLock={takeCallingLock}
          handleDidntAnswer={handleDidntAnswer}
          handleAnswered={handleAnswered}
          handleCantReach={handleCantReach}
          handleNoLongerFit={handleNoLongerFit}
          handleConverted={handleConverted}
          handleAskedUs={handleAskedUs}
          openBenchModal={openBenchModal}
          handleNextProspect={handleNextProspect}
          sendRunText={sendRunText}
          savePriority={savePriority}
          saveOkToText={saveOkToText}
          openCallbackModal={openCallbackModal}
          openEditModal={openEditModal}
          handleAddComment={handleAddComment}
          handleQuickNoteClick={handleQuickNoteClick}
          handleAddQuickNote={handleAddQuickNote}
          handleDeleteQuickNote={handleDeleteQuickNote}
          saveFollowUpNotes={saveFollowUpNotes}
          cancelFollowUpNotes={cancelFollowUpNotes}
          addJobFor={addJobFor}
          editJobFor={editJobFor}
          changeJob={changeJob}
          markJobLost={markJobLost}
          removeJob={removeJob}
        />
      )}

      {topTab === 'customers' && activeTab === 'board' && kind === 'sub' && (
        // The board by trade (v2.5808, punch list #153, PR 2): Hiring's columns for the Subs lane, built for the moment a set of plans lands.
        !canAccessFollowUp ? (
          <p style={{ color: 'var(--text-muted)' }}>You do not have access to the board.</p>
        ) : prospectListLoading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
        ) : (
          (() => {
            const live = prospectListProspects.filter((p) => p.prospect_fit_status == null)
            const calledIds = new Set(Object.keys(prospectLastCallMap))
            return (
              <SubsBoard
                subs={live}
                needs={gcNeeds(gcBench.benches, live, gcBench.ownTrades)}
                plans={gcPlans}
                picked={plansPick}
                onPick={setPlansFor}
                records={subRecordMap}
                calledIds={calledIds}
                lastCalls={prospectLastCallMap}
                callbacks={laneCallbacks}
                busy={saving}
                strip={subsStrip(prospectListProspects, calledIds)}
                onCall={(ids, trade, packageId) => navigate(runHref(ids, trade, plansFor, packageId))}
                onBench={(p) => openBenchModal(p)}
                onPass={(p) => void passFromBoard(p)}
                onEdit={(p) => openEditModalForProspect(p)}
                onAddSub={openAddSub}
                pins={lanePins}
                onDrop={(trade, draggedId, toIndex) => void dropOnBoard(trade, draggedId, toIndex)}
                onUnpin={(trade, id) => void unpinOnBoard(trade, id)}
                onPriority={(p, value) => void savePriority(p, value)}
              />
            )
          })()
        )
      )}

      {topTab === 'customers' && activeTab === 'prospect-list' && (
        <ProspectsListTab
          list={list}
          kind={kind}
          kindWords={kindWords}
          canAccessFollowUp={canAccessFollowUp}
          prospectListLoading={prospectListLoading}
          prospectListProspects={prospectListProspects}
          prospectLastCallMap={prospectLastCallMap}
          saving={saving}
          prospectListEmpty={prospectListEmpty}
          answeredProspectIds={answeredProspectIds}
          benchQuoted={benchQuoted}
          gcBench={gcBench}
          gcPlans={gcPlans}
          plansFor={plansFor}
          plansPick={plansPick}
          setPlansFor={setPlansFor}
          openBenchModal={openBenchModal}
          openEditModalForProspect={openEditModalForProspect}
          handleSendBack={handleSendBack}
          handleNotAFitFromList={handleNotAFitFromList}
          handleDeleteFromList={handleDeleteFromList}
          openAddSub={openAddSub}
        />
      )}

      {topTab === 'customers' && activeTab === 'convert' && (
        <ProspectsConvertTab convert={convert} canAccessFollowUp={canAccessFollowUp} prospectLastCallMap={prospectLastCallMap} />
      )}

      {topTab === 'customers' && activeTab === 'activity' && canAccessActivityTab && (
        <ProspectsActivityTab kind={kind} kindWords={kindWords} hideZz={hideZz} laneRows={prospectListProspects} weekOffset={weekOffset} setWeekOffset={setWeekOffset} />
      )}

      {editModalOpen && (currentProspect || editingProspect) && <EditProspectWindow win={editWin} kind={kind} currentProspect={currentProspect} saving={saving} benchTrades={benchTrades} />}

      {callbackModalOpen && currentProspect && <ProspectCallbackModal saving={saving} onSave={saveCallback} onClose={() => setCallbackModalOpen(false)} />}

      {copy.editingCopyTemplateKey && <ProspectCopyTemplateEditModal copy={copy} />}

      {copy.copyBlankFieldsModalOpen && <ProspectCopyBlankFieldsModal copy={copy} />}

      {timerHistoryModalOpen && <ProspectTimerHistoryModal userId={authUser?.id ?? null} onClose={() => setTimerHistoryModalOpen(false)} />}

      {myTimeModalOpen && (
        <ProspectMyTimeModal userId={authUser?.id ?? null} liveSeconds={activeTab === 'follow-up' ? followUpTimerSeconds : 0} onClose={() => setMyTimeModalOpen(false)} />
      )}

      {scriptOpen && <GcCallScriptWindow onClose={() => setScriptOpen(false)} job={run ? { trade: run.trade, project: plansPick?.name ?? null } : null} />}
      {benchDraft && (
        <ProspectBenchModal draft={benchDraft.draft} saving={benchSaving} error={benchError} onSave={handleBenchSave} onCancel={() => !benchSaving && setBenchDraft(null)} ask={benchDraft.ask} />
      )}

      {newProspectModalOpen && <NewProspectWindow win={newWin} newKind={newKind} setNewKind={setNewKind} saving={saving} benchTrades={benchTrades} openDoubleProspect={openDoubleProspect} />}
    </div>
  )
}
