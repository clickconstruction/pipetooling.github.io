import { useEffect, useMemo, useRef, useState, type Dispatch } from 'react'
import {
  OUR_TRADES,
  SET_KINDS,
  TRADE_TEMPLATES,
  currentRev,
  activitiesTouched,
  answeredNotInSet,
  openQuestions,
  changeOrderFromSet,
  changeOrderTakingTheDays,
  changeOrderPrice,
  defaultSetKind,
  guessLineSheets,
  pushSchedule,
  scheduleFloat,
  weekdayDate,
  money,
  nextSetLabel,
  packagesForSheets,
  packagesFromDrafts,
  planEmail,
  planLabel,
  planRecipients,
  sheetAsIndexed,
  sheetsAtRev,
  sheetsInText,
  questionInNote,
  tradesForSheets,
  tradeForSpec,
  guessLineSpecs,
  linesATradeHears,
  packagesForSpecs,
  specsAtRev,
  specsInText,
  tradesForPlans,
  indexDiff,
  linesLeftBehind,
  sampleReissue,
  sampleReissueSpecs,
  sheetIndexInText,
  rowProblems,
  scopeBook,
  sheetsOfRows,
  type SheetIndexRow,
  specIndexInText,
  takenOutInText,
  ourPeople,
  preBidMinutesLine,
  substantialCompletionOn,
  scheduleSetLines,
  withNewLines,
  withTradesInOrder,
  type SpecSection,
  usualScope,
  usualExcludes,
  inSentence,
  type GcAction,
  type GcProject,
  type GcState,
  type PlanSheet,
} from '../../lib/gcMode/gcModel'
import { ScopeLines, type ScopeLineDraft } from './GcNewProject'
import { GcNewProjectQuestions } from './GcNewProjectQuestions'
import { GcNewProjectPreBid } from './GcNewProjectPreBid'
import { Btn, Chip, input } from './gcUi'
import { Picker } from './GcNewProjectPickers'
import { FIELD_HEIGHT_PX, pickerFace, pickerGroup, pickerRow } from './GcNewProjectPickerRows'
import { SheetIndexTable } from './GcNewProjectSheetIndex'
import { BookLineSearch } from './GcNewProjectScopeBook'

/**
 * GC mode design spike: a new set of plans came in. Four steps on one page, each feeding the
 * next. 1: name the set and paste what changed. 2: what it changes: the sheets read out of the
 * notes (a sheet new to the index gets its title), the trades guessed from them, and any trade
 * the job did not have that the set brings. 3: who hears about it (every company bidding while we
 * bid, only the companies on the job once it is ours). 4: the email each one gets, in two
 * versions: it changes your trade, or it does not. Nothing is really sent from the prototype.
 */

interface Props {
  state: GcState
  project: GcProject
  dispatch: Dispatch<GcAction>
  onClose: () => void
}

/** The checker list's last choice: someone not on it, typed in. */
const OTHER = '__other'

/** A trade the set brings, as the office is filling it in. */
interface BroughtTrade {
  trade: string
  budget: string
  ours: boolean
  scope: ScopeLineDraft[]
}

function StepHeading({ n, title, hint }: { n: number; title: string; hint: string }) {
  return (
    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '0.45rem' }}>
      <span
        style={{
          display: 'inline-flex',
          width: '1.5rem',
          height: '1.5rem',
          borderRadius: '50%',
          background: '#2563eb',
          color: 'white',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: '0.85rem',
          flexShrink: 0,
        }}
      >
        {n}
      </span>
      <strong>{title}</strong>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{hint}</span>
    </div>
  )
}

function pill(active: boolean) {
  return {
    padding: '0.25rem 0.65rem',
    borderRadius: 999,
    border: `1px solid ${active ? 'var(--text-blue-500)' : 'var(--border-strong)'}`,
    background: active ? 'var(--bg-blue-tint)' : 'var(--surface)',
    color: active ? 'var(--text-blue-500)' : 'var(--text-600)',
    cursor: 'pointer',
    fontSize: '0.85rem',
  } as const
}

/**
 * The Plans tab's two doors: a new set came in, and the questions about the plans. A bid we lost
 * has neither (the owner, 2026-10-03): nobody is open on it, so its plans stay only to read.
 */
export function GcPlansDoors({ state, project, dispatch }: Omit<Props, 'onClose'>) {
  const [adding, setAdding] = useState(false)
  const [asking, setAsking] = useState(false)
  const [meeting, setMeeting] = useState(false)
  if (project.lostOn) {
    return (
      <div style={{ padding: '0.55rem 0.75rem', borderRadius: 8, background: 'var(--bg-muted)', color: 'var(--text-600)', fontSize: '0.9rem' }}>
        We lost this bid. Nothing goes out.
      </div>
    )
  }
  const open = openQuestions(project).length
  return (
    <>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Btn kind="primary" onClick={() => setAdding(true)}>A new set of plans came in</Btn>
        <Btn onClick={() => setAsking(true)}>Questions about the plans{open > 0 ? ` · ${open} open` : ''}</Btn>
        {(project.stage === 'pursuing' || project.preBid) && (
          <Btn onClick={() => setMeeting(true)}>
            {project.preBid ? `Pre-bid meeting · ${weekdayDate(project.preBid.on)}` : 'Set a pre-bid meeting'}
          </Btn>
        )}
      </div>
      {adding && <GcNewPlansWindow state={state} project={project} dispatch={dispatch} onClose={() => setAdding(false)} />}
      {asking && <GcNewProjectQuestions state={state} project={project} dispatch={dispatch} onClose={() => setAsking(false)} />}
      {meeting && <GcNewProjectPreBid state={state} project={project} dispatch={dispatch} onClose={() => setMeeting(false)} />}
    </>
  )
}

export function GcNewPlansWindow({ state, project, dispatch, onClose }: Props) {
  const [kind, setKind] = useState(defaultSetKind(project))
  /** Null: the name follows the kind. A string: the office typed its own. */
  const [labelText, setLabelText] = useState<string | null>(null)
  const label = (labelText ?? nextSetLabel(project, kind)).trim()
  const [note, setNote] = useState('')
  /** Who on our team checked the files: a name from the list, OTHER and a typed name, or none yet. */
  const [checker, setChecker] = useState('')
  const [checkerTyped, setCheckerTyped] = useState('')
  // The notes box takes the cursor without scrolling, so the set's name stays in view on a short screen.
  const noteBox = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    noteBox.current?.focus({ preventScroll: true })
  }, [])
  /** Null: follow what the notes say. A list: the office has taken over. */
  const [sheetText, setSheetText] = useState<string | null>(null)
  const [titles, setTitles] = useState<Record<string, string>>({})
  /** The spec sections, the same way: null follows the notes, a string is the office's own list. */
  const [specText, setSpecText] = useState<string | null>(null)
  const [specTitles, setSpecTitles] = useState<Record<string, string>>({})
  /** A whole new set: its sheets (from its PDF, a paste or typing) and table of contents as pasted, compared with what we have. */
  const [indexRows, setIndexRows] = useState<SheetIndexRow[]>([])
  const [tocText, setTocText] = useState('')
  /** Sheets and sections the office marked taken out or kept, by number (a section as "spec:09 30 13"). */
  const [goneMarks, setGoneMarks] = useState<Record<string, boolean>>({})
  /** What a line left with nothing to read reads now, by "line id|sheets" or "line id|specs": 'whole' or a number. */
  const [retie, setRetie] = useState<Record<string, string>>({})
  const [touchOverride, setTouchOverride] = useState<string[] | null>(null)
  const [brought, setBrought] = useState<BroughtTrade[]>([])
  /** Scope lines this set adds, by trade (package id). */
  const [newLines, setNewLines] = useState<Record<string, string[]>>({})
  const [askingOpen, setAskingOpen] = useState(false)
  /** Answered questions kept out of this set's note, by id. The rest ride in it. */
  const [skipQ, setSkipQ] = useState<string[]>([])
  /** Change orders to the owner this set starts, by package id: ticked or not, the cost, the words. */
  const [coOn, setCoOn] = useState<Record<string, boolean>>({})
  const [coCost, setCoCost] = useState<Record<string, string>>({})
  const [coText, setCoText] = useState<Record<string, string>>({})
  /** Days this set adds to scheduled activities, as typed, by line id. */
  const [pushDays, setPushDays] = useState<Record<string, string>>({})
  /** The trade whose Add a line box is open, and what is typed in it. */
  const [lineFor, setLineFor] = useState<string | null>(null)
  /** The scope book, searched when a set brings a line. */
  const book = useMemo(() => scopeBook(state), [state])
  const [skipped, setSkipped] = useState<string[]>([])
  const [previewId, setPreviewId] = useState<string | null>(null)

  const noteSheets = useMemo(() => {
    const raw = sheetText === null ? sheetsInText(note) : sheetText.split(',').map((x) => x.trim()).filter(Boolean)
    return [...new Set(raw.map((id) => sheetAsIndexed(project, id)))]
  }, [note, sheetText, project])
  const index = useMemo(() => sheetsAtRev(project, currentRev(project)), [project])
  const whole = !(SET_KINDS.find((k) => k.kind === kind)?.numbered ?? true)
  // A whole new set: the pasted index against ours. New, gone and renamed sheets join the ones the notes name.
  const diff = useMemo(() => {
    const listed = sheetsOfRows(indexRows)
    return listed.length === 0 ? null : indexDiff(index, listed.map((x) => ({ ...x, id: sheetAsIndexed(project, x.id) })))
  }, [indexRows, index, project])
  const indexRowsToFix = Object.keys(rowProblems(indexRows)).length
  /** The made-up new set, as a list to paste and as the sheets of its made-up PDF. */
  const sampleIndex = useMemo(() => sampleReissue(index), [index])
  const sampleIndexSheets = useMemo(() => sheetIndexInText(sampleIndex).sheets, [sampleIndex])
  const sheets = [...new Set([...noteSheets, ...(diff ? [...diff.added.map((x) => x.id), ...diff.renamed.map((x) => x.id), ...diff.gone.map((x) => x.id)] : [])])]
  const noteTakesOut = takenOutInText(note, (line) => sheetsInText(line).map((id) => sheetAsIndexed(project, id)))
  /** Sheets this set takes out: gone from the pasted index or said in the notes, unless the office kept them. */
  const goneSheets = sheets.filter(
    (id) => index.some((x) => x.id === id) && (goneMarks[id] ?? (Boolean(diff?.gone.some((g) => g.id === id)) || noteTakesOut.includes(id))),
  )
  const retitled: PlanSheet[] = (diff?.renamed ?? []).filter((r) => !goneSheets.includes(r.id)).map((r) => ({ id: r.id, title: r.to }))
  const added: PlanSheet[] = sheets
    .filter((id) => !index.some((s) => s.id === id))
    .map((id) => {
      // A sheet from the new set's list keeps the discipline picked for it and its page of the PDF.
      const listed = diff?.added.find((x) => x.id === id)
      return {
        id,
        title: (titles[id] ?? listed?.title ?? '').trim(),
        ...(listed?.discipline ? { discipline: listed.discipline } : {}),
        ...(listed?.page ? { page: listed.page } : {}),
      }
    })
  const manual = useMemo(() => specsAtRev(project, currentRev(project)), [project])
  const noteSpecs = useMemo(
    () => (specText === null ? specsInText(note) : [...new Set(specText.split(',').flatMap((x) => specsInText(`section ${x.trim()}`)))]),
    [note, specText],
  )
  const specDiff = useMemo(() => (tocText.trim() === '' ? null : indexDiff(manual, specIndexInText(tocText).sections)), [tocText, manual])
  const specIds = [
    ...new Set([...noteSpecs, ...(specDiff ? [...specDiff.added.map((x) => x.id), ...specDiff.renamed.map((x) => x.id), ...specDiff.gone.map((x) => x.id)] : [])]),
  ]
  const noteTakesOutSpecs = takenOutInText(note, specsInText)
  const goneSpecs = specIds.filter(
    (id) => manual.some((x) => x.id === id) && (goneMarks[`spec:${id}`] ?? (Boolean(specDiff?.gone.some((g) => g.id === id)) || noteTakesOutSpecs.includes(id))),
  )
  const retitledSpecs: SpecSection[] = (specDiff?.renamed ?? []).filter((r) => !goneSpecs.includes(r.id)).map((r) => ({ id: r.id, title: r.to }))
  /** Sections this set names that the manual does not have yet, with the titles the office gives them. */
  const addedSpecs: SpecSection[] = specIds
    .filter((id) => !manual.some((x) => x.id === id))
    .map((id) => ({ id, title: (specTitles[id] ?? specDiff?.added.find((x) => x.id === id)?.title ?? '').trim() }))
  const bySheets = packagesForSheets(project, sheets, added)
  const bySpecs = packagesForSpecs(project, specIds)
  const touches = touchOverride ?? project.packages.filter((p) => bySheets.includes(p.id) || bySpecs.includes(p.id)).map((p) => p.id)
  /** Every sheet once the set is in: the index without what it takes out, renamed as it says, and the ones it adds. */
  const allSheets = [
    ...index.filter((x) => !goneSheets.includes(x.id)).map((x) => ({ ...x, title: retitled.find((r) => r.id === x.id)?.title ?? x.title })),
    ...added.filter((a) => !index.some((s) => s.id === a.id)),
  ]
  const sheetsOfTrade = (trade: string) => {
    const from = tradesForSheets(allSheets).find((g) => g.trade === trade)?.from ?? []
    return allSheets.filter((s) => from.includes(s.id))
  }
  /** Every section once the set is in: the manual without what it takes out, and the ones it adds; and the ones that point at a trade. */
  const specs = [
    ...manual.filter((x) => !goneSpecs.includes(x.id)).map((x) => ({ ...x, title: retitledSpecs.find((r) => r.id === x.id)?.title ?? x.title })),
    ...addedSpecs,
  ]
  const specsOfTrade = (trade: string) => specs.filter((x) => tradeForSpec(x.id) === trade)
  const specNamed = (id: string): SpecSection => specs.find((x) => x.id === id) ?? manual.find((x) => x.id === id) ?? { id, title: '' }
  /** Lines whose sheets or sections all go, and what the office ties each to instead. */
  const left = linesLeftBehind(project, goneSheets, goneSpecs)
  const retiedLines = left
    .map((l) => {
      const bySheets = retie[`${l.item.id}|sheets`]
      const bySpecs = retie[`${l.item.id}|specs`]
      return {
        packageId: l.packageId,
        scopeId: l.item.id,
        ...(l.sheets.length > 0 && bySheets ? { sheets: bySheets === 'whole' ? [] : [bySheets] } : {}),
        ...(l.specs.length > 0 && bySpecs ? { specs: bySpecs === 'whole' ? [] : [bySpecs] } : {}),
      }
    })
    .filter((l) => l.sheets || l.specs)
  const goneWords = [
    ...goneSheets.map((id) => `${id} ${index.find((x) => x.id === id)?.title ?? ''}`.trim()),
    ...goneSpecs.map((id) => `${id} ${manual.find((x) => x.id === id)?.title ?? ''}`.trim()),
  ]
  const everyone = planRecipients(state, project, touches)
  const going = everyone.filter((r) => !skipped.includes(r.partner.id))
  const companies = new Set(going.map((r) => r.partner.id)).size
  const ours = project.packages.filter((p) => p.selfPerform && touches.includes(p.id))
  const preview = going.find((r) => r.partner.id === previewId) ?? going.find((r) => r.touched) ?? going[0] ?? null
  // The schedule: the activities this set reaches, the days typed against them, and what that moves.
  const schedule = project.schedule ?? null
  const reached = activitiesTouched(project, sheets, specIds, addedSpecs, added).filter((a) => touches.includes(a.packageId))
  const spare = schedule ? scheduleFloat(schedule.activities) : new Map<string, number>()
  const pushes = Object.fromEntries(
    Object.entries(pushDays)
      .filter(([id]) => reached.some((a) => a.lineId === id))
      .map(([id, t]) => [id, Math.round(Number(t) || 0)] as const)
      .filter(([, d]) => d > 0),
  )
  // Work the set brings goes on the schedule too, placed as issuePlanSet will place it: a new trade's lines and the lines it adds.
  const workRev = currentRev(project) + 1
  const workBrought = packagesFromDrafts(
    project.id,
    brought.map((b) => ({ trade: b.trade, budget: 0, ours: b.ours, scope: b.scope.map((l) => l.label) })),
    project.packages.map((p) => p.id),
  )
  const workLined = withNewLines(
    project,
    workRev,
    project.packages.filter((p) => touches.includes(p.id)).flatMap((p) => (newLines[p.id] ?? []).map((label) => ({ packageId: p.id, label, sheets: [] }))),
  )
  const workPackages = withTradesInOrder(workLined.project.packages, workBrought)
  const newWork = schedule
    ? [
        ...workBrought.flatMap((p) => p.scope.map((l) => ({ packageId: p.id, lineId: l.id, label: l.label, trade: p.trade }))),
        ...workLined.added.map((a) => {
          const pkg = workPackages.find((p) => p.id === a.packageId)
          return { packageId: a.packageId, lineId: a.scopeId, label: pkg?.scope.find((l) => l.id === a.scopeId)?.label ?? '', trade: pkg?.trade ?? '' }
        }),
      ]
    : []
  const placed =
    schedule && (Object.keys(pushes).length > 0 || newWork.length > 0)
      ? scheduleSetLines({ ...workLined.project, packages: workPackages }, schedule.activities, newWork, state.today)
      : null
  const push = placed ? pushSchedule(placed, pushes) : null
  const lastWas = schedule ? schedule.activities.reduce((m, a) => (a.finish > m ? a.finish : m), '') : ''
  const endDays = push ? Math.round((Date.parse(push.lastAfter) - Date.parse(lastWas)) / 86_400_000) : 0
  // Substantial completion as the contract has it now: the drawn day plus the days signed change orders add (Building's, question 28).
  const substantial = substantialCompletionOn(project)
  const substantialWords = substantial
    ? substantial.days > 0
      ? `now ${weekdayDate(substantial.on)} after signed change orders`
      : `planned ${weekdayDate(substantial.planned)}`
    : ''
  const lineName = (packageId: string, lineId: string) => {
    // An inspection is no trade's line: it carries its own name.
    const inspection = schedule?.activities.find((a) => a.lineId === lineId)?.inspection
    if (inspection) return inspection.label
    const pkg = project.packages.find((k) => k.id === packageId)
    return pkg?.sow?.sov.find((l) => l.id === lineId)?.label ?? pkg?.scope.find((l) => l.id === lineId)?.label ?? lineId
  }
  /** The new dates of one trade's activities this push moved, said as sentences for its email. */
  const movesFor = (packageId: string) =>
    (push?.moved ?? [])
      .map((m) => push?.activities.find((a) => a.lineId === m.lineId))
      .filter((a): a is NonNullable<typeof a> => !!a && a.packageId === packageId)
      .map((a) => `${lineName(a.packageId, a.lineId)} now runs ${weekdayDate(a.start)} to ${weekdayDate(a.finish)}.`)
  /** The trades a change order can start on: the ones the set changes, and the ones it brings, with the ids they will get. */
  const broughtDrafts = brought.map((b) => ({
    trade: b.trade,
    budget: Number(b.budget.replace(/[^0-9.]/g, '')) || 0,
    ours: b.ours,
    scope: b.scope.map((l) => l.label),
    scopeSheets: b.scope.map((l) => l.sheets ?? guessLineSheets(l.label, sheetsOfTrade(b.trade))),
    ...(specs.length > 0 ? { scopeSpecs: b.scope.map((l) => l.specs ?? guessLineSpecs(l.label, specsOfTrade(b.trade))) } : {}),
    ...(usualExcludes(b.trade).length > 0 ? { excludes: usualExcludes(b.trade) } : {}),
  }))
  const coTrades =
    project.stage === 'pursuing'
      ? []
      : [
          ...project.packages.filter((p) => touches.includes(p.id)).map((p) => ({ id: p.id, trade: p.trade, brought: false })),
          ...packagesFromDrafts(project.id, broughtDrafts, project.packages.map((p) => p.id)).map((p) => ({ id: p.id, trade: p.trade, brought: true })),
        ]
  const coBase = coTrades.map((t) => {
    const lines = newLines[t.id] ?? []
    const pushed = reached.some((a) => a.packageId === t.id && (pushes[a.lineId] ?? 0) > 0)
    const cost = Math.round(Number((coCost[t.id] ?? '').replace(/[^0-9.-]/g, '')) || 0)
    const start = changeOrderFromSet({ label, note, sheets, specs: specIds }, t.trade, t.brought ? [t.trade] : lines, 0)
    return {
      ...t,
      lines,
      // The trade's own work is why the job takes longer: a pushed activity, or new work on the schedule.
      cause: pushed || (schedule !== null && (t.brought || lines.length > 0)),
      on: coOn[t.id] ?? (t.brought || lines.length > 0 || pushed),
      description: coText[t.id] ?? start.description,
      cost,
      price: cost !== 0 ? changeOrderPrice(project, cost) : 0,
    }
  })
  // The days the set adds ride on one change order, the first one going out whose trade caused them,
  // so the signed change orders' days add up to the job's (Owner Billing sums them).
  const timeOn = changeOrderTakingTheDays(coBase, endDays)
  const coRows = coBase.map((r) => {
    const time = changeOrderFromSet({ label, note, sheets, specs: specIds }, r.trade, r.brought ? [r.trade] : r.lines, r.id === timeOn ? endDays : 0)
    return { ...r, schedule: time.schedule, days: time.days }
  })
  const coDrafted = coRows.filter((r) => r.on && r.cost !== 0 && r.description.trim() !== '')
  const answers = answeredNotInSet(project)
  const carriedQs = answers.filter((q) => !skipQ.includes(q.id))
  /** The pre-bid meeting's minutes, once it is held and no set has carried them; ticked unless the office unticks them. */
  const minutesLine = preBidMinutesLine(state, project)
  const [skipMinutes, setSkipMinutes] = useState(false)
  const carryMinutes = minutesLine !== null && !skipMinutes
  /** What the set says changed: the office's words, the meeting's minutes, then each answer it carries. */
  const fullNote = [note.trim(), ...(carryMinutes && minutesLine ? [minutesLine] : []), ...carriedQs.map((q) => questionInNote(project, q))].filter(Boolean).join('\n')
  const email = planEmail(project, label, fullNote, sheets, preview, {
    lines: preview?.touched ? linesATradeHears(project, preview.pkg, sheets, specIds, addedSpecs, added).map((l) => l.label) : [],
    adds: preview?.touched ? (newLines[preview.pkg.id] ?? []) : [],
    moves: preview?.touched ? movesFor(preview.pkg.id) : [],
    specs: specIds.filter((id) => !goneSpecs.includes(id)).map(specNamed),
    gone: goneWords,
  })

  const onJob = (trade: string) =>
    project.packages.some((p) => p.trade.toLowerCase() === trade.toLowerCase()) || brought.some((b) => b.trade.toLowerCase() === trade.toLowerCase())
  /** Trades the sheets and the sections point at that the job does not have yet. */
  const suggested = tradesForPlans(
    sheets.map((id) => index.find((s) => s.id === id) ?? added.find((s) => s.id === id) ?? { id, title: '' }),
    specIds.map(specNamed),
  ).filter((g) => !onJob(g.trade))
  const bring = (trade: string) => {
    const t = trade.trim()
    if (t === '' || onJob(t)) return
    setBrought((b) => [...b, { trade: t, budget: '', ours: OUR_TRADES.includes(t), scope: usualScope(t).map((l) => ({ label: l, sheets: null })) }])
  }
  const change = (i: number, patch: Partial<BroughtTrade>) => setBrought((b) => b.map((x, j) => (j === i ? { ...x, ...patch } : x)))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // With the questions window open over this one, Escape closes only that one.
      // An open picker takes Escape for itself too.
      if (e.key === 'Escape' && !askingOpen && !e.defaultPrevented && !document.querySelector('[role="listbox"]')) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, askingOpen])

  const compared = diff !== null || specDiff !== null
  const checkedBy = (checker === OTHER ? checkerTyped : checker).trim()
  const missing =
    fullNote === '' && !compared
      ? 'Say what changed first.'
      : indexRowsToFix > 0
        ? `Fix or take out the ${indexRowsToFix === 1 ? 'sheet row' : `${indexRowsToFix} sheet rows`} marked in the new set's sheets.`
        : label === ''
          ? 'Give the set a name.'
          : checkedBy === ''
            ? 'Say who checked the set.'
            : null
  /** A line the set brings to a trade, from the scope book or typed. The box stays open for the next one. */
  const addLine = (packageId: string, words: string) => {
    const t = words.trim()
    if (t !== '') setNewLines((all) => ({ ...all, [packageId]: [...(all[packageId] ?? []), t] }))
  }
  /** A new line reads from the changed sheets that belong to its trade. None: the trade as a whole. */
  const newLineSheets = (trade: string) => sheetsOfTrade(trade).map((x) => x.id).filter((id) => sheets.includes(id))
  /** And from the changed sections that belong to its trade, never one the set takes out. */
  const newLineSpecs = (trade: string) => specIds.filter((id) => tradeForSpec(id) === trade && !goneSpecs.includes(id))
  const linesAdded = project.packages.filter((p) => touches.includes(p.id)).reduce((n, p) => n + (newLines[p.id]?.length ?? 0), 0)

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${project.name}: a new set of plans`}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          color: 'var(--text-base)',
          borderRadius: 10,
          width: 'min(1040px, 100%)',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--border-strong)',
        }}
      >
        <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{project.name} · a new set of plans came in</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              This becomes <strong>{label || 'a set with no name'}</strong>. It replaces {planLabel(project, currentRev(project))} in every portal.
            </div>
          </div>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '0.9rem 1rem', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '1.1rem' }}>
          <section>
            <StepHeading n={1} title="What came in" hint="Name the set. Then paste or type what is different." />
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.45rem', marginBottom: '0.6rem', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {SET_KINDS.map((k) => (
                  <button
                    key={k.kind}
                    type="button"
                    aria-pressed={labelText === null && kind === k.kind}
                    onClick={() => {
                      setKind(k.kind)
                      setLabelText(null)
                    }}
                    style={pill(labelText === null && kind === k.kind)}
                  >
                    {k.kind}
                  </button>
                ))}
                <input
                  style={{ ...input, flex: '0 1 12rem' }}
                  value={labelText ?? nextSetLabel(project, kind)}
                  onChange={(e) => setLabelText(e.target.value)}
                  aria-label="What this set is called"
                />
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                An addendum comes while we bid. A bulletin comes once the job is ours. Each one counts on its own.
              </span>
              <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <label htmlFor="gc-set-checker" style={{ fontWeight: 600 }}>Checked by</label>
                <div style={{ flex: '0 1 16rem', minWidth: 0 }}>
                  <Picker
                    id="gc-set-checker"
                    value={checker}
                    onChange={setChecker}
                    placeholder="Pick who checked it"
                    ariaLabel="Who checked the set"
                    searchPlaceholder="Search our people"
                    options={(() => {
                      // The job's own team under its heading, then our people on other jobs under theirs.
                      const people = ourPeople(state, project)
                      const team = project.team ?? []
                      const own = people.filter((name) => team.some((c) => c.name === name))
                      const rest = people.filter((name) => !team.some((c) => c.name === name))
                      const row = (name: string) => {
                        const c = team.find((x) => x.name === name)
                        const role = c ? (c.role === 'projectManager' ? 'Project manager' : 'Superintendent') : 'On our other jobs'
                        return { value: name, label: `${name} ${role}`, labelContent: pickerRow(name, role), triggerContent: pickerFace(name) }
                      }
                      return [
                        ...(own.length > 0 ? [pickerGroup('job', 'On this job'), ...own.map(row)] : []),
                        ...(rest.length > 0 ? [pickerGroup('rest', own.length > 0 ? 'Our other people' : 'Our people'), ...rest.map(row)] : []),
                        pickerGroup('else', ''),
                        { value: OTHER, label: 'Someone else', labelContent: <span style={{ color: 'var(--text-blue-500)', fontWeight: 600 }}>+ Someone else</span> },
                      ]
                    })()}
                    onNoMatch={{
                      label: (q) => `"${q.trim()}" checked it`,
                      onSelect: (q) => {
                        setChecker(OTHER)
                        setCheckerTyped(q.trim())
                      },
                    }}
                  />
                </div>
                {checker === OTHER && (
                  <input
                    style={{ ...input, flex: '1 1 10rem', minWidth: 0, height: FIELD_HEIGHT_PX, boxSizing: 'border-box' }}
                    value={checkerTyped}
                    onChange={(e) => setCheckerTyped(e.target.value)}
                    placeholder="Their name"
                    aria-label="Who checked the set"
                  />
                )}
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                The files are in the job's Google Drive folder. Someone on our team checks them against the notes before the set goes out.
              </span>
            </div>
            <textarea
              ref={noteBox}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder={'For example:\nE-201: two more floor boxes in bay 2.\nM-101: RTU-3 moved 6 ft north. Curb detail changed on A-401.\nSection 09 91 23: low-VOC paint throughout.'}
              style={{ ...input, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
            />
            {whole && (
              <div style={{ marginTop: '0.6rem', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.4rem', fontSize: '0.875rem' }}>
                <strong>The new set's sheets</strong>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  A whole set comes with every sheet. List them and they are compared with the sheets we have. You see what is new, what is gone and what is renamed.
                </span>
                <SheetIndexTable rows={indexRows} onRows={setIndexRows} sampleText={sampleIndex} sampleSheets={sampleIndexSheets} projectName={project.name} setLabel={label || 'New set'} />
                {manual.length > 0 && (
                  <>
                    <strong style={{ marginTop: '0.3rem' }}>The new table of contents</strong>
                    <textarea
                      value={tocText}
                      onChange={(e) => setTocText(e.target.value)}
                      rows={3}
                      aria-label="The new table of contents"
                      placeholder={'09 29 00  GYPSUM BOARD\n09 91 23  INTERIOR PAINTING'}
                      style={{ ...input, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
                    />
                    {tocText.trim() === '' && (
                      <div>
                        <Btn kind="quiet" onClick={() => setTocText(sampleReissueSpecs(manual))}>Paste a made-up new table of contents</Btn>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {openQuestions(project).length > 0 && (
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-600)' }}>
                  {openQuestions(project).length} {openQuestions(project).length === 1 ? 'question about the plans is' : 'questions about the plans are'} still waiting on an answer.
                </span>
                <Btn kind="quiet" onClick={() => setAskingOpen(true)}>Questions about the plans</Btn>
              </div>
            )}
            {askingOpen && <GcNewProjectQuestions state={state} project={project} dispatch={dispatch} onClose={() => setAskingOpen(false)} />}
            {minutesLine && (
              <label style={{ marginTop: '0.5rem', padding: '0.5rem 0.7rem', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input type="checkbox" checked={!skipMinutes} onChange={(e) => setSkipMinutes(!e.target.checked)} style={{ marginTop: '0.2rem' }} />
                <span style={{ display: 'grid', gap: '0.15rem' }}>
                  <strong>The pre-bid meeting's minutes ride in this set</strong>
                  <span>{minutesLine}</span>
                </span>
              </label>
            )}
            {answers.length > 0 && (
              <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.7rem', borderRadius: 8, border: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.3rem', fontSize: '0.875rem' }}>
                <strong>Answers to carry in this set</strong>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  An answered question goes out with the next set, in its note. Untick one to keep it out.
                </span>
                {answers.map((q) => (
                  <label key={q.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!skipQ.includes(q.id)}
                      onChange={(e) => setSkipQ((all) => (e.target.checked ? all.filter((x) => x !== q.id) : [...all, q.id]))}
                      style={{ marginTop: '0.2rem' }}
                    />
                    <span>{questionInNote(project, q)}</span>
                  </label>
                ))}
              </div>
            )}
          </section>

          <section>
            <StepHeading n={2} title="What it changes" hint="Read from the notes. Fix anything that is wrong." />
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.6rem', fontSize: '0.875rem' }}>
              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                Sheets that changed
                <input
                  style={{ ...input, flex: '1 1 14rem' }}
                  value={sheetText ?? noteSheets.join(', ')}
                  onChange={(e) => setSheetText(e.target.value)}
                  placeholder="None found yet. Type them, like A-201, S-101"
                />
                {sheetText !== null && <Btn kind="quiet" onClick={() => setSheetText(null)}>Read them from the notes again</Btn>}
              </label>
              {diff && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  The new index against ours: {diff.added.length} new, {diff.gone.length} gone, {diff.renamed.length} renamed, {diff.same.length} the same.
                </span>
              )}
              {sheets.length > 0 && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  {sheets.map((id) => {
                    const known = index.find((s) => s.id === id)
                    const out = goneSheets.includes(id)
                    const renamedTo = retitled.find((r) => r.id === id)?.title
                    return (
                      <div key={id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.3rem 0.7rem', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', minWidth: '4rem', textDecoration: out ? 'line-through' : 'none' }}>{id}</span>
                        {known ? (
                          <>
                            <span style={{ color: 'var(--text-600)', flex: '1 1 12rem', minWidth: 0, textDecoration: out ? 'line-through' : 'none' }}>
                              {renamedTo ? `${known.title} → ${renamedTo}` : known.title}
                            </span>
                            {out ? <Chip tone="red">taken out</Chip> : renamedTo ? <Chip tone="violet">renamed</Chip> : <Chip tone="amber">changed</Chip>}
                            <button
                              type="button"
                              onClick={() => setGoneMarks((m) => ({ ...m, [id]: !out }))}
                              style={{ border: 'none', background: 'transparent', color: 'var(--text-blue-500)', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
                            >
                              {out ? 'Keep it' : 'Take it out'}
                            </button>
                          </>
                        ) : (
                          <>
                            <input
                              style={{ ...input, flex: '1 1 14rem' }}
                              value={titles[id] ?? diff?.added.find((x) => x.id === id)?.title ?? ''}
                              onChange={(e) => setTitles((t) => ({ ...t, [id]: e.target.value }))}
                              placeholder="Its title, as the sheet says it"
                              aria-label={`Title of ${id}`}
                            />
                            <Chip tone="blue">new to the set</Chip>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              {specDiff && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  The new table of contents against ours: {specDiff.added.length} new, {specDiff.gone.length} gone, {specDiff.renamed.length} renamed,{' '}
                  {specDiff.same.length} the same.
                </span>
              )}
              {(manual.length > 0 || specIds.length > 0 || specText !== null) && (
                <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  Spec sections that changed
                  <input
                    style={{ ...input, flex: '1 1 14rem' }}
                    value={specText ?? noteSpecs.join(', ')}
                    onChange={(e) => setSpecText(e.target.value)}
                    placeholder="None found yet. Type them, like 09 91 23, 22 40 00"
                  />
                  {specText !== null && <Btn kind="quiet" onClick={() => setSpecText(null)}>Read them from the notes again</Btn>}
                </label>
              )}
              {specIds.length > 0 && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  {specIds.map((id) => {
                    const known = manual.find((x) => x.id === id)
                    const out = goneSpecs.includes(id)
                    const renamedTo = retitledSpecs.find((r) => r.id === id)?.title
                    return (
                      <div key={id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.3rem 0.7rem', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', minWidth: '4.6rem', textDecoration: out ? 'line-through' : 'none' }}>{id}</span>
                        {known ? (
                          <>
                            <span style={{ color: 'var(--text-600)', flex: '1 1 12rem', minWidth: 0, textDecoration: out ? 'line-through' : 'none' }}>
                              {renamedTo ? `${known.title} → ${renamedTo}` : known.title}
                            </span>
                            {out ? <Chip tone="red">taken out</Chip> : <Chip tone="violet">{renamedTo ? 'renamed' : 'revised'}</Chip>}
                            <button
                              type="button"
                              onClick={() => setGoneMarks((m) => ({ ...m, [`spec:${id}`]: !out }))}
                              style={{ border: 'none', background: 'transparent', color: 'var(--text-blue-500)', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
                            >
                              {out ? 'Keep it' : 'Take it out'}
                            </button>
                          </>
                        ) : (
                          <>
                            <input
                              style={{ ...input, flex: '1 1 14rem' }}
                              value={specTitles[id] ?? specDiff?.added.find((x) => x.id === id)?.title ?? ''}
                              onChange={(e) => setSpecTitles((t) => ({ ...t, [id]: e.target.value }))}
                              placeholder="Its title, as the manual says it"
                              aria-label={`Title of section ${id}`}
                            />
                            <Chip tone="blue">new to the manual</Chip>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                Trades it changes
                {project.packages.map((p) => (
                  <label key={p.id} style={{ whiteSpace: 'nowrap' }}>
                    <input
                      type="checkbox"
                      checked={touches.includes(p.id)}
                      onChange={(e) => setTouchOverride(e.target.checked ? [...touches, p.id] : touches.filter((t) => t !== p.id))}
                    />{' '}
                    {p.trade}
                  </label>
                ))}
                {touchOverride !== null && <Btn kind="quiet" onClick={() => setTouchOverride(null)}>Guess from the sheets again</Btn>}
              </div>
              {touchOverride === null && sheets.length + specIds.length > 0 && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {specIds.length > 0
                    ? 'The trades are a guess from the sheets and the section numbers. Tick or untick to fix it.'
                    : 'The trades are a guess from the sheet letters and titles. Tick or untick to fix it.'}
                </span>
              )}
              {touches.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.2rem' }}>
                  <span style={{ fontWeight: 600 }}>The scope lines it touches</span>
                  {linesAdded > 0 && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      A quote already in never answered a new line. Compare quotes shows it as not clear until you set a cost to cover it.
                    </span>
                  )}
                  {project.packages
                    .filter((p) => touches.includes(p.id))
                    .map((p) => {
                      const hit = linesATradeHears(project, p, sheets, specIds, addedSpecs, added)
                      const adding = newLines[p.id] ?? []
                      const reads = [...newLineSheets(p.trade), ...newLineSpecs(p.trade)]
                      return (
                        <div key={p.id} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ minWidth: '8rem' }}>{p.trade}</span>
                          {hit.length === 0 && adding.length === 0 ? (
                            <span style={{ color: 'var(--text-muted)' }}>
                              {specIds.length > 0 ? 'no line names these sheets or sections, so the trade as a whole' : 'no line names these sheets, so the trade as a whole'}
                            </span>
                          ) : (
                            hit.map((l) => (
                              <Chip key={l.id} tone="amber">{l.label}</Chip>
                            ))
                          )}
                          {adding.map((l, i) => (
                            <span
                              key={`${l}-${i}`}
                              title={reads.length > 0 ? `Reads from ${reads.join(', ')}` : `Reads every ${inSentence(p.trade)} sheet`}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem', padding: '0.1rem 0.15rem 0.1rem 0.5rem', borderRadius: 999, background: 'var(--bg-blue-200)', color: 'var(--text-blue-800)', fontSize: '0.75rem', fontWeight: 600 }}
                            >
                              new: {l}
                              <button
                                type="button"
                                onClick={() => setNewLines((all) => ({ ...all, [p.id]: adding.filter((_, j) => j !== i) }))}
                                aria-label={`Take out the new line ${l}`}
                                style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', padding: '0 0.25rem', lineHeight: 1 }}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                          {lineFor === p.id ? (
                            <>
                              {/* The scope book's search (the owner, 2026-10-04): a line the set brings can come from the book. */}
                              <BookLineSearch
                                trade={p.trade}
                                book={book}
                                here={[...p.scope.map((x) => x.label), ...adding]}
                                onPick={(line) => addLine(p.id, line.words)}
                                onNew={(words) => addLine(p.id, words)}
                                autoFocus
                                onEscape={() => setLineFor(null)}
                              />
                              <Btn kind="quiet" onClick={() => setLineFor(null)}>Done</Btn>
                            </>
                          ) : (
                            <Btn
                              kind="quiet"
                              onClick={() => {
                                setLineFor(p.id)
                              }}
                            >
                              + Add a line this set brings
                            </Btn>
                          )}
                        </div>
                      )
                    })}
                </div>
              )}
              {left.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.35rem', padding: '0.5rem 0.7rem', borderRadius: 8, background: 'var(--bg-amber-tint)' }}>
                  <span style={{ fontWeight: 600 }}>Lines left with nothing to read</span>
                  <span style={{ color: 'var(--text-600)', fontSize: '0.8rem' }}>
                    Everything these lines read from is taken out. Pick what each one reads now, or leave it as it is.
                  </span>
                  {left.map((l) => {
                    const pkg = project.packages.find((p) => p.id === l.packageId)
                    const trade = pkg?.trade ?? ''
                    return (['sheets', 'specs'] as const)
                      .filter((kindOf) => l[kindOf].length > 0)
                      .map((kindOf) => {
                        const key = `${l.item.id}|${kindOf}`
                        const choices = kindOf === 'sheets' ? sheetsOfTrade(trade) : specsOfTrade(trade)
                        return (
                          <div key={key} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ flex: '1 1 16rem', minWidth: 0 }}>
                              {trade} · {l.item.label} read only {l[kindOf].join(' and ')}.
                            </span>
                            <div style={{ flex: '1 1 12rem', minWidth: 0, maxWidth: '100%' }}>
                              <Picker
                                compact
                                value={retie[key] ?? ''}
                                onChange={(v) => setRetie((r) => ({ ...r, [key]: v }))}
                                placeholder="Leave it as it is"
                                ariaLabel={`What ${l.item.label} reads now`}
                                searchPlaceholder={kindOf === 'sheets' ? 'Search the sheets' : 'Search the sections'}
                                options={[
                                  { value: '', label: 'Leave it as it is' },
                                  { value: 'whole', label: `Every ${inSentence(trade)} ${kindOf === 'sheets' ? 'sheet' : 'section'}` },
                                  ...(choices.length > 0 ? [pickerGroup('choices', kindOf === 'sheets' ? 'Its sheets now' : 'Its sections now')] : []),
                                  ...choices.map((x) => ({ value: x.id, label: `${x.id} ${x.title}`, labelContent: pickerRow(x.id, x.title), triggerContent: pickerFace(x.id, x.title) })),
                                ]}
                              />
                            </div>
                          </div>
                        )
                      })
                  })}
                </div>
              )}
              {schedule && (reached.length > 0 || newWork.length > 0) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.3rem', borderTop: '1px solid var(--border)', paddingTop: '0.6rem' }}>
                  <span style={{ fontWeight: 600 }}>What it does to the schedule</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {reached.length > 0 && 'Type the days the change adds to an activity. What waits on it moves out too. '}
                    {newWork.length > 0 && 'New work goes in its stage of the job, after what that stage waits on. '}
                    The plan at Start stays as the baseline.
                  </span>
                  {reached.map((a) => {
                    const days = spare.get(a.lineId) ?? 0
                    const pkg = project.packages.find((k) => k.id === a.packageId)
                    return (
                      <div key={a.lineId} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ minWidth: '12rem' }}>
                          {pkg?.trade} · {lineName(a.packageId, a.lineId)}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {weekdayDate(a.start)} to {weekdayDate(a.finish)}
                        </span>
                        {days <= 0 ? <Chip tone="red">on the critical path</Chip> : <Chip tone="grey">{days} spare {days === 1 ? 'day' : 'days'}</Chip>}
                        <span style={{ flex: 1 }} />
                        <label style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-muted)' }}>adds</span>
                          <input
                            style={{ ...input, width: '3.5rem', textAlign: 'right' }}
                            inputMode="numeric"
                            value={pushDays[a.lineId] ?? ''}
                            onChange={(e) => setPushDays((all) => ({ ...all, [a.lineId]: e.target.value.replace(/[^0-9]/g, '') }))}
                            placeholder="0"
                            aria-label={`Days this set adds to ${lineName(a.packageId, a.lineId)}`}
                          />
                          <span style={{ color: 'var(--text-muted)' }}>days</span>
                        </label>
                      </div>
                    )
                  })}
                  {newWork.map((w) => {
                    const a = push?.activities.find((x) => x.lineId === w.lineId)
                    return (
                      <div key={w.lineId} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ minWidth: '12rem' }}>
                          {w.trade} · {w.label}
                        </span>
                        {a && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            {weekdayDate(a.start)} to {weekdayDate(a.finish)}
                          </span>
                        )}
                        <Chip tone="blue">new work</Chip>
                      </div>
                    )
                  })}
                  {push && (
                    <div style={{ padding: '0.4rem 0.6rem', borderRadius: 6, background: endDays > 0 ? 'var(--bg-amber-tint)' : 'var(--bg-subtle)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.15rem' }}>
                      <span>
                        {newWork.length > 0 && `It puts ${newWork.length} new ${newWork.length === 1 ? 'activity' : 'activities'} on the schedule. `}
                        {push.moved.length > 0 && `It moves ${push.moved.length} ${push.moved.length === 1 ? 'activity' : 'activities'}. `}
                        {endDays > 0
                          ? `The job's last day moves from ${weekdayDate(lastWas)} to ${weekdayDate(push.lastAfter)}.`
                          : `${Object.keys(pushes).length > 0 ? 'The days fit in the spare days. ' : ''}The job's last day stays ${weekdayDate(lastWas)}.`}
                      </span>
                      {substantial &&
                        (push.lastAfter > substantial.on ? (
                          <strong style={{ color: 'var(--text-red-700)' }}>
                            Substantial completion, {substantialWords}, would be missed by{' '}
                            {Math.round((Date.parse(push.lastAfter) - Date.parse(substantial.on)) / 86_400_000)} days.
                          </strong>
                        ) : (
                          <span>Substantial completion, {substantialWords}, still holds.</span>
                        ))}
                    </div>
                  )}
                </div>
              )}
              {ours.length > 0 && (
                <div style={{ padding: '0.4rem 0.6rem', background: 'var(--bg-violet-100)', color: 'var(--text-violet-800)', borderRadius: 6 }}>
                  This changes {ours.map((p) => inSentence(p.trade)).join(' and ')}, which is ours. Check {ours.map((p) => p.selfPerform?.ref).join(', ')} against the new set.
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.6rem', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong>A trade the job does not have yet</strong>
                  <div style={{ flex: '0 1 18rem', minWidth: 0 }}>
                    <Picker
                      value=""
                      onChange={bring}
                      placeholder="From the usual list, or type one"
                      ariaLabel="Add a trade from the usual list"
                      searchPlaceholder="Search, or type a trade like Canopy steel"
                      options={TRADE_TEMPLATES.filter((t) => !onJob(t.trade)).map((t) => ({ value: t.trade, label: t.trade, labelContent: pickerRow(t.trade, t.scope.join(', ')) }))}
                      onNoMatch={{ label: (q) => `Add "${q.trim()}" as a trade`, onSelect: bring }}
                    />
                  </div>
                </div>
                {suggested.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.4rem 0.6rem', borderRadius: 6, background: 'var(--bg-blue-tint)' }}>
                    The {specIds.length > 0 ? 'plans' : 'sheets'} point at {suggested.map((g) => inSentence(g.trade)).join(' and ')}, which the job does not have.
                    {suggested.map((g) => (
                      <Btn key={g.trade} kind="quiet" onClick={() => bring(g.trade)}>Add {g.trade}</Btn>
                    ))}
                  </div>
                )}
                {brought.map((b, i) => (
                  <div key={b.trade} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.45rem' }}>
                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong>{b.trade}</strong>
                      <Chip tone="blue">a new trade</Chip>
                      <span style={{ flex: 1 }} />
                      <label style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', cursor: 'pointer' }}>
                        <input type="checkbox" checked={b.ours} onChange={(e) => change(i, { ours: e.target.checked })} />
                        Ours
                      </label>
                      <label style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{b.ours ? 'Our guess' : 'Our budget'}</span>
                        <input
                          style={{ ...input, width: '7rem', textAlign: 'right' }}
                          inputMode="numeric"
                          value={b.budget}
                          onChange={(e) => change(i, { budget: e.target.value })}
                          placeholder="$0"
                        />
                      </label>
                      <Btn kind="quiet" onClick={() => setBrought((all) => all.filter((_, j) => j !== i))}>Take it out</Btn>
                    </div>
                    <ScopeLines
                      trade={b.trade}
                      lines={b.scope}
                      onChange={(scope) => change(i, { scope })}
                      sheets={allSheets}
                      tradeSheets={sheetsOfTrade(b.trade)}
                      specs={specs}
                      tradeSpecs={specsOfTrade(b.trade)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>

          {coRows.length > 0 && (
            <section>
              <StepHeading n={3} title="Change orders to the owner" hint="The job is ours, so a change to the work is a change to our price." />
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.5rem', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Tick a trade to start a change order for it. Type what the change costs us. Our fee is added for the price. Each one is drafted on Bill the owner, for you to review and send.
                </span>
                {coRows.map((r) => (
                  <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.7rem', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.35rem', opacity: r.on ? 1 : 0.6 }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', cursor: 'pointer' }}>
                        <input type="checkbox" checked={r.on} onChange={(e) => setCoOn((all) => ({ ...all, [r.id]: e.target.checked }))} />
                        <strong>{r.trade}</strong>
                      </label>
                      {r.brought && <Chip tone="blue">a new trade</Chip>}
                      <Chip tone="grey">time: {r.schedule}</Chip>
                      <span style={{ flex: 1 }} />
                      {r.on && (
                        <label style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Our cost</span>
                          <input
                            style={{ ...input, width: '7rem', textAlign: 'right' }}
                            inputMode="numeric"
                            value={coCost[r.id] ?? ''}
                            onChange={(e) => setCoCost((all) => ({ ...all, [r.id]: e.target.value }))}
                            placeholder="$0"
                            aria-label={`What the change to ${r.trade} costs us`}
                          />
                        </label>
                      )}
                    </div>
                    {r.brought && (!r.on || r.cost === 0 || r.description.trim() === '') && (
                      // A trade a set brings after the owner signed is $0 on the owner's own lines (Owner Billing): only this change order bills it.
                      <span style={{ color: 'var(--text-amber-700)', fontWeight: 600, fontSize: '0.8rem' }}>
                        {r.trade} bills the owner only through this change order. Without one, its cost never reaches the owner.{' '}
                        {!r.on ? 'Tick it and type our cost.' : r.cost === 0 ? 'Type our cost.' : 'Say what it is for.'}
                      </span>
                    )}
                    {r.on && (
                      <>
                        <input
                          style={{ ...input, width: '100%', boxSizing: 'border-box' }}
                          value={r.description}
                          onChange={(e) => setCoText((all) => ({ ...all, [r.id]: e.target.value }))}
                          aria-label={`What the change order to the owner says for ${r.trade}`}
                        />
                        <span style={{ color: r.cost === 0 ? 'var(--text-muted)' : 'var(--text-600)', fontSize: '0.8rem' }}>
                          {r.cost === 0
                            ? 'Type a cost to draft it. A credit is a cost below zero.'
                            : `The price to the owner is ${money(r.price)}, our cost plus our fee.`}
                        </span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <StepHeading
              n={coRows.length > 0 ? 4 : 3}
              title="Who hears about it"
              hint={
                project.stage === 'pursuing'
                  ? 'We are still bidding, so every company quoting gets it.'
                  : 'The job is ours, so only the company on each trade gets it.'
              }
            />
            {brought.length > 0 && (
              <div style={{ marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-600)' }}>
                Nobody is asked to quote {brought.map((b) => inSentence(b.trade)).join(' or ')} yet. Ask companies on Trades after you issue the set.
              </div>
            )}
            {everyone.length === 0 ? (
              <div style={{ color: 'var(--text-muted)' }}>No company is on this project yet. The set still replaces the old one.</div>
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                {everyone.map((r) => {
                  const on = !skipped.includes(r.partner.id)
                  return (
                    <label
                      key={r.invite.id}
                      style={{
                        display: 'flex',
                        gap: '0.6rem',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        padding: '0.4rem 0.7rem',
                        borderBottom: '1px solid var(--border)',
                        background: r.touched ? 'var(--bg-amber-tint)' : undefined,
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) => setSkipped(e.target.checked ? skipped.filter((x) => x !== r.partner.id) : [...skipped, r.partner.id])}
                      />
                      <strong>{r.partner.company}</strong>
                      <span style={{ color: 'var(--text-muted)' }}>{r.pkg.trade}</span>
                      {r.touched ? (
                        <Chip tone="amber">{r.hasBid && project.stage === 'pursuing' ? 'changes their trade · asked to confirm their number' : 'changes their trade'}</Chip>
                      ) : (
                        <Chip tone="grey">no change to their trade · for their records</Chip>
                      )}
                      <span style={{ flex: 1 }} />
                      {on && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            setPreviewId(r.partner.id)
                          }}
                          style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--text-link)', cursor: 'pointer' }}
                        >
                          {preview?.partner.id === r.partner.id ? 'shown below' : 'See their email'}
                        </button>
                      )}
                    </label>
                  )
                })}
              </div>
            )}
          </section>

          <section>
            <StepHeading n={coRows.length > 0 ? 5 : 4} title="The email" hint={preview ? `As ${preview.partner.company} gets it.` : 'No one to email.'} />
            <div data-theme="light" style={{ border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-base)', padding: '0.8rem 1rem', fontSize: '0.9rem', display: 'grid', gap: '0.5rem' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                To: {preview ? `${preview.partner.contact}, ${preview.partner.company}` : 'no one'} · From: Click Construction
              </div>
              <div style={{ fontWeight: 700 }}>{email.subject}</div>
              {email.body.map((line, i) => (
                <div key={i} style={{ whiteSpace: 'pre-wrap' }}>{line}</div>
              ))}
              <div>
                <span style={{ display: 'inline-block', padding: '0.4rem 0.9rem', borderRadius: 6, background: '#2563eb', color: 'white', fontWeight: 600 }}>Open the plans</span>
              </div>
            </div>
          </section>
        </div>

        <div style={{ padding: '0.65rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-600)' }}>
            {companies === 0
              ? 'No email goes out.'
              : `${companies} ${companies === 1 ? 'company gets' : 'companies get'} an email. ${going.filter((r) => r.touched).length} ${
                  going.filter((r) => r.touched).length === 1 ? 'is' : 'are'
                } told it changes their trade.`}
            {linesAdded > 0 && ` It adds ${linesAdded} scope ${linesAdded === 1 ? 'line' : 'lines'}.`}
            {endDays > 0 && ` It adds ${endDays} ${endDays === 1 ? 'day' : 'days'} to the job.`}
            {coDrafted.length > 0 && ` It drafts ${coDrafted.length} ${coDrafted.length === 1 ? 'change order' : 'change orders'} to the owner.`}
            {brought.length > 0 && ` It adds ${brought.length === 1 ? 'a trade' : `${brought.length} trades`}.`}
          </span>
          <span style={{ flex: 1 }} />
          {missing && <span style={{ fontSize: '0.85rem', color: 'var(--text-amber-700)', fontWeight: 600 }}>{missing}</span>}
          <Btn kind="quiet" onClick={onClose}>Cancel</Btn>
          <Btn
            kind="primary"
            disabled={missing !== null}
            title={missing ?? undefined}
            onClick={() => {
              dispatch({
                type: 'issuePlanSet',
                projectId: project.id,
                label,
                note: fullNote,
                questionIds: carriedQs.map((q) => q.id),
                sheets,
                addedSheets: added,
                touches,
                recipients: going.map((r) => r.partner.id),
                schedulePushes: pushes,
                newLines: project.packages
                  .filter((p) => touches.includes(p.id))
                  .flatMap((p) => (newLines[p.id] ?? []).map((l) => ({ packageId: p.id, label: l, sheets: newLineSheets(p.trade), specs: newLineSpecs(p.trade) }))),
                newTrades: broughtDrafts,
                specs: specIds,
                addedSpecs,
                removedSheets: goneSheets,
                retitledSheets: retitled,
                removedSpecs: goneSpecs,
                retitledSpecs,
                retiedLines,
                checkedBy,
                ...(carryMinutes ? { preBidMinutes: true } : {}),
              })
              // Each change order is Owner Billing's own draft, so it reads on Bill the owner as theirs do.
              for (const r of coDrafted) {
                dispatch({
                  type: 'draftChangeOrder',
                  projectId: project.id,
                  description: r.description.trim(),
                  reason: 'plans',
                  schedule: r.schedule,
                  packageId: r.id,
                  cost: r.cost,
                  price: 0,
                  ...(r.days > 0 ? { days: r.days } : {}),
                })
              }
              onClose()
            }}
          >
            Issue {label || 'the set'}{companies > 0 ? ` and email ${companies}` : ''}
          </Btn>
        </div>
      </div>
    </div>
  )
}
