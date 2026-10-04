import { useState, type Dispatch } from 'react'
import {
  ourTeam,
  partnersToVet,
  shortDate,
  vettingOf,
  vettingWords,
  type GcAction,
  type GcState,
  type Partner,
} from '../../lib/gcMode/gcModel'
import { Btn, Card, Chip, input } from './gcUi'

/**
 * GC mode design spike: vetting a company new to us (the owner, 2026-10-04, question 3). Anyone
 * can quote; award waits until someone on our team approves them here, or approves them up to a
 * dollar limit, or declines them.
 */

/** "not vetted yet", "approved up to $150,000", "declined". Nothing for a company we know. */
export function VettingChip({ partner }: { partner: Partner }) {
  const words = vettingWords(partner)
  if (!words) return null
  const v = vettingOf(partner)
  const tone = v.status === 'new' ? 'amber' : v.status === 'declined' ? 'red' : 'blue'
  const title =
    v.status === 'new'
      ? 'They can quote. Nothing is awarded to them until we approve them on Trade partners.'
      : v.decidedBy
        ? `${v.decidedBy} decided ${v.decidedOn ? shortDate(v.decidedOn) : ''}${v.note ? `: ${v.note}` : ''}`
        : undefined
  return (
    <Chip tone={tone} title={title}>
      {words}
    </Chip>
  )
}

/** The companies waiting on our decision, at the top of Trade partners. Nothing when none wait. */
export function GcVetQueue({ state, dispatch }: { state: GcState; dispatch: Dispatch<GcAction> }) {
  const waiting = partnersToVet(state)
  if (waiting.length === 0) return null
  return (
    <Card style={{ marginBottom: '0.8rem', borderColor: 'var(--border-amber)' }} dataTour="gc-vet-queue">
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <strong>New to us: approve before any award ({waiting.length})</strong>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          They can quote now. They send a short form from their portal. Approve them, approve them up to an amount, or decline them.
        </span>
      </div>
      <div style={{ display: 'grid', gap: '0.6rem' }}>
        {waiting.map((p) => (
          <VetRow key={p.id} state={state} partner={p} dispatch={dispatch} />
        ))}
      </div>
    </Card>
  )
}

function VetRow({ state, partner, dispatch }: { state: GcState; partner: Partner; dispatch: Dispatch<GcAction> }) {
  const team = ourTeam(state)
  const [by, setBy] = useState(team[0] ?? '')
  const [limit, setLimit] = useState('')
  const [note, setNote] = useState('')
  const form = partner.vetting?.form
  const amount = Number(limit.replace(/[^0-9.]/g, ''))
  const decide = (status: 'approved' | 'declined', withLimit: boolean) =>
    dispatch({
      type: 'vetPartner',
      partnerId: partner.id,
      status,
      by,
      ...(withLimit && amount > 0 ? { limit: Math.round(amount) } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    })
  const row = (label: string, value: string | number) => (
    <div style={{ display: 'grid', gridTemplateColumns: '9rem minmax(0, 1fr)', gap: '0.5rem', fontSize: '0.875rem' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span>{value}</span>
    </div>
  )
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.45rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <strong>{partner.company}</strong>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {partner.trades.join(', ')} · {partner.contact || 'no contact yet'}
        </span>
        <VettingChip partner={partner} />
      </div>
      {form ? (
        <div style={{ display: 'grid', gap: '0.2rem' }}>
          {row('Form came in', shortDate(form.sentOn))}
          {row('License', form.license)}
          {row('Insurance', form.insurance)}
          {row('Years in business', form.yearsInBusiness)}
          {row('References', form.references)}
          {row('Jobs like ours', form.pastJobs)}
        </div>
      ) : (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Their form has not come in. It is waiting in their portal. You can still decide if you know enough.
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Who is deciding{' '}
          <select style={input} value={by} onChange={(e) => setBy(e.target.value)}>
            {team.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <input style={{ ...input, flex: '1 1 12rem' }} placeholder="A note, or why we decline" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <Btn kind="primary" disabled={!by} onClick={() => decide('approved', false)}>
          Approve
        </Btn>
        <span style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
          <input style={{ ...input, width: '7.5rem' }} inputMode="numeric" placeholder="$ amount" aria-label="Approve up to this amount" value={limit} onChange={(e) => setLimit(e.target.value)} />
          <Btn disabled={!by || !(amount > 0)} onClick={() => decide('approved', true)}>
            Approve up to this
          </Btn>
        </span>
        <Btn kind="quiet" disabled={!by} onClick={() => decide('declined', false)}>
          Decline
        </Btn>
      </div>
    </div>
  )
}
