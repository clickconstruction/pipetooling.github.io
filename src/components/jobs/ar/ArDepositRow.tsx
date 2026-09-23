/**
 * One deposit in the Accounts Receivable list (AR refresh PR 1, v2.3379):
 * the amount, who it came from, when and how, and a state chip that says
 * what the modal already knows before the row is clicked — "1 exact match",
 * "probably recorded", "payer known" — from `arDepositRowState.ts`. Mark
 * mode keeps its Returned checkbox on the row.
 */
import type { CSSProperties } from 'react'
import type { MercuryKindBadge } from '../../../lib/bankPaymentsKindBadges'
import { arDepositRowStateLabel, type ArDepositRowState, type ArDepositRowTone } from '../../../lib/jobs/arDepositRowState'
import type { MercuryBankReturn } from '../../../lib/jobs/bankReturnedDeposits'
import { APP_CALENDAR_TZ } from '../../../utils/dateUtils'
import { KindBadgePill } from './KindBadgePill'

export type ArDepositRowDeposit = {
  mercury_transaction_id: string
  amount: number | string | null
  counterparty_name: string | null
  note: string | null
  external_memo: string | null
  posted_at: string | null
  kind: string
  returned?: boolean | null
  /** v2.3791: Mercury says the bank returned it — the chip names the reason. */
  bankReturn?: MercuryBankReturn | null
  consumed: number | string | null
  remaining_available: number | string | null
}

const CONSUMED_EPS = 0.01

function money(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const TONE: Record<ArDepositRowTone, { bg: string; fg: string; border: string }> = {
  green: { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-700)', border: 'var(--border-green)' },
  amber: { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)', border: 'var(--border-strong)' },
  red: { bg: 'var(--surface)', fg: 'var(--text-red-700)', border: 'var(--border-red)' },
  blue: { bg: 'var(--bg-blue-tint)', fg: 'var(--text-blue-800)', border: 'var(--border-strong)' },
  muted: { bg: 'var(--bg-200)', fg: 'var(--text-muted)', border: 'var(--border)' },
}

export function ArStateChip({ state, bankReturn = null }: { state: ArDepositRowState; bankReturn?: MercuryBankReturn | null }) {
  const label = arDepositRowStateLabel(state, bankReturn)
  if (!label) return null
  const t = TONE[label.tone]
  const style: CSSProperties = {
    display: 'inline-block',
    padding: '1px 8px',
    borderRadius: 999,
    fontSize: '0.6875rem',
    fontWeight: 700,
    letterSpacing: '0.01em',
    whiteSpace: 'nowrap',
    background: t.bg,
    color: t.fg,
    border: `1px solid ${t.border}`,
  }
  return (
    <span data-testid="ar-deposit-state" data-state={state} style={style}>
      {label.text}
    </span>
  )
}

/** The first line of the note or memo, short enough for the meta line. */
function memoSnippet(d: ArDepositRowDeposit): string | null {
  const raw = (d.note ?? '').trim() || (d.external_memo ?? '').trim()
  if (!raw) return null
  const first = raw.split(/\r?\n/)[0]!.trim()
  return first.length > 42 ? `${first.slice(0, 40).trimEnd()}…` : first
}

export function ArDepositRow({
  deposit,
  active,
  state,
  kindBadges,
  markMode,
  canApply,
  savingReturned,
  onSelect,
  onToggleReturned,
}: {
  deposit: ArDepositRowDeposit
  active: boolean
  state: ArDepositRowState
  kindBadges: Record<string, MercuryKindBadge>
  markMode: boolean
  canApply: boolean
  savingReturned: boolean
  onSelect: () => void
  onToggleReturned: (next: boolean) => void
}) {
  const d = deposit
  const posted = d.posted_at ? new Date(d.posted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: APP_CALENDAR_TZ }) : '—'
  const consumed = Number(d.consumed) || 0
  const snippet = memoSnippet(d)
  const name = (d.counterparty_name ?? '').trim() || '—'
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'true' : undefined}
      aria-label={`${money(Math.abs(Number(d.amount) || 0))} from ${name}`}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: '2px 0.6rem',
        alignItems: 'start',
        width: '100%',
        textAlign: 'left',
        padding: '0.6rem 0.75rem',
        border: 'none',
        borderBottom: '1px solid var(--border)',
        boxShadow: active ? 'inset 3px 0 0 var(--text-link)' : 'none',
        background: active ? 'var(--bg-blue-tint)' : 'var(--surface)',
        cursor: 'pointer',
        fontSize: '0.8125rem',
        boxSizing: 'border-box',
        color: 'var(--text)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>
          {money(Math.abs(Number(d.amount) || 0))}
        </div>
        <div style={{ color: 'var(--text-700)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
        <div style={{ color: 'var(--text-faint)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', marginTop: 1 }}>
          <span>{posted}</span>
          <KindBadgePill kind={d.kind} kindBadges={kindBadges} />
          {snippet ? <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>“{snippet}”</span> : null}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <ArStateChip state={state} bankReturn={d.bankReturn ?? null} />
        {consumed > CONSUMED_EPS && state !== 'applied' ? (
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {money(consumed)} applied · rem. {money(Number(d.remaining_available) || 0)}
          </span>
        ) : null}
        {canApply && markMode ? (
          <label
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', color: 'var(--text-600)', cursor: savingReturned ? 'wait' : 'pointer' }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={Boolean(d.returned)}
              disabled={savingReturned}
              onChange={(e) => {
                e.stopPropagation()
                onToggleReturned(e.target.checked)
              }}
              aria-label={`Returned: ${name !== '—' ? name : money(Math.abs(Number(d.amount) || 0))}`}
            />
            Returned
          </label>
        ) : null}
      </div>
    </button>
  )
}
