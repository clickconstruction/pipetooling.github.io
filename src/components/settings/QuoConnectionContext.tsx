/**
 * The Quo connection shared by three cards on Settings → Phone and texts (v2.5718): the Quo connection card saves the
 * key and reads Quo's lists once, and Company phone seats and Inboxes under it read the same lists for their pickers.
 * One read per opening of the tab, for the owner or a dev (`enabled`); everyone else, and a card rendered on its own,
 * gets the `off` state and types ids by hand as before. The states and the words are `quo/connection.ts`'s.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { connectionState, type QuoConnectionState, type QuoDirectory, type QuoKeyStatus } from '../../lib/quo/connection'
import { supabaseQuoConnectionIo, type QuoConnectionIo } from '../../lib/quo/connectionIo'
import { formatErrorMessage } from '../../utils/errorHandling'

export interface QuoConnectionValue {
  /** `off`: no provider, or not the owner or a dev; the cards type ids by hand. */
  state: QuoConnectionState | 'off'
  status: QuoKeyStatus | null
  directory: QuoDirectory | null
  /** Why the last read failed, in words; null otherwise. */
  problem: string | null
  saving: boolean
  /** The key into Vault, then Quo's lists again. Rejects with the function's words. */
  saveKey(key: string): Promise<void>
  /** Quo's lists again, after a failed read. */
  readAgain(): Promise<void>
}

const OFF: QuoConnectionValue = {
  state: 'off',
  status: null,
  directory: null,
  problem: null,
  saving: false,
  saveKey: async () => undefined,
  readAgain: async () => undefined,
}

const QuoConnectionContext = createContext<QuoConnectionValue>(OFF)

export function useQuoConnection(): QuoConnectionValue {
  return useContext(QuoConnectionContext)
}

const DEFAULT_IO = supabaseQuoConnectionIo()

export function QuoConnectionProvider({ io = DEFAULT_IO, enabled, children }: { io?: QuoConnectionIo; enabled: boolean; children: ReactNode }) {
  const [status, setStatus] = useState<QuoKeyStatus | null>(null)
  const [directory, setDirectory] = useState<QuoDirectory | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const readDirectory = useCallback(async () => {
    setProblem(null)
    try {
      setDirectory(await io.directory())
    } catch (e) {
      setDirectory(null)
      setProblem(formatErrorMessage(e))
    }
  }, [io])

  useEffect(() => {
    if (!enabled) return
    let live = true
    setStatus(null)
    setDirectory(null)
    setProblem(null)
    io.status().then(
      async (s) => {
        if (!live) return
        setStatus(s)
        if (s.set) await readDirectory()
      },
      (e: unknown) => live && setProblem(formatErrorMessage(e)),
    )
    return () => {
      live = false
    }
  }, [enabled, io, readDirectory])

  const saveKey = useCallback(
    async (key: string) => {
      setSaving(true)
      try {
        const s = await io.save(key)
        setStatus(s)
        if (s.set) await readDirectory()
        else setDirectory(null)
      } finally {
        setSaving(false)
      }
    },
    [io, readDirectory],
  )

  const value = useMemo<QuoConnectionValue>(() => {
    if (!enabled) return OFF
    return { state: connectionState(status, directory, problem !== null), status, directory, problem, saving, saveKey, readAgain: readDirectory }
  }, [enabled, status, directory, problem, saving, saveKey, readDirectory])

  return <QuoConnectionContext.Provider value={value}>{children}</QuoConnectionContext.Provider>
}
