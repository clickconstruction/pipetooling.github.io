/**
 * The People board on a phone (v2.3156) — what `HubPeoplePanel` renders on a
 * narrow viewport in place of the week grid.
 *
 * One day at a time, full width, with a day strip; a card per tech whose rows
 * are their blocks that day; while something is being placed (a copy, a move,
 * a job, a linked copy, a multi-cell fill) the whole card becomes the button
 * and says what will land; the current mode lives in a bar at the bottom of
 * the screen with Cancel beside it; and at the very bottom of the page a
 * switch brings the desktop grid back. Every tap forwards to the page's
 * existing callbacks — nothing here writes to the database.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { scheduleBlockAnchorId, type JobScheduleBlockRow } from '../../lib/jobScheduleBlocks'
import { hubPersonDayKey } from '../../lib/scheduleDispatchHub'
import type { LinkedCopyMode } from '../../lib/scheduleDispatchLinkedCopy'
import { userTimeOffCellKey, type UserTimeOffCellInfo } from '../../lib/userTimeOffByCell'
import { DISPATCH_MODE_FOOTER_HEIGHT_PX } from '../dispatchMode/DispatchModeFooter'
import type { ScheduleDispatchCardPlacementMode, ScheduleDispatchCardPlacementVariant } from './ScheduleDispatchGrid'
import {
  availabilityLabel,
  buildDayStrip,
  cardTargetState,
  formatShortRange,
  initialBoardYmd,
  linkedWithCaption,
  modeBarText,
  ribbonSpan,
  teamBandCaption,
  timeToMinutes,
  weekdayOfYmd,
  type CardBlockSummary,
  type PhonePlacementMode,
} from '../../lib/scheduleDispatch/phonePeopleBoard'

export type PhoneBoardPerson = { userId: string; displayName: string }
export type PhoneBoardRow =
  | { kind: 'heading'; key: string; label: string; laneMemberUserIds?: string[] }
  | { kind: 'person'; person: PhoneBoardPerson }

export type HubPeoplePhoneBoardProps = {
  visibleDayKeys: string[]
  scheduleTodayYmd: string
  /** The day the desktop grid would focus (URL / today) — the board opens on it when it is in the week. */
  columnFocusDayYmd: string
  /** The panel's grouped rows (lanes / roles / A–Z, already filtered by search). */
  peopleDisplayRows: readonly PhoneBoardRow[]
  personDayBlocks: Map<string, JobScheduleBlockRow[]>
  hubWeekBlocks: JobScheduleBlockRow[]
  hubPeopleNameById: ReadonlyMap<string, string>
  getJobDisplayTitle: (jobId: string) => string
  getJobAddress?: (jobId: string) => string
  salariedUserIds: ReadonlySet<string>
  userTimeOffByCell?: ReadonlyMap<string, UserTimeOffCellInfo>
  /** Blocks missing a required note on `missingNoteDayYmd` (the panel computes it). */
  missingNoteCount: number
  missingNoteDayYmd: string
  canEdit: boolean
  loading: boolean
  // ---- modes (page state) ----
  cardPlacementMode: ScheduleDispatchCardPlacementMode | null
  hubAssignJobPlacement: { jobId: string } | null
  linkedCopyMode?: LinkedCopyMode | null
  linkedCopyApplyBusy?: boolean
  hubMultiCellAddActive: boolean
  hubMultiCellAddSelectedKeys: ReadonlySet<string>
  // ---- toolbar ----
  onRequestHubAddJob?: () => void
  onOpenQuickAssign?: () => void
  onStartLinkedCopyMode?: () => void
  onLinkedCopySetStage?: (stage: 1 | 2) => void
  onLinkedCopyToggleBlock?: (blockId: string) => void
  onLinkedCopyApplyToPerson?: (personUserId: string) => void
  onLinkedCopyApplyToLane?: (laneLabel: string, memberUserIds: string[]) => void
  /** Copy to techs sheet: one block to a chosen list of people, linked or not. */
  onCopyBlockToPeople?: (args: { blockId: string; userIds: string[]; linked: boolean }) => void | Promise<void>
  // ---- placement taps ----
  onCardPlacementCellPick: (assigneeUserId: string, workDate: string) => void
  onCancelCardPlacement?: () => void
  onHubAssignJobCellPick: (assigneeUserId: string, workDate: string) => void
  onCancelHubAssignJobPlacement?: () => void
  onHubMultiCellAddToggle?: (personUserId: string, workDate: string) => void
  onAddJobToScheduleForCell?: (assigneeUserId: string, workDate: string) => void
  onEmptyCellClick?: (personUserId: string, workDate: string) => void
  // ---- block sheet ----
  onStartCardPlacement: (b: JobScheduleBlockRow, variant: ScheduleDispatchCardPlacementVariant) => void
  onOpenHubJobDetail: (block: JobScheduleBlockRow, workDateYmd: string) => void
  onOpenJob: (jobId: string) => void
  onDeleteBlock: (id: string) => void
  onRequestEditBlockNote?: (b: JobScheduleBlockRow) => void
  // ---- the bottom switch ----
  onShowDesktopView: () => void
}

const BOTTOM_INSET = `calc(${DISPATCH_MODE_FOOTER_HEIGHT_PX}px + env(safe-area-inset-bottom, 0px))`

const btn: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--text-link)',
  background: 'var(--surface)',
  border: '1px solid var(--border-strong)',
  borderRadius: 7,
  padding: '0.5rem 0.4rem',
  cursor: 'pointer',
  minHeight: '2.9rem',
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.05rem',
  lineHeight: 1.15,
}

const chip = (tone: 'red' | 'amber' | 'gray'): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0.1rem 0.5rem',
  borderRadius: 9999,
  fontSize: '0.7rem',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  border: '1px solid',
  background: tone === 'red' ? 'var(--bg-red-tint)' : tone === 'amber' ? 'var(--bg-amber-tint)' : 'var(--bg-muted)',
  color: tone === 'red' ? 'var(--text-red-700)' : tone === 'amber' ? 'var(--text-amber-700)' : 'var(--text-muted)',
  borderColor: tone === 'red' ? 'var(--border-red)' : tone === 'amber' ? 'var(--border-amber)' : 'var(--border)',
})

function targetStyle(tone: 'free' | 'busy' | 'source' | 'selected', tappable: boolean): CSSProperties {
  const base: CSSProperties = {
    width: '100%',
    textAlign: 'left',
    fontFamily: 'inherit',
    borderRadius: 10,
    padding: '0.7rem 0.6rem',
    display: 'grid',
    gap: '0.2rem',
    cursor: tappable ? 'pointer' : 'default',
    border: '2px dashed var(--border-strong)',
    background: 'var(--bg-blue-tint)',
    color: 'var(--text-700)',
  }
  if (tone === 'busy') return { ...base, borderStyle: 'solid', borderColor: 'var(--border-red)', background: 'var(--bg-red-tint)' }
  if (tone === 'source') return { ...base, borderStyle: 'solid', borderColor: 'var(--border)', background: 'var(--bg-muted)', opacity: 0.85 }
  if (tone === 'selected') return { ...base, borderStyle: 'solid', borderColor: '#2563eb', background: 'var(--bg-blue-tint)' }
  return { ...base, borderColor: '#4338ca' }
}

export function HubPeoplePhoneBoard(props: HubPeoplePhoneBoardProps) {
  const {
    visibleDayKeys,
    scheduleTodayYmd,
    columnFocusDayYmd,
    peopleDisplayRows,
    personDayBlocks,
    hubWeekBlocks,
    hubPeopleNameById,
    getJobDisplayTitle,
    getJobAddress,
    salariedUserIds,
    userTimeOffByCell,
    missingNoteCount,
    missingNoteDayYmd,
    canEdit,
    loading,
    cardPlacementMode,
    hubAssignJobPlacement,
    linkedCopyMode,
    linkedCopyApplyBusy = false,
    hubMultiCellAddActive,
    hubMultiCellAddSelectedKeys,
  } = props

  const [selectedYmd, setSelectedYmd] = useState(() => initialBoardYmd({ weekYmds: visibleDayKeys, todayYmd: scheduleTodayYmd, preferredYmd: columnFocusDayYmd }))
  const [sheetBlock, setSheetBlock] = useState<JobScheduleBlockRow | null>(null)
  const [copyFor, setCopyFor] = useState<JobScheduleBlockRow | null>(null)
  const [copySelected, setCopySelected] = useState<Set<string>>(() => new Set())
  const [copyLinked, setCopyLinked] = useState(true)
  const [copyBusy, setCopyBusy] = useState(false)

  // A new week: land on the focused / today / first day again.
  const weekKey = visibleDayKeys.join(',')
  useEffect(() => {
    setSelectedYmd((cur) => (visibleDayKeys.includes(cur) ? cur : initialBoardYmd({ weekYmds: visibleDayKeys, todayYmd: scheduleTodayYmd, preferredYmd: columnFocusDayYmd })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey])

  const blockTitle = (b: JobScheduleBlockRow) => getJobDisplayTitle(scheduleBlockAnchorId(b))
  const blockSummary = (b: JobScheduleBlockRow): CardBlockSummary => ({ label: blockTitle(b), startMinutes: timeToMinutes(b.time_start), endMinutes: timeToMinutes(b.time_end) })
  const dayBlocksFor = (userId: string, ymd: string): JobScheduleBlockRow[] =>
    [...(personDayBlocks.get(hubPersonDayKey(userId, ymd)) ?? [])].sort((a, b) => (a.time_start ?? '').localeCompare(b.time_start ?? ''))

  // ---- the active mode, from page state ----
  const sourceBlock = cardPlacementMode ? hubWeekBlocks.find((b) => b.id === cardPlacementMode.sourceBlockId) ?? null : null
  const linkedSources = useMemo(
    () => (linkedCopyMode?.stage === 2 ? hubWeekBlocks.filter((b) => linkedCopyMode.selectedBlockIds.has(b.id)) : []),
    [linkedCopyMode, hubWeekBlocks],
  )
  const mode: PhonePlacementMode | null = useMemo(() => {
    if (cardPlacementMode && sourceBlock) {
      const isMove = cardPlacementMode.variant === 'move'
      return {
        kind: isMove ? 'move' : 'copy',
        label: blockTitle(sourceBlock),
        startMinutes: timeToMinutes(sourceBlock.time_start),
        endMinutes: timeToMinutes(sourceBlock.time_end),
        sourceUserIds: isMove ? new Set() : new Set([sourceBlock.assignee_user_id]),
        linked: cardPlacementMode.variant === 'linked',
      }
    }
    if (hubAssignJobPlacement) {
      return { kind: 'add-job', label: getJobDisplayTitle(hubAssignJobPlacement.jobId), startMinutes: null, endMinutes: null, sourceUserIds: new Set() }
    }
    if (linkedCopyMode?.stage === 2 && linkedSources.length > 0) {
      const first = linkedSources[0]!
      return {
        kind: 'linked-apply',
        label: blockTitle(first),
        startMinutes: linkedSources.length === 1 ? timeToMinutes(first.time_start) : null,
        endMinutes: linkedSources.length === 1 ? timeToMinutes(first.time_end) : null,
        sourceUserIds: new Set(linkedSources.map((b) => b.assignee_user_id)),
        linked: true,
        count: linkedSources.length,
      }
    }
    if (hubMultiCellAddActive) return { kind: 'multi-cell', label: '', startMinutes: null, endMinutes: null, sourceUserIds: new Set() }
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardPlacementMode, sourceBlock, hubAssignJobPlacement, linkedCopyMode, linkedSources, hubMultiCellAddActive])
  const linkedSelecting = linkedCopyMode?.stage === 1

  // A copy lands on its source block's day: open the board on that day when the mode starts.
  const modeSourceYmd = cardPlacementMode && sourceBlock && cardPlacementMode.variant !== 'move' ? sourceBlock.work_date : linkedSources[0]?.work_date ?? null
  const modeKey = `${cardPlacementMode?.sourceBlockId ?? ''}|${linkedCopyMode?.stage === 2 ? [...linkedCopyMode.selectedBlockIds].join(',') : ''}`
  useEffect(() => {
    if (modeSourceYmd && visibleDayKeys.includes(modeSourceYmd)) setSelectedYmd(modeSourceYmd)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeKey])
  // Any mode closes the sheets.
  useEffect(() => {
    if (mode || linkedSelecting) {
      setSheetBlock(null)
      setCopyFor(null)
    }
  }, [mode, linkedSelecting])

  // ---- day strip ----
  const countsByYmd = useMemo(() => {
    const m = new Map<string, { blocks: number; missingNotes: number }>()
    for (const b of hubWeekBlocks) {
      const c = m.get(b.work_date) ?? { blocks: 0, missingNotes: 0 }
      c.blocks += 1
      m.set(b.work_date, c)
    }
    if (missingNoteCount > 0) {
      const c = m.get(missingNoteDayYmd) ?? { blocks: 0, missingNotes: 0 }
      c.missingNotes = missingNoteCount
      m.set(missingNoteDayYmd, c)
    }
    return m
  }, [hubWeekBlocks, missingNoteCount, missingNoteDayYmd])
  const strip = buildDayStrip({ weekYmds: visibleDayKeys, todayYmd: scheduleTodayYmd, selectedYmd, countsByYmd })

  // ---- sections ----
  const sections = useMemo(() => {
    const out: Array<{ heading: Extract<PhoneBoardRow, { kind: 'heading' }> | null; people: PhoneBoardPerson[] }> = []
    let cur: (typeof out)[number] | null = null
    for (const row of peopleDisplayRows) {
      if (row.kind === 'heading') {
        cur = { heading: row, people: [] }
        out.push(cur)
      } else {
        if (!cur) {
          cur = { heading: null, people: [] }
          out.push(cur)
        }
        cur.people.push(row.person)
      }
    }
    return out
  }, [peopleDisplayRows])

  const crewNames = (b: JobScheduleBlockRow): string[] =>
    b.shared_block_group_id
      ? hubWeekBlocks.filter((x) => x.shared_block_group_id === b.shared_block_group_id).map((x) => hubPeopleNameById.get(x.assignee_user_id) ?? '').filter(Boolean)
      : []

  // ---- taps ----
  const tapTarget = (userId: string) => {
    if (!mode) return
    switch (mode.kind) {
      case 'copy':
      case 'move':
        props.onCardPlacementCellPick(userId, selectedYmd)
        return
      case 'add-job':
        props.onHubAssignJobCellPick(userId, selectedYmd)
        return
      case 'linked-apply':
        props.onLinkedCopyApplyToPerson?.(userId)
        return
      case 'multi-cell':
        props.onHubMultiCellAddToggle?.(userId, selectedYmd)
        return
    }
  }
  const cancelMode = () => {
    if (!mode && !linkedSelecting) return
    if (linkedSelecting || mode?.kind === 'linked-apply') {
      props.onStartLinkedCopyMode?.()
      return
    }
    if (mode?.kind === 'copy' || mode?.kind === 'move') props.onCancelCardPlacement?.()
    else if (mode?.kind === 'add-job') props.onCancelHubAssignJobPlacement?.()
  }
  const openCopySheet = (b: JobScheduleBlockRow) => {
    setSheetBlock(null)
    setCopyFor(b)
    setCopySelected(new Set())
    setCopyLinked(true)
  }
  const submitCopy = async () => {
    if (!copyFor || copySelected.size === 0 || !props.onCopyBlockToPeople) return
    setCopyBusy(true)
    try {
      await props.onCopyBlockToPeople({ blockId: copyFor.id, userIds: [...copySelected], linked: copyLinked })
      setCopyFor(null)
    } finally {
      setCopyBusy(false)
    }
  }

  const linkedWrongDay = mode?.kind === 'copy' && mode.linked && modeSourceYmd != null && modeSourceYmd !== selectedYmd
  const bar = mode ? modeBarText(mode) : null
  const showBar = (mode != null && mode.kind !== 'multi-cell') || linkedSelecting

  return (
    <div data-testid="hub-people-phone-board" style={{ display: 'grid', gap: '0.55rem', paddingBottom: showBar ? '5.5rem' : '0.5rem' }}>
      {/* day strip */}
      <div role="tablist" aria-label="Days this week" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, strip.length)}, 1fr)`, gap: '0.25rem' }}>
        {strip.map((d) => (
          <button
            key={d.ymd}
            type="button"
            role="tab"
            aria-selected={d.isSelected}
            aria-label={`${d.weekday} ${d.dayNumber}${d.isToday ? ' (today)' : ''}: ${d.caption}`}
            onClick={() => setSelectedYmd(d.ymd)}
            style={{
              fontFamily: 'inherit',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0.25rem 0 0.2rem',
              background: d.isSelected ? 'var(--bg-blue-tint)' : 'var(--surface)',
              boxShadow: d.isToday ? 'inset 0 0 0 2px #f97316' : d.isSelected ? 'inset 0 0 0 2px #2563eb' : undefined,
              color: 'var(--text-muted)',
              fontSize: '0.72rem',
              lineHeight: 1.2,
              cursor: 'pointer',
            }}
          >
            {d.weekday}
            <b style={{ display: 'block', fontSize: '0.95rem', color: 'var(--text-strong)' }}>{d.dayNumber}</b>
            <small style={{ display: 'block', fontSize: '0.62rem', color: d.missingNotes > 0 ? 'var(--text-red-700)' : 'var(--text-muted)' }}>{d.caption}</small>
          </button>
        ))}
      </div>

      {/* toolbar */}
      {canEdit && !mode && !linkedSelecting ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem' }}>
          <button type="button" style={btn} onClick={props.onRequestHubAddJob} disabled={!props.onRequestHubAddJob}>
            <i style={{ fontStyle: 'normal', fontSize: '1rem' }}>＋</i>Add job
          </button>
          <button type="button" style={btn} onClick={props.onStartLinkedCopyMode} disabled={!props.onStartLinkedCopyMode} title="Pick blocks, then tap the techs to copy them to (linked)">
            <i style={{ fontStyle: 'normal', fontSize: '1rem' }}>⧉</i>Copy to techs
          </button>
          <button type="button" style={{ ...btn, borderColor: '#16a34a', color: 'var(--text-green-700)' }} onClick={props.onOpenQuickAssign} disabled={!props.onOpenQuickAssign}>
            <i style={{ fontStyle: 'normal', fontSize: '1rem' }}>⚡</i>Assign work
          </button>
        </div>
      ) : null}

      {loading ? <p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading…</p> : null}
      {!loading && sections.every((s) => s.people.length === 0) ? <p style={{ color: 'var(--text-muted)', margin: 0 }}>No one to show for this week.</p> : null}

      {/* sections */}
      {sections.map((section, si) => {
        const dayBlockCount = section.people.reduce((n, p) => n + dayBlocksFor(p.userId, selectedYmd).length, 0)
        const laneMembers = section.heading?.laneMemberUserIds ?? section.people.map((p) => p.userId)
        const bandApply = mode?.kind === 'linked-apply' && props.onLinkedCopyApplyToLane != null && section.heading != null
        return (
          <div key={section.heading?.key ?? `section-${si}`} style={{ display: 'grid', gap: '0.55rem' }}>
            {section.heading ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  borderRadius: 8,
                  padding: '0.35rem 0.55rem',
                  fontWeight: 700,
                  color: 'var(--text-strong)',
                  fontSize: '0.85rem',
                  background: 'var(--bg-muted)',
                  borderLeft: '4px solid #2563eb',
                }}
              >
                <span>
                  {section.heading.label} <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.72rem' }}>{teamBandCaption(section.people.length, dayBlockCount)}</span>
                </span>
                {bandApply ? (
                  <button
                    type="button"
                    disabled={linkedCopyApplyBusy}
                    onClick={() => props.onLinkedCopyApplyToLane?.(section.heading!.label, laneMembers)}
                    style={{ ...btn, minHeight: 0, padding: '0.2rem 0.55rem', fontSize: '0.72rem', flexDirection: 'row' }}
                  >
                    Whole team
                  </button>
                ) : null}
              </div>
            ) : null}
            {section.people.map((person) => {
              const blocks = dayBlocksFor(person.userId, selectedYmd)
              const timeOff = userTimeOffByCell?.get(userTimeOffCellKey(person.userId, selectedYmd)) ?? null
              const salaried = salariedUserIds.has(person.userId)
              if (mode) {
                const state = linkedWrongDay
                  ? { tone: 'source' as const, what: `Linked copies land on ${weekdayOfYmd(modeSourceYmd!)} ${Number(modeSourceYmd!.slice(8, 10))}`, why: 'Switch back to that day in the strip to place it.', tappable: false }
                  : cardTargetState({
                      mode,
                      userId: person.userId,
                      dayBlocks: blocks.map(blockSummary),
                      notComingIn: timeOff != null,
                      multiSelected: hubMultiCellAddSelectedKeys.has(hubPersonDayKey(person.userId, selectedYmd)),
                    })
                return (
                  <button
                    key={person.userId}
                    type="button"
                    disabled={!state.tappable || linkedCopyApplyBusy}
                    aria-label={`${person.displayName}: ${state.what}`}
                    onClick={() => tapTarget(person.userId)}
                    style={targetStyle(state.tone, state.tappable)}
                  >
                    <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-strong)' }}>
                      {person.displayName}
                      {salaried ? <small style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '0.25rem' }}>(s)</small> : null}
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: state.tone === 'busy' ? 'var(--text-red-700)' : state.tone === 'free' ? '#4338ca' : 'var(--text-700)' }}>{state.what}</span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{state.why}</span>
                  </button>
                )
              }
              return (
                <div key={person.userId} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.5rem 0.6rem' }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-strong)' }}>
                      {person.displayName}
                      {salaried ? <small style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '0.25rem' }}>(s)</small> : null}
                    </span>
                    {timeOff ? <span style={chip(timeOff.variant === 'ncns' ? 'red' : 'amber')}>{timeOff.label}</span> : null}
                  </div>
                  {blocks.map((b) => {
                    const linkedWith = linkedWithCaption(crewNames(b), person.displayName)
                    const addr = getJobAddress?.(scheduleBlockAnchorId(b)) ?? ''
                    const selecting = linkedSelecting
                    const selected = selecting && (linkedCopyMode?.selectedBlockIds.has(b.id) ?? false)
                    return (
                      <button
                        key={b.id}
                        type="button"
                        aria-label={`${blockTitle(b)} ${formatShortRange(timeToMinutes(b.time_start), timeToMinutes(b.time_end))}${selecting ? (selected ? ' (selected)' : ' (tap to select)') : ''}`}
                        onClick={() => {
                          if (selecting) props.onLinkedCopyToggleBlock?.(b.id)
                          else if (canEdit) setSheetBlock(b)
                          else props.onOpenHubJobDetail(b, selectedYmd)
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          fontFamily: 'inherit',
                          display: 'grid',
                          gridTemplateColumns: selecting ? '1.4rem 1fr auto' : '1fr auto',
                          gap: '0.5rem',
                          padding: '0.5rem 0.6rem',
                          borderTop: '1px solid var(--border)',
                          borderLeft: 'none',
                          borderRight: 'none',
                          borderBottom: 'none',
                          alignItems: 'center',
                          background: selected ? 'var(--bg-blue-tint)' : 'transparent',
                          color: 'inherit',
                          cursor: 'pointer',
                        }}
                      >
                        {selecting ? (
                          <span aria-hidden style={{ width: '1.2rem', height: '1.2rem', borderRadius: 5, border: selected ? 'none' : '2px solid var(--border-strong)', background: selected ? '#2563eb' : 'transparent', color: '#fff', fontSize: '0.8rem', display: 'grid', placeItems: 'center' }}>
                            {selected ? '✓' : ''}
                          </span>
                        ) : null}
                        <span style={{ minWidth: 0 }}>
                          <b style={{ display: 'block', color: 'var(--text-strong)', fontSize: '0.85rem' }}>{blockTitle(b)}</b>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                            {[addr || null, linkedWith].filter(Boolean).join(' · ')}
                            {b.note ? '' : ''}
                          </span>
                        </span>
                        <span style={{ color: 'var(--text-link)', fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{formatShortRange(timeToMinutes(b.time_start), timeToMinutes(b.time_end))}</span>
                      </button>
                    )
                  })}
                  {canEdit && !linkedSelecting && (props.onAddJobToScheduleForCell || props.onEmptyCellClick) ? (
                    <button
                      type="button"
                      aria-label={`Add a job for ${person.displayName}`}
                      onClick={() => (props.onAddJobToScheduleForCell ?? props.onEmptyCellClick)?.(person.userId, selectedYmd)}
                      style={{ width: '100%', fontFamily: 'inherit', border: 'none', borderTop: '1px dashed var(--border)', background: 'transparent', textAlign: 'center', padding: '0.55rem', color: 'var(--text-link)', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
                    >
                      + Add here
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        )
      })}

      {/* the bottom switch */}
      <div style={{ display: 'grid', gap: '0.2rem', textAlign: 'center', padding: '0.8rem 0.5rem 0.3rem', borderTop: '1px solid var(--border)', marginTop: '0.3rem' }}>
        <button type="button" onClick={props.onShowDesktopView} style={{ ...btn, justifySelf: 'center', flexDirection: 'row', minHeight: 0, padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
          ▦ Show the desktop view
        </button>
        <small style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>the week grid, as on a computer · remembered on this phone</small>
      </div>

      {/* mode bar */}
      {showBar ? (
        <div
          role="status"
          style={{
            position: 'fixed',
            left: '0.5rem',
            right: '0.5rem',
            bottom: `calc(${BOTTOM_INSET} + 0.5rem)`,
            zIndex: 1002,
            background: 'var(--text-strong)',
            color: 'var(--bg-page)',
            borderRadius: 12,
            padding: '0.6rem 0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.6rem',
            fontSize: '0.82rem',
            boxShadow: '0 6px 20px rgba(0,0,0,.25)',
          }}
        >
          {linkedSelecting ? (
            <>
              <span>
                Pick the blocks to copy <span style={{ opacity: 0.75 }}>· {linkedCopyMode?.selectedBlockIds.size ?? 0} selected</span>
              </span>
              <span style={{ display: 'flex', gap: '0.4rem' }}>
                <button type="button" disabled={(linkedCopyMode?.selectedBlockIds.size ?? 0) === 0} onClick={() => props.onLinkedCopySetStage?.(2)} style={{ fontFamily: 'inherit', border: '1px solid rgba(255,255,255,.5)', background: '#2563eb', color: '#fff', borderRadius: 7, padding: '0.3rem 0.6rem', fontWeight: 600, cursor: 'pointer' }}>
                  Next
                </button>
                <button type="button" onClick={cancelMode} style={{ fontFamily: 'inherit', border: '1px solid rgba(255,255,255,.5)', background: 'transparent', color: 'inherit', borderRadius: 7, padding: '0.3rem 0.6rem', fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
              </span>
            </>
          ) : bar ? (
            <>
              <span>
                {bar.text} {bar.suffix ? <span style={{ opacity: 0.75 }}>· {bar.suffix}</span> : null}
                {linkedCopyApplyBusy ? <span style={{ opacity: 0.75 }}> · applying…</span> : null}
              </span>
              <button type="button" onClick={cancelMode} style={{ fontFamily: 'inherit', border: '1px solid rgba(255,255,255,.5)', background: 'transparent', color: 'inherit', borderRadius: 7, padding: '0.3rem 0.6rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {mode?.kind === 'linked-apply' ? 'Done' : 'Cancel'}
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {/* block sheet */}
      {sheetBlock ? (
        <Sheet onClose={() => setSheetBlock(null)} title={blockTitle(sheetBlock)} subtitle={`${formatShortRange(timeToMinutes(sheetBlock.time_start), timeToMinutes(sheetBlock.time_end))} · ${hubPeopleNameById.get(sheetBlock.assignee_user_id) ?? ''}${getJobAddress ? ` · ${getJobAddress(scheduleBlockAnchorId(sheetBlock))}` : ''}`}>
          <SheetAction label="Open the job" hint="Job detail with this visit's times" onClick={() => { const b = sheetBlock; setSheetBlock(null); props.onOpenHubJobDetail(b, selectedYmd) }} />
          {props.onRequestEditBlockNote ? <SheetAction label={sheetBlock.note ? 'Edit the note' : 'Add a note'} hint={sheetBlock.note ? sheetBlock.note : 'What the tech needs to know'} onClick={() => { const b = sheetBlock; setSheetBlock(null); props.onRequestEditBlockNote?.(b) }} /> : null}
          {props.onCopyBlockToPeople ? <SheetAction label="Copy to techs" hint="Pick the people; linked by default" onClick={() => openCopySheet(sheetBlock)} primary /> : null}
          <SheetAction label="Move" hint="Then tap the tech and day it goes to" onClick={() => { const b = sheetBlock; setSheetBlock(null); props.onStartCardPlacement(b, 'move') }} />
          <SheetAction label="Remove from the schedule" hint="Only this block; crew-mates keep theirs" danger onClick={() => { const b = sheetBlock; setSheetBlock(null); props.onDeleteBlock(b.id) }} />
        </Sheet>
      ) : null}

      {/* copy to techs sheet */}
      {copyFor ? (
        <Sheet
          onClose={() => setCopyFor(null)}
          title={`Copy ${blockTitle(copyFor)} · ${formatShortRange(timeToMinutes(copyFor.time_start), timeToMinutes(copyFor.time_end))} to…`}
          subtitle={`${weekdayOfYmd(copyFor.work_date)} ${Number(copyFor.work_date.slice(8, 10))} · from ${hubPeopleNameById.get(copyFor.assignee_user_id) ?? 'this tech'} · tap people, or a team band for the whole crew`}
        >
          <div style={{ maxHeight: '48vh', overflowY: 'auto', display: 'grid' }}>
            {sections.map((section, si) => {
              const candidates = section.people.filter((p) => p.userId !== copyFor.assignee_user_id)
              if (candidates.length === 0) return null
              const allOn = candidates.every((p) => copySelected.has(p.userId))
              return (
                <div key={section.heading?.key ?? `copy-${si}`}>
                  {section.heading ? (
                    <button
                      type="button"
                      onClick={() =>
                        setCopySelected((prev) => {
                          const next = new Set(prev)
                          for (const p of candidates) {
                            if (allOn) next.delete(p.userId)
                            else next.add(p.userId)
                          }
                          return next
                        })
                      }
                      style={{ width: '100%', fontFamily: 'inherit', textAlign: 'left', border: 'none', borderLeft: '4px solid #2563eb', borderRadius: 8, padding: '0.35rem 0.55rem', fontWeight: 700, color: 'var(--text-strong)', fontSize: '0.85rem', background: allOn ? 'var(--bg-blue-tint)' : 'var(--bg-muted)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                    >
                      <span>{section.heading.label}</span>
                      <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.72rem' }}>{allOn ? '✓ whole crew' : 'tap for the crew'}</span>
                    </button>
                  ) : null}
                  {candidates.map((p) => {
                    const dayBlocks = dayBlocksFor(p.userId, copyFor.work_date)
                    const avail = availabilityLabel({ window: { startMinutes: timeToMinutes(copyFor.time_start), endMinutes: timeToMinutes(copyFor.time_end) }, dayBlocks: dayBlocks.map(blockSummary) })
                    const on = copySelected.has(p.userId)
                    return (
                      <button
                        key={p.userId}
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        aria-label={`${p.displayName} — ${avail.text}`}
                        onClick={() =>
                          setCopySelected((prev) => {
                            const next = new Set(prev)
                            if (on) next.delete(p.userId)
                            else next.add(p.userId)
                            return next
                          })
                        }
                        style={{ width: '100%', fontFamily: 'inherit', textAlign: 'left', display: 'grid', gridTemplateColumns: '1.6rem 1fr auto', gap: '0.5rem', alignItems: 'center', padding: '0.5rem 0.3rem', border: 'none', borderTop: '1px solid var(--border)', background: 'transparent', color: 'inherit', cursor: 'pointer' }}
                      >
                        <span aria-hidden style={{ width: '1.3rem', height: '1.3rem', border: on ? 'none' : '2px solid var(--border-strong)', borderRadius: 5, background: on ? '#3b82f6' : 'transparent', color: '#fff', display: 'grid', placeItems: 'center', fontSize: '0.85rem' }}>
                          {on ? '✓' : ''}
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'block', fontWeight: 700, color: 'var(--text-strong)', fontSize: '0.95rem' }}>{p.displayName}</span>
                          <span style={{ display: 'block', height: 8, borderRadius: 4, background: 'var(--bg-muted)', position: 'relative', marginTop: '0.3rem', overflow: 'hidden' }}>
                            {dayBlocks.map((b) => {
                              const span = ribbonSpan(timeToMinutes(b.time_start), timeToMinutes(b.time_end))
                              return span ? <i key={b.id} style={{ position: 'absolute', top: 0, bottom: 0, left: `${span.leftPct}%`, width: `${span.widthPct}%`, background: '#93c5fd' }} /> : null
                            })}
                          </span>
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap', color: avail.free ? 'var(--text-green-700)' : 'var(--text-red-700)' }}>{avail.text}</span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', alignItems: 'center', paddingTop: '0.3rem' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-700)' }}>
              <input type="checkbox" checked={copyLinked} onChange={(e) => setCopyLinked(e.target.checked)} />
              Linked crew — moves together
            </label>
            <button
              type="button"
              disabled={copySelected.size === 0 || copyBusy}
              onClick={() => void submitCopy()}
              style={{ fontFamily: 'inherit', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 7, padding: '0.55rem 0.9rem', fontSize: '0.9rem', fontWeight: 600, cursor: copySelected.size === 0 ? 'not-allowed' : 'pointer', opacity: copySelected.size === 0 ? 0.6 : 1 }}
            >
              {copyBusy ? 'Adding…' : `Add to ${copySelected.size} tech${copySelected.size === 1 ? '' : 's'}`}
            </button>
          </div>
        </Sheet>
      ) : null}
    </div>
  )
}

function Sheet({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1003, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', background: 'var(--surface)', color: 'var(--text-700)', borderRadius: '18px 18px 0 0', padding: `0.6rem 0.8rem calc(1rem + ${BOTTOM_INSET})`, display: 'grid', gap: '0.5rem', boxShadow: '0 -8px 24px rgba(0,0,0,.2)', maxHeight: '85vh', overflowY: 'auto' }}
      >
        <div aria-hidden style={{ width: '2.4rem', height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '0 auto 0.2rem' }} />
        <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-strong)' }}>{title}</h3>
        {subtitle ? <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{subtitle}</div> : null}
        {children}
        <button type="button" onClick={onClose} style={{ fontFamily: 'inherit', background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: 7, padding: '0.5rem', color: 'var(--text-700)', fontWeight: 600, cursor: 'pointer', marginTop: '0.2rem' }}>
          Close
        </button>
      </div>
    </div>
  )
}

function SheetAction({ label, hint, onClick, primary, danger }: { label: string; hint?: string; onClick: () => void; primary?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        fontFamily: 'inherit',
        border: `1px solid ${danger ? 'var(--border-red)' : primary ? '#3b82f6' : 'var(--border)'}`,
        background: primary ? 'var(--bg-blue-tint)' : 'var(--surface)',
        borderRadius: 9,
        padding: '0.6rem 0.7rem',
        display: 'grid',
        gap: '0.1rem',
        cursor: 'pointer',
        color: danger ? 'var(--text-red-700)' : 'var(--text-strong)',
      }}
    >
      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{label}</span>
      {hint ? <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 400 }}>{hint}</span> : null}
    </button>
  )
}
