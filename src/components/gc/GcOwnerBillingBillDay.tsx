import type { Dispatch } from 'react'
import { Btn, Card, Chip } from './gcUi'
import { billDay, money, shortDate, weekdayDate, type BillDayJob, type GcAction, type GcState } from '../../lib/gcMode/gcModel'

/**
 * GC mode design spike: bill day across every job, on the Money tab (owner's go-ahead 2026-10-05).
 * Each job's pay application for the bill day: what it asks, when that customer usually pays, and
 * what to know before it goes. Send each, or every one that is ready. The notes warn and never stop.
 */
export function GcOwnerBillingBillDay({ state, dispatch, onOpenBill }: { state: GcState; dispatch?: Dispatch<GcAction>; onOpenBill: (projectId: string) => void }) {
  const day = billDay(state)
  const ready = day.jobs.filter((j) => j.ready)
  const send = (j: BillDayJob) => dispatch?.({ type: 'sendOwnerPayApp', projectId: j.project.id })

  return (
    <Card style={{ padding: 0 }}>
      <div style={{ padding: '0.75rem 1rem 0.3rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '1rem' }}>Bill day: {weekdayDate(day.on)}</strong>
        <span style={{ flex: 1 }} />
        {dispatch && ready.length > 1 && (
          <Btn kind="primary" onClick={() => ready.forEach(send)}>
            Send all {ready.length}, {money(day.readyTotal)}
          </Btn>
        )}
      </div>
      <div style={{ padding: '0 1rem 0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        {ready.length === 0
          ? 'Nothing is ready to bill.'
          : `${ready.length === 1 ? '1 bill is' : `${ready.length} bills are`} ready, ${money(day.readyTotal)}. Send each now, or on the day.`}
      </div>
      <div style={{ display: 'grid' }}>
        {day.jobs.map((j) => (
          <div key={j.project.id} style={{ borderTop: '1px solid var(--border)', padding: '0.55rem 1rem', display: 'grid', gap: '0.25rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <strong>{j.project.name}</strong>
              <span style={{ color: 'var(--text-muted)' }}>{j.project.owner}</span>
              <span style={{ flex: 1 }} />
              {j.ready && <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{money(j.app.due)}</strong>}
              {j.sent && <Chip tone="green">{`sent pay application ${j.sent.number} ${shortDate(j.sent.sentOn)}`}</Chip>}
            </div>
            {j.ready ? (
              <div style={{ color: 'var(--text-muted)' }}>
                Pay application {j.app.number}
                {j.app.expectPaidOn ? `. They usually pay by about ${shortDate(j.app.expectPaidOn)}.` : '. They have not paid us a bill yet.'}
              </div>
            ) : (
              !j.sent && (
                <div style={{ color: 'var(--text-muted)' }}>
                  {j.allBilled ? 'Every line is billed. Closeout comes next.' : 'Nothing new to bill since the last one.'}
                </div>
              )
            )}
            {j.notes.map((n) => (
              <div key={n.words} style={{ color: n.tone === 'amber' ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>
                {n.words}
              </div>
            ))}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {j.ready && dispatch && (
                <Btn kind="primary" onClick={() => send(j)}>
                  Send {money(j.app.due)}
                </Btn>
              )}
              <Btn kind="quiet" onClick={() => onOpenBill(j.project.id)}>
                Bill the customer
              </Btn>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
