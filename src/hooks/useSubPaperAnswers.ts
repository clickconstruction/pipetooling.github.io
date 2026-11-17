/**
 * What subs said back from their pages, for the office's Pay view (punch list #371, step 3): one read of
 * `sub_paper_acks`, and the press that marks a note answered. Only the office roles who see sub pay can read the
 * table, so anyone else gets nothing and the view draws no chip and no flag. A database the answered migration
 * has not reached still shows the chips and the notes, with no press to put a note down.
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllRows } from '../lib/supabasePaging'
import { NO_SUB_PAPER_ANSWERS, subPaperAnswers, SUB_PAPER_ACK_COLUMNS, SUB_PAPER_ACK_COLUMNS_BEFORE_ANSWERED, type SubPaperAckRow, type SubPaperAnswers } from '../lib/subWorkOrders/subPaperAnswers'
import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'
import { formatErrorMessage } from '../utils/errorHandling'

async function readAcks(columns: string): Promise<SubPaperAckRow[]> {
  return fetchAllRows<SubPaperAckRow>((from, to) => supabase.from('sub_paper_acks' as never).select(columns).order('created_at', { ascending: true }).range(from, to) as never, 'sub_paper_acks')
}

export type MarkAnsweredResult = { ok: true } | { ok: false; message: string }

export function useSubPaperAnswers(enabled = true): { answers: SubPaperAnswers; canAnswer: boolean; markAnswered: (ackId: string) => Promise<MarkAnsweredResult> } {
  const [rows, setRows] = useState<SubPaperAckRow[]>([])
  /** False where the answered columns are not on the database yet: the notes show, the press does not. */
  const [canAnswer, setCanAnswer] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void (async () => {
      try {
        const all = await readAcks(SUB_PAPER_ACK_COLUMNS)
        if (!cancelled) {
          setRows(all)
          setCanAnswer(true)
        }
      } catch {
        try {
          const before = await readAcks(SUB_PAPER_ACK_COLUMNS_BEFORE_ANSWERED)
          if (!cancelled) {
            setRows(before)
            setCanAnswer(false)
          }
        } catch {
          // Not readable by this role, or the table is not there: no chip and no flag.
          if (!cancelled) setRows([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, tick])

  const markAnswered = useCallback(async (ackId: string): Promise<MarkAnsweredResult> => {
    const { error } = await supabase.rpc('answer_sub_paper_ack' as never, { p_ack_id: ackId } as never)
    if (error) return { ok: false, message: formatErrorMessage(error, 'the note could not be marked answered') }
    setTick((n) => n + 1)
    return { ok: true }
  }, [])

  const answers = rows.length > 0 ? subPaperAnswers(rows, (iso) => calendarYmdInAppTzFromIso(iso)) : NO_SUB_PAPER_ANSWERS
  return { answers, canAnswer, markAnswered }
}
