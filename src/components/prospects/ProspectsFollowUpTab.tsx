import { Fragment, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../EmptyState'
import { ageChipStyle } from '../../lib/ageState'
import { CALL_SCRIPT_BUTTON } from '../../lib/gc/callScript'
import type { CallingLockTrigger } from '../../lib/prospects/callingLock'
import { queueAge, queueWindowStart, type CallingOrderMode } from '../../lib/prospects/callingOrder'
import { BACK_TO_BOARD, RUN_DONE_WORDS, RUN_NEXT, RUN_RAIL_TITLE, TEXT_ASK_FIRST, TEXT_SENT, TEXT_THEM, TEXT_THEM_TITLE, boardHref, callbackWords, runHeadWords, runPosition, runReceipt, type CallRun, type RunOutcome } from '../../lib/prospects/callRun'
import { dueChipWords, emptyLaneWords } from '../../lib/prospects/deckWords'
import { SOONEST_BID_NOTE, type BiddingLine, type GcWorkCounts, type NewProspectJob, type ProspectJob } from '../../lib/prospects/gcLeadLane'
import type { GcNeeds } from '../../lib/prospects/gcNeeds'
import { cardOnLane, laneLoadingWords } from '../../lib/prospects/laneLoad'
import { OK_TO_TEXT_CHOICES, callNumbers, okToTextOf, personLineParts, prospectTitle, textAskWords, type OkToText } from '../../lib/prospects/personBlock'
import { formatDateTime, formatInteractionType, formatTimerSeconds, formatWebsiteDisplay, getWebsiteHref } from '../../lib/prospects/prospectFormat'
import { prospectKindFacts, type ProspectKind, type ProspectKindWords } from '../../lib/prospects/prospectKinds'
import type { Prospect, ProspectComment } from '../../lib/prospects/prospectRow'
import { stripReads, type StripRead } from '../../lib/prospects/stripState'
import { BY_RANK_NOTE, PRIORITY_CHOICES, priorityWord } from '../../lib/prospects/subsBoard'
import { BY_NEED_NOTE } from '../../lib/prospects/subsLane'
import type { PlansChoice } from '../../lib/prospects/subsStages'
import { textRefusal } from '../../lib/prospects/textingRule'
import { telHrefFor } from '../../lib/phoneContact'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { GcWorkStrip } from './GcWorkStrip'
import { ProspectCopyTemplateRow } from './ProspectCopyTemplateRow'
import { ProspectJobsBox } from './ProspectJobsBox'
import { SubsNeedsPanel } from './SubsNeedsPanel'
import type { ProspectCopyTemplates } from './useProspectCopyTemplates'

/** Where a caller's "move on after Didn't Answer" choice is remembered, per user. */
export const DIDNT_ANSWER_MOVE_NEXT_KEY = (userId: string) => `prospects_didnt_answer_move_next_${userId}`

export type ProspectsFollowUpTabProps = {
  kind: ProspectKind
  kindWords: ProspectKindWords
  canAccessFollowUp: boolean
  authUserId: string | null
  saving: boolean
  followUpLoading: boolean
  followUpProspects: Prospect[]
  currentProspect: Prospect | null
  currentProspectIndex: number
  calledProspectIds: ReadonlySet<string>
  callingOrderMode: CallingOrderMode
  showCallingOrder: boolean
  comments: ProspectComment[]
  commentInputValue: string
  retaggableNote: ProspectComment | null
  quickNotes: Array<{ id: string; label: string; sequence_order: number }>
  followUpNotes: string
  followUpNotesSaving: boolean
  scheduledCallback: { callback_date: string; note: string | null } | null
  followUpTimerSeconds: number
  myTimeTodaySeconds: number
  prospectLedgerSeconds: number
  didntAnswerMoveNext: boolean
  lockHeldBy: { prospectId: string; name: string | null } | null
  textAskOpen: boolean
  copy: ProspectCopyTemplates
  tradeFilter: string | null
  plansFor: string | null
  plansPick: PlansChoice | null
  laneAllRows: Prospect[]
  benchTrades: StripRead<{ trade: string; dependable: number }[]>
  gcNeedsNow: GcNeeds | null
  gcWork: StripRead<GcWorkCounts>
  gcBidding: BiddingLine[]
  jobsByProspect: Record<string, ProspectJob[]>
  run: CallRun | null
  runOutcomes: RunOutcome[]
  runDone: boolean
  runCallbackAt: Date | null
  runTextState: Record<string, 'sending' | 'sent'>
  setShowCallingOrder: Dispatch<SetStateAction<boolean>>
  setCurrentProspectIndex: Dispatch<SetStateAction<number>>
  setFollowUpTimerSeconds: Dispatch<SetStateAction<number>>
  setCommentInputValue: Dispatch<SetStateAction<string>>
  setCommentInputRef: Dispatch<SetStateAction<HTMLTextAreaElement | null>>
  setFollowUpNotes: Dispatch<SetStateAction<string>>
  setDidntAnswerMoveNext: Dispatch<SetStateAction<boolean>>
  setTextAskOpen: Dispatch<SetStateAction<boolean>>
  setScriptOpen: Dispatch<SetStateAction<boolean>>
  setTimerHistoryModalOpen: Dispatch<SetStateAction<boolean>>
  setMyTimeModalOpen: Dispatch<SetStateAction<boolean>>
  /** New Prospect on this lane's kind, with clean boxes: the header's button and the empty lane's press open it the same way. */
  openNewProspect: () => void
  subsStrip: (rows: readonly Prospect[], calledIds: ReadonlySet<string>) => ReactNode
  setTradeFilter: (trade: string | null) => void
  openAddSub: (trade: string) => void
  switchCallingOrder: (mode: CallingOrderMode) => void
  updateUrlProspectId: (id: string | null) => void
  takeCallingLock: (trigger: CallingLockTrigger) => void
  handleDidntAnswer: () => void | Promise<void>
  handleAnswered: () => void | Promise<void>
  handleCantReach: () => void | Promise<void>
  handleNoLongerFit: () => void | Promise<void>
  handleConverted: () => void
  handleAskedUs: () => void
  openBenchModal: (p?: Prospect) => void
  handleNextProspect: (skipTimerEvent?: boolean) => void | Promise<void>
  sendRunText: (prospect: Prospect) => void | Promise<void>
  savePriority: (prospect: Prospect, value: 1 | null | 3) => void | Promise<void>
  saveOkToText: (prospect: Prospect, value: OkToText) => void | Promise<void>
  openCallbackModal: () => void
  openEditModal: () => void
  handleAddComment: () => void | Promise<void>
  handleQuickNoteClick: (label: string) => void
  handleAddQuickNote: () => void | Promise<void>
  handleDeleteQuickNote: (id: string) => void | Promise<void>
  saveFollowUpNotes: () => void | Promise<void>
  cancelFollowUpNotes: () => void
  addJobFor: (prospectId: string, job: NewProspectJob) => Promise<void>
  editJobFor: (job: ProspectJob, changes: NewProspectJob) => Promise<void>
  changeJob: (job: ProspectJob, status: 'open' | 'dropped', wonBy?: string | null) => void | Promise<void>
  markJobLost: (job: ProspectJob) => void | Promise<void>
  removeJob: (job: ProspectJob) => void | Promise<void>
}

/**
 * The Follow Up tab: the calling deck. One card with its outcomes, its comments, its notes and its queue, and
 * over it what the lane adds (the Subs path strip and needs panel with a run's head and receipt, the Jobs to GC
 * work strip). Its JSX and its two queue helpers moved out of `src/pages/Prospects.tsx` unchanged.
 *
 * It holds no state. Everything it draws and every press it makes is the page's, handed down by name: the page
 * owns the pointer, the caches and the one `saving` flag, so a typed comment, the notes and the running clock
 * survive a look at another tab.
 */
export function ProspectsFollowUpTab(props: ProspectsFollowUpTabProps) {
  const {
    kind,
    kindWords,
    canAccessFollowUp,
    authUserId,
    saving,
    followUpLoading,
    followUpProspects,
    currentProspect,
    currentProspectIndex,
    calledProspectIds,
    callingOrderMode,
    showCallingOrder,
    comments,
    commentInputValue,
    retaggableNote,
    quickNotes,
    followUpNotes,
    followUpNotesSaving,
    scheduledCallback,
    followUpTimerSeconds,
    myTimeTodaySeconds,
    prospectLedgerSeconds,
    didntAnswerMoveNext,
    lockHeldBy,
    textAskOpen,
    copy,
    tradeFilter,
    plansFor,
    plansPick,
    laneAllRows,
    benchTrades,
    gcNeedsNow,
    gcWork,
    gcBidding,
    jobsByProspect,
    run,
    runOutcomes,
    runDone,
    runCallbackAt,
    runTextState,
    setShowCallingOrder,
    setCurrentProspectIndex,
    setFollowUpTimerSeconds,
    setCommentInputValue,
    setCommentInputRef,
    setFollowUpNotes,
    setDidntAnswerMoveNext,
    setTextAskOpen,
    setScriptOpen,
    setTimerHistoryModalOpen,
    setMyTimeModalOpen,
    openNewProspect,
    subsStrip,
    setTradeFilter,
    openAddSub,
    switchCallingOrder,
    updateUrlProspectId,
    takeCallingLock,
    handleDidntAnswer,
    handleAnswered,
    handleCantReach,
    handleNoLongerFit,
    handleConverted,
    handleAskedUs,
    openBenchModal,
    handleNextProspect,
    sendRunText,
    savePriority,
    saveOkToText,
    openCallbackModal,
    openEditModal,
    handleAddComment,
    handleQuickNoteClick,
    handleAddQuickNote,
    handleDeleteQuickNote,
    saveFollowUpNotes,
    cancelFollowUpNotes,
    addJobFor,
    editJobFor,
    changeJob,
    markJobLost,
    removeJob,
  } = props

  function renderCallingOrderToggle() {
    return (
      <div role="group" aria-label="Calling order" style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 8, overflow: 'hidden' }}>
        {(
          [
            ['coldest', 'Coldest', 'Longest since any contact first (the original order)'],
            ['never_called_first', 'Never called', "Prospects with no Didn't Answer / Answered on record lead, oldest entry first; the cold backlog follows"],
            ...(kind === 'sub' ? ([['by_need', 'By need', BY_NEED_NOTE], ['by_rank', 'By rank', BY_RANK_NOTE]] as const) : []),
            ...(kind === 'gc_lead' ? ([['soonest_bid', 'Soonest bid', SOONEST_BID_NOTE]] as const) : []),
          ] as readonly (readonly [CallingOrderMode, string, string])[]
        ).map(([mode, label, hint]) => (
          <button
            key={mode}
            type="button"
            onClick={() => switchCallingOrder(mode)}
            aria-pressed={callingOrderMode === mode}
            title={hint}
            style={{
              font: 'inherit',
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '0.25rem 0.55rem',
              border: 'none',
              background: callingOrderMode === mode ? '#2563eb' : 'var(--surface)',
              color: callingOrderMode === mode ? '#fff' : 'var(--text-700)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </button>
        ))}
      </div>
    )
  }

  function renderQueueRows(limit: number, collapseOnJump: boolean) {
    const start = queueWindowStart(currentProspectIndex, followUpProspects.length, limit)
    const nowMs = Date.now()
    return followUpProspects.slice(start, start + limit).map((p, i) => {
      const absIdx = start + i
      const isCurrent = absIdx === currentProspectIndex
      return (
        <button
          key={p.id}
          type="button"
          onClick={() => {
            setCurrentProspectIndex(absIdx)
            setFollowUpTimerSeconds(0)
            updateUrlProspectId(p.id)
            if (collapseOnJump) setShowCallingOrder(false)
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.55rem',
            width: '100%',
            padding: '0.45rem 0.7rem',
            border: 'none',
            borderBottom: '1px solid var(--border)',
            background: isCurrent ? 'var(--bg-blue-tint)' : 'var(--surface)',
            font: 'inherit',
            fontSize: '0.8125rem',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <span style={{ width: '1.8rem', textAlign: 'right', color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{absIdx + 1}</span>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isCurrent ? 600 : 400 }}>
            {p.company_name?.trim() || p.contact_name?.trim() || '(no name)'}
          </span>
          {!calledProspectIds.has(p.id) ? (
            <span style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--text-green-700)', background: 'var(--bg-green-tint)', borderRadius: 999, padding: '0.1rem 0.5rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
              never called
            </span>
          ) : null}
          {(() => {
            // The age words carry their state (punch list #184 sweep B): PROSPECT_CALL_AGE, amber at a week, red at a month. The order is the mode's.
            const age = queueAge(p, calledProspectIds, nowMs)
            return (
              <span data-queue-age={age.state} style={{ fontSize: '0.68rem', fontWeight: 600, padding: '0.05rem 0.45rem', borderRadius: 7, whiteSpace: 'nowrap', flexShrink: 0, ...ageChipStyle(age.state) }}>
                {age.label}
              </span>
            )
          })()}
          {isCurrent ? <span style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--text-link)', whiteSpace: 'nowrap', flexShrink: 0 }}>← you</span> : null}
        </button>
      )
    })
  }

  return (
    <>
      {kind === 'sub' && canAccessFollowUp && laneAllRows.length > 0 && subsStrip(laneAllRows, calledProspectIds)}
      {kind === 'sub' && canAccessFollowUp && stripReads(benchTrades) !== 'loading' && gcNeedsNow && (
        <SubsNeedsPanel needs={gcNeedsNow} benchFailed={stripReads(benchTrades) === 'failed'} tradeFilter={tradeFilter} onTradeFilter={setTradeFilter} onAddSub={openAddSub} />
      )}
      {kind === 'gc_lead' && canAccessFollowUp && stripReads(gcWork) !== 'loading' && (
        <GcWorkStrip work={gcWork ?? null} bidding={gcBidding} deckIds={followUpProspects.map((p) => p.id)} jobsByProspect={jobsByProspect} />
      )}
      {run && canAccessFollowUp && !followUpLoading && (
        // The run's head (v2.5808): the trade, the project a set of plans is for, and where the caller stands in it.
        <div data-run-head style={{ display: 'flex', alignItems: 'center', gap: '0.5rem 0.75rem', flexWrap: 'wrap', background: 'var(--bg-blue-tint)', border: '1px solid #3b82f6', borderRadius: 10, padding: '0.5rem 0.75rem', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
          <span style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{runHeadWords(run, plansPick?.name ?? null, runPosition(run, currentProspect?.id ?? null).at, run.ids.length)}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>The deck works these in order. Nothing reshuffles under you.</span>
          <Link to={boardHref(plansFor)} style={{ marginLeft: 'auto', color: 'var(--text-link)', fontWeight: 600 }}>
            {BACK_TO_BOARD}
          </Link>
        </div>
      )}
      {!canAccessFollowUp ? (
        <p style={{ color: 'var(--text-muted)' }}>You do not have access to Follow Up.</p>
      ) : followUpLoading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      ) : run && (runDone || followUpProspects.length === 0) ? (
        // The run's receipt (v2.5808): what it did, then back to the board.
        <div data-run-receipt style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1rem 1.25rem', maxWidth: 520 }}>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.0625rem' }}>{RUN_DONE_WORDS}</h3>
          <ul style={{ margin: '0 0 0.75rem', paddingLeft: '1.25rem', color: 'var(--text-700)', fontSize: '0.9375rem' }}>
            {runReceipt(runOutcomes, runCallbackAt, new Date()).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <Link to={boardHref(plansFor)} style={{ display: 'inline-block', padding: '0.5rem 1rem', background: '#2563eb', color: 'white', borderRadius: 8, fontWeight: 600, textDecoration: 'none' }}>
            {BACK_TO_BOARD}
          </Link>
        </div>
      ) : followUpProspects.length === 0 ? (
        (() => {
          // The empty lane names the control that fills it (v2.5581): New Prospect, or All subs on a trade filter.
          const words = emptyLaneWords(kind, kind === 'sub' ? tradeFilter : null)
          return <EmptyState main={words.main} next={{ label: words.doorLabel, onPress: () => (words.door === 'all_subs' ? setTradeFilter(null) : openNewProspect()) }} tail={words.tail} />
        })()
      ) : currentProspect && !cardOnLane(currentProspect, kind) ? (
        // A card of another kind never wears this lane's press (v2.5578): the lane's own load is still coming.
        <p style={{ color: 'var(--text-muted)' }}>{laneLoadingWords(kind)}</p>
      ) : currentProspect ? (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header card: call target + outcomes + utilities */}
          {(() => {
            const btnBase = {
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.15s, opacity 0.15s',
            } as const
            const btnSecondary = { ...btnBase, background: 'var(--surface)', color: 'var(--text-700)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: '1px solid var(--border)' }
            const btnPrimary = { ...btnBase, background: '#2563eb', color: 'white', boxShadow: '0 1px 2px rgba(59,130,246,0.3)' }
            const btnConverted = { ...btnBase, background: 'var(--bg-violet-100)', color: 'var(--text-violet-700)', border: '1px solid #8b5cf6', boxShadow: '0 1px 2px rgba(139,92,246,0.2)' }
            const btnDisabled = (s: object) => ({ ...s, opacity: 0.6, cursor: 'not-allowed' as const })
            const btnAmber = { ...btnBase, background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', border: '1px solid var(--border-amber-soft)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }
            const btnAnswered = { ...btnBase, background: '#15803d', color: 'white', boxShadow: '0 1px 2px rgba(22,163,74,0.3)' }
            const linkBtn = { background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.8125rem', color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer' } as const
            return (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '0.875rem 1rem', marginBottom: '1rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                {/* Who you're calling */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-strong)' }}>{prospectTitle(currentProspect)}</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                      {personLineParts(currentProspect).map((part, i) => (
                        <Fragment key={part}>
                          {i > 0 ? <span aria-hidden>·</span> : null}
                          <span>{part}</span>
                        </Fragment>
                      ))}
                      {(() => {
                        // The texting fact (v2.5601): asked on the call, read by the texts' path. Since v2.5606 the chip is a press
                        // that opens the three answers and saves the one pressed.
                        const ok = okToTextOf(currentProspect.ok_to_text)
                        const ask = textAskWords(ok)
                        const tone = ask.tone === 'yes' ? { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' } : ask.tone === 'no' ? { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' } : { background: 'var(--bg-subtle)', color: 'var(--text-muted)' }
                        if (textAskOpen) {
                          return (
                            <span role="group" aria-label="May we text?" style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>May we text?</span>
                              {OK_TO_TEXT_CHOICES.map((c) => (
                                <button
                                  key={c.value}
                                  type="button"
                                  aria-pressed={ok === c.value}
                                  onClick={() => void saveOkToText(currentProspect, c.value)}
                                  style={{ font: 'inherit', fontSize: '0.7rem', fontWeight: 600, padding: '0 0.45rem', borderRadius: 999, border: '1px solid var(--border)', background: ok === c.value ? 'var(--bg-blue-200)' : 'var(--surface)', color: ok === c.value ? 'var(--text-blue-800)' : 'var(--text-700)', cursor: 'pointer' }}
                                >
                                  {c.label}
                                </button>
                              ))}
                            </span>
                          )
                        }
                        return (
                          <button
                            type="button"
                            data-ok-to-text={ok}
                            onClick={() => setTextAskOpen(true)}
                            title="May we text them? Press to answer."
                            style={{ font: 'inherit', padding: '0 0.45rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600, border: 'none', cursor: 'pointer', ...tone }}
                          >
                            {ask.words}
                          </button>
                        )
                      })()}
                      {currentProspect.email ? (
                        <>
                          <span aria-hidden>·</span>
                          <a href={`mailto:${encodeURIComponent(currentProspect.email)}`} style={{ color: 'var(--text-link)' }}>{currentProspect.email}</a>
                        </>
                      ) : null}
                      {currentProspect.links_to_website ? (
                        <>
                          <span aria-hidden>·</span>
                          <a href={getWebsiteHref(currentProspect.links_to_website)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)' }}>
                            {formatWebsiteDisplay(currentProspect.links_to_website)}
                          </a>
                        </>
                      ) : null}
                      {currentProspect.maps_url ? (
                        <>
                          <span aria-hidden>·</span>
                          <a href={currentProspect.maps_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', fontWeight: 600 }}>
                            Maps ↗
                          </a>
                        </>
                      ) : null}
                      {currentProspect.kind === 'sub' && currentProspect.license ? (
                        <>
                          <span aria-hidden>·</span>
                          <span>{currentProspect.license}</span>
                        </>
                      ) : null}
                    </div>
                    {(currentProspect.kind !== 'customer' || currentProspect.source) && (
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', gap: '0.375rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.25rem' }}>
                        {currentProspect.kind === 'sub' &&
                          (currentProspect.trades ?? []).map((trade) => (
                            <span key={trade} style={{ padding: '0 0.5rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 999, background: 'var(--bg-blue-200)', color: 'var(--text-blue-800)' }}>
                              {trade}
                            </span>
                          ))}
                        {currentProspect.kind === 'sub' && (currentProspect.trades ?? []).length === 0 && <span>no trade named yet</span>}
                        {(() => {
                          const facts = prospectKindFacts(currentProspect)
                          if (facts.length === 0) return null
                          const lead = currentProspect.kind === 'sub' ? '· ' : ''
                          return <span>{lead}{facts.join(' · ')}</span>
                        })()}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1 }} />
                  {dueChipWords(currentProspect.last_contact) && (
                    <span style={{ padding: '0.125rem 0.5rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 4, background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', whiteSpace: 'nowrap' }}>
                      {dueChipWords(currentProspect.last_contact)}
                    </span>
                  )}
                  {!calledProspectIds.has(currentProspect.id) && (
                    <span
                      title="No call logged yet — only Didn't Answer / Answered count as calls; plain notes and emails don't"
                      style={{ padding: '0.125rem 0.5rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 4, background: 'var(--bg-green-tint)', color: 'var(--text-green-700)', whiteSpace: 'nowrap' }}
                    >
                      never called
                    </span>
                  )}
                  {lockHeldBy?.prospectId === currentProspect.id && (
                    <span
                      title="A colleague started working this prospect in the last 30 minutes — you can still call, but you may be doubling up"
                      style={{ padding: '0.125rem 0.5rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 4, background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}
                    >
                      {lockHeldBy.name ?? 'Someone'} is calling this one
                    </span>
                  )}
                  {(() => {
                    // The cell first (v2.5601); the office line beside it when both are known.
                    const nums = callNumbers(currentProspect)
                    if (!nums.call) return <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>no phone number</span>
                    return (
                      <>
                        <a
                          href={telHrefFor(nums.call)}
                          onClick={() => takeCallingLock('dial')}
                          style={{ ...btnPrimary, textDecoration: 'none', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
                        >
                          📞 {nums.call}
                        </a>
                        {nums.other && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {nums.other.label} {nums.other.number}
                          </span>
                        )}
                        {currentProspect.also_reach && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>also {currentProspect.also_reach}</span>
                        )}
                      </>
                    )
                  })()}
                  {kind === 'sub' && (
                    <button
                      type="button"
                      onClick={() => setScriptOpen(true)}
                      title="What to say when phoning a company new to us, your name already in it"
                      style={{ ...btnSecondary, whiteSpace: 'nowrap' }}
                    >
                      {CALL_SCRIPT_BUTTON}
                    </button>
                  )}
                </div>
                {currentProspect.kind === 'gc_lead' && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <ProspectJobsBox
                      jobs={jobsByProspect[currentProspect.id] ?? []}
                      todayYmd={todayYmdInAppTz()}
                      busy={saving}
                      onAdd={(job) => addJobFor(currentProspect.id, job)}
                      onEdit={(job, changes) => editJobFor(job, changes)}
                      onLost={(job) => void markJobLost(job)}
                      onStatus={(job, status) => void changeJob(job, status)}
                      onRemove={(job) => void removeJob(job)}
                    />
                  </div>
                )}
                {/* Outcome row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>How did the call end?</span>
                  <button type="button" onClick={handleDidntAnswer} disabled={saving} style={saving ? btnDisabled(btnAmber) : btnAmber}>
                    Didn&apos;t Answer
                  </button>
                  <button type="button" onClick={handleAnswered} disabled={saving} style={saving ? btnDisabled(btnAnswered) : btnAnswered}>
                    Answered
                  </button>
                  <button type="button" onClick={handleCantReach} disabled={saving} style={saving ? btnDisabled(btnSecondary) : btnSecondary}>
                    Can't reach
                  </button>
                  <button
                    type="button"
                    onClick={handleNoLongerFit}
                    disabled={saving}
                    style={saving ? btnDisabled(btnSecondary) : btnSecondary}
                    title={kindWords.notAFitTitle}
                  >
                    Not a fit
                  </button>
                  <button
                    type="button"
                    onClick={kind === 'sub' ? () => openBenchModal() : kind === 'gc_lead' ? handleAskedUs : handleConverted}
                    disabled={saving}
                    style={saving ? btnDisabled(btnConverted) : btnConverted}
                    title={kindWords.lastPressTitle}
                  >
                    {kindWords.lastPress}
                  </button>
                </div>
                {run && runOutcomes.find((o) => o.id === currentProspect.id)?.kind === 'didnt_answer' && (
                  // When one does not answer in a run (v2.5808): the callback set, the text offered where they said we may, the next card.
                  <div data-run-ledger style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-700)' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-amber-700)' }}>{runCallbackAt ? callbackWords(runCallbackAt, new Date()) : 'callback not set'}</span>
                    <span aria-hidden style={{ color: 'var(--text-faint)' }}>·</span>
                    {(() => {
                      const held = textRefusal(currentProspect)
                      const state = runTextState[currentProspect.id]
                      if (state === 'sent') return <span style={{ color: 'var(--text-green-700)', fontWeight: 600 }}>{TEXT_SENT}</span>
                      return (
                        <button
                          type="button"
                          disabled={!!held || state === 'sending' || saving}
                          title={held ? held.words : TEXT_THEM_TITLE}
                          onClick={() => void sendRunText(currentProspect)}
                          style={{ ...btnSecondary, padding: '0.25rem 0.6rem', fontSize: '0.8125rem', opacity: held ? 0.6 : 1, cursor: held ? 'not-allowed' : 'pointer' }}
                        >
                          {held ? TEXT_ASK_FIRST : state === 'sending' ? 'Sending…' : TEXT_THEM}
                        </button>
                      )
                    })()}
                    <button type="button" onClick={() => handleNextProspect()} style={{ ...btnPrimary, padding: '0.25rem 0.7rem', fontSize: '0.8125rem', marginLeft: 'auto' }}>
                      {currentProspectIndex >= followUpProspects.length - 1 ? 'Finish the run →' : RUN_NEXT}
                    </button>
                  </div>
                )}
                {/* Utility row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.625rem', fontSize: '0.8125rem' }}>
                  <button type="button" onClick={openCallbackModal} disabled={saving} style={linkBtn}>Set callback</button>
                  <span aria-hidden style={{ color: 'var(--text-faint)' }}>·</span>
                  <button type="button" onClick={openEditModal} disabled={saving} style={linkBtn}>Edit prospect</button>
                  <span aria-hidden style={{ color: 'var(--text-faint)' }}>·</span>
                  {kind === 'sub' ? (
                    // The office's priority (v2.5809) stands where warmth stood on Subs: Call first · Normal · Later.
                    <span role="group" aria-label="Priority" style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}>
                      {PRIORITY_CHOICES.map((c) => {
                        const on = priorityWord(currentProspect.priority) === c.word
                        return (
                          <button
                            key={c.word}
                            type="button"
                            aria-pressed={on}
                            onClick={() => void savePriority(currentProspect, c.value)}
                            title="The office's priority on the Subs board: Call first sits over who answers, Later at the foot"
                            style={{ font: 'inherit', fontSize: '0.72rem', fontWeight: 600, padding: '0.05rem 0.5rem', borderRadius: 999, border: '1px solid var(--border)', background: on ? (c.value === 1 ? 'var(--bg-amber-100)' : 'var(--bg-blue-200)') : 'var(--surface)', color: on ? (c.value === 1 ? 'var(--text-amber-800)' : 'var(--text-blue-800)') : 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            {c.value === 1 ? '★ ' : ''}
                            {c.word}
                          </button>
                        )
                      })}
                    </span>
                  ) : (
                    <span
                      title="Warmth — goes up by one every Answered. Adjust it in Edit prospect."
                      style={{ padding: '0.125rem 0.5rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600, background: 'var(--bg-orange-100)', color: 'var(--text-orange-700)', whiteSpace: 'nowrap' }}
                    >
                      🔥 {currentProspect.warmth_count ?? 0}
                    </span>
                  )}
                  {scheduledCallback && (
                    <>
                      <span aria-hidden style={{ color: 'var(--text-faint)' }}>·</span>
                      <Link to="/calendar" style={{ color: 'var(--text-link)', textDecoration: 'underline' }}>
                        Callback {formatDateTime(scheduledCallback.callback_date)}
                        {scheduledCallback.note && ` (${scheduledCallback.note})`}
                      </Link>
                    </>
                  )}
                  <span className="followUpQueueMobileStrip" style={{ color: 'var(--text-muted)' }}>
                    <span aria-hidden style={{ color: 'var(--text-faint)' }}>· </span>
                    <strong style={{ color: 'var(--text-700)' }}>{currentProspectIndex + 1}</strong> of{' '}
                    <strong style={{ color: 'var(--text-700)' }}>{followUpProspects.length}</strong>
                    {' · '}
                    <button
                      type="button"
                      onClick={() => setShowCallingOrder((v) => !v)}
                      aria-expanded={showCallingOrder}
                      style={{ ...linkBtn, textDecoration: 'underline dotted', textUnderlineOffset: '2px' }}
                    >
                      {showCallingOrder ? 'hide order ▴' : 'show order ▾'}
                    </button>
                  </span>
                  <div style={{ flex: 1 }} />
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>this call</span>
                    <button
                      type="button"
                      onClick={() => {
                        setTimerHistoryModalOpen(true)
                      }}
                      style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.875rem', color: 'var(--text-muted)', fontFamily: 'ui-monospace, monospace', background: 'none', border: '1px solid transparent', borderRadius: 4, cursor: 'pointer', padding: '0.125rem 0.25rem' }}
                      title="Time on this prospect this session (resets when you leave and return). Click to view history."
                    >
                      {String(Math.floor(followUpTimerSeconds / 60)).padStart(2, '0')}:{String(followUpTimerSeconds % 60).padStart(2, '0')}
                    </button>
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>my day</span>
                    <span
                      style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.875rem', color: 'var(--text-green-600)', fontFamily: 'ui-monospace, monospace', fontWeight: 500, padding: '0.125rem 0.25rem' }}
                      title="My time prospecting today"
                    >
                      {(myTimeTodaySeconds + followUpTimerSeconds) === 0 ? '—' : formatTimerSeconds(myTimeTodaySeconds + followUpTimerSeconds)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Mobile queue peek — the desktop rail is always visible instead. */}
          {showCallingOrder ? (
            <div className="followUpQueueMobileStrip" style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', margin: '0 0 1.25rem' }}>
              <div style={{ padding: '0.4rem 0.7rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {callingOrderMode === 'never_called_first'
                    ? 'Never called first, then coldest. Tap a row to jump to it.'
                    : 'Coldest first. Tap a row to jump to it.'}
                </span>
                {!run && renderCallingOrderToggle()}
              </div>
              {renderQueueRows(15, true)}
            </div>
          ) : null}

          {/* Comments first on mobile so visible without scrolling */}
          <div className="followUpCommentsSection">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Comments</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Didn&apos;t Answer / Answered above log the call with your comment attached — Enter alone saves a note, not a call
              </span>
            </div>
            <textarea
              ref={setCommentInputRef}
              placeholder="Type what happened, then click Didn't Answer / Answered above to log the call. Enter saves it as a plain note."
              value={commentInputValue}
              onFocus={() => takeCallingLock('composer')}
              onChange={(e) => setCommentInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleAddComment()
                }
              }}
              style={{
                width: '100%',
                minHeight: '4.5rem',
                padding: '0.5rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                marginBottom: '0.75rem',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
            {retaggableNote && (
              <p style={{ margin: '-0.25rem 0 0.75rem', fontSize: '0.75rem', color: 'var(--text-amber-700)' }}>
                Saved as a note, not a call. If that was the call, click Didn&apos;t Answer or Answered above — it tags this note instead of adding a second one.
              </p>
            )}
            {/* Quick notes - below textarea, above comments list */}
            {canAccessFollowUp && (
              <div style={{ marginBottom: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                {quickNotes.map((qn) => (
                  <span key={qn.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <button
                      type="button"
                      onClick={() => handleQuickNoteClick(qn.label)}
                      disabled={saving}
                      style={{
                        padding: '0.35rem 0.6rem',
                        fontSize: '0.8125rem',
                        background: 'var(--bg-muted)',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 4,
                        cursor: saving ? 'not-allowed' : 'pointer',
                        fontWeight: 500,
                        opacity: saving ? 0.6 : 1,
                      }}
                    >
                      {qn.label}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteQuickNote(qn.id)}
                      title="Remove quick note"
                      style={{
                        padding: '0.2rem 0.35rem',
                        fontSize: '0.75rem',
                        background: 'none',
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={handleAddQuickNote}
                  style={{
                    padding: '0.35rem 0.6rem',
                    fontSize: '0.8125rem',
                    background: 'var(--bg-muted)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontWeight: 500,
                    color: 'var(--text-muted)',
                  }}
                >
                  + Add
                </button>
              </div>
            )}
            {comments.length === 0 ? (
              <EmptyState compact main="No comments yet." />
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {comments.map((c) => (
                  <li
                    key={c.id}
                    style={{
                      padding: '0.5rem 0.75rem',
                      marginBottom: '0.5rem',
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      fontSize: '0.875rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {formatDateTime(c.created_at)}
                        {c.created_by_user && (
                          <span style={{ marginLeft: '0.5rem' }}>
                            · {(c.created_by_user.name || c.created_by_user.email || 'Unknown').trim()}
                          </span>
                        )}
                      </span>
                      {(c.interaction_type === 'answered' || c.interaction_type === 'didnt_answer') && (
                        <span style={{ fontSize: '0.7rem', background: 'var(--bg-200)', padding: '0.15rem 0.4rem', borderRadius: 4 }}>
                          {formatInteractionType(c.interaction_type)}
                        </span>
                      )}
                    </div>
                    <div>{c.comment_text}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Info block with notes */}
          <div className="followUpInfoCard">
            <div className="followUpInfoCardDetails">
              <div><strong>Last Contact:</strong> {formatDateTime(comments[0]?.created_at ?? currentProspect.last_contact) || '—'}</div>
              {comments[0]?.created_by_user && (
                <div>
                  Last updated by: {(comments[0].created_by_user.name || comments[0].created_by_user.email || 'Unknown').trim()}
                </div>
              )}
              <div>Last Successful Contact: {formatDateTime(comments.find((c) => c.interaction_type === 'answered')?.created_at ?? null) || '—'}</div>
              <div><strong>Address:</strong> {currentProspect.address || '—'}</div>
              <div>
                <strong>Time on this prospect:</strong>{' '}
                <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'ui-monospace, monospace', color: 'var(--text-green-600)' }}>
                  {formatTimerSeconds(prospectLedgerSeconds + followUpTimerSeconds)}
                </span>
              </div>
            </div>
            <div className="followUpInfoCardNotes">
              <textarea
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  placeholder="Add notes..."
                  style={{ width: '100%', minHeight: 120, padding: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.9375rem', resize: 'vertical', fontFamily: 'inherit' }}
                />
                <div className="followUpInfoCardNotesActions">
                <button
                  type="button"
                  onClick={saveFollowUpNotes}
                  disabled={followUpNotesSaving || followUpNotes === (currentProspect.notes ?? '')}
                  style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: followUpNotesSaving || followUpNotes === (currentProspect.notes ?? '') ? 'not-allowed' : 'pointer', opacity: followUpNotesSaving || followUpNotes === (currentProspect.notes ?? '') ? 0.6 : 1 }}
                >
                  {followUpNotesSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={cancelFollowUpNotes}
                  disabled={followUpNotes === (currentProspect.notes ?? '')}
                  style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: followUpNotes === (currentProspect.notes ?? '') ? 'not-allowed' : 'pointer', fontSize: '0.875rem' }}
                >
                  Cancel
                </button>
              </div>
              {/* Copy templates: the customer deck's words (v2.5563); a sub's or an owner's email waits on the owner's own words. */}
              {kind === 'customer' && <ProspectCopyTemplateRow copy={copy} />}
            </div>
          </div>
          {/* The advance bar: the last thing you hit after logging the outcome and notes. */}
          <button
            type="button"
            onClick={() => handleNextProspect()}
            disabled={followUpProspects.length <= 1 && !run}
            style={{
              display: 'block',
              width: '100%',
              marginTop: '1rem',
              padding: '0.875rem',
              fontSize: '1rem',
              fontWeight: 600,
              borderRadius: 10,
              border: 'none',
              background: '#2563eb',
              color: 'white',
              boxShadow: '0 1px 2px rgba(59,130,246,0.3)',
              cursor: followUpProspects.length <= 1 && !run ? 'not-allowed' : 'pointer',
              opacity: followUpProspects.length <= 1 && !run ? 0.6 : 1,
            }}
          >
            {run ? (currentProspectIndex >= followUpProspects.length - 1 ? 'Finish the run →' : RUN_NEXT) : 'Next Prospect →'}
          </button>
        </div>
        {/* Desktop queue rail (v2.2458): the v2.2301 peek, always visible. */}
        <div className="followUpQueueRail">
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '0.5rem 0.7rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>{run ? RUN_RAIL_TITLE : kind === 'sub' && tradeFilter ? tradeFilter : 'Queue'}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {currentProspectIndex + 1} of {followUpProspects.length}
                </span>
              </div>
              {!run && renderCallingOrderToggle()}
            </div>
            {renderQueueRows(12, false)}
          </div>
        </div>
        </div>
      ) : null}
      {canAccessFollowUp && (
        <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-700)' }}>
            <input
              type="checkbox"
              checked={didntAnswerMoveNext}
              onChange={(e) => {
                const checked = e.target.checked
                setDidntAnswerMoveNext(checked)
                if (authUserId) {
                  localStorage.setItem(DIDNT_ANSWER_MOVE_NEXT_KEY(authUserId), String(checked))
                }
              }}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            Automatically move to the next prospect when I click Didn&apos;t Answer
          </label>
          <button
            type="button"
            onClick={() => {
              setMyTimeModalOpen(true)
            }}
            style={{
              padding: 0,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              color: 'var(--text-blue-500)',
              textDecoration: 'underline',
            }}
          >
            my time
          </button>
        </div>
      )}
    </>
  )
}
