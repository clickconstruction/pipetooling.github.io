import { useEffect, useMemo, useRef, useState } from 'react'
import {
  TRADE_TEMPLATES,
  guessLineSheets,
  guessLineSpecs,
  inSentence,
  indexDiff,
  sheetsInText,
  specIndexInText,
  specsInText,
  takenOutInText,
  tradeForSpec,
  tradesForPlans,
  tradesForSheets,
  usualExcludes,
  usualScope,
} from '../../lib/gc/plans'
import { rowProblems, sheetsOfRows, type SheetIndexRow } from '../../lib/gc/sheets'
import { SET_KINDS, defaultSetKind, nextSetLabel } from '../../lib/gc/setKinds'
import { driveLinkProblem } from '../../lib/gc/drive'
import { answeredNotInSet, questionInNote } from '../../lib/gc/questions'
import { linesLeftBehind, linesOnSheets, linesOnSpecs, packagesForSheets, packagesForSpecs, sheetAsIndexed } from '../../lib/gc/lineReach'
import type { ScopeBookLine } from '../../lib/gc/scopeBook'
import type { GcProjectView } from '../../lib/gc/projectRows'
import type { GcTeamMember } from '../../lib/gc/gcIo'
import type { IssuePlanSetDraft } from '../../lib/gc/planSetDraft'
import type { PlanSheet, SpecSection } from '../../lib/gc/types'
import { ScopeLines, type ScopeLineDraft } from './GcNewProject'
import { Btn, Chip, input } from './gcUi'
import { Picker } from './GcNewProjectPickers'
import { pickerFace, pickerGroup, pickerRow } from './GcNewProjectPickerRows'
import { SheetIndexTable } from './GcNewProjectSheetIndex'
import { BookLineSearch } from './GcNewProjectScopeBook'
import { DriveLinkField } from './GcNewProjectDriveLink'

/**
 * GC mode, the real build, step 6: a new set of plans came in, moved from the prototype (branch
 * spike/gc-mode, `GcNewPlans.tsx`) with its first two steps. 1: name the set, say who checked it,
 * give its Drive link, and paste or type what changed; a whole set brings its sheet list and
 * table of contents, compared with ours. 2: what it changes: the sheets and sections (changed,
 * new, taken out, renamed), the trades it touches with the lines each hears, the lines it leaves
 * with nothing to read and what they read now, the lines it adds, and the trades it brings. Who
 * hears about it, the email, the schedule and the questions land with their own steps. The
 * window builds an IssuePlanSetDraft; the page sends it through gc_issue_plan_set.
 */

/** The trades our own crew does: ticked Ours by default. */
const OUR_TRADES = ['Plumbing']

interface Props {
  project: GcProjectView
  book: ScopeBookLine[]
  team: GcTeamMember[]
  today: string
  onClose: () => void
  onIssue: (draft: IssuePlanSetDraft) => void
  issuing?: boolean
  problem?: string | null
}

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
          background: 'var(--text-blue-500)',
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

const roleWords: Record<string, string> = {
  dev: 'Dev',
  master_technician: 'Leader',
  assistant: 'Assistant',
  controller: 'Controller',
  estimator: 'Estimator',
  superintendent: 'Superintendent',
}

export function GcNewPlansWindow({ project, book, team, onClose, onIssue, issuing, problem }: Props) {
  const stage = project.stage === 'bidding' ? 'pursuing' : project.stage
  const [kind, setKind] = useState(defaultSetKind({ stage }))
  /** Null: the name follows the kind. A string: the office typed its own. */
  const [labelText, setLabelText] = useState<string | null>(null)
  const label = (labelText ?? nextSetLabel(project, kind)).trim()
  const [note, setNote] = useState('')
  /** Who on our team checked the files, by user id. */
  const [checker, setChecker] = useState('')
  const [driveUrl, setDriveUrl] = useState('')
  const noteBox = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    noteBox.current?.focus({ preventScroll: true })
  }, [])
  /** Null: follow what the notes say. A list: the office has taken over. */
  const [sheetText, setSheetText] = useState<string | null>(null)
  const [titles, setTitles] = useState<Record<string, string>>({})
  const [specText, setSpecText] = useState<string | null>(null)
  const [specTitles, setSpecTitles] = useState<Record<string, string>>({})
  /** A whole new set: its sheets and table of contents as pasted, compared with what we have. */
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
  const [lineFor, setLineFor] = useState<string | null>(null)
  /** Answered questions kept out of this set's note, by id. The rest ride in it. */
  const [skipQ, setSkipQ] = useState<string[]>([])
  const answers = answeredNotInSet(project)
  const carriedQs = answers.filter((q) => !skipQ.includes(q.id))
  const tradeOf = (packageId: string | null) => project.trades.find((p) => p.id === packageId)?.trade ?? null
  /** What the set says changed: the office's words, then each answer it carries. */
  const fullNote = [note.trim(), ...carriedQs.map((q) => questionInNote(q, tradeOf(q.packageId)))].filter(Boolean).join('\n')

  const index = project.sheets
  const manual = project.specs
  const currentRev = project.planSets.reduce((m, s) => Math.max(m, s.rev), 0)
  const currentLabel = project.planSets.find((s) => s.rev === currentRev)?.label ?? 'the last set'
  const noteSheets = useMemo(() => {
    const raw = sheetText === null ? sheetsInText(note) : sheetText.split(',').map((x) => x.trim()).filter(Boolean)
    return [...new Set(raw.map((id) => sheetAsIndexed(project, id)))]
  }, [note, sheetText, project])
  const whole = !(SET_KINDS.find((k) => k.kind === kind)?.numbered ?? true)
  const diff = useMemo(() => {
    const listed = sheetsOfRows(indexRows)
    return listed.length === 0 ? null : indexDiff(index, listed.map((x) => ({ ...x, id: sheetAsIndexed(project, x.id) })))
  }, [indexRows, index, project])
  const indexRowsToFix = Object.keys(rowProblems(indexRows)).length
  const sheets = [...new Set([...noteSheets, ...(diff ? [...diff.added.map((x) => x.id), ...diff.renamed.map((x) => x.id), ...diff.gone.map((x) => x.id)] : [])])]
  const noteTakesOut = takenOutInText(note, (line) => sheetsInText(line).map((id) => sheetAsIndexed(project, id)))
  const goneSheets = sheets.filter(
    (id) => index.some((x) => x.id === id) && (goneMarks[id] ?? (Boolean(diff?.gone.some((g) => g.id === id)) || noteTakesOut.includes(id))),
  )
  const retitled: (PlanSheet & { wasTitle?: string })[] = (diff?.renamed ?? [])
    .filter((r) => !goneSheets.includes(r.id))
    .map((r) => ({ id: r.id, title: r.to, wasTitle: index.find((x) => x.id === r.id)?.title }))
  const added: PlanSheet[] = sheets
    .filter((id) => !index.some((s) => s.id === id))
    .map((id) => {
      const listed = diff?.added.find((x) => x.id === id)
      return {
        id,
        title: (titles[id] ?? listed?.title ?? '').trim(),
        ...(listed?.discipline ? { discipline: listed.discipline } : {}),
        ...(listed?.page ? { page: listed.page } : {}),
      }
    })
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
  const retitledSpecs: (SpecSection & { wasTitle?: string })[] = (specDiff?.renamed ?? [])
    .filter((r) => !goneSpecs.includes(r.id))
    .map((r) => ({ id: r.id, title: r.to, wasTitle: manual.find((x) => x.id === r.id)?.title }))
  const addedSpecs: SpecSection[] = specIds
    .filter((id) => !manual.some((x) => x.id === id))
    .map((id) => ({ id, title: (specTitles[id] ?? specDiff?.added.find((x) => x.id === id)?.title ?? '').trim() }))
  const bySheets = packagesForSheets(project, sheets, added)
  const bySpecs = packagesForSpecs(project, specIds)
  const touches = touchOverride ?? project.trades.filter((p) => bySheets.includes(p.id) || bySpecs.includes(p.id)).map((p) => p.id)
  /** Every sheet once the set is in: the index without what it takes out, renamed as it says, and the ones it adds. */
  const allSheets: PlanSheet[] = [
    ...index.filter((x) => !goneSheets.includes(x.id)).map((x) => ({ ...x, title: retitled.find((r) => r.id === x.id)?.title ?? x.title })),
    ...added.filter((a) => !index.some((s) => s.id === a.id)),
  ]
  const sheetsOfTrade = (trade: string) => {
    const from = tradesForSheets(allSheets).find((g) => g.trade === trade)?.from ?? []
    return allSheets.filter((s) => from.includes(s.id))
  }
  const specs: SpecSection[] = [
    ...manual.filter((x) => !goneSpecs.includes(x.id)).map((x) => ({ ...x, title: retitledSpecs.find((r) => r.id === x.id)?.title ?? x.title })),
    ...addedSpecs,
  ]
  const specsOfTrade = (trade: string) => specs.filter((x) => tradeForSpec(x.id) === trade)
  const specNamed = (id: string): SpecSection => specs.find((x) => x.id === id) ?? manual.find((x) => x.id === id) ?? { id, title: '' }
  /** Lines whose sheets or sections all go, and what the office ties each to instead. */
  const left = linesLeftBehind(project, goneSheets, goneSpecs)
  const retiedLines = left
    .map((l) => {
      const toSheets = retie[`${l.item.id}|sheets`]
      const toSpecs = retie[`${l.item.id}|specs`]
      return {
        packageId: l.packageId,
        scopeId: l.item.id,
        ...(l.sheets.length > 0 && toSheets ? { sheets: toSheets === 'whole' ? [] : [toSheets] } : {}),
        ...(l.specs.length > 0 && toSpecs ? { specs: toSpecs === 'whole' ? [] : [toSpecs] } : {}),
      }
    })
    .filter((l) => l.sheets || l.specs)
  /** The scope lines a set names to a trade: the ones that read from its sheets or sections, a line that names none included. */
  const linesHeard = (pkg: GcProjectView['trades'][number]) => {
    const bySheet = linesOnSheets(project, pkg, sheets, added)
    const bySpec = linesOnSpecs(project, pkg, specIds, addedSpecs)
    return pkg.scope.filter((l) => bySheet.includes(l) || bySpec.includes(l))
  }
  const onJob = (trade: string) =>
    project.trades.some((p) => p.trade.toLowerCase() === trade.toLowerCase()) || brought.some((b) => b.trade.toLowerCase() === trade.toLowerCase())
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
  const broughtDrafts = brought.map((b) => ({
    trade: b.trade,
    budget: Number(b.budget.replace(/[^0-9.]/g, '')) || 0,
    ours: b.ours,
    scope: b.scope.map((l) => l.label),
    scopeSheets: b.scope.map((l) => l.sheets ?? guessLineSheets(l.label, sheetsOfTrade(b.trade))),
    ...(specs.length > 0 ? { scopeSpecs: b.scope.map((l) => l.specs ?? guessLineSpecs(l.label, specsOfTrade(b.trade))) } : {}),
    ...(usualExcludes(b.trade).length > 0 ? { excludes: usualExcludes(b.trade) } : {}),
  }))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('[role="listbox"]')) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const compared = diff !== null || specDiff !== null
  const driveStop = driveUrl.trim() === '' ? (whole || sheets.length > 0 ? driveLinkProblem('') : null) : driveLinkProblem(driveUrl)
  const missing =
    fullNote === '' && !compared
      ? 'Say what changed first.'
      : indexRowsToFix > 0
        ? `Fix or take out the ${indexRowsToFix === 1 ? 'sheet row' : `${indexRowsToFix} sheet rows`} marked in the new set's sheets.`
        : label === ''
          ? 'Give the set a name.'
          : checker === ''
            ? 'Say who checked the set.'
            : driveStop
  const addLine = (packageId: string, words: string) => {
    const t = words.trim()
    if (t !== '') setNewLines((all) => ({ ...all, [packageId]: [...(all[packageId] ?? []), t] }))
  }
  const newLineSheets = (trade: string) => sheetsOfTrade(trade).map((x) => x.id).filter((id) => sheets.includes(id))
  const newLineSpecs = (trade: string) => specIds.filter((id) => tradeForSpec(id) === trade && !goneSpecs.includes(id))
  const linesAdded = project.trades.filter((p) => touches.includes(p.id)).reduce((n, p) => n + (newLines[p.id]?.length ?? 0), 0)

  const issue = () =>
    onIssue({
      projectId: project.id,
      label,
      kind,
      note: fullNote,
      checkedByUserId: checker,
      questionIds: carriedQs.map((q) => q.id),
      ...(driveUrl.trim() !== '' ? { drive: { url: driveUrl.trim(), access: null, checkedOn: null } } : {}),
      sheets,
      addedSheets: added,
      removedSheets: goneSheets,
      retitledSheets: retitled,
      specs: specIds,
      addedSpecs,
      removedSpecs: goneSpecs,
      retitledSpecs,
      newTrades: broughtDrafts,
      newLines: project.trades
        .filter((p) => touches.includes(p.id))
        .flatMap((p) => (newLines[p.id] ?? []).map((l) => ({ packageId: p.id, label: l, sheets: newLineSheets(p.trade), specs: newLineSpecs(p.trade) }))),
      retiedLines,
    })

  const field = { ...input, width: '100%', boxSizing: 'border-box' as const }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(0.75rem + var(--app-top-chrome, 0px)) 0.75rem 0.75rem' }}
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
          maxHeight: 'min(94vh, 100%)',
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
              This becomes <strong>{label || 'a set with no name'}</strong>. It replaces {currentLabel} as the plans the job reads.
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
                <input style={{ ...input, flex: '0 1 12rem' }} value={labelText ?? nextSetLabel(project, kind)} onChange={(e) => setLabelText(e.target.value)} aria-label="What this set is called" />
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>An addendum comes while we bid. A bulletin comes once the job is ours. Each one counts on its own.</span>
              <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <label htmlFor="gc-set-checker" style={{ fontWeight: 600 }}>
                  Checked by
                </label>
                <div style={{ flex: '0 1 16rem', minWidth: 0 }}>
                  <Picker
                    id="gc-set-checker"
                    value={checker}
                    onChange={setChecker}
                    placeholder="Pick who checked it"
                    ariaLabel="Who checked the set"
                    searchPlaceholder="Search our people"
                    options={[
                      pickerGroup('team', 'Our people'),
                      ...team.map((m) => ({ value: m.id, label: `${m.name} ${roleWords[m.role] ?? m.role}`, labelContent: pickerRow(m.name, roleWords[m.role] ?? m.role), triggerContent: pickerFace(m.name) })),
                    ]}
                  />
                </div>
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>The files are in the job's Google Drive folder. Someone on our team checks them against the notes before the set goes out.</span>
              <DriveLinkField label="Google Drive link to this set" url={driveUrl} onUrl={setDriveUrl} />
            </div>
            <textarea
              ref={noteBox}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              aria-label="What changed"
              placeholder={'For example:\nE-201: two more floor boxes in bay 2.\nM-101: RTU-3 moved 6 ft north. Curb detail changed on A-401.\nSection 09 91 23: low-VOC paint throughout.\nC-201 is taken out.'}
              style={{ ...field, fontFamily: 'inherit', resize: 'vertical' }}
            />
            {answers.length > 0 && (
              <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.7rem', borderRadius: 8, border: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.35rem', fontSize: '0.875rem' }}>
                <strong>Answers to carry in this set</strong>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>An answered question goes out with the next set, in its note. Untick one to keep it out.</span>
                {answers.map((q) => (
                  <label key={q.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!skipQ.includes(q.id)} onChange={(e) => setSkipQ((all) => (e.target.checked ? all.filter((x) => x !== q.id) : [...all, q.id]))} style={{ marginTop: '0.2rem' }} />
                    <span>{questionInNote(q, tradeOf(q.packageId))}</span>
                  </label>
                ))}
              </div>
            )}
            {whole && (
              <div style={{ marginTop: '0.6rem', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.4rem', fontSize: '0.875rem' }}>
                <strong>The new set's sheets</strong>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  A whole set comes with every sheet. List them and they are compared with the sheets we have. You see what is new, what is gone and what is renamed.
                </span>
                <SheetIndexTable rows={indexRows} onRows={setIndexRows} projectName={project.name} setLabel={label || 'the new set'} />
                {manual.length > 0 && (
                  <>
                    <strong style={{ marginTop: '0.3rem' }}>The new table of contents</strong>
                    <textarea
                      value={tocText}
                      onChange={(e) => setTocText(e.target.value)}
                      rows={3}
                      aria-label="The new table of contents"
                      placeholder={'09 29 00  GYPSUM BOARD\n09 91 23  INTERIOR PAINTING'}
                      style={{ ...field, fontFamily: 'inherit', resize: 'vertical' }}
                    />
                  </>
                )}
              </div>
            )}
          </section>

          <section>
            <StepHeading n={2} title="What it changes" hint="Read from the notes. Fix anything that is wrong." />
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.6rem', fontSize: '0.875rem' }}>
              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                Sheets that changed
                <input style={{ ...input, flex: '1 1 14rem' }} value={sheetText ?? noteSheets.join(', ')} onChange={(e) => setSheetText(e.target.value)} placeholder="None found yet. Type them, like A-201, S-101" />
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
                            <button type="button" onClick={() => setGoneMarks((m) => ({ ...m, [id]: !out }))} style={{ border: 'none', background: 'transparent', color: 'var(--text-blue-500)', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}>
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
                  The new table of contents against ours: {specDiff.added.length} new, {specDiff.gone.length} gone, {specDiff.renamed.length} renamed, {specDiff.same.length} the same.
                </span>
              )}
              {(manual.length > 0 || specIds.length > 0 || specText !== null) && (
                <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  Spec sections that changed
                  <input style={{ ...input, flex: '1 1 14rem' }} value={specText ?? noteSpecs.join(', ')} onChange={(e) => setSpecText(e.target.value)} placeholder="None found yet. Type them, like 09 91 23, 22 40 00" />
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
                            <button type="button" onClick={() => setGoneMarks((m) => ({ ...m, [`spec:${id}`]: !out }))} style={{ border: 'none', background: 'transparent', color: 'var(--text-blue-500)', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}>
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
                {project.trades.map((p) => (
                  <label key={p.id} style={{ whiteSpace: 'nowrap' }}>
                    <input type="checkbox" checked={touches.includes(p.id)} onChange={(e) => setTouchOverride(e.target.checked ? [...touches, p.id] : touches.filter((t) => t !== p.id))} /> {p.trade}
                  </label>
                ))}
                {touchOverride !== null && <Btn kind="quiet" onClick={() => setTouchOverride(null)}>Guess from the sheets again</Btn>}
              </div>
              {touchOverride === null && sheets.length + specIds.length > 0 && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {specIds.length > 0 ? 'The trades are a guess from the sheets and the section numbers. Tick or untick to fix it.' : 'The trades are a guess from the sheet letters and titles. Tick or untick to fix it.'}
                </span>
              )}
              {touches.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.2rem' }}>
                  <span style={{ fontWeight: 600 }}>The scope lines it touches</span>
                  {linesAdded > 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>A quote already in never answered a new line. Compare quotes shows it as not clear until you set a cost to cover it.</span>}
                  {project.trades
                    .filter((p) => touches.includes(p.id))
                    .map((p) => {
                      const hit = linesHeard(p)
                      const adding = newLines[p.id] ?? []
                      const reads = [...newLineSheets(p.trade), ...newLineSpecs(p.trade)]
                      return (
                        <div key={p.id} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ minWidth: '8rem' }}>{p.trade}</span>
                          {hit.length === 0 && adding.length === 0 ? (
                            <span style={{ color: 'var(--text-muted)' }}>{specIds.length > 0 ? 'no line names these sheets or sections, so the trade as a whole' : 'no line names these sheets, so the trade as a whole'}</span>
                          ) : (
                            hit.map((l) => (
                              <Chip key={l.id} tone="amber">
                                {l.label}
                              </Chip>
                            ))
                          )}
                          {adding.map((l, i) => (
                            <span
                              key={`${l}-${i}`}
                              title={reads.length > 0 ? `Reads from ${reads.join(', ')}` : `Reads every ${inSentence(p.trade)} sheet`}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem', padding: '0.1rem 0.15rem 0.1rem 0.5rem', borderRadius: 999, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-500)', fontSize: '0.8rem' }}
                            >
                              new: {l}
                              <button type="button" onClick={() => setNewLines((all) => ({ ...all, [p.id]: adding.filter((_, j) => j !== i) }))} aria-label={`Take out the new line ${l}`} style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', padding: '0 0.25rem', lineHeight: 1 }}>
                                ×
                              </button>
                            </span>
                          ))}
                          {lineFor === p.id ? (
                            <>
                              <BookLineSearch trade={p.trade} book={book} here={[...p.scope.map((x) => x.label), ...adding]} onPick={(line) => addLine(p.id, line.words)} onNew={(words) => addLine(p.id, words)} autoFocus onEscape={() => setLineFor(null)} />
                              <Btn kind="quiet" onClick={() => setLineFor(null)}>Done</Btn>
                            </>
                          ) : (
                            <Btn kind="quiet" onClick={() => setLineFor(p.id)}>+ Add a line this set brings</Btn>
                          )}
                        </div>
                      )
                    })}
                </div>
              )}
              {left.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.35rem', padding: '0.5rem 0.7rem', borderRadius: 8, background: 'var(--bg-amber-tint)' }}>
                  <span style={{ fontWeight: 600 }}>Lines left with nothing to read</span>
                  <span style={{ color: 'var(--text-600)', fontSize: '0.8rem' }}>Everything these lines read from is taken out. Pick what each one reads now, or leave it as it is.</span>
                  {left.map((l) => {
                    const trade = project.trades.find((p) => p.id === l.packageId)?.trade ?? ''
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
                      <Btn key={g.trade} kind="quiet" onClick={() => bring(g.trade)}>
                        Add {g.trade}
                      </Btn>
                    ))}
                  </div>
                )}
                {brought.map((b, i) => (
                  <div key={b.trade} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.5rem' }}>
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
                        <input style={{ ...input, width: '7rem', textAlign: 'right' }} inputMode="numeric" value={b.budget} onChange={(e) => change(i, { budget: e.target.value })} placeholder="$0" />
                      </label>
                      <Btn kind="quiet" onClick={() => setBrought((all) => all.filter((_, j) => j !== i))}>Take it out</Btn>
                    </div>
                    <ScopeLines trade={b.trade} lines={b.scope} onChange={(scope) => change(i, { scope })} sheets={allSheets} tradeSheets={sheetsOfTrade(b.trade)} specs={specs} tradeSpecs={specsOfTrade(b.trade)} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div style={{ padding: '0.65rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-600)' }}>
            {problem
              ? problem
              : `${label || 'The set'} replaces ${currentLabel}.${linesAdded > 0 ? ` It adds ${linesAdded} scope ${linesAdded === 1 ? 'line' : 'lines'}.` : ''}${
                  brought.length > 0 ? ` It adds ${brought.length === 1 ? 'a trade' : `${brought.length} trades`}. Nobody is asked yet.` : ''
                }${goneSheets.length + goneSpecs.length > 0 ? ` It takes out ${goneSheets.length + goneSpecs.length}.` : ''} No email goes out yet.`}
          </span>
          <span style={{ flex: 1 }} />
          {missing && <span style={{ fontSize: '0.85rem', color: 'var(--text-amber-700)', fontWeight: 600 }}>{missing}</span>}
          <Btn kind="quiet" onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" disabled={missing !== null || Boolean(issuing)} title={missing ?? undefined} onClick={issue}>
            {issuing ? 'Putting it on…' : `Issue ${label || 'the set'}`}
          </Btn>
        </div>
      </div>
    </div>
  )
}
