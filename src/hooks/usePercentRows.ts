/**
 * Bids → Pricing, the Percent row: a row priced as a percent of other rows (Connections at 40%
 * of what the pipe rows sell for). The hook reads each row's rule off the count rows the engine
 * loaded, writes a rule row's price whenever it is not what the rule comes to, and holds the
 * window that makes or changes one. Every number is decided in `lib/bids/percentRow.ts`.
 *
 * The price a rule row carries is an ordinary saved price, written through the Workbench's one
 * price write, so every reader of a bid's prices is unchanged. The Workbench follows only while
 * it may write: the bid unsent and the open price loaded. A sent bid keeps the price it went
 * out with. A refused write is tried once for each answer, never every render.
 *
 * The hook draws nothing. The tab draws the press, the row's chip and the window.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useToastContext } from '../contexts/ToastContext'
import { formatCurrency } from '../lib/format'
import {
  parsePercentRule,
  percentRowDrift,
  percentRuleWords,
  readPercentRowLast,
  writePercentRowLast,
  type PercentBasis,
  type PercentGridRow,
  type PercentRowLast,
  type PercentRule,
  type PercentWindowPreview,
  type PercentWindowValue,
} from '../lib/bids/percentRow'
import { insertPercentCountRow, PERCENT_RULE_NOT_PUSHED, savePercentRule } from '../lib/bids/percentRowIo'
import { rowKindOf, type RowMarksByRowId } from '../lib/bids/rowKinds'
import { supabase } from '../lib/supabase'
import { formatErrorMessage } from '../utils/errorHandling'

/** A grid row as the Workbench derives it over saved prices: the few fields the rule reads. */
export type PercentDerivedRow = {
  countRow: { id: string; fixture: string | null }
  count: number
  revenue: number
  cost: number
  unitPrice: number
  priced: boolean
  isFixedPrice: boolean
}

/** A calculator answer sent to the window: the number, and the rule behind it when there is one. */
export type PercentWindowFrom = { revenue: number; pct: number | null; basis: PercentBasis | null; sourceKey: string | null; words: string }

export type PercentWindowTarget = { rowId: string | null; from: PercentWindowFrom | null }

/** The grid's rows as the rule reads them: each with its kind, its tags and its own rule. Pure. */
export function percentGridRows(rows: ReadonlyArray<PercentDerivedRow>, marks: RowMarksByRowId, rules: Readonly<Record<string, PercentRule | null>>): PercentGridRow[] {
  return rows.map((r) => ({
    id: r.countRow.id,
    name: r.countRow.fixture ?? '',
    kind: rowKindOf(r.countRow.fixture ?? '', marks[r.countRow.id]?.kind).kind,
    tags: marks[r.countRow.id]?.tags ?? [],
    count: r.count,
    revenue: r.revenue,
    cost: r.cost,
    unitPrice: r.unitPrice,
    priced: r.priced,
    isFixedPrice: r.isFixedPrice,
    rule: rules[r.countRow.id] ?? null,
  }))
}

function deviceStorage(): Storage | null {
  try {
    return localStorage
  } catch {
    return null
  }
}

export type PercentRowsArgs = {
  /** The bid on screen; null while the picker shows. */
  bidId: string | null
  /** The version whose count rows are on screen; null on an unsplit bid. */
  bidVersionId: string | null
  /** The price option on screen: a rule row follows the prices of the option that is open. */
  pricingVersionId: string | null
  /** The open version's count rows as the engine loaded them (`select('*')`, so the rule rides on them). */
  pricingCountRows: ReadonlyArray<{ id: string; percent_rule?: unknown }>
  /** The Workbench's rows over saved prices; null until the numbers are settled. */
  derivedRows: ReadonlyArray<PercentDerivedRow> | null
  rowMarks: RowMarksByRowId
  /** The Workbench may write a price by itself now: the bid unsent and the open price loaded. */
  mayFollow: boolean
  /** A price the person asked for may be written now: the open price loaded and its numbers settled. A sent bid under Revise… passes; `guardPricingWrite` has already asked. */
  mayWrite: boolean
  /** The tab's lock: false, with its toast, when a pricing write must not happen. */
  guardPricingWrite: () => boolean
  /** The Workbench's one price write, tagged for the history. */
  writePrice: (countRowId: string, unitPrice: number) => Promise<{ message: string } | null>
  /** After prices land: the overlays reload and the bid takes its own copy of the book. */
  afterPriceWrites: () => Promise<void>
  /** Reloads the bid's count rows and prices. */
  reloadRows: (bidId: string) => Promise<void>
}

export function usePercentRows(args: PercentRowsArgs) {
  const { bidId, bidVersionId, pricingVersionId, pricingCountRows, derivedRows, rowMarks, mayFollow, mayWrite, guardPricingWrite, reloadRows } = args
  const { showToast } = useToastContext()

  // A rule just saved or dropped reads at once, before the rows reload; a reload ends the stand-in.
  const [localRules, setLocalRules] = useState<Record<string, PercentRule | null>>({})
  useEffect(() => {
    setLocalRules({})
  }, [pricingCountRows])

  const rules = useMemo(() => {
    const out: Record<string, PercentRule | null> = {}
    for (const r of pricingCountRows) out[r.id] = parsePercentRule(r.percent_rule)
    return { ...out, ...localRules }
  }, [pricingCountRows, localRules])

  const gridRows = derivedRows ? percentGridRows(derivedRows, rowMarks, rules) : null
  const ruleRowIds = useMemo(() => new Set(Object.keys(rules).filter((id) => rules[id] != null)), [rules])

  // The price the window's press asked for, written once its row is on screen: the one price of a row
  // made with Keep following off, and a rule's first price on a sent bid under Revise…, which never follows.
  const [askedPrices, setAskedPrices] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)
  const [windowTarget, setWindowTarget] = useState<PercentWindowTarget | null>(null)
  const [followed, setFollowed] = useState<Record<string, true>>({})

  const drift = gridRows ? percentRowDrift(gridRows) : []
  const askedDue = gridRows && mayWrite ? gridRows.filter((r) => askedPrices[r.id] != null && !(r.priced && Math.abs(r.unitPrice - askedPrices[r.id]!) < 0.005)) : []
  const following = mayFollow ? drift.filter((d) => !askedDue.some((r) => r.id === d.rowId)) : []
  const wanted = [...following.map((d) => ({ rowId: d.rowId, unitPrice: d.unitPrice, rule: true })), ...askedDue.map((r) => ({ rowId: r.id, unitPrice: askedPrices[r.id]!, rule: r.rule != null }))]
  const wantedKey = wanted.map((w) => `${w.rowId}:${w.unitPrice}`).join('|')

  // The price each row was last sent, so a refused write is not tried again every render.
  const attemptedRef = useRef<Map<string, number>>(new Map())
  const writingRef = useRef(false)
  const latest = useRef({ wanted, writePrice: args.writePrice, afterPriceWrites: args.afterPriceWrites })
  latest.current = { wanted, writePrice: args.writePrice, afterPriceWrites: args.afterPriceWrites }
  const [, setRetick] = useState(0)

  useEffect(() => {
    attemptedRef.current = new Map()
    setAskedPrices({})
    setFollowed({})
  }, [bidId, bidVersionId, pricingVersionId])

  useEffect(() => {
    if (!bidId || wantedKey === '' || writingRef.current) return
    const todo = latest.current.wanted.filter((w) => attemptedRef.current.get(w.rowId) !== w.unitPrice)
    if (todo.length === 0) return
    writingRef.current = true
    void (async () => {
      const landed: string[] = []
      try {
        for (const w of todo) {
          attemptedRef.current.set(w.rowId, w.unitPrice)
          const err = await latest.current.writePrice(w.rowId, w.unitPrice)
          if (!err) landed.push(w.rowId)
        }
        if (landed.length > 0) await latest.current.afterPriceWrites()
      } finally {
        writingRef.current = false
      }
      if (landed.length > 0) {
        setAskedPrices((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !landed.includes(id))))
        const rulesLanded = todo.filter((w) => w.rule && landed.includes(w.rowId)).map((w) => w.rowId)
        if (rulesLanded.length > 0) {
          setFollowed((prev) => ({ ...prev, ...Object.fromEntries(rulesLanded.map((id) => [id, true as const])) }))
          window.setTimeout(() => setFollowed((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !rulesLanded.includes(id)))), 2500)
        }
      }
      // What was wanted may have moved while these wrote: look again.
      setRetick((n) => n + 1)
    })()
  })

  const openNew = useCallback((from: PercentWindowFrom | null = null) => setWindowTarget({ rowId: null, from }), [])
  const openForRow = useCallback((rowId: string, from: PercentWindowFrom | null = null) => setWindowTarget({ rowId, from }), [])
  const closeWindow = useCallback(() => setWindowTarget(null), [])

  const last: PercentRowLast | null = windowTarget ? readPercentRowLast(deviceStorage()) : null

  /** The window's press: a new row, or a rule on a row already here. */
  const submit = useCallback(
    async (value: PercentWindowValue, preview: PercentWindowPreview): Promise<void> => {
      const target = windowTarget
      if (!bidId || !target || preview.hold || !preview.answer || busy) return
      if (!guardPricingWrite()) return
      const name = value.name.trim()
      const rule = preview.ruleToSave
      setBusy(true)
      try {
        // The row the window was opened on, else a row already on the bid under the typed name.
        let rowId = target.rowId ?? preview.target?.id ?? null
        if (rowId == null) {
          const made = await insertPercentCountRow(supabase, { bidId, bidVersionId, name, kind: value.kind, rule })
          if (made.error || !made.id) {
            showToast(made.missing ? PERCENT_RULE_NOT_PUSHED : formatErrorMessage({ message: made.error ?? '' }, `${name} could not be added`), 'error')
            return
          }
          rowId = made.id
        } else {
          const saved = await savePercentRule(supabase, rowId, rule)
          if (saved.error) {
            showToast(saved.missing ? PERCENT_RULE_NOT_PUSHED : formatErrorMessage({ message: saved.error }, `${name}’s rule could not be saved`), 'error')
            return
          }
          setLocalRules((prev) => ({ ...prev, [rowId as string]: rule }))
        }
        setAskedPrices((prev) => ({ ...prev, [rowId as string]: preview.answer!.unitPrice }))
        attemptedRef.current.delete(rowId)
        if (rule) writePercentRowLast(deviceStorage(), { name, kind: value.kind, pct: value.pct.trim(), basis: value.basis, sourceKey: value.sourceKey })
        setWindowTarget(null)
        await reloadRows(bidId)
        const money = `$${formatCurrency(preview.answer.revenue)}`
        showToast(rule ? `${name} is ${percentRuleWords(rule)}: ${money}.${mayFollow ? ' It follows those rows until the bid is sent.' : ''}` : `${name} is ${money}, a typed price.`, 'success')
      } finally {
        setBusy(false)
      }
    },
    [bidId, bidVersionId, windowTarget, busy, mayFollow, guardPricingWrite, reloadRows, showToast],
  )

  /** A price typed over a rule row: the rule is dropped first, so the typed price stands. */
  const dropRuleForTypedPrice = useCallback(
    async (rowId: string, name: string): Promise<boolean> => {
      if (rules[rowId] == null) return true
      const saved = await savePercentRule(supabase, rowId, null)
      if (saved.error) {
        showToast(formatErrorMessage({ message: saved.error }, `${name}’s rule could not be dropped`), 'error')
        return false
      }
      setLocalRules((prev) => ({ ...prev, [rowId]: null }))
      showToast(`${name} no longer follows its rows. The price you typed stands.`, 'info')
      return true
    },
    [rules, showToast],
  )

  return { rules, ruleRowIds, gridRows, drift, followed, busy, last, windowTarget, openNew, openForRow, closeWindow, submit, dropRuleForTypedPrice }
}
