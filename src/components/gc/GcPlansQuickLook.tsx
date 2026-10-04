import { useEffect, useMemo, useRef, useState } from 'react'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import {
  SPEC_DIVISIONS,
  currentRev,
  lineReads,
  lineReadsSpec,
  lineSpecs,
  specDivision,
  specsAtRev,
  setThatAddedLine,
  planLabel,
  plansReach,
  disciplineOf,
  sheetsAtRev,
  sheetsGoneAtRev,
  specsGoneAtRev,
  shortDate,
  type GcProject,
  type SheetInSet,
  type SpecInSet,
} from '../../lib/gcMode/gcModel'
import { Btn, Chip } from './gcUi'
import { PlanSetDriveLine } from './GcNewProjectDriveLink'

/**
 * GC mode design spike: the plans, one click from the Project Board. The Bid Board's plans link
 * opens a folder in a new tab. A GC's plans come in sets, so this window opens on the newest
 * set, lists its sheets, marks what the last addendum changed and flips through them. The
 * drawings are stand-ins: the real build shows the sheet's own page here.
 */

interface Props {
  project: GcProject
  onClose: () => void
  /** Go to the project's Plans tab (who has which set). */
  onSeeWhoHasIt: () => void
}

export function GcPlansQuickLook({ project, onClose, onSeeWhoHasIt }: Props) {
  const newest = currentRev(project)
  // On a phone the drawing comes first and the list of sheets follows it, one column that scrolls as one.
  const narrow = useMatchMedia('(max-width: 699px)')
  const scroller = useRef<HTMLDivElement>(null)
  /** Open a sheet or a section from the list. On a phone the list is below the drawing, so go back up to it. */
  const showFromList = (open: (id: string) => void) => (id: string) => {
    open(id)
    if (narrow) scroller.current?.scrollTo({ top: 0 })
  }
  const [rev, setRev] = useState(newest)
  const sheets = useMemo(() => sheetsAtRev(project, rev), [project, rev])
  const firstChanged = sheets.find((s) => s.changedInRev === rev)
  const [sheetId, setSheetId] = useState(firstChanged?.id ?? sheets[0]?.id ?? '')
  // A sheet a set took out stays to read, crossed out, so a quote priced on it still makes sense.
  const goneSheets = useMemo(() => sheetsGoneAtRev(project, rev), [project, rev])
  const goneSheet = sheets.some((s) => s.id === sheetId) ? null : (goneSheets.find((g) => g.id === sheetId) ?? null)
  const index = Math.max(0, sheets.findIndex((s) => s.id === sheetId))
  const sheet = goneSheet ? undefined : sheets[index]
  const set = project.planSets.find((s) => s.rev === rev)
  const reach = plansReach(project)
  const sets = [...project.planSets].sort((a, b) => b.rev - a.rev)
  // The project manual beside the sheets: the same window flips through its sections.
  const specs = useMemo(() => specsAtRev(project, rev), [project, rev])
  const [view, setView] = useState<'sheets' | 'specs'>('sheets')
  const showSpecs = view === 'specs' && specs.length > 0
  const [specId, setSpecId] = useState(specs.find((x) => x.changedInRev === rev)?.id ?? specs[0]?.id ?? '')
  const goneSpecs = useMemo(() => specsGoneAtRev(project, rev), [project, rev])
  const goneSpec = specs.some((x) => x.id === specId) ? null : (goneSpecs.find((g) => g.id === specId) ?? null)
  const specIndex = Math.max(0, specs.findIndex((x) => x.id === specId))
  const spec = goneSpec ? undefined : specs[specIndex]
  const sheetOnScreen = goneSheet?.id ?? sheet?.id ?? ''
  const specOnScreen = goneSpec?.id ?? spec?.id ?? ''

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
      if (step === 0) return
      e.preventDefault()
      if (showSpecs) {
        const next = specs[Math.min(specs.length - 1, Math.max(0, specIndex + step))]
        if (next) setSpecId(next.id)
        return
      }
      const next = sheets[Math.min(sheets.length - 1, Math.max(0, index + step))]
      if (next) setSheetId(next.id)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [sheets, index, specs, specIndex, showSpecs, onClose])

  const groups: { discipline: string; rows: SheetInSet[] }[] = []
  for (const s of sheets) {
    const discipline = disciplineOf(s)
    const group = groups.find((g) => g.discipline === discipline)
    if (group) group.rows.push(s)
    else groups.push({ discipline, rows: [s] })
  }
  const changedCount = sheets.filter((s) => s.changedInRev === rev).length
  const sheetsOut = goneSheets.filter((g) => g.goneInRev === rev).length
  const specsOut = goneSpecs.filter((g) => g.goneInRev === rev).length
  /** The scope lines that read from the sheet on screen, trade by trade. */
  const onSheet = sheetOnScreen
    ? project.packages
        .map((pkg) => ({ pkg, lines: pkg.scope.map((item) => ({ item, ...lineReads(project, pkg, item) })).filter((l) => l.sheets.includes(sheetOnScreen)) }))
        .filter((t) => t.lines.length > 0)
    : []
  const revisedSpecs = specs.filter((x) => x.changedInRev === rev && !x.added).length
  const addedSpecs = specs.filter((x) => x.changedInRev === rev && x.added).length
  const specGroups: { division: string; rows: SpecInSet[] }[] = []
  for (const x of specs) {
    const division = specDivision(x.id)
    const group = specGroups.find((g) => g.division === division)
    if (group) group.rows.push(x)
    else specGroups.push({ division, rows: [x] })
  }
  /** The scope lines that read from the section on screen, trade by trade. */
  const onSpec = specOnScreen
    ? project.packages
        .map((pkg) => ({
          pkg,
          lines: pkg.scope
            .filter((item) => lineReadsSpec(project, pkg, item, specOnScreen))
            .map((item) => {
              const said = lineSpecs(project, pkg, item)
              return { item, guessed: said.guessed, wholeTrade: said.specs.length === 0 }
            }),
        }))
        .filter((t) => t.lines.length > 0)
    : []
  const here = showSpecs
    ? { id: specOnScreen, trades: onSpec, kind: 'section' }
    : { id: sheetOnScreen, trades: onSheet.map((t) => ({ pkg: t.pkg, lines: t.lines.map((l) => ({ item: l.item, guessed: l.guessed, wholeTrade: l.wholeTrade })) })), kind: 'sheet' }
  const guessedOn = here.trades.some((t) => t.lines.some((l) => l.guessed && !l.wholeTrade))
  const wholeOn = here.trades.some((t) => t.lines.some((l) => l.wholeTrade))

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${project.name} plans`}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          color: 'var(--text-base)',
          borderRadius: 10,
          width: 'min(1100px, 100%)',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--border-strong)',
        }}
      >
        <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{project.name} · plans</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{[project.architect, project.sizeNote].filter(Boolean).join(' · ')}</div>
          </div>
          <div role="group" aria-label="Plan set" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginLeft: 'auto' }}>
            {sets.map((s) => {
              const active = s.rev === rev
              return (
                <button
                  key={s.rev}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setRev(s.rev)
                    const at = sheetsAtRev(project, s.rev)
                    if (!at.some((x) => x.id === sheetId)) setSheetId(at[0]?.id ?? '')
                    const atSpecs = specsAtRev(project, s.rev)
                    if (!atSpecs.some((x) => x.id === specId)) setSpecId(atSpecs[0]?.id ?? '')
                  }}
                  style={{
                    padding: '0.3rem 0.7rem',
                    borderRadius: 999,
                    border: `1px solid ${active ? 'var(--text-blue-500)' : 'var(--border-strong)'}`,
                    background: active ? 'var(--bg-blue-tint)' : 'var(--surface)',
                    color: active ? 'var(--text-blue-500)' : 'var(--text-600)',
                    fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  {s.label} · {shortDate(s.issuedOn)}
                  {s.rev === newest ? ' · newest' : ''}
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}
          >
            ×
          </button>
        </div>

        {set && (
          <div
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.85rem',
              background: rev < newest ? 'var(--bg-amber-tint)' : 'var(--bg-subtle)',
              borderBottom: '1px solid var(--border)',
            }}
          >
            {rev < newest && <strong>An older set. {planLabel(project, newest)} replaced it. </strong>}
            {set.note}
            {set.checkedBy && <> Checked by {set.checkedBy}.</>}
            {changedCount > 0 && <> {changedCount} {changedCount === 1 ? 'sheet' : 'sheets'} changed in this set.</>}
            {sheetsOut > 0 && <> {sheetsOut} {sheetsOut === 1 ? 'sheet' : 'sheets'} taken out.</>}
            {revisedSpecs > 0 && <> {revisedSpecs} spec {revisedSpecs === 1 ? 'section' : 'sections'} revised.</>}
            {addedSpecs > 0 && <> {addedSpecs} spec {addedSpecs === 1 ? 'section' : 'sections'} new to the manual.</>}
            {specsOut > 0 && <> {specsOut} spec {specsOut === 1 ? 'section' : 'sections'} taken out.</>}
            {set.drive && (
              <div style={{ marginTop: '0.35rem' }}>
                <PlanSetDriveLine projectId={project.id} set={set} />
              </div>
            )}
          </div>
        )}

        <div
          ref={scroller}
          style={{
            display: 'grid',
            gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : 'minmax(11rem, 17rem) minmax(0, 1fr)',
            minHeight: 0,
            flex: 1,
            overflowY: narrow ? 'auto' : undefined,
          }}
        >
          <div style={narrow ? { order: 2, padding: '0.5rem', borderTop: '1px solid var(--border)' } : { overflowY: 'auto', borderRight: '1px solid var(--border)', padding: '0.5rem' }}>
            {specs.length > 0 && (
              <div role="group" aria-label="Sheets or specs" style={{ display: 'flex', gap: '0.3rem', padding: '0.1rem 0.2rem 0.5rem' }}>
                {(['sheets', 'specs'] as const).map((v) => {
                  const active = (v === 'specs') === showSpecs
                  return (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setView(v)}
                      style={{
                        flex: 1,
                        padding: '0.25rem 0.5rem',
                        borderRadius: 999,
                        border: `1px solid ${active ? 'var(--text-blue-500)' : 'var(--border-strong)'}`,
                        background: active ? 'var(--bg-blue-tint)' : 'var(--surface)',
                        color: active ? 'var(--text-blue-500)' : 'var(--text-600)',
                        fontWeight: active ? 600 : 400,
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                      }}
                    >
                      {v === 'sheets' ? `Sheets · ${sheets.length}` : `Specs · ${specs.length}`}
                    </button>
                  )
                })}
              </div>
            )}
            {showSpecs &&
              specGroups.map((g) => (
                <div key={g.division} style={{ marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.68rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}>
                    {g.division} · {SPEC_DIVISIONS[g.division] ?? 'Other'}
                  </div>
                  {g.rows.map((x) => {
                    const active = x.id === spec?.id
                    return (
                      <button
                        key={x.id}
                        type="button"
                        onClick={() => showFromList(setSpecId)(x.id)}
                        aria-current={active}
                        style={{
                          display: 'flex',
                          gap: '0.4rem',
                          alignItems: 'baseline',
                          width: '100%',
                          textAlign: 'left',
                          padding: '0.3rem 0.4rem',
                          border: 'none',
                          borderRadius: 5,
                          background: active ? 'var(--bg-blue-tint)' : 'transparent',
                          color: 'var(--text-base)',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                        }}
                      >
                        <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{x.id}</span>
                        <span style={{ flex: 1, minWidth: 0 }}>{x.title}</span>
                        {x.changedInRev === rev && rev > 0 && (
                          <Chip tone="violet" title={x.was ? `Was: ${x.was}` : undefined}>
                            {x.added ? 'new' : x.was ? 'renamed' : 'revised'}
                          </Chip>
                        )}
                        {x.changedInRev !== null && x.changedInRev < rev && <Chip tone="grey">{planLabel(project, x.changedInRev)}</Chip>}
                      </button>
                    )
                  })}
                </div>
              ))}
            {showSpecs && goneSpecs.length > 0 && (
              <GoneGroup project={project} rows={goneSpecs} active={goneSpec?.id ?? null} onPick={showFromList(setSpecId)} />
            )}
            {!showSpecs && groups.map((g) => (
              <div key={g.discipline} style={{ marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.68rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}>
                  {g.discipline}
                </div>
                {g.rows.map((s) => {
                  const active = s.id === sheet?.id
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => showFromList(setSheetId)(s.id)}
                      aria-current={active}
                      style={{
                        display: 'flex',
                        gap: '0.4rem',
                        alignItems: 'baseline',
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.3rem 0.4rem',
                        border: 'none',
                        borderRadius: 5,
                        background: active ? 'var(--bg-blue-tint)' : 'transparent',
                        color: 'var(--text-base)',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                      }}
                    >
                      <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{s.id}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>{s.title}</span>
                      {s.changedInRev === rev && rev > 0 && (
                        <Chip tone="amber" title={s.was ? `Was: ${s.was}` : undefined}>
                          {s.added ? 'new' : s.was ? 'renamed' : 'changed'}
                        </Chip>
                      )}
                      {s.changedInRev !== null && s.changedInRev < rev && <Chip tone="grey">{planLabel(project, s.changedInRev)}</Chip>}
                    </button>
                  )
                })}
              </div>
            ))}
            {!showSpecs && goneSheets.length > 0 && (
              <GoneGroup project={project} rows={goneSheets} active={goneSheet?.id ?? null} onPick={showFromList(setSheetId)} />
            )}
          </div>

          <div style={{ padding: '0.75rem', overflow: narrow ? undefined : 'auto', background: 'var(--bg-muted)', order: narrow ? 1 : undefined }}>
            {showSpecs ? (
              <>
                {spec && <StandInSection project={project} spec={spec} rev={rev} />}
                {goneSpec && (
                  <StandInSection
                    project={project}
                    spec={{ id: goneSpec.id, title: goneSpec.title, changedInRev: goneSpec.goneInRev, added: false }}
                    rev={rev}
                    goneBy={planLabel(project, goneSpec.goneInRev)}
                  />
                )}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                  <Btn disabled={specIndex === 0} onClick={() => setSpecId(specs[specIndex - 1]?.id ?? specId)}>← Back</Btn>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {goneSpec ? 'Taken out. It stays here so a quote priced on it can still be read.' : `Section ${specIndex + 1} of ${specs.length}. The arrow keys flip sections.`}
                  </span>
                  <Btn disabled={specIndex >= specs.length - 1} onClick={() => setSpecId(specs[specIndex + 1]?.id ?? specId)}>Next →</Btn>
                </div>
              </>
            ) : (
              <>
                {sheet && <StandInSheet project={project} sheet={sheet} rev={rev} />}
                {goneSheet && (
                  <StandInSheet
                    project={project}
                    sheet={{ id: goneSheet.id, title: goneSheet.title, changedInRev: null, added: false }}
                    rev={rev}
                    goneBy={planLabel(project, goneSheet.goneInRev)}
                  />
                )}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                  <Btn disabled={index === 0} onClick={() => setSheetId(sheets[index - 1]?.id ?? sheetId)}>← Back</Btn>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {goneSheet ? 'Taken out. It stays here so a quote priced on it can still be read.' : `Sheet ${index + 1} of ${sheets.length}. The arrow keys flip sheets.`}
                  </span>
                  <Btn disabled={index >= sheets.length - 1} onClick={() => setSheetId(sheets[index + 1]?.id ?? sheetId)}>Next →</Btn>
                </div>
              </>
            )}
            {here.id !== '' && (
              <div style={{ marginTop: '0.6rem', padding: '0.5rem 0.65rem', borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: '0.85rem', display: 'grid', gap: '0.3rem' }}>
                <strong>Scope that reads from {here.id}</strong>
                {here.trades.length === 0 ? (
                  <span style={{ color: 'var(--text-muted)' }}>No scope line names this {here.kind}.</span>
                ) : (
                  here.trades.map((t) => (
                    <div key={t.pkg.id} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ minWidth: '7rem' }}>{t.pkg.trade}</span>
                      {t.lines.map((l) => {
                        const by = setThatAddedLine(project, l.item.id)
                        return (
                          <Chip key={l.item.id} tone={by ? 'blue' : 'grey'} title={by ? `${by} added this line` : undefined}>
                            {l.item.label}
                            {by ? ` · new in ${by}` : ''}
                          </Chip>
                        )
                      })}
                    </div>
                  ))
                )}
                {guessedOn && <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Some of these are guessed from the line's words. Set them when you write the scope.</span>}
                {wholeOn && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    A line that names no {here.kind} reads every {here.kind} of its trade, so it shows here too.
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '0.6rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
          {reach.of === 0 ? (
            <Chip tone="grey">No trade partner is asked yet, so nobody has the plans</Chip>
          ) : (
            <Chip tone={reach.have === reach.of ? 'green' : 'amber'}>
              {reach.have} of {reach.of} trade partners have opened {planLabel(project, newest)}
            </Chip>
          )}
          <Btn kind="quiet" onClick={onSeeWhoHasIt}>See who has it</Btn>
          <span style={{ flex: 1 }} />
          <Btn
            onClick={() => undefined}
            title="In the real build this opens the plans folder in a new tab, as the Bid Board's plans link does."
          >
            Open the folder ↗
          </Btn>
        </div>
      </div>
    </div>
  )
}

/** The sheets or sections the sets took out, crossed out under the rest, each still there to open. */
function GoneGroup({
  project,
  rows,
  active,
  onPick,
}: {
  project: GcProject
  rows: { id: string; title: string; goneInRev: number }[]
  active: string | null
  onPick: (id: string) => void
}) {
  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <div style={{ fontSize: '0.68rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}>Taken out</div>
      {rows.map((g) => (
        <button
          key={g.id}
          type="button"
          onClick={() => onPick(g.id)}
          aria-current={g.id === active}
          style={{
            display: 'flex',
            gap: '0.4rem',
            alignItems: 'baseline',
            width: '100%',
            textAlign: 'left',
            padding: '0.3rem 0.4rem',
            border: 'none',
            borderRadius: 5,
            background: g.id === active ? 'var(--bg-blue-tint)' : 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}
        >
          <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0, textDecoration: 'line-through' }}>{g.id}</span>
          <span style={{ flex: 1, minWidth: 0, textDecoration: 'line-through' }}>{g.title}</span>
          <Chip tone="red">{planLabel(project, g.goneInRev)}</Chip>
        </button>
      ))}
    </div>
  )
}

/** A stand-in for a section's first page: its number and title, the three parts every section has, and a mark where a set revised it. */
function StandInSection({ project, spec, rev, goneBy }: { project: GcProject; spec: SpecInSet; rev: number; goneBy?: string }) {
  const revisedHere = !goneBy && spec.changedInRev === rev && rev > 0
  const by = spec.changedInRev !== null ? planLabel(project, spec.changedInRev) : null
  const parts = ['PART 1  GENERAL', 'PART 2  PRODUCTS', 'PART 3  EXECUTION']
  return (
    <div
      data-theme="light"
      style={{ background: 'var(--surface)', color: 'var(--text-slate-900)', border: '1px solid var(--border-strong)', borderRadius: 4, padding: '1.4rem 1.6rem', minHeight: '22rem', display: 'grid', alignContent: 'start', gap: '0.9rem' }}
    >
      {goneBy && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <span style={{ border: '2px solid #dc2626', color: 'var(--text-red-600)', borderRadius: 6, padding: '0.15rem 0.5rem', fontWeight: 700, fontSize: '0.8rem' }}>Taken out by {goneBy}</span>
        </div>
      )}
      {revisedHere && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <span style={{ border: '2px dashed #d97706', color: '#d97706', borderRadius: 6, padding: '0.15rem 0.5rem', fontWeight: 700, fontSize: '0.8rem' }}>
            {spec.added ? `Added by ${by}` : `Revised by ${by}`}
          </span>
        </div>
      )}
      <div style={{ textAlign: 'center', display: 'grid', gap: '0.2rem' }}>
        <span style={{ fontSize: '0.75rem', letterSpacing: '0.08em', opacity: 0.7 }}>{project.name.toUpperCase()}</span>
        <span style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '0.04em' }}>SECTION {spec.id}</span>
        <span style={{ fontWeight: 700, letterSpacing: '0.04em' }}>{spec.title.toUpperCase()}</span>
      </div>
      {parts.map((part, i) => (
        <div key={part} style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>{part}</span>
          {[0, 1, 2].map((j) => (
            <span key={j} style={{ display: 'block', height: '0.45rem', borderRadius: 2, background: 'currentColor', opacity: 0.18, width: `${92 - ((i + j) % 3) * 14}%` }} />
          ))}
        </div>
      ))}
      <span style={{ textAlign: 'center', fontSize: '0.8rem', opacity: 0.5 }}>Stand-in page. The real section shows here.</span>
    </div>
  )
}

/** A drawn stand-in for the sheet's page: a border, a title block and a mark where it changed. */
function StandInSheet({ project, sheet, rev, goneBy }: { project: GcProject; sheet: SheetInSet; rev: number; goneBy?: string }) {
  const discipline = disciplineOf(sheet)
  const changedHere = sheet.changedInRev === rev && rev > 0
  const set = project.planSets.find((s) => s.rev === (sheet.changedInRev ?? 0))
  const isPlan = !['General', 'Civil'].includes(discipline)
  const dots: { x: number; y: number }[] = []
  for (let x = 110; x <= 590; x += 80) for (let y = 160; y <= 420; y += 65) dots.push({ x, y })

  return (
    <div data-theme="light" style={{ background: 'var(--surface)', color: 'var(--text-slate-900)', border: '1px solid var(--border-strong)', borderRadius: 4 }}>
      <svg viewBox="0 0 880 560" role="img" aria-label={`${sheet.id} ${sheet.title}, a stand-in drawing`} style={{ display: 'block', width: '100%', height: 'auto' }}>
        <rect x="14" y="14" width="852" height="532" fill="none" stroke="currentColor" strokeWidth="2" />
        <line x1="690" y1="14" x2="690" y2="546" stroke="currentColor" strokeWidth="1.5" />

        {discipline === 'General' && (
          <g fill="currentColor" opacity="0.55">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <rect key={i} x="70" y={120 + i * 38} width={i % 3 === 0 ? 300 : 520 - i * 22} height="10" />
            ))}
          </g>
        )}
        {discipline === 'Civil' && (
          <g fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M60 90 L640 70 L655 480 L50 500 Z" strokeDasharray="10 5" />
            <rect x="230" y="150" width="300" height="150" strokeWidth="2.5" />
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
              <line key={i} x1={150 + i * 42} y1="350" x2={150 + i * 42} y2="410" />
            ))}
            <line x1="130" y1="350" x2="550" y2="350" />
            <path d="M90 470 C 200 430, 420 450, 630 440" opacity="0.5" />
          </g>
        )}
        {isPlan && (
          <g fill="none" stroke="currentColor">
            <rect x="70" y="120" width="560" height="340" strokeWidth="3" />
            <line x1="257" y1="120" x2="257" y2="460" strokeWidth="1.5" />
            <line x1="443" y1="120" x2="443" y2="460" strokeWidth="1.5" />
            <rect x="560" y="380" width="70" height="80" strokeWidth="1.5" />
          </g>
        )}
        {discipline === 'Structural' && (
          <g>
            {dots.map((d) => (
              <rect key={`${d.x}-${d.y}`} x={d.x - 5} y={d.y - 5} width="10" height="10" fill="currentColor" />
            ))}
          </g>
        )}
        {discipline === 'Electrical' && (
          <g fill="none" stroke="currentColor" strokeWidth="1.5">
            {dots.map((d) => (
              <circle key={`${d.x}-${d.y}`} cx={d.x} cy={d.y} r="7" />
            ))}
            <rect x="600" y="230" width="22" height="46" fill="currentColor" />
          </g>
        )}
        {discipline === 'Mechanical' && (
          <g fill="none" stroke="currentColor" strokeWidth="1.5">
            {[160, 350, 535].map((x) => (
              <g key={x}>
                <rect x={x - 28} y="200" width="56" height="44" />
                <line x1={x - 28} y1="200" x2={x + 28} y2="244" />
                <line x1={x + 28} y1="200" x2={x - 28} y2="244" />
                <line x1={x} y1="244" x2={x} y2="420" strokeDasharray="8 4" />
                <line x1={x - 60} y1="340" x2={x + 60} y2="340" strokeDasharray="8 4" />
              </g>
            ))}
          </g>
        )}
        {discipline === 'Plumbing' && (
          <g fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="110" y1="430" x2="595" y2="430" strokeDasharray="12 5" />
            {[150, 340, 525].map((x) => (
              <g key={x}>
                <ellipse cx={x} cy="405" rx="11" ry="15" />
                <rect x={x + 26} y="394" width="26" height="18" />
                <line x1={x} y1="420" x2={x} y2="430" />
              </g>
            ))}
            <line x1="595" y1="430" x2="595" y2="500" strokeDasharray="12 5" />
          </g>
        )}
        {discipline === 'Fire protection' && (
          <g stroke="currentColor" strokeWidth="1.5">
            {dots.map((d) => (
              <g key={`${d.x}-${d.y}`}>
                <line x1={d.x - 6} y1={d.y} x2={d.x + 6} y2={d.y} />
                <line x1={d.x} y1={d.y - 6} x2={d.x} y2={d.y + 6} />
              </g>
            ))}
            <line x1="110" y1="290" x2="590" y2="290" />
          </g>
        )}

        {goneBy && (
          <g stroke="#dc2626" strokeWidth="4" opacity="0.8">
            <line x1="40" y1="40" x2="660" y2="510" />
            <line x1="660" y1="40" x2="40" y2="510" />
            <rect x="170" y="240" width="360" height="62" stroke="#dc2626" strokeWidth="3" style={{ fill: 'var(--surface)' }} />
            <text x="350" y="282" textAnchor="middle" fontSize="24" fontWeight="700" fill="#dc2626" stroke="none">
              Taken out by {goneBy}
            </text>
          </g>
        )}
        {changedHere && (
          <g>
            <ellipse cx="560" cy="255" rx="95" ry="70" fill="none" stroke="#d97706" strokeWidth="3" strokeDasharray="14 7" />
            <path d="M648 196 L668 232 L628 232 Z" fill="none" stroke="#d97706" strokeWidth="2.5" />
            <text x="648" y="227" textAnchor="middle" fontSize="16" fontWeight="700" fill="#d97706">{rev}</text>
          </g>
        )}

        <text x="350" y="520" textAnchor="middle" fontSize="13" fill="currentColor" opacity="0.5">
          Stand-in drawing. The real sheet shows here.
        </text>

        <g fill="currentColor">
          <text x="704" y="48" fontSize="13" fontWeight="700">{project.architect}</text>
          <text x="704" y="92" fontSize="12" opacity="0.7">PROJECT</text>
          <text x="704" y="110" fontSize="13">{project.name}</text>
          <text x="704" y="127" fontSize="11" opacity="0.7">{project.address}</text>
          <text x="704" y="330" fontSize="12" opacity="0.7">ISSUED</text>
          <text x="704" y="348" fontSize="13">{set ? `${set.label} · ${shortDate(set.issuedOn)}` : ''}</text>
          <text x="704" y="400" fontSize="12" opacity="0.7">SHEET</text>
          <text x="704" y="420" fontSize="13">{sheet.title.length > 24 ? `${sheet.title.slice(0, 23)}…` : sheet.title}</text>
          <text x="704" y="500" fontSize="46" fontWeight="700">{sheet.id}</text>
        </g>
        <line x1="690" y1="150" x2="866" y2="150" stroke="currentColor" />
        <line x1="690" y1="370" x2="866" y2="370" stroke="currentColor" />
        <line x1="690" y1="440" x2="866" y2="440" stroke="currentColor" />
      </svg>
    </div>
  )
}
