import { useCallback, useState, type ReactNode } from 'react'
import { TaskChoiceSheet } from '../components/checklist/TaskChoiceSheet'
import { TaskDropSheet } from '../components/checklist/TaskDropSheet'
import { TaskMoveDaySheet } from '../components/checklist/TaskMoveDaySheet'
import { TaskPassSheet } from '../components/checklist/TaskPassSheet'
import { TaskStuckSheet } from '../components/checklist/TaskStuckSheet'
import { dayLabel } from '../lib/checklistDueDates'
import { getCurrentUserName } from '../lib/getCurrentUserName'
import { TASK_MORE_LABEL, TASK_MORE_TITLE, dropPush, moveDayPush, stuckPush, taskMoreChoices, type PassAnswer, type TaskDoerTarget, type TaskMoreKey } from '../lib/tasks/taskDoerActs'
import { dropTask, moveTaskDay, sayTaskStuck, tellTaskGiver } from '../lib/tasks/taskDoerActsIo'
import { TASK_PILL_STYLE } from '../lib/tasks/taskPillStyle'

export type TaskDoerActsTarget = TaskDoerTarget & {
  /** The day the task is due now, when it has one. */
  dueYmd?: string | null
  /** The task's quiet line on the pass: when it was given and how old it is. */
  meta?: string | null
}

type Input = {
  authUserId: string | null
  todayYmd: string
  /** Something about the task changed: the page reads its lists again. */
  onChanged: () => void | Promise<void>
  /** The seams a test fills. */
  moveDay?: typeof moveTaskDay
  drop?: typeof dropTask
  sayStuck?: typeof sayTaskStuck
  /** Mark a task done, the way its tick does. The pass's Done answer; left out, the pass offers no way to finish a task. */
  markDone?: (instanceId: string) => Promise<void>
  tellGiver?: typeof tellTaskGiver
  nameOf?: (userId: string) => Promise<string>
}

export type TaskDoerActs = {
  /** The card's More press for one task, or nothing when the task offers no act. */
  morePress: (target: TaskDoerActsTarget) => ReactNode
  /** The sheets, mounted once on the page. */
  sheets: ReactNode
  /** Go through a list of tasks one at a time (step C5). */
  startPass: (targets: TaskDoerActsTarget[]) => void
}

/**
 * The doer's tools on a page of task cards (punch list #369, from step C3): one **⋯ More** press per card and one set
 * of sheets for the page. More lists what this task allows (`taskMoreChoices`), a pick opens that act's own sheet, and
 * an act that lands tells whoever gave the task and has the page read its lists again. The card itself knows none of
 * it: the page hands the press in as one of the card's extras.
 */
export function useTaskDoerActs({ authUserId, todayYmd, onChanged, moveDay = moveTaskDay, drop = dropTask, sayStuck = sayTaskStuck, markDone, tellGiver = tellTaskGiver, nameOf = getCurrentUserName }: Input): TaskDoerActs {
  const [target, setTarget] = useState<TaskDoerActsTarget | null>(null)
  const [act, setAct] = useState<TaskMoreKey | 'more' | null>(null)
  // Step C5: the pass holds its own list, taken when it starts, so a re-read under it cannot reorder what is being asked.
  const [pass, setPass] = useState<{ targets: TaskDoerActsTarget[]; index: number; sorted: number } | null>(null)
  const [passBusy, setPassBusy] = useState(false)
  const [passError, setPassError] = useState<string | null>(null)

  // An act's sheet closing by itself, on × or the backdrop: inside a pass, the pass's question comes back.
  const close = useCallback(() => {
    setAct(null)
    setTarget(null)
  }, [])

  /** The task in hand was changed by an answer: count it and ask about the next one. */
  const passNext = useCallback((changed: boolean) => {
    setPassError(null)
    setPass((p) => (p ? { ...p, index: p.index + 1, sorted: p.sorted + (changed ? 1 : 0) } : p))
  }, [])

  const startPass = useCallback((targets: TaskDoerActsTarget[]) => {
    if (targets.length === 0) return
    setAct(null)
    setTarget(null)
    setPassError(null)
    setPass({ targets, index: 0, sorted: 0 })
  }, [])

  const morePress = useCallback((t: TaskDoerActsTarget): ReactNode => {
    if (taskMoreChoices(t).length === 0) return null
    return (
      <button
        type="button"
        data-task-more
        aria-haspopup="dialog"
        onClick={() => {
          setTarget(t)
          setAct('more')
        }}
        style={TASK_PILL_STYLE}
        title="More you can do with this task"
      >
        {TASK_MORE_LABEL}
      </button>
    )
  }, [])

  const onMove = useCallback(
    async (ymd: string): Promise<string | null> => {
      if (!target) return 'That task is gone.'
      const refused = await moveDay(target.instanceId, ymd)
      if (refused) return refused
      // The act has landed. The push and the re-read follow, and neither can undo it.
      if (target.giverId && authUserId && target.giverId !== authUserId) {
        const who = await nameOf(authUserId).catch(() => 'Someone')
        const push = moveDayPush(who, target.title, dayLabel(ymd))
        void tellGiver({ giverId: target.giverId, instanceId: target.instanceId, title: push.title, body: push.body })
      }
      void onChanged()
      passNext(true)
      return null
    },
    [authUserId, moveDay, nameOf, onChanged, passNext, target, tellGiver],
  )

  const onDrop = useCallback(
    async (reason: string): Promise<string | null> => {
      if (!target) return 'That task is gone.'
      const refused = await drop(target.instanceId, reason)
      if (refused) return refused
      if (target.giverId && authUserId && target.giverId !== authUserId) {
        const who = await nameOf(authUserId).catch(() => 'Someone')
        const push = dropPush(who, target.title, reason)
        void tellGiver({ giverId: target.giverId, instanceId: target.instanceId, title: push.title, body: push.body })
      }
      void onChanged()
      passNext(true)
      return null
    },
    [authUserId, drop, nameOf, onChanged, passNext, target, tellGiver],
  )

  const onStuck = useCallback(
    async (reason: string): Promise<string | null> => {
      if (!target || !authUserId) return 'That task is gone.'
      const refused = await sayStuck({ instanceId: target.instanceId, userId: authUserId, kind: 'stuck', words: reason })
      if (refused) return refused
      if (target.giverId && target.giverId !== authUserId) {
        const who = await nameOf(authUserId).catch(() => 'Someone')
        const push = stuckPush(who, target.title, reason)
        void tellGiver({ giverId: target.giverId, instanceId: target.instanceId, title: push.title, body: push.body })
      }
      void onChanged()
      passNext(true)
      return null
    },
    [authUserId, nameOf, onChanged, passNext, sayStuck, target, tellGiver],
  )

  // No longer stuck takes no sheet: the press is the whole act, and a slip is undone by saying stuck again.
  const pick = useCallback(
    (key: TaskMoreKey) => {
      if (key !== 'unstuck') {
        setAct(key)
        return
      }
      const t = target
      close()
      if (!t || !authUserId) return
      void sayStuck({ instanceId: t.instanceId, userId: authUserId, kind: 'unstuck', words: '' }).then(() => onChanged())
    },
    [authUserId, close, onChanged, sayStuck, target],
  )

  const passTask = pass ? (pass.targets[pass.index] ?? null) : null
  const onPassAnswer = useCallback(
    (answer: PassAnswer) => {
      const t = passTask
      if (!t) return
      setPassError(null)
      if (answer === 'skip') {
        passNext(false)
        return
      }
      if (answer === 'done') {
        if (!markDone) return
        setPassBusy(true)
        void markDone(t.instanceId)
          .then(() => passNext(true), () => setPassError('The task did not mark done. Try it from the list.'))
          .finally(() => setPassBusy(false))
        return
      }
      // Still on it, Can't do it and No longer applies are the tools' own sheets, opened over the pass.
      setTarget(t)
      setAct(answer)
    },
    [markDone, passNext, passTask],
  )
  const closePass = useCallback(() => {
    setPass(null)
    setPassError(null)
    close()
  }, [close])

  const told = target && target.giverId !== authUserId ? target.giverName : null
  const sheets = (
    <>
      <TaskPassSheet open={!!pass && act === null} task={passTask} meta={passTask?.meta ?? null} index={pass?.index ?? 0} total={pass?.targets.length ?? 0} sorted={pass?.sorted ?? 0} busy={passBusy} error={passError} onAnswer={onPassAnswer} onClose={closePass} />
      <TaskChoiceSheet open={act === 'more' && !!target} title={TASK_MORE_TITLE} taskTitle={target?.title ?? ''} choices={target ? taskMoreChoices(target) : []} onPick={pick} onClose={close} labelId="task-more-sheet-title" />
      <TaskMoveDaySheet open={act === 'move' && !!target} taskTitle={target?.title ?? ''} todayYmd={todayYmd} dueYmd={target?.dueYmd ?? null} giverName={told} onMove={onMove} onClose={close} />
      <TaskStuckSheet open={act === 'stuck' && !!target} taskTitle={target?.title ?? ''} giverName={told} onSay={onStuck} onClose={close} />
      <TaskDropSheet open={act === 'drop' && !!target} taskTitle={target?.title ?? ''} giverName={told} onDrop={onDrop} onClose={close} />
    </>
  )

  return { morePress, sheets, startPass }
}
