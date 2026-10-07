import { useEffect, useMemo, useRef, useState } from 'react'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { SPEC_DIVISIONS, specDivision } from '../../lib/gc/plans'
import { disciplineOf } from '../../lib/gc/sheets'
import { lineReads, lineReadsSpec, lineSpecs } from '../../lib/gc/lineReach'
import { setLabelAt, setThatAddedLine, sheetsGoneAtSet, sheetsInSetAt, specsGoneAtSet, specsInSetAt, type SheetGone, type SheetInSet } from '../../lib/gc/planSetReads'
import type { GcProjectView } from '../../lib/gc/projectRows'
import { Btn, Chip } from './gcUi'

/**
 * GC mode, the real build, step 9: the plans window on real data, moved from the prototype
 * (branch spike/gc-mode, `GcPlansQuickLook.tsx`). It opens on the newest set, lists the sheets
 * and the manual's sections as they stood at any set, marks what each set changed, added, renamed
 * and took out (a sheet a set took out stays to read, crossed out), and says which scope lines
 * read from the sheet or section on screen. The sheet's own page comes with the PDF reader; for
 * now the card names the sheet and the set that issued it. Who has the set waits for the company
 * record.
 */

interface Props {
  project: GcProjectView
  onClose: () => void
}

const shortDate = (ymd: string) => {
  const d = new Date(`${ymd}T12:00:00`)
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function GcPlansWindow({ project, onClose }: Props) {
  const rows = project.rows
  const newest = rows.sets.reduce((m, s) => Math.max(m, s.rev), 0)
  const narrow = useMatchMedia('(max-width: 699px)')
  const scroller = useRef<HTMLDivElement>(null)
  const showFromList = (open: (id: string) => void) => (id: string) => {
    open(id)
    if (narrow) scroller.current?.scrollTo({ top: 0 })
  }
  const [rev, setRev] = useState(newest)
  const sheets = useMemo(() => sheetsInSetAt(rows, rev), [rows, rev])
  const firstChanged = sheets.find((s) => s.changedInRev === rev)
  const [sheetId, setSheetId] = useState(firstChanged?.id ?? sheets[0]?.id ?? '')
  const goneSheets = useMemo(() => sheetsGoneAtSet(rows, rev), [rows, rev])
  const goneSheet = sheets.some((s) => s.id === sheetId) ? null : (goneSheets.find((g) => g.id === sheetId) ?? null)
  const index = Math.max(0, sheets.findIndex((s) => s.id === sheetId))
  const sheet = goneSheet ? undefined : sheets[index]
  const set = rows.sets.find((s) => s.rev === rev)
  const sets = [...rows.sets].sort((a, b) => b.rev - a.rev)
  const specs = useMemo(() => specsInSetAt(rows, rev), [rows, rev])
  const [view, setView] = useState<'sheets' | 'specs'>('sheets')
  const showSpecs = view === 'specs' && specs.length > 0
  const [specId, setSpecId] = useState(specs.find((x) => x.changedInRev === rev)?.id ?? specs[0]?.id ?? '')
  const goneSpecs = useMemo(() => specsGoneAtSet(rows, rev), [rows, rev])
  const goneSpec = specs.some((x) => x.id === specId) ? null : (goneSpecs.find((g) => g.id === specId) ?? null)
  const specIndex = Math.max(0, specs.findIndex((x) => x.id === specId))
  const spec = goneSpec ? undefined : specs[specIndex]
  const sheetOnScreen = goneSheet?.id ?? sheet?.id ?? ''
  const specOnScreen = goneSpec?.id ?? spec?.id ?? ''
  const label = (r: number) => setLabelAt(rows, r)
  /** The project as the reach reads it at this set: its sheets and sections then, its trades as they are. */
  const reach = useMemo(() => ({ sheets: sheets.map((s) => ({ id: s.id, title: s.title })), specs: specs.map((x) => ({ id: x.id, title: x.title })), trades: project.trades }), [sheets, specs, project.trades])

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
  const onSheet = sheetOnScreen
    ? project.trades
        .map((pkg) => ({ pkg, lines: pkg.scope.map((item) => ({ item, ...lineReads(reach, pkg, item) })).filter((l) => l.sheets.includes(sheetOnScreen)) }))
        .filter((t) => t.lines.length > 0)
    : []
  const revisedSpecs = specs.filter((x) => x.changedInRev === rev && !x.added).length
  const addedSpecs = specs.filter((x) => x.changedInRev === rev && x.added).length
  const specGroups: { division: string; rows: SheetInSet[] }[] = []
  for (const x of specs) {
    const division = specDivision(x.id)
    const group = specGroups.find((g) => g.division === division)
    if (group) group.rows.push(x)
    else specGroups.push({ division, rows: [x] })
  }
  const onSpec = specOnScreen
    ? project.trades
        .map((pkg) => ({
          pkg,
          lines: pkg.scope
            .filter((item) => lineReadsSpec(reach, pkg, item, specOnScreen))
            .map((item) => {
              const said = lineSpecs(reach, pkg, item)
              return { item, guessed: said.guessed, wholeTrade: said.specs.length === 0 }
            }),
        }))
        .filter((t) => t.lines.length > 0)
    : []
  const here = showSpecs
    ? { id: specOnScreen, trades: onSpec, kind: 'section' as const }
    : { id: sheetOnScreen, trades: onSheet.map((t) => ({ pkg: t.pkg, lines: t.lines.map((l) => ({ item: l.item, guessed: l.guessed, wholeTrade: l.wholeTrade })) })), kind: 'sheet' as const }
  const guessedOn = here.trades.some((t) => t.lines.some((l) => l.guessed && !l.wholeTrade))
  const wholeOn = here.trades.some((t) => t.lines.some((l) => l.wholeTrade))
  const listButton = (active: boolean, muted = false) =>
    ({
      display: 'flex',
      gap: '0.4rem',
      alignItems: 'baseline',
      width: '100%',
      textAlign: 'left',
      padding: '0.3rem 0.4rem',
      border: 'none',
      borderRadius: 5,
      background: active ? 'var(--bg-blue-tint)' : 'transparent',
      color: muted ? 'var(--text-muted)' : 'var(--text-base)',
      cursor: 'pointer',
      fontSize: '0.85rem',
    }) as const
  const heading = { fontSize: '0.68rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' } as const
  const pill = (active: boolean) =>
    ({
      padding: '0.3rem 0.7rem',
      borderRadius: 999,
      border: `1px solid ${active ? 'var(--text-blue-500)' : 'var(--border-strong)'}`,
      background: active ? 'var(--bg-blue-tint)' : 'var(--surface)',
      color: active ? 'var(--text-blue-500)' : 'var(--text-600)',
      fontWeight: active ? 600 : 400,
      cursor: 'pointer',
      fontSize: '0.85rem',
    }) as const

  const onScreen: { kind: 'sheet' | 'section'; id: string; title: string; changedInRev: number | null; added: boolean; was?: string; goneBy: string | null } | null = showSpecs
    ? spec
      ? { kind: 'section', id: spec.id, title: spec.title, changedInRev: spec.changedInRev, added: spec.added, was: spec.was, goneBy: null }
      : goneSpec
        ? { kind: 'section', id: goneSpec.id, title: goneSpec.title, changedInRev: null, added: false, goneBy: label(goneSpec.goneInRev) }
        : null
    : sheet
      ? { kind: 'sheet', id: sheet.id, title: sheet.title, changedInRev: sheet.changedInRev, added: sheet.added, was: sheet.was, goneBy: null }
      : goneSheet
        ? { kind: 'sheet', id: goneSheet.id, title: goneSheet.title, changedInRev: null, added: false, goneBy: label(goneSheet.goneInRev) }
        : null
  const issuedBy = onScreen ? rows.sets.find((s) => s.rev === (onScreen.changedInRev ?? 0)) : undefined

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${project.name} plans`}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, width: 'min(1100px, 100%)', maxHeight: 'min(92vh, 100%)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-strong)' }}
      >
        <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{project.name} · plans</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{[project.address, project.sizeNote].filter(Boolean).join(' · ')}</div>
          </div>
          <div role="group" aria-label="Plan set" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginLeft: 'auto' }}>
            {sets.map((s) => (
              <button
                key={s.rev}
                type="button"
                aria-pressed={s.rev === rev}
                onClick={() => {
                  setRev(s.rev)
                  const at = sheetsInSetAt(rows, s.rev)
                  if (!at.some((x) => x.id === sheetId)) setSheetId(at[0]?.id ?? '')
                  const atSpecs = specsInSetAt(rows, s.rev)
                  if (!atSpecs.some((x) => x.id === specId)) setSpecId(atSpecs[0]?.id ?? '')
                }}
                style={pill(s.rev === rev)}
              >
                {s.label} · {shortDate(s.issued_on)}
                {s.rev === newest ? ' · newest' : ''}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}>
            ×
          </button>
        </div>

        {set && (
          <div style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', background: rev < newest ? 'var(--bg-amber-tint)' : 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
            {rev < newest && <strong>An older set. {label(newest)} replaced it. </strong>}
            {set.note}
            {changedCount > 0 && <> {changedCount} {changedCount === 1 ? 'sheet' : 'sheets'} changed in this set.</>}
            {sheetsOut > 0 && <> {sheetsOut} {sheetsOut === 1 ? 'sheet' : 'sheets'} taken out.</>}
            {revisedSpecs > 0 && <> {revisedSpecs} spec {revisedSpecs === 1 ? 'section' : 'sections'} revised.</>}
            {addedSpecs > 0 && <> {addedSpecs} spec {addedSpecs === 1 ? 'section' : 'sections'} new to the manual.</>}
            {specsOut > 0 && <> {specsOut} spec {specsOut === 1 ? 'section' : 'sections'} taken out.</>}
            {set.drive_url && (
              <>
                {' '}
                <a href={set.drive_url} target="_blank" rel="noreferrer">
                  Its folder in Drive
                </a>
                {set.drive_access === 'anyone' ? ' · anyone with the link can open it' : set.drive_access === 'restricted' ? ' · only some people can open it' : ' · not checked yet'}
              </>
            )}
          </div>
        )}

        <div ref={scroller} style={{ display: 'grid', gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : 'minmax(11rem, 17rem) minmax(0, 1fr)', minHeight: 0, flex: 1, overflowY: narrow ? 'auto' : undefined }}>
          <div style={narrow ? { order: 2, padding: '0.5rem', borderTop: '1px solid var(--border)' } : { overflowY: 'auto', borderRight: '1px solid var(--border)', padding: '0.5rem' }}>
            {specs.length + goneSpecs.length > 0 && (
              <div role="group" aria-label="Sheets or specs" style={{ display: 'flex', gap: '0.3rem', padding: '0.1rem 0.2rem 0.5rem' }}>
                {(['sheets', 'specs'] as const).map((v) => (
                  <button key={v} type="button" aria-pressed={(v === 'specs') === showSpecs} onClick={() => setView(v)} style={{ ...pill((v === 'specs') === showSpecs), flex: 1, fontSize: '0.8rem' }}>
                    {v === 'sheets' ? `Sheets · ${sheets.length}` : `Specs · ${specs.length}`}
                  </button>
                ))}
              </div>
            )}
            {showSpecs &&
              specGroups.map((g) => (
                <div key={g.division} style={{ marginBottom: '0.5rem' }}>
                  <div style={heading}>
                    {g.division} · {SPEC_DIVISIONS[g.division] ?? 'Other'}
                  </div>
                  {g.rows.map((x) => (
                    <button key={x.id} type="button" onClick={() => showFromList(setSpecId)(x.id)} aria-current={x.id === spec?.id} style={listButton(x.id === spec?.id)}>
                      <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{x.id}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>{x.title}</span>
                      {x.changedInRev === rev && rev > 0 && (
                        <Chip tone="violet" title={x.was ? `Was: ${x.was}` : undefined}>
                          {x.added ? 'new' : x.was ? 'renamed' : 'revised'}
                        </Chip>
                      )}
                      {x.changedInRev !== null && x.changedInRev < rev && <Chip tone="grey">{label(x.changedInRev)}</Chip>}
                    </button>
                  ))}
                </div>
              ))}
            {showSpecs && goneSpecs.length > 0 && <GoneGroup rows={goneSpecs} label={label} active={goneSpec?.id ?? null} onPick={showFromList(setSpecId)} />}
            {!showSpecs &&
              groups.map((g) => (
                <div key={g.discipline} style={{ marginBottom: '0.5rem' }}>
                  <div style={heading}>{g.discipline}</div>
                  {g.rows.map((s) => (
                    <button key={s.id} type="button" onClick={() => showFromList(setSheetId)(s.id)} aria-current={s.id === sheet?.id} style={listButton(s.id === sheet?.id)}>
                      <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{s.id}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>{s.title}</span>
                      {s.changedInRev === rev && rev > 0 && (
                        <Chip tone="amber" title={s.was ? `Was: ${s.was}` : undefined}>
                          {s.added ? 'new' : s.was ? 'renamed' : 'changed'}
                        </Chip>
                      )}
                      {s.changedInRev !== null && s.changedInRev < rev && <Chip tone="grey">{label(s.changedInRev)}</Chip>}
                    </button>
                  ))}
                </div>
              ))}
            {!showSpecs && goneSheets.length > 0 && <GoneGroup rows={goneSheets} label={label} active={goneSheet?.id ?? null} onPick={showFromList(setSheetId)} />}
          </div>

          <div style={{ padding: '0.75rem', overflow: narrow ? undefined : 'auto', background: 'var(--bg-muted)', order: narrow ? 1 : undefined }}>
            {onScreen && (
              <div data-theme="light" style={{ background: 'var(--surface)', color: 'var(--text-base)', border: '1px solid var(--border-strong)', borderRadius: 4, padding: '1.2rem 1.4rem', display: 'grid', gap: '0.5rem', minHeight: '12rem' }}>
                {onScreen.goneBy && (
                  <span style={{ justifySelf: 'end', border: '2px solid var(--text-red-700)', color: 'var(--text-red-700)', borderRadius: 6, padding: '0.15rem 0.5rem', fontWeight: 700, fontSize: '0.8rem' }}>Taken out by {onScreen.goneBy}</span>
                )}
                {!onScreen.goneBy && onScreen.changedInRev === rev && rev > 0 && (
                  <span style={{ justifySelf: 'end', border: '2px dashed var(--text-amber-700)', color: 'var(--text-amber-700)', borderRadius: 6, padding: '0.15rem 0.5rem', fontWeight: 700, fontSize: '0.8rem' }}>
                    {onScreen.added ? `Added by ${label(rev)}` : onScreen.was ? `Renamed by ${label(rev)}, was ${onScreen.was}` : `${onScreen.kind === 'sheet' ? 'Changed' : 'Revised'} by ${label(rev)}`}
                  </span>
                )}
                <span style={{ fontSize: '0.75rem', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{project.name.toUpperCase()}</span>
                <span style={{ fontWeight: 700, fontSize: '1.6rem', letterSpacing: '0.04em' }}>{onScreen.kind === 'section' ? `SECTION ${onScreen.id}` : onScreen.id}</span>
                <span style={{ fontWeight: 700, letterSpacing: '0.04em' }}>{onScreen.title.toUpperCase()}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {issuedBy ? `Issued with ${issuedBy.label}, ${shortDate(issuedBy.issued_on)}.` : ''} The {onScreen.kind}'s own page shows here once the plans are read from the PDF.
                </span>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', marginTop: '0.5rem', fontSize: '0.85rem' }}>
              {showSpecs ? (
                <>
                  <Btn disabled={specIndex === 0} onClick={() => setSpecId(specs[specIndex - 1]?.id ?? specId)}>← Back</Btn>
                  <span style={{ color: 'var(--text-muted)' }}>{goneSpec ? 'Taken out. It stays here so a quote priced on it can still be read.' : `Section ${specIndex + 1} of ${specs.length}. The arrow keys flip sections.`}</span>
                  <Btn disabled={specIndex >= specs.length - 1} onClick={() => setSpecId(specs[specIndex + 1]?.id ?? specId)}>Next →</Btn>
                </>
              ) : (
                <>
                  <Btn disabled={index === 0} onClick={() => setSheetId(sheets[index - 1]?.id ?? sheetId)}>← Back</Btn>
                  <span style={{ color: 'var(--text-muted)' }}>{goneSheet ? 'Taken out. It stays here so a quote priced on it can still be read.' : `Sheet ${index + 1} of ${sheets.length}. The arrow keys flip sheets.`}</span>
                  <Btn disabled={index >= sheets.length - 1} onClick={() => setSheetId(sheets[index + 1]?.id ?? sheetId)}>Next →</Btn>
                </>
              )}
            </div>
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
                        const by = setThatAddedLine(rows, l.item.id)
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
                {wholeOn && <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>A line that names no {here.kind} reads every {here.kind} of its trade, so it shows here too.</span>}
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '0.6rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
          <Chip tone="grey">Who has the set comes with the company record.</Chip>
          <span style={{ flex: 1 }} />
          {project.driveFolderUrl && (
            <a href={project.driveFolderUrl} target="_blank" rel="noreferrer">
              Open the job folder ↗
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

/** The sheets or sections the sets took out, crossed out under the rest, each still there to open. */
function GoneGroup({ rows, label, active, onPick }: { rows: SheetGone[]; label: (rev: number) => string; active: string | null; onPick: (id: string) => void }) {
  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <div style={{ fontSize: '0.68rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}>Taken out</div>
      {rows.map((g) => (
        <button
          key={g.id}
          type="button"
          onClick={() => onPick(g.id)}
          aria-current={g.id === active}
          style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline', width: '100%', textAlign: 'left', padding: '0.3rem 0.4rem', border: 'none', borderRadius: 5, background: g.id === active ? 'var(--bg-blue-tint)' : 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}
        >
          <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0, textDecoration: 'line-through' }}>{g.id}</span>
          <span style={{ flex: 1, minWidth: 0, textDecoration: 'line-through' }}>{g.title}</span>
          <Chip tone="red">{label(g.goneInRev)}</Chip>
        </button>
      ))}
    </div>
  )
}
