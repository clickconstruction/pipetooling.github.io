/**
 * One price, with no sheet (punch list #308, PR 3): a row pasted from a quote or a mail, or a price
 * typed from a call, filed onto the part it is under the supply house it came from. Each row is one
 * card: the part on file and how it was found, what the book holds now, the one question the row
 * raises, and the press that answers it. Every press saves itself and can be undone.
 *
 * With `presetPart` the part is known (opened from that part's prices), so only the house, the
 * number and the price are asked.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { todayYmdChicago } from '../../lib/formatJobDetailModalDateYmd'
import { loadHouseCodes, toHouseCodes, type HouseCodeRow } from '../../lib/materials/houseCodes'
import { indexBook, indexHouseCodes, matchRow, type PartMatch } from '../../lib/materials/partMatch'
import { loadPartsCatalog } from '../../lib/materials/partsCatalog'
import { allRows, parsePasted, type PastedRow, type PricingUnit } from '../../lib/materials/priceSheet/pastedRow'
import { filePriceRow, loadBidAskedHouseIds, loadOnFilePrices, takeBackPriceRow, type CameBy } from '../../lib/materials/priceSheet/priceRowIo'
import { dollars, type OnFilePrice } from '../../lib/materials/priceSheet/rowCard'
import { cardInput as input, cardLink as link, cardPress as press } from '../../lib/materials/priceSheet/cardStyles'
import { PriceRowCardView, type KnownPart, type ServerAsk } from './PriceRowCardView'
import { formatErrorMessage } from '../../utils/errorHandling'

type House = { id: string; name: string }
type Filed = { key: string; lineId: string; partName: string; houseName: string; price: number; was: OnFilePrice | null; note: string | null }

const LAST_HOUSE_KEY = 'price-sheet:last-house'
const CAME_BY: { key: CameBy; label: string }[] = [
  { key: 'pasted', label: 'A quote' },
  { key: 'phone', label: 'Phone' },
  { key: 'counter', label: 'Counter' },
  { key: 'mail', label: 'Mail' },
  { key: 'website', label: 'Website' },
]
const HOW: Record<string, 'crosswalk' | 'mfr_number' | 'description' | 'person'> = { house_number: 'crosswalk', model_number: 'mfr_number', same_name: 'description', words: 'description' }

function readLastHouse(): string {
  try {
    return window.localStorage.getItem(LAST_HOUSE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function QuickPriceWindow({
  onClose,
  serviceTypeId,
  bid = null,
  presetPart = null,
  supplyHouses,
  knownParts,
  onChanged,
  initialText = '',
}: {
  onClose: () => void
  serviceTypeId: string
  bid?: { id: string; label: string } | null
  presetPart?: { id: string; name: string } | null
  supplyHouses?: House[]
  knownParts?: KnownPart[]
  onChanged?: () => void
  /** A row already in hand: pasted on the tab before the window opened. */
  initialText?: string
}) {
  const [houses, setHouses] = useState<House[]>(supplyHouses ?? [])
  const [parts, setParts] = useState<KnownPart[]>(knownParts ?? [])
  const [codes, setCodes] = useState<HouseCodeRow[]>([])
  const [askedHouseIds, setAskedHouseIds] = useState<string[]>([])
  const [readProblem, setReadProblem] = useState<string | null>(null)
  const [houseId, setHouseId] = useState('')
  const [datedOn, setDatedOn] = useState(todayYmdChicago())
  const [cameBy, setCameBy] = useState<CameBy>(presetPart ? 'phone' : 'pasted')
  const [text, setText] = useState(initialText)
  // With a part already known: the number and the price are typed in their own fields.
  const [theirNumber, setTheirNumber] = useState('')
  const [typedPrice, setTypedPrice] = useState('')
  const [typedUnit, setTypedUnit] = useState<PricingUnit>('each')
  const [onFile, setOnFile] = useState<Map<string, OnFilePrice>>(new Map())
  const [chosen, setChosen] = useState<Record<string, KnownPart>>({})
  const [serverAsk, setServerAsk] = useState<Record<string, ServerAsk | undefined>>({})
  const [gone, setGone] = useState<Set<string>>(new Set())
  const [problems, setProblems] = useState<Record<string, string | undefined>>({})
  const [working, setWorking] = useState<string | null>(null)
  const [filed, setFiled] = useState<Filed[]>([])
  const textRef = useRef<HTMLTextAreaElement>(null)
  const bidId = bid?.id ?? null
  const presetId = presetPart?.id ?? null

  const readCodes = useCallback(async () => {
    const read = await loadHouseCodes(supabase)
    setCodes(read.rows)
    if (read.error) setReadProblem(read.error)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [h, p, asked] = await Promise.all([
          supplyHouses ? Promise.resolve(supplyHouses) : supabase.from('supply_houses').select('id,name').order('name').then((r) => (r.data ?? []) as House[]),
          knownParts || presetId ? Promise.resolve(knownParts ?? []) : loadPartsCatalog<KnownPart>(supabase, serviceTypeId, 'id,name,manufacturer,is_robot'),
          bidId ? loadBidAskedHouseIds(supabase, bidId) : Promise.resolve([]),
        ])
        if (cancelled) return
        setHouses(h)
        setParts(p)
        setAskedHouseIds(asked)
        const last = readLastHouse()
        setHouseId((cur) => cur || (asked.length === 1 ? asked[0]! : h.some((x) => x.id === last) ? last : ''))
      } catch (e) {
        if (!cancelled) setReadProblem(formatErrorMessage(e, 'The parts book could not be read'))
      }
    })()
    void readCodes()
    return () => {
      cancelled = true
    }
  }, [supplyHouses, knownParts, presetId, bidId, serviceTypeId, readCodes])

  const house = houses.find((h) => h.id === houseId) ?? null
  const book = useMemo(() => indexBook(parts.filter((p) => !p.is_robot)), [parts])
  const codeIndex = useMemo(() => indexHouseCodes(toHouseCodes(codes)), [codes])

  const rows = useMemo<(PastedRow & { key: string })[]>(() => {
    if (presetPart) {
      const price = Number(typedPrice)
      if (!typedPrice.trim() || !Number.isFinite(price) || price <= 0) return []
      return [{ key: 'preset', qty: null, houseCode: theirNumber.trim(), description: presetPart.name, unitPrice: price, pricingUnit: typedUnit, extended: null, lines: 1 }]
    }
    return allRows(parsePasted(text))
      .slice(0, 40)
      .map((r, i) => ({ ...r, key: `${i}|${r.houseCode}|${r.description}` }))
  }, [presetPart, typedPrice, theirNumber, typedUnit, text])

  const matches = useMemo(() => {
    const out = new Map<string, { match: PartMatch<KnownPart>; picked: boolean }>()
    for (const r of rows) {
      const pick = presetPart ? ({ id: presetPart.id, name: presetPart.name } as KnownPart) : chosen[r.key]
      if (pick) out.set(r.key, { match: { how: 'same_name', part: pick, rivals: [pick], model: null }, picked: true })
      else out.set(r.key, { match: matchRow({ supplyHouseId: houseId || null, houseCode: r.houseCode, description: r.description }, book, codeIndex), picked: false })
    }
    return out
  }, [rows, chosen, presetPart, houseId, book, codeIndex])

  // What the book holds for the matched parts at this house.
  const matchedIds = useMemo(() => [...new Set([...matches.values()].map((m) => m.match.part?.id).filter((x): x is string => !!x))].sort().join(','), [matches])
  useEffect(() => {
    if (!houseId || !matchedIds) {
      setOnFile(new Map())
      return
    }
    let cancelled = false
    loadOnFilePrices(supabase, houseId, matchedIds.split(','))
      .then((m) => {
        if (!cancelled) setOnFile(m)
      })
      .catch((e) => {
        if (!cancelled) setReadProblem(formatErrorMessage(e, 'The prices on file could not be read'))
      })
    return () => {
      cancelled = true
    }
  }, [houseId, matchedIds, filed.length])

  function pickHouse(id: string) {
    setHouseId(id)
    try {
      if (id) window.localStorage.setItem(LAST_HOUSE_KEY, id)
    } catch {
      // The pick still stands for this window.
    }
  }

  async function file(r: PastedRow & { key: string }, part: KnownPart, opts: { unitFactor?: number; allow?: boolean; made?: string | null } = {}) {
    if (!house || r.unitPrice == null) return
    const m = matches.get(r.key)
    setWorking(r.key)
    setProblems((p) => ({ ...p, [r.key]: undefined }))
    const asked = serverAsk[r.key]
    const res = await filePriceRow(supabase, {
      supplyHouseId: house.id,
      partId: part.id,
      unitPrice: r.unitPrice,
      pricingUnit: r.pricingUnit,
      unitFactor: opts.unitFactor,
      datedOn,
      houseCode: r.houseCode,
      description: r.description,
      cameBy,
      bidId: bid?.id ?? null,
      matchedHow: m && !m.picked ? (HOW[m.match.how] ?? 'person') : 'person',
      allowBigMove: opts.allow === true || asked?.why === 'moved',
      allowOlder: opts.allow === true || asked?.why === 'newer_on_file',
    })
    if (!res.ok) setProblems((p) => ({ ...p, [r.key]: res.error }))
    else if (!res.filed) setServerAsk((a) => ({ ...a, [r.key]: { why: res.why, onFile: res.onFile } }))
    else {
      setFiled((f) => [{ key: r.key, lineId: res.lineId, partName: part.name, houseName: house.name, price: res.price ?? 0, was: res.was, note: opts.made ?? null }, ...f])
      setGone((g) => new Set(g).add(r.key))
      if (presetPart) {
        setTypedPrice('')
        setTheirNumber('')
      }
      await readCodes()
      onChanged?.()
    }
    setWorking(null)
  }

  async function makeAndFile(r: PastedRow & { key: string }, name: string) {
    if (!name) return
    setWorking(r.key)
    setProblems((p) => ({ ...p, [r.key]: undefined }))
    const { data, error } = await supabase.from('material_parts').insert({ name, service_type_id: serviceTypeId }).select('id,name,manufacturer').single()
    if (error || !data) {
      setProblems((p) => ({ ...p, [r.key]: `The part could not be made: ${formatErrorMessage(error, 'it was not saved')}` }))
      setWorking(null)
      return
    }
    const made = data as KnownPart
    setParts((p) => [...p, made])
    setChosen((c) => ({ ...c, [r.key]: made }))
    await file(r, made, { made: `Made the part ${made.name}.` })
  }

  async function undo(f: Filed) {
    setWorking(f.key)
    const res = await takeBackPriceRow(supabase, f.lineId)
    if (!res.ok) setProblems((p) => ({ ...p, [f.key]: res.error }))
    else if (!res.restored) setFiled((list) => list.map((x) => (x.lineId === f.lineId ? { ...x, note: 'That price was changed since, so it was left as it is.' } : x)))
    else {
      setFiled((list) => list.filter((x) => x.lineId !== f.lineId))
      setGone((g) => {
        const next = new Set(g)
        next.delete(f.key)
        return next
      })
      await readCodes()
      onChanged?.()
    }
    setWorking(null)
  }

  const shown = rows.filter((r) => !gone.has(r.key))
  const houseChips = [...askedHouseIds.map((id) => houses.find((h) => h.id === id)).filter((h): h is House => !!h)]

  function card(r: PastedRow & { key: string }) {
    const m = matches.get(r.key)!
    return (
      <PriceRowCardView
        key={r.key}
        row={r}
        house={house}
        match={m.match}
        picked={m.picked}
        fixedPart={presetPart != null}
        priceOnFile={m.match.part ? (onFile.get(m.match.part.id) ?? null) : null}
        datedOn={datedOn}
        serverAsk={serverAsk[r.key]}
        problem={problems[r.key]}
        busy={working === r.key}
        dead={working != null}
        parts={parts}
        onFileRow={(part, opts) => void file(r, part, opts)}
        onMakeAndFile={(name) => void makeAndFile(r, name)}
        onPick={(part) => setChosen((x) => ({ ...x, [r.key]: part }))}
        onUnpick={() =>
          setChosen((x) => {
            const next = { ...x }
            delete next[r.key]
            return next
          })
        }
        onLeaveOut={() => setGone((g) => new Set(g).add(r.key))}
      />
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1320, padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
      <div role="dialog" aria-modal="true" aria-label="One price" style={{ background: 'var(--surface)', borderRadius: 8, width: 'min(680px, 100%)', maxHeight: 'min(92vh, 100%)', overflow: 'auto', padding: '1.25rem 1.5rem', display: 'grid', gap: '0.8rem', alignContent: 'start' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{presetPart ? 'A price for this part' : 'One price'}</h2>
          <button type="button" onClick={onClose} style={press(false, false)}>
            Close
          </button>
        </div>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-700)', overflowWrap: 'anywhere' }}>
          {presetPart ? <strong>{presetPart.name}</strong> : 'Paste a row from a quote or a mail, or type one: the house’s number, the words and the price.'}
          {bid && !presetPart ? ` For ${bid.label}.` : ''}
        </p>
        {readProblem ? (
          <div role="alert" style={{ padding: '0.5rem 0.7rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', borderRadius: 4, fontSize: '0.875rem' }}>
            {readProblem}
          </div>
        ) : null}

        <div style={{ display: 'grid', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Which supply house?</span>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {houseChips.map((h) => (
              <button key={h.id} type="button" onClick={() => pickHouse(h.id)} aria-pressed={houseId === h.id} style={press(false, houseId === h.id)}>
                {h.name} · asked on this bid
              </button>
            ))}
            <select value={houseChips.some((h) => h.id === houseId) ? '' : houseId} onChange={(e) => pickHouse(e.target.value)} aria-label="Supply house" style={{ ...input, minWidth: '12rem' }}>
              <option value="">{houseChips.length ? 'Another house…' : 'Pick a supply house…'}</option>
              {houses.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.8125rem', fontWeight: 600 }}>
            Dated
            <input type="date" value={datedOn} onChange={(e) => setDatedOn(e.target.value || todayYmdChicago())} style={input} />
          </label>
          <div style={{ display: 'grid', gap: '0.2rem', fontSize: '0.8125rem', fontWeight: 600 }}>
            From
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
              {CAME_BY.map((x) => (
                <button key={x.key} type="button" onClick={() => setCameBy(x.key)} aria-pressed={cameBy === x.key} style={{ ...press(false, cameBy === x.key), padding: '0.3rem 0.6rem', fontWeight: 500 }}>
                  {x.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {presetPart ? (
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'end' }}>
            <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.8125rem', fontWeight: 600 }}>
              Their number
              <input type="text" value={theirNumber} onChange={(e) => setTheirNumber(e.target.value)} placeholder="Optional" style={{ ...input, width: '9rem' }} />
            </label>
            <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.8125rem', fontWeight: 600 }}>
              Price
              <input type="number" step="0.01" min="0" value={typedPrice} onChange={(e) => setTypedPrice(e.target.value)} autoFocus style={{ ...input, width: '7rem' }} />
            </label>
            <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.8125rem', fontWeight: 600 }}>
              Priced
              <select value={typedUnit} onChange={(e) => setTypedUnit(e.target.value as PricingUnit)} style={input}>
                <option value="each">each</option>
                <option value="per_hundred">by the hundred</option>
                <option value="per_thousand">by the thousand</option>
              </select>
            </label>
          </div>
        ) : (
          <textarea
            ref={textRef}
            autoFocus
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setGone(new Set())
              setServerAsk({})
            }}
            rows={Math.min(8, Math.max(2, text.split('\n').length))}
            placeholder="512207  AX8802XL-LR-PC ARLO SUPPLY KIT  18.40"
            aria-label="A row from a quote or a mail"
            style={{ ...input, width: '100%', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.8125rem', resize: 'vertical' }}
          />
        )}

        {filed.map((f) => (
          <div key={f.lineId} role="status" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', justifyContent: 'space-between', padding: '0.45rem 0.7rem', background: 'var(--bg-green-100)', borderRadius: 6, fontSize: '0.8125rem' }}>
            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
              Filed: {f.partName} at {dollars(f.price)} each under {f.houseName}.{f.was ? ` It was ${dollars(f.was.price)}.` : ''}
              {f.note ? ` ${f.note}` : ''}
            </span>
            <button type="button" disabled={working != null} onClick={() => void undo(f)} style={{ ...link, fontWeight: 600 }}>
              Undo
            </button>
          </div>
        ))}

        {shown.map((r) => card(r))}
        {!presetPart && text.trim() && rows.length === 0 ? (
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>That does not read as a row yet. A row needs its words and a number or a price.</span>
        ) : null}
      </div>
    </div>
  )
}
