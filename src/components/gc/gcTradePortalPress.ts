import { createContext, useContext, useState } from 'react'
import type { TradeSubmitKind } from '../../../supabase/functions/_shared/gcTradeSubmit'
import type { TradeFilePlaced } from '../../lib/gc/tradePortalSubmit'

/**
 * GC mode, the trade partner portal (P2b-ii): what a press does. The page provides it: it posts the kind to
 * `submit-gc-trade-portal`, reads the company's slice again when it went through (decision 10), and answers null, or
 * the refusal in the company's words. No provider: the portal reads only, and no press is drawn.
 */
export interface PortalPress {
  send: (kind: TradeSubmitKind, fields?: Record<string, unknown>) => Promise<string | null>
  /**
   * A file into the job's Drive folder (P5a-1): its link, or the refusal in the company's words. It reads nothing again:
   * the kind that stores the link does. `file` is null when the answer carried none (the sample).
   */
  upload: (fields: Record<string, unknown>) => Promise<{ problem: string | null; file: TradeFilePlaced | null }>
  /**
   * The company's master agreement or W-9 opened to sign (P5b-1, `paper_link`): the page goes to `/contract/accept` in
   * the same tab, since Safari on a phone blocks a tab opened after an answer comes back. The refusal in the company's
   * words, or null once it is on its way.
   */
  openPaper: (paper: 'msa' | 'w9') => Promise<string | null>
  /** The office's preview: presses are drawn, and each says nothing is saved. */
  preview: boolean
}

export const PortalPressContext = createContext<PortalPress | null>(null)

export function usePortalPress(): PortalPress | null {
  return useContext(PortalPressContext)
}

/**
 * One control's press: busy while it goes, and the words when it was refused, shown under the control. `runWithFile`
 * (P5a-1) puts the trade's file in Drive first and hands its link to the kind's fields; a refused upload sends nothing
 * else, so what the trade typed stays in the form.
 */
export function usePress(): {
  busy: boolean
  problem: string | null
  run: (kind: TradeSubmitKind, fields?: Record<string, unknown>) => Promise<boolean>
  runWithFile: (upload: Record<string, unknown> | null, kind: TradeSubmitKind, fields: (file: TradeFilePlaced | null) => Record<string, unknown>) => Promise<boolean>
  clear: () => void
} {
  const press = usePortalPress()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const run = async (kind: TradeSubmitKind, fields?: Record<string, unknown>) => {
    if (!press) return false
    setBusy(true)
    setProblem(null)
    try {
      const refused = await press.send(kind, fields)
      setProblem(refused)
      return refused === null
    } finally {
      setBusy(false)
    }
  }
  const runWithFile = async (upload: Record<string, unknown> | null, kind: TradeSubmitKind, fields: (file: TradeFilePlaced | null) => Record<string, unknown>) => {
    if (!press) return false
    setBusy(true)
    setProblem(null)
    try {
      let file: TradeFilePlaced | null = null
      if (upload) {
        const placed = await press.upload(upload)
        if (placed.problem) {
          setProblem(placed.problem)
          return false
        }
        file = placed.file
      }
      const refused = await press.send(kind, fields(file))
      setProblem(refused)
      return refused === null
    } finally {
      setBusy(false)
    }
  }
  return { busy, problem, run, runWithFile, clear: () => setProblem(null) }
}
