/**
 * A supply house's price sheet, beside the takeoff (punch list #308, PR 4). It names the house with
 * its reasons, says the sheet in one line, opens on the rows that need a person, and folds the rest
 * by fixture. Every press saves itself, so the panel can be folded at any point and opened again on
 * what is left, by anyone who may file.
 *
 * Docked, it is a drawer on the right and the page keeps its width beside it. On a narrow window it
 * opens over the page.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject } from 'react'
import { supabase } from '../../lib/supabase'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { batchOutcomeWords, batchWords, countedLabel } from '../../lib/batchWords'
import { todayYmdChicago } from '../../lib/formatJobDetailModalDateYmd'
import { loadHouseCodes, toHouseCodes, type HouseCodeRow } from '../../lib/materials/houseCodes'
import { indexBook, indexHouseCodes } from '../../lib/materials/partMatch'
import { cardInput, cardLink, cardPress, CHIP_TONE } from '../../lib/materials/priceSheet/cardStyles'
import { filePriceRow, loadBidAskedHouseIds, loadOnFilePrices, takeBackPriceRow } from '../../lib/materials/priceSheet/priceRowIo'
import { discardSheet, holdSheetLine, loadSheet, pickSheetLinePart, setSheet, takeBackSheet, type LoadedSheet } from '../../lib/materials/priceSheet/priceSheetIo'
import { dollars, shortDay, type OnFilePrice } from '../../lib/materials/priceSheet/rowCard'
import { assemblyName, countRowName, findSameItemsAssembly, fixtureStatus, type CountRow, type FixtureStatus, type KnownAssembly } from '../../lib/materials/priceSheet/sheetFixtures'
import { loadAssemblies, makeAssembly, recordPlaced, recordUnplaced, restoreBundlePrice, setBundlePrice } from '../../lib/materials/priceSheet/sheetFixturesIo'
import { houseVerdict, type HouseVerdict } from '../../lib/materials/priceSheet/sheetHouse'
import { planSheet, readerWords, sheetVerdict, type PlannedGroup, type PlannedRow } from '../../lib/materials/priceSheet/sheetPlan'
import { formatErrorMessage } from '../../utils/errorHandling'
import { PriceRowCardView, type CardFileOpts, type KnownPart, type ServerAsk } from './PriceRowCardView'

type House = { id: string; name: string }
const HOW: Record<string, 'crosswalk' | 'mfr_number' | 'description' | 'person'> = { house_number: 'crosswalk', model_number: 'mfr_number', same_name: 'description', words: 'description' }

/** The width the drawer takes on the right, and the window width below which it opens over the page instead. */
export const PRICE_SHEET_DOCK_WIDTH = 452
export const PRICE_SHEET_DOCK_MIN_WINDOW = 1100

const ROWS = ['row', 'rows'] as const
const FIXTURES = ['fixture', 'fixtures'] as const

/** What Takeoffs lends the panel so a sheet's fixture can land on the bid (PR 6). */
export type PriceSheetTakeoff = {
  countRows: CountRow[]
  /** How many lines one of the bid's rows has now. */
  lineCount: (countRowId: string) => number
  /** Put one bundle line on a row at this price; with `replace`, the row's own lines go first. Answers the saved line's id. */
  placeBundle: (countRowId: string, templateId: string, unitPrice: number, replace: boolean) => Promise<{ lineId: string } | { error: string }>
  removeLines: (lineIds: string[]) => Promise<{ error: string | null }>
  /** An assembly was made: Takeoffs reads its assemblies again. */
  reloadAssemblies: () => void
}

/** A sheet's fixture offered on the bid's own row, while the panel is open. */
export type PriceSheetRowOffer = { countRowId: string; groupId: string; houseName: string; each: number; parts: number }
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
  takeoff,
  onRowOffers,
  placeRef,
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
  /** With Takeoffs behind it, the panel places a ready fixture on the bid. Without, it files prices only. */
  takeoff?: PriceSheetTakeoff
  /** The ready fixtures, by the bid's row, so Takeoffs can offer each on its own row. */
  onRowOffers?: (offers: PriceSheetRowOffer[]) => void
  /** Filled by the panel: place one fixture, as its own press would. */
  placeRef?: MutableRefObject<((groupId: string) => void) | null>
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
  // One press for many rows: how far it is, and what it did.
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null)
  const [outcome, setOutcome] = useState<{ line: string; tone: 'success' | 'warning' | 'error'; failed: { where: string; why: string }[] } | null>(null)
  // The assemblies on file, so a fixture reuses one with the same items; and the row a person chose for a tag the bid lacks.
  const [assemblies, setAssemblies] = useState<KnownAssembly[]>([])
  const assembliesRef = useRef<KnownAssembly[]>([])
  const [chosenRows, setChosenRows] = useState<Record<number, string[] | undefined>>({})
  const [fixtureProblems, setFixtureProblems] = useState<Record<string, string | undefined>>({})
  const hasTakeoff = takeoff != null
  const bidId = bid?.id ?? null

  useEffect(() => {
    if (!hasTakeoff || !serviceTypeId) return
    let cancelled = false
    loadAssemblies(supabase, serviceTypeId)
      .then((a) => {
        if (cancelled) return
        assembliesRef.current = a
        setAssemblies(a)
      })
      .catch((e) => {
        if (!cancelled) setProblem(formatErrorMessage(e, 'The assemblies could not be read'))
      })
    return () => {
      cancelled = true
    }
  }, [hasTakeoff, serviceTypeId])

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
    if (initialSheet) {
      // The sheet came in hand: only the house numbers are still to be read.
      void loadHouseCodes(supabase).then((r) => setCodes(r.rows))
      return
    }
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

  const statuses = useMemo(() => {
    const m = new Map<string, FixtureStatus>()
    if (!plan || !takeoff) return m
    for (const g of plan.groups) m.set(g.group.id, fixtureStatus({ group: g, countRows: takeoff.countRows, lineCount: takeoff.lineCount, chosenRowIds: chosenRows[g.group.groupNo] }))
    return m
  }, [plan, takeoff, chosenRows])

  // The ready fixtures, by the bid's row, so Takeoffs can offer each on its own row while the panel is open.
  const houseName = house?.name ?? null
  useEffect(() => {
    if (!onRowOffers) return
    const offers: PriceSheetRowOffer[] = []
    if (plan && houseName) {
      for (const g of plan.groups) {
        const st = statuses.get(g.group.id)
        if (!st || st.state !== 'ready' || st.each == null) continue
        for (const r of st.rows) offers.push({ countRowId: r.id, groupId: g.group.id, houseName, each: st.each, parts: st.items.length })
      }
    }
    onRowOffers(offers)
  }, [plan, statuses, houseName, onRowOffers])
  useEffect(() => () => onRowOffers?.([]), [onRowOffers])
  useEffect(() => {
    if (!placeRef) return
    placeRef.current = (groupId: string) => {
      const g = plan?.groups.find((x) => x.group.id === groupId)
      if (g && working == null) void fixtureAct(g, () => placeFixture(g, false))
    }
    return () => {
      placeRef.current = null
    }
  })

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
    // Opened again later, the sheet's words are gone: its letterhead is left out rather than said to name no house.
    () => houseVerdict({ houses: supplyHouses, letterhead: firstRead ? firstRead.letterhead : undefined, requestHouseId: firstRead?.requestHouseId ?? null, askedHouseIds, codeShare }),
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
      unitPrice: r.line.unitPrice,
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

  /**
   * Put one fixture on the bid: an assembly with the same items is reused, else one is made; the subtotal becomes
   * the house's bundle price; one bundle line lands on each of the bid's rows; the sheet remembers it. Answers the
   * reason it could not, or null.
   */
  async function placeFixture(g: PlannedGroup<KnownPart>, replace: boolean): Promise<string | null> {
    const st = statuses.get(g.group.id)
    if (!st || !takeoff || !houseId || st.each == null || st.rows.length === 0) return 'This fixture is not ready to place.'
    const reuse = findSameItemsAssembly(st.items, assembliesRef.current)
    let templateId = reuse?.id ?? null
    let made = false
    if (!templateId) {
      const name = assemblyName(g.group.tag, g.group.label, house?.name ?? '')
      const res = await makeAssembly(supabase, { serviceTypeId, name, description: `From ${house?.name ?? 'a supply house'}'s quote${sheet?.paper.number ? ` ${sheet.paper.number}` : ''}.`, items: st.items })
      if (!res.ok) return res.error
      templateId = res.templateId
      made = true
      assembliesRef.current = [...assembliesRef.current, { id: templateId, name, items: st.items }]
      setAssemblies(assembliesRef.current)
      takeoff.reloadAssemblies()
    }
    const price = Math.round(st.each * 100) / 100
    const bundle = await setBundlePrice(supabase, { templateId, supplyHouseId: houseId, price, datedOn: sheet?.paper.datedOn ?? null })
    if (!bundle.ok) return bundle.error
    const lineIds: string[] = []
    for (const row of st.rows) {
      const res = await takeoff.placeBundle(row.id, templateId, price, replace)
      if ('error' in res) {
        if (lineIds.length) await takeoff.removeLines(lineIds)
        return res.error
      }
      lineIds.push(res.lineId)
    }
    const kept = await recordPlaced(supabase, g.group.id, { templateId, countRowIds: st.rows.map((r) => r.id), placedLineIds: lineIds, bundlePrice: price, replaced: bundle.replaced, madeTemplate: made })
    if (kept.error) {
      await takeoff.removeLines(lineIds)
      return kept.error
    }
    return null
  }

  /** Take one fixture off the bid: its lines go, the bundle price returns to what it was, the sheet forgets it. The assembly stays in the book. */
  async function unplaceFixture(g: PlannedGroup<KnownPart>): Promise<string | null> {
    const gr = g.group
    if (!takeoff) return 'Open the sheet from Takeoffs to take a fixture off.'
    const removed = await takeoff.removeLines(gr.placedLineIds ?? [])
    if (removed.error) return removed.error
    if (gr.templateId && houseId && gr.bundlePrice != null) {
      const back = await restoreBundlePrice(supabase, {
        templateId: gr.templateId,
        supplyHouseId: houseId,
        setPrice: gr.bundlePrice,
        replaced: gr.replacedBundlePrice != null ? { price: gr.replacedBundlePrice, effectiveDate: gr.replacedBundleEffectiveDate ?? null } : null,
      })
      if (back.error) return back.error
    }
    return (await recordUnplaced(supabase, gr.id)).error
  }

  async function fixtureAct(g: PlannedGroup<KnownPart>, run: () => Promise<string | null>) {
    setWorking(`g${g.group.id}`)
    setFixtureProblems((p) => ({ ...p, [g.group.id]: undefined }))
    const why = await run()
    if (why) setFixtureProblems((p) => ({ ...p, [g.group.id]: why }))
    await reload()
    onChanged?.()
    setWorking(null)
  }

  async function placeMany(list: PlannedGroup<KnownPart>[]) {
    setWorking('batch')
    setOutcome(null)
    let done = 0
    const failed: { where: string; why: string }[] = []
    for (const g of list) {
      const why = await placeFixture(g, false)
      if (why) failed.push({ where: g.group.tag || `fixture ${g.group.groupNo}`, why })
      else done += 1
    }
    await reload()
    onChanged?.()
    const words = batchOutcomeWords({ verb: 'Place', past: 'placed', done, failed: failed.length, noun: FIXTURES })
    setOutcome({ line: words.line, tone: words.tone, failed })
    setWorking(null)
  }

  /**
   * File many rows on one press: what is ready goes, a row that fails is named with its reason and the rest go on,
   * and a row the database holds (a big move, a newer price on file) becomes a question on its own card.
   */
  async function fileMany(list: PlannedRow<KnownPart>[], verb: string, past: string) {
    const rows = list.filter((r) => r.match.part)
    if (rows.length === 0) return
    setWorking('batch')
    setOutcome(null)
    setBatch({ done: 0, total: rows.length })
    let done = 0
    let waits = 0
    const failed: { where: string; why: string }[] = []
    for (const [i, r] of rows.entries()) {
      const res = await filePriceRow(supabase, {
        lineId: r.line.id,
        supplyHouseId: houseId ?? '',
        partId: r.match.part!.id,
        unitPrice: r.line.unitPrice,
        pricingUnit: r.line.pricingUnit,
        cameBy: 'sheet',
        bidId,
        matchedHow: r.picked ? 'person' : (HOW[r.match.how] ?? 'person'),
      })
      if (!res.ok) failed.push({ where: `${where(r)} · ${r.match.part!.name}`, why: res.error })
      else if (!res.filed) {
        waits += 1
        setServerAsk((a) => ({ ...a, [r.line.id]: { why: res.why, onFile: res.onFile } }))
      } else done += 1
      setBatch({ done: i + 1, total: rows.length })
    }
    await reload()
    onChanged?.()
    const words = batchOutcomeWords({ verb, past, done, failed: failed.length, noun: ROWS })
    setOutcome({ line: `${words.line}${waits ? ` ${waits === 1 ? '1 waits' : `${waits} wait`} on you: the price moved a lot, or a newer one is on file.` : ''}`, tone: waits && words.tone === 'success' ? 'warning' : words.tone, failed })
    setBatch(null)
    setWorking(null)
  }

  async function takeSheetBack() {
    const filedCount = sheet?.lines.filter((l) => l.filedAt).length ?? 0
    const ok = await confirmDialog({
      title: 'Take this sheet back?',
      message: `${filedCount === 1 ? 'The 1 row' : `The ${filedCount} rows`} this sheet filed ${filedCount === 1 ? 'comes' : 'come'} back, and its fixtures come off the takeoff. Each price returns to what it was before the sheet. A price somebody changed since is left as it is. The sheet stays, so you can file it again.`,
      confirmLabel: countedLabel('Take back', filedCount, ROWS),
      danger: true,
    })
    if (!ok) return
    setWorking('sheet')
    setOutcome(null)
    // Its fixtures come off the takeoff first: a bundle line is never left with no sheet behind it.
    for (const g of plan?.groups ?? []) {
      if (!g.group.placedAt) continue
      const why = await unplaceFixture(g)
      if (why) {
        setProblem(`${g.group.tag} could not be taken off the takeoff: ${why}`)
        await reload()
        setWorking(null)
        return
      }
    }
    const res = await takeBackSheet(supabase, paperId)
    if (!res.ok) setProblem(res.error)
    else {
      await reload()
      onChanged?.()
      setOutcome({
        line: `${res.restored === 1 ? '1 row was' : `${res.restored} rows were`} taken back.${res.left ? ` ${res.left === 1 ? '1 price was' : `${res.left} prices were`} changed since and stay as they are.` : ''}`,
        tone: res.left ? 'warning' : 'success',
        failed: [],
      })
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

  function where(r: PlannedRow<KnownPart>) {
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
      noPricePress
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
    const st = statuses.get(g.group.id)
    const reuse = st ? findSameItemsAssembly(st.items, assemblies) : null
    const busy = working != null
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
        {st ? (
          <div data-testid="price-sheet-fixture" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', padding: '0 0 0.5rem 1.5rem', fontSize: '0.75rem' }}>
            <span style={{ color: st.state === 'placed' ? 'var(--text-green-700)' : st.state === 'ready' ? 'var(--text-700)' : 'var(--text-amber-800)', minWidth: 0, overflowWrap: 'anywhere' }}>
              {st.why}
              {st.state === 'ready' || st.state === 'costed_by_hand' ? (reuse ? ` Reuses ${reuse.name}.` : ' Makes a new assembly.') : ''}
              {fixtureProblems[g.group.id] ? <span role="alert" style={{ color: 'var(--text-red-700)' }}> {fixtureProblems[g.group.id]}</span> : null}
            </span>
            <span style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
              {st.state === 'ready' && st.each != null ? (
                <button type="button" disabled={busy} onClick={() => void fixtureAct(g, () => placeFixture(g, false))} style={{ ...cardPress(busy, false), padding: '0.25rem 0.6rem' }}>
                  {working === `g${g.group.id}` ? 'Placing…' : `Place · ${dollars(st.each)} each`}
                </button>
              ) : null}
              {st.state === 'costed_by_hand' && st.each != null ? (
                <button type="button" disabled={busy} onClick={() => void fixtureAct(g, () => placeFixture(g, true))} style={{ ...cardPress(busy, false), padding: '0.25rem 0.6rem' }}>
                  Use the sheet&apos;s {dollars(st.each)}
                </button>
              ) : null}
              {st.state === 'placed' ? (
                <button type="button" disabled={busy} onClick={() => void fixtureAct(g, () => unplaceFixture(g))} style={cardLink}>
                  Take off
                </button>
              ) : null}
              {(st.state === 'no_row' || chosenRows[g.group.groupNo]) && st.state !== 'placed' && takeoff ? (
                <select
                  value={chosenRows[g.group.groupNo]?.[0] ?? ''}
                  onChange={(e) => setChosenRows((c) => ({ ...c, [g.group.groupNo]: e.target.value ? [e.target.value] : undefined }))}
                  aria-label={`The fixture on this bid for ${g.group.tag}`}
                  style={{ ...cardInput, padding: '0.2rem 0.4rem', fontSize: '0.75rem', maxWidth: '11rem' }}
                >
                  <option value="">It is…</option>
                  {takeoff.countRows.map((r) => (
                    <option key={r.id} value={r.id}>
                      {countRowName(r)}
                    </option>
                  ))}
                </select>
              ) : null}
            </span>
          </div>
        ) : null}
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
  const ready = plan?.rows.filter((r) => r.bucket === 'ready') ?? []
  const placeable = (plan?.groups ?? []).filter((g) => statuses.get(g.group.id)?.state === 'ready')
  const press = batchWords({ verb: 'File', ready: ready.length, held: needs.length + confirm.length, heldWhy: { one: 'waits', many: 'wait' }, noun: ROWS })
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
            {[bid?.label, sheet.paper.datedOn ? `dated ${shortDay(sheet.paper.datedOn)}` : 'no day printed', sheet.paper.validUntil ? `good until ${shortDay(sheet.paper.validUntil)}` : null, firstRead?.fileName ?? null, readerWords(sheet.paper.readBy)].filter(Boolean).join(' · ')}
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

            {house && (ready.length > 0 || batch) ? (
              <div data-testid="price-sheet-batch" style={{ display: 'grid', gap: '0.3rem', position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-subtle)', padding: '0.3rem 0' }}>
                <button type="button" disabled={working != null || press.dead} onClick={() => void fileMany(ready, 'File', 'filed')} style={{ ...cardPress(working != null || press.dead, true), padding: '0.55rem 0.9rem', fontSize: '0.875rem', justifySelf: 'start' }}>
                  {batch ? `Filing ${batch.done} of ${batch.total}…` : press.button}
                </button>
                {press.foot ? <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{press.foot}</span> : null}
              </div>
            ) : null}
            {placeable.length > 0 ? (
              <button type="button" data-testid="price-sheet-place" disabled={working != null} onClick={() => void placeMany(placeable)} style={{ ...cardPress(working != null, ready.length === 0), justifySelf: 'start' }}>
                {countedLabel('Place', placeable.length, FIXTURES)}
              </button>
            ) : null}
            {outcome ? (
              <div role="status" data-testid="price-sheet-outcome" style={{ padding: '0.5rem 0.7rem', borderRadius: 6, fontSize: '0.8125rem', display: 'grid', gap: '0.25rem', background: outcome.tone === 'success' ? 'var(--bg-green-100)' : outcome.tone === 'warning' ? 'var(--bg-amber-100)' : 'var(--bg-red-100)' }}>
                <span>{outcome.line}</span>
                {outcome.failed.map((f) => (
                  <span key={f.where} style={{ color: 'var(--text-700)', overflowWrap: 'anywhere' }}>
                    {f.where}: {f.why}
                  </span>
                ))}
              </div>
            ) : null}

            {needs.length > 0 ? <span style={sectionHead}>Needs you · {needs.length}</span> : null}
            {needs.map((r) => card(r))}
            {confirm.length > 0 ? (
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <span style={sectionHead}>One look, then file · {confirm.length}</span>
                {house ? (
                  <button type="button" disabled={working != null} onClick={() => void fileMany(confirm, 'Confirm', 'confirmed')} style={cardPress(working != null, false)}>
                    {confirm.length === 1 ? 'Confirm 1 as the same part' : `Confirm ${confirm.length} as the same parts`}
                  </button>
                ) : null}
              </div>
            ) : null}
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

            {anyFiled ? (
              <button type="button" disabled={working != null} onClick={() => void takeSheetBack()} style={{ ...cardLink, justifySelf: 'start' }}>
                Take this sheet back…
              </button>
            ) : (
              <button type="button" disabled={working != null} onClick={() => void removeSheet()} style={{ ...cardLink, justifySelf: 'start', color: 'var(--text-red-700)' }}>
                Remove this sheet…
              </button>
            )}
          </>
        ) : null}
      </div>
    </aside>
  )
}
