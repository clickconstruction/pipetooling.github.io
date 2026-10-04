import { useState } from 'react'
import { alternateWords, GC_COMPANY, GOOD_FOR_DAYS, portalLeavesOut, type BidAlternate, type PortalLine, type ScopeItem, type TradePackage } from '../../lib/gcMode/gcModel'
import { Btn, Chip, input } from './gcUi'
import { LineSheets } from './GcPortalLineSheets'
import { usePortalLang } from './gcPortalLang'

/**
 * GC mode design spike: the parts of a trade's bid form past the number itself. How long the
 * number is good for, alternates (another way to do the work, at a different price), the
 * company's own quote, and the short step that answers the lines the office could not read.
 */

const RULE = '#d9d2c3'

export function GoodForPicker({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  const { t } = usePortalLang()
  return (
    <label style={{ fontSize: '0.9rem', display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
      {t('goodFor')}
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ ...input, width: 'auto' }}>
        {GOOD_FOR_DAYS.map((d) => (
          <option key={d} value={d}>
            {t('daysN', { n: d })}
          </option>
        ))}
      </select>
    </label>
  )
}

export function AlternatesEditor({ value, onChange }: { value: BidAlternate[]; onChange: (next: BidAlternate[]) => void }) {
  const { lang, t } = usePortalLang()
  const [label, setLabel] = useState('')
  const [sign, setSign] = useState<'adds' | 'takes off'>('adds')
  const [amount, setAmount] = useState('')
  const ready = label.trim() !== '' && Number(amount) > 0
  return (
    <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.9rem', borderTop: `1px solid ${RULE}`, paddingTop: '0.5rem' }}>
      <div>
        <strong>{t('alternatesTitle')}</strong> <span style={{ opacity: 0.75 }}>{t('alternatesHelp')}</span>
      </div>
      {value.map((alt, i) => (
        <div key={`${alt.label}-${i}`} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 0 }}>{alternateWords(alt, lang)}</span>
          <Btn kind="quiet" onClick={() => onChange(value.filter((_, j) => j !== i))}>
            {t('remove')}
          </Btn>
        </div>
      ))}
      <input style={input} placeholder={t('altPlaceholder')} value={label} onChange={(e) => setLabel(e.target.value)} aria-label={t('altWhat')} />
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={sign} onChange={(e) => setSign(e.target.value as 'adds' | 'takes off')} style={{ ...input, width: 'auto' }} aria-label={t('addsOrTakes')}>
          <option value="adds">{t('adds')}</option>
          <option value="takes off">{t('takesOff')}</option>
        </select>
        <input
          type="number"
          min={0}
          step={100}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ ...input, width: '8rem' }}
          aria-label={t('howMuch')}
          placeholder={t('howMuch')}
        />
        <Btn
          disabled={!ready}
          onClick={() => {
            onChange([...value, { label: label.trim(), amount: sign === 'adds' ? Number(amount) : -Number(amount) }])
            setLabel('')
            setAmount('')
          }}
        >
          {t('addIt')}
        </Btn>
      </div>
    </div>
  )
}

export function QuoteFilePicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const { t } = usePortalLang()
  return (
    <div style={{ display: 'grid', gap: '0.3rem', fontSize: '0.9rem', borderTop: `1px solid ${RULE}`, paddingTop: '0.5rem' }}>
      <div>
        <strong>{t('ownQuoteTitle')}</strong> <span style={{ opacity: 0.75 }}>{t('ownQuoteHelp')}</span>
      </div>
      {value ? (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip tone="grey">{value}</Chip>
          <Btn kind="quiet" onClick={() => onChange('')}>
            {t('remove')}
          </Btn>
        </div>
      ) : (
        // A bare file input will not shrink below about 300px, wider than a phone's form.
        <input
          type="file"
          accept="application/pdf,image/*"
          aria-label={t('ownQuoteTitle')}
          onChange={(e) => onChange(e.target.files?.[0]?.name ?? '')}
          style={{ width: '100%', minWidth: 0, fontSize: '0.85rem' }}
        />
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
  const { t } = usePortalLang()
  const [answers, setAnswers] = useState<Record<string, 'yes' | 'no'>>({})
  const done = items.every((item) => answers[item.id] !== undefined)
  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <div>{t('answerIntro', { gc: GC_COMPANY.shortName })}</div>
      {items.map((item) => (
        <div key={item.id} style={{ display: 'grid', gap: '0.3rem' }}>
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <strong>{item.label}</strong>
            <LineSheets line={lineOf(item.id)} onOpen={onOpenSheet} />
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <Btn kind={answers[item.id] === 'yes' ? 'primary' : 'plain'} onClick={() => setAnswers({ ...answers, [item.id]: 'yes' })}>
              {t('inMyNumber')}
            </Btn>
            <Btn kind={answers[item.id] === 'no' ? 'primary' : 'plain'} onClick={() => setAnswers({ ...answers, [item.id]: 'no' })}>
              {t('leftOut')}
            </Btn>
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Btn kind="primary" disabled={!done} onClick={() => onSend(answers)}>
          {t('sendAnswer')}
        </Btn>
        <Btn kind="quiet" onClick={onCancel}>
          {t('notNow')}
        </Btn>
      </div>
    </div>
  )
}

/** What the number leaves out and who does it instead, under the lines it covers. Nothing on older projects. */
export function LeavesOut({ pkg }: { pkg: TradePackage }) {
  const { lang, t } = usePortalLang()
  const lines = portalLeavesOut(pkg, lang)
  if (lines.length === 0) return null
  return (
    <div style={{ display: 'grid', gap: '0.25rem', fontSize: '0.9rem', borderTop: `1px solid ${RULE}`, paddingTop: '0.5rem' }}>
      <strong>{t('leavesOutTitle')}</strong>
      <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>{t('leavesOutHelp')}</span>
      <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'grid', gap: '0.1rem' }}>
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  )
}
