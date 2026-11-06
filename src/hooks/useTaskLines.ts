/**
 * Task cards: the Done when… lines of the cards on a screen (punch list #273, PR 2, v2.6595). One read for every card
 * shown (Today, the Dashboard's My Inbox), the lines each card carries with their ticks on its day row, and a tick that
 * shows at once and lands through `tickLine`. A tick that ticks the last line answers `allTicked`, and the screen
 * reads its cards again, since the database closes such a card (the recount trigger, then `a_task_percent_keeps_done`).
 * Hears `checklist-item-saved`, so lines edited in the dialog show without a reload.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { criteriaForCard, lineStates, type LineState, type TaskCriterion, type TaskCriterionCheck } from '../lib/taskCriteria'
import { loadTaskLines, tickLine } from '../lib/taskLinesIo'

export type TaskLineCard = { instanceId: string; itemId: string; roadmapTaskId?: string | null }

export type TaskLinesHost = {
  linesFor: (instanceId: string) => LineState[]
  /** Ticks or unticks one line; `allTicked` says the card's last line is now ticked. */
  tick: (instanceId: string, criterionId: string, ticked: boolean) => Promise<{ ok: boolean; allTicked: boolean; error?: string }>
  reload: () => Promise<void>
  /** Any card on the screen has lines. */
  hasAny: boolean
  error: string | null
}

export function useTaskLines(cards: TaskLineCard[], authUserId: string | null): TaskLinesHost {
  const [criteria, setCriteria] = useState<TaskCriterion[]>([])
  const [checks, setChecks] = useState<TaskCriterionCheck[]>([])
  const [error, setError] = useState<string | null>(null)
  const cardsRef = useRef(cards)
  cardsRef.current = cards
  // The parents build the list on every render; the read follows the ids, not the array.
  const key = useMemo(
    () =>
      cards
        .map((c) => `${c.instanceId}|${c.itemId}|${c.roadmapTaskId ?? ''}`)
        .sort()
        .join(';'),
    [cards],
  )

  const reload = useCallback(async () => {
    const list = cardsRef.current
    if (list.length === 0) {
      setCriteria([])
      setChecks([])
      return
    }
    const r = await loadTaskLines({
      itemIds: list.map((c) => c.itemId),
      taskIds: list.map((c) => c.roadmapTaskId ?? '').filter(Boolean),
      instanceIds: list.map((c) => c.instanceId),
    })
    setCriteria(r.criteria)
    setChecks(r.checks)
    setError(r.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    const onSaved = () => void reload()
    window.addEventListener('checklist-item-saved', onSaved)
    return () => window.removeEventListener('checklist-item-saved', onSaved)
  }, [reload])

  const linesFor = useCallback(
    (instanceId: string): LineState[] => {
      const card = cardsRef.current.find((c) => c.instanceId === instanceId)
      if (!card) return []
      const mine = criteriaForCard({ itemId: card.itemId, roadmapTaskId: card.roadmapTaskId ?? null }, criteria)
      return mine.length ? lineStates(mine, checks, instanceId) : []
    },
    [criteria, checks],
  )

  const tick = useCallback(
    async (instanceId: string, criterionId: string, ticked: boolean) => {
      if (!authUserId) return { ok: false, allTicked: false, error: 'Sign in to tick a line.' }
      const line = criteria.find((c) => c.id === criterionId)
      if (!line) return { ok: false, allTicked: false, error: 'That line is gone.' }
      const before = checks
      const next = ticked
        ? [...before.filter((k) => !(k.criterion_id === criterionId && k.instance_id === instanceId)), { criterion_id: criterionId, instance_id: instanceId, checked_at: new Date().toISOString(), checked_by: authUserId, photo_id: null }]
        : before.filter((k) => !(k.criterion_id === criterionId && k.instance_id === instanceId))
      setChecks(next)
      const r = await tickLine({ instanceId, criterionId, body: line.body, authUserId, ticked })
      if (!r.ok) {
        setChecks(before)
        setError(r.error ?? null)
        return { ok: false, allTicked: false, error: r.error }
      }
      const card = cardsRef.current.find((c) => c.instanceId === instanceId)
      const mine = card ? criteriaForCard({ itemId: card.itemId, roadmapTaskId: card.roadmapTaskId ?? null }, criteria) : []
      const states = lineStates(mine, next, instanceId)
      return { ok: true, allTicked: states.length > 0 && states.every((s) => s.checked) }
    },
    [authUserId, checks, criteria],
  )

  return { linesFor, tick, reload, hasAny: criteria.length > 0, error }
}
