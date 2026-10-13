/**
 * Settings → Flows' reminders the app sends itself (Messages, cut 5's screens): the owner's switch per step, the newest
 * morning run and the team's quick replies, read once (`appSendsIo.ts`). A press writes the switch at once, apart from
 * the flow's Save, since it is its own setting under its own policy.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { appSendSetWords } from '../lib/flows/appSends'
import { supabaseAppSendsIo, type AppSendsIo, type AppSendsRead } from '../lib/flows/appSendsIo'
import type { FlowKind } from '../lib/flows/facts'
import { formatErrorMessage } from '../utils/errorHandling'

export interface AppSendsState {
  read: AppSendsRead | null
  problem: string | null
  /** The step being written, as `<kind>:<step id>`. */
  busy: string | null
  /** Turn one step's reminder on or off. Resolves with the toast's words. */
  set: (kind: FlowKind, step: { id: string; name: string }, on: boolean) => Promise<{ ok: boolean; words: string }>
}

export function useAppSends(io?: AppSendsIo): AppSendsState {
  const client = useMemo(() => io ?? supabaseAppSendsIo(), [io])
  const [read, setRead] = useState<AppSendsRead | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const live = useRef(true)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  useEffect(() => {
    void client
      .load()
      .then((r) => {
        if (!live.current) return
        setRead(r)
        setProblem(null)
      })
      .catch((e: unknown) => {
        if (live.current) setProblem(formatErrorMessage(e))
      })
  }, [client])

  const set = useCallback(
    async (kind: FlowKind, step: { id: string; name: string }, on: boolean) => {
      setBusy(`${kind}:${step.id}`)
      try {
        const sends = await client.set(kind, step.id, on)
        if (live.current) setRead((r) => (r ? { ...r, sends } : r))
        return { ok: true, words: appSendSetWords(step.name, on) }
      } catch (e) {
        return { ok: false, words: formatErrorMessage(e) }
      } finally {
        if (live.current) setBusy(null)
      }
    },
    [client],
  )

  return { read, problem, busy, set }
}
