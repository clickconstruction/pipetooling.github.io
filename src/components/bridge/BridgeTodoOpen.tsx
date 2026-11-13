import { useState } from 'react'
import type { TodoState } from '../../lib/bridge/callTodoState'
import { ChecklistItemEditModal } from '../ChecklistItemEditModal'
import { BridgeTodoWindow, type TodoLinesRead } from './BridgeTodoCheck'

/**
 * What a blue check opens on the Bridge (punch list #334, PR 9): first the small window that says who has the to-do
 * and since when, and from its *Open the to-do* the app's own task window, where the card is edited, handed on or
 * finished. The page reads its checks again when the task window saves or closes.
 */

type Seen = Extract<TodoState, { kind: 'open' | 'covered' | 'done' }>

/** The task window's own list of roles: it is older than the controller's, who reads as no role there. */
type TaskWindowRole = Parameters<typeof ChecklistItemEditModal>[0]['role']

export function BridgeTodoOpen({
  seen,
  onSeenClose,
  todayYmd,
  dayLabel,
  readLines,
  role,
  setError,
  onChanged,
}: {
  /** The check that was pressed; null when none is. */
  seen: Seen | null
  onSeenClose: () => void
  todayYmd: string
  dayLabel: (ymd: string) => string
  readLines: TodoLinesRead
  /** The viewer's role as the page knows it. */
  role: string | null
  setError: (s: string | null) => void
  /** A card was saved or its window closed: the page reads the checks again. */
  onChanged: () => void
}) {
  const [editId, setEditId] = useState<string | null>(null)
  return (
    <>
      {seen && (
        <BridgeTodoWindow
          state={seen}
          todayYmd={todayYmd}
          dayLabel={dayLabel}
          readLines={readLines}
          onClose={onSeenClose}
          onOpen={(itemId) => {
            onSeenClose()
            setEditId(itemId)
          }}
        />
      )}
      {editId && (
        <ChecklistItemEditModal
          itemId={editId}
          role={role === 'controller' ? null : (role as TaskWindowRole)}
          setError={setError}
          onSaved={onChanged}
          onClose={() => {
            setEditId(null)
            onChanged()
          }}
        />
      )}
    </>
  )
}
