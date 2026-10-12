import { useState } from 'react'
import {
  checkWindowWords,
  claimWords,
  inCheckWindow,
  needsWhy,
  tapChoices,
  underClaim,
  underWords,
  walkCountWords,
  walkFootWords,
  type ClaimToCheck,
} from '../../lib/gc/billDay/walk'
import type { DrawTables } from '../../lib/gc/drawRows'
import type { GcProject, GcState } from '../../lib/gc/types'
import { weekdayDate } from '../../lib/gc/words'
import { Btn, Card, Chip, input } from './gcUi'
import { useBillDay } from './useBillDay'

/**
 * Messages, cut 9 (wave 2, helper 7): the daily log's Claims to check (the prototype's v1.124 log). On the checking
 * days, the claims of the draws waiting on us in walking order, one tap per line that becomes what we see, and a photo
 * or a note under the claim so the office can say why. The superintendent's path: percents and photos, never a dollar.
 * A tap never approves; the office does, in the Draws window. Off the checking days, one line says when the list comes.
 */
export function GcBillDayClaims({ state, project, drawTables }: { state: GcState; project: GcProject; drawTables: DrawTables }) {
  const { read, writes, busy, problem } = useBillDay(state, project, drawTables, null)
  const [early, setEarly] = useState(false)
  if (!read || read.items.length === 0) return null
  const { dates, items } = read
  const draws = new Set(items.map((i) => i.drawId)).size
  const open = inCheckWindow(dates, state.today) || early
  return (
    <Card style={{ padding: '0.75rem 1rem', display: 'grid', gap: '0.5rem', border: '1px solid var(--border-amber)' }}>
      <div data-bill-day-claims style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap', fontSize: '0.875rem' }}>
        <strong style={{ fontSize: '0.95rem' }}>Claims to check</strong>
        <span style={{ color: 'var(--text-muted)' }}>
          pay application {dates.number} · {items.length} {items.length === 1 ? 'line' : 'lines'} on {draws} {draws === 1 ? 'draw' : 'draws'} · by {weekdayDate(dates.checkBy)}
        </span>
        {open && (
          <>
            <span style={{ flex: 1 }} />
            <span data-bill-day-claims-count>{walkCountWords(items)}</span>
          </>
        )}
      </div>
      {!open ? (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>{checkWindowWords(dates, state.today)}</span>
          <Btn kind="quiet" onClick={() => setEarly(true)}>
            Show the list now
          </Btn>
        </div>
      ) : (
        <>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Bill day is {weekdayDate(dates.billDay)}. Walk the claims and tap what you see, in walking order. A tap under the claim needs a photo or a note. You see percents and photos. The money is the office’s.
          </div>
          <Walk items={items} billDay={dates.billDay} busy={busy} onTap={writes.tap} />
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{walkFootWords(items)}</div>
        </>
      )}
      {problem && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>
          {problem}
        </div>
      )}
    </Card>
  )
}

type Tap = (t: { drawId: string; sovId: string; weSee: number | null; onSite: boolean | null; photoUrl?: string; note?: string }) => Promise<boolean>

function Walk({ items, billDay, busy, onTap }: { items: ClaimToCheck[]; billDay: string; busy: boolean; onTap: Tap }) {
  let place = ''
  return (
    <div style={{ display: 'grid', gap: '0.35rem' }}>
      {items.map((item) => {
        const head = item.where !== place ? item.where : null
        place = item.where
        return (
          <div key={`${item.drawId}:${item.sovId}:${item.kind}`} style={{ display: 'grid', gap: '0.3rem' }}>
            {head && <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{head}</div>}
            <Claim item={item} billDay={billDay} busy={busy} onTap={onTap} />
          </div>
        )
      })}
    </div>
  )
}

function Claim({ item, billDay, busy, onTap }: { item: ClaimToCheck; billDay: string; busy: boolean; onTap: Tap }) {
  const [other, setOther] = useState<string | null>(null)
  const [photo, setPhoto] = useState('')
  const [note, setNote] = useState(item.note)
  const under = underClaim(item)
  const needs = needsWhy(item)
  const reading = { drawId: item.drawId, sovId: item.sovId, weSee: item.kind === 'work' ? item.weSee : null, onSite: item.kind === 'stored' ? item.onSite : null }
  const tap = (weSee: number | null, onSite: boolean | null) => void onTap({ drawId: item.drawId, sovId: item.sovId, weSee, onSite })
  const choices = item.kind === 'work' && item.claimed !== null && item.last !== null ? tapChoices(item.claimed, item.last) : []
  const custom = item.kind === 'work' && item.weSee !== null && !choices.includes(item.weSee)
  const seg = (on: boolean, warn: boolean) => ({
    padding: '0.3rem 0.6rem',
    borderRadius: 6,
    border: `1px solid ${on ? (warn ? 'var(--text-red-600)' : 'var(--text-green-600)') : 'var(--border-strong)'}`,
    background: on ? (warn ? 'var(--bg-red-tint)' : 'var(--bg-green-tint)') : 'var(--surface)',
    color: 'inherit',
    fontWeight: on ? 700 : 400,
    cursor: busy ? 'default' : 'pointer',
    fontSize: '0.85rem',
    fontVariantNumeric: 'tabular-nums' as const,
  })
  return (
    <div data-bill-day-claim={`${item.drawId}:${item.sovId}:${item.kind}`} style={{ border: `1px solid ${needs ? 'var(--border-amber)' : 'var(--border)'}`, borderRadius: 8, padding: '0.45rem 0.6rem', display: 'grid', gap: '0.35rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ display: 'grid', flex: '1 1 200px', fontSize: '0.875rem' }}>
          <strong>
            {item.company} · {item.label}
          </strong>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{claimWords(item, billDay)}</span>
        </span>
        <span role="group" aria-label={`What you see on ${item.label}`} style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
          {item.kind === 'stored' ? (
            <>
              <button type="button" disabled={busy} aria-pressed={item.onSite === true} style={seg(item.onSite === true, false)} onClick={() => tap(null, true)}>
                yes
              </button>
              <button type="button" disabled={busy} aria-pressed={item.onSite === false} style={seg(item.onSite === false, true)} onClick={() => tap(null, false)}>
                no
              </button>
            </>
          ) : (
            <>
              {choices.map((pct) => (
                <button key={pct} type="button" disabled={busy} aria-pressed={item.weSee === pct} style={seg(item.weSee === pct, pct !== item.claimed)} onClick={() => tap(pct, null)}>
                  {pct}%
                </button>
              ))}
              {other === null ? (
                <button type="button" disabled={busy} aria-pressed={custom} style={seg(custom, true)} onClick={() => setOther(custom && item.weSee !== null ? String(item.weSee) : '')} title="Another percent">
                  {custom ? `${item.weSee}%` : '…'}
                </button>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    const pct = Number(other)
                    if (other.trim() === '' || !Number.isFinite(pct) || pct < 0 || pct > 100) return
                    setOther(null)
                    tap(pct, null)
                  }}
                  style={{ display: 'flex', gap: '0.25rem' }}
                >
                  <input aria-label="What you see, as a percent" type="number" min={0} max={100} value={other} onChange={(e) => setOther(e.target.value)} style={{ ...input, width: '4.5rem' }} />
                  <button type="submit" disabled={busy} style={seg(false, false)}>
                    Keep
                  </button>
                </form>
              )}
            </>
          )}
        </span>
      </div>
      {needs && (
        <div data-bill-day-needs style={{ display: 'grid', gap: '0.3rem', background: 'var(--bg-amber-tint)', borderRadius: 6, padding: '0.4rem 0.5rem', fontSize: '0.85rem' }}>
          <strong>{underWords(item)}</strong>
          <input aria-label="The photo’s Drive link" placeholder="The photo’s Drive link" value={photo} onChange={(e) => setPhoto(e.target.value)} style={input} />
          <input aria-label="Or a note: what is not there" placeholder="Or a note: what is not there" value={note} onChange={(e) => setNote(e.target.value)} style={input} />
          <div>
            <Btn kind="primary" disabled={busy || (photo.trim() === '' && note.trim() === '')} onClick={() => void onTap({ ...reading, photoUrl: photo.trim(), note: note.trim() })}>
              Keep it
            </Btn>
          </div>
        </div>
      )}
      {under && !needs && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {item.photo && <Chip tone="blue" small>photo kept</Chip>}
          {item.note && <span>“{item.note}”</span>}
        </div>
      )}
    </div>
  )
}
