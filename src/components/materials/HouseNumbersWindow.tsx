/**
 * House numbers (punch list #308, PR 2): the Parts Book's window on `supply_part_codes`. It says how
 * many numbers are on file for each supply house, and offers the numbers people already wrote into
 * part names and notes. Each is kept on a press, one at a time or all the ready ones together; a
 * number whose house cannot be told is held with its reason.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { batchOutcomeWords, countedLabel } from '../../lib/batchWords'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { houseNumberOffers, keepHouseCode, loadHouseCodes, type HouseCodeRow, type NumberOffer } from '../../lib/materials/houseCodes'
import { loadWholePartPricesCatalog, loadWholePartsCatalog } from '../../lib/materials/partsCatalog'
import { formatErrorMessage } from '../../utils/errorHandling'
import { EmptyState } from '../EmptyState'

type House = { id: string; name: string }
type PartRow = { id: string; name: string; notes: string | null; is_robot: boolean | null }
type PriceRow = { part_id: string; supply_house_id: string }

const NUMBERS = ['number', 'numbers'] as const

export function HouseNumbersWindow({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [readProblem, setReadProblem] = useState<string | null>(null)
  const [live, setLive] = useState(true)
  const [houses, setHouses] = useState<House[]>([])
  const [parts, setParts] = useState<PartRow[]>([])
  const [prices, setPrices] = useState<PriceRow[]>([])
  const [codes, setCodes] = useState<HouseCodeRow[]>([])
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [working, setWorking] = useState(false)
  const [outcome, setOutcome] = useState<{ line: string; head: string | null; failed: { offer: NumberOffer; why: string }[] } | null>(null)
  const [showHeld, setShowHeld] = useState(false)

  const read = useCallback(async () => {
    setLoading(true)
    setReadProblem(null)
    try {
      const [h, p, pr, c] = await Promise.all([
        supabase.from('supply_houses').select('id,name').order('name'),
        loadWholePartsCatalog<PartRow>(supabase, 'id,name,notes,is_robot'),
        loadWholePartPricesCatalog<PriceRow>(supabase, 'part_id,supply_house_id', { column: 'part_id' }),
        loadHouseCodes(supabase),
      ])
      if (h.error) throw h.error
      setHouses((h.data ?? []) as House[])
      setParts(p.filter((x) => !x.is_robot))
      setPrices(pr)
      setLive(c.live)
      setCodes(c.rows)
      if (c.error) setReadProblem(c.error)
    } catch (e) {
      setReadProblem(formatErrorMessage(e, 'The parts book could not be read'))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void read()
  }, [read])

  const houseName = useMemo(() => new Map(houses.map((h) => [h.id, h.name])), [houses])
  const { offers, held } = useMemo(() => {
    const priced = new Map<string, string[]>()
    for (const r of prices) {
      const list = priced.get(r.part_id)
      if (list) list.push(r.supply_house_id)
      else priced.set(r.part_id, [r.supply_house_id])
    }
    return houseNumberOffers(parts, priced, codes)
  }, [parts, prices, codes])
  const key = (o: NumberOffer) => `${o.partId}|${o.supplyHouseId}|${o.code}`
  const ready = offers.filter((o) => !skipped.has(key(o)))
  const onFileByHouse = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of codes) m.set(c.supply_house_id, (m.get(c.supply_house_id) ?? 0) + 1)
    return [...m.entries()].map(([id, n]) => ({ name: houseName.get(id) ?? 'A supply house', n })).sort((a, b) => b.n - a.n)
  }, [codes, houseName])

  /** Keep the given offers one by one: a number that fails is named with its reason and the rest go on. */
  async function keep(list: NumberOffer[]) {
    setWorking(true)
    setOutcome(null)
    const failed: { offer: NumberOffer; why: string }[] = []
    const kept: HouseCodeRow[] = []
    for (const o of list) {
      const { row, error } = await keepHouseCode(supabase, { supplyHouseId: o.supplyHouseId, code: o.code, partId: o.partId, taughtFrom: o.from })
      if (row) kept.push(row)
      else failed.push({ offer: o, why: error ?? 'It was not kept.' })
    }
    setCodes((prev) => [...prev, ...kept])
    const words = batchOutcomeWords({ verb: 'Keep', past: 'kept', done: kept.length, failed: failed.length, noun: NUMBERS })
    setOutcome({ line: words.line, head: words.head, failed })
    setWorking(false)
  }

  const dead = ready.length === 0 || working
  const cell: React.CSSProperties = { padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top', fontSize: '0.8125rem' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
      <div role="dialog" aria-modal="true" aria-label="House numbers" style={{ background: 'var(--surface)', borderRadius: 8, width: 'min(860px, 100%)', maxHeight: 'min(90vh, 100%)', overflow: 'auto', padding: '1.25rem 1.5rem', display: 'grid', gap: '0.85rem', alignContent: 'start' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem' }}>
          <h2 style={{ margin: 0 }}>House numbers</h2>
          <button type="button" onClick={onClose} style={{ padding: '0.4rem 0.9rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>
            Close
          </button>
        </div>
        <p style={{ margin: 0, color: 'var(--text-700)', fontSize: '0.875rem' }}>
          A supply house prints its own number for a part on every quote and bill. Kept on the part once, that number finds the part the next time, however the house words the name.
        </p>
        {readProblem ? (
          <div role="alert" style={{ padding: '0.6rem 0.75rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', borderRadius: 4, fontSize: '0.875rem' }}>
            {readProblem}
          </div>
        ) : null}
        {loading ? (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Reading the parts book…</p>
        ) : !live ? (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>House numbers are not switched on yet. They arrive with the next database update.</p>
        ) : (
          <>
            <div style={{ fontSize: '0.875rem' }}>
              <strong>{codes.length === 1 ? '1 number on file.' : `${codes.length} numbers on file.`}</strong>{' '}
              <span style={{ color: 'var(--text-muted)' }}>{onFileByHouse.map((h) => `${h.name} ${h.n}`).join(' · ')}</span>
            </div>

            {outcome ? (
              <div role="status" style={{ padding: '0.6rem 0.75rem', background: outcome.failed.length ? 'var(--bg-amber-100)' : 'var(--bg-green-100)', borderRadius: 4, fontSize: '0.875rem', display: 'grid', gap: '0.3rem' }}>
                <span>{outcome.line}</span>
                {outcome.failed.map((f) => (
                  <span key={key(f.offer)} style={{ color: 'var(--text-700)' }}>
                    {f.offer.code} on {f.offer.partName}: {f.why}
                  </span>
                ))}
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '0.9375rem' }}>Found in names and notes</strong>
              <button
                type="button"
                onClick={() => void keep(ready)}
                disabled={dead}
                style={{ padding: '0.45rem 0.9rem', background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : 'white', border: 'none', borderRadius: 4, cursor: dead ? 'not-allowed' : 'pointer', fontWeight: 600 }}
              >
                {working ? 'Keeping…' : countedLabel('Keep', ready.length, NUMBERS)}
              </button>
              {held.length > 0 ? (
                <button type="button" onClick={() => setShowHeld((v) => !v)} style={{ border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', padding: 0, fontSize: '0.8125rem' }}>
                  {held.length} held {showHeld ? '▾' : '▸'}
                </button>
              ) : null}
            </div>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              A number at the head of a part&apos;s name, or a note that is one number, is offered when one house alone prices the part. Look down the list, take out any that is not a house&apos;s number, then keep the rest.
            </p>

            {ready.length === 0 ? (
              <EmptyState compact main="Nothing waiting on a number." tail="Type one under a part's prices any time." />
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.3rem 0.5rem' }}>Number</th>
                    <th style={{ padding: '0.3rem 0.5rem' }}>Supply house</th>
                    <th style={{ padding: '0.3rem 0.5rem' }}>Part</th>
                    <th style={{ padding: '0.3rem 0.5rem' }}>From</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {ready.slice(0, 200).map((o) => (
                    <tr key={key(o)}>
                      <td style={{ ...cell, fontFamily: 'ui-monospace, Menlo, monospace' }}>{o.code}</td>
                      <td style={cell}>{houseName.get(o.supplyHouseId) ?? 'A supply house'}</td>
                      <td style={{ ...cell, overflowWrap: 'anywhere' }}>{o.partName}</td>
                      <td style={{ ...cell, color: 'var(--text-muted)' }}>{o.from === 'name' ? 'its name' : 'its notes'}</td>
                      <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => setSkipped((s) => new Set(s).add(key(o)))}
                          disabled={working}
                          style={{ border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', padding: 0, fontSize: '0.8125rem' }}
                        >
                          Not a house&apos;s number
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {ready.length > 200 ? <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>The first 200 of {ready.length} are shown. The press keeps all {ready.length}.</p> : null}

            {showHeld && held.length > 0 ? (
              <div style={{ display: 'grid', gap: '0.25rem', fontSize: '0.8125rem', padding: '0.6rem 0.75rem', background: 'var(--bg-subtle)', borderRadius: 4 }}>
                <strong>Held, with the reason</strong>
                {held.slice(0, 200).map((h) => (
                  <span key={`${h.partId}|${h.code}`} style={{ overflowWrap: 'anywhere' }}>
                    <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{h.code}</span> · {h.partName} · <span style={{ color: 'var(--text-muted)' }}>{h.why}</span>
                  </span>
                ))}
                <span style={{ color: 'var(--text-muted)' }}>Open a held part&apos;s prices and type the number beside the right house.</span>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
