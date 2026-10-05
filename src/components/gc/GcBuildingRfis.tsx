import { useState, type Dispatch } from 'react'
import {
  RFI_NEEDED_DAYS,
  rfiCounts,
  rfiImpactWords,
  rfiRows,
  scheduleRows,
  activityName,
  partnerById,
  weekdayDate,
  type GcAction,
  type GcProject,
  type GcState,
  type RfiImpact,
  type RfiRow,
} from '../../lib/gcMode/gcModel'
import type { GcPaneProps } from './GcOfficeTabs'
import { Btn, Card, Chip, Why, input } from './gcUi'

/**
 * GC mode design spike: questions about the plans while we build, RFIs (the owner, 2026-10-05, on
 * the Building lane's mock-up: its own tab, trades ask from their portal, needed 3 days before the
 * work, and a cost answer starts a change order in one click). Each one is ours to send to the
 * architect or answer ourselves, then with the architect, then answered. It holds the work it is
 * about until then. Kernel: gcBuildingRfis.ts.
 */
export function GcBuildingRfisTab({ state, project, dispatch }: GcPaneProps) {
  const [asking, setAsking] = useState(false)
  const rows = rfiRows(state, project)
  const c = rfiCounts(state, project)
  const building = project.stage === 'building' && !project.closedOn
  return (
    <div style={{ display: 'grid', gap: '0.9rem' }} data-tour="gc-rfis">
      <Why>
        A question about the plans while we build. Our superintendent or a trade asks it. We send it to {project.architect} or answer it
        ourselves. It holds the work it is about, and the answer is needed {RFI_NEEDED_DAYS} days before that work starts.
      </Why>
      <Card>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.875rem' }}>
          <strong>RFIs</strong>
          {rows.length === 0 ? (
            <span style={{ color: 'var(--text-muted)' }}>No questions yet.</span>
          ) : (
            <>
              {c.us > 0 && <Chip tone="amber">{c.us} waiting on us</Chip>}
              {c.architect > 0 && <Chip tone="blue">{c.architect} with the architect</Chip>}
              {c.answered > 0 && <Chip tone="green">{c.answered} answered</Chip>}
              {c.dueNow > 0 && <Chip tone="red">{c.dueNow} due now</Chip>}
            </>
          )}
          <span style={{ flex: 1 }} />
          {building && !asking && (
            <Btn kind="primary" onClick={() => setAsking(true)}>
              Ask a question
            </Btn>
          )}
        </div>
        {asking && <AskForm state={state} project={project} dispatch={dispatch} onDone={() => setAsking(false)} />}
      </Card>
      {rows.map((row) => (
        <RfiCard key={row.rfi.id} project={project} row={row} dispatch={dispatch} />
      ))}
    </div>
  )
}

function AskForm({ state, project, dispatch, onDone }: { state: GcState; project: GcProject; dispatch: Dispatch<GcAction>; onDone: () => void }) {
  const hired = project.packages.flatMap((k) => {
    const partnerId = k.invites.find((i) => i.id === k.awardedInviteId)?.partnerId
    const company = partnerId ? partnerById(state, partnerId)?.company : undefined
    return partnerId && company ? [{ packageId: k.id, partnerId, company, trade: k.trade }] : []
  })
  const open = scheduleRows(state, project)
    .filter((r) => r.actual < 100)
    .sort((a, b) => a.activity.start.localeCompare(b.activity.start))
  const [question, setQuestion] = useState('')
  const [who, setWho] = useState('')
  const [sheets, setSheets] = useState('')
  const [days, setDays] = useState(String(RFI_NEEDED_DAYS))
  const [holds, setHolds] = useState<string[]>([])
  const asker = hired.find((h) => h.partnerId === who)
  const dayCount = Number(days)
  const ready = question.trim() !== '' && Number.isFinite(dayCount) && dayCount >= 0
  const label = { display: 'grid', gap: '0.2rem', fontSize: '0.85rem' } as const
  const field = { ...input, width: '100%', minWidth: 0, boxSizing: 'border-box' } as const
  return (
    <div style={{ display: 'grid', gap: '0.6rem', marginTop: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
      <label style={label}>
        <strong>The question</strong>
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} placeholder="What the plans do not say, or say two ways" style={{ ...field, resize: 'vertical', fontFamily: 'inherit' }} />
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))', gap: '0.6rem' }}>
        <label style={label}>
          <strong>Asked by</strong>
          <select value={who} onChange={(e) => setWho(e.target.value)} style={field}>
            <option value="">Our superintendent</option>
            {hired.map((h) => (
              <option key={h.partnerId + h.packageId} value={h.partnerId}>
                {h.company} · {h.trade}
              </option>
            ))}
          </select>
        </label>
        <label style={label}>
          <strong>Sheets</strong>
          <input value={sheets} onChange={(e) => setSheets(e.target.value)} placeholder="A-501, M-101" style={field} />
        </label>
        <label style={label}>
          <strong>Needed this many days before the work</strong>
          <input type="number" min={0} value={days} onChange={(e) => setDays(e.target.value)} style={field} />
        </label>
      </div>
      <fieldset style={{ border: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.25rem', fontSize: '0.85rem' }}>
        <legend style={{ padding: 0, marginBottom: '0.2rem' }}>
          <strong>The work it holds until it is answered</strong>
        </legend>
        {open.length === 0 && <span style={{ color: 'var(--text-muted)' }}>Nothing left on the schedule to hold.</span>}
        {open.map((r) => (
          <label key={r.activity.lineId} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="checkbox"
              checked={holds.includes(r.activity.lineId)}
              onChange={(e) => setHolds((h) => (e.target.checked ? [...h, r.activity.lineId] : h.filter((x) => x !== r.activity.lineId)))}
            />
            {activityName(r)}
            <Chip tone="grey">starts {weekdayDate(r.activity.start)}</Chip>
          </label>
        ))}
      </fieldset>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Btn
          kind="primary"
          disabled={!ready}
          title={ready ? undefined : 'Type the question first.'}
          onClick={() => {
            dispatch({
              type: 'addRfi',
              projectId: project.id,
              question: question.trim(),
              sheets: sheets.split(',').map((x) => x.trim()).filter(Boolean),
              packageId: asker?.packageId ?? null,
              partnerId: asker?.partnerId ?? null,
              holds,
              neededDays: dayCount,
            })
            onDone()
          }}
        >
          Add the question
        </Btn>
        <Btn kind="quiet" onClick={onDone}>
          Cancel
        </Btn>
      </div>
    </div>
  )
}

function RfiCard({ project, row, dispatch }: { project: GcProject; row: RfiRow; dispatch: Dispatch<GcAction> }) {
  const [answering, setAnswering] = useState(false)
  const { rfi } = row
  const a = rfi.answer
  return (
    <Card style={{ border: row.late || row.neededTone === 'red' ? '1px solid var(--text-red-700)' : undefined, display: 'grid', gap: '0.4rem' }}>
      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{row.label}</strong>
        <Chip tone={row.stateTone}>{row.stateWords}</Chip>
        {row.needed && <Chip tone={row.neededTone}>{row.needed}</Chip>}
        {a && <Chip tone={a.impact === 'cost' ? 'amber' : 'grey'}>{rfiImpactWords(a.impact, a.cost, a.days)}</Chip>}
      </div>
      <div style={{ fontSize: '0.92rem' }}>{rfi.question}</div>
      <div style={{ display: 'flex', gap: '0.15rem 0.9rem', flexWrap: 'wrap', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        <span>
          Asked by <strong style={{ color: 'var(--text-base)' }}>{row.askedBy}</strong>, {weekdayDate(rfi.askedOn)}
        </span>
        {rfi.sheets.length > 0 && (
          <span>
            Sheets <strong style={{ color: 'var(--text-base)' }}>{rfi.sheets.join(', ')}</strong>
          </span>
        )}
        {rfi.sentToArchitectOn && !a && (
          <span>
            To {project.architect} <strong style={{ color: 'var(--text-base)' }}>{weekdayDate(rfi.sentToArchitectOn)}</strong>
          </span>
        )}
        {!a && row.holds.length > 0 && (
          <span>
            Holds <strong style={{ color: 'var(--text-base)' }}>{row.holds.map((h) => h.name).join(', ')}</strong>, starts {weekdayDate(row.holds[0]?.start ?? null)}
          </span>
        )}
        {a && (
          <span>
            Answered by <strong style={{ color: 'var(--text-base)' }}>{a.by === 'architect' ? project.architect : 'us'}</strong>, {weekdayDate(a.on)}
          </span>
        )}
      </div>
      {a && (
        <div style={{ borderLeft: `3px solid ${a.impact === 'cost' ? 'var(--text-amber-800)' : 'var(--text-green-700)'}`, paddingLeft: '0.6rem', fontSize: '0.88rem' }}>
          “{a.text}”
        </div>
      )}
      {!a && !answering && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {row.state === 'us' ? (
            <>
              <Btn kind="primary" onClick={() => dispatch({ type: 'sendRfiToArchitect', projectId: project.id, rfiId: rfi.id })}>
                Send to {project.architect}
              </Btn>
              <Btn kind="quiet" onClick={() => setAnswering(true)}>
                Answer it ourselves
              </Btn>
            </>
          ) : (
            <Btn onClick={() => setAnswering(true)}>Record their answer</Btn>
          )}
        </div>
      )}
      {!a && answering && (
        <AnswerForm
          by={row.state === 'architect' ? 'architect' : 'us'}
          onSave={(answer) => {
            dispatch({ type: 'answerRfi', projectId: project.id, rfiId: rfi.id, ...answer })
            setAnswering(false)
          }}
          onCancel={() => setAnswering(false)}
        />
      )}
      {row.canStartChangeOrder && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Btn kind="primary" onClick={() => dispatch({ type: 'draftChangeOrderFromRfi', projectId: project.id, rfiId: rfi.id })}>
            Start a change order
          </Btn>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>It fills in what changes, our cost and the days. You price it and send it on Bill the customer.</span>
        </div>
      )}
      {row.changeOrderNumber !== null && (
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Change order {row.changeOrderNumber} drafted from it. Price it and send it on Bill the customer.
        </div>
      )}
    </Card>
  )
}

function AnswerForm({
  by,
  onSave,
  onCancel,
}: {
  by: 'architect' | 'us'
  onSave: (answer: { text: string; by: 'architect' | 'us'; impact: RfiImpact; cost: number; days: number }) => void
  onCancel: () => void
}) {
  const [text, setText] = useState('')
  const [impact, setImpact] = useState<RfiImpact>('none')
  const [cost, setCost] = useState('')
  const [days, setDays] = useState('0')
  const costNum = Number(cost.replace(/[$,\s]/g, '') || '0')
  const dayNum = Number(days || '0')
  const ready = text.trim() !== '' && (impact !== 'cost' || (Number.isFinite(costNum) && Number.isFinite(dayNum) && (costNum > 0 || dayNum > 0)))
  const field = { ...input, width: '100%', minWidth: 0, boxSizing: 'border-box' } as const
  const label = { display: 'grid', gap: '0.2rem', fontSize: '0.85rem' } as const
  const opts: { v: RfiImpact; words: string }[] = [
    { v: 'none', words: 'No change' },
    { v: 'plans', words: 'Changes the plans' },
    { v: 'cost', words: 'Adds cost or days' },
  ]
  return (
    <div style={{ display: 'grid', gap: '0.55rem', borderTop: '1px solid var(--border)', paddingTop: '0.6rem' }}>
      <label style={label}>
        <strong>{by === 'architect' ? 'Their answer' : 'Our answer'}</strong>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} style={{ ...field, resize: 'vertical', fontFamily: 'inherit' }} />
      </label>
      <div style={{ display: 'grid', gap: '0.25rem', fontSize: '0.85rem' }}>
        <strong>What it changes</strong>
        <span role="group" aria-label="What it changes" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {opts.map((o) => (
            <button
              key={o.v}
              type="button"
              aria-pressed={impact === o.v}
              onClick={() => setImpact(o.v)}
              style={{
                padding: '0.25rem 0.7rem',
                borderRadius: 999,
                border: `1px solid ${impact === o.v ? 'var(--text-blue-500)' : 'var(--border-strong)'}`,
                background: impact === o.v ? 'var(--bg-blue-tint)' : 'var(--surface)',
                color: impact === o.v ? 'var(--text-blue-500)' : 'var(--text-600)',
                fontWeight: impact === o.v ? 600 : 400,
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              {o.words}
            </button>
          ))}
        </span>
      </div>
      {impact === 'cost' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))', gap: '0.5rem' }}>
          <label style={label}>
            <strong>Cost to us</strong>
            <input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="$" style={field} />
          </label>
          <label style={label}>
            <strong>Days it adds</strong>
            <input type="number" min={0} value={days} onChange={(e) => setDays(e.target.value)} style={field} />
          </label>
          <span style={{ gridColumn: '1 / -1', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Then Start a change order fills one in on Bill the customer. You price it and send it there.</span>
        </div>
      )}
      {impact === 'plans' && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>The new sheets go out from Plans, as a bulletin, to the trades they change.</span>}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Btn kind="primary" disabled={!ready} onClick={() => onSave({ text: text.trim(), by, impact, cost: impact === 'cost' ? costNum : 0, days: impact === 'cost' ? dayNum : 0 })}>
          Save the answer
        </Btn>
        <Btn kind="quiet" onClick={onCancel}>
          Cancel
        </Btn>
      </div>
    </div>
  )
}
