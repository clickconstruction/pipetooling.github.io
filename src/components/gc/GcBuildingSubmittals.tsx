import { useState, type Dispatch } from 'react'
import {
  bw,
  GC_COMPANY,
  pDate,
  scheduleLinesOf,
  shortDate,
  submittalCounts,
  submittalRows,
  submittalRowsOn,
  type GcAction,
  type GcProject,
  type GcState,
  type Submittal,
  type SubmittalAnswer,
  type SubmittalKind,
  type SubmittalRow,
  type SubmittalState,
  type TradePackage,
} from '../../lib/gcMode/gcModel'
import type { GcPaneProps } from './GcOfficeTabs'
import { GcBuildingPromise } from './GcBuildingPromise'
import { Btn, Card, Chip, Why, input, type Tone } from './gcUi'
import { usePortalLang } from './gcPortalLang'

/**
 * GC mode design spike: submittals (Building lane, owner 2026-10-04). The register by trade: what
 * each sends for the architect's approval before its work, whose move it is, when it is needed.
 * We send what came in to the architect and record the answer. In the trade's portal, what to
 * send and what came back.
 */

const STATE_WORDS: Record<SubmittalState, { tone: Tone; word: string }> = {
  trade: { tone: 'grey', word: 'waiting on them' },
  us: { tone: 'amber', word: 'waiting on us' },
  architect: { tone: 'blue', word: 'with the architect' },
  approved: { tone: 'green', word: 'approved' },
}
const KINDS: SubmittalKind[] = ['product data', 'shop drawings', 'samples']

export function GcBuildingSubmittalsTab({ state, project, dispatch }: GcPaneProps) {
  const rows = submittalRows(state, project)
  const c = submittalCounts(state, project)
  const trades = project.packages.filter((k) => !k.selfPerform && k.awardedInviteId)
  return (
    <div style={{ display: 'grid', gap: '0.9rem' }}>
      <Why>
        A trade sends product data, shop drawings or samples for the architect to approve before its work. We look, then send
        them on, and record the answer. A submittal holds the lines it covers on the schedule until it is approved.
      </Why>
      {rows.length > 0 && (
        <Card>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.875rem' }}>
            <strong>Submittals</strong>
            <Chip tone="grey">{c.trade} waiting on trades</Chip>
            <Chip tone="amber">{c.us} waiting on us</Chip>
            <Chip tone="blue">{c.architect} with the architect</Chip>
            <Chip tone="green">{c.approved} approved</Chip>
            {c.late > 0 && <Chip tone="red">{c.late} late</Chip>}
          </div>
        </Card>
      )}
      {trades.length === 0 && <Card>No trade is awarded yet. Submittals start once one is.</Card>}
      {trades.map((pkg) => (
        <TradeSubmittals
          key={pkg.id}
          state={state}
          project={project}
          pkg={pkg}
          rows={rows.filter((r) => r.submittal.packageId === pkg.id)}
          dispatch={dispatch}
        />
      ))}
    </div>
  )
}

function TradeSubmittals({
  state,
  project,
  pkg,
  rows,
  dispatch,
}: {
  state: GcState
  project: GcProject
  pkg: TradePackage
  rows: SubmittalRow[]
  dispatch: Dispatch<GcAction>
}) {
  const [adding, setAdding] = useState(false)
  const company = rows[0]?.company ?? pkg.trade
  // The days the trade gave (question 8): to send what we wait on, and for a delivery once something is approved.
  const waiting = rows.some((r) => r.state === 'trade')
  const approved = rows.some((r) => r.state === 'approved')
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
        <div>
          <strong>{pkg.trade}</strong>
          {rows.length > 0 && <span style={{ color: 'var(--text-muted)' }}> · {company}</span>}
        </div>
        {!adding && (
          <Btn kind="quiet" onClick={() => setAdding(true)}>
            Add a submittal
          </Btn>
        )}
      </div>
      {rows.length === 0 && !adding && <div style={{ marginTop: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>None asked for yet.</div>}
      <div style={{ display: 'grid', gap: '0.4rem', marginTop: '0.4rem' }}>
        <GcBuildingPromise state={state} project={project} pkg={pkg} kind="submittals" ask={waiting} dispatch={dispatch} />
        <GcBuildingPromise state={state} project={project} pkg={pkg} kind="delivery" askWhat ask={approved} dispatch={dispatch} />
      </div>
      <div style={{ display: 'grid', gap: '0.6rem', marginTop: rows.length > 0 ? '0.6rem' : 0 }}>
        {rows.map((r) => (
          <SubmittalLine key={r.submittal.id} project={project} row={r} today={state.today} dispatch={dispatch} />
        ))}
      </div>
      {adding && <AddSubmittal project={project} pkg={pkg} dispatch={dispatch} onDone={() => setAdding(false)} />}
    </Card>
  )
}

function SubmittalLine({ project, row, today, dispatch }: { project: GcProject; row: SubmittalRow; today: string; dispatch: Dispatch<GcAction> }) {
  const s = row.submittal
  const [answering, setAnswering] = useState<SubmittalAnswer | null>(null)
  const [note, setNote] = useState('')
  const late = row.state !== 'approved' && row.daysLate > 0
  return (
    <div style={{ display: 'grid', gap: '0.25rem', fontSize: '0.875rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
        <strong>{s.number}</strong>
        <span>
          {s.title} <span style={{ color: 'var(--text-muted)' }}>· {s.kind}</span>
        </span>
        <Chip tone={late ? 'red' : STATE_WORDS[row.state].tone}>{STATE_WORDS[row.state].word}</Chip>
        <span style={{ fontSize: '0.8rem', color: late ? 'var(--text-red-700)' : 'var(--text-muted)' }}>
          {row.approvedOn
            ? `approved ${shortDate(row.approvedOn)}${row.daysLate > 0 ? `, ${row.daysLate} days after it was needed` : ''}`
            : row.neededBy
              ? `${row.neededBy === today ? 'needed today' : `needed by ${shortDate(row.neededBy)}`}${late ? `, ${row.daysLate} days late` : ''}`
              : 'no day needed yet'}
        </span>
      </div>
      {s.rounds.map((r, i) => (
        <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {s.rounds.length > 1 ? `Round ${i + 1}: ` : ''}sent {shortDate(r.sentOn)}, {r.file}
          {r.note ? `. ${r.note.replace(/[.\s]+$/, '')}` : ''}
          {r.toArchitectOn ? `. To the architect ${shortDate(r.toArchitectOn)}` : ''}
          {r.answer && r.answeredOn ? `. ${r.answer === 'revise' ? 'Sent back to revise' : r.answer === 'approved as noted' ? 'Approved as noted' : 'Approved'} ${shortDate(r.answeredOn)}` : ''}
          {r.answerNote ? `: ${r.answerNote}` : '.'}
        </div>
      ))}
      {row.state === 'us' && (
        <div>
          <Btn kind="primary" onClick={() => dispatch({ type: 'sendSubmittalToArchitect', projectId: project.id, submittalId: s.id })}>
            Send to {project.architect}
          </Btn>
        </div>
      )}
      {row.state === 'architect' && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)' }}>The architect's answer:</span>
          {(['approved', 'approved as noted', 'revise'] as SubmittalAnswer[]).map((a) => (
            <Btn key={a} kind={answering === a ? 'primary' : 'quiet'} onClick={() => setAnswering(a)}>
              {a === 'approved' ? 'Approved' : a === 'approved as noted' ? 'Approved as noted' : 'Revise and resubmit'}
            </Btn>
          ))}
        </div>
      )}
      {row.state === 'architect' && answering && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={answering === 'revise' ? 'What to change' : 'A note, if the architect made one'}
            aria-label="The architect's note"
            style={{ ...input, flex: '1 1 16rem' }}
          />
          <Btn
            kind="primary"
            disabled={answering === 'revise' && !note.trim()}
            title={answering === 'revise' && !note.trim() ? 'Say what to change first.' : undefined}
            onClick={() => {
              dispatch({ type: 'answerSubmittal', projectId: project.id, submittalId: s.id, answer: answering, note })
              setAnswering(null)
              setNote('')
            }}
          >
            Record it
          </Btn>
        </div>
      )}
    </div>
  )
}

function AddSubmittal({ project, pkg, dispatch, onDone }: { project: GcProject; pkg: TradePackage; dispatch: Dispatch<GcAction>; onDone: () => void }) {
  const lines = scheduleLinesOf(pkg)
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<SubmittalKind>('product data')
  const [section, setSection] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [lead, setLead] = useState(14)
  const label = { fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-700)' } as const
  return (
    <div style={{ marginTop: '0.6rem', padding: '0.65rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--bg-subtle)', display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What it covers, like Rooftop units" aria-label="What the submittal covers" style={{ ...input, flex: '2 1 14rem' }} />
        <select value={kind} onChange={(e) => setKind(e.target.value as SubmittalKind)} style={input} aria-label="Kind">
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <input value={section} onChange={(e) => setSection(e.target.value)} placeholder="Spec section, like 23 81 19" aria-label="Spec section" style={{ ...input, flex: '1 1 9rem' }} />
      </div>
      <div style={{ display: 'grid', gap: '0.2rem' }}>
        <span style={label}>The work it holds on the schedule until approved</span>
        <div style={{ display: 'flex', gap: '0.2rem 0.9rem', flexWrap: 'wrap' }}>
          {lines.map((l) => (
            <label key={l.lineId} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <input type="checkbox" checked={picked.includes(l.lineId)} onChange={(e) => setPicked((x) => (e.target.checked ? [...x, l.lineId] : x.filter((id) => id !== l.lineId)))} />
              <span>{l.label}</span>
            </label>
          ))}
        </div>
      </div>
      <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={label}>Days from approval to on site</span>
        <input type="number" min={0} value={lead} onChange={(e) => setLead(Math.max(0, Number(e.target.value) || 0))} style={{ ...input, width: '5rem' }} />
        <span style={{ color: 'var(--text-muted)' }}>It is needed by the first start of that work, less these days.</span>
      </label>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Btn
          kind="primary"
          disabled={!title.trim()}
          onClick={() => {
            dispatch({ type: 'addSubmittal', projectId: project.id, packageId: pkg.id, title, kind, ...(section.trim() ? { specSection: section } : {}), lineIds: picked, leadDays: lead })
            onDone()
          }}
        >
          Add submittal
        </Btn>
        <Btn kind="quiet" onClick={onDone}>
          Done adding
        </Btn>
      </div>
    </div>
  )
}

const KIND_KEY: Record<SubmittalKind, 'subKindProduct' | 'subKindShop' | 'subKindSamples'> = {
  'product data': 'subKindProduct',
  'shop drawings': 'subKindShop',
  samples: 'subKindSamples',
}

/**
 * The trade's submittals in its portal, inside the pay application door: each one still to send,
 * or sent back to revise, with a file name and a note to send it; the ones with us or the
 * architect, and how many are approved. In the portal's language; what we typed stays as typed.
 */
export function GcBuildingSubmittalsForTrade({ project, pkg, today, dispatch }: { project: GcProject; pkg: TradePackage; today: string; dispatch: Dispatch<GcAction> }) {
  const { lang } = usePortalLang()
  const w = (key: Parameters<typeof bw>[1], vars?: Record<string, string | number>) => bw(lang, key, { gc: GC_COMPANY.shortName, ...vars })
  const rows = submittalRowsOn(project, today).filter((r) => r.submittal.packageId === pkg.id)
  const open = rows.filter((r) => r.state !== 'approved')
  if (open.length === 0) return null
  const approved = rows.length - open.length
  return (
    <div style={{ padding: '0.55rem 0.65rem', background: 'var(--bg-subtle)', border: '1px solid var(--border-strong)', borderRadius: 6, display: 'grid', gap: '0.5rem' }}>
      <strong>{w('subHead')}</strong>
      {open.map((r) => (
        <TradeSubmittalLine key={r.submittal.id} project={project} row={r} lang={lang} w={w} dispatch={dispatch} />
      ))}
      {approved > 0 && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{w('subApproved', { n: approved })}</div>}
    </div>
  )
}

function TradeSubmittalLine({
  project,
  row,
  lang,
  w,
  dispatch,
}: {
  project: GcProject
  row: SubmittalRow
  lang: 'en' | 'es'
  w: (key: Parameters<typeof bw>[1], vars?: Record<string, string | number>) => string
  dispatch: Dispatch<GcAction>
}) {
  const s: Submittal = row.submittal
  const [file, setFile] = useState('')
  const [note, setNote] = useState('')
  const last = s.rounds[s.rounds.length - 1]
  return (
    <div style={{ display: 'grid', gap: '0.25rem', fontSize: '0.875rem' }}>
      <div>
        <strong>{s.number}</strong> {s.title} <span style={{ color: 'var(--text-muted)' }}>· {w(KIND_KEY[s.kind])}</span>
      </div>
      {row.neededBy && row.state === 'trade' && (
        <div style={{ color: row.daysLate > 0 ? 'var(--text-red-700)' : 'var(--text-muted)' }}>
          {w('subNeeded', { date: pDate(lang, row.neededBy) })}
          {row.daysLate > 0 ? ` ${w('subLate', { n: row.daysLate })}` : ''}
        </div>
      )}
      {row.state === 'trade' && last?.answer === 'revise' && last.answeredOn && (
        <div style={{ color: 'var(--text-amber-800)' }}>
          {w('subBack', { date: pDate(lang, last.answeredOn) })}
          {last.answerNote ? ` “${last.answerNote}”` : ''}
        </div>
      )}
      {row.state === 'trade' && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={file} onChange={(e) => setFile(e.target.value)} placeholder={w('subFile')} aria-label={w('subFile')} style={{ ...input, flex: '1 1 10rem' }} />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={w('subNote')} aria-label={w('subNote')} style={{ ...input, flex: '1 1 10rem' }} />
          <Btn
            kind="primary"
            disabled={!file.trim()}
            onClick={() => {
              dispatch({ type: 'tradeSendSubmittal', projectId: project.id, submittalId: s.id, file, note })
              setFile('')
              setNote('')
            }}
          >
            {w('subSend')}
          </Btn>
        </div>
      )}
      {row.state === 'us' && last && <div style={{ color: 'var(--text-muted)' }}>{w('subWithUs', { date: pDate(lang, last.sentOn) })}</div>}
      {row.state === 'architect' && last?.toArchitectOn && <div style={{ color: 'var(--text-muted)' }}>{w('subWithArchitect', { date: pDate(lang, last.toArchitectOn) })}</div>}
    </div>
  )
}
