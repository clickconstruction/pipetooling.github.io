import { useState } from 'react'
import { LOST_WHY, lostWords } from '../../lib/gc/lost'
import type { GcLostWhy, GcProject } from '../../lib/gc/types'
import { shortDate } from '../../lib/gc/words'
import { Btn, Chip, input } from './gcUi'

/**
 * GC mode, the real build (the Board's B5-c): how a bid ends, from the design spike's `GcNumberTab` and
 * `LostForm`. **We sent our bid**, **We won this. Start buyout** and **We lost this** sit on the
 * project's head, without any money (call D), so the office can press them once the door opens. Each
 * write is a `gc_mark_*` function that stamps the company's day. Winning cannot be undone here, so it
 * asks once more first.
 */

export interface OutcomeWrites {
  bidSent: () => Promise<void>
  won: () => Promise<void>
  lost: (why: GcLostWhy, wonBy: string, note: string) => Promise<void>
  bringBack: () => Promise<void>
}

export function GcProjectOutcome({ project, writes }: { project: GcProject; writes: OutcomeWrites }) {
  const [step, setStep] = useState<'none' | 'won' | 'lost'>('none')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  if (project.stage !== 'pursuing') return null
  const run = (write: () => Promise<void>) => {
    setBusy(true)
    setProblem(null)
    write()
      .then(() => setStep('none'))
      .catch((e: unknown) => setProblem(e instanceof Error ? e.message : 'That did not save.'))
      .finally(() => setBusy(false))
  }
  const said = problem && <span style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>{problem}</span>
  if (project.lostOn) {
    return (
      <div data-gc-outcome={project.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
        <Chip tone="grey">Lost {shortDate(project.lostOn)}</Chip>
        <span>{lostWords(project)}</span>
        <Btn disabled={busy} title="The customer came back to us. It goes back under Bidding to the customer, as it stood." onClick={() => run(writes.bringBack)}>
          Bring it back
        </Btn>
        {said}
      </div>
    )
  }
  return (
    <div data-gc-outcome={project.id} style={{ display: 'grid', gap: '0.5rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {project.ourBidSentOn ? (
          <Chip tone="green">our bid went in {shortDate(project.ourBidSentOn)}</Chip>
        ) : (
          <Btn disabled={busy} onClick={() => run(writes.bidSent)}>
            We sent our bid
          </Btn>
        )}
        {step === 'none' && (
          <>
            <Btn kind="primary" disabled={busy} onClick={() => setStep('won')}>
              We won this. Start buyout
            </Btn>
            <Btn disabled={busy} onClick={() => setStep('lost')}>
              We lost this
            </Btn>
          </>
        )}
        {said}
      </div>
      {step === 'won' && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.9rem' }}>
          <span>Start buyout on {project.name}? It moves to Buying out, where each trade is awarded.</span>
          <Btn kind="primary" disabled={busy} onClick={() => run(writes.won)}>
            Yes, we won it
          </Btn>
          <Btn kind="quiet" disabled={busy} onClick={() => setStep('none')}>
            Not yet
          </Btn>
        </div>
      )}
      {step === 'lost' && <LostForm project={project} busy={busy} onLose={(why, wonBy, note) => run(() => writes.lost(why, wonBy, note))} onCancel={() => setStep('none')} />}
    </div>
  )
}

/** We lost this (the owner, 2026-10-03): why, who won it if we know, and a note for next time. */
function LostForm({ project, busy, onLose, onCancel }: { project: GcProject; busy: boolean; onLose: (why: GcLostWhy, wonBy: string, note: string) => void; onCancel: () => void }) {
  const [why, setWhy] = useState<GcLostWhy | null>(null)
  const [wonBy, setWonBy] = useState('')
  const [note, setNote] = useState('')
  return (
    <div style={{ padding: '0.75rem', border: '1px solid var(--border)', borderRadius: 8, display: 'grid', gap: '0.55rem' }}>
      <strong>Why did we lose {project.name}?</strong>
      <span role="group" aria-label="Why we lost it" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
        {LOST_WHY.map((w) => (
          <Btn key={w.key} kind={why === w.key ? 'primary' : 'plain'} onClick={() => setWhy(w.key)}>
            {w.label}
          </Btn>
        ))}
      </span>
      <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        Who won it, if we know
        <input value={wonBy} onChange={(e) => setWonBy(e.target.value)} placeholder="the builder the customer picked" style={{ ...input, maxWidth: '22rem' }} />
      </label>
      <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        A note for next time
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="what the customer said" style={input} />
      </label>
      <span style={{ display: 'flex', gap: '0.4rem' }}>
        <Btn kind="primary" disabled={!why || busy} {...(why ? {} : { title: 'Pick why we lost it first.' })} onClick={() => why && onLose(why, wonBy.trim(), note.trim())}>
          Mark it lost
        </Btn>
        <Btn kind="quiet" disabled={busy} onClick={onCancel}>
          Cancel
        </Btn>
      </span>
    </div>
  )
}
