/**
 * Follow up's Nudges from the flow (the prototype's section of the same name, v1.178): one row per person whose step
 * has gone quiet past its nudge, worst first, drawn after We owe them in helper 2's slot (`FollowUpPanel`'s `nudges`).
 * Each row has the person, the steps its one message names, our move with the channel the flow asked for, and why.
 * Its presses: the nudge itself, which since punch list #140 PR 4 opens their thread with the step's reminder written
 * and the send window open (a text or an email, as the flow asks; a call opens the thread as it is); Hold until Mon; and
 * Remind now, for a reminder sent another way. A press on the name opens the thread as it is.
 */
import type { CSSProperties } from 'react'
import type { NudgePerson } from '../../lib/flows/flowNudgesIo'
import type { NudgeRow } from '../../lib/flows/nudges'
import { NUDGE_HOW_WORDS, stepById, type FlowDef } from '../../lib/flows/state'
import type { OpenThreadMore } from '../gc/messages/useThreadWindow'

const rowStyle: CSSProperties = { display: 'grid', gap: '0.25rem', padding: '0.6rem 0.75rem', borderTop: '1px solid var(--border)' }
const nameButton: CSSProperties = { background: 'none', border: 'none', padding: 0, font: 'inherit', fontWeight: 700, color: 'var(--text-link)', cursor: 'pointer' }
const pill: CSSProperties = { fontSize: '0.75rem', borderRadius: 999, padding: '0 0.5rem', border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', whiteSpace: 'nowrap' }
const ours: CSSProperties = { fontSize: '0.75rem', borderRadius: 999, padding: '0 0.5rem', border: '1px solid var(--border-blue)', background: 'var(--bg-blue-tint)', whiteSpace: 'nowrap' }
const button: CSSProperties = { padding: '0.2rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer', font: 'inherit', fontSize: '0.8rem' }
const primary: CSSProperties = { ...button, background: '#2563eb', borderColor: '#2563eb', color: 'white', fontWeight: 600 }

/** The nudge's own press, by the channel the flow asked for: "Text Priya", "Call Greg", "Email Jonah". */
const NUDGE_PRESS: Readonly<Record<NudgeRow['how'], string>> = { text: 'Text', call: 'Call', email: 'Email' }

export const NUDGES_EMPTY = 'No step is quiet past its nudge.'
export const NUDGES_LOADING = 'Reading the flows…'

export interface NudgesFromTheFlowProps {
  rows: readonly NudgeRow[]
  names: ReadonlyMap<string, NudgePerson>
  /** Each kind's flow, for the steps' names. */
  flows: Readonly<Partial<Record<string, FlowDef>>>
  pressing: string | null
  /** While everyone is read, so the empty line never shows before the rows. */
  loading?: boolean
  /** Why everyone could not be read. */
  problem?: string | null
  /** The name opens the thread; the nudge's own press opens it with the reminder written (`more.nudge`), unless the flow asks for a call. */
  onOpenThread: (contactId: string, more?: OpenThreadMore) => void
  onHold: (row: NudgeRow) => void
  onRemindNow: (row: NudgeRow) => void
}

export function NudgesFromTheFlow({ rows, names, flows, pressing, loading = false, problem = null, onOpenThread, onHold, onRemindNow }: NudgesFromTheFlowProps) {
  const line = problem ? `The nudges did not load. ${problem}` : loading ? NUDGES_LOADING : NUDGES_EMPTY
  return (
    <section aria-label="Nudges from the flow" data-nudges>
      <h3 style={{ margin: '1rem 0 0.4rem', fontSize: '1rem' }}>Nudges from the flow ({rows.length})</h3>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', overflow: 'hidden' }}>
        {(rows.length === 0 || problem) && (
          <p role={problem ? 'alert' : undefined} style={{ margin: 0, padding: '0.75rem', color: problem ? 'var(--text-red-700)' : 'var(--text-muted)', fontSize: '0.9rem' }}>
            {line}
          </p>
        )}
        {rows.map((r, i) => {
          const who = names.get(r.contactId)
          const flow = who ? flows[who.kind] : undefined
          const busy = pressing === r.contactId
          const named = r.steps.filter((s) => s.named)
          const shown = named.length ? named : r.steps.slice(0, 1)
          return (
            <div key={r.contactId} data-nudge-row={r.contactId} style={{ ...rowStyle, borderTop: i === 0 ? 'none' : rowStyle.borderTop }}>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="button" title="Open the thread" onClick={() => onOpenThread(r.contactId)} style={nameButton}>
                  {who?.name ?? 'Someone'}
                </button>
                {shown.map((s) => (
                  <span key={`${s.stepId}:${s.jobId ?? ''}`} style={pill}>
                    {(flow && stepById(flow, s.stepId)?.name) || s.stepId}
                  </span>
                ))}
                <span style={ours}>Our move · {NUDGE_HOW_WORDS[r.how]}</span>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{r.why}</div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button type="button" disabled={busy} onClick={() => onOpenThread(r.contactId, r.how === 'call' ? undefined : { nudge: r.how })} style={primary}>
                  {NUDGE_PRESS[r.how]} {who?.first ?? 'them'}
                </button>
                <button type="button" disabled={busy} onClick={() => onHold(r)} style={button}>
                  Hold until Mon
                </button>
                <button type="button" disabled={busy} onClick={() => onRemindNow(r)} style={button}>
                  Remind now
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <p style={{ margin: '0.4rem 0 0.8rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        A step’s nudge comes when it is on now, the move is theirs, and the thread has been quiet that many days. A promised day comes before the
        count. Answering them, or the fact turning true, clears the row. Remind now is for a reminder you sent another way.
      </p>
    </section>
  )
}
