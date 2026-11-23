import { useState, useEffect, useRef, useCallback, useMemo, type CSSProperties, type ReactNode } from 'react'
import { pageTabStyle } from '../lib/pageTabStyle'
import { isOfficeRole, isOwnerOrDev } from '../lib/doorRoles'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { supabase } from '../lib/supabase'
import { activeUsersQuery } from '../lib/people/fetchActiveUsers'
import { useAuth } from '../hooks/useAuth'
import { useTaskModeEnabled } from '../hooks/useTaskModeEnabled'
import { TaggedJobNotesSection } from '../components/jobs/TaggedJobNotesSection'
import { waitingOnWords, type TagKinds } from '../lib/jobs/noteTags'
import { useOpenTaskTagNames } from '../hooks/useOpenTaskTagNames'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { useChecklistAddModal } from '../contexts/ChecklistAddModalContext'
import { useConfirmDialog } from '../contexts/ConfirmDialogContext'
import { ChecklistItemEditModal } from '../components/ChecklistItemEditModal'
import ChecklistItemMuteModal from '../components/ChecklistItemMuteModal'
import { ChecklistTitleWithLinks } from '../components/ChecklistTitleWithLinks'
import { withSupabaseRetry, formatErrorMessage } from '../utils/errorHandling'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../lib/offlineRecoveryState'
import OfflineRetryPanel from '../components/OfflineRetryPanel'
import { ChecklistReviewInboxes } from '../components/checklist/ChecklistReviewInboxes'
import RoadmapTaskContextModal from '../components/checklist/RoadmapTaskContextModal'
import VehicleTaskContextModal from '../components/checklist/VehicleTaskContextModal'
import { PeopleWeekSheet } from '../components/checklist/PeopleWeekSheet'
import { isVehicleTaskTitle, stripVehicleTaskMarker } from '../lib/vehicleFleet'
import { ChecklistInstanceCard } from '../components/checklist/ChecklistInstanceCard'
import { ChecklistHistoryTab } from '../components/checklist/ChecklistHistoryTab'
import { groupEventsByInstance, lastTransitionIsReopen, stuckReason, type ChecklistCardEvent } from '../lib/checklistCardEvents'
import { completeChecklistInstance, createNextChecklistRepeat } from '../lib/checklistCompleteInstance'
import { weekStartSunday } from '../lib/checklistHistoryLedger'
import { BOARD_RANGE_LABELS, BOARD_RANGE_ORDER, ageSeverity, initialsFor, oldestAgeDays, type BoardRange } from '../lib/checklistTeamBoard'
import { dueChipLabel } from '../lib/checklistDueDates'
import { ChecklistManageTab } from '../components/checklist/ChecklistManageTab'
import { roadmapGoalChip, type ChecklistRole as UserRole } from '../components/checklist/checklistPageShared'
import { canOpenRoadmap, roadmapPath } from '../lib/roadmapVisibility'
import { ChecklistReviewInboxSection } from '../components/checklist/ChecklistReviewInboxSection'
import { ChecklistOutstandingSection } from '../components/checklist/ChecklistOutstandingSection'
import { ChecklistComingUpSection } from '../components/checklist/ChecklistComingUpSection'
import { EmptyState } from '../components/EmptyState'
import {
  CHECKLIST_UPCOMING_EMPTY,
  checklistOutstandingEmptyWords,
  checklistTodayEmptyWords,
} from '../lib/checklistEmptyWords'
import { missedTileCaption, outstandingTileCaption, reviewTileTone, signOffTileCaption } from '../lib/checklistReviewTiles'
import { collapseMissedInstances, type MissedGroup } from '../lib/checklistMissedGroups'
import { useToastContext } from '../contexts/ToastContext'
import { OutstandingByPersonSortableList, type OutstandingInstance } from '../components/checklist/OutstandingByPersonList'
import { OutstandingDeleteAsk, ReviewUndoBar } from '../components/checklist/ChecklistReviewAsks'
import { reviewFoldHeader, reviewTile } from '../components/checklist/reviewBoardChrome'
import { useChecklistCostEstimates } from '../hooks/useChecklistCostEstimates'
import { ACCURACY_MIN_COUNT, canSeeTaskCosts, estimateAccuracy, estimateAccuracyByPerson, formatMultiplier, formatWholeDollars, sumEstimateDollars } from '../lib/checklistCostEstimate'
import { localCalendarDayKey, todayYmdInAppTz } from '../utils/dateUtils'
import { useTaskLines } from '../hooks/useTaskLines'
import type { PersonDayRow } from '../lib/tasks/personDay'
import { readPersonAhead, readPersonDay } from '../lib/tasks/personDayIo'
import { cardAsksForPhoto, takesRing } from '../lib/taskProgress'
import { setTaskPercent } from '../lib/taskProgressIo'
import { useTaskPhotos } from '../hooks/useTaskPhotos'
import { useTaskPlaces } from '../hooks/useTaskPlaces'
import { useTaskSpotPhotos } from '../hooks/useTaskSpotPhotos'
import { TaskPlacesMapCard, type TaskPlacesMapTask } from '../components/checklist/TaskPlacesMapCard'
import { taskPlaceDots, taskPlaceDraft, taskPlaceFarShort, taskTitlePlain } from '../lib/tasks/taskPlace'
import { ADD_OWN_TASK_LABEL, FOLLOW_UP_LABEL, followUpTellsId, followUpTitle, nextTaskId, splitToday, stillOpenIsLate, stillOpenMeta, taskHearsId, todayHeadDate, todayPartLabel, todaySentence } from '../lib/tasks/todayPage'
import { showHeaderTaskChecklistButton } from '../lib/headerTaskDispatchEstimatorEligible'
import { TASK_PILL_STYLE } from '../lib/tasks/taskPillStyle'
import { DO_FIRST_MARK, doFirstId, readDoFirst, writeDoFirst } from '../lib/tasks/doFirst'
import { MISSED_ASK, MISSED_DID_LABEL, MISSED_SKIPPED_LABEL, MISSED_WORDS, missedLabel, yesterdayMissed } from '../lib/tasks/yesterdayMissed'
import { sayTaskStuck } from '../lib/tasks/taskDoerActsIo'
import { ROUND_MIN, roundConfirmMessage, roundHeldCount, roundHeldWords, roundOutcome, roundPressLabel, roundTaskIds } from '../lib/tasks/markRound'
import { TaskDayBar } from '../components/checklist/TaskDayBar'
import { ChecklistStuckSection } from '../components/checklist/ChecklistStuckSection'
import { useTaskDoerActs, type TaskDoerActsTarget } from '../hooks/useTaskDoerActs'
import { handOnTask, tellForwardTaker } from '../lib/tasks/taskDoerActsIo'
import { forwardTakers } from '../lib/tasks/taskDoerActs'
import { TaskForwardWindow } from '../components/checklist/TaskForwardWindow'
import { TaskLookGate } from '../components/checklist/TaskLookGate'
import { TaskModeLookWindow } from '../components/checklist/TaskModeLookWindow'
import { modeRowOfferedToRole } from '../lib/modeRow'
import { TaskLookViewAs } from '../components/checklist/TaskLookViewAs'
import { TaskLookComingUp } from '../components/checklist/TaskLookComingUp'
import { lookOffersViewAs, lookPressLabel, lookPressTitle } from '../lib/tasks/taskLook'
import { hasOfficeChecklistTabs, officeTabLandsOnToday } from '../lib/tasks/checklistTabs'
import { TaskPlacesTeamMapCard, type TaskPlacesTeamPerson } from '../components/checklist/TaskPlacesTeamMapCard'
import type { MyFix } from '../lib/materials/myLocation'

/** The daily list's tabs. The Roadmap moved to its own page (`/roadmap`, Tier-2 #41); `?tab=roadmap` links redirect there. */
type ChecklistTab = 'today' | 'history' | 'review' | 'manage'

/** One task on one day. The shape is the day's read, kept with it (punch list #381). */
type ChecklistInstance = PersonDayRow

/** Due chip under a Today card's title (v2.2351): calm inside the window, amber on the due day, red once late. Null without a due date. */
function dueCardChip(dueDate: string | null | undefined) {
  const label = dueChipLabel(dueDate, todayYmdInAppTz())
  if (!label) return null
  const palette = label === 'due today'
    ? { background: 'var(--bg-amber-tint)', border: '1px solid #d97706', color: 'var(--text-amber-800)' }
    : label.includes('late')
      ? { background: 'var(--bg-red-100)', border: '1px solid #dc2626', color: 'var(--text-red-700)' }
      : { background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', color: 'var(--text-700)' }
  return (
    <div style={{ marginTop: 4 }}>
      <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.12rem 0.5rem', borderRadius: 7, display: 'inline-block', ...palette }}>{label}</span>
    </div>
  )
}

/**
 * "🚗 vehicle" chip on vehicle maintenance tasks (v2.2094) — replaces the old
 * dead /people link with the vitals modal. Same tap-for-context pattern as
 * the ⛰ roadmap chip.
 */
function vehicleTaskChip(instanceId: string, onOpen: (instanceId: string) => void) {
  return (
    <button
      type="button"
      title="See this vehicle’s vitals"
      onClick={(e) => {
        e.stopPropagation()
        onOpen(instanceId)
      }}
      style={{
        font: 'inherit',
        fontSize: '0.72rem',
        fontWeight: 700,
        padding: '0.12rem 0.5rem',
        borderRadius: 7,
        border: 'none',
        background: 'var(--bg-blue-tint)',
        color: 'var(--text-teal-700, var(--text-blue-800))',
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
        cursor: 'pointer',
      }}
    >
      🚗 vehicle
    </button>
  )
}

const tabStyle = pageTabStyle

/** The small-caps label over a part of the day, the New task window's row label. */
const TODAY_PART_LABEL: CSSProperties = { margin: '0.9rem 2px 0.4rem', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const TODAY_PART_LIST: CSSProperties = { listStyle: 'none', padding: 0, margin: 0 }

function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function Checklist() {
  const { user: authUser } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [role, setRole] = useState<UserRole | null>(null)
  const [activeTab, setActiveTab] = useState<ChecklistTab>('today')
  const tabStripRef = useRef<HTMLDivElement | null>(null)

  // keep the active pill visible in the one-row scrollable strip (v2.1970)
  useEffect(() => {
    const strip = tabStripRef.current
    const el = strip?.querySelector<HTMLElement>('button[data-active="true"]')
    if (!strip || !el) return
    const left = el.offsetLeft
    const right = left + el.offsetWidth
    if (left < strip.scrollLeft || right > strip.scrollLeft + strip.clientWidth) {
      strip.scrollTo({ left: Math.max(0, left - 16) })
    }
  }, [activeTab])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authUser?.id) {
      setLoading(false)
      return
    }
    supabase.from('users').select('role').eq('id', authUser.id).single().then(({ data }) => {
      setRole((data as { role: UserRole } | null)?.role ?? null)
      setLoading(false)
    })
  }, [authUser?.id])

  // Task Mode (checklist-only lens): the page keeps just Today + History; the
  // office tabs hide and their deep links bounce to Today until the mode is off.
  const [taskModeEnabled] = useTaskModeEnabled(authUser?.id ?? null)

  // The Roadmap is its own page now (Tier-2 #41). This page keeps the door
  // (Review/Manage "Open roadmap →", `?tab=roadmap` redirects) for the roles
  // that can open it — dev / master / assistant-like / primary, the RLS edit set.
  const canSeeRoadmap = canOpenRoadmap(role, taskModeEnabled)

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (taskModeEnabled && (tab === 'review' || tab === 'manage' || tab === 'roadmap')) {
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'today')
        next.delete('roadmap')
        return next
      }, { replace: true })
      return
    }
    // A role with no Review or Manage would see an empty page under its two tabs, so its landing goes to Today.
    if (officeTabLandsOnToday(tab, role)) {
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'today')
        return next
      }, { replace: true })
      return
    }
    if (tab === 'roadmap' && role !== null) {
      if (canSeeRoadmap) {
        // Old bookmark / Dashboard card / help link: the roadmap lives at /roadmap now — same params.
        navigate(roadmapPath(searchParams.get('roadmap'), searchParams.get('view')), { replace: true })
        return
      }
      // Deep link from a role without the door: rewrite to their default tab instead.
      const fallbackTab =
        role === 'master_technician' || isAssistantLike(role) ? 'review' : 'today'
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', fallbackTab)
        next.delete('roadmap')
        next.delete('view')
        return next
      }, { replace: true })
      return
    }
    if (tab === 'today' || tab === 'history' || tab === 'review' || tab === 'manage') {
      setActiveTab(tab)
    } else if (!tab && role !== null) {
      const defaultTab =
        !taskModeEnabled && (role === 'dev' || role === 'master_technician' || isAssistantLike(role))
          ? 'review'
          : 'today'
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', defaultTab)
        return next
      }, { replace: true })
    }
  }, [searchParams, role, canSeeRoadmap, taskModeEnabled, navigate, setSearchParams])

  const canManageChecklists = hasOfficeChecklistTabs(role) && !taskModeEnabled
  /** Matches is_dev_or_master_or_assistant() in DB (includes primary) for roadmap structure + staff overrides */
  const canEditTechTree =
    role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'primary'
  const [editItemId, setEditItemId] = useState<string | null>(null)

  /** Review / Manage "Open roadmap →" (chips, Where-this-fits footer): the Roadmap page, that roadmap selected. */
  const onRoadmapUrlParamChange = useCallback(
    (roadmapId: string) => {
      navigate(roadmapPath(roadmapId))
    },
    [navigate],
  )

  if (loading) return <p style={{ padding: '2rem' }}>Loading…</p>

  // Punch list #369: in Task Mode the two tabs are one joined bar, in the New task window's shape, and the page's
  // title goes, since the header's link already says Checklist.
  const taskDayBar = taskModeEnabled ? (
    <TaskDayBar
      tab={activeTab === 'history' ? 'history' : 'today'}
      onPick={(tab) => {
        setActiveTab(tab)
        setSearchParams((p) => {
          const next = new URLSearchParams(p)
          next.set('tab', tab)
          return next
        })
      }}
    />
  ) : null

  return (
    <div
      style={{
        padding: '0.25rem 1.5rem 1.5rem',
      }}
    >
      {taskModeEnabled ? null : (
      <div className="checklist-tab-bar">
        <div className="checklist-tab-strip" ref={tabStripRef}>
        <button
          type="button"
          onClick={() => {
            setActiveTab('today')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'today')
              return next
            })
          }}
          data-active={activeTab === 'today'}
          style={tabStyle(activeTab === 'today')}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('history')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'history')
              return next
            })
          }}
          data-active={activeTab === 'history'}
          style={tabStyle(activeTab === 'history')}
        >
          History
        </button>
        {canManageChecklists && (
          <>
            <button
              type="button"
              onClick={() => {
                setActiveTab('review')
                setSearchParams((p) => {
                  const next = new URLSearchParams(p)
                  next.set('tab', 'review')
                  return next
                })
              }}
              data-active={activeTab === 'review'}
          style={tabStyle(activeTab === 'review')}
            >
              Review
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('manage')
                setSearchParams((p) => {
                  const next = new URLSearchParams(p)
                  next.set('tab', 'manage')
                  return next
                })
              }}
              data-active={activeTab === 'manage'}
          style={tabStyle(activeTab === 'manage')}
            >
              Manage
            </button>
          </>
        )}
        </div>
        <h1 className="checklist-tab-title">Checklist</h1>
      </div>
      )}
      {taskModeEnabled && activeTab === 'history' ? <div style={{ maxWidth: 720, margin: '0.6rem auto 1rem' }}>{taskDayBar}</div> : null}

      {/* Punch list #188 rows 35 and 65 (v2.6758): forwarding and Upcoming are office work; History's edit mode and Review's acts for others are the owner's with a dev. */}
      {activeTab === 'today' && (
        <ChecklistTodayTab modeBar={taskDayBar} tagKinds={taskModeEnabled ? 'both' : 'task'} canAddTask={showHeaderTaskChecklistButton(role)} authUserId={authUser?.id ?? null} canForward={isOfficeRole(role)} canOpenVehiclesPage={role === 'dev' || role === 'master_technician' || isAssistantLike(role)} setError={setError} />
      )}
      {activeTab === 'history' && (
        <ChecklistHistoryTab authUserId={authUser?.id ?? null} canViewOthers={canManageChecklists} canEditHistory={isOwnerOrDev(role)} setError={setError} />
      )}
      {activeTab === 'review' && canManageChecklists && (
        <ChecklistOutstandingTab authUserId={authUser?.id ?? null} canActForOthers={isOwnerOrDev(role)} canViewAs={role === 'dev'} canSeeCosts={canSeeTaskCosts(role)} canManageChecklists={canManageChecklists} canEditRoadmapTasks={canEditTechTree} setError={setError} setEditItemId={setEditItemId} onOpenRoadmap={canSeeRoadmap ? onRoadmapUrlParamChange : undefined} />
      )}
      {activeTab === 'manage' && canManageChecklists && (
        <ChecklistManageTab authUserId={authUser?.id ?? null} role={role} setError={setError} setEditItemId={setEditItemId} onOpenRoadmap={canSeeRoadmap ? onRoadmapUrlParamChange : undefined} />
      )}
      {editItemId && (
        <ChecklistItemEditModal
          itemId={editItemId}
          onClose={() => setEditItemId(null)}
          onSaved={() => {}}
          setError={setError}
          role={role}
        />
      )}

      {error && <p style={{ color: 'var(--text-red-700)', marginTop: '1rem' }}>{error}</p>}
    </div>
  )
}

/** A look at another person's day (punch list #381): whose it is. */
type TodayLook = { personId: string }

function ChecklistTodayTab({ authUserId, look = null, canForward, canOpenVehiclesPage, canAddTask = false, setError, modeBar = null, tagKinds = 'task', onOpenTaggedJob }: { authUserId: string | null; /** Set, the tab is a look at this person's day (punch list #381): it reads them and nothing in it acts. */ look?: TodayLook | null; canForward: boolean; canOpenVehiclesPage: boolean; /** Which tagged notes the section above the list holds (punch list #375): a task's, and a job's too in Task Mode. */ tagKinds?: TagKinds; /** The door from a tagged job note to its job, where there is one. */ onOpenTaggedJob?: (jobId: string) => void; /** May this person write a task? The roles the header's Task press shows for. */ canAddTask?: boolean; setError: (s: string | null) => void; /** Task Mode's Today and History bar, which sits in the day's head (punch list #369). */ modeBar?: ReactNode }) {
  const addTaskModal = useChecklistAddModal()
  // Whose day this is, and who acts on it. They are the signed-in person, except in a look at someone else's day
  // (punch list #381): the reads then key on that person and nobody acts, so every write below finds no one to act.
  const personId = look ? look.personId : authUserId
  const actorId = look ? null : authUserId
  const isLook = !!look
  // Step C3: the doer's tools. One More press per task and one set of sheets for the tab. Up here with the tab's other
  // hooks, above the early return a loading day takes.
  const doer = useTaskDoerActs({
    authUserId: actorId,
    todayYmd: todayYmdInAppTz(),
    onChanged: () => rereadDay(),
    onDoFirst: (instanceId) => {
      writeDoFirst(actorId, instanceId)
      setDoFirstPick(instanceId)
    },
    // The pass's Done answer is the tick's own path, by the day row's id.
    markDone: async (instanceId) => {
      const inst = [...todayInstances, ...outstandingInstances].find((i) => i.id === instanceId)
      if (!inst || inst.completed_at) return
      if (!(await toggleComplete(inst))) throw new Error('The task did not mark done.')
    },
  })
  // Step D2: one press for a round of daily tasks, behind a window that names the act.
  const confirmRound = useConfirmDialog()
  const { showToast: showRoundToast } = useToastContext()
  const [roundBusy, setRoundBusy] = useState(false)
  /** Step D3: the repeating days that went unticked, and the ones answered as skipped. */
  const [missedRows, setMissedRows] = useState<ChecklistInstance[]>([])
  const [missedSkippedIds, setMissedSkippedIds] = useState<ReadonlySet<string>>(new Set())
  const [missedBusyId, setMissedBusyId] = useState<string | null>(null)
  /** Do first (step D1): the task this person lifted into Next on this device. */
  const [doFirstPick, setDoFirstPick] = useState<string | null>(() => readDoFirst(actorId))
  /** Tasks finished in this visit (punch list #369, step B2): each one's done line offers the photo and the note once. */
  const [doneHere, setDoneHere] = useState<ReadonlySet<string>>(new Set())
  const [vehicleCtxInstanceId, setVehicleCtxInstanceId] = useState<string | null>(null)
  const [todayInstances, setTodayInstances] = useState<ChecklistInstance[]>([])
  const [upcomingInstances, setUpcomingInstances] = useState<ChecklistInstance[]>([])
  const [upcomingExpanded, setUpcomingExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  /** Today's read failed, with its class: a lost signal offers Retry and reads again when it comes back (v2.5962). Actions keep the page's line. */
  const [dayFailure, setDayFailure] = useState<OfflineRecoveryLastError | null>(null)
  const toggleCompleteInFlightRef = useRef(new Set<string>())
  /** Oldest-first card history per instance (checklist_instance_events, v2.1842). */
  const [eventsByInstance, setEventsByInstance] = useState<Map<string, ChecklistCardEvent[]>>(new Map())
  /** Overdue one-offs + show-until-completed items (Outstanding section, v2.1864). */
  const [outstandingInstances, setOutstandingInstances] = useState<ChecklistInstance[]>([])
  // Task cards (#273, PR 2): the Done when… lines of today's cards and the outstanding ones, with their ticks.
  const taskLines = useTaskLines(
    [...todayInstances, ...outstandingInstances].map((i) => ({
      instanceId: i.id,
      itemId: i.checklist_item_id,
      roadmapTaskId: i.checklist_items?.roadmap_group_task_id ?? null,
    })),
    actorId,
  )
  // PR 4b: the cards' photos, one read for the day's cards and the outstanding ones.
  const taskPhotos = useTaskPhotos([...todayInstances, ...outstandingInstances].map((i) => i.id))
  // Punch list #328: the places of the tasks on this tab, read beside the day and never inside it.
  const taskPlaces = useTaskPlaces([...todayInstances, ...outstandingInstances].map((i) => i.checklist_item_id))
  // PR 6: the giver's photo of the spot, by task. Its own read, as the places are.
  const spotPhotos = useTaskSpotPhotos([...todayInstances, ...outstandingInstances].map((i) => i.checklist_item_id))
  // Where my tasks are (PR 4): the open tasks in the order they are listed, today's first and then the outstanding
  // ones. A task done today leaves the map. The numbers the dots wear are the ones the cards wear.
  const mapTasks = useMemo<TaskPlacesMapTask[]>(() => {
    const titleOf = (i: ChecklistInstance) => taskTitlePlain((i.checklist_items as { title?: string } | null)?.title)
    return [
      ...todayInstances.filter((i) => !i.completed_at).map((i) => ({ id: i.id, title: titleOf(i), place: taskPlaces.placeFor(i.checklist_item_id), overdue: false })),
      // Red is for a due day that has passed. An older task with none is amber (punch list #369, step A2).
      ...outstandingInstances.map((i) => {
        const late = stillOpenIsLate(i.checklist_items?.due_date ?? null, toLocalDateString(new Date()))
        return { id: i.id, title: titleOf(i), place: taskPlaces.placeFor(i.checklist_item_id), overdue: late, old: !late }
      }),
    ]
  }, [todayInstances, outstandingInstances, taskPlaces])
  const placeNumbers = useMemo(() => taskPlaceDots(mapTasks).numberById, [mapTasks])
  // The person's own reading, asked for on the map and kept for this visit only: the distance on each task's line.
  const [me, setMe] = useState<MyFix | null>(null)
  const placeFarFor = (inst: ChecklistInstance): string | null => {
    const place = taskPlaces.placeFor(inst.checklist_item_id)
    return me && place ? taskPlaceFarShort(me, place) : null
  }
  // Show the task, from a dot: the list scrolls to the card and opens it.
  const [shownTask, setShownTask] = useState<{ id: string; n: number } | null>(null)
  const showTask = (id: string) => {
    setShownTask((cur) => ({ id, n: (cur?.n ?? 0) + 1 }))
    window.setTimeout(() => {
      document.querySelector(`[data-task-instance="${id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 60)
  }
  // Tagged task notes (punch list #375): a tagged note's title is a door only to a task that is on this page.
  const taskOnPage = (instanceId: string) => todayInstances.some((i) => i.id === instanceId) || outstandingInstances.some((i) => i.id === instanceId)
  // The Dashboard's window sends a tagged task here as ?task=<day row>: once the day is read, show it and drop the word.
  const [tagParams, setTagParams] = useSearchParams()
  const taskParam = tagParams.get('task')
  useEffect(() => {
    if (!taskParam || loading || isLook) return
    if (taskOnPage(taskParam)) showTask(taskParam)
    setTagParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('task')
        return next
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per ?task and the day's first read
  }, [taskParam, loading])
  const [eventActorNameById, setEventActorNameById] = useState<Record<string, string>>({})
  // Punch list #369: a done task says who hears. Their names are read beside the names of the people in the threads.
  useEffect(() => {
    const rows = [...todayInstances, ...outstandingInstances]
    // The givers too (step C3): a tool's sheet says who is told.
    const ids = [...new Set([...rows.map((i) => taskHearsId(i.checklist_items, personId)), ...rows.map((i) => i.checklist_items?.created_by_user_id ?? null)].filter((v): v is string => !!v))].filter((id) => !(id in eventActorNameById))
    if (ids.length === 0) return
    let off = false
    void supabase
      .from('users')
      .select('id, name')
      .in('id', ids)
      .then(({ data }) => {
        if (off || !data) return
        setEventActorNameById((prev) => {
          const next = { ...prev }
          for (const r of data as Array<{ id: string; name: string | null }>) next[r.id] = (r.name ?? '').trim() || 'Someone'
          return next
        })
      })
    return () => {
      off = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the names read when the lists change, never when a name lands
  }, [todayInstances, outstandingInstances, personId])
  const [fwdInstance, setFwdInstance] = useState<ChecklistInstance | null>(null)
  const [fwdSaving, setFwdSaving] = useState(false)
  /** Why the last Forward did not take, shown in the window in the database's words. */
  const [fwdRefusal, setFwdRefusal] = useState<string | null>(null)
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [muteModalItemId, setMuteModalItemId] = useState<string | null>(null)
  const [muteModalTitle, setMuteModalTitle] = useState('')

  /**
   * The day read again after something changed, without the page's loading line (punch list #369, step C5): a sheet
   * that is open stays open, and the lists change under it.
   */
  async function rereadDay(): Promise<void> {
    await Promise.all([loadToday(), loadUpcoming()])
  }

  /** The day's read: today's items, the outstanding ones and (for a dev) what is coming. Retry runs it again. */
  async function loadDay(): Promise<void> {
    setLoading(true)
    try {
      await Promise.all([loadToday(), loadUpcoming()])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!personId) {
      setLoading(false)
      return
    }
    void loadDay()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the day reads once per person, as before
  }, [personId])

  useEffect(() => {
    if (canForward && !isLook) {
      // Tier-2 #19 (J30-2): person pickers = active people (no twins); dev rows stay.
      activeUsersQuery('id, name, email', { includeDev: true, withLogin: true })
        .then(({ data }) => {
        setUsers((data ?? []) as Array<{ id: string; name: string; email: string }>)
      })
    }
  }, [canForward, isLook])

  async function loadToday() {
    if (!personId) return
    const r = await readPersonDay(personId, toLocalDateString(new Date()))
    if ('failure' in r) {
      setDayFailure(recoveryFailureFromError(r.failure, "Couldn't load today's checklist"))
      return
    }
    setDayFailure(null)
    // Outstanding (v2.1864, widened v2.1869): older tasks whose work is still wanted. The repeating days that went
    // unticked are step D3's, with the ones already answered as skipped. `personDay.ts` holds the rule.
    setMissedRows(r.day.missed)
    setMissedSkippedIds(r.day.skippedIds)
    setOutstandingInstances(r.day.stillOpen)
    setTodayInstances(r.day.today)
    void loadCardEvents([...r.day.today.map((row) => row.id), ...r.day.stillOpen.map((row) => row.id)])
  }

  /** Fetch the card history for the visible instances + names for its actors. */
  async function loadCardEvents(instanceIds: string[]) {
    if (instanceIds.length === 0) {
      setEventsByInstance(new Map())
      return
    }
    const { data, error: e } = await supabase
      .from('checklist_instance_events')
      .select('id, instance_id, event_type, actor_user_id, body, created_at, percent')
      .in('instance_id', instanceIds)
      .order('created_at', { ascending: true })
    if (e) return
    const events = (data ?? []) as unknown as ChecklistCardEvent[]
    setEventsByInstance(groupEventsByInstance(events))
    const actorIds = [...new Set(events.map((ev) => ev.actor_user_id).filter((v): v is string => !!v))]
    const missing = actorIds.filter((id) => !(id in eventActorNameById))
    if (missing.length > 0) {
      const { data: nameRows } = await supabase.from('users').select('id, name').in('id', missing)
      if (nameRows) {
        setEventActorNameById((prev) => {
          const next = { ...prev }
          for (const r of nameRows as Array<{ id: string; name: string | null }>) {
            next[r.id] = (r.name ?? '').trim() || 'Someone'
          }
          return next
        })
      }
    }
  }

  /** Post a comment event; returns true on success (card clears its draft). */
  /** After the activity panel posts a note, keep the card badges honest. */
  function appendLocalCardComment(instanceId: string, body: string) {
    if (!actorId) return
    setEventsByInstance((prev) => {
      const next = new Map(prev)
      const list = [...(next.get(instanceId) ?? [])]
      list.push({
        id: `local-${Date.now()}`,
        instance_id: instanceId,
        event_type: 'comment',
        actor_user_id: actorId,
        body,
        created_at: new Date().toISOString(),
      })
      next.set(instanceId, list)
      return next
    })
  }

  async function postCardComment(inst: ChecklistInstance, body: string): Promise<boolean> {
    if (!actorId) return false
    const { error: e } = await supabase.from('checklist_instance_events').insert({
      instance_id: inst.id,
      event_type: 'comment',
      actor_user_id: actorId,
      body,
    })
    if (e) {
      setError(e.message)
      return false
    }
    void loadCardEvents(todayInstances.map((r) => r.id))
    return true
  }

  async function loadUpcoming() {
    // Upcoming (future-dated instances) is dev-only since v2.2269 — it was
    // empty for nearly everyone and its name collided with the waiting list.
    if (!personId || !canForward) return
    const ahead = await readPersonAhead(personId, toLocalDateString(new Date()))
    if (ahead) setUpcomingInstances(ahead)
  }

  /** Resolves true once the change is saved, false when it was refused or did not run (step D2 counts them). */
  async function toggleComplete(inst: ChecklistInstance): Promise<boolean> {
    if (!actorId) return false
    if (toggleCompleteInFlightRef.current.has(inst.id)) return false
    toggleCompleteInFlightRef.current.add(inst.id)

    setError(null)
    const isCompleted = !!inst.completed_at
    const nextCompletedAt = isCompleted ? null : new Date().toISOString()
    const nextCompletedBy = isCompleted ? null : actorId
    const previous = inst

    setTodayInstances((prev) =>
      prev.map((row) =>
        row.id === inst.id
          ? {
              ...row,
              completed_at: nextCompletedAt,
              completed_by_user_id: nextCompletedBy,
            }
          : row,
      ),
    )

    try {
      // Notes are no longer written here — card comments live in
      // checklist_instance_events; the completion trigger logs the transition.
      const { error: e } = await supabase
        .from('checklist_instances')
        .update({
          completed_at: nextCompletedAt,
          completed_by_user_id: nextCompletedBy,
        })
        .eq('id', inst.id)
      if (e) throw e
      await loadToday()
      if (!isCompleted) {
        void sendCompletionNotifications(inst)
        void maybeCreateNextInstance(inst)
      }
      return true
    } catch (e: unknown) {
      setTodayInstances((prev) => prev.map((row) => (row.id === inst.id ? previous : row)))
      setError(formatErrorMessage(e, 'Failed to update checklist'))
      return false
    } finally {
      toggleCompleteInFlightRef.current.delete(inst.id)
    }
  }

  async function sendCompletionNotifications(inst: ChecklistInstance) {
    const { data: item } = await supabase
      .from('checklist_items')
      .select('notify_on_complete_user_id, notify_creator_on_complete, created_by_user_id, title')
      .eq('id', inst.checklist_item_id)
      .single()
    if (!item) return
    const title = (item as { title: string }).title
    const assigneeName = 'You' // could fetch from users
    const body = `${assigneeName} completed: ${title}`
    const recipients: string[] = []
    const notifyUserId = (item as { notify_on_complete_user_id: string | null }).notify_on_complete_user_id
    if (notifyUserId) recipients.push(notifyUserId)
    const notifyCreator = (item as { notify_creator_on_complete: boolean }).notify_creator_on_complete
    const creatorId = (item as { created_by_user_id: string }).created_by_user_id
    if (notifyCreator && creatorId && !recipients.includes(creatorId)) recipients.push(creatorId)
    for (const uid of recipients) {
      try {
        await supabase.functions.invoke('send-checklist-notification', {
          body: {
            recipient_user_id: uid,
            push_title: 'Checklist completed',
            push_body: body,
            push_url: '/checklist',
            tag: `checklist-${inst.id}`,
          },
        })
      } catch {
        // ignore
      }
    }
  }

  async function maybeCreateNextInstance(inst: ChecklistInstance) {
    await createNextChecklistRepeat(inst.checklist_item_id)
    await loadUpcoming()
  }

  function isNotificationRecipient(inst: ChecklistInstance): boolean {
    if (!personId) return false
    const item = inst.checklist_items as {
      notify_on_complete_user_id?: string | null
      notify_creator_on_complete?: boolean
      created_by_user_id?: string | null
    } | null
    if (!item) return false
    if (item.notify_on_complete_user_id === personId) return true
    if (item.notify_creator_on_complete && item.created_by_user_id === personId) return true
    return false
  }

  function openMuteModal(inst: ChecklistInstance) {
    const title = (inst.checklist_items as { title: string } | null)?.title ?? 'Untitled'
    setMuteModalItemId(inst.checklist_item_id)
    setMuteModalTitle(title)
  }

  function openFwd(inst: ChecklistInstance) {
    setFwdRefusal(null)
    setFwdInstance(inst)
  }

  async function saveFwd(toUserId: string) {
    if (!fwdInstance || !actorId || !toUserId || fwdSaving) return
    setFwdSaving(true)
    setFwdRefusal(null)
    try {
      // Punch list #369, step C7: one person for another on the same task. The copy this made, and the delete of the
      // first day row with its thread, are gone: the task keeps its notes, place, lines and photos.
      const refused = await handOnTask(fwdInstance.id, toUserId, null, null)
      if (refused) {
        setFwdRefusal(refused)
        return
      }
      void tellForwardTaker({ byUserId: actorId, toUserId, instanceId: fwdInstance.id, taskTitle: taskTitlePlain((fwdInstance.checklist_items as { title?: string } | null)?.title ?? 'Untitled') })
      setFwdInstance(null)
      await loadToday()
      await loadUpcoming()
    } catch (err: unknown) {
      setFwdRefusal(formatErrorMessage(err, 'The task was not forwarded.'))
    } finally {
      setFwdSaving(false)
    }
  }

  if (loading) return <p>Loading…</p>

  // Punch list #369: the day in three parts. Next is one task, drawn open; the rest of today's open tasks follow it;
  // what is done folds to a line each. With today finished, Next is a task that was sent back, then the oldest.
  const { open: todayOpen, done: todayDone } = splitToday(todayInstances)
  const sentBackIds = new Set(outstandingInstances.filter((i) => lastTransitionIsReopen(eventsByInstance.get(i.id) ?? [])).map((i) => i.id))
  // Step C6: a stuck task waits under the ones that can be done, and is never Next.
  const isStuck = (i: ChecklistInstance) => stuckReason(eventsByInstance.get(i.id) ?? []) !== null
  const stuckRows = todayOpen.filter(isStuck)
  const todayReady = todayOpen.filter((i) => !isStuck(i))
  const olderReady = outstandingInstances.filter((i) => !isStuck(i))
  // Step D1: the person's own pick is Next while it can be. Past that, the list's order stands.
  const pickedFirst = doFirstId(doFirstPick, [...todayReady, ...olderReady])
  const listNextId = nextTaskId(todayReady, olderReady, sentBackIds)
  const nextId = pickedFirst ?? listNextId
  const nextInst = nextId ? (todayOpen.find((i) => i.id === nextId) ?? outstandingInstances.find((i) => i.id === nextId) ?? null) : null
  const thenRows = todayOpen.filter((i) => i.id !== nextId && !isStuck(i))
  const olderRows = outstandingInstances.filter((i) => i.id !== nextId)
  const showSentence = !loading && !dayFailure && (todayInstances.length > 0 || outstandingInstances.length > 0)
  const hearsNameFor = (inst: ChecklistInstance): string | null => {
    const id = taskHearsId(inst.checklist_items, personId)
    return id ? (eventActorNameById[id] ?? null) : null
  }
  // Punch list #369, step B1: the person's own task, and a follow-up from a task they finished. Both open the New task
  // window that exists, so nothing new is saved here. The day reads again once the window has sent.
  // In a look the two presses are drawn, as the person's phone draws them, and neither opens the window.
  const canWriteTask = canAddTask && !!addTaskModal && !!personId
  const addOwnTask = () => {
    if (actorId) addTaskModal?.openAddModal({ assigneeUserId: actorId, onSaved: () => void rereadDay() })
  }
  const addFollowUp = (inst: ChecklistInstance) => {
    if (!actorId) return
    const place = taskPlaceDraft(taskPlaces.placeFor(inst.checklist_item_id))
    addTaskModal?.openAddModal({
      assigneeUserId: actorId,
      preset: {
        title: followUpTitle(taskTitlePlain(inst.checklist_items?.title)),
        links: [],
        // The place alone: a way in painted for the first task stays with that task.
        place: place ? { lat: place.lat, lng: place.lng, name: place.name, accuracyM: place.accuracyM } : null,
        tellUserId: followUpTellsId(inst.checklist_items?.created_by_user_id, actorId),
      },
      onSaved: () => void rereadDay(),
    })
  }
  const doerTargetOf = (inst: ChecklistInstance): TaskDoerActsTarget => {
    const it = inst.checklist_items
    const giverId = it?.created_by_user_id ?? null
    return {
      instanceId: inst.id,
      title: taskTitlePlain(isVehicleTaskTitle(it?.title ?? '') ? stripVehicleTaskMarker(it?.title ?? '') : it?.title),
      once: (it?.repeat_type ?? 'once') === 'once',
      roadmap: !!it?.roadmap_group_task_id,
      vehicle: isVehicleTaskTitle(it?.title ?? ''),
      done: !!inst.completed_at,
      giverId,
      giverName: giverId ? (eventActorNameById[giverId] ?? null) : null,
      dueYmd: it?.due_date ?? null,
      stuck: isStuck(inst),
      first: pickedFirst === inst.id,
      next: listNextId === inst.id,
      meta: inst.scheduled_date < todayYmdInAppTz() ? stillOpenMeta(inst.scheduled_date, it?.due_date ?? null, todayYmdInAppTz()) : null,
    }
  }
  // Step D2: the round is today's open repeating tasks with a plain tick. Anything with steps of its own is left out.
  const roundTasks = todayInstances.map((i) => ({
    id: i.id,
    open: !i.completed_at,
    ring: takesRing({ repeatType: i.checklist_items?.repeat_type ?? 'once', roadmapTaskId: i.checklist_items?.roadmap_group_task_id ?? null }),
    hasLines: taskLines.linesFor(i.id).length > 0,
    asksForPhoto: cardAsksForPhoto({ asksForPhoto: i.checklist_items?.asks_for_photo }, { asksForPhoto: i.checklist_items?.checklist_tech_tree_group_tasks?.asks_for_photo }),
    stuck: isStuck(i),
  }))
  const roundIds = roundTaskIds(roundTasks)
  const roundHeld = roundHeldWords(roundHeldCount(roundTasks))
  const markRound = async () => {
    if (roundBusy || !actorId || roundIds.length < ROUND_MIN) return
    if (!(await confirmRound({ message: roundConfirmMessage(roundIds.length), confirmLabel: roundPressLabel(roundIds.length) }))) return
    setRoundBusy(true)
    try {
      let done = 0
      let failed = 0
      // One at a time, and past a task that does not mark: each takes the tick's own path, pushes and all.
      for (const id of roundIds) {
        const inst = todayInstances.find((i) => i.id === id)
        if (!inst || inst.completed_at) continue
        if (await toggleComplete(inst)) {
          done += 1
          setDoneHere((prev) => new Set(prev).add(id))
        } else failed += 1
      }
      const out = roundOutcome(done, failed)
      showRoundToast(out.line, out.tone)
    } finally {
      setRoundBusy(false)
    }
  }
  // Step D3: Yesterday. A repeating task that went unticked asks once whether it was done or skipped.
  const missed = yesterdayMissed(missedRows, toLocalDateString(new Date()), missedSkippedIds)
  const answerMissed = async (inst: ChecklistInstance, did: boolean) => {
    if (missedBusyId || !actorId) return
    setMissedBusyId(inst.id)
    try {
      if (did) {
        // That day's row is finished, by the tick's own path. It leaves the question because it is done.
        if (await toggleComplete(inst)) setMissedRows((prev) => prev.filter((r) => r.id !== inst.id))
        return
      }
      const refused = await sayTaskStuck({ instanceId: inst.id, userId: actorId, kind: 'skipped', words: '' })
      if (refused) setError(refused)
      else setMissedSkippedIds((prev) => new Set(prev).add(inst.id))
    } finally {
      setMissedBusyId(null)
    }
  }
  const renderTodayCard = (inst: ChecklistInstance, lead: boolean) => {
    // Next can be an older task once today is finished: its dot is the map's colour for it, red only when late.
    const todayYmd = toLocalDateString(new Date())
    const older = inst.scheduled_date < todayYmd
      const title = (inst.checklist_items as { title: string; links?: string[] | null } | null)?.title ?? 'Untitled'
      const links = (inst.checklist_items as { title: string; links?: string[] | null } | null)?.links
      return (
        <ChecklistInstanceCard
          key={inst.id}
          instance={inst}
          variant="fresh"
          lead={lead}
          hearsName={hearsNameFor(inst)}
          justDone={doneHere.has(inst.id)}
          title={<><ChecklistTitleWithLinks title={isVehicleTaskTitle(title) ? stripVehicleTaskMarker(title) : title} links={links} />{isVehicleTaskTitle(title) ? <> {vehicleTaskChip(inst.id, setVehicleCtxInstanceId)}</> : null}{inst.checklist_items?.roadmap_group_task_id ? <div style={{ marginTop: 4 }}>{roadmapGoalChip(inst.checklist_items, undefined, { wrap: true })}</div> : null}{dueCardChip(inst.checklist_items?.due_date)}</>}
          events={eventsByInstance.get(inst.id) ?? []}
          nameById={eventActorNameById}
          currentUserId={personId}
          onToggleComplete={() => {
            if (!actorId) return
            if (!inst.completed_at) setDoneHere((prev) => new Set(prev).add(inst.id))
            void toggleComplete(inst)
          }}
          onPostComment={(body) => postCardComment(inst, body)}
          lines={taskLines.linesFor(inst.id)}
          onTickLine={async (criterionId, ticked) => {
            if (!actorId) return
            const r = await taskLines.tick(inst.id, criterionId, ticked)
            if (!r.ok && r.error) setError(r.error)
            // The last tick closes the card in the database; read the day again so the box and the queue agree.
            if (r.allTicked) await loadToday()
          }}
          ring={takesRing({ repeatType: inst.checklist_items?.repeat_type ?? 'once', roadmapTaskId: inst.checklist_items?.roadmap_group_task_id ?? null })}
          asksForPhoto={cardAsksForPhoto({ asksForPhoto: inst.checklist_items?.asks_for_photo }, { asksForPhoto: inst.checklist_items?.checklist_tech_tree_group_tasks?.asks_for_photo })}
          photos={taskPhotos.photosFor(inst.id)}
          onPhotoAdded={taskPhotos.add}
          place={taskPlaces.placeFor(inst.checklist_item_id)}
          mapId={taskPlaces.mapFor(inst.checklist_item_id)}
          placeNumber={placeNumbers.get(inst.id) ?? null}
          placeOverdue={older && stillOpenIsLate(inst.checklist_items?.due_date ?? null, todayYmd)}
          placeOld={older && !stillOpenIsLate(inst.checklist_items?.due_date ?? null, todayYmd)}
          placeFar={placeFarFor(inst)}
          openSignal={shownTask?.id === inst.id ? shownTask.n : 0}
          spotPhotoUrl={spotPhotos.urlFor(inst.checklist_item_id)}
          onPlaceAdded={() => void taskPlaces.reload()}
          onMapAdded={() => void taskPlaces.reload()}
          onSetPercent={async (percent, words) => {
            if (!actorId) return false
            const r = await setTaskPercent({ instanceId: inst.id, percent, words, authUserId: actorId })
            if (!r.ok) {
              setError(r.error ?? null)
              return false
            }
            await loadToday()
            return true
          }}
          fullHistory={{
            item: {
              id: inst.checklist_item_id,
              title,
              created_at: inst.checklist_items?.created_at ?? null,
              created_by_user_id: inst.checklist_items?.created_by_user_id ?? null,
            },
            showInstanceDays: (inst.checklist_items?.repeat_type ?? 'once') !== 'once',
            setError,
            onPosted: appendLocalCardComment,
            // Today's own toggle keeps its optimistic updates + side effects.
            onComplete: async () => {
              await toggleComplete(inst)
              return true
            },
          }}
          actions={
            <>
              {isNotificationRecipient(inst) && (
                <button type="button" onClick={() => openMuteModal(inst)} style={TASK_PILL_STYLE} title="Mute notifications for this task">
                  Mute alerts
                </button>
              )}
              {canForward && !isLook && (
                <button type="button" className="fwd-btn-desktop" onClick={() => openFwd(inst)} style={TASK_PILL_STYLE} title="Give this task to someone else">
                  Forward
                </button>
              )}
              {canWriteTask && inst.completed_at ? (
                <button type="button" data-follow-up onClick={() => addFollowUp(inst)} style={TASK_PILL_STYLE} title="Write a new task for what this one turned up">
                  {FOLLOW_UP_LABEL}
                </button>
              ) : null}
              {doer.morePress(doerTargetOf(inst))}
            </>
          }
        />
      )
  }

  const day = (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div data-today-head style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.6rem', margin: '0.6rem 0 0.9rem' }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: '1.3rem', lineHeight: 1.15 }}>{todayHeadDate(new Date())}</h2>
          {showSentence ? (
            <p role="status" data-today-sentence style={{ margin: '2px 0 0', fontSize: 13, lineHeight: 1.4, color: 'var(--text-green-700)' }}>
              {todaySentence({ today: todayInstances.length, done: todayDone.length, stillOpen: outstandingInstances.length })}
            </p>
          ) : null}
        </div>
        {modeBar}
      </div>
      {/* Tagged task notes (punch list #375): what waits on this person, above the day's list. It draws nothing while nothing waits. */}
      {/* The tags are read for the signed-in person alone, so a look at someone else's day leaves the section out. */}
      {isLook ? null : <TaggedJobNotesSection variant="today" kinds={tagKinds} onOpenTask={showTask} taskOpens={taskOnPage} onOpenJob={onOpenTaggedJob} />}
      <TaskPlacesMapCard tasks={mapTasks} onShowTask={showTask} onMe={isLook ? () => {} : setMe} />
      {missed.day && !dayFailure ? (
        <section data-yesterday style={{ marginBottom: '0.9rem' }}>
          <h3 style={{ ...TODAY_PART_LABEL, marginTop: 0 }}>{missedLabel(missed.day, toLocalDateString(new Date()), missed.rows.length)}</h3>
          <p style={{ margin: '0 2px 0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {MISSED_ASK} {MISSED_WORDS}
          </p>
          <ul style={{ ...TODAY_PART_LIST, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)' }}>
            {missed.rows.map((inst, i) => (
              <li key={inst.id} data-yesterday-row={inst.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', padding: '0.5rem 0.75rem', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                <span style={{ flex: '1 1 160px', minWidth: 0, fontSize: '0.9375rem', lineHeight: 1.3 }}>{taskTitlePlain(inst.checklist_items?.title)}</span>
                <span style={{ display: 'inline-flex', gap: 6, flexShrink: 0 }}>
                  <button type="button" disabled={missedBusyId !== null} onClick={() => void answerMissed(inst, true)} style={{ ...TASK_PILL_STYLE, minHeight: 38, opacity: missedBusyId === inst.id ? 0.6 : 1 }}>
                    {MISSED_DID_LABEL}
                  </button>
                  <button type="button" disabled={missedBusyId !== null} onClick={() => void answerMissed(inst, false)} style={{ ...TASK_PILL_STYLE, minHeight: 38, opacity: missedBusyId === inst.id ? 0.6 : 1 }}>
                    {MISSED_SKIPPED_LABEL}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section style={{ marginBottom: '1.5rem' }}>
        {dayFailure ? (
          // A read is safe to repeat: when the signal returns the day reads again by itself.
          <OfflineRetryPanel failure={dayFailure} onRetry={loadDay} surface="checklist-today" idempotent busy={loading} />
        ) : !nextInst && todayInstances.length === 0 ? (
          <EmptyState {...checklistTodayEmptyWords(canForward && !isLook ? () => setUpcomingExpanded(true) : null)} />
        ) : (
          <>
            {nextInst ? (
              <>
                <h3 style={TODAY_PART_LABEL}>{todayPartLabel('next', 1)}</h3>
                {pickedFirst ? (
                  <p data-do-first-mark style={{ margin: '0 2px 0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {DO_FIRST_MARK}
                  </p>
                ) : null}
                <ul style={TODAY_PART_LIST}>{renderTodayCard(nextInst, true)}</ul>
              </>
            ) : null}
            {thenRows.length > 0 ? (
              <>
                <h3 style={TODAY_PART_LABEL}>{todayPartLabel('then', thenRows.length)}</h3>
                <ul style={TODAY_PART_LIST}>{thenRows.map((inst) => renderTodayCard(inst, false))}</ul>
              </>
            ) : null}
            {roundIds.length >= ROUND_MIN ? (
              <div data-mark-round style={{ marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => void markRound()}
                  disabled={roundBusy}
                  style={{ display: 'block', width: '100%', minHeight: 44, font: 'inherit', fontSize: 14, fontWeight: 600, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: roundBusy ? 'not-allowed' : 'pointer', opacity: roundBusy ? 0.6 : 1 }}
                >
                  {roundBusy ? 'Marking…' : roundPressLabel(roundIds.length)}
                </button>
                {roundHeld ? <p style={{ margin: '4px 2px 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{roundHeld}</p> : null}
              </div>
            ) : null}
            {stuckRows.length > 0 ? (
              <>
                <h3 style={TODAY_PART_LABEL}>{todayPartLabel('stuck', stuckRows.length)}</h3>
                <ul style={TODAY_PART_LIST}>{stuckRows.map((inst) => renderTodayCard(inst, false))}</ul>
              </>
            ) : null}
            {todayDone.length > 0 ? (
              <>
                <h3 style={TODAY_PART_LABEL}>{todayPartLabel('done', todayDone.length)}</h3>
                <ul style={TODAY_PART_LIST}>{todayDone.map((inst) => renderTodayCard(inst, false))}</ul>
              </>
            ) : null}
          </>
        )}
        {canWriteTask && !dayFailure ? (
          <button
            type="button"
            data-add-own-task
            onClick={addOwnTask}
            style={{ display: 'block', width: '100%', minHeight: 44, marginTop: '0.6rem', font: 'inherit', fontSize: 14, fontWeight: 600, borderRadius: 10, border: '1px dashed var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer' }}
          >
            {ADD_OWN_TASK_LABEL}
          </button>
        ) : null}
      </section>

      <ChecklistOutstandingSection
        instances={olderRows}
        extrasFor={(inst) => doer.morePress(doerTargetOf(inst as ChecklistInstance))}
        onGoThrough={() => {
          if (actorId) doer.startPass(olderRows.map(doerTargetOf))
        }}
        eventsByInstance={eventsByInstance}
        currentUserId={personId}
        nameById={eventActorNameById}
        takesRingFor={(inst) => {
          const it = (inst as ChecklistInstance).checklist_items
          return takesRing({ repeatType: it?.repeat_type ?? 'once', roadmapTaskId: it?.roadmap_group_task_id ?? null })
        }}
        linesFor={(inst) => taskLines.linesFor(inst.id)}
        asksForPhotoFor={(inst) => {
          const it = (inst as ChecklistInstance).checklist_items
          return cardAsksForPhoto({ asksForPhoto: it?.asks_for_photo }, { asksForPhoto: it?.checklist_tech_tree_group_tasks?.asks_for_photo })
        }}
        photosFor={(inst) => taskPhotos.photosFor(inst.id)}
        onPhotoAdded={taskPhotos.add}
        placeFor={(inst) => taskPlaces.placeFor((inst as ChecklistInstance).checklist_item_id)}
        mapFor={(inst) => taskPlaces.mapFor((inst as ChecklistInstance).checklist_item_id)}
        placeNumberFor={(inst) => placeNumbers.get(inst.id) ?? null}
        placeFarFor={(inst) => placeFarFor(inst as ChecklistInstance)}
        openInstance={shownTask}
        spotPhotoUrlFor={(inst) => spotPhotos.urlFor((inst as ChecklistInstance).checklist_item_id)}
        onPlaceAdded={() => void taskPlaces.reload()}
        onPostComment={(inst, body) => postCardComment(inst as ChecklistInstance, body)}
        onTickLine={async (inst, criterionId, ticked) => {
          if (!actorId) return
          const r = await taskLines.tick(inst.id, criterionId, ticked)
          if (!r.ok && r.error) setError(r.error)
          if (r.allTicked) await loadToday()
        }}
        onSetPercent={async (inst, percent, words) => {
          if (!actorId) return false
          const r = await setTaskPercent({ instanceId: inst.id, percent, words, authUserId: actorId })
          if (!r.ok) {
            setError(r.error ?? null)
            return false
          }
          await loadToday()
          return true
        }}
        todayStr={toLocalDateString(new Date())}
        titleFor={(inst) => {
          const item = (inst as ChecklistInstance).checklist_items
          const rawTitle = item?.title ?? 'Untitled'
          return (
            <>
              <ChecklistTitleWithLinks title={isVehicleTaskTitle(rawTitle) ? stripVehicleTaskMarker(rawTitle) : rawTitle} links={item?.links} />
              {isVehicleTaskTitle(rawTitle) ? <> {vehicleTaskChip((inst as ChecklistInstance).id, setVehicleCtxInstanceId)}</> : null}
              {item?.roadmap_group_task_id ? <div style={{ marginTop: 4 }}>{roadmapGoalChip(item, undefined, { wrap: true })}</div> : null}
            </>
          )
        }}
        activityFor={(inst) => {
          const full = inst as ChecklistInstance
          return {
            item: {
              id: full.checklist_item_id,
              title: full.checklist_items?.title ?? 'Untitled',
              created_at: full.checklist_items?.created_at ?? null,
              created_by_user_id: full.checklist_items?.created_by_user_id ?? null,
            },
            showInstanceDays: (full.checklist_items?.repeat_type ?? 'once') !== 'once',
          }
        }}
        onToggleComplete={(inst) => void toggleComplete(inst as ChecklistInstance)}
        onPosted={appendLocalCardComment}
        onCompleteForActivity={async (inst) => {
          await toggleComplete(inst as ChecklistInstance)
          return true
        }}
        setError={setError}
      />

      <ChecklistComingUpSection authUserId={personId} />

      {canForward ? (
      <section>
        <button
          type="button"
          onClick={() => setUpcomingExpanded(!upcomingExpanded)}
          aria-expanded={upcomingExpanded}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 0',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '1rem',
          }}
        >
          {upcomingExpanded ? '▼' : '▶'} Upcoming
        </button>
        {upcomingExpanded && (
          <div style={{ marginTop: '0.5rem' }}>
            {upcomingInstances.length === 0 ? (
              <EmptyState compact {...CHECKLIST_UPCOMING_EMPTY} />
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {upcomingInstances.map((inst) => {
                  const title = (inst.checklist_items as { title: string; links?: string[] | null } | null)?.title ?? 'Untitled'
                  const links = (inst.checklist_items as { title: string; links?: string[] | null } | null)?.links
                  return (
                    <li
                      key={inst.id}
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        gap: '1rem',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{inst.scheduled_date}</span>
                      <span style={{ flex: 1 }}><ChecklistTitleWithLinks title={title} links={links} /></span>
                      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                        {isNotificationRecipient(inst) && (
                          <button
                            type="button"
                            onClick={() => openMuteModal(inst)}
                            style={{
                              padding: '0.25rem',
                              border: '1px solid var(--border-strong)',
                              borderRadius: 4,
                              background: 'var(--surface)',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              lineHeight: 1,
                            }}
                            title="Mute notifications for this task"
                            aria-label="Mute notifications for this task"
                          >
                            🔕
                          </button>
                        )}
                        {canForward && !isLook && (
                          <button
                            type="button"
                            className="fwd-btn-desktop"
                            onClick={() => openFwd(inst)}
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.8125rem',
                              fontWeight: 500,
                              border: '1px solid #2563eb',
                              borderRadius: 4,
                              background: '#2563eb',
                              color: 'white',
                              cursor: 'pointer',
                            }}
                          >
                            FWD
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </section>
      ) : null}

      {fwdInstance && !isLook && (
        <TaskForwardWindow
          title={taskTitlePlain((fwdInstance.checklist_items as { title?: string } | null)?.title ?? 'Untitled')}
          people={forwardTakers(users, authUserId ?? null)}
          saving={fwdSaving}
          refusal={fwdRefusal}
          onForward={(toUserId) => void saveFwd(toUserId)}
          onClose={() => setFwdInstance(null)}
        />
      )}

      {isLook ? null : doer.sheets}
      <ChecklistItemMuteModal
        open={!!muteModalItemId && !isLook}
        checklistItemId={muteModalItemId}
        taskTitle={muteModalTitle}
        authUserId={authUserId}
        onClose={() => setMuteModalItemId(null)}
        onSaved={() => {}}
      />
      {vehicleCtxInstanceId && !isLook && (
        <VehicleTaskContextModal
          instanceId={vehicleCtxInstanceId}
          canOpenVehiclesPage={canOpenVehiclesPage}
          onClose={() => setVehicleCtxInstanceId(null)}
        />
      )}
    </div>
  )
  // A look is drawn as the person's phone draws it, inside the box that stops every press that would change a task.
  return isLook ? <TaskLookGate>{day}</TaskLookGate> : day
}

function ChecklistOutstandingTab({ authUserId, canActForOthers, canViewAs, canSeeCosts, canManageChecklists, canEditRoadmapTasks, setError, setEditItemId, onOpenRoadmap }: { authUserId: string | null; canActForOthers: boolean; /** A dev: the look's line to View as the person (punch list #381, call 7). */ canViewAs: boolean; /** Cost lens (dev, controller or the owner — mirrors checklist_item_costs RLS). */ canSeeCosts: boolean; canManageChecklists: boolean; /** Roadmap structure editors (v2.2182) — may edit tasks from the Where-this-fits sheet. */ canEditRoadmapTasks: boolean; setError: (s: string | null) => void; setEditItemId: (id: string) => void; onOpenRoadmap?: (roadmapId: string) => void }) {
  const checklistAddModal = useChecklistAddModal()
  const [loading, setLoading] = useState(true)
  const [byUser, setByUser] = useState<Array<{ userId: string; name: string; count: number; instances: OutstandingInstance[] }>>([])
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  /**
   * See a person's Task Mode (punch list #381): whose screen the window draws, when it was read, and the person's role
   * once it is read. The role decides what their phone offers, such as the office's Upcoming fold.
   */
  const [lookPerson, setLookPerson] = useState<{ userId: string; name: string; readAt: Date; n: number; role?: UserRole | null; email?: string | null; loginAttached?: boolean } | null>(null)
  const openLook = (userId: string, name: string) => {
    setLookPerson({ userId, name, readAt: new Date(), n: 0 })
    void supabase
      .from('users')
      .select('role, email, login_attached_at')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as { role?: string | null; email?: string | null; login_attached_at?: string | null } | null
        const role = (row?.role ?? null) as UserRole | null
        // A role that does not read draws the plain screen, the one a crew phone shows.
        setLookPerson((cur) => (cur && cur.userId === userId ? { ...cur, role, email: row?.email ?? null, loginAttached: row?.login_attached_at != null } : cur))
      })
  }
  const [dateRange, setDateRange] = useState<'next_day' | 'next_week' | 'non_repeating' | 'missed'>('non_repeating')
  /** Missed view: representative instance id → its whole missed group (collapse, v2.2272). */
  const [missedGroups, setMissedGroups] = useState<Map<string, MissedGroup<OutstandingInstance>>>(new Map())
  const [remindingUserId, setRemindingUserId] = useState<string | null>(null)
  /** Your people's week (#273, PR 5): the Monday email's subscribe sheet, the board's people picked. */
  const [peopleWeekOpen, setPeopleWeekOpen] = useState(false)
  /** 5s undo window after a row ✓ (mockup 55d69b29): the completion is saved
   *  immediately, but notifications + the next repeat occurrence are HELD in
   *  pendingSideEffectsRef until the window closes — Undo reverses the save
   *  and cancels them, so an undone completion pings no one. */
  const [undoToast, setUndoToast] = useState<{ title: string; count: number; instanceIds: string[] } | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSideEffectsRef = useRef<(() => void) | null>(null)
  const flushPendingCompletion = useCallback(() => {
    if (undoTimerRef.current != null) {
      clearTimeout(undoTimerRef.current)
      undoTimerRef.current = null
    }
    const fn = pendingSideEffectsRef.current
    pendingSideEffectsRef.current = null
    if (fn) fn()
    setUndoToast(null)
  }, [])
  // Leaving the tab commits any pending window — side effects are deferred, never lost.
  useEffect(() => () => flushPendingCompletion(), [flushPendingCompletion])
  const costEstimates = useChecklistCostEstimates(canSeeCosts)
  const { showToast } = useToastContext()
  const [fwdInstance, setFwdInstance] = useState<OutstandingInstance | null>(null)
  const [fwdFromUserId, setFwdFromUserId] = useState('')
  const [fwdSaving, setFwdSaving] = useState(false)
  /** Why the last Forward did not take, shown in the window in the database's words. */
  const [fwdRefusal, setFwdRefusal] = useState<string | null>(null)
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [deletingInstanceId, setDeletingInstanceId] = useState<string | null>(null)
  const [completingInstanceId, setCompletingInstanceId] = useState<string | null>(null)
  const [reorderingUserId, setReorderingUserId] = useState<string | null>(null)
  const [outstandingDeletePending, setOutstandingDeletePending] = useState<OutstandingInstance | null>(null)
  const [roadmapContextTaskId, setRoadmapContextTaskId] = useState<string | null>(null)
  /** Row expanded to its activity spine (history + notes), v2.2012. */
  const [expandedInstanceId, setExpandedInstanceId] = useState<string | null>(null)
  /** Comment-event counts per listed instance — powers the 💬 chips. */
  const [notesByInstance, setNotesByInstance] = useState<Map<string, number>>(new Map())
  // Team-board chrome (v2.1872): summary tiles + folded inboxes.
  const [reviewCount, setReviewCount] = useState<number | null>(null)
  const [openReqCount, setOpenReqCount] = useState<number | null>(null)
  const [foldReviewOpen, setFoldReviewOpen] = useState(false)
  const [foldInboxOpen, setFoldInboxOpen] = useState(false)
  const [missedWeekCount, setMissedWeekCount] = useState<number | null>(null)
  /** Review tiles (v2.2194): the missed instances' dates (weekday caption) + section jump refs. */
  const [missedWeekDates, setMissedWeekDates] = useState<string[]>([])
  const foldReviewRef = useRef<HTMLDivElement | null>(null)
  const outstandingBoardRef = useRef<HTMLDivElement | null>(null)
  const onReviewCount = useCallback((n: number) => setReviewCount(n), [])
  const onOpenReqCount = useCallback((n: number) => setOpenReqCount(n), [])

  useEffect(() => {
    loadOutstanding()
  }, [dateRange])

  const loadOutstandingRef = useRef(loadOutstanding)
  loadOutstandingRef.current = loadOutstanding
  useEffect(() => {
    const handler = () => loadOutstandingRef.current()
    window.addEventListener('checklist-item-saved', handler)
    return () => window.removeEventListener('checklist-item-saved', handler)
  }, [])

  useEffect(() => {
    if (canActForOthers) {
      // Tier-2 #19 (J30-2): person pickers = active people (no twins); dev rows stay.
      activeUsersQuery('id, name, email', { includeDev: true, withLogin: true })
        .then(({ data }) => {
        setUsers((data ?? []) as Array<{ id: string; name: string; email: string }>)
      })
    }
  }, [canActForOthers])

  function openFwd(inst: OutstandingInstance, rowUserId: string) {
    setFwdRefusal(null)
    setFwdInstance(inst)
    // Whose task it is now: the function swaps this person for the one picked, so the list leaves them out.
    setFwdFromUserId(rowUserId)
  }

  function openOutstandingDeleteModal(inst: OutstandingInstance) {
    setOutstandingDeletePending(inst)
  }

  async function performDeleteOutstandingInstance(inst: OutstandingInstance) {
    setDeletingInstanceId(inst.id)
    setError(null)
    try {
      // Missed view: the row stands for every missed copy — delete them all.
      const targetIds = missedGroups.get(inst.id)?.instanceIds ?? [inst.id]
      const { error: err } = await supabase.from('checklist_instances').delete().in('id', targetIds)
      if (err) throw err
      setOutstandingDeletePending(null)
      await loadOutstanding()
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Failed to delete'))
    } finally {
      setDeletingInstanceId(null)
    }
  }

  /** ✓ Complete from a row's activity panel (v2.2039) — shared side effects, then refresh. */
  async function completePanelInstance(args: { instanceId: string; checklistItemId: string; scheduledDate: string }): Promise<boolean> {
    if (!authUserId) return false
    const res = await completeChecklistInstance({ ...args, authUserId })
    if (!res.ok) {
      setError(res.error ?? 'Failed to complete this task.')
      return false
    }
    await loadOutstanding()
    return true
  }

  async function markComplete(inst: OutstandingInstance) {
    if (!authUserId || completingInstanceId) return
    setCompletingInstanceId(inst.id)
    setError(null)
    try {
      // Missed view: the row stands for every missed copy of the item — one ✓
      // resolves the whole backlog (one update, one notification, one next
      // occurrence, counted from today — the day it was done, v2.3842).
      const group = missedGroups.get(inst.id)
      const targetIds = group ? group.instanceIds : [inst.id]
      const { data: updatedRows, error: err } = await supabase
        .from('checklist_instances')
        .update({
          completed_at: new Date().toISOString(),
          completed_by_user_id: authUserId,
        })
        .in('id', targetIds)
        .select('id')
      if (err) throw err
      if (!updatedRows?.length) {
        setError('Could not mark this task complete (no rows updated).')
        return
      }
      // The completion belongs in the sign-off queue right above this board.
      window.dispatchEvent(new CustomEvent('checklist-instance-completed', { detail: inst.id }))
      // Everything below (watcher pushes + the next repeat occurrence) waits
      // out the 5s undo window; Undo cancels it wholesale.
      const runSideEffects = () => void (async () => {
      const { data: item } = await supabase
        .from('checklist_items')
        .select('notify_on_complete_user_id, notify_creator_on_complete, created_by_user_id, title')
        .eq('id', inst.checklist_item_id)
        .single()
      if (item) {
        const title = (item as { title: string }).title
        const body = `Dev completed: ${title}`
        const recipients: string[] = []
        const notifyUserId = (item as { notify_on_complete_user_id: string | null }).notify_on_complete_user_id
        if (notifyUserId) recipients.push(notifyUserId)
        const notifyCreator = (item as { notify_creator_on_complete: boolean }).notify_creator_on_complete
        const creatorId = (item as { created_by_user_id: string }).created_by_user_id
        if (notifyCreator && creatorId && !recipients.includes(creatorId)) recipients.push(creatorId)
        for (const uid of recipients) {
          try {
            await supabase.functions.invoke('send-checklist-notification', {
              body: { recipient_user_id: uid, push_title: 'Checklist completed', push_body: body, push_url: '/checklist', tag: `checklist-${inst.id}` },
            })
          } catch {
            /* ignore */
          }
        }
      }
      await createNextChecklistRepeat(inst.checklist_item_id)
      })()
      flushPendingCompletion() // a second ✓ inside a window commits the first
      pendingSideEffectsRef.current = runSideEffects
      undoTimerRef.current = setTimeout(flushPendingCompletion, 5000)
      setUndoToast({
        title: inst.checklist_items?.title ?? 'Task',
        count: targetIds.length,
        instanceIds: targetIds,
      })
      await loadOutstanding()
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Failed to mark complete'))
    } finally {
      setCompletingInstanceId(null)
    }
  }

  /** Undo inside the window: reverse the save, cancel the held side effects. */
  async function undoComplete() {
    const toast = undoToast
    if (!toast) return
    if (undoTimerRef.current != null) {
      clearTimeout(undoTimerRef.current)
      undoTimerRef.current = null
    }
    pendingSideEffectsRef.current = null
    setUndoToast(null)
    try {
      const { error: err } = await supabase
        .from('checklist_instances')
        .update({ completed_at: null, completed_by_user_id: null })
        .in('id', toast.instanceIds)
      if (err) throw err
      window.dispatchEvent(new CustomEvent('checklist-instance-completed', { detail: null }))
      await loadOutstanding()
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Failed to undo'))
    }
  }

  async function saveFwd(toUserId: string) {
    if (!fwdInstance || !authUserId || !toUserId || fwdSaving) return
    setFwdSaving(true)
    setFwdRefusal(null)
    try {
      // Punch list #369, step C7: one person for another on the same task. The copy this made, and the delete of the
      // first day row with its thread, are gone: the task keeps its notes, place, lines and photos.
      const refused = await handOnTask(fwdInstance.id, toUserId, null, fwdFromUserId || null)
      if (refused) {
        setFwdRefusal(refused)
        return
      }
      void tellForwardTaker({ byUserId: authUserId, toUserId, instanceId: fwdInstance.id, taskTitle: taskTitlePlain(fwdInstance.checklist_items?.title ?? 'Untitled') })
      setFwdInstance(null)
      await loadOutstanding()
    } catch (err: unknown) {
      setFwdRefusal(formatErrorMessage(err, 'The task was not forwarded.'))
    } finally {
      setFwdSaving(false)
    }
  }

  async function sendReminder(userId: string, name: string, instances: OutstandingInstance[]) {
    setRemindingUserId(userId)
    const titles = instances.map((inst) => inst.checklist_items?.title ?? '—')
    const n = titles.length
    const body =
      n === 1
        ? `You have 1 outstanding task: ${titles[0]}`
        : n <= 3
          ? `You have ${n} outstanding tasks: ${titles.join(', ')}`
          : `You have ${n} outstanding tasks: ${titles.slice(0, 3).join(', ')} and ${n - 3} more`
    try {
      const { data, error: fnError } = await supabase.functions.invoke('send-checklist-notification', {
        body: {
          recipient_user_id: userId,
          push_title: 'Task reminder',
          push_body: body,
          push_url: '/checklist',
          tag: 'task-reminder',
        },
      })
      // Honest outcome toast (v2.2200): the function reports how many devices actually got the push.
      if (fnError) throw fnError
      const sent = (data as { push_sent?: number } | null)?.push_sent ?? 0
      if (sent > 0) {
        showToast(`Reminded ${name} on ${sent} device${sent === 1 ? '' : 's'}.`, 'success')
      } else {
        showToast(`${name} has no notification-enabled devices — the reminder had nowhere to land. A text or call is the sure path.`, 'error')
      }
    } catch {
      showToast(`Couldn't send the reminder to ${name} — try again.`, 'error')
    } finally {
      setRemindingUserId(null)
    }
  }

  async function persistOutstandingOrderForUser(userId: string, ordered: OutstandingInstance[]) {
    setReorderingUserId(userId)
    setError(null)
    try {
      for (let i = 0; i < ordered.length; i++) {
        const inst = ordered[i]
        if (!inst) continue
        await withSupabaseRetry(
          async () =>
            supabase
              .from('checklist_item_assignees')
              .update({ display_order: i + 1 })
              .eq('checklist_item_id', inst.checklist_item_id)
              .eq('user_id', userId),
          'update checklist assignee display order'
        )
      }
      await loadOutstanding()
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Failed to reorder'))
    } finally {
      setReorderingUserId(null)
    }
  }

  function onOutstandingDragEnd(userId: string, instances: OutstandingInstance[]) {
    return (e: DragEndEvent) => {
      const { active, over } = e
      if (!over || active.id === over.id) return
      const oldIndex = instances.findIndex((i) => i.id === active.id)
      const newIndex = instances.findIndex((i) => i.id === over.id)
      if (oldIndex < 0 || newIndex < 0) return
      if (oldIndex === newIndex) return
      const reordered = arrayMove(instances, oldIndex, newIndex)
      void persistOutstandingOrderForUser(userId, reordered)
    }
  }

  async function loadOutstanding() {
    setLoading(true)
    setError(null)
    // Summary tile: misses this company week (Sun -> today), independent of the
    // range filter below. Count-only HEAD request — cheap.
    void (async () => {
      const todayStr = todayYmdInAppTz()
      const { data, count } = await supabase
        .from('checklist_instances')
        .select('scheduled_date', { count: 'exact' })
        .is('completed_at', null)
        .gte('scheduled_date', weekStartSunday(todayStr))
        .lt('scheduled_date', todayStr)
        .limit(500)
      setMissedWeekCount(count ?? 0)
      setMissedWeekDates(((data as Array<{ scheduled_date: string }> | null) ?? []).map((r) => r.scheduled_date))
    })()
    const tomorrow = localCalendarDayKey(new Date(Date.now() + 864e5))
    const weekEnd = localCalendarDayKey(new Date(Date.now() + 7 * 864e5))

    let query = supabase
      .from('checklist_instances')
      .select('id, checklist_item_id, scheduled_date, checklist_items(title, links, repeat_type, reminder_scope, created_at, created_by_user_id, roadmap_group_task_id, checklist_tech_tree_group_tasks(group_id, checklist_tech_tree_groups(title, roadmap_id, checklist_tech_tree_roadmaps(title)))), checklist_instance_assignees(user_id, users(name, email))')
      .is('completed_at', null)
      .order('scheduled_date', { ascending: true })

    if (dateRange === 'missed') {
      const yesterday = localCalendarDayKey(new Date(Date.now() - 864e5)) // more than 1 day old = scheduled before yesterday
      query = query.lt('scheduled_date', yesterday)
    } else if (dateRange !== 'non_repeating') {
      const start = dateRange === 'next_day' ? tomorrow : tomorrow
      const end = dateRange === 'next_day' ? tomorrow : weekEnd
      query = query.gte('scheduled_date', start).lte('scheduled_date', end)
    }

    const { data, error } = await query
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    const raw = (data ?? []) as Array<{
      id: string
      checklist_item_id: string
      scheduled_date: string
      checklist_items?: { title?: string; links?: string[] | null; repeat_type?: string; reminder_scope?: string | null } | null
      checklist_instance_assignees?: Array<{ user_id: string; users?: { name?: string; email?: string } | null }>
    }>
    let instances = raw.filter((inst) => {
      const assignees = inst.checklist_instance_assignees ?? []
      return assignees.length > 0
    })
    if (dateRange === 'non_repeating') {
      instances = instances.filter((inst) => (inst.checklist_items as { repeat_type?: string } | null)?.repeat_type === 'once')
    }
    if (dateRange === 'missed') {
      instances = instances.filter((inst) => (inst.checklist_items as { reminder_scope?: string | null } | null)?.reminder_scope !== 'today_and_overdue')
    }
    const map = new Map<string, { inst: OutstandingInstance; name: string }[]>()
    for (const row of instances) {
      const inst: OutstandingInstance = {
        id: row.id,
        checklist_item_id: row.checklist_item_id,
        scheduled_date: row.scheduled_date,
        checklist_items: row.checklist_items ?? null,
      }
      const assignees = row.checklist_instance_assignees ?? []
      for (const a of assignees) {
        const name = a.users?.name || a.users?.email || 'Unknown'
        const list = map.get(a.user_id) ?? []
        list.push({ inst, name })
        map.set(a.user_id, list)
      }
    }
    const userIds = [...map.keys()]
    const itemIds = [...new Set(instances.map((i) => i.checklist_item_id))]
    const orderMap = new Map<string, Map<string, number>>()
    if (userIds.length > 0 && itemIds.length > 0) {
      const { data: orderData } = await supabase
        .from('checklist_item_assignees')
        .select('checklist_item_id, user_id, display_order')
        .in('user_id', userIds)
        .in('checklist_item_id', itemIds)
      for (const row of (orderData ?? []) as Array<{ checklist_item_id: string; user_id: string; display_order: number | null }>) {
        let userMap = orderMap.get(row.user_id)
        if (!userMap) {
          userMap = new Map()
          orderMap.set(row.user_id, userMap)
        }
        userMap.set(row.checklist_item_id, row.display_order ?? 999999)
      }
    }
    const groupsByRep = new Map<string, MissedGroup<OutstandingInstance>>()
    const rows = Array.from(map.entries()).map(([userId, list]) => {
      const name = list[0]?.name ?? 'Unknown'
      const userOrderMap = orderMap.get(userId)
      let sortedInstances = [...list.map((x) => x.inst)].sort((a, b) => {
        const orderA = userOrderMap?.get(a.checklist_item_id) ?? 999999
        const orderB = userOrderMap?.get(b.checklist_item_id) ?? 999999
        if (orderA !== orderB) return orderA - orderB
        return a.scheduled_date.localeCompare(b.scheduled_date)
      })
      if (dateRange === 'missed') {
        // A missed task is ONE task, incomplete for X days — not one row per
        // missed day (a daily item missed for months was 180 rows and made
        // "505 outstanding" counts). ✓/🗑 act on the whole group.
        const groups = collapseMissedInstances(sortedInstances)
        for (const g of groups) groupsByRep.set(g.representative.id, g)
        sortedInstances = groups.map((g) => g.representative)
      }
      return { userId, name, count: sortedInstances.length, instances: sortedInstances }
    })
    rows.sort((a, b) => b.count - a.count)
    setMissedGroups(groupsByRep)
    setByUser(rows)
    setLoading(false)
    // 💬 chips: count comment events per listed instance. Non-blocking, and
    // chunked so a wide board can't overflow the .in() URL (ledger pattern).
    void (async () => {
      const ids = instances.map((i) => i.id)
      const counts = new Map<string, number>()
      const chunks: string[][] = []
      for (let i = 0; i < ids.length; i += 150) chunks.push(ids.slice(i, i + 150))
      const results = await Promise.all(
        chunks.map((chunk) =>
          supabase
            .from('checklist_instance_events')
            .select('instance_id')
            .eq('event_type', 'comment')
            .in('instance_id', chunk),
        ),
      )
      for (const r of results) {
        for (const row of (r.data ?? []) as Array<{ instance_id: string }>) {
          counts.set(row.instance_id, (counts.get(row.instance_id) ?? 0) + 1)
        }
      }
      setNotesByInstance(counts)
    })()
  }

  const outstandingTotal = byUser.reduce((n, u) => n + u.count, 0)
  // Who each listed task's tagged notes still wait on (punch list #375), beside the note counts.
  const waitingByItem = useOpenTaskTagNames(useMemo(() => byUser.flatMap((u) => u.instances.map((i) => i.checklist_item_id)), [byUser]))
  // Where the open tasks are (#328, PR 7): the board's own rows with their places, by person and in the board's order.
  const boardPlaces = useTaskPlaces(byUser.flatMap((u) => u.instances.map((i) => i.checklist_item_id)))
  const teamMapPeople = useMemo<TaskPlacesTeamPerson[]>(
    () => byUser.map((u) => ({ userId: u.userId, name: u.name, tasks: u.instances.map((i) => ({ id: i.id, title: taskTitlePlain(i.checklist_items?.title), place: boardPlaces.placeFor(i.checklist_item_id) })) })),
    [byUser, boardPlaces],
  )
  /** Review tiles (v2.2194): centered, tappable, captioned; the tile whose list is showing stays lit. */
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <ChecklistStuckSection authUserId={authUserId} />
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}>
        {reviewTile('To sign off', reviewCount, reviewTileTone('signoff', reviewCount), signOffTileCaption(reviewCount), foldReviewOpen, () => {
          setFoldReviewOpen(true)
          foldReviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })}
        {reviewTile(
          'Outstanding',
          loading ? null : outstandingTotal,
          reviewTileTone('outstanding', loading ? null : outstandingTotal),
          loading
            ? { text: '…', ok: false }
            : outstandingTileCaption(
                BOARD_RANGE_LABELS[dateRange as BoardRange],
                byUser.length,
                byUser.reduce<number | null>((mx, u) => {
                  const d = oldestAgeDays(u.instances, todayYmdInAppTz())
                  return d == null ? mx : mx == null ? d : Math.max(mx, d)
                }, null),
              ),
          dateRange !== 'missed',
          () => {
            if (dateRange === 'missed') setDateRange('non_repeating')
            outstandingBoardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          },
        )}
        {reviewTile('Missed this week', missedWeekCount, reviewTileTone('missed', missedWeekCount), missedWeekCount == null ? { text: '…', ok: false } : missedTileCaption(missedWeekDates), dateRange === 'missed', () => {
          setDateRange('missed')
          outstandingBoardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', maxWidth: 640, margin: '-0.6rem auto 0.8rem' }}>
        <button
          type="button"
          onClick={() => setPeopleWeekOpen(true)}
          style={{ fontSize: '0.8rem', fontWeight: 600, padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}
        >
          ✉ Email me their week
        </button>
      </div>
      <PeopleWeekSheet open={peopleWeekOpen} onClose={() => setPeopleWeekOpen(false)} meId={authUserId} canPickOthers={canEditRoadmapTasks} suggested={byUser.map((u) => u.userId)} />
      <div ref={foldReviewRef} style={{ border: '1px solid var(--border)', borderRadius: 10, marginBottom: '0.6rem', overflow: 'hidden', scrollMarginTop: 70 }}>
        {reviewFoldHeader('Review: completed work', reviewCount == null ? null : String(reviewCount), 'blue', foldReviewOpen, () => setFoldReviewOpen((o) => !o))}
        <div style={{ display: foldReviewOpen ? 'block' : 'none', borderTop: '1px solid var(--border)', padding: foldReviewOpen ? '0.5rem 0.5rem 0.2rem' : 0 }}>
          <ChecklistReviewInboxSection onCountChange={onReviewCount} renderWhenEmpty />
          {(() => {
            // Calibration strip (dev/controller): one line, only once it means something.
            if (!canSeeCosts) return null
            const all = Object.values(costEstimates)
            const acc = estimateAccuracy(all)
            if (!acc || acc.count < ACCURACY_MIN_COUNT) return null
            const perPerson = estimateAccuracyByPerson(all).slice(0, 3)
            return (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '0.6rem',
                  flexWrap: 'wrap',
                  margin: '0.5rem 0 0',
                  padding: '0.45rem 0.75rem',
                  borderRadius: 9,
                  background: 'var(--bg-amber-tint)',
                  border: '1px solid #d97706',
                  fontSize: '0.78rem',
                  color: 'var(--text-amber-800)',
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{formatMultiplier(acc.multiplier)}</span>
                <span>
                  estimates run {acc.multiplier > 1.05 ? 'hot' : acc.multiplier < 0.95 ? 'cold' : 'true'} · {acc.count} task{acc.count === 1 ? '' : 's'} with actuals
                </span>
                {perPerson.map((pp) => (
                  <span key={pp.personName} style={{ whiteSpace: 'nowrap', color: 'var(--text-700)' }}>
                    {pp.personName} {formatMultiplier(pp.multiplier)}
                  </span>
                ))}
              </div>
            )
          })()}
        </div>
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, marginBottom: '1.25rem', overflow: 'hidden' }}>
        {reviewFoldHeader('Dispatch & estimator inboxes', openReqCount == null ? null : `${openReqCount} open`, openReqCount ? 'red' : 'muted', foldInboxOpen, () => setFoldInboxOpen((o) => !o))}
        <div style={{ display: foldInboxOpen ? 'block' : 'none', borderTop: '1px solid var(--border)', padding: '0.5rem 0.5rem 0' }}>
          <ChecklistReviewInboxes hideChecklistReviewSection onOpenRequestCount={onOpenReqCount} />
        </div>
      </div>
      <div ref={outstandingBoardRef} style={{ marginBottom: '1.5rem', scrollMarginTop: 70 }}>
        <TaskPlacesTeamMapCard people={teamMapPeople} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0 }}>Outstanding by person</h3>
          <div style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 8, overflow: 'hidden', marginLeft: 'auto' }}>
            {BOARD_RANGE_ORDER.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setDateRange(r)}
                aria-pressed={dateRange === r}
                style={{
                  padding: '0.45rem 0.8rem',
                  fontSize: '0.8125rem',
                  fontWeight: dateRange === r ? 600 : 400,
                  border: 'none',
                  background: dateRange === r ? '#2563eb' : 'var(--surface)',
                  color: dateRange === r ? 'white' : 'var(--text-700)',
                  cursor: 'pointer',
                }}
              >
                {BOARD_RANGE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <p>Loading…</p>
        ) : byUser.length === 0 ? (
          <EmptyState {...checklistOutstandingEmptyWords(dateRange)} />
        ) : (
          <div>
            {byUser.map(({ userId, name, count, instances }) => {
              const todayLocal = todayYmdInAppTz()
              const oldest = oldestAgeDays(instances, todayLocal)
              const oldestSeverity = ageSeverity(oldest)
              const notesTotal = instances.reduce((n, i) => n + (notesByInstance.get(i.id) ?? 0), 0)
              const waitingNames = [...new Set(instances.flatMap((i) => waitingByItem.get(i.checklist_item_id) ?? []))]
              const costTotal = canSeeCosts
                ? sumEstimateDollars(
                    instances.map(
                      (i) => costEstimates[i.checklist_items?.roadmap_group_task_id ?? i.checklist_item_id],
                    ),
                  )
                : 0
              const expanded = expandedUserId === userId
              return (
                <div key={userId} style={{ border: '1px solid var(--border-strong)', borderRadius: 12, marginBottom: '0.6rem', overflow: 'hidden' }}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedUserId((prev) => (prev === userId ? null : userId))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setExpandedUserId((prev) => (prev === userId ? null : userId))
                      }
                    }}
                    aria-expanded={expanded}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 0.75rem', cursor: 'pointer' }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 34,
                        height: 34,
                        flexShrink: 0,
                        borderRadius: '50%',
                        background: 'var(--bg-blue-tint)',
                        color: 'var(--text-blue-800)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                      }}
                    >
                      {initialsFor(name)}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-strong)' }}>{name}</span>
                      <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 1 }}>
                        {count} outstanding
                        {oldest > 0 ? (
                          <>
                            {' · '}
                            <span
                              style={{
                                // Wrap as one unit on phones: "oldest 118 days" moves to its own line whole, never "oldest 118 / days".
                                whiteSpace: 'nowrap',
                                color:
                                  oldestSeverity === 'late'
                                    ? 'var(--text-red-700)'
                                    : oldestSeverity === 'warn'
                                      ? 'var(--text-amber-800)'
                                      : 'var(--text-muted)',
                              }}
                            >
                              oldest {oldest} {oldest === 1 ? 'day' : 'days'}
                            </span>
                          </>
                        ) : null}
                        {notesTotal > 0 ? <> · <span style={{ whiteSpace: 'nowrap' }}>💬 {notesTotal} {notesTotal === 1 ? 'note' : 'notes'}</span></> : null}
                        {waitingNames.length > 0 ? <> · <span data-person-waiting-on style={{ color: 'var(--text-amber-800)' }}>{waitingOnWords(waitingNames, waitingNames)}</span></> : null}
                        {costTotal > 0 ? (
                          <>
                            {' · '}
                            <span
                              style={{
                                whiteSpace: 'nowrap',
                                fontWeight: 700,
                                padding: '0.05rem 0.4rem',
                                borderRadius: 7,
                                background: '#fbbf24',
                                border: '1px solid #d97706',
                                color: '#451a03',
                              }}
                            >
                              {formatWholeDollars(costTotal)}
                            </span>
                          </>
                        ) : null}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={remindingUserId === userId}
                      onClick={(e) => {
                        e.stopPropagation()
                        sendReminder(userId, name, instances)
                      }}
                      style={{
                        minHeight: 36,
                        padding: '0 0.75rem',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        border: '1px solid var(--border-strong)',
                        borderRadius: 8,
                        background: 'var(--surface)',
                        color: 'var(--text-700)',
                        cursor: remindingUserId === userId ? 'not-allowed' : 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      {remindingUserId === userId ? 'Sending…' : '🔔 Remind'}
                    </button>
                    <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{expanded ? '▾' : '▸'}</span>
                  </div>
                  {expanded && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: '0.6rem 0.75rem', background: 'var(--bg-subtle)' }}>
                      <OutstandingByPersonSortableList
                        userId={userId}
                        instances={instances}
                        reorderingUserId={reorderingUserId}
                        canManageChecklists={canManageChecklists}
                        canActForOthers={canActForOthers}
                        canSeeCosts={canSeeCosts}
                        authUserId={authUserId}
                        onDragEnd={onOutstandingDragEnd(userId, instances)}
                        completingInstanceId={completingInstanceId}
                        deletingInstanceId={deletingInstanceId}
                        expandedInstanceId={expandedInstanceId}
                        notesByInstance={notesByInstance}
                        waitingByItem={waitingByItem}
                        missedCountByInstance={new Map([...missedGroups.values()].map((g) => [g.representative.id, g.count]))}
                        onToggleExpanded={(instanceId) => setExpandedInstanceId((prev) => (prev === instanceId ? null : instanceId))}
                        onMarkComplete={markComplete}
                        onDeleteInstance={openOutstandingDeleteModal}
                        onOpenRoadmapContext={setRoadmapContextTaskId}
                        onOpenFwd={openFwd}
                        onCompleteFromPanel={completePanelInstance}
                        setEditItemId={setEditItemId}
                        setError={setError}
                      />
                      {canActForOthers && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }}>
                          <button
                            type="button"
                            onClick={() => checklistAddModal?.openAddModal(userId)}
                            style={{
                              minHeight: 36,
                              padding: '0 0.8rem',
                              fontSize: '0.8125rem',
                              fontWeight: 600,
                              border: '1px dashed var(--border-strong)',
                              borderRadius: 8,
                              background: 'none',
                              color: 'var(--text-link)',
                              cursor: 'pointer',
                            }}
                          >
                            ＋ Add task for {name.split(' ')[0]}
                          </button>
                          {/* Punch list #381: this person's Task Mode screen in a window, as a look. */}
                          <button
                            type="button"
                            data-see-task-mode={userId}
                            onClick={() => openLook(userId, name)}
                            title={lookPressTitle(name)}
                            style={{
                              minHeight: 36,
                              padding: '0 0.8rem',
                              fontSize: '0.8125rem',
                              fontWeight: 600,
                              border: '1px solid var(--border-strong)',
                              borderRadius: 8,
                              background: 'var(--surface)',
                              color: 'var(--text-strong)',
                              cursor: 'pointer',
                            }}
                          >
                            {lookPressLabel(name)}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      {lookPerson && (
        <TaskModeLookWindow
          personName={lookPerson.name}
          readAt={lookPerson.readAt}
          onReadAgain={() => setLookPerson((cur) => (cur ? { ...cur, readAt: new Date(), n: cur.n + 1 } : cur))}
          onClose={() => setLookPerson(null)}
          top={lookPerson.role === undefined ? undefined : modeRowOfferedToRole(lookPerson.role) ? 'row' : 'strip'}
          side={<TaskLookComingUp key={`${lookPerson.userId}-${lookPerson.n}`} personId={lookPerson.userId} personName={lookPerson.name} onAddTask={() => checklistAddModal?.openAddModal(lookPerson.userId)} />}
          door={
            lookPerson.email && lookOffersViewAs({ viewerIsDev: canViewAs, viewerId: authUserId, personId: lookPerson.userId, personRole: lookPerson.role, personEmail: lookPerson.email, loginAttached: lookPerson.loginAttached === true }) ? (
              <TaskLookViewAs personName={lookPerson.name} email={lookPerson.email} role={lookPerson.role ?? null} />
            ) : undefined
          }
        >
          {lookPerson.role === undefined ? (
            <p>Loading…</p>
          ) : (
            // Today itself, reading this person. Read again mounts it anew, so the day is read from the start.
            <ChecklistTodayTab
              key={`${lookPerson.userId}-${lookPerson.n}`}
              look={{ personId: lookPerson.userId }}
              authUserId={authUserId}
              canForward={isOfficeRole(lookPerson.role)}
              canOpenVehiclesPage={false}
              canAddTask={showHeaderTaskChecklistButton(lookPerson.role)}
              tagKinds="both"
              setError={() => {}}
              modeBar={<TaskDayBar tab="today" onPick={() => {}} />}
            />
          )}
        </TaskModeLookWindow>
      )}
      {roadmapContextTaskId && (
        <RoadmapTaskContextModal
          roadmapGroupTaskId={roadmapContextTaskId}
          onClose={() => setRoadmapContextTaskId(null)}
          onOpenRoadmap={onOpenRoadmap}
          canEditStructure={canEditRoadmapTasks}
          currentUserId={authUserId}
          onChanged={() => void loadOutstanding()}
        />
      )}
      <ReviewUndoBar toast={undoToast} onUndo={() => void undoComplete()} />
      <OutstandingDeleteAsk
        pending={outstandingDeletePending}
        missedCount={outstandingDeletePending ? (missedGroups.get(outstandingDeletePending.id)?.count ?? 1) : 1}
        deletingInstanceId={deletingInstanceId}
        onCancel={() => setOutstandingDeletePending(null)}
        onDelete={() => { if (outstandingDeletePending) void performDeleteOutstandingInstance(outstandingDeletePending) }}
      />
      {fwdInstance && (
        <TaskForwardWindow
          title={taskTitlePlain(fwdInstance.checklist_items?.title ?? 'Untitled')}
          // The person the task leaves is not offered; the office may take it themselves.
          people={forwardTakers(users, fwdFromUserId || null)}
          saving={fwdSaving}
          refusal={fwdRefusal}
          onForward={(toUserId) => void saveFwd(toUserId)}
          onClose={() => setFwdInstance(null)}
        />
      )}
    </div>
  )
}
