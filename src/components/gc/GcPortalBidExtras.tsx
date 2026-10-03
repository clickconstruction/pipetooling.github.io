import { useState } from 'react'
import { alternateWords, GC_COMPANY, GOOD_FOR_DAYS, type BidAlternate, type PortalLine, type ScopeItem } from '../../lib/gcMode/gcModel'
import { Btn, Chip, input } from './gcUi'
import { LineSheets } from './GcPortalLineSheets'

/**
 * GC mode design spike: the parts of a trade's bid form past the number itself. How long the
 * number is good for, alternates (another way to do the work, at a different price), the
 * company's own quote, and the short step that answers the lines the office could not read.
 */

const RULE = '#d9d2c3'

export function GoodForPicker({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  return (
    <label style={{ fontSize: '0.9rem', display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
      Your number is good for
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ ...input, width: 'auto' }}>
        {GOOD_FOR_DAYS.map((d) => (
          <option key={d} value={d}>
            {d} days
          </option>
        ))}
      </select>
    </label>
  )
}

export function AlternatesEditor({ value, onChange }: { value: BidAlternate[]; onChange: (next: BidAlternate[]) => void }) {
  const [label, setLabel] = useState('')
  const [sign, setSign] = useState<'adds' | 'takes off'>('adds')
  const [amount, setAmount] = useState('')
  const ready = label.trim() !== '' && Number(amount) > 0
  return (
    <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.9rem', borderTop: `1px solid ${RULE}`, paddingTop: '0.5rem' }}>
      <div>
        <strong>Alternates</strong> <span style={{ opacity: 0.75 }}>· another way to do the work, at a different price. You do not have to give one.</span>
      </div>
      {value.map((alt, i) => (
        <div key={`${alt.label}-${i}`} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 0 }}>{alternateWords(alt)}</span>
          <Btn kind="quiet" onClick={() => onChange(value.filter((_, j) => j !== i))}>
            Remove
          </Btn>
        </div>
      ))}
      <input style={input} placeholder="What is different, like LED high bays" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="What is different" />
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={sign} onChange={(e) => setSign(e.target.value as 'adds' | 'takes off')} style={{ ...input, width: 'auto' }} aria-label="Adds or takes off">
          <option value="adds">adds</option>
          <option value="takes off">takes off</option>
        </select>
        <input
          type="number"
          min={0}
          step={100}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ ...input, width: '8rem' }}
          aria-label="How much"
          placeholder="How much"
        />
        <Btn
          disabled={!ready}
          onClick={() => {
            onChange([...value, { label: label.trim(), amount: sign === 'adds' ? Number(amount) : -Number(amount) }])
            setLabel('')
            setAmount('')
          }}
        >
          Add it
        </Btn>
      </div>
    </div>
  )
}

export function QuoteFilePicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  return (
    <div style={{ display: 'grid', gap: '0.3rem', fontSize: '0.9rem', borderTop: `1px solid ${RULE}`, paddingTop: '0.5rem' }}>
      <div>
        <strong>Your own quote</strong> <span style={{ opacity: 0.75 }}>· attach it if you have one. Your number above is the one that counts.</span>
      </div>
      {value ? (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip tone="grey">{value}</Chip>
          <Btn kind="quiet" onClick={() => onChange('')}>
            Remove
          </Btn>
        </div>
      ) : (
        <input type="file" accept="application/pdf,image/*" aria-label="Your own quote" onChange={(e) => onChange(e.target.files?.[0]?.name ?? '')} />
      )}
    </div>
  )
}

/** The lines the office could not read, each answered in the number or left out. The number stays as sent. */
export function AnswerLines({
  items,
  lineOf,
  onOpenSheet,
  onSend,
  onCancel,
}: {
  items: ScopeItem[]
  lineOf: (id: string) => PortalLine | undefined
  onOpenSheet: (sheetId: string) => void
  onSend: (answers: Record<string, 'yes' | 'no'>) => void
  onCancel: () => void
}) {
  const [answers, setAnswers] = useState<Record<string, 'yes' | 'no'>>({})
  const done = items.every((item) => answers[item.id] !== undefined)
  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <div>{GC_COMPANY.shortName} cannot tell if your number covers these. Your number stays as you sent it.</div>
      {items.map((item) => (
        <div key={item.id} style={{ display: 'grid', gap: '0.3rem' }}>
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <strong>{item.label}</strong>
            <LineSheets line={lineOf(item.id)} onOpen={onOpenSheet} />
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <Btn kind={answers[item.id] === 'yes' ? 'primary' : 'plain'} onClick={() => setAnswers({ ...answers, [item.id]: 'yes' })}>
              It is in my number
            </Btn>
            <Btn kind={answers[item.id] === 'no' ? 'primary' : 'plain'} onClick={() => setAnswers({ ...answers, [item.id]: 'no' })}>
              It is left out
            </Btn>
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Btn kind="primary" disabled={!done} onClick={() => onSend(answers)}>
          Send my answer
        </Btn>
        <Btn kind="quiet" onClick={onCancel}>
          Not now
        </Btn>
      </div>
    </div>
  )
}
