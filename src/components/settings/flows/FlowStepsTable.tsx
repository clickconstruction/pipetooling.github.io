/**
 * Settings → Flows' The flow (the prototype's `flowsEditorHtml`, v1.178): the lanes and their steps, one row each. A
 * step's name and its Spanish one; what finishes it, its facts joined with and, or with or on a fork; whose move it is
 * and the seat an our-move step sits with; the nudge; whether it repeats; the papers it turns on; its usual; and its
 * place, moved with the arrows or into another lane, or removed. Every press is an edit to the draft
 * (`flows/editor.ts`), or a refusal said in words. On a reminder the app sends, the owner's switch writes at once
 * instead (cut 5, `flows/appSends.ts`), with the words the morning run would send.
 */
import { useState, type CSSProperties } from 'react'
import { useConfirmDialog, usePromptDialog } from '../../../contexts/ConfirmDialogContext'
import type { BoardRead } from '../../../lib/flows/boardRead'
import {
  addFact,
  addPaper,
  addStep,
  moveStep,
  moveToLane,
  removeFact,
  removePaper,
  removeStep,
  renameStep,
  setFork,
  setLoop,
  setNudge,
  setSeat,
  setWho,
  type EditResult,
  type FlowDraft,
} from '../../../lib/flows/editor'
import { APP_SEND_MODE_HINT, APP_SEND_MODE_WORDS, APP_SEND_MODES, APP_SENDS_LABEL, appSendMode, appSendSwitch, stepNudgeWords, type AppSendMode } from '../../../lib/flows/appSends'
import { FLOW_PAPERS, isDocPaperId, isPaperId, stepFactById, type FlowKind } from '../../../lib/flows/facts'
import type { SavedPaper } from '../../../lib/flows/newPaper'
import type { AppSends } from '../../../lib/flows/nudgeDispatch'
import { LANE_WORDS, type FlowDef, type FlowNudge, type FlowStep, type Lane, type Who } from '../../../lib/flows/state'
import type { QuickReply } from '../../../lib/quickReplies/kernel'
import { GcNewPaperWindow } from '../../gc/flows/GcNewPaperWindow'
import { docName } from './flowNames'
import { FlowFactPicker, FlowPaperPicker } from './FlowPickers'
import { flowChip, flowDanger, flowHead, flowInput, flowNote, flowQuiet, flowSelect, flowSmall, flowSwitch } from './flowStyles'

type Kind = Exclude<FlowKind, 'unknown'>

const LANES: readonly Lane[] = ['once', 'per_job', 'any_time']
const NUDGE_DAYS: readonly (readonly [number, string])[] = [
  [0, 'at the day'],
  [1, '1 day'],
  [2, '2 days'],
  [3, '3 days'],
  [5, '5 days'],
  [7, '7 days'],
  [10, '10 days'],
  [14, '14 days'],
]
const REPEATS = ['each ask', 'each draw', 'each month', 'each change', 'each question', 'each addendum', 'each submittal', 'each pay app']

const cell: CSSProperties = { padding: '0.4rem 0.45rem', borderTop: '1px solid var(--border)', verticalAlign: 'top', fontSize: '0.85rem' }
const headCell: CSSProperties = { ...flowHead, padding: '0.3rem 0.45rem', textAlign: 'left', whiteSpace: 'nowrap' }

export interface FlowStepsTableProps {
  kind: Kind
  draft: FlowDraft
  board: BoardRead | null
  /** Each step's usual as How it is going reads it, when it has five done in a year. */
  usual: Readonly<Record<string, number | null>>
  seats: readonly { id: string; name: string }[]
  docNames: Readonly<Record<string, string>>
  trades: readonly string[]
  edit: (fn: (d: FlowDraft) => EditResult) => string | null
  /** Say a refusal or a step's news. */
  say: (words: string) => void
  /** Who removes a step, as Removed keeps it. */
  by: string
  onAskForFact: (step: FlowStep) => void
  /** The library paper the New paper window saved, so the screen can name it. */
  onPaperMade: (paper: SavedPaper) => void
  /** The reminders the app sends itself (cut 5), once read: none drawn until then. */
  appSends?: FlowAppSends
}

export interface FlowAppSends {
  /** The owner's switch, by kind and step. */
  sends: AppSends
  /** The owner or a dev, who may press it. */
  canSet: boolean
  /** The flow as saved, which the morning run reads. */
  saved: FlowDef | null
  /** The team's quick replies, for the words the run would send. */
  quickReplies: readonly QuickReply[]
  /** The step being written, as `<kind>:<step id>`. */
  busy: string | null
  onSet: (step: FlowStep, mode: AppSendMode) => void
}

/** A name box that saves on leaving it or Enter, so one rename is one change. */
function NameBox({ value, label, placeholder, onSave }: { value: string; label: string; placeholder?: string; onSave: (v: string) => void }) {
  const [text, setText] = useState(value)
  const [was, setWas] = useState(value)
  if (value !== was) {
    setWas(value)
    setText(value)
  }
  return (
    <input
      aria-label={label}
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text.trim() !== value && onSave(text)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
      style={{ ...flowInput, marginBottom: '0.2rem' }}
    />
  )
}

export function FlowStepsTable(p: FlowStepsTableProps) {
  const confirm = useConfirmDialog()
  const prompt = usePromptDialog()
  const [picking, setPicking] = useState<{ stepId: string; what: 'fact' | 'paper' } | null>(null)
  const [newPaperFor, setNewPaperFor] = useState<FlowStep | null>(null)
  const go = (fn: (d: FlowDraft) => EditResult) => {
    const refused = p.edit(fn)
    if (refused) p.say(refused)
  }
  const onIt = (stepId: string): string[] =>
    (p.board?.companies ?? []).filter((c) => c.places.some((x) => x.stepId === stepId)).map((c) => c.name)

  const remove = async (step: FlowStep) => {
    const on = onIt(step.id)
    const ok = await confirm({
      title: `Remove ${step.name}?`,
      message: `${on.length ? `${on.length} ${on.length === 1 ? 'person is' : 'people are'} on it: ${on.join(', ')}. They land on the next step, since the facts decide.` : 'Nobody is on it.'} It stays in History, and Removed brings it back.`,
      confirmLabel: 'Remove it',
      cancelLabel: 'Keep it',
      danger: true,
      cancelIsSafe: true,
    })
    if (ok) go((d) => removeStep(d, step.id, p.by, new Date().toISOString()))
  }

  const add = async (lane: Lane) => {
    const name = await prompt({ title: `A step in ${LANE_WORDS[lane]}`, message: 'Its name. It goes at the end of the lane. Pick what finishes it next, from the list.', placeholder: 'Safety orientation', confirmLabel: 'Add it' })
    if (name === null) return
    go((d) => addStep(d, lane, { name }))
  }

  const nudgeTo = (step: FlowStep, change: Partial<FlowNudge> | null): FlowNudge | null => {
    if (change === null) return null
    const was: FlowNudge = step.nudge ?? { days: 3, how: 'text', send: 'ask', dayFact: null }
    return { ...was, ...change }
  }

  const factLabel = (f: string) => {
    const doc = f.startsWith('doc:') ? docName(f.split(':').slice(0, 2).join(':'), p.docNames) : undefined
    return stepFactById(f, doc ? `the ${doc}` : undefined)?.text ?? f
  }
  const paperLabel = (paper: string) => (isPaperId(paper) ? FLOW_PAPERS[paper].short : isDocPaperId(paper) ? docName(paper, p.docNames) : paper)

  // The owner's control on a reminder the app may send: Off, Offers (the office presses it on Today's sends, v2.5595) or
  // Sends, with the words the morning run would prepare or send.
  const appSend = (step: FlowStep) => {
    const a = p.appSends
    if (!a) return null
    const sw = appSendSwitch(step, { canSet: a.canSet, saved: a.saved })
    if (!sw.show) return null
    const mode = appSendMode(a.sends, p.kind, step.id)
    const busy = a.busy === `${p.kind}:${step.id}`
    return (
      <div data-app-sends={step.id} style={{ whiteSpace: 'normal', maxWidth: 280, marginTop: '0.35rem', display: 'grid', gap: '0.2rem' }}>
        <span style={{ fontSize: '0.8rem' }}>{APP_SENDS_LABEL}</span>
        <span role="radiogroup" aria-label={`${step.name}: ${APP_SENDS_LABEL}`} style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
          {APP_SEND_MODES.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              disabled={!sw.live || busy}
              onClick={() => mode !== m && a.onSet(step, m)}
              style={flowSwitch(mode === m, !sw.live || busy)}
            >
              {APP_SEND_MODE_WORDS[m]}
            </button>
          ))}
          {busy && <span style={{ ...flowNote, fontSize: '0.78rem' }}>Saving…</span>}
        </span>
        <span style={{ ...flowNote, fontSize: '0.78rem' }}>{APP_SEND_MODE_HINT[mode]}</span>
        {sw.note && <span style={{ ...flowNote, fontSize: '0.78rem' }}>{sw.note}</span>}
        <span style={{ ...flowNote, fontSize: '0.78rem' }}>“{stepNudgeWords(p.kind, step, a.quickReplies)}”</span>
      </div>
    )
  }

  const row = (step: FlowStep, lane: Lane, at: number, count: number) => {
    const facts = step.facts as readonly string[]
    const usual = p.usual[step.id] ?? (step.usual || null)
    return (
      <tr key={step.id} data-step={step.id}>
        <td style={{ ...cell, whiteSpace: 'nowrap' }}>
          <button type="button" aria-label={`Move ${step.name} up`} disabled={at === 0} onClick={() => go((d) => moveStep(d, step.id, 'up'))} style={flowSmall}>
            ↑
          </button>{' '}
          <button type="button" aria-label={`Move ${step.name} down`} disabled={at === count - 1} onClick={() => go((d) => moveStep(d, step.id, 'down'))} style={flowSmall}>
            ↓
          </button>
        </td>
        <td style={{ ...cell, minWidth: 170 }}>
          <NameBox value={step.name} label={`${step.name}: its name`} onSave={(name) => go((d) => renameStep(d, step.id, { name }))} />
          <NameBox value={step.nameEs} label={`${step.name}: en español`} placeholder="en español" onSave={(nameEs) => go((d) => renameStep(d, step.id, { nameEs }))} />
        </td>
        <td style={{ ...cell, minWidth: 200, position: 'relative' }}>
          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.25rem', alignItems: 'center' }}>
            {facts.map((f, i) => (
              <span key={f} style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}>
                {i > 0 && (
                  <button
                    type="button"
                    title={step.fork ? 'Either fact finishes it: a fork. Press to need every fact.' : 'Every fact finishes it. Press to make it a fork, where either does.'}
                    onClick={() => go((d) => setFork(d, step.id, !step.fork))}
                    style={{ ...flowQuiet, fontWeight: 600 }}
                  >
                    {step.join}
                  </button>
                )}
                <span style={flowChip}>
                  {factLabel(f)}
                  <button type="button" aria-label={`Take ${factLabel(f)} off ${step.name}`} onClick={() => go((d) => removeFact(d, step.id, f, f.startsWith('doc:') ? docName(f.split(':').slice(0, 2).join(':'), p.docNames) : undefined))} style={{ ...flowQuiet, color: 'var(--text-muted)' }}>
                    ×
                  </button>
                </span>
              </span>
            ))}
          </span>
          <div>
            <button type="button" onClick={() => setPicking({ stepId: step.id, what: 'fact' })} style={flowQuiet}>
              {facts.length ? '+ and another fact' : '+ a fact'}
            </button>
          </div>
          {picking?.stepId === step.id && picking.what === 'fact' && (
            <FlowFactPicker
              flow={p.draft.flow}
              step={step}
              docNames={p.docNames}
              onClose={() => setPicking(null)}
              onAskForFact={() => {
                setPicking(null)
                p.onAskForFact(step)
              }}
              onPick={(factId, doc) => {
                setPicking(null)
                go((d) => addFact(d, step.id, factId, doc))
              }}
            />
          )}
        </td>
        <td style={{ ...cell, whiteSpace: 'nowrap' }}>
          <select aria-label={`${step.name}: whose move`} value={step.who} onChange={(e) => go((d) => setWho(d, step.id, e.target.value as Who))} style={flowSelect}>
            <option value="us">us</option>
            <option value="them">them</option>
            <option value="both">both</option>
          </select>
          {step.who === 'us' && (
            <>
              {' · '}
              <select
                aria-label={`${step.name}: our seat`}
                value={step.seat ?? ''}
                onChange={(e) => go((d) => setSeat(d, step.id, p.seats.find((s) => s.id === e.target.value) ?? null))}
                style={flowSelect}
              >
                <option value="">nobody yet</option>
                {p.seats.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </>
          )}
        </td>
        <td style={{ ...cell, whiteSpace: 'nowrap' }}>
          <select
            aria-label={`${step.name}: nudge after`}
            value={step.nudge ? String(step.nudge.days) : ''}
            onChange={(e) => go((d) => setNudge(d, step.id, nudgeTo(step, e.target.value === '' ? null : { days: Number(e.target.value) })))}
            style={flowSelect}
          >
            <option value="">no nudge</option>
            {NUDGE_DAYS.map(([n, w]) => (
              <option key={n} value={n}>
                {w}
              </option>
            ))}
          </select>
          {step.nudge && (
            <>
              {' '}
              <select aria-label={`${step.name}: nudge how`} value={step.nudge.how} onChange={(e) => go((d) => setNudge(d, step.id, nudgeTo(step, { how: e.target.value as FlowNudge['how'] })))} style={flowSelect}>
                <option value="text">a text</option>
                <option value="call">a call</option>
                <option value="email">an email</option>
              </select>{' '}
              <select aria-label={`${step.name}: who sends it`} value={step.nudge.send} onChange={(e) => go((d) => setNudge(d, step.id, nudgeTo(step, { send: e.target.value as FlowNudge['send'] })))} style={flowSelect}>
                <option value="ask">ask me</option>
                <option value="app">the app sends it</option>
              </select>
              {appSend(step)}
            </>
          )}
        </td>
        <td style={cell}>
          <select aria-label={`${step.name}: repeats`} value={step.loop ?? ''} onChange={(e) => go((d) => setLoop(d, step.id, e.target.value || null))} style={flowSelect}>
            <option value="">no</option>
            {[...new Set([...REPEATS, ...(step.loop ? [step.loop] : [])])].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </td>
        <td style={{ ...cell, position: 'relative' }}>
          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.25rem', alignItems: 'center' }}>
            {(step.papers as readonly string[]).map((paper) => (
              <span key={paper} style={{ ...flowChip, background: 'var(--bg-amber-tint)' }}>
                {paperLabel(paper)}
                <button type="button" aria-label={`Take ${paperLabel(paper)} off ${step.name}`} onClick={() => go((d) => removePaper(d, step.id, paper, isDocPaperId(paper) ? docName(paper, p.docNames) : undefined))} style={{ ...flowQuiet, color: 'var(--text-muted)' }}>
                  ×
                </button>
              </span>
            ))}
            <button type="button" aria-label={`A paper for ${step.name}`} onClick={() => setPicking({ stepId: step.id, what: 'paper' })} style={flowQuiet}>
              +
            </button>
          </span>
          {picking?.stepId === step.id && picking.what === 'paper' && (
            <FlowPaperPicker
              step={step}
              onClose={() => setPicking(null)}
              onPick={(paper) => {
                setPicking(null)
                go((d) => addPaper(d, step.id, paper))
              }}
              onNewPaper={() => {
                setPicking(null)
                setNewPaperFor(step)
              }}
            />
          )}
        </td>
        <td style={{ ...cell, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{usual ? `${usual} d` : '—'}</td>
        <td style={{ ...cell, whiteSpace: 'nowrap' }}>
          <select aria-label={`${step.name}: move to a lane`} value={lane} onChange={(e) => go((d) => moveToLane(d, step.id, e.target.value as Lane))} style={flowSelect}>
            {LANES.map((l) => (
              <option key={l} value={l}>
                {LANE_WORDS[l]}
              </option>
            ))}
          </select>{' '}
          <button type="button" onClick={() => void remove(step)} style={flowDanger}>
            Remove
          </button>
        </td>
      </tr>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={headCell} aria-label="Move" />
            <th style={headCell}>Step</th>
            <th style={headCell}>Finished when</th>
            <th style={headCell}>Whose move · our seat</th>
            <th style={headCell}>Nudge after · how</th>
            <th style={headCell}>Repeats</th>
            <th style={headCell}>Papers</th>
            <th style={headCell}>Usual</th>
            <th style={headCell}>Lane</th>
          </tr>
        </thead>
        {LANES.map((lane) => {
          const steps = p.draft.flow.lanes.find((l) => l.lane === lane)?.steps ?? []
          return (
            <tbody key={lane} data-lane={lane}>
              <tr>
                <td colSpan={9} style={{ ...cell, ...flowHead, paddingTop: '0.8rem' }}>
                  {LANE_WORDS[lane]}
                </td>
              </tr>
              {steps.map((s, i) => row(s, lane, i, steps.length))}
              <tr>
                <td colSpan={9} style={{ ...cell, borderTop: 'none' }}>
                  <button type="button" onClick={() => void add(lane)} style={flowQuiet}>
                    + a step in {LANE_WORDS[lane]}
                  </button>
                </td>
              </tr>
            </tbody>
          )
        })}
      </table>
      {newPaperFor && (
        <GcNewPaperWindow
          flowKind={p.kind}
          step={{ id: newPaperFor.id, name: newPaperFor.name }}
          trades={p.kind === 'trade' ? p.trades : undefined}
          onClose={() => setNewPaperFor(null)}
          onSaved={(paper) => {
            p.onPaperMade(paper)
            const step = newPaperFor
            go((d) => {
              const withPaper = addPaper(d, step.id, paper.paperId, paper.label)
              const fact = paper.factIds[0]
              return withPaper.ok && fact ? addFact(withPaper.draft, step.id, fact, paper.label) : withPaper
            })
          }}
        />
      )}
    </div>
  )
}
