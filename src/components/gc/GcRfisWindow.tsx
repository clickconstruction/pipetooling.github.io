import { useEffect, useState } from 'react'
import { Btn, Card, Chip, Why, input } from './gcUi'
import { RFI_NEEDED_DAYS, rfiCounts, rfiImpactWords, rfiRows, type RfiRow } from '../../lib/gc/buildingRfis'
import { partnerById } from '../../lib/gc/lookups'
import { activityName, scheduleRows } from '../../lib/gc/schedule/schedule'
import { holdsForSheets, type RfiAnswer, type RfiDraft, type RfiExtra } from '../../lib/gc/rfiRows'
import type { GcProject, GcState, Rfi, RfiImpact } from '../../lib/gc/types'
import { weekdayDate } from '../../lib/gc/words'

/**
 * GC mode, the real build, the Building lane's U5b: questions during construction (RFIs) on real data, ported from the
 * prototype's `GcBuildingRfis.tsx` (branch spike/gc-mode; the plan: to-dos/gc-mode/mockups/building-u5.md). Our
 * superintendent or a trade asks about the plans. We send it to the architect or answer it ourselves, and it holds the
 * work it is about until then. A cost answer starts a change order, for the money team. The database's own functions
 * check every step (the Building lane's U5a); the window only carries the press. The trade's own question comes from
 * its portal with the Portal lane's P5.
 */

export interface RfiWrites {
  onAsk: (draft: RfiDraft) => void
  /** The RFI goes to the architect by email (gc-architect-email). */
  onSendToArchitect: (rfiId: string) => void
  /** It went to the architect some other way. */
  onMarkSent: (rfiId: string) => void
  onAnswer: (rfiId: string, answer: RfiAnswer) => void
  /** A draft change order from a cost answer, then the Change orders window on it. */
  onStartChangeOrder: (rfi: Rfi) => void
}

interface Props {
  /** The board with the RFIs laid over it, the schedule when it is drawn, and the change orders the money team reads. */
  state: GcState
  project: GcProject
  /** What each RFI's row holds beside the kernel's shape: the email that took it to the architect. */
  extras?: Map<string, RfiExtra>
  /** Each of the job's scope lines with its own sheets, by line id. Only these lines can be held. Absent: every bar's. */
  lineSheets?: Record<string, string[] | null>
  /** The money team starts a change order from a cost answer (canSeeGcMoney). */
  canStartChangeOrders: boolean
  writes: RfiWrites
  /** The RFI a write is working on, or 'new' for one being asked. */
  busy?: string | null
  problem?: string | null
  onClose: () => void
}

export function GcRfisWindow({ state, project, extras, lineSheets, canStartChangeOrders, writes, busy, problem, onClose }: Props) {
  const [asking, setAsking] = useState(false)
  const rows = rfiRows(state, project)
  const c = rfiCounts(state, project)
  const building = project.stage === 'building' && !project.closedOn
  const architect = project.architect || 'the architect'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(0.75rem + var(--app-top-chrome, 0px)) 0.75rem 0.75rem' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${project.name}: RFIs`}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, width: 'min(860px, 100%)', maxHeight: 'min(94vh, 100%)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-strong)' }}
      >
        <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{project.name} · RFIs</div>
            <div data-rfi-lede style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Questions about the plans while we build.
            </div>
          </div>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}>
            ×
          </button>
        </div>

        <div style={{ padding: '0.8rem 1rem', overflowY: 'auto', display: 'grid', gap: '0.9rem' }}>
          <Why>
            Our superintendent or a trade asks it. We send it to {architect} or answer it ourselves. It holds the work it is about until it is answered.
            The answer is needed {RFI_NEEDED_DAYS} days before that work starts.
          </Why>
          {problem && (
            <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
              {problem}
            </div>
          )}
          <Card>
            <div data-rfi-counts style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.875rem' }}>
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
                <Btn kind="primary" onClick={() => setAsking(true)} disabled={busy === 'new'}>
                  Ask a question
                </Btn>
              )}
            </div>
            {asking && (
              <AskForm
                state={state}
                project={project}
                lineSheets={lineSheets}
                busy={busy === 'new'}
                onAsk={(draft) => {
                  writes.onAsk(draft)
                  setAsking(false)
                }}
                onDone={() => setAsking(false)}
              />
            )}
          </Card>
          {rows.map((row) => (
            <RfiCard key={row.rfi.id} architect={architect} row={row} emailed={Boolean(extras?.get(row.rfi.id)?.emailSendLogId)} canStartChangeOrders={canStartChangeOrders} writes={writes} busy={busy === row.rfi.id} />
          ))}
        </div>
      </div>
    </div>
  )
}

function AskForm({
  state,
  project,
  lineSheets,
  busy,
  onAsk,
  onDone,
}: {
  state: GcState
  project: GcProject
  lineSheets?: Record<string, string[] | null>
  busy: boolean
  onAsk: (draft: RfiDraft) => void
  onDone: () => void
}) {
  // The work still to do on the schedule, soonest first: the job's scope lines only, since an RFI holds those.
  const open = scheduleRows(state, project)
    .filter((r) => r.actual < 100 && (!lineSheets || r.activity.lineId in lineSheets))
    .sort((a, b) => a.activity.start.localeCompare(b.activity.start))
  const [question, setQuestion] = useState('')
  const [packageId, setPackageId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [sheets, setSheets] = useState('')
  const [days, setDays] = useState(String(RFI_NEEDED_DAYS))
  const [holds, setHolds] = useState<string[]>([])
  const [matched, setMatched] = useState<string[]>([])
  const pkg = project.packages.find((k) => k.id === packageId)
  // Who asked by phone: our superintendent, or the company we awarded the trade (the lead's call 5).
  const awardedId = pkg?.invites.find((i) => i.id === pkg.awardedInviteId)?.partnerId ?? null
  const awarded = awardedId ? partnerById(state, awardedId) : undefined
  const sheetList = (text: string) => text.split(',').map((x) => x.trim()).filter(Boolean)
  const dayCount = Number(days)
  const ready = question.trim() !== '' && days.trim() !== '' && Number.isFinite(dayCount) && dayCount >= 0
  const label = { display: 'grid', gap: '0.2rem', fontSize: '0.85rem' } as const
  const field = { ...input, width: '100%', minWidth: 0, boxSizing: 'border-box' } as const
  return (
    <div data-rfi-ask style={{ display: 'grid', gap: '0.6rem', marginTop: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
      <label style={label}>
        <strong>The question</strong>
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} placeholder="What the plans do not say, or say two ways" style={{ ...field, resize: 'vertical', fontFamily: 'inherit' }} />
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))', gap: '0.6rem' }}>
        <label style={label}>
          <strong>About</strong>
          <select
            value={packageId}
            onChange={(e) => {
              setPackageId(e.target.value)
              setCompanyId('')
            }}
            style={field}
          >
            <option value="">Our own work</option>
            {project.packages.map((k) => (
              <option key={k.id} value={k.id}>
                {k.trade}
              </option>
            ))}
          </select>
        </label>
        <label style={label}>
          <strong>Asked by</strong>
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} style={field}>
            <option value="">Our superintendent</option>
            {awardedId && awarded && <option value={awardedId}>{awarded.company}</option>}
          </select>
        </label>
        <label style={label}>
          <strong>Sheets</strong>
          <input
            value={sheets}
            onChange={(e) => {
              setSheets(e.target.value)
              // The lines whose own sheets the question names are ticked as they match. Unticking one keeps it off.
              const now = lineSheets ? holdsForSheets(sheetList(e.target.value), lineSheets).filter((id) => open.some((r) => r.activity.lineId === id)) : []
              const added = now.filter((id) => !matched.includes(id))
              if (added.length > 0) setHolds((h) => [...h, ...added.filter((id) => !h.includes(id))])
              setMatched(now)
            }}
            placeholder="A-501, M-101"
            style={field}
          />
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
          disabled={busy || !ready}
          title={ready ? undefined : 'Type the question first.'}
          onClick={() =>
            onAsk({
              projectId: project.id,
              question,
              sheets: sheetList(sheets),
              packageId: packageId || null,
              askedByCompanyId: companyId || null,
              holds,
              neededDays: dayCount,
            })
          }
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

function RfiCard({
  architect,
  row,
  emailed,
  canStartChangeOrders,
  writes,
  busy,
}: {
  architect: string
  row: RfiRow
  /** It went to the architect by our email, not another way. */
  emailed: boolean
  canStartChangeOrders: boolean
  writes: RfiWrites
  busy: boolean
}) {
  const [answering, setAnswering] = useState(false)
  const { rfi } = row
  const a = rfi.answer
  return (
    <Card style={{ border: row.neededTone === 'red' ? '1px solid var(--text-red-700)' : undefined, display: 'grid', gap: '0.4rem' }}>
      <div data-rfi={rfi.id} data-rfi-state={row.state} style={{ display: 'grid', gap: '0.4rem' }}>
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
              To {architect} <strong style={{ color: 'var(--text-base)' }}>{weekdayDate(rfi.sentToArchitectOn)}</strong>
              {emailed ? ' by email' : ''}
            </span>
          )}
          {!a && row.holds.length > 0 && (
            <span>
              Holds <strong style={{ color: 'var(--text-base)' }}>{row.holds.map((h) => h.name).join(', ')}</strong>, starts {weekdayDate(row.holds[0]?.start ?? null)}
            </span>
          )}
          {a && (
            <span>
              Answered by <strong style={{ color: 'var(--text-base)' }}>{a.by === 'architect' ? architect : 'us'}</strong>, {weekdayDate(a.on)}
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
                <Btn kind="primary" onClick={() => writes.onSendToArchitect(rfi.id)} disabled={busy}>
                  Send to {architect}
                </Btn>
                <Btn kind="quiet" onClick={() => writes.onMarkSent(rfi.id)} disabled={busy}>
                  We sent it another way
                </Btn>
                <Btn kind="quiet" onClick={() => setAnswering(true)} disabled={busy}>
                  Answer it ourselves
                </Btn>
              </>
            ) : (
              <Btn onClick={() => setAnswering(true)} disabled={busy}>
                Record their answer
              </Btn>
            )}
          </div>
        )}
        {!a && answering && (
          <AnswerForm
            by={row.state === 'architect' ? 'architect' : 'us'}
            busy={busy}
            onSave={(answer) => {
              writes.onAnswer(rfi.id, answer)
              setAnswering(false)
            }}
            onCancel={() => setAnswering(false)}
          />
        )}
        {row.canStartChangeOrder && canStartChangeOrders && a && a.cost > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <Btn kind="primary" onClick={() => writes.onStartChangeOrder(rfi)} disabled={busy}>
              Start a change order
            </Btn>
            <span data-rfi-change-hint style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              It drafts one with what changes and our cost plus the fee. You send it from Change orders.
            </span>
          </div>
        )}
        {row.canStartChangeOrder && canStartChangeOrders && a && a.cost <= 0 && (
          <div data-rfi-days-only style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            This answer adds days only. Ask for the days on the schedule instead.
          </div>
        )}
        {rfi.changeOrderId && (
          <div data-rfi-change-order style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {row.changeOrderNumber !== null ? `Change order ${row.changeOrderNumber} was started from it.` : 'A change order was started from it.'}
          </div>
        )}
      </div>
    </Card>
  )
}

function AnswerForm({ by, busy, onSave, onCancel }: { by: 'architect' | 'us'; busy: boolean; onSave: (answer: RfiAnswer) => void; onCancel: () => void }) {
  const [text, setText] = useState('')
  const [impact, setImpact] = useState<RfiImpact>('none')
  const [cost, setCost] = useState('')
  const [days, setDays] = useState('0')
  const costNum = Number(cost.replace(/[$,\s]/g, '') || '0')
  const dayNum = Number(days || '0')
  const ready = text.trim() !== '' && (impact !== 'cost' || (Number.isFinite(costNum) && Number.isFinite(dayNum) && costNum >= 0 && dayNum >= 0 && (costNum > 0 || dayNum > 0)))
  const field = { ...input, width: '100%', minWidth: 0, boxSizing: 'border-box' } as const
  const label = { display: 'grid', gap: '0.2rem', fontSize: '0.85rem' } as const
  const opts: { v: RfiImpact; words: string }[] = [
    { v: 'none', words: 'No change' },
    { v: 'plans', words: 'Changes the plans' },
    { v: 'cost', words: 'Adds cost or days' },
  ]
  return (
    <div data-rfi-answer style={{ display: 'grid', gap: '0.55rem', borderTop: '1px solid var(--border)', paddingTop: '0.6rem' }}>
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
          <span data-rfi-cost-hint style={{ gridColumn: '1 / -1', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            With a cost, Start a change order drafts one for the customer.
          </span>
        </div>
      )}
      {impact === 'plans' && (
        <span data-rfi-plans-hint style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          When the new sheets come, add them with A new set of plans came in.
        </span>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Btn kind="primary" disabled={busy || !ready} onClick={() => onSave({ text, by, impact, cost: impact === 'cost' ? costNum : 0, days: impact === 'cost' ? dayNum : 0 })}>
          Save the answer
        </Btn>
        <Btn kind="quiet" onClick={onCancel}>
          Cancel
        </Btn>
      </div>
    </div>
  )
}
