import { BILL_IN_KIND_CHOICE, BILL_MONEY_CHOICE, BILL_PICK_FIRST, billQuestionWords, type InKindBillAnswer } from '../../lib/inKind/inKindChip'
import { choiceBox } from './inKindStyles'

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
 */
export default function InKindBillQuestion({
  customerName,
  answer,
  onAnswer,
  disabled = false,
}: {
  customerName: string
  answer: InKindBillAnswer | null
  onAnswer: (next: InKindBillAnswer) => void
  disabled?: boolean
}) {
  const choices: Array<{ key: InKindBillAnswer; title: string; why: string }> = [
    { key: 'in_kind', ...BILL_IN_KIND_CHOICE },
    { key: 'money', ...BILL_MONEY_CHOICE },
  ]
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
    </div>
  )
}
