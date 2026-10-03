import { money, shortDate, type TradeChange } from '../../lib/gcMode/gcModel'
import { Btn, Chip, type Tone } from './gcUi'

/**
 * GC mode design spike: change orders, the trade's side (Building lane). Under a trade's card on
 * Draws, each change order that belongs to it: waiting on the owner, ours to send to the trade as a
 * change to its statement of work, waiting on the trade's signature, or signed into it.
 */

const STATE_WORDS: Record<TradeChange['state'], { tone: Tone; word: string }> = {
  owner: { tone: 'grey', word: 'waiting on the owner' },
  toSend: { tone: 'amber', word: 'signed by the owner' },
  sent: { tone: 'blue', word: 'waiting on their signature' },
  signed: { tone: 'green', word: 'on their statement of work' },
}

export function GcBuildingTradeChanges({ changes, company, onSend }: { changes: TradeChange[]; company: string; onSend: (changeOrderId: string) => void }) {
  if (changes.length === 0) return null
  return (
    <div style={{ display: 'grid', gap: '0.3rem', fontSize: '0.85rem', paddingTop: '0.4rem', borderTop: '1px solid var(--border)' }}>
      {changes.map(({ co, state }) => (
        <div key={co.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>Change order {co.number}</strong>
          <span>{co.description}</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{co.cost < 0 ? `a credit of ${money(-co.cost)}` : money(co.cost)}</span>
          <Chip tone={STATE_WORDS[state].tone}>{STATE_WORDS[state].word}</Chip>
          {state === 'toSend' && (
            <Btn kind="primary" onClick={() => onSend(co.id)}>
              Send the change to {company}
            </Btn>
          )}
          {state === 'sent' && co.tradeChange && <span style={{ color: 'var(--text-muted)' }}>sent {shortDate(co.tradeChange.sentOn)}</span>}
          {state === 'signed' && co.tradeChange?.signedOn && <span style={{ color: 'var(--text-muted)' }}>signed {shortDate(co.tradeChange.signedOn)}</span>}
        </div>
      ))}
    </div>
  )
}
