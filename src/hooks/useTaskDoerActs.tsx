import { useCallback, useState, type ReactNode } from 'react'
import { TaskChoiceSheet } from '../components/checklist/TaskChoiceSheet'
import { TaskMoveDaySheet } from '../components/checklist/TaskMoveDaySheet'
import { dayLabel } from '../lib/checklistDueDates'
import { getCurrentUserName } from '../lib/getCurrentUserName'
import { TASK_MORE_LABEL, TASK_MORE_TITLE, moveDayPush, taskMoreChoices, type TaskDoerTarget, type TaskMoreKey } from '../lib/tasks/taskDoerActs'
import { moveTaskDay, tellTaskGiver } from '../lib/tasks/taskDoerActsIo'
import { TASK_PILL_STYLE } from '../lib/tasks/taskPillStyle'

export type TaskDoerActsTarget = TaskDoerTarget & {
  /** The day the task is due now, when it has one. */
  dueYmd?: string | null
}

type Input = {
  authUserId: string | null
  todayYmd: string
  /** Something about the task changed: the page reads its lists again. */
  onChanged: () => void | Promise<void>
  /** The seams a test fills. */
  moveDay?: typeof moveTaskDay
  tellGiver?: typeof tellTaskGiver
  nameOf?: (userId: string) => Promise<string>
}

export type TaskDoerActs = {
  /** The card's More press for one task, or nothing when the task offers no act. */
  morePress: (target: TaskDoerActsTarget) => ReactNode
  /** The sheets, mounted once on the page. */
  sheets: ReactNode
}

/**
 * The doer's tools on a page of task cards (punch list #369, from step C3): one **⋯ More** press per card and one set
 * of sheets for the page. More lists what this task allows (`taskMoreChoices`), a pick opens that act's own sheet, and
 * an act that lands tells whoever gave the task and has the page read its lists again. The card itself knows none of
 * it: the page hands the press in as one of the card's extras.
 */
export function useTaskDoerActs({ authUserId, todayYmd, onChanged, moveDay = moveTaskDay, tellGiver = tellTaskGiver, nameOf = getCurrentUserName }: Input): TaskDoerActs {
  const [target, setTarget] = useState<TaskDoerActsTarget | null>(null)
  const [act, setAct] = useState<TaskMoreKey | 'more' | null>(null)

  const close = useCallback(() => {
    setAct(null)
    setTarget(null)
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
      return null
    },
    [authUserId, moveDay, nameOf, onChanged, target, tellGiver],
  )

  const sheets = (
    <>
      <TaskChoiceSheet open={act === 'more' && !!target} title={TASK_MORE_TITLE} taskTitle={target?.title ?? ''} choices={target ? taskMoreChoices(target) : []} onPick={(key) => setAct(key)} onClose={close} labelId="task-more-sheet-title" />
      <TaskMoveDaySheet open={act === 'move' && !!target} taskTitle={target?.title ?? ''} todayYmd={todayYmd} dueYmd={target?.dueYmd ?? null} giverName={target && target.giverId !== authUserId ? target.giverName : null} onMove={onMove} onClose={close} />
    </>
  )

  return { morePress, sheets }
}
