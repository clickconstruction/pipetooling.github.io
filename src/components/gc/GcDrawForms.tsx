import { useState, type CSSProperties } from 'react'
import { Btn, input } from './gcUi'
import { drawApprovedLess, sentBackOpen } from '../../lib/gc/building'
import { DRAW_PORTAL_LIVE } from '../../lib/gc/drawEmail'
import { drawCameInMoney, type DrawCameIn } from '../../lib/gc/drawRows'
import type { Draw, Sow } from '../../lib/gc/types'
import { money, shortDate } from '../../lib/gc/words'

/**
 * GC mode, the real build, the Building lane's U6b: the Draws window's forms, ported from the prototype's
 * `GcBuildingSendBack.tsx` (branch spike/gc-mode; the plan: to-dos/gc-mode/mockups/building-u6.md), with the came-in
 * form beside them, new in the real build as the submittal's is. The office sends a pay application back, approves it
 * for less, or records one that came by email or on paper. The database works the money out itself (the Building
 * lane's U6a); the forms show what it will come to.
 */

/** Who can open a Drive link: anyone with it, only people given access, or not known. */
export type LinkAccess = 'anyone' | 'restricted' | null

const TENS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

/** The percents a line can be set to between what was billed and what they asked: the tens, and what they asked. */
function pctChoices(from: number, to: number): number[] {
  return [...new Set([...TENS.filter((p) => p >= from && p < to), to])].sort((a, b) => a - b)
}

const field: CSSProperties = { ...input, width: '100%', minWidth: 0, boxSizing: 'border-box' }
const label: CSSProperties = { fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-700)' }
const panel: CSSProperties = {
  marginTop: '0.4rem',
  padding: '0.7rem 0.8rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 8,
  background: 'var(--bg-subtle)',
  display: 'grid',
  gap: '0.55rem',
  fontSize: '0.875rem',
}

/**
 * Send a waiting pay application back to be fixed, or approve it for less now. Each line it claims shows what they say
 * and what we see. Approved for less, it is paid now and the rest stays theirs to ask for.
 */
export function GcDrawSendBackForm({
  mode,
  sow,
  draw,
  company,
  blocked = [],
  busy = false,
  emailOn = false,
  onSend,
  onCancel,
}: {
  mode: 'back' | 'less'
  sow: Sow
  draw: Draw
  company: string
  /** The papers that stop money moving: approving less waits on them as Approve does. */
  blocked?: string[]
  /** The window's email tick: approved for less, the note goes in that email only when it is on. */
  emailOn?: boolean
  busy?: boolean
  onSend: (note: string, percents: Record<string, number>) => void
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
  // Only the lines we doubt go to the database: each one we lowered.
  const doubted = Object.fromEntries(lines.filter((l) => (weSee[l.sovId] ?? l.toPct) < l.toPct).map((l) => [l.sovId, weSee[l.sovId] ?? l.toPct]))

  return (
    <div data-draw-form={mode} style={panel}>
      <strong>{less ? `Approve less of pay application ${draw.number} from ${company}` : `Send pay application ${draw.number} back to ${company}`}</strong>
      {lines.length > 0 && (
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          {lines.map((l) => (
            <label key={l.sovId} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.5rem', alignItems: 'center' }}>
              <span>
                {l.label} <span style={{ color: 'var(--text-muted)' }}>they say {l.toPct}%, {less ? 'we approve' : 'we see'}</span>
              </span>
              <select
                value={weSee[l.sovId] ?? l.toPct}
                onChange={(e) => setWeSee((w) => ({ ...w, [l.sovId]: Number(e.target.value) }))}
                style={{ ...input }}
                aria-label={`${less ? 'We approve' : 'We see'}, ${l.label}`}
              >
                {pctChoices(l.before, l.toPct).map((p) => (
                  <option key={p} value={p}>
                    {p}%
                  </option>
                ))}
              </select>
            </label>
          ))}
          {less ? (
            <div data-draw-less-sum style={{ color: 'var(--text-muted)' }}>
              We approve <strong style={{ color: 'var(--text-base)' }}>{money(approved)}</strong> of the {money(draw.net)} they asked for. The rest stays theirs to
              ask for.
            </div>
          ) : (
            off > 0 && (
              <div data-draw-back-sum style={{ color: 'var(--text-muted)' }}>
                Our numbers take <strong style={{ color: 'var(--text-base)' }}>{money(off)}</strong> off what they asked for.
              </div>
            )
          )}
        </div>
      )}
      <label style={{ display: 'grid', gap: '0.2rem' }}>
        <span style={label}>{less ? 'Why less' : 'What is not right'}</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder={less ? 'Two cabinets are still on order.' : 'The break room ceiling is not hung yet.'}
          style={{ ...field, resize: 'vertical', fontFamily: 'inherit' }}
        />
        <span data-draw-note-hint style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {less
            ? emailOn
              ? 'It goes in the email we send them about this pay application.'
              : 'Tell them why too. With the email tick off, no email goes.'
            : DRAW_PORTAL_LIVE
              ? 'They read it in their portal.'
              : 'Call or email them with it too. Their portal does not show pay applications yet.'}
        </span>
      </label>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <Btn kind="primary" disabled={busy || missing !== null || blocker !== null} title={missing ?? blocker ?? undefined} onClick={() => onSend(note.trim(), doubted)}>
          {less ? `Approve ${money(approved)}` : 'Send it back'}
        </Btn>
        {less && blocked.length > 0 && <span style={{ color: 'var(--text-red-700)' }}>{blocked.join(' ')}</span>}
        <Btn kind="quiet" onClick={onCancel}>
          Cancel
        </Btn>
      </div>
    </div>
  )
}

/** The pay applications we sent this trade back, newest first, and whether a fixed one came in. */
export function GcDrawSentBackList({ sow, onLook }: { sow: Sow; onLook: (draw: Draw) => void }) {
  const list = [...(sow.sentBack ?? [])].reverse()
  if (list.length === 0) return null
  const open = sentBackOpen(sow)
  const labelOf = (id: string) => sow.sov.find((l) => l.id === id)?.label ?? id
  return (
    <div style={{ display: 'grid', gap: '0.3rem', fontSize: '0.85rem' }}>
      {list.map((back) => {
        const asked = (id: string) => back.draw.lines.find((l) => l.sovId === id)?.toPct ?? 0
        return (
          <div key={back.draw.id} data-draw-sent-back={back.draw.id} style={{ color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--text-base)' }}>
              Pay application {back.draw.number} went back {shortDate(back.on)}.
            </span>{' '}
            {back.note}{' '}
            {back.lines.map((l) => `${labelOf(l.sovId)}: we see ${l.weSee}%, they asked ${asked(l.sovId)}%.`).join(' ')}{' '}
            <strong style={{ color: back === open ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>{back === open ? 'Waiting on a fixed one.' : 'They sent it again.'}</strong>{' '}
            <Btn kind="quiet" onClick={() => onLook(back.draw)}>
              What they sent
            </Btn>
          </div>
        )
      })}
    </div>
  )
}

/**
 * A pay application that came by email or on paper: each line's percent done, starting from their report, the
 * materials stored on site, the day it runs to, who signed it, and its Drive link. A link only people given access can
 * open is a warning, never a stop.
 */
export function GcDrawCameInForm({
  sow,
  company,
  start,
  busy = false,
  checkLink,
  onRecord,
  onCancel,
}: {
  sow: Sow
  company: string
  /** Where it starts (`drawCameInDraft`). */
  start: DrawCameIn
  busy?: boolean
  checkLink?: (url: string) => Promise<LinkAccess>
  onRecord: (d: DrawCameIn) => void
  onCancel: () => void
}) {
  const [d, setD] = useState<DrawCameIn>(start)
  const [showStored, setShowStored] = useState(false)
  const [access, setAccess] = useState<LinkAccess>(null)
  const set = (patch: Partial<DrawCameIn>) => setD((x) => ({ ...x, ...patch }))
  const setLine = (sovId: string, patch: Partial<DrawCameIn['lines'][number]>) => set({ lines: d.lines.map((l) => (l.sovId === sovId ? { ...l, ...patch } : l)) })
  const comes = drawCameInMoney(sow, d.lines)
  const missing =
    comes.gross <= 0
      ? 'Nothing is new since their last pay application.'
      : d.periodTo === ''
        ? 'Say the day it runs to first.'
        : d.signedBy.trim() === ''
          ? 'Say who signed it first.'
          : null
  const check = (url: string) => {
    setAccess(null)
    if (!checkLink || !url.trim()) return
    void checkLink(url.trim())
      .then(setAccess)
      .catch(() => setAccess(null))
  }
  return (
    <div data-draw-came-in style={panel}>
      <strong>A pay application from {company} that came by email or on paper</strong>
      <div style={{ display: 'grid', gap: '0.35rem' }}>
        {sow.sov.map((l) => {
          const line = d.lines.find((x) => x.sovId === l.id)
          if (!line) return null
          return (
            <label key={l.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 6.5rem', gap: '0.5rem', alignItems: 'center' }}>
              <span>
                {l.label} <span style={{ color: 'var(--text-muted)' }}>{money(l.amount)}, billed {l.pctBilled}%</span>
              </span>
              <input
                type="number"
                min={l.pctBilled}
                max={100}
                value={Number.isFinite(line.toPct) ? line.toPct : ''}
                onChange={(e) => setLine(l.id, { toPct: e.target.value === '' ? Number.NaN : Number(e.target.value) })}
                style={field}
                aria-label={`Percent done, ${l.label}`}
              />
            </label>
          )
        })}
      </div>
      <label style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
        <input type="checkbox" checked={showStored} onChange={(e) => setShowStored(e.target.checked)} />
        <span>It asks for materials stored on site</span>
      </label>
      {showStored && (
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          {sow.sov.map((l) => {
            const line = d.lines.find((x) => x.sovId === l.id)
            if (!line) return null
            return (
              <label key={l.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 7rem', gap: '0.5rem', alignItems: 'center' }}>
                <span>{l.label}</span>
                <input
                  type="number"
                  min={0}
                  value={line.stored === 0 ? '' : line.stored}
                  placeholder="0"
                  onChange={(e) => setLine(l.id, { stored: Math.max(0, Number(e.target.value) || 0) })}
                  style={field}
                  aria-label={`Stored on site in dollars, ${l.label}`}
                />
              </label>
            )
          })}
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Stored materials are paid once. They come out of stored as they are built.</span>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))', gap: '0.5rem' }}>
        <label style={{ display: 'grid', gap: '0.2rem' }}>
          <span style={label}>The day it runs to</span>
          <input type="date" value={d.periodTo} onChange={(e) => set({ periodTo: e.target.value })} style={field} />
        </label>
        <label style={{ display: 'grid', gap: '0.2rem' }}>
          <span style={label}>Their address</span>
          <input value={d.address} onChange={(e) => set({ address: e.target.value })} style={field} />
        </label>
        <label style={{ display: 'grid', gap: '0.2rem' }}>
          <span style={label}>Their license</span>
          <input value={d.license} onChange={(e) => set({ license: e.target.value })} style={field} />
        </label>
        <label style={{ display: 'grid', gap: '0.2rem' }}>
          <span style={label}>Signed by</span>
          <input value={d.signedBy} onChange={(e) => set({ signedBy: e.target.value })} style={field} />
        </label>
        <label style={{ display: 'grid', gap: '0.2rem' }}>
          <span style={label}>Their title</span>
          <input value={d.signedTitle} onChange={(e) => set({ signedTitle: e.target.value })} placeholder="Owner" style={field} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={d.fileName} onChange={(e) => set({ fileName: e.target.value })} placeholder="The file's name" aria-label="The file's name" style={{ ...input, flex: '1 1 12rem' }} />
        <input
          value={d.driveUrl}
          onChange={(e) => set({ driveUrl: e.target.value })}
          onBlur={(e) => check(e.target.value)}
          placeholder="Its Drive link"
          aria-label="Its Drive link"
          style={{ ...input, flex: '2 1 16rem' }}
        />
      </div>
      {access === 'restricted' && (
        <div data-draw-link-hint style={{ fontSize: '0.8rem', color: 'var(--text-amber-800)' }}>
          Only people given access can open this link. Our office may not be one of them.
        </div>
      )}
      <div data-draw-came-in-sum style={{ color: 'var(--text-muted)' }}>
        {comes.gross > 0 ? (
          <>
            Pay application {comes.number} comes to <strong style={{ color: 'var(--text-base)' }}>{money(comes.gross)}</strong>. We hold {money(comes.retainage)} of it.
            It asks for <strong style={{ color: 'var(--text-base)' }}>{money(comes.net)}</strong>.
          </>
        ) : (
          'Nothing is new since their last pay application.'
        )}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Btn kind="primary" disabled={busy || missing !== null} title={missing ?? undefined} onClick={() => onRecord(d)}>
          Record it
        </Btn>
        <Btn kind="quiet" onClick={onCancel}>
          Cancel
        </Btn>
      </div>
    </div>
  )
}
