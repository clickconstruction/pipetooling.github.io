import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { parseLines } from '../../lib/taskCriteria'
import { asksForPhotoDefault } from '../../lib/taskProgress'
import type { TaskPlaceDraft } from '../../lib/tasks/taskPlace'
import { roadmapTaskSentence, taskPersonName } from '../../lib/tasks/newTaskWindow'
import { DONE_WHEN_HINT } from '../../lib/tasks/taskRowsOnAPhone'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useRecentTaskAssignees } from '../../hooks/useRecentTaskAssignees'
import type { TaskSpotPhotoDraft } from './TaskSpotPhotoField'
import { TaskFormRows } from './newTask/TaskFormRows'
import { TaskSendBar } from './newTask/TaskSendBar'
import { TaskWindowClose, TaskWindowShell } from './newTask/TaskWindowShell'
import { TASK_WORDS_BOX_STYLE, restingTaskFormValue } from './newTask/taskWindowBits'
import { ROADMAP_TASK_PICKER_Z, ROADMAP_TASK_WINDOW_Z } from '../../lib/windowLayers'

type UserRow = { id: string; name: string; email: string }

// Stable default: an inline `= []` default mints a new array identity on every
// render, and it sits in the reset-effect's dependency list — so each keystroke
// (setTitle → re-render → "new" dep) re-ran the reset and wiped the title.
const NO_PRESET_ASSIGNEES: readonly string[] = []

/** A roadmap task's own rare things. It has no day, reminder or link: its stage decides when it lands. */
const ROADMAP_ADD_KEYS = ['lines', 'photo'] as const

type Props = {
  open: boolean
  groupId: string | null
  groupTitle: string
  users: UserRow[]
  /** When set and present in `users`, that person's face is first, as Me. */
  currentUserId: string | null
  onClose: () => void
  /**
   * Task cards (#273, PR 2): the Done when… lines typed on a new task ride along, one a row, already parsed; PR 4: the
   * photo switch. #328: the place. #331: the giver's photo of the spot, which the parent files once the task has an id.
   */
  onSave: (title: string, assigneeUserIds: string[], lines: string[], asksForPhoto: boolean, place: TaskPlaceDraft | null, spotPhoto: TaskSpotPhotoDraft | null) => Promise<boolean>
  /** e.g. roadmap canvas in Fullscreen API — modals must mount inside the fullscreen element */
  portalContainer?: HTMLElement | null
  /** When set, modal is in edit mode (title + assignees pre-filled). */
  editingTaskId?: string | null
  initialEditTitle?: string
  initialEditAssigneeUserIds?: readonly string[]
}

/**
 * Add a task to a Roadmap stage. Parent supplies onSave; returns true on success.
 *
 * Since v2.7093 (punch list #331, PR 4) it draws the same rows as the New task window: the words, **For** as faces
 * with the crews and **Someone else**, **Where** as the place shelf and the Photo press, and **Add** with the two
 * things a roadmap task carries, the Done when… lines and the photo at the finish. It has no When row: a roadmap
 * task lands on each person's list when its stage unlocks, and the sentence above the button says so. Assignees stay
 * optional, and crews never change what a task stores, they only pick the same people.
 */
export function ChecklistTechTreeAddTaskModal({
  open,
  groupId,
  groupTitle,
  users,
  currentUserId,
  onClose,
  onSave,
  portalContainer,
  editingTaskId = null,
  initialEditTitle = '',
  initialEditAssigneeUserIds = NO_PRESET_ASSIGNEES,
}: Props) {
  const phone = useIsMobile()
  const titleRef = useRef<HTMLTextAreaElement | null>(null)
  const [title, setTitle] = useState('')
  const [linesText, setLinesText] = useState('')
  const [asksForPhotoPick, setAsksForPhotoPick] = useState<boolean | null>(null)
  // Punch list #328, PR 5: where the work is. Null is a task with no place, the default.
  const [place, setPlace] = useState<TaskPlaceDraft | null>(null)
  // #331: the giver's photo of the spot, held here until the parent has an id to file it under.
  const [spotPhoto, setSpotPhoto] = useState<TaskSpotPhotoDraft | null>(null)
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  /** The rows keep what is open themselves. A new open gives them a new key, so they start closed. */
  const [rowsKey, setRowsKey] = useState(0)
  const isEditMode = Boolean(editingTaskId)
  const recentIds = useRecentTaskAssignees(currentUserId, open)

  useEffect(() => {
    if (!open) return
    if (editingTaskId) {
      setTitle(initialEditTitle)
      setAssigneeIds([...initialEditAssigneeUserIds])
    } else {
      setTitle('')
      setAssigneeIds([])
    }
    setLinesText('')
    setAsksForPhotoPick(null)
    setPlace(null)
    setSpotPhoto(null)
    setRowsKey((k) => k + 1)
  }, [open, groupId, editingTaskId, initialEditTitle, initialEditAssigneeUserIds])

  if (!open || !groupId) return null

  const lines = editingTaskId ? [] : parseLines(linesText)
  const asksForPhoto = asksForPhotoPick ?? asksForPhotoDefault(lines.length)

  const handleSave = async () => {
    const trimmed = title.trim()
    if (!trimmed || saving) return
    setSaving(true)
    try {
      const ok = await onSave(trimmed, assigneeIds, lines, asksForPhoto, place, spotPhoto)
      if (ok) {
        setLinesText('')
        setAsksForPhotoPick(null)
        onClose()
      }
    } finally {
      setSaving(false)
    }
  }

  const target = typeof document !== 'undefined' ? (portalContainer ?? document.body) : null
  if (!target) return null

  const sentence = roadmapTaskSentence({
    title,
    stageTitle: groupTitle,
    assigneeNames: assigneeIds.map((id) => taskPersonName(users.find((u) => u.id === id))),
    lineCount: lines.length,
    asksForPhoto: !isEditMode && asksForPhoto,
    editing: isEditMode,
  })

  return createPortal(
    <TaskWindowShell
      titleId="tech-tree-add-task-modal-title"
      title={isEditMode ? 'Edit task' : 'Add task'}
      subtitle={`Stage: ${groupTitle || '—'}`}
      phone={phone}
      zIndex={ROADMAP_TASK_WINDOW_Z}
      overlayBackground="rgba(0,0,0,0.4)"
      onBackdrop={() => {
        if (!saving) onClose()
      }}
      cardTestId="roadmap-add-task-card"
      headActions={<TaskWindowClose onClose={onClose} />}
      bar={
        <TaskSendBar
          sentence={sentence.text}
          dead={sentence.dead}
          label={isEditMode ? 'Save' : 'Add task'}
          busyLabel={isEditMode ? 'Saving…' : 'Adding…'}
          submitting={saving}
          onSend={() => void handleSave()}
          tellMe={null}
          onTellMe={() => {}}
          error={null}
        />
      }
    >
      <div style={{ paddingBottom: 12 }}>
        <textarea
          ref={titleRef}
          id="tech-tree-add-task-title"
          aria-label="Task"
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value.replace(/\n/g, ' '))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.preventDefault()
          }}
          rows={2}
          placeholder="What needs to be done?"
          disabled={saving}
          style={TASK_WORDS_BOX_STYLE}
        />
      </div>
      <TaskFormRows
        key={rowsKey}
        value={restingTaskFormValue(assigneeIds, todayYmdInAppTz())}
        onChange={(patch) => {
          if (patch.assigned_to_user_ids) setAssigneeIds(patch.assigned_to_user_ids)
        }}
        when="today"
        onWhen={() => {}}
        repeatMode="weekly"
        onRepeatMode={() => {}}
        hideWhen
        // The place and the lines are set when the task is made. A task already on the roadmap changes them on its card.
        hideWhere={isEditMode}
        addKeys={isEditMode ? [] : ROADMAP_ADD_KEYS}
        linesText={linesText}
        onLinesText={setLinesText}
        linesHint={DONE_WHEN_HINT.roadmap}
        asksForPhoto={asksForPhoto}
        onAsksForPhoto={setAsksForPhotoPick}
        place={place}
        onPlace={setPlace}
        spotPhoto={spotPhoto}
        onSpotPhoto={setSpotPhoto}
        busy={saving}
        users={users}
        meId={currentUserId}
        recentIds={recentIds}
        seatIds={isEditMode ? initialEditAssigneeUserIds : NO_PRESET_ASSIGNEES}
        // Nobody is picked when the window opens, and a pick adds a person beside the others.
        soloSelfRule={false}
        canSeeReach={false}
        pushEnabledIds={null}
        phone={phone}
        todayStr={todayYmdInAppTz()}
        searchId="tech-tree-add-task-assign-search"
        onLinkToken={() => {}}
        // The roadmap's windows sit far above Add a task, so the place sheet is told to open above this one.
        pickerZIndex={ROADMAP_TASK_PICKER_Z}
      />
    </TaskWindowShell>,
    target,
  )
}
