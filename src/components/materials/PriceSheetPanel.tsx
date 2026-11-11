/**
 * A supply house's price sheet, beside the takeoff (punch list #308, PR 4). It names the house with
 * its reasons, says the sheet in one line, opens on the rows that need a person, and folds the rest
 * by fixture. Every press saves itself, so the panel can be folded at any point and opened again on
 * what is left, by anyone who may file.
 *
 * Docked, it is a drawer on the right and the page keeps its width beside it. On a narrow window it
 * opens over the page.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { todayYmdChicago } from '../../lib/formatJobDetailModalDateYmd'
import { loadHouseCodes, toHouseCodes, type HouseCodeRow } from '../../lib/materials/houseCodes'
import { indexBook, indexHouseCodes } from '../../lib/materials/partMatch'
import { cardInput, cardLink, cardPress, CHIP_TONE } from '../../lib/materials/priceSheet/cardStyles'
import { filePriceRow, loadBidAskedHouseIds, loadOnFilePrices, takeBackPriceRow } from '../../lib/materials/priceSheet/priceRowIo'
import { discardSheet, holdSheetLine, loadSheet, pickSheetLinePart, setSheet, type LoadedSheet } from '../../lib/materials/priceSheet/priceSheetIo'
import { dollars, shortDay, type OnFilePrice } from '../../lib/materials/priceSheet/rowCard'
import { houseVerdict, type HouseVerdict } from '../../lib/materials/priceSheet/sheetHouse'
import { planSheet, sheetVerdict, type PlannedGroup, type PlannedRow } from '../../lib/materials/priceSheet/sheetPlan'
import { formatErrorMessage } from '../../utils/errorHandling'
import { PriceRowCardView, type CardFileOpts, type KnownPart, type ServerAsk } from './PriceRowCardView'

type House = { id: string; name: string }
const HOW: Record<string, 'crosswalk' | 'mfr_number' | 'description' | 'person'> = { house_number: 'crosswalk', model_number: 'mfr_number', same_name: 'description', words: 'description' }

/** The width the drawer takes on the right, and the window width below which it opens over the page instead. */
export const PRICE_SHEET_DOCK_WIDTH = 452
export const PRICE_SHEET_DOCK_MIN_WINDOW = 1100

const sectionHead: CSSProperties = { fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }

export function PriceSheetPanel({
  paperId,
  bid,
  serviceTypeId,
  supplyHouses,
  knownParts,
  firstRead = null,
  docked,
  initialSheet = null,
  onFold,
  onChanged,
  onGone,
}: {
  paperId: string
  bid: { id: string; label: string } | null
  serviceTypeId: string
  supplyHouses: House[]
  knownParts: KnownPart[]
  /** What the read just now found about the house: the letterhead, and the house whose request it answers. */
  firstRead?: { letterhead: { houseId: string | null; printed: string | null } | null; requestHouseId?: string | null; fileName?: string | null } | null
  docked: boolean
  /** A sheet handed in already loaded (render tests). */
  initialSheet?: LoadedSheet | null
  onFold: () => void
  /** The book's prices changed. */
  onChanged?: () => void
  /** The sheet was removed. */
  onGone: () => void
}) {
  const confirmDialog = useConfirmDialog()
  const [sheet, setSheetState] = useState<LoadedSheet | null>(initialSheet)
  const [loading, setLoading] = useState(initialSheet == null)
  const [problem, setProblem] = useState<string | null>(null)
  const [parts, setParts] = useState<KnownPart[]>(knownParts)
  const [codes, setCodes] = useState<HouseCodeRow[]>([])
  const [askedHouseIds, setAskedHouseIds] = useState<string[]>([])
  const [onFile, setOnFile] = useState<Map<string, OnFilePrice>>(new Map())
  const [serverAsk, setServerAsk] = useState<Record<string, ServerAsk | undefined>>({})
  const [rowProblems, setRowProblems] = useState<Record<string, string | undefined>>({})
  const [working, setWorking] = useState<string | null>(null)
  const [open, setOpen] = useState<Set<number>>(new Set())
  const [otherHouse, setOtherHouse] = useState(false)
  const bidId = bid?.id ?? null

  useEffect(() => setParts(knownParts), [knownParts])

  const reload = useCallback(async () => {
    const [read, codeRead] = await Promise.all([loadSheet(supabase, paperId), loadHouseCodes(supabase)])
    if (!read.ok) setProblem(read.error)
    else if (!read.sheet) onGone()
    else setSheetState(read.sheet)
    setCodes(codeRead.rows)
    setLoading(false)
  }, [paperId, onGone])

  useEffect(() => {
    if (initialSheet) return
    setLoading(true)
    void reload()
  }, [reload, initialSheet])

  useEffect(() => {
    if (!bidId) return
    let cancelled = false
    void loadBidAskedHouseIds(supabase, bidId).then((ids) => {
      if (!cancelled) setAskedHouseIds(ids)
    })
    return () => {
      cancelled = true
    }
  }, [bidId])

  const houseId = sheet?.paper.supplyHouseId ?? null
  const house = supplyHouses.find((h) => h.id === houseId) ?? null
  const datedOn = sheet?.paper.datedOn ?? todayYmdChicago()
  const book = useMemo(() => indexBook(parts.filter((p) => !p.is_robot)), [parts])
  const codeIndex = useMemo(() => indexHouseCodes(toHouseCodes(codes)), [codes])

  // A first plan with no prices on file names the matched parts; their prices are then read and the plan settles.
  const matchedIds = useMemo(() => {
    if (!sheet) return ''
    const first = planSheet(sheet.lines, sheet.groups, { supplyHouseId: houseId, houseName: house?.name ?? null, book, codes: codeIndex, onFile: new Map(), datedOn })
    return [...new Set(first.rows.map((r) => r.match.part?.id).filter((x): x is string => !!x))].sort().join(',')
  }, [sheet, houseId, house, book, codeIndex, datedOn])

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
        if (!cancelled) setProblem(formatErrorMessage(e, 'The prices on file could not be read'))
      })
    return () => {
      cancelled = true
    }
  }, [houseId, matchedIds, sheet])

  const plan = useMemo(
    () => (sheet ? planSheet(sheet.lines, sheet.groups, { supplyHouseId: houseId, houseName: house?.name ?? null, book, codes: codeIndex, onFile, datedOn }) : null),
    [sheet, houseId, house, book, codeIndex, onFile, datedOn],
  )

  // How many of the sheet's item numbers each house already has on file: one of the reasons for the house.
  const codeShare = useMemo(() => {
    if (!sheet) return null
    const keys = new Set(sheet.lines.map((l) => l.houseCode.toUpperCase().replace(/[^A-Z0-9]/g, '')).filter(Boolean))
    if (keys.size === 0) return null
    const byHouse = new Map<string, number>()
    for (const c of codes) if (!c.not_a_part && keys.has(c.code_key)) byHouse.set(c.supply_house_id, (byHouse.get(c.supply_house_id) ?? 0) + 1)
    const best = [...byHouse.entries()].sort((a, b) => b[1] - a[1])[0]
    return best ? { houseId: best[0], known: best[1], total: keys.size } : null
  }, [sheet, codes])

  const verdict: HouseVerdict = useMemo(
    () => houseVerdict({ houses: supplyHouses, letterhead: firstRead?.letterhead ?? null, requestHouseId: firstRead?.requestHouseId ?? null, askedHouseIds, codeShare }),
    [supplyHouses, firstRead, askedHouseIds, codeShare],
  )
  const anyFiled = sheet?.lines.some((l) => l.filedAt) ?? false

  async function settleHouse(id: string) {
    setWorking('house')
    const { error } = await setSheet(supabase, paperId, { supplyHouseId: id })
    if (error) setProblem(error)
    else {
      setOtherHouse(false)
      await reload()
    }
    setWorking(null)
  }

  async function act(key: string, run: () => Promise<{ error: string | null }>) {
    setWorking(key)
    setRowProblems((p) => ({ ...p, [key]: undefined }))
    const { error } = await run()
    if (error) setRowProblems((p) => ({ ...p, [key]: error }))
    else await reload()
    setWorking(null)
  }

  async function fileRow(r: PlannedRow<KnownPart>, part: KnownPart, opts: CardFileOpts = {}) {
    const key = r.line.id
    const asked = serverAsk[key]
    setWorking(key)
    setRowProblems((p) => ({ ...p, [key]: undefined }))
    const res = await filePriceRow(supabase, {
      lineId: r.line.id,
      supplyHouseId: houseId ?? '',
      partId: part.id,
      unitPrice: r.line.unitPrice ?? 0,
      pricingUnit: r.line.pricingUnit,
      unitFactor: opts.unitFactor,
      cameBy: 'sheet',
      bidId,
      matchedHow: r.picked ? 'person' : (HOW[r.match.how] ?? 'person'),
      allowBigMove: opts.allow === true || asked?.why === 'moved',
      allowOlder: opts.allow === true || asked?.why === 'newer_on_file',
    })
    if (!res.ok) setRowProblems((p) => ({ ...p, [key]: res.error }))
    else if (!res.filed) setServerAsk((a) => ({ ...a, [key]: { why: res.why, onFile: res.onFile } }))
    else {
      setServerAsk((a) => ({ ...a, [key]: undefined }))
      await reload()
      onChanged?.()
    }
    setWorking(null)
  }

  async function makeAndFile(r: PlannedRow<KnownPart>, name: string) {
    const key = r.line.id
    setWorking(key)
    setRowProblems((p) => ({ ...p, [key]: undefined }))
    const { data, error } = await supabase.from('material_parts').insert({ name, service_type_id: serviceTypeId }).select('id,name,manufacturer').single()
    if (error || !data) {
      setRowProblems((p) => ({ ...p, [key]: `The part could not be made: ${formatErrorMessage(error, 'it was not saved')}` }))
      setWorking(null)
      return
    }
    const made = data as KnownPart
    setParts((p) => [...p, made])
    await fileRow(r, made)
  }

  async function takeBack(r: PlannedRow<KnownPart>) {
    const key = r.line.id
    setWorking(key)
    const res = await takeBackPriceRow(supabase, r.line.id)
    if (!res.ok) setRowProblems((p) => ({ ...p, [key]: res.error }))
    else if (!res.restored) setRowProblems((p) => ({ ...p, [key]: 'That price was changed since, so it was left as it is.' }))
    else {
      await reload()
      onChanged?.()
    }
    setWorking(null)
  }

  async function removeSheet() {
    const ok = await confirmDialog({
      title: 'Remove this price sheet?',
      message: 'Nothing on it has been filed, so the parts book does not change. The sheet and its rows go.',
      confirmLabel: 'Remove the sheet',
      danger: true,
    })
    if (!ok) return
    setWorking('sheet')
    const { error } = await discardSheet(supabase, paperId)
    if (error) setProblem(error)
    else onGone()
    setWorking(null)
  }

  const where = (r: PlannedRow<KnownPart>) => {
    const g = plan?.groups.find((x) => x.group.groupNo === r.line.groupNo)
    return [g?.group.tag, `row ${r.line.lineNo}`, r.line.page ? `page ${r.line.page}` : null].filter(Boolean).join(' · ')
  }

  const card = (r: PlannedRow<KnownPart>) => (
    <PriceRowCardView
      key={r.line.id}
      row={{ key: r.line.id, houseCode: r.line.houseCode, description: r.line.description, unitPrice: r.line.unitPrice, pricingUnit: r.line.pricingUnit, lines: 1 }}
      house={house}
      match={r.match}
      picked={r.picked}
      priceOnFile={r.match.part ? (onFile.get(r.match.part.id) ?? null) : null}
      datedOn={datedOn}
      serverAsk={serverAsk[r.line.id]}
      problem={rowProblems[r.line.id]}
      busy={working === r.line.id}
      dead={working != null}
      parts={parts}
      where={where(r)}
      noPriceNote="This row has no price of its own. It is priced in its fixture's bundle."
      onFileRow={(part, opts) => void fileRow(r, part, opts)}
      onMakeAndFile={(name) => void makeAndFile(r, name)}
      onPick={(part) => void act(r.line.id, () => pickSheetLinePart(supabase, r.line.id, part.id))}
      onUnpick={() => void act(r.line.id, () => pickSheetLinePart(supabase, r.line.id, null))}
      onLeaveOut={() => void act(r.line.id, () => holdSheetLine(supabase, r.line.id, 'left_out'))}
    />
  )

  function rowLine(r: PlannedRow<KnownPart>) {
    const busy = working != null
    const part = r.match.part
    return (
      <div key={r.line.id} style={{ display: 'grid', gridTemplateColumns: '2.2rem 5rem minmax(0, 1fr) auto', gap: '0.5rem', alignItems: 'start', fontSize: '0.8125rem', padding: '0.3rem 0', borderTop: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--text-muted)' }}>{r.line.qty ?? ''}</span>
        <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.75rem' }}>{r.line.houseCode}</span>
        <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          {part?.name ?? r.line.description}
          <br />
          <span style={{ ...CHIP_TONE[r.card.chip.tone], borderRadius: 999, padding: '0 0.45rem', fontSize: '0.6875rem', fontWeight: 600 }}>{r.bucket === 'charge' ? 'Not a part' : r.card.chip.label}</span>
          {rowProblems[r.line.id] ? <span role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.75rem' }}> {rowProblems[r.line.id]}</span> : null}
        </span>
        <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
          {r.bucket === 'filed' ? (
            <>
              Filed {r.line.filedPrice != null ? dollars(r.line.filedPrice) : ''}{' '}
              <button type="button" disabled={busy} onClick={() => void takeBack(r)} style={cardLink}>
                Undo
              </button>
            </>
          ) : r.bucket === 'left_out' ? (
            <button type="button" disabled={busy} onClick={() => void act(r.line.id, () => holdSheetLine(supabase, r.line.id, ''))} style={cardLink}>
              Bring back
            </button>
          ) : r.bucket === 'charge' || r.line.unitPrice == null ? (
            <span style={{ color: 'var(--text-muted)' }}>in the bundle</span>
          ) : r.bucket === 'ready' && part && r.card.each != null ? (
            <button type="button" disabled={busy} onClick={() => void fileRow(r, part)} style={{ ...cardPress(busy, false), padding: '0.2rem 0.55rem' }}>
              {working === r.line.id ? 'Filing…' : `File ${dollars(r.card.each)}`}
            </button>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>{r.card.each != null ? dollars(r.card.each) : ''}</span>
          )}
        </span>
      </div>
    )
  }

  function fold(g: PlannedGroup<KnownPart>) {
    const isOpen = open.has(g.group.groupNo)
    const waits = g.rows.filter((r) => r.bucket === 'needs_you' || r.bucket === 'confirm').length
    return (
      <div key={g.group.id} style={{ borderTop: '1px solid var(--border)' }}>
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() =>
            setOpen((s) => {
              const next = new Set(s)
              if (next.has(g.group.groupNo)) next.delete(g.group.groupNo)
              else next.add(g.group.groupNo)
              return next
            })
          }
          style={{ display: 'grid', gridTemplateColumns: '1rem minmax(0, 1fr) auto', gap: '0.5rem', alignItems: 'baseline', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '0.5rem 0', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
        >
          <span style={{ color: 'var(--text-muted)' }}>{isOpen ? '▾' : '▸'}</span>
          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
            <strong>{g.group.tag}</strong> <span style={{ color: 'var(--text-700)' }}>{g.group.label}</span>
            <br />
            <span style={{ fontSize: '0.75rem', color: g.addsUp === false || waits ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>
              {g.rows.length === 1 ? '1 row' : `${g.rows.length} rows`}
              {g.addsUp === false && g.rowsSum != null && g.group.eachPrice != null ? ` · the rows add to ${dollars(g.rowsSum)}, the paper says ${dollars(g.group.eachPrice)}` : ''}
              {waits ? ` · ${waits === 1 ? '1 waits' : `${waits} wait`} above` : g.ready ? ' · every row is ready' : ''}
            </span>
          </span>
          <strong style={{ whiteSpace: 'nowrap' }}>{g.group.eachPrice != null ? `${dollars(g.group.eachPrice)} each` : ''}</strong>
        </button>
        {isOpen ? <div style={{ paddingBottom: '0.5rem' }}>{g.rows.map((r) => rowLine(r))}</div> : null}
      </div>
    )
  }

  const shell: CSSProperties = docked
    ? { position: 'fixed', top: 'var(--app-top-chrome, 0px)', right: 0, bottom: 0, width: PRICE_SHEET_DOCK_WIDTH, zIndex: 900, background: 'var(--bg-subtle)', borderLeft: '1px solid var(--border-strong)', boxShadow: '-6px 0 18px rgba(0,0,0,0.08)', overflowY: 'auto', padding: '0.9rem 1rem calc(1rem + env(safe-area-inset-bottom, 0px))' }
    : { position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--bg-subtle)', overflowY: 'auto', padding: 'calc(0.9rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))' }

  const v = plan ? sheetVerdict(plan, sheet?.paper.pages ?? null) : null
  const needs = plan?.rows.filter((r) => r.bucket === 'needs_you') ?? []
  const confirm = plan?.rows.filter((r) => r.bucket === 'confirm') ?? []
  const houseOffers = verdict.offers.map((id) => supplyHouses.find((h) => h.id === id)).filter((h): h is House => !!h)

  return (
    <aside role="complementary" aria-label="Price sheet" data-testid="price-sheet-panel" style={shell}>
      <div style={{ display: 'grid', gap: '0.75rem', alignContent: 'start' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem' }}>
          <strong style={{ fontSize: '1rem', minWidth: 0, overflowWrap: 'anywhere' }}>
            {house ? house.name : 'Price sheet'}
            {sheet?.paper.number ? ` · ${sheet.paper.number}` : ''}
          </strong>
          <button type="button" onClick={onFold} style={{ ...cardLink, fontWeight: 600, whiteSpace: 'nowrap' }}>
            Fold ›
          </button>
        </div>
        {sheet ? (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {[bid?.label, sheet.paper.datedOn ? `dated ${shortDay(sheet.paper.datedOn)}` : 'no day printed', sheet.paper.validUntil ? `good until ${shortDay(sheet.paper.validUntil)}` : null, firstRead?.fileName ?? null].filter(Boolean).join(' · ')}
          </span>
        ) : null}
        {problem ? (
          <div role="alert" style={{ padding: '0.5rem 0.7rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', borderRadius: 4, fontSize: '0.8125rem' }}>
            {problem}
          </div>
        ) : null}
        {loading ? <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Reading the sheet…</span> : null}

        {sheet && plan && v ? (
          <>
            {/* Which house: named with its reasons, asked when they disagree. */}
            {house && !otherHouse ? (
              <div data-testid="price-sheet-house" style={{ padding: '0.55rem 0.7rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, display: 'grid', gap: '0.35rem', fontSize: '0.8125rem' }}>
                <span>
                  This sheet is from <strong>{house.name}</strong>.{' '}
                  {!anyFiled ? (
                    <button type="button" onClick={() => setOtherHouse(true)} style={cardLink}>
                      Another house…
                    </button>
                  ) : null}
                </span>
                {verdict.houseId === house.id && verdict.reasons.length > 0 ? (
                  <span style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                    {verdict.reasons.map((r) => (
                      <span key={r} style={{ ...CHIP_TONE.green, borderRadius: 999, padding: '0 0.5rem', fontSize: '0.6875rem', fontWeight: 600 }}>
                        {r}
                      </span>
                    ))}
                  </span>
                ) : null}
              </div>
            ) : (
              <div data-testid="price-sheet-house" style={{ padding: '0.6rem 0.75rem', background: 'var(--bg-amber-100)', border: '1px solid var(--border-amber)', borderRadius: 8, display: 'grid', gap: '0.45rem', fontSize: '0.8125rem' }}>
                <strong>{verdict.question ?? 'Which house is this sheet from?'}</strong>
                <span style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {houseOffers.map((h, i) => (
                    <button key={h.id} type="button" disabled={working != null} onClick={() => void settleHouse(h.id)} style={cardPress(working != null, i === 0)}>
                      {h.name}
                    </button>
                  ))}
                  <select value="" onChange={(e) => e.target.value && void settleHouse(e.target.value)} disabled={working != null} aria-label="Supply house" style={{ ...cardInput, minWidth: '11rem' }}>
                    <option value="">Another house…</option>
                    {supplyHouses.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </span>
                <span style={{ color: 'var(--text-700)' }}>A price is filed only after you say.</span>
              </div>
            )}

            <div data-testid="price-sheet-verdict" style={{ display: 'grid', gap: '0.35rem', fontSize: '0.8125rem' }}>
              <strong>{v.head}</strong>
              <span style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                {v.chips.map((c) => (
                  <span key={c.label} style={{ ...CHIP_TONE[c.tone], borderRadius: 999, padding: '0.05rem 0.55rem', fontSize: '0.75rem', fontWeight: 600 }}>
                    {c.label}
                  </span>
                ))}
              </span>
              {v.foot ? <span style={{ color: 'var(--text-amber-800)' }}>{v.foot}</span> : null}
            </div>

            {needs.length > 0 ? <span style={sectionHead}>Needs you · {needs.length}</span> : null}
            {needs.map((r) => card(r))}
            {confirm.length > 0 ? <span style={sectionHead}>One look, then file · {confirm.length}</span> : null}
            {confirm.map((r) => card(r))}

            {plan.groups.length > 0 ? (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.2rem 0.7rem 0.4rem' }}>
                <div style={{ ...sectionHead, padding: '0.45rem 0 0.3rem' }}>By fixture · {plan.groups.length}</div>
                {plan.groups.map((g) => fold(g))}
              </div>
            ) : null}
            {plan.loose.length > 0 ? (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.2rem 0.7rem 0.4rem' }}>
                <div style={{ ...sectionHead, padding: '0.45rem 0 0.3rem' }}>Rows under no fixture · {plan.loose.length}</div>
                {plan.loose.map((r) => rowLine(r))}
              </div>
            ) : null}

            {!anyFiled ? (
              <button type="button" disabled={working != null} onClick={() => void removeSheet()} style={{ ...cardLink, justifySelf: 'start', color: 'var(--text-red-700)' }}>
                Remove this sheet…
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </aside>
  )
}
