/**
 * The queue behaviour every tile modal shares (v2.2963): which row is open,
 * which rows the office has handled since the modal opened (they turn green
 * and sink, keeping an Undo), and "Next row ↓". The rows come from the live
 * board, so a row the office resolves usually leaves the tile's filter on the
 * next load — the snapshot taken at open keeps it visible as handled.
 */
import { useCallback, useMemo, useState } from 'react'
import type { HandledMark } from './subsTileActions'

export function useQueueState<T>(rows: readonly T[], keyOf: (row: T) => string, goneLabel: string) {
  const [snapshot] = useState<readonly T[]>(() => rows)
  const [handled, setHandled] = useState<ReadonlyMap<string, HandledMark>>(() => new Map())
  const [openKey, setOpenKey] = useState<string | null>(() => (rows[0] ? keyOf(rows[0]) : null))

  const currentKeys = useMemo(() => new Set(rows.map(keyOf)), [rows, keyOf])
  /** Rows still needing the office, in the live order. */
  const pending = useMemo(() => rows.filter((r) => !handled.has(keyOf(r))), [rows, handled, keyOf])
  /** Rows the office handled (marked, or gone from the tile since opening), with their mark. */
  const done = useMemo(() => {
    const out: Array<{ row: T; mark: HandledMark }> = []
    const seen = new Set<string>()
    for (const r of snapshot) {
      const k = keyOf(r)
      const mark = handled.get(k) ?? (!currentKeys.has(k) ? { label: goneLabel } : null)
      if (mark) {
        out.push({ row: rows.find((x) => keyOf(x) === k) ?? r, mark })
        seen.add(k)
      }
    }
    for (const r of rows) {
      const k = keyOf(r)
      if (!seen.has(k) && handled.has(k)) out.push({ row: r, mark: handled.get(k)! })
    }
    return out
  }, [snapshot, rows, handled, currentKeys, keyOf, goneLabel])

  const total = useMemo(() => new Set([...snapshot.map(keyOf), ...rows.map(keyOf)]).size, [snapshot, rows, keyOf])

  const mark = useCallback(
    (key: string, m: HandledMark) => {
      setHandled((prev) => new Map(prev).set(key, m))
      setOpenKey((cur) => (cur === key ? null : cur))
    },
    [],
  )
  const unmark = useCallback((key: string) => {
    setHandled((prev) => {
      const next = new Map(prev)
      next.delete(key)
      return next
    })
  }, [])
  /** Open the next pending row after the current one (wrapping), or the first. */
  const next = useCallback(() => {
    if (pending.length === 0) {
      setOpenKey(null)
      return
    }
    const keys = pending.map(keyOf)
    const i = openKey ? keys.indexOf(openKey) : -1
    setOpenKey(keys[(i + 1) % keys.length] ?? null)
  }, [pending, openKey, keyOf])
  const toggle = useCallback((key: string) => setOpenKey((cur) => (cur === key ? null : key)), [])

  return { pending, done, total, doneCount: done.length, openKey, setOpenKey, toggle, next, mark, unmark }
}
