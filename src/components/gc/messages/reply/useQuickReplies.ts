import { useCallback, useEffect, useState } from 'react'
import { pressQuickReply, type QuickReply } from '../../../../lib/quickReplies/kernel'
import type { QuickRepliesIo } from '../../../../lib/quickReplies/quickRepliesIo'
import { formatErrorMessage } from '../../../../utils/errorHandling'

/**
 * Messages, cut 3's screens: the quick replies the reply box offers, read the first time they are `wanted` (the strip
 * open, or *Find a reply*), so a thread that never uses them reads nothing. A press fills the box and nothing sends;
 * it is counted at once here, so the lines used most move up, and then in the table (`press_quick_reply`). A count the
 * table refuses (a training account, say) leaves the box filled: the count is the strip's order, never the message.
 * After the editor changes a line, `reload` reads them again.
 */
export function useQuickReplies(io: QuickRepliesIo, me: string, wanted: boolean) {
  const [lines, setLines] = useState<QuickReply[] | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [asked, setAsked] = useState(false)

  const load = useCallback(
    () =>
      io.loadLines().then(
        (read) => {
          setLines(read)
          setProblem(null)
        },
        (e: unknown) => setProblem(formatErrorMessage(e, 'The quick replies did not load.')),
      ),
    [io],
  )

  useEffect(() => {
    if (!wanted || asked) return
    setAsked(true)
    void load()
  }, [wanted, asked, load])

  const press = (q: QuickReply, contactId: string | null) => {
    setLines((now) => now?.map((x) => (x.id === q.id ? pressQuickReply(x, me, contactId, Date.now()) : x)) ?? now)
    void io.press(q.id, contactId).catch(() => {})
  }

  /** Reads the lines again once they were read at all; a strip never opened still reads nothing. */
  const reload = () => {
    if (asked) void load()
  }

  return { lines, problem, press, reload }
}
