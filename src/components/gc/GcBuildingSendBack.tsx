import { useState, type CSSProperties } from 'react'
import { drawApprovedLess, money, sentBackOpen, shortDate, type Draw, type Partner, type Sow } from '../../lib/gcMode/gcModel'
import { Btn, input } from './gcUi'

/**
 * GC mode design spike: the office sends a pay application back, or approves it for less (owner,
 * 2026-10-02). Under the draw on the Draws tab: each line it claims, "they say 60%, we see …" (or
 * "we approve …"), a note the trade reads in its portal, and what our numbers come to. Sent back,
 * they fix it and send it again; approved for less, it is paid now and the rest stays theirs to ask.
 */

const PCTS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

export function GcBuildingSendBackForm({
  mode = 'back',
  sow,
  draw,
  partner,
  blocked = [],
  onSend,
  onCancel,
}: {
  /** Send it back to be fixed, or approve it for less now. */
  mode?: 'back' | 'less'
  sow: Sow
  draw: Draw
  partner: Partner
  /** Paperwork that stops money moving: approving less waits on it like Approve does. */
  blocked?: string[]
  onSend: (note: string, weSee: Record<string, number>) => void
  onCancel: () => void
}) {
  const less = mode === 'less'
  const [note, setNote] = useState('')
  const [weSee, setWeSee] = useState<Record<string, number>>(() => Object.fromEntries(draw.lines.map((l) => [l.sovId, l.toPct])))
  const lines = draw.lines.flatMap((l) => {
    const line = sow.sov.find((x) => x.id === l.sovId)
    return line ? [{ ...l, label: line.label, amount: line.amount, before: line.pctBilled }] : []
  })
  const off = lines.reduce((s, l) => s + (l.amount * (l.toPct - (weSee[l.sovId] ?? l.toPct))) / 100, 0)
  const approved = drawApprovedLess(sow, draw, weSee).net
  const missing = note.trim() === '' ? (less ? 'Say why it is less first.' : 'Say what is not right first.') : null
  const blocker = less ? (blocked[0] ?? (approved >= draw.net ? 'Lower a line first.' : null)) : null

  return (
    <div style={{ marginTop: '0.4rem', padding: '0.7rem 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--bg-subtle)', display: 'grid', gap: '0.55rem', fontSize: '0.875rem' }}>
      <strong>
        {less ? `Approve less of pay application ${draw.number} from ${partner.company}` : `Send pay application ${draw.number} back to ${partner.company}`}
      </strong>
      {lines.length > 0 && (
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          {lines.map((l) => (
            <label key={l.sovId} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.5rem', alignItems: 'center' }}>
              <span>
                {l.label} <span style={{ color: 'var(--text-muted)' }}>· they say {l.toPct}% · {less ? 'we approve' : 'we see'}</span>
              </span>
              <select
                value={weSee[l.sovId] ?? l.toPct}
                onChange={(e) => setWeSee((w) => ({ ...w, [l.sovId]: Number(e.target.value) }))}
                style={field}
                aria-label={`${less ? 'We approve' : 'We see'}, ${l.label}`}
              >
                {PCTS.filter((p) => p >= l.before && p <= l.toPct).map((p) => (
                  <option key={p} value={p}>
                    {p}%
                  </option>
                ))}
              </select>
            </label>
          ))}
          {less ? (
            <div style={{ color: 'var(--text-muted)' }}>
              We approve <strong style={{ color: 'var(--text-base)' }}>{money(approved)}</strong> of the {money(draw.net)} they asked for. The rest stays theirs to
              ask for.
            </div>
          ) : (
            off > 0 && (
              <div style={{ color: 'var(--text-muted)' }}>
                Our numbers take <strong style={{ color: 'var(--text-base)' }}>{money(off)}</strong> off what they asked for.
              </div>
            )
          )}
        </div>
      )}
      <label style={{ display: 'grid', gap: '0.2rem' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-700)' }}>
          {less ? 'Why less' : 'What is not right'} · they read this in their portal
        </span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder={less ? 'Two cabinets are still on order.' : 'The break room ceiling is not hung yet.'}
          style={{ ...field, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
        />
      </label>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Btn kind="primary" disabled={missing !== null || blocker !== null} title={missing ?? blocker ?? undefined} onClick={() => onSend(note, weSee)}>
          {less ? `Approve ${money(approved)}` : 'Send it back'}
        </Btn>
        {less && blocked.length > 0 && <span style={{ color: 'var(--text-red-700)' }}>{blocked.join(' ')}</span>}
        <Btn kind="quiet" onClick={onCancel}>
          Keep it
        </Btn>
      </div>
    </div>
  )
}

/** Pay applications this trade got back from us, newest first, and whether a fixed one came in. */
export function GcBuildingSentBackList({ sow, onLook }: { sow: Sow; onLook: (draw: Draw) => void }) {
  const list = [...(sow.sentBack ?? [])].reverse()
  if (list.length === 0) return null
  const open = sentBackOpen(sow)
  return (
    <div style={{ display: 'grid', gap: '0.3rem', fontSize: '0.85rem' }}>
      {list.map((back, i) => {
        const label = (id: string) => sow.sov.find((l) => l.id === id)?.label ?? id
        const asked = (id: string) => back.draw.lines.find((l) => l.sovId === id)?.toPct ?? 0
        return (
          <div key={`${back.draw.id}-${i}`} style={{ color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--text-base)' }}>
              Pay application {back.draw.number} went back {shortDate(back.on)}.
            </span>{' '}
            {back.note}{' '}
            {back.lines.map((l) => `${label(l.sovId)}: we see ${l.weSee}%, they asked ${asked(l.sovId)}%.`).join(' ')}{' '}
            <strong style={{ color: back === open ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>
              {back === open ? 'Waiting on a fixed one.' : 'They sent it again.'}
            </strong>{' '}
            <Btn kind="quiet" onClick={() => onLook(back.draw)}>
              What they sent
            </Btn>
          </div>
        )
      })}
    </div>
  )
}

const field: CSSProperties = { ...input }
