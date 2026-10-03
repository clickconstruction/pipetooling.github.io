import { useEffect, useMemo, useRef, useState, type Dispatch } from 'react'
import {
  OUR_TRADES,
  SET_KINDS,
  TRADE_TEMPLATES,
  currentRev,
  activitiesTouched,
  defaultSetKind,
  guessLineSheets,
  pushSchedule,
  scheduleFloat,
  weekdayDate,
  linesOnSheets,
  nextSetLabel,
  packagesForSheets,
  planEmail,
  planLabel,
  planRecipients,
  sheetAsIndexed,
  sheetsAtRev,
  sheetsInText,
  tradesForSheets,
  usualScope,
  type GcAction,
  type GcProject,
  type GcState,
  type PlanSheet,
} from '../../lib/gcMode/gcModel'
import { ScopeLines, type ScopeLineDraft } from './GcNewProject'
import { Btn, Chip, input } from './gcUi'

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

export function GcNewPlansWindow({ state, project, dispatch, onClose }: Props) {
  const [kind, setKind] = useState(defaultSetKind(project))
  /** Null: the name follows the kind. A string: the office typed its own. */
  const [labelText, setLabelText] = useState<string | null>(null)
  const label = (labelText ?? nextSetLabel(project, kind)).trim()
  const [note, setNote] = useState('')
  // The notes box takes the cursor without scrolling, so the set's name stays in view on a short screen.
  const noteBox = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    noteBox.current?.focus({ preventScroll: true })
  }, [])
  /** Null: follow what the notes say. A list: the office has taken over. */
  const [sheetText, setSheetText] = useState<string | null>(null)
  const [titles, setTitles] = useState<Record<string, string>>({})
  const [touchOverride, setTouchOverride] = useState<string[] | null>(null)
  const [brought, setBrought] = useState<BroughtTrade[]>([])
  /** Scope lines this set adds, by trade (package id). */
  const [newLines, setNewLines] = useState<Record<string, string[]>>({})
  /** Days this set adds to scheduled activities, as typed, by line id. */
  const [pushDays, setPushDays] = useState<Record<string, string>>({})
  /** The trade whose Add a line box is open, and what is typed in it. */
  const [lineFor, setLineFor] = useState<string | null>(null)
  const [lineText, setLineText] = useState('')
  const [addText, setAddText] = useState('')
  const [skipped, setSkipped] = useState<string[]>([])
  const [previewId, setPreviewId] = useState<string | null>(null)

  const sheets = useMemo(() => {
    const raw = sheetText === null ? sheetsInText(note) : sheetText.split(',').map((x) => x.trim()).filter(Boolean)
    return [...new Set(raw.map((id) => sheetAsIndexed(project, id)))]
  }, [note, sheetText, project])
  const index = useMemo(() => sheetsAtRev(project, currentRev(project)), [project])
  const added: PlanSheet[] = sheets.filter((id) => !index.some((s) => s.id === id)).map((id) => ({ id, title: (titles[id] ?? '').trim() }))
  const touches = touchOverride ?? packagesForSheets(project, sheets, added)
  const everyone = planRecipients(state, project, touches)
  const going = everyone.filter((r) => !skipped.includes(r.partner.id))
  const companies = new Set(going.map((r) => r.partner.id)).size
  const ours = project.packages.filter((p) => p.selfPerform && touches.includes(p.id))
  const preview = going.find((r) => r.partner.id === previewId) ?? going.find((r) => r.touched) ?? going[0] ?? null
  // The schedule: the activities this set reaches, the days typed against them, and what that moves.
  const schedule = project.schedule ?? null
  const reached = activitiesTouched(project, sheets).filter((a) => touches.includes(a.packageId))
  const spare = schedule ? scheduleFloat(schedule.activities) : new Map<string, number>()
  const pushes = Object.fromEntries(
    Object.entries(pushDays)
      .filter(([id]) => reached.some((a) => a.lineId === id))
      .map(([id, t]) => [id, Math.round(Number(t) || 0)] as const)
      .filter(([, d]) => d > 0),
  )
  const push = schedule && Object.keys(pushes).length > 0 ? pushSchedule(schedule.activities, pushes) : null
  const endDays = push ? Math.round((Date.parse(push.lastAfter) - Date.parse(push.lastBefore)) / 86_400_000) : 0
  const substantial = schedule?.milestones.find((m) => /substantial/i.test(m.label)) ?? null
  const lineName = (packageId: string, lineId: string) => {
    const pkg = project.packages.find((k) => k.id === packageId)
    return pkg?.sow?.sov.find((l) => l.id === lineId)?.label ?? pkg?.scope.find((l) => l.id === lineId)?.label ?? lineId
  }
  /** The new dates of one trade's activities this push moved, said as sentences for its email. */
  const movesFor = (packageId: string) =>
    (push?.moved ?? [])
      .map((m) => push?.activities.find((a) => a.lineId === m.lineId))
      .filter((a): a is NonNullable<typeof a> => !!a && a.packageId === packageId)
      .map((a) => `${lineName(a.packageId, a.lineId)} now runs ${weekdayDate(a.start)} to ${weekdayDate(a.finish)}.`)
  const email = planEmail(project, label, note.trim(), sheets, preview, {
    lines: preview?.touched ? linesOnSheets(project, preview.pkg, sheets).map((l) => l.label) : [],
    adds: preview?.touched ? (newLines[preview.pkg.id] ?? []) : [],
    moves: preview?.touched ? movesFor(preview.pkg.id) : [],
  })
  /** Every sheet once the set is in: the index and the ones this set adds. */
  const allSheets = [...index, ...added.filter((a) => !index.some((s) => s.id === a.id))]
  const sheetsOfTrade = (trade: string) => {
    const from = tradesForSheets(allSheets).find((g) => g.trade === trade)?.from ?? []
    return allSheets.filter((s) => from.includes(s.id))
  }

  const onJob = (trade: string) =>
    project.packages.some((p) => p.trade.toLowerCase() === trade.toLowerCase()) || brought.some((b) => b.trade.toLowerCase() === trade.toLowerCase())
  /** Trades the sheets point at that the job does not have yet. */
  const suggested = tradesForSheets(sheets.map((id) => index.find((s) => s.id === id) ?? added.find((s) => s.id === id) ?? { id, title: '' })).filter(
    (g) => !onJob(g.trade),
  )
  const bring = (trade: string) => {
    const t = trade.trim()
    if (t === '' || onJob(t)) return
    setBrought((b) => [...b, { trade: t, budget: '', ours: OUR_TRADES.includes(t), scope: usualScope(t).map((l) => ({ label: l, sheets: null })) }])
    setAddText('')
  }
  const change = (i: number, patch: Partial<BroughtTrade>) => setBrought((b) => b.map((x, j) => (j === i ? { ...x, ...patch } : x)))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const missing = note.trim() === '' ? 'Say what changed first.' : label === '' ? 'Give the set a name.' : null
  const addLine = (packageId: string) => {
    const t = lineText.trim()
    if (t !== '') setNewLines((all) => ({ ...all, [packageId]: [...(all[packageId] ?? []), t] }))
    setLineText('')
    setLineFor(null)
  }
  /** A new line reads from the changed sheets that belong to its trade. None: the trade as a whole. */
  const newLineSheets = (trade: string) => sheetsOfTrade(trade).map((x) => x.id).filter((id) => sheets.includes(id))
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

        <div style={{ padding: '0.9rem 1rem', overflowY: 'auto', display: 'grid', gap: '1.1rem' }}>
          <section>
            <StepHeading n={1} title="What came in" hint="Name the set. Then paste or type what is different." />
            <div style={{ display: 'grid', gap: '0.45rem', marginBottom: '0.6rem', fontSize: '0.875rem' }}>
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
            </div>
            <textarea
              ref={noteBox}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder={'For example:\nE-201: two more floor boxes in bay 2.\nM-101: RTU-3 moved 6 ft north. Curb detail changed on A-401.'}
              style={{ ...input, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
            />
          </section>

          <section>
            <StepHeading n={2} title="What it changes" hint="Read from the notes. Fix anything that is wrong." />
            <div style={{ display: 'grid', gap: '0.6rem', fontSize: '0.875rem' }}>
              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                Sheets that changed
                <input
                  style={{ ...input, flex: '1 1 14rem' }}
                  value={sheetText ?? sheets.join(', ')}
                  onChange={(e) => setSheetText(e.target.value)}
                  placeholder="None found yet. Type them, like A-201, S-101"
                />
                {sheetText !== null && <Btn kind="quiet" onClick={() => setSheetText(null)}>Read them from the notes again</Btn>}
              </label>
              {sheets.length > 0 && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  {sheets.map((id) => {
                    const known = index.find((s) => s.id === id)
                    return (
                      <div key={id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.3rem 0.7rem', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', minWidth: '4rem' }}>{id}</span>
                        {known ? (
                          <>
                            <span style={{ color: 'var(--text-600)', flex: 1, minWidth: 0 }}>{known.title}</span>
                            <Chip tone="amber">changed</Chip>
                          </>
                        ) : (
                          <>
                            <input
                              style={{ ...input, flex: '1 1 14rem' }}
                              value={titles[id] ?? ''}
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
              {touchOverride === null && sheets.length > 0 && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  The trades are a guess from the sheet letters and titles. Tick or untick to fix it.
                </span>
              )}
              {touches.length > 0 && (
                <div style={{ display: 'grid', gap: '0.2rem' }}>
                  <span style={{ fontWeight: 600 }}>The scope lines it touches</span>
                  {linesAdded > 0 && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      A quote already in never answered a new line. Compare bids shows it as not clear until you set a cost to cover it.
                    </span>
                  )}
                  {project.packages
                    .filter((p) => touches.includes(p.id))
                    .map((p) => {
                      const hit = linesOnSheets(project, p, sheets)
                      const adding = newLines[p.id] ?? []
                      const reads = newLineSheets(p.trade)
                      return (
                        <div key={p.id} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ minWidth: '8rem' }}>{p.trade}</span>
                          {hit.length === 0 && adding.length === 0 ? (
                            <span style={{ color: 'var(--text-muted)' }}>no line names these sheets, so the trade as a whole</span>
                          ) : (
                            hit.map((l) => (
                              <Chip key={l.id} tone="amber">{l.label}</Chip>
                            ))
                          )}
                          {adding.map((l, i) => (
                            <span
                              key={`${l}-${i}`}
                              title={reads.length > 0 ? `Reads from ${reads.join(', ')}` : `Reads every ${p.trade.toLowerCase()} sheet`}
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
                              <input
                                autoFocus
                                style={{ ...input, flex: '0 1 14rem' }}
                                value={lineText}
                                onChange={(e) => setLineText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') addLine(p.id)
                                  if (e.key === 'Escape') {
                                    e.stopPropagation()
                                    setLineFor(null)
                                  }
                                }}
                                placeholder="Detention pond"
                                aria-label={`A line this set adds to ${p.trade}`}
                              />
                              <Btn onClick={() => addLine(p.id)}>Add</Btn>
                            </>
                          ) : (
                            <Btn
                              kind="quiet"
                              onClick={() => {
                                setLineFor(p.id)
                                setLineText('')
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
              {schedule && reached.length > 0 && (
                <div style={{ display: 'grid', gap: '0.3rem', borderTop: '1px solid var(--border)', paddingTop: '0.6rem' }}>
                  <span style={{ fontWeight: 600 }}>What it does to the schedule</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    Type the days the change adds to an activity. What waits on it moves out too. The plan at Start stays as the baseline.
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
                  {push && (
                    <div style={{ padding: '0.4rem 0.6rem', borderRadius: 6, background: endDays > 0 ? 'var(--bg-amber-tint)' : 'var(--bg-subtle)', display: 'grid', gap: '0.15rem' }}>
                      <span>
                        It moves {push.moved.length} {push.moved.length === 1 ? 'activity' : 'activities'}.{' '}
                        {endDays > 0
                          ? `The job's last day moves from ${weekdayDate(push.lastBefore)} to ${weekdayDate(push.lastAfter)}.`
                          : `The days fit in the spare days. The job's last day stays ${weekdayDate(push.lastBefore)}.`}
                      </span>
                      {substantial &&
                        (push.lastAfter > substantial.planned ? (
                          <strong style={{ color: 'var(--text-red-700)' }}>
                            Substantial completion, planned {weekdayDate(substantial.planned)}, would be missed by{' '}
                            {Math.round((Date.parse(push.lastAfter) - Date.parse(substantial.planned)) / 86_400_000)} days.
                          </strong>
                        ) : (
                          <span>Substantial completion, planned {weekdayDate(substantial.planned)}, still holds.</span>
                        ))}
                    </div>
                  )}
                </div>
              )}
              {ours.length > 0 && (
                <div style={{ padding: '0.4rem 0.6rem', background: 'var(--bg-violet-100)', color: 'var(--text-violet-800)', borderRadius: 6 }}>
                  This changes {ours.map((p) => p.trade.toLowerCase()).join(' and ')}, which is ours. Check {ours.map((p) => p.selfPerform?.ref).join(', ')} against the new set.
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.6rem', display: 'grid', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong>A trade the job does not have yet</strong>
                  <select style={input} value="" onChange={(e) => bring(e.target.value)} aria-label="Add a trade from the usual list">
                    <option value="">From the usual list</option>
                    {TRADE_TEMPLATES.filter((t) => !onJob(t.trade)).map((t) => (
                      <option key={t.trade} value={t.trade}>{t.trade}</option>
                    ))}
                  </select>
                  <span style={{ color: 'var(--text-muted)' }}>or type one</span>
                  <input
                    style={{ ...input, flex: '0 1 12rem' }}
                    value={addText}
                    onChange={(e) => setAddText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') bring(addText)
                    }}
                    placeholder="Canopy steel"
                  />
                  <Btn disabled={addText.trim() === ''} onClick={() => bring(addText)}>Add</Btn>
                </div>
                {suggested.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.4rem 0.6rem', borderRadius: 6, background: 'var(--bg-blue-tint)' }}>
                    The sheets point at {suggested.map((g) => g.trade.toLowerCase()).join(' and ')}, which the job does not have.
                    {suggested.map((g) => (
                      <Btn key={g.trade} kind="quiet" onClick={() => bring(g.trade)}>Add {g.trade}</Btn>
                    ))}
                  </div>
                )}
                {brought.map((b, i) => (
                  <div key={b.trade} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.45rem' }}>
                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong>{b.trade}</strong>
                      <Chip tone="blue">a new trade</Chip>
                      <span style={{ flex: 1 }} />
                      <label style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', cursor: 'pointer' }}>
                        <input type="checkbox" checked={b.ours} onChange={(e) => change(i, { ours: e.target.checked })} />
                        Ours
                      </label>
                      <label style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{b.ours ? 'Our bid' : 'Our budget'}</span>
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
                    <ScopeLines trade={b.trade} lines={b.scope} onChange={(scope) => change(i, { scope })} sheets={allSheets} tradeSheets={sheetsOfTrade(b.trade)} />
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section>
            <StepHeading
              n={3}
              title="Who hears about it"
              hint={
                project.stage === 'pursuing'
                  ? 'We are still bidding, so every company bidding gets it.'
                  : 'The job is ours, so only the company on each trade gets it.'
              }
            />
            {brought.length > 0 && (
              <div style={{ marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-600)' }}>
                Nobody is asked to quote {brought.map((b) => b.trade.toLowerCase()).join(' or ')} yet. Ask companies on Trades after you issue the set.
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
            <StepHeading n={4} title="The email" hint={preview ? `As ${preview.partner.company} gets it.` : 'No one to email.'} />
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
            {brought.length > 0 && ` It adds ${brought.length === 1 ? 'a trade' : `${brought.length} trades`}.`}
          </span>
          <span style={{ flex: 1 }} />
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
                note: note.trim(),
                sheets,
                addedSheets: added,
                touches,
                recipients: going.map((r) => r.partner.id),
                schedulePushes: pushes,
                newLines: project.packages
                  .filter((p) => touches.includes(p.id))
                  .flatMap((p) => (newLines[p.id] ?? []).map((l) => ({ packageId: p.id, label: l, sheets: newLineSheets(p.trade) }))),
                newTrades: brought.map((b) => ({
                  trade: b.trade,
                  budget: Number(b.budget.replace(/[^0-9.]/g, '')) || 0,
                  ours: b.ours,
                  scope: b.scope.map((l) => l.label),
                  scopeSheets: b.scope.map((l) => l.sheets ?? guessLineSheets(l.label, sheetsOfTrade(b.trade))),
                })),
              })
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
