import { useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type ReactNode } from 'react'
import {
  OUR_TRADES,
  SAMPLE_SHEET_INDEX,
  TOWNS,
  TRADE_TEMPLATES,
  money,
  newProjectId,
  sheetDiscipline,
  sheetIndexInText,
  tradeOrder,
  tradesForPlans,
  specIndexInText,
  specDivision,
  guessLineSpecs,
  SAMPLE_SPEC_INDEX,
  SPEC_DIVISIONS,
  usualScope,
  usualExcludes,
  inSentence,
  strangerActions,
  vettingWords,
  type StrangerAsk,
  scopeGaps,
  BY_NOT_A_TRADE,
  type ScopeExclusion,
  type ScopeGap,
  guessLineSheets,
  answerRecord,
  budgetForSize,
  buildNewProject,
  sqFtInText,
  partnerBlockers,
  defaultAsks,
  tradeLineup,
  travelWords,
  type AnswerRecord,
  type GcAction,
  type GcState,
  type NewProjectDraft,
  type PlanSheet,
  type SpecSection,
} from '../../lib/gcMode/gcModel'

/** One scope line as the office is writing it. `sheets` or `specs` null or missing: follow the guess from the line's words. */
export interface ScopeLineDraft {
  label: string
  sheets: string[] | null
  specs?: string[] | null
}

/** The usual lines for a trade, each following the guess. */
function usualLines(trade: string): ScopeLineDraft[] {
  return usualScope(trade).map((label) => ({ label, sheets: null }))
}
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { Btn, Chip, input } from './gcUi'

/**
 * GC mode design spike: New Project. A project starts the day its plans come in. Four steps in
 * one window, each feeding the next: the project (owner and architect from the one customer
 * list), the plans (the sheet index pasted and read), the trades (guessed from the sheets) and
 * each trade's scope (its usual lines, changed here). Create puts it under Bidding to the owner
 * and opens it on Trades, where companies are asked.
 */

const NEW = '__new'

const STEPS = [
  { title: 'The project', hint: 'What it is, where it is, who it is for.' },
  { title: 'The plans', hint: 'The set that came in and its sheets.' },
  { title: 'The trades', hint: 'Who we buy, guessed from the sheets.' },
  { title: 'Each scope', hint: 'The work each quote must cover.' },
  { title: 'Who to ask', hint: 'The companies asked to quote each trade.' },
] as const

/** What the office changed on one trade. A field left out follows the guess. */
interface TradeEdit {
  on?: boolean
  ours?: boolean
  budget?: string
  scope?: ScopeLineDraft[]
  excludes?: ScopeExclusion[]
}

interface TradeRow {
  trade: string
  /** The sections of the project manual that suggest the trade. */
  specs: string[]
  /** The sheets that suggest the trade. Empty: the office added it. */
  from: string[]
  on: boolean
  ours: boolean
  budget: string
  scope: ScopeLineDraft[]
  scopeEdited: boolean
  /** Work the trade's quote leaves out, and who does it instead. */
  excludes: ScopeExclusion[]
}

function budgetNumber(text: string): number {
  return Number(text.replace(/[^0-9.]/g, '')) || 0
}

function Field({ label, hint, children, wide }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return (
    <label style={{ display: 'grid', gap: '0.25rem', alignContent: 'start', gridColumn: wide ? '1 / -1' : undefined, fontSize: '0.875rem' }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      {children}
      {hint && <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{hint}</span>}
    </label>
  )
}

const field: CSSProperties = { ...input, width: '100%', boxSizing: 'border-box' }

function sheetsWords(ids: string[]): string {
  if (ids.length <= 4) return ids.join(', ')
  return `${ids.slice(0, 3).join(', ')} and ${ids.length - 3} more`
}

interface WindowProps {
  state: GcState
  dispatch: Dispatch<GcAction>
  onClose: () => void
  onCreated: (projectId: string) => void
}

export function GcNewProjectWindow({ state, dispatch, onClose, onCreated }: WindowProps) {
  const [step, setStep] = useState(0)
  const roomy = useMatchMedia('(min-width: 900px)')
  // On a phone the five steps are a row of numbers, with the open step's name beside them.
  const narrow = useMatchMedia('(max-width: 599px)')
  const body = useRef<HTMLDivElement>(null)
  useEffect(() => {
    body.current?.scrollTo({ top: 0 })
  }, [step])

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [town, setTown] = useState('San Antonio')
  const [ownerPick, setOwnerPick] = useState('')
  const [ownerNew, setOwnerNew] = useState('')
  const [archPick, setArchPick] = useState('')
  const [archNew, setArchNew] = useState('')
  const [bidDue, setBidDue] = useState('')
  const [sizeNote, setSizeNote] = useState('')

  const [setLabel, setSetLabel] = useState('Bid set')
  const [issuedOn, setIssuedOn] = useState(state.today)
  const [setNote, setSetNote] = useState('')
  const [indexText, setIndexText] = useState('')
  const [specText, setSpecText] = useState('')
  /** The budgets the fill wrote, by trade, with where each rate came from. Shown while the budget is unchanged. */
  const [filled, setFilled] = useState<Record<string, { budget: string; words: string }>>({})
  /** Companies new to us the office adds on Who to ask: asked to quote, not vetted (question 3). */
  const [strangers, setStrangers] = useState<StrangerAsk[]>([])
  const [strangerFor, setStrangerFor] = useState<string | null>(null)
  const [strangerName, setStrangerName] = useState('')
  const [strangerContact, setStrangerContact] = useState('')

  const [edits, setEdits] = useState<Record<string, TradeEdit>>({})
  const [added, setAdded] = useState<string[]>([])
  const [addText, setAddText] = useState('')
  const [scopeFor, setScopeFor] = useState<string | null>(null)
  /** The companies ticked per trade. A trade left out follows the default: the most reliable in range. */
  const [asks, setAsks] = useState<Record<string, string[]>>({})

  const reading = useMemo(() => sheetIndexInText(indexText), [indexText])
  const specReading = useMemo(() => specIndexInText(specText), [specText])
  const guesses = useMemo(() => tradesForPlans(reading.sheets, specReading.sections), [reading.sheets, specReading.sections])

  const rows: TradeRow[] = useMemo(() => {
    const names = [...guesses.map((g) => g.trade), ...added.filter((t) => !guesses.some((g) => g.trade === t))]
    return names
      .map((trade) => {
        const e = edits[trade] ?? {}
        return {
          trade,
          from: guesses.find((g) => g.trade === trade)?.from ?? [],
          specs: guesses.find((g) => g.trade === trade)?.specs ?? [],
          on: e.on ?? true,
          ours: e.ours ?? OUR_TRADES.includes(trade),
          budget: e.budget ?? '',
          scope: e.scope ?? usualLines(trade),
          scopeEdited: e.scope !== undefined,
          excludes: e.excludes ?? usualExcludes(trade),
        }
      })
      .sort((a, b) => tradeOrder(a.trade) - tradeOrder(b.trade))
  }, [guesses, added, edits])
  const picked = rows.filter((r) => r.on)
  const shown = picked.find((r) => r.trade === scopeFor) ?? picked[0] ?? null

  const edit = (trade: string, change: TradeEdit) => setEdits((all) => ({ ...all, [trade]: { ...all[trade], ...change } }))

  const customers = [...state.customers].sort((a, b) => a.name.localeCompare(b.name))
  const ownerName = ownerPick === NEW ? ownerNew.trim() : (state.customers.find((c) => c.id === ownerPick)?.name ?? '')
  const archName = archPick === NEW ? archNew.trim() : (state.customers.find((c) => c.id === archPick)?.name ?? '')

  const draft: NewProjectDraft = {
    name: name.trim(),
    address: address.trim(),
    town,
    customerId: ownerPick && ownerPick !== NEW ? ownerPick : null,
    ownerName,
    architectId: archPick && archPick !== NEW ? archPick : null,
    architectName: archName,
    bidDue: bidDue || null,
    sizeNote: sizeNote.trim(),
    setLabel: setLabel.trim() || 'Bid set',
    issuedOn,
    setNote: setNote.trim(),
    sheets: reading.sheets,
    ...(specReading.sections.length > 0 ? { specs: specReading.sections } : {}),
    trades: picked.map((r) => {
      const own = reading.sheets.filter((x) => r.from.includes(x.id))
      const ownSpecs = specReading.sections.filter((x) => r.specs.includes(x.id))
      return {
        trade: r.trade,
        budget: budgetNumber(r.budget),
        ours: r.ours,
        scope: r.scope.map((l) => l.label),
        scopeSheets: r.scope.map((l) => l.sheets ?? guessLineSheets(l.label, own)),
        ...(specReading.sections.length > 0 ? { scopeSpecs: r.scope.map((l) => l.specs ?? guessLineSpecs(l.label, ownSpecs)) } : {}),
        ...(r.excludes.some((x) => x.label.trim() !== '') ? { excludes: r.excludes } : {}),
      }
    }),
  }
  /** What one trade leaves out that nobody picks up. */
  const gaps = scopeGaps(picked.map((r) => ({ trade: r.trade, scope: r.scope.map((l) => l.label), excludes: r.excludes })))

  const missing: string[] = []
  if (draft.name === '') missing.push('Give the project a name.')
  if (ownerName === '') missing.push('Pick the owner.')
  if (archName === '') missing.push('Pick the architect.')
  if (picked.length === 0) missing.push(reading.sheets.length === 0 ? 'Paste the sheet index or add a trade.' : 'Tick at least one trade.')

  const scopeLines = picked.reduce((n, r) => n + r.scope.filter((l) => l.label.trim()).length, 0)
  const ours = picked.filter((r) => r.ours).length
  const budgets = picked.reduce((n, r) => n + budgetNumber(r.budget), 0)
  const sqFt = sqFtInText(sizeNote)
  /** The project as it will be made, so each trade's companies can be lined up before it exists. */
  const built = buildNewProject(state, draft).project
  const asksFor = (trade: string, pkg: (typeof built.packages)[number]) => asks[trade] ?? defaultAsks(state, built, pkg)
  const strangersOn = strangers.filter((x) => built.packages.some((p) => p.trade === x.trade && !p.selfPerform))
  const asked = built.packages.reduce((n, pkg) => n + asksFor(pkg.trade, pkg).length, 0) + strangersOn.length
  const summaries = [
    draft.name || 'No name yet',
    `${draft.setLabel} · ${reading.sheets.length} ${reading.sheets.length === 1 ? 'sheet' : 'sheets'}${
      specReading.sections.length > 0 ? `, ${specReading.sections.length} ${specReading.sections.length === 1 ? 'section' : 'sections'}` : ''
    }`,
    `${picked.length} ${picked.length === 1 ? 'trade' : 'trades'}${ours > 0 ? `, ${ours} ours` : ''}`,
    `${scopeLines} scope ${scopeLines === 1 ? 'line' : 'lines'}${gaps.length > 0 ? `, ${gaps.length} ${gaps.length === 1 ? 'gap' : 'gaps'}` : ''}`,
    asked === 0 ? 'Nobody asked yet' : `${asked} ${asked === 1 ? 'company' : 'companies'} asked`,
  ]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const create = () => {
    const id = newProjectId(state, draft)
    dispatch({ type: 'createProject', draft })
    // Each ask is the board's own invite, so the company's count and the log move as they do on Trades.
    for (const pkg of built.packages) {
      for (const partnerId of asksFor(pkg.trade, pkg)) dispatch({ type: 'invite', projectId: id, packageId: pkg.id, partnerId })
    }
    // Each company new to us comes in not vetted, then is asked like the rest.
    for (const action of strangerActions(state, { ...built, id }, strangersOn)) dispatch(action)
    onCreated(id)
  }

  const groups: { discipline: string; rows: PlanSheet[] }[] = []
  for (const s of reading.sheets) {
    const discipline = sheetDiscipline(s.id)
    const group = groups.find((g) => g.discipline === discipline)
    if (group) group.rows.push(s)
    else groups.push({ discipline, rows: [s] })
  }

  const notListed = TRADE_TEMPLATES.filter((t) => !rows.some((r) => r.trade === t.trade))
  const addTrade = (trade: string) => {
    const t = trade.trim()
    if (t === '' || rows.some((r) => r.trade.toLowerCase() === t.toLowerCase())) return
    setAdded((a) => [...a, t])
    edit(t, { on: true })
    setAddText('')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="A new project"
        style={{
          background: 'var(--surface)',
          color: 'var(--text-base)',
          borderRadius: 10,
          width: 'min(1040px, 100%)',
          height: 'min(760px, 94vh)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--border-strong)',
        }}
      >
        <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>A new project</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>It starts under Bidding to the owner. Nobody is asked to quote until you ask them.</div>
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

        {narrow ? (
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', padding: '0.5rem 1rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
            <div role="tablist" aria-label="Steps" style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
              {STEPS.map((s, i) => {
                const active = i === step
                return (
                  <button
                    key={s.title}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-label={`${i + 1}. ${s.title}: ${summaries[i]}`}
                    onClick={() => setStep(i)}
                    style={{
                      width: '1.9rem',
                      height: '1.9rem',
                      borderRadius: '50%',
                      border: `1px solid ${active ? 'var(--text-blue-500)' : 'var(--border-strong)'}`,
                      background: active ? '#2563eb' : 'var(--surface)',
                      color: active ? 'white' : 'var(--text-600)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {i + 1}
                  </button>
                )
              })}
            </div>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem' }}>{STEPS[step]?.title}</span>
              <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{summaries[step]}</span>
            </span>
          </div>
        ) : (
        <div role="tablist" aria-label="Steps" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))', gap: '0.4rem', padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
          {STEPS.map((s, i) => {
            const active = i === step
            return (
              <button
                key={s.title}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStep(i)}
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'center',
                  textAlign: 'left',
                  padding: '0.4rem 0.55rem',
                  borderRadius: 8,
                  border: `1px solid ${active ? 'var(--text-blue-500)' : 'var(--border)'}`,
                  background: active ? 'var(--bg-blue-tint)' : 'var(--surface)',
                  color: 'var(--text-base)',
                  cursor: 'pointer',
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    width: '1.4rem',
                    height: '1.4rem',
                    borderRadius: '50%',
                    background: active ? '#2563eb' : 'var(--bg-muted)',
                    color: active ? 'white' : 'var(--text-600)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem' }}>{s.title}</span>
                  <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {summaries[i]}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
        )}

        <div ref={body} style={{ padding: '0.9rem 1rem', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{STEPS[step]?.hint}</div>

          {step === 0 && (
            <div style={{ display: 'grid', gap: '0.8rem', gridTemplateColumns: 'repeat(auto-fit, minmax(16rem, 1fr))' }}>
              <Field label="Project name" wide>
                <input autoFocus style={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Leon Springs Urgent Care" />
              </Field>
              <Field label="Address">
                <input style={field} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="24165 IH-10 W, San Antonio" />
              </Field>
              <Field label="Town" hint="Each company's drive is measured from here.">
                <select style={field} value={town} onChange={(e) => setTown(e.target.value)}>
                  {TOWNS.map((t) => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Owner" hint="The company we build it for. It comes from the customer list.">
                <select style={field} value={ownerPick} onChange={(e) => setOwnerPick(e.target.value)}>
                  <option value="">Pick one</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} · {c.kind}</option>
                  ))}
                  <option value={NEW}>Someone new</option>
                </select>
                {ownerPick === NEW && <input style={field} value={ownerNew} onChange={(e) => setOwnerNew(e.target.value)} placeholder="Their company name" />}
              </Field>
              <Field label="Architect" hint="The firm that drew the plans. The same customer list.">
                <select style={field} value={archPick} onChange={(e) => setArchPick(e.target.value)}>
                  <option value="">Pick one</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} · {c.kind}</option>
                  ))}
                  <option value={NEW}>Someone new</option>
                </select>
                {archPick === NEW && <input style={field} value={archNew} onChange={(e) => setArchNew(e.target.value)} placeholder="The firm's name" />}
              </Field>
              <Field label="Our bid is due" hint="The days-left block on the board counts down to it.">
                <input type="date" style={field} value={bidDue} onChange={(e) => setBidDue(e.target.value)} />
              </Field>
              <Field label="Size" hint="One line, as you would say it.">
                <input style={field} value={sizeNote} onChange={(e) => setSizeNote(e.target.value)} placeholder="6,800 sq ft clinic, one story" />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(19rem, 1fr))', alignItems: 'start' }}>
              <div style={{ display: 'grid', gap: '0.8rem' }}>
                <Field label="What this set is called">
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {['Bid set', 'Pricing set', 'Permit set'].map((l) => (
                      <button
                        key={l}
                        type="button"
                        aria-pressed={setLabel === l}
                        onClick={() => setSetLabel(l)}
                        style={{
                          padding: '0.25rem 0.65rem',
                          borderRadius: 999,
                          border: `1px solid ${setLabel === l ? 'var(--text-blue-500)' : 'var(--border-strong)'}`,
                          background: setLabel === l ? 'var(--bg-blue-tint)' : 'var(--surface)',
                          color: setLabel === l ? 'var(--text-blue-500)' : 'var(--text-600)',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                        }}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  <input style={field} value={setLabel} onChange={(e) => setSetLabel(e.target.value)} />
                </Field>
                <div style={{ display: 'grid', gap: '0.8rem', gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))' }}>
                  <Field label="It came in on">
                    <input type="date" style={field} value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} />
                  </Field>
                  <Field label="A line about it">
                    <input style={field} value={setNote} onChange={(e) => setSetNote(e.target.value)} placeholder="The set the owner sent out to bid." />
                  </Field>
                </div>
                <Field label="The sheet index" hint="Paste the sheet list from the cover sheet. Each line that starts with a sheet number becomes a sheet.">
                  <textarea
                    value={indexText}
                    onChange={(e) => setIndexText(e.target.value)}
                    rows={11}
                    placeholder={'G-001  Cover sheet\nC-101  Site plan\nA-101  Floor plan\nA-201  Exterior elevations\nM-101  HVAC plan'}
                    style={{ ...field, fontFamily: 'inherit', resize: 'vertical' }}
                  />
                </Field>
                {indexText.trim() === '' && (
                  <div>
                    <Btn kind="quiet" onClick={() => setIndexText(SAMPLE_SHEET_INDEX)}>Paste a made-up sheet index</Btn>
                  </div>
                )}
                <Field
                  label="The project manual's table of contents"
                  hint="Paste the list of sections from the front of the specs. Each line that starts with a section number becomes a section. Leave it empty when no specs came in."
                >
                  <textarea
                    value={specText}
                    onChange={(e) => setSpecText(e.target.value)}
                    rows={7}
                    placeholder={'07 54 23  TPO roofing\n09 29 00  Gypsum board\n09 91 23  Interior painting\n22 40 00  Plumbing fixtures'}
                    style={{ ...field, fontFamily: 'inherit', resize: 'vertical' }}
                  />
                </Field>
                {specText.trim() === '' && (
                  <div>
                    <Btn kind="quiet" onClick={() => setSpecText(SAMPLE_SPEC_INDEX)}>Paste a made-up table of contents</Btn>
                  </div>
                )}
              </div>

              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', background: 'var(--bg-subtle)', fontSize: '0.85rem' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.4rem' }}>
                  {reading.sheets.length === 0 ? 'No sheets read yet' : `${reading.sheets.length} sheets read`}
                </div>
                {reading.sheets.length === 0 && (
                  <div style={{ color: 'var(--text-muted)' }}>The sheets show here as you paste, grouped the way the plans window shows them.</div>
                )}
                {groups.map((g) => (
                  <div key={g.discipline} style={{ marginBottom: '0.45rem' }}>
                    <div style={{ fontSize: '0.68rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      {g.discipline} · {g.rows.length}
                    </div>
                    {g.rows.map((s) => (
                      <div key={s.id} style={{ display: 'flex', gap: '0.45rem' }}>
                        <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', minWidth: '3.6rem' }}>{s.id}</span>
                        <span style={{ color: s.title ? 'var(--text-base)' : 'var(--text-muted)' }}>{s.title || 'no title'}</span>
                      </div>
                    ))}
                  </div>
                ))}
                {reading.unread.length > 0 && (
                  <div style={{ marginTop: '0.4rem', padding: '0.4rem 0.55rem', borderRadius: 6, background: 'var(--bg-amber-tint)' }}>
                    These lines were not read as sheets. A sheet line starts with its number.
                    {reading.unread.map((l) => (
                      <div key={l} style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem' }}>{l}</div>
                    ))}
                  </div>
                )}
                {(specReading.sections.length > 0 || specReading.unread.length > 0) && (
                  <div style={{ marginTop: '0.6rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.4rem' }}>{specReading.sections.length} sections read</div>
                    {[...new Set(specReading.sections.map((x) => specDivision(x.id)))].map((div) => (
                      <div key={div} style={{ marginBottom: '0.45rem' }}>
                        <div style={{ fontSize: '0.68rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                          Division {div} · {SPEC_DIVISIONS[div] ?? 'Other'}
                        </div>
                        {specReading.sections
                          .filter((x) => specDivision(x.id) === div)
                          .map((x) => (
                            <div key={x.id} style={{ display: 'flex', gap: '0.45rem' }}>
                              <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', minWidth: '4.6rem' }}>{x.id}</span>
                              <span>{x.title || 'no title'}</span>
                            </div>
                          ))}
                      </div>
                    ))}
                    {specReading.unread.length > 0 && (
                      <div style={{ marginTop: '0.4rem', padding: '0.4rem 0.55rem', borderRadius: 6, background: 'var(--bg-amber-tint)' }}>
                        These lines were not read as sections. A section line starts with its number, like 09 91 23.
                        {specReading.unread.map((l) => (
                          <div key={l} style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem' }}>{l}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.875rem' }}>
                The trades are a guess from the sheets and the specs. Untick a trade we do not need. Tick <strong>Ours</strong> when our own crew does it. We then price it ourselves in Trades mode. The trade counts as a real number once we price it there. Until then its budget is our guess.
              </div>
              {rows.length === 0 ? (
                <div style={{ color: 'var(--text-muted)' }}>No trades yet. Paste the sheet index on step 2, or add a trade below.</div>
              ) : (
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  {rows.map((r) => (
                    <div
                      key={r.trade}
                      style={{
                        display: 'flex',
                        gap: '0.6rem',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        padding: '0.4rem 0.7rem',
                        borderBottom: '1px solid var(--border)',
                        fontSize: '0.875rem',
                        background: r.ours && r.on ? 'var(--bg-violet-100)' : undefined,
                      }}
                    >
                      <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: '1 1 14rem', minWidth: 0, cursor: 'pointer', opacity: r.on ? 1 : 0.55 }}>
                        <input type="checkbox" checked={r.on} onChange={(e) => edit(r.trade, { on: e.target.checked })} />
                        <strong>{r.trade}</strong>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.from.length > 0 || r.specs.length > 0 ? `from ${sheetsWords([...r.from, ...r.specs])}` : 'you added it'}
                        </span>
                      </label>
                      {r.on && (
                        <>
                          <label style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            <input type="checkbox" checked={r.ours} onChange={(e) => edit(r.trade, { ours: e.target.checked })} />
                            Ours
                          </label>
                          <label style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', whiteSpace: 'nowrap' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{r.ours ? 'Our guess' : 'Our budget'}</span>
                            <input
                              style={{ ...input, width: '7.5rem', textAlign: 'right' }}
                              inputMode="numeric"
                              value={r.budget}
                              onChange={(e) => edit(r.trade, { budget: e.target.value })}
                              placeholder="$0"
                            />
                          </label>
                          {filled[r.trade] && filled[r.trade]?.budget === r.budget && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{filled[r.trade]?.words}</span>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.875rem' }}>
                <span style={{ fontWeight: 600 }}>Add a trade</span>
                <select
                  style={input}
                  value=""
                  onChange={(e) => addTrade(e.target.value)}
                  aria-label="Add a trade from the usual list"
                >
                  <option value="">From the usual list</option>
                  {notListed.map((t) => (
                    <option key={t.trade} value={t.trade}>{t.trade}</option>
                  ))}
                </select>
                <span style={{ color: 'var(--text-muted)' }}>or type one</span>
                <input
                  style={{ ...input, flex: '0 1 14rem' }}
                  value={addText}
                  onChange={(e) => setAddText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addTrade(addText)
                  }}
                  placeholder="Elevator"
                />
                <Btn disabled={addText.trim() === ''} onClick={() => addTrade(addText)}>Add</Btn>
              </div>
              {picked.some((r) => r.budget.trim() === '') && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.875rem' }}>
                  {sqFt === null ? (
                    <span style={{ color: 'var(--text-muted)' }}>Give the size in square feet on step 1, like 6,800 sq ft. Then the budgets can be filled from it.</span>
                  ) : (
                    <>
                      <Btn
                        onClick={() => {
                          const next: Record<string, { budget: string; words: string }> = {}
                          for (const r of picked) {
                            const b = r.budget.trim() === '' ? budgetForSize(state, r.trade, sqFt) : null
                            if (b === null) continue
                            const budget = b.amount.toLocaleString('en-US')
                            const rate = `$${b.perSqFt.toFixed(2)} a sq ft`
                            next[r.trade] = { budget, words: b.jobs > 0 ? `${rate}, from ${b.jobs} past ${b.jobs === 1 ? 'job' : 'jobs'}` : `${rate}, a rough rate` }
                            edit(r.trade, { budget })
                          }
                          setFilled((all) => ({ ...all, ...next }))
                        }}
                      >
                        Fill the empty budgets from the size
                      </Btn>
                      <span style={{ color: 'var(--text-muted)' }}>
                        Each trade's cost per square foot on our past jobs, times {sqFt.toLocaleString('en-US')} sq ft. A trade we have no past job for uses a rough rate. Change any of them.
                      </span>
                    </>
                  )}
                </div>
              )}
              {budgets > 0 && (
                <div style={{ color: 'var(--text-600)', fontSize: '0.875rem' }}>
                  The budgets add up to <strong>{money(budgets)}</strong>. A budget is our own guess. It fills the price until a quote comes in.
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.875rem' }}>
                Each line is one piece of work. A company says yes or no to every line when it quotes. Compare quotes reads them line by line.
              </div>
              {picked.length === 0 ? (
                <div style={{ color: 'var(--text-muted)' }}>No trades are ticked yet. Pick them on step 3.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: roomy ? 'row' : 'column', gap: '0.75rem', alignItems: roomy ? 'flex-start' : 'stretch' }}>
                  <div
                    role="tablist"
                    aria-label="Trades"
                    style={roomy ? { display: 'grid', gap: '0.25rem', flex: '0 0 16rem' } : { display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}
                  >
                    {picked.map((r) => {
                      const active = r.trade === shown?.trade
                      const n = r.scope.filter((l) => l.label.trim()).length
                      return (
                        <button
                          key={r.trade}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setScopeFor(r.trade)}
                          style={{
                            display: 'flex',
                            gap: '0.4rem',
                            alignItems: 'center',
                            textAlign: 'left',
                            padding: '0.35rem 0.55rem',
                            borderRadius: roomy ? 6 : 999,
                            border: roomy ? '1px solid transparent' : `1px solid ${active ? 'var(--text-blue-500)' : 'var(--border-strong)'}`,
                            background: active ? 'var(--bg-blue-tint)' : 'transparent',
                            color: 'var(--text-base)',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                          }}
                        >
                          <span style={{ flex: roomy ? 1 : undefined, fontWeight: active ? 600 : 400 }}>{r.trade}</span>
                          {r.ours && <Chip tone="violet">ours</Chip>}
                          {r.scopeEdited && <Chip tone="blue">changed</Chip>}
                          {gaps.some((g) => g.trade === r.trade || g.by === r.trade) && <Chip tone="amber">gap</Chip>}
                          <span style={{ color: n === 0 ? 'var(--text-red-700)' : 'var(--text-muted)', fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                        </button>
                      )
                    })}
                  </div>
                  {shown && (
                    <ScopeEditor
                      key={shown.trade}
                      row={shown}
                      sheets={reading.sheets}
                      specs={specReading.sections}
                      onChange={(scope) => edit(shown.trade, { scope })}
                      onReset={() => edit(shown.trade, { scope: undefined })}
                      trades={picked.map((r) => r.trade)}
                      gaps={gaps.filter((g) => g.trade === shown.trade || g.by === shown.trade)}
                      onExcludes={(excludes) => edit(shown.trade, { excludes })}
                      onAddLine={(trade, label) => {
                        const to = rows.find((r) => r.trade === trade)
                        if (to) edit(trade, { scope: [...to.scope, { label, sheets: null }] })
                      }}
                      onAddTrade={addTrade}
                      next={picked[picked.indexOf(shown) + 1]?.trade ?? null}
                      onNext={setScopeFor}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div style={{ display: 'grid', gap: '0.8rem' }}>
              <div style={{ fontSize: '0.875rem' }}>
                The most reliable companies in range are ticked, up to three a trade, so at least two quotes come back. Each one gets a portal link with the plans, its trade&apos;s scope and the due date. Missing paperwork does not stop a quote. It shows under the company, to fix before you award.
              </div>
              {built.packages.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No trades are ticked yet. Pick them on step 3.</div>}
              {built.packages.map((pkg) => {
                if (pkg.selfPerform) {
                  return (
                    <div key={pkg.id} style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      <strong style={{ color: 'var(--text-base)' }}>{pkg.trade}</strong> is ours. Nobody is asked.
                    </div>
                  )
                }
                const lineup = tradeLineup(state, built, pkg)
                const mine = strangers.filter((x) => x.trade === pkg.trade)
                const on = [...asksFor(pkg.trade, pkg), ...mine.map((x) => `new:${x.company}`)]
                return (
                  <div key={pkg.id} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', padding: '0.4rem 0.7rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }}>
                      <strong>{pkg.trade}</strong>
                      <span style={{ color: on.length >= 2 ? 'var(--text-muted)' : 'var(--text-red-700)' }}>
                        {on.length === 0 ? 'nobody asked' : `${on.length} asked`}
                        {on.length > 0 && on.length < 2 ? '. Two quotes is the least you want.' : ''}
                      </span>
                      <span style={{ flex: 1 }} />
                      {asks[pkg.trade] && (
                        <Btn kind="quiet" onClick={() => setAsks((all) => Object.fromEntries(Object.entries(all).filter(([t]) => t !== pkg.trade)))}>
                          Tick the most reliable again
                        </Btn>
                      )}
                    </div>
                    {lineup.length === 0 ? (
                      <div style={{ padding: '0.4rem 0.7rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        No company in the directory does {inSentence(pkg.trade)} yet. Ask one below.
                      </div>
                    ) : (
                      lineup.map((row) => {
                        const ticked = on.includes(row.partner.id)
                        const miles = travelWords(row.travel, row.partner)
                        const blockers = partnerBlockers(row.partner, state.today)
                        return (
                          <label
                            key={row.partner.id}
                            style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.35rem 0.7rem', borderBottom: '1px solid var(--border)', fontSize: '0.875rem', cursor: 'pointer', opacity: row.travel.inZone ? 1 : 0.6 }}
                          >
                            <input
                              type="checkbox"
                              checked={ticked}
                              onChange={(e) => {
                                const was = asksFor(pkg.trade, pkg)
                                setAsks((all) => ({ ...all, [pkg.trade]: e.target.checked ? [...was, row.partner.id] : was.filter((x) => x !== row.partner.id) }))
                              }}
                            />
                            <strong>{row.partner.company}</strong>
                            <span style={{ color: 'var(--text-muted)' }}>{miles || 'coverage not set'}</span>
                            <span style={{ flex: 1 }} />
                            {vettingWords(row.partner) !== '' && <Chip tone="amber">{vettingWords(row.partner)}</Chip>}
                            <RecordChip record={answerRecord(row.partner)} />
                            {blockers.length > 0 && (
                              <span style={{ flexBasis: '100%', paddingLeft: '1.6rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{blockers.join(' ')}</span>
                            )}
                          </label>
                        )
                      })
                    )}
                    {mine.map((x, i) => (
                      <div key={`${x.company}-${i}`} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.35rem 0.7rem', borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }}>
                        <input type="checkbox" checked readOnly aria-label={`${x.company} is asked`} />
                        <strong>{x.company}</strong>
                        <span style={{ color: 'var(--text-muted)' }}>{x.contact || 'no contact yet'}</span>
                        <span style={{ flex: 1 }} />
                        <Chip tone="amber">not vetted yet</Chip>
                        <Chip tone="grey">new to us</Chip>
                        <button
                          type="button"
                          onClick={() => setStrangers((all) => all.filter((y) => y !== x))}
                          aria-label={`Do not ask ${x.company}`}
                          style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', padding: '0 0.3rem' }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {strangerFor === pkg.trade ? (
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.45rem 0.7rem', fontSize: '0.875rem' }}>
                        <input
                          autoFocus
                          style={{ ...field, flex: '1 1 12rem', minWidth: 0 }}
                          value={strangerName}
                          onChange={(e) => setStrangerName(e.target.value)}
                          placeholder="The company's name"
                          aria-label={`A company new to us for ${pkg.trade}`}
                        />
                        <input
                          style={{ ...field, flex: '1 1 12rem', minWidth: 0 }}
                          value={strangerContact}
                          onChange={(e) => setStrangerContact(e.target.value)}
                          placeholder="Their email or phone"
                          aria-label={`How to reach the new company for ${pkg.trade}`}
                        />
                        <Btn
                          disabled={strangerName.trim() === ''}
                          onClick={() => {
                            setStrangers((all) => [...all, { trade: pkg.trade, company: strangerName.trim(), contact: strangerContact.trim() }])
                            setStrangerName('')
                            setStrangerContact('')
                            setStrangerFor(null)
                          }}
                        >
                          Ask them
                        </Btn>
                        <Btn kind="quiet" onClick={() => setStrangerFor(null)}>Cancel</Btn>
                        <span style={{ flexBasis: '100%', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                          Anyone can quote. A company new to us comes in not vetted. Nothing is awarded to them until we approve them on Trade partners.
                        </span>
                      </div>
                    ) : (
                      <div style={{ padding: '0.35rem 0.7rem' }}>
                        <Btn
                          kind="quiet"
                          onClick={() => {
                            setStrangerFor(pkg.trade)
                            setStrangerName('')
                            setStrangerContact('')
                          }}
                        >
                          + Ask a company not on our list
                        </Btn>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ padding: '0.65rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-600)', flex: '1 1 18rem' }}>
            {missing.length > 0
              ? missing[0]
              : `${draft.name} starts under Bidding to the owner with ${picked.length} ${picked.length === 1 ? 'trade' : 'trades'}. ${
                  asked === 0 ? 'Nobody is asked yet.' : `${asked} ${asked === 1 ? 'company is' : 'companies are'} asked to quote.`
                }${strangersOn.length > 0 ? ` ${strangersOn.length} ${strangersOn.length === 1 ? 'is' : 'are'} new to us and not vetted yet.` : ''}`}
          </span>
          <Btn kind="quiet" onClick={onClose}>Cancel</Btn>
          {step > 0 && <Btn onClick={() => setStep(step - 1)}>← Back</Btn>}
          {step < STEPS.length - 1 ? (
            <Btn kind="primary" onClick={() => setStep(step + 1)}>Next →</Btn>
          ) : (
            <Btn kind="primary" disabled={missing.length > 0} title={missing.join(' ') || undefined} onClick={create}>
              Create the project
            </Btn>
          )}
        </div>
      </div>
    </div>
  )
}

const RECORD_WORDS: Record<AnswerRecord, { tone: 'green' | 'amber' | 'red' | 'grey'; words: string }> = {
  reliable: { tone: 'green', words: 'answers when asked' },
  mixed: { tone: 'amber', words: 'answers some asks' },
  silent: { tone: 'red', words: 'often silent' },
  new: { tone: 'grey', words: 'new to us' },
}

function RecordChip({ record }: { record: AnswerRecord }) {
  const r = RECORD_WORDS[record]
  return <Chip tone={r.tone}>{r.words}</Chip>
}

function ScopeEditor({
  row,
  sheets,
  specs,
  onChange,
  onReset,
  next,
  onNext,
  trades,
  gaps,
  onExcludes,
  onAddLine,
  onAddTrade,
}: {
  row: TradeRow
  sheets: PlanSheet[]
  specs: SpecSection[]
  onChange: (scope: ScopeLineDraft[]) => void
  onReset: () => void
  next: string | null
  onNext: (trade: string) => void
  /** The trades on the project, for who does what this one leaves out. */
  trades: string[]
  /** The gaps this trade is part of: what it leaves out that nobody picks up, and what others leave to it. */
  gaps: ScopeGap[]
  onExcludes: (excludes: ScopeExclusion[]) => void
  onAddLine: (trade: string, label: string) => void
  onAddTrade: (trade: string) => void
}) {
  return (
    <div style={{ flex: '1 1 auto', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.8rem', display: 'grid', gap: '0.45rem', minWidth: 0 }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <strong>{row.trade}</strong>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          {row.ours
            ? 'Ours. This is the scope we price ourselves.'
            : row.from.length > 0 || row.specs.length > 0
              ? `Reads from ${sheetsWords([...row.from, ...row.specs])}.`
              : 'You added this trade.'}
        </span>
      </div>
      <ScopeLines
        trade={row.trade}
        lines={row.scope}
        onChange={onChange}
        sheets={sheets}
        tradeSheets={sheets.filter((x) => row.from.includes(x.id))}
        specs={specs}
        tradeSpecs={specs.filter((x) => row.specs.includes(x.id))}
      >
        {row.scopeEdited && usualScope(row.trade).length > 0 && <Btn kind="quiet" onClick={onReset}>Put back the usual lines</Btn>}
        <span style={{ flex: 1 }} />
        {next && <Btn kind="quiet" onClick={() => onNext(next)}>Next trade: {next} →</Btn>}
      </ScopeLines>
      <Excludes trade={row.trade} excludes={row.excludes} trades={trades} onChange={onExcludes} />
      {gaps.length > 0 && (
        <div style={{ display: 'grid', gap: '0.35rem', padding: '0.5rem 0.65rem', borderRadius: 8, background: 'var(--bg-amber-tint)', fontSize: '0.85rem' }}>
          <strong>Gaps between the trades</strong>
          {gaps.map((g) => (
            <div key={`${g.trade}-${g.label}`} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ flex: '1 1 16rem', minWidth: 0 }}>
                {g.problem === 'not on the job'
                  ? `${g.trade} leaves out ${inSentence(g.label)} for ${g.by}. ${g.by} is not on this job.`
                  : `${g.trade} leaves out ${inSentence(g.label)} for ${g.by}. The ${g.by} scope does not list it.`}
              </span>
              {g.problem === 'not on the job' ? (
                <Btn kind="quiet" onClick={() => onAddTrade(g.by)}>Add {g.by}</Btn>
              ) : (
                <Btn kind="quiet" onClick={() => onAddLine(g.by, g.label)}>Add it to {g.by}</Btn>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * What a trade's quote leaves out, each with who does it instead: another trade, the owner or us.
 * The usual ones come in from the trade's list; the office changes them.
 */
function Excludes({ trade, excludes, trades, onChange }: { trade: string; excludes: ScopeExclusion[]; trades: string[]; onChange: (excludes: ScopeExclusion[]) => void }) {
  const set = (i: number, patch: Partial<ScopeExclusion>) => onChange(excludes.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const others = trades.filter((t) => t !== trade)
  return (
    <div style={{ display: 'grid', gap: '0.3rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
      <strong style={{ fontSize: '0.9rem' }}>Not in this trade</strong>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        Work this trade's quote leaves out, and who does it instead. Each company sees this list when it quotes.
      </span>
      {excludes.map((x, i) => (
        <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            style={{ ...input, flex: '1 1 12rem', minWidth: 0 }}
            value={x.label}
            onChange={(e) => set(i, { label: e.target.value })}
            placeholder="Gas piping"
            aria-label={`What ${trade} leaves out`}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>by</span>
          <select style={{ ...input, flex: '0 1 12rem', minWidth: 0 }} value={x.by} onChange={(e) => set(i, { by: e.target.value })} aria-label={`Who does ${x.label || 'it'} instead`}>
            {[...others, ...(others.includes(x.by) || BY_NOT_A_TRADE.includes(x.by) ? [] : [x.by])].map((t) => (
              <option key={t} value={t}>
                {others.includes(t) ? t : `${t} (not on this job)`}
              </option>
            ))}
            {BY_NOT_A_TRADE.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onChange(excludes.filter((_, j) => j !== i))}
            aria-label={`Take ${x.label || 'this'} off the list`}
            style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', padding: '0 0.3rem' }}
          >
            ×
          </button>
        </div>
      ))}
      <div>
        <Btn kind="quiet" onClick={() => onChange([...excludes, { label: '', by: BY_NOT_A_TRADE[0] ?? 'the owner' }])}>+ Something it leaves out</Btn>
      </div>
    </div>
  )
}

/**
 * A trade's scope lines to change: each line a box with the sheets it reads from beside it, ×
 * takes a line or a sheet out, Enter starts the next line. A line's sheets follow a guess from its
 * words until the office changes them. The New project window and the new-set-of-plans window
 * both write scope with it.
 */
export function ScopeLines({
  trade,
  lines,
  onChange,
  sheets,
  tradeSheets,
  specs = [],
  tradeSpecs = [],
  children,
}: {
  trade: string
  lines: ScopeLineDraft[]
  onChange: (lines: ScopeLineDraft[]) => void
  /** Every sheet in the set, to tie a line to. */
  sheets: PlanSheet[]
  /** The sheets that suggest this trade: the guess reads these, and they come first in the list. */
  tradeSheets: PlanSheet[]
  /** Every section of the project manual, to tie a line to. Empty: no specs came in. */
  specs?: SpecSection[]
  /** The sections that suggest this trade: the guess reads these, and they come first. */
  tradeSpecs?: SpecSection[]
  /** More buttons on the line under the boxes. */
  children?: ReactNode
}) {
  const boxes = useRef<(HTMLInputElement | null)[]>([])
  const [focusAt, setFocusAt] = useState<number | null>(null)
  useEffect(() => {
    if (focusAt === null) return
    boxes.current[focusAt]?.focus()
    setFocusAt(null)
  }, [focusAt])
  const addAfter = (i: number) => {
    onChange([...lines.slice(0, i + 1), { label: '', sheets: null }, ...lines.slice(i + 1)])
    setFocusAt(i + 1)
  }
  const set = (i: number, patch: Partial<ScopeLineDraft>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  const others = sheets.filter((x) => !tradeSheets.some((t) => t.id === x.id))
  const otherSpecs = specs.filter((x) => !tradeSpecs.some((t) => t.id === x.id))
  const titleOf = (id: string) => sheets.find((x) => x.id === id)?.title ?? ''
  const specTitle = (id: string) => specs.find((x) => x.id === id)?.title ?? ''
  return (
    <>
      {lines.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No lines yet. A quote with no lines cannot be compared.</div>}
      {lines.length > 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
          Each line shows the sheets{specs.length > 0 ? ' and spec sections' : ''} it reads from, guessed from its words. Take one out with × or add one.
        </div>
      )}
      {lines.map((line, i) => {
        const on = line.sheets ?? guessLineSheets(line.label, tradeSheets)
        const onSpecs = line.specs ?? guessLineSpecs(line.label, tradeSpecs)
        return (
          <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', width: '1.2rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
            <input
              ref={(el) => {
                boxes.current[i] = el
              }}
              style={{ ...input, flex: '1 1 12rem', minWidth: 0 }}
              value={line.label}
              onChange={(e) => set(i, { label: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addAfter(i)
              }}
              aria-label={`${trade} line ${i + 1}`}
            />
            <span style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', flex: '0 1 14rem' }}>
              {on.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>all {inSentence(trade)} sheets</span>}
              {on.map((id) => (
                <span
                  key={id}
                  title={titleOf(id)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem', padding: '0 0.15rem 0 0.45rem', borderRadius: 999, background: 'var(--bg-muted)', color: 'var(--text-600)', fontSize: '0.75rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
                >
                  {id}
                  <button
                    type="button"
                    onClick={() => set(i, { sheets: on.filter((x) => x !== id) })}
                    aria-label={`Take ${id} off ${line.label || 'this line'}`}
                    style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: '0 0.2rem', lineHeight: 1 }}
                  >
                    ×
                  </button>
                </span>
              ))}
              {onSpecs.map((id) => (
                <span
                  key={`spec-${id}`}
                  title={specTitle(id)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem', padding: '0 0.15rem 0 0.45rem', borderRadius: 999, background: 'var(--bg-violet-100)', color: 'var(--text-violet-800)', fontSize: '0.75rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
                >
                  {id}
                  <button
                    type="button"
                    onClick={() => set(i, { specs: onSpecs.filter((x) => x !== id) })}
                    aria-label={`Take section ${id} off ${line.label || 'this line'}`}
                    style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', padding: '0 0.2rem', lineHeight: 1 }}
                  >
                    ×
                  </button>
                </span>
              ))}
              {sheets.length + specs.length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    const v = e.target.value
                    if (v.startsWith('sheet:')) set(i, { sheets: [...on, v.slice(6)] })
                    if (v.startsWith('spec:')) set(i, { specs: [...onSpecs, v.slice(5)] })
                  }}
                  aria-label={`Add a sheet or a section to ${line.label || 'this line'}`}
                  style={{ ...input, padding: '0.1rem 0.25rem', fontSize: '0.75rem', width: '4.6rem' }}
                >
                  <option value="">+ add</option>
                  {tradeSheets.length > 0 && (
                    <optgroup label={`${trade} sheets`}>
                      {tradeSheets.filter((x) => !on.includes(x.id)).map((x) => (
                        <option key={x.id} value={`sheet:${x.id}`}>{x.id} {x.title}</option>
                      ))}
                    </optgroup>
                  )}
                  {others.length > 0 && (
                    <optgroup label="Other sheets">
                      {others.filter((x) => !on.includes(x.id)).map((x) => (
                        <option key={x.id} value={`sheet:${x.id}`}>{x.id} {x.title}</option>
                      ))}
                    </optgroup>
                  )}
                  {tradeSpecs.length > 0 && (
                    <optgroup label={`${trade} sections`}>
                      {tradeSpecs.filter((x) => !onSpecs.includes(x.id)).map((x) => (
                        <option key={x.id} value={`spec:${x.id}`}>{x.id} {x.title}</option>
                      ))}
                    </optgroup>
                  )}
                  {otherSpecs.length > 0 && (
                    <optgroup label="Other sections">
                      {otherSpecs.filter((x) => !onSpecs.includes(x.id)).map((x) => (
                        <option key={x.id} value={`spec:${x.id}`}>{x.id} {x.title}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              )}
            </span>
            <button
              type="button"
              onClick={() => onChange(lines.filter((_, j) => j !== i))}
              aria-label={`Take out ${line.label || 'this line'}`}
              style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, padding: '0.1rem 0.3rem' }}
            >
              ×
            </button>
          </div>
        )
      })}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <Btn onClick={() => addAfter(lines.length - 1)}>Add a line</Btn>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Enter in a line starts the next one.</span>
        {children}
      </div>
    </>
  )
}

/** The way in from the board: a button that opens the New project window. */
export function GcNewProjectButton({
  state,
  dispatch,
  onCreated,
}: {
  state: GcState
  dispatch: Dispatch<GcAction>
  onCreated: (projectId: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Btn onClick={() => setOpen(true)}>+ New project</Btn>
      {open && (
        <GcNewProjectWindow
          state={state}
          dispatch={dispatch}
          onClose={() => setOpen(false)}
          onCreated={(id) => {
            setOpen(false)
            onCreated(id)
          }}
        />
      )}
    </>
  )
}
