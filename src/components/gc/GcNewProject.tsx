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
  tradesForSheets,
  usualScope,
  type GcAction,
  type GcState,
  type NewProjectDraft,
  type PlanSheet,
} from '../../lib/gcMode/gcModel'
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
] as const

/** What the office changed on one trade. A field left out follows the guess. */
interface TradeEdit {
  on?: boolean
  ours?: boolean
  budget?: string
  scope?: string[]
}

interface TradeRow {
  trade: string
  /** The sheets that suggest the trade. Empty: the office added it. */
  from: string[]
  on: boolean
  ours: boolean
  budget: string
  scope: string[]
  scopeEdited: boolean
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

  const [edits, setEdits] = useState<Record<string, TradeEdit>>({})
  const [added, setAdded] = useState<string[]>([])
  const [addText, setAddText] = useState('')
  const [scopeFor, setScopeFor] = useState<string | null>(null)

  const reading = useMemo(() => sheetIndexInText(indexText), [indexText])
  const guesses = useMemo(() => tradesForSheets(reading.sheets), [reading.sheets])

  const rows: TradeRow[] = useMemo(() => {
    const names = [...guesses.map((g) => g.trade), ...added.filter((t) => !guesses.some((g) => g.trade === t))]
    return names
      .map((trade) => {
        const e = edits[trade] ?? {}
        return {
          trade,
          from: guesses.find((g) => g.trade === trade)?.from ?? [],
          on: e.on ?? true,
          ours: e.ours ?? OUR_TRADES.includes(trade),
          budget: e.budget ?? '',
          scope: e.scope ?? usualScope(trade),
          scopeEdited: e.scope !== undefined,
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
    trades: picked.map((r) => ({ trade: r.trade, budget: budgetNumber(r.budget), ours: r.ours, scope: r.scope })),
  }

  const missing: string[] = []
  if (draft.name === '') missing.push('Give the project a name.')
  if (ownerName === '') missing.push('Pick the owner.')
  if (archName === '') missing.push('Pick the architect.')
  if (picked.length === 0) missing.push(reading.sheets.length === 0 ? 'Paste the sheet index or add a trade.' : 'Tick at least one trade.')

  const scopeLines = picked.reduce((n, r) => n + r.scope.filter((s) => s.trim()).length, 0)
  const ours = picked.filter((r) => r.ours).length
  const budgets = picked.reduce((n, r) => n + budgetNumber(r.budget), 0)
  const summaries = [
    draft.name || 'No name yet',
    `${draft.setLabel} · ${reading.sheets.length} ${reading.sheets.length === 1 ? 'sheet' : 'sheets'}`,
    `${picked.length} ${picked.length === 1 ? 'trade' : 'trades'}${ours > 0 ? `, ${ours} ours` : ''}`,
    `${scopeLines} scope ${scopeLines === 1 ? 'line' : 'lines'}`,
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
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.875rem' }}>
                The trades are a guess from the sheets. Untick a trade we do not need. Tick <strong>Ours</strong> when our own crew does it. Its number then comes from our own bid in Trades mode.
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
                          {r.from.length > 0 ? `from ${sheetsWords(r.from)}` : 'you added it'}
                        </span>
                      </label>
                      {r.on && (
                        <>
                          <label style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            <input type="checkbox" checked={r.ours} onChange={(e) => edit(r.trade, { ours: e.target.checked })} />
                            Ours
                          </label>
                          <label style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', whiteSpace: 'nowrap' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{r.ours ? 'Our bid' : 'Our budget'}</span>
                            <input
                              style={{ ...input, width: '7.5rem', textAlign: 'right' }}
                              inputMode="numeric"
                              value={r.budget}
                              onChange={(e) => edit(r.trade, { budget: e.target.value })}
                              placeholder="$0"
                            />
                          </label>
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
                Each line is one piece of work. A company says yes or no to every line when it quotes. Compare bids reads them line by line.
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
                      const n = r.scope.filter((s) => s.trim()).length
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
                          <span style={{ color: n === 0 ? 'var(--text-red-700)' : 'var(--text-muted)', fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                        </button>
                      )
                    })}
                  </div>
                  {shown && (
                    <ScopeEditor
                      key={shown.trade}
                      row={shown}
                      onChange={(scope) => edit(shown.trade, { scope })}
                      onReset={() => edit(shown.trade, { scope: undefined })}
                      next={picked[picked.indexOf(shown) + 1]?.trade ?? null}
                      onNext={setScopeFor}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: '0.65rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-600)', flex: '1 1 18rem' }}>
            {missing.length > 0
              ? missing[0]
              : `${draft.name} starts under Bidding to the owner with ${picked.length} ${picked.length === 1 ? 'trade' : 'trades'}. Nobody is asked yet.`}
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

function ScopeEditor({
  row,
  onChange,
  onReset,
  next,
  onNext,
}: {
  row: TradeRow
  onChange: (scope: string[]) => void
  onReset: () => void
  next: string | null
  onNext: (trade: string) => void
}) {
  return (
    <div style={{ flex: '1 1 auto', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.8rem', display: 'grid', gap: '0.45rem', minWidth: 0 }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <strong>{row.trade}</strong>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          {row.ours ? 'Ours. This is the scope of our own bid.' : row.from.length > 0 ? `Reads from ${sheetsWords(row.from)}.` : 'You added this trade.'}
        </span>
      </div>
      <ScopeLines trade={row.trade} lines={row.scope} onChange={onChange}>
        {row.scopeEdited && usualScope(row.trade).length > 0 && <Btn kind="quiet" onClick={onReset}>Put back the usual lines</Btn>}
        <span style={{ flex: 1 }} />
        {next && <Btn kind="quiet" onClick={() => onNext(next)}>Next trade: {next} →</Btn>}
      </ScopeLines>
    </div>
  )
}

/**
 * A trade's scope lines to change: each line a box, × takes it out, Enter starts the next one.
 * The New project window and the new-set-of-plans window both write scope with it.
 */
export function ScopeLines({
  trade,
  lines,
  onChange,
  children,
}: {
  trade: string
  lines: string[]
  onChange: (scope: string[]) => void
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
    onChange([...lines.slice(0, i + 1), '', ...lines.slice(i + 1)])
    setFocusAt(i + 1)
  }
  return (
    <>
      {lines.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No lines yet. A quote with no lines cannot be compared.</div>}
      {lines.map((line, i) => (
        <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', width: '1.2rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
          <input
            ref={(el) => {
              boxes.current[i] = el
            }}
            style={{ ...input, flex: 1, minWidth: 0 }}
            value={line}
            onChange={(e) => onChange(lines.map((l, j) => (j === i ? e.target.value : l)))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addAfter(i)
            }}
            aria-label={`${trade} line ${i + 1}`}
          />
          <button
            type="button"
            onClick={() => onChange(lines.filter((_, j) => j !== i))}
            aria-label={`Take out ${line || 'this line'}`}
            style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, padding: '0.1rem 0.3rem' }}
          >
            ×
          </button>
        </div>
      ))}
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
