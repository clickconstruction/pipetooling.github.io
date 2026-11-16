/** SPIKE ONLY: the payment window's new parts over made-up money (punch list #347's residue and #350's PR 4). Deleted at wrap-up. */
import { useState } from 'react'
import { SendingByHandGrid } from '../components/jobs/SendingByHandGrid'
import { AfterRecordPaymentWindow } from '../components/jobs/SubLaborPaymentModals'
import { GatherSendingsWindowView, OverToCreditWindowView } from '../components/jobs/SubSendingRepairWindows'
import { planSubSendingByHand, sendingConfirmLabel } from '../lib/subWorkOrders/subSendingByHand'
import { overToCreditPlan, proposeSendingGroups, type GatherLine } from '../lib/subWorkOrders/subSendingRepair'
import { say } from './say'
import type { SpikeView } from './views'

const HAND_SHEET = { id: 's-cedar-1', label: '2041 Cedar Hollow Clinic', remaining: 2600 }
const HAND_CTX = {
  personId: 'harlan',
  credit: 0,
  others: [
    { id: 's-ridge-1', key: 'id:harlan', label: '2057 Ridgeway Builders, Lot 12', remaining: 2500, day: '2026-11-03' },
    { id: 's-cedar-2', key: 'id:harlan', label: '2041 Cedar Hollow Clinic, trim', remaining: 1200, day: '2026-11-06' },
  ],
}

/** The Record payment window's own middle, with the amount placed by hand. */
function ByHand({ start }: { start: Record<string, string> }) {
  const [boxes, setBoxes] = useState<Record<string, string>>(start)
  const hand = planSubSendingByHand('2200', HAND_SHEET, HAND_CTX, boxes)
  return (
    <div style={{ background: 'var(--surface)', padding: '1.2rem', borderRadius: 8, border: '1px solid var(--border)', maxWidth: 480, marginBottom: 16 }}>
      <h2 style={{ margin: '0 0 0.3rem', fontSize: '1.2rem' }}>Record payment</h2>
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 10 }}>Harlan Mechanical · 2041 · Total $4,200.00 · Paid $1,500.00 · Remaining $2,600.00</div>
      <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: 4 }}>Amount paid</div>
      <div style={{ padding: '0.4rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, marginBottom: 10, maxWidth: 140 }}>2200.00</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 600, padding: '0.2rem 0.7rem', borderRadius: 999, border: '1px solid var(--border)' }}>Oldest first</span>
        <span style={{ fontSize: '0.78rem', fontWeight: 600, padding: '0.2rem 0.7rem', borderRadius: 999, border: '1px solid var(--border-blue)', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' }}>By hand</span>
      </div>
      <SendingByHandGrid hand={hand} boxes={boxes} onBox={(id, v) => setBoxes((p) => ({ ...p, [id]: v }))} canCredit />
      {!hand.plan.ok && hand.plan.reason !== 'blank' ? (
        <p role="alert" style={{ margin: '0 0 0.75rem', padding: '0.5rem 0.65rem', fontSize: '0.8125rem', color: 'var(--text-red-700)', background: 'var(--bg-red-tint)', borderRadius: 6 }}>
          {hand.plan.error}
        </p>
      ) : null}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <span style={{ fontSize: '0.875rem', padding: '0.4rem 0.9rem', borderRadius: 6, border: '1px solid var(--border-strong)' }}>Cancel</span>
        <span style={{ fontSize: '0.875rem', fontWeight: 650, padding: '0.4rem 0.9rem', borderRadius: 6, background: hand.plan.ok ? '#2563eb' : 'var(--bg-200)', color: hand.plan.ok ? 'white' : 'var(--text-700)' }}>{sendingConfirmLabel(hand.plan)}</span>
      </div>
    </div>
  )
}

const OVER_PLAN = overToCreditPlan(
  { label: '2033 Alder Court Remodel', total: 1800, paid: 1850, over: 50 },
  [
    { id: 'p1', amount: 600, dayWords: 'Sep 28', fromCredit: false, carriesCredit: false, at: '2026-09-28' },
    { id: 'p2', amount: 1250, dayWords: 'Oct 3', fromCredit: false, carriesCredit: false, at: '2026-10-03' },
  ],
  { personId: 'harlan', name: 'Harlan Mechanical' },
)

const gl = (id: string, sheetId: string, job: string, ymd: string, amount: number, o: Partial<GatherLine> = {}): GatherLine => ({ id, sheetId, paidToKey: 'id:harlan', paidTo: 'Harlan Mechanical', job, ymd, recorded: false, method: 'Check', methodRef: '1141', amount, hasSending: false, fromCredit: false, ...o })
const marlow = { paidTo: 'Marlow Tile', paidToKey: 'id:marlow', method: 'Zelle', methodRef: '' }
const typed = { recorded: true, method: '', methodRef: '' }
const GATHER = proposeSendingGroups([
  gl('a', 's1', '2019 Birch Lane Remodel', '2026-08-14', 500),
  gl('b', 's2', '2022 Juniper Flats', '2026-08-14', 700),
  gl('c', 's3', '2027 Aspen Row', '2026-08-14', 900),
  gl('d', 's4', '2030 Willow Bend', '2026-09-04', 1200, marlow),
  gl('e', 's5', '2031 Sycamore Court', '2026-09-04', 300, marlow),
  gl('f', 's6', '2011 Cypress Street', '2026-07-02', 400, typed),
  gl('g', 's7', '2014 Poplar Avenue', '2026-07-02', 600, typed),
])

export const PAYMENT_VIEWS: SpikeView[] = [
  {
    key: '347-by-hand',
    title: '#347 · Record payment, placed by hand (ready, and not yet placed)',
    render: () => (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <ByHand start={{ 's-cedar-1': '1000.00', 's-ridge-1': '', 's-cedar-2': '1200.00' }} />
        <ByHand start={{ 's-cedar-1': '1000.00', 's-ridge-1': '', 's-cedar-2': '700.00' }} />
      </div>
    ),
  },
  { key: '347-over-to-credit', title: '#347 · a sheet paid past its total becomes a credit', render: () => <OverToCreditWindowView title="Harlan Mechanical · 2033 Alder Court Remodel" plan={OVER_PLAN} saving={false} error={null} onConfirm={say('Keeps the overage as their credit')} onClose={say('Closes the window')} /> },
  { key: '347-gather', title: '#347 · old payments gathered into sendings', render: () => <GatherSendingsWindowView groups={GATHER} busy={false} outcome={null} onGather={say('Gathers the ticked groups')} onClose={say('Closes the window')} /> },
  { key: '350-after-record', title: '#350 · the window after Record payment', render: () => <AfterRecordPaymentWindow recorded={{ name: 'Harlan Mechanical', sent: 2200, sheets: 2, how: 'Zelle 8841' }} onDone={say('Closes it')} onSend={say('Opens the payment record on its send step')} /> },
]
