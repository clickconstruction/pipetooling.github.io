/**
 * Their numbers (punch list #308, PR 2): what each supply house calls one part, shown under the
 * part's prices in the Parts Book and in Takeoffs. A number kept here is how a price sheet from
 * that house finds the part with no press. Draws nothing until `supply_part_codes` is live.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { foldCode } from '../../lib/materials/partMatch'
import { keepHouseCode, loadHouseCodes, numberProblem, partNumberRows, removeHouseCode, type HouseCodeRow } from '../../lib/materials/houseCodes'
import { QuickPriceWindow } from './QuickPriceWindow'

type House = { id: string; name: string }

export function PartHouseNumbers({
  partId,
  supplyHouses,
  pricedHouseIds,
  partName,
  onPricesChanged,
}: {
  partId: string
  supplyHouses: House[]
  pricedHouseIds: string[]
  /** With the part's name, the block offers *A price from a quote or a call…* (punch list #308, PR 3). */
  partName?: string
  /** A price was filed or taken back: read the part's prices again. */
  onPricesChanged?: () => void
}) {
  const [quickPrice, setQuickPrice] = useState(false)
  const [live, setLive] = useState(false)
  const [codes, setCodes] = useState<HouseCodeRow[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [otherHouseId, setOtherHouseId] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const read = await loadHouseCodes(supabase, { partId })
    setLive(read.live)
    setCodes(read.rows)
    if (read.error) setProblem(read.error)
  }, [partId])

  useEffect(() => {
    setDrafts({})
    setOtherHouseId('')
    setProblem(null)
    void reload()
  }, [reload])

  const rows = useMemo(() => partNumberRows(supplyHouses, pricedHouseIds, codes), [supplyHouses, pricedHouseIds, codes])
  const listed = new Set(rows.map((r) => r.supplyHouseId))
  const otherHouses = supplyHouses.filter((h) => !listed.has(h.id))

  async function keep(houseId: string) {
    const typed = (drafts[houseId] ?? '').trim()
    const house = supplyHouses.find((h) => h.id === houseId)
    if (!house) return
    setBusy(houseId)
    setProblem(null)
    // What that house already uses the number for, if anything: one row, read now, so the reason names the part.
    const { data: hit } = await supabase
      .from('supply_part_codes' as never)
      .select('id,supply_house_id,code,code_key,part_id,not_a_part,unit_factor,taught_from, material_parts(name)')
      .eq('supply_house_id', houseId)
      .eq('code_key', foldCode(typed))
      .maybeSingle()
    const taken = hit as unknown as (HouseCodeRow & { material_parts?: { name?: string | null } | null }) | null
    const why = numberProblem(typed, partId, house.name, taken ? [taken] : [], () => taken?.material_parts?.name ?? null)
    if (why) {
      setProblem(why)
      setBusy(null)
      return
    }
    const { error } = await keepHouseCode(supabase, { supplyHouseId: houseId, code: typed, partId })
    if (error) setProblem(error)
    else {
      setDrafts((d) => ({ ...d, [houseId]: '' }))
      if (houseId === otherHouseId) setOtherHouseId('')
      await reload()
    }
    setBusy(null)
  }

  async function takeOff(row: HouseCodeRow) {
    setBusy(row.id)
    setProblem(null)
    const { error } = await removeHouseCode(supabase, row.id)
    if (error) setProblem(error)
    else await reload()
    setBusy(null)
  }

  if (!live) return null

  const field = (houseId: string) => {
    const typed = (drafts[houseId] ?? '').trim()
    const dead = !typed || busy != null
    return (
      <span style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
        <input
          type="text"
          value={drafts[houseId] ?? ''}
          onChange={(e) => setDrafts((d) => ({ ...d, [houseId]: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !dead) {
              e.preventDefault()
              void keep(houseId)
            }
          }}
          placeholder="Their number"
          aria-label={`${supplyHouses.find((h) => h.id === houseId)?.name ?? 'Supply house'}: their number for this part`}
          style={{ width: '8.5rem', padding: '0.25rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem' }}
        />
        <button
          type="button"
          onClick={() => void keep(houseId)}
          disabled={dead}
          style={{ padding: '0.25rem 0.6rem', background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : 'white', border: 'none', borderRadius: 4, cursor: dead ? 'not-allowed' : 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}
        >
          {busy === houseId ? 'Keeping…' : 'Keep'}
        </button>
      </span>
    )
  }

  return (
    <div data-testid="part-house-numbers" style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border)', display: 'grid', gap: '0.5rem' }}>
      {partName ? (
        <div>
          <button type="button" onClick={() => setQuickPrice(true)} style={{ border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', padding: 0, fontSize: '0.8125rem', fontWeight: 600 }}>
            A price from a quote or a call…
          </button>
          {quickPrice ? (
            <QuickPriceWindow
              onClose={() => setQuickPrice(false)}
              serviceTypeId=""
              presetPart={{ id: partId, name: partName }}
              supplyHouses={supplyHouses}
              onChanged={() => {
                void reload()
                onPricesChanged?.()
              }}
            />
          ) : null}
        </div>
      ) : null}
      <div>
        <strong style={{ fontSize: '0.875rem' }}>Their numbers</strong>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}> · what each supply house calls this part. A price sheet finds the part by it.</span>
      </div>
      {problem ? (
        <div role="alert" style={{ padding: '0.45rem 0.65rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', borderRadius: 4, fontSize: '0.8125rem' }}>
          {problem}
        </div>
      ) : null}
      {rows.map((r) => (
        <div key={r.supplyHouseId} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.8125rem' }}>
          <span style={{ minWidth: '9rem', fontWeight: 500 }}>{r.houseName}</span>
          {r.codes.map((c) => (
            <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.1rem 0.25rem 0.1rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 999, background: 'var(--bg-subtle)', fontFamily: 'ui-monospace, Menlo, monospace' }}>
              {c.code}
              <button
                type="button"
                onClick={() => void takeOff(c)}
                disabled={busy != null}
                aria-label={`Take ${c.code} off ${r.houseName}`}
                title={`Take ${c.code} off`}
                style={{ border: 'none', background: 'none', cursor: busy != null ? 'wait' : 'pointer', color: 'var(--text-muted)', padding: '0 0.3rem', fontSize: '0.9rem', lineHeight: 1 }}
              >
                ×
              </button>
            </span>
          ))}
          {field(r.supplyHouseId)}
        </div>
      ))}
      {otherHouses.length > 0 ? (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.8125rem' }}>
          <select
            value={otherHouseId}
            onChange={(e) => setOtherHouseId(e.target.value)}
            aria-label="Another supply house"
            style={{ minWidth: '9rem', padding: '0.25rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem' }}
          >
            <option value="">Another house…</option>
            {otherHouses.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          {otherHouseId ? field(otherHouseId) : null}
        </div>
      ) : null}
    </div>
  )
}
