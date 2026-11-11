import { Link } from 'react-router-dom'
import {
  BILL_IN_KIND_CHOICE,
  BILL_IN_KIND_CHOICE_MANY,
  BILL_MONEY_CHOICE,
  BILL_PICK_FIRST,
  JOB_PICK_DEAL_PRESS,
  billPickDealWords,
  billQuestionWords,
  type InKindBillAnswer,
} from '../../lib/inKind/inKindChip'
import { choiceBox, linePress, noteStrip } from './inKindStyles'

const dot = (on: boolean) => ({
  flex: '0 0 auto',
  width: 16,
  height: 16,
  borderRadius: '50%',
  marginTop: 2,
  border: on ? '5px solid #2563eb' : '2px solid var(--border-strong)',
  background: 'var(--surface)',
  boxSizing: 'border-box' as const,
})

/**
 * Bill Customer's one question for a customer who pays in kind (punch list #301, mock-up 2): is this bill paid in
 * kind, on the arrangement, or with money? Nothing is picked for the person. A bill sent as money by default chases
 * a customer who owes none, and a bill put on the deal by default is never chased when it should be.
 *
 * With more than one open deal (`pickDealHref`) the In kind answer cannot record here, since a person has to pick
 * the deal. It says so and opens the customer's page, as the job's strip does.
 */
export default function InKindBillQuestion({
  customerName,
  answer,
  onAnswer,
  disabled = false,
  pickDealHref = null,
  onPickDeal,
}: {
  customerName: string
  answer: InKindBillAnswer | null
  onAnswer: (next: InKindBillAnswer) => void
  disabled?: boolean
  /** The customer's page, set when the customer has more than one open deal. */
  pickDealHref?: string | null
  /** The person left for the customer's page: the window closes behind them. */
  onPickDeal?: () => void
}) {
  const choices: Array<{ key: InKindBillAnswer; title: string; why: string }> = [
    { key: 'in_kind', ...(pickDealHref ? BILL_IN_KIND_CHOICE_MANY : BILL_IN_KIND_CHOICE) },
    { key: 'money', ...BILL_MONEY_CHOICE },
  ]
  const pick = billPickDealWords(customerName)
  return (
    <div role="radiogroup" aria-label={billQuestionWords(customerName)} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1rem' }} data-testid="in-kind-bill-question">
      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)' }}>{billQuestionWords(customerName)}</div>
      {choices.map((c) => (
        <button key={c.key} type="button" role="radio" aria-checked={answer === c.key} disabled={disabled} onClick={() => onAnswer(c.key)} style={choiceBox(answer === c.key)} data-testid={`in-kind-bill-${c.key}`}>
          <span aria-hidden="true" style={dot(answer === c.key)} />
          <span>
            <span style={{ display: 'block', fontWeight: 700, color: 'var(--text-strong)' }}>{c.title}</span>
            <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.why}</span>
          </span>
        </button>
      ))}
      {answer == null ? <div style={{ fontSize: '0.8rem', color: 'var(--text-amber-800)' }}>{BILL_PICK_FIRST}</div> : null}
      {pickDealHref && answer === 'in_kind' ? (
        <div style={{ ...noteStrip, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }} data-testid="in-kind-bill-pick-deal">
          <span style={{ flex: '1 1 260px', minWidth: 0 }}>
            <b style={{ color: 'var(--text-strong)' }}>{pick.lead}</b> {pick.rest}
          </span>
          <Link to={pickDealHref} onClick={onPickDeal} style={{ ...linePress, textDecoration: 'none' }}>
            {JOB_PICK_DEAL_PRESS}
          </Link>
        </div>
      ) : null}
    </div>
  )
}
