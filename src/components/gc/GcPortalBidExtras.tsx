import { useState } from 'react'
import {
  alternateWords,
  claimedToDate,
  GC_COMPANY,
  GOOD_FOR_DAYS,
  money,
  portalLeavesOut,
  portalSovCheck,
  portalSovReached,
  portalSovStart,
  type BidAlternate,
  type PortalLine,
  type ScopeItem,
  type Sow,
  type TheirSovLine,
  type TradePackage,
} from '../../lib/gcMode/gcModel'
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

/** A schedule of values as the company types it: a name and an amount, the amount still text. */
export type SovDraft = { label: string; amount: string }[]

/**
 * The company's own schedule of values (owner, 2026-10-04, question 4): lines it can rename, add or
 * take out, and where their total stands against the number they must add up to.
 */
export function SovEditor({ value, onChange, target, help }: { value: SovDraft; onChange: (next: SovDraft) => void; target: number; help: string }) {
  const { lang, t } = usePortalLang()
  const check = portalSovCheck(
    value.map((l) => ({ label: l.label, amount: Number(l.amount) || 0 })),
    target,
    lang,
  )
  const set = (i: number, patch: Partial<SovDraft[number]>) => onChange(value.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  return (
    <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.9rem', borderTop: `1px solid ${RULE}`, paddingTop: '0.5rem' }}>
      <div>
        <strong>{t('sovTitle')}</strong> <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>· {help}</span>
      </div>
      {value.map((l, i) => (
        <div key={i} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input style={{ ...input, flex: '1 1 9rem', minWidth: 0 }} value={l.label} aria-label={t('sovLineAria')} onChange={(e) => set(i, { label: e.target.value })} />
          <input
            style={{ ...input, width: '7.5rem' }}
            type="number"
            min={0}
            step={100}
            inputMode="numeric"
            value={l.amount}
            aria-label={t('sovAmountAria')}
            onChange={(e) => set(i, { amount: e.target.value })}
          />
          <Btn kind="quiet" onClick={() => onChange(value.filter((_, j) => j !== i))}>
            {t('remove')}
          </Btn>
        </div>
      ))}
      <div>
        <Btn kind="quiet" onClick={() => onChange([...value, { label: '', amount: '' }])}>
          {t('sovAdd')}
        </Btn>
      </div>
      {check.words && (
        <div style={{ fontSize: '0.85rem', fontWeight: check.state === 'ok' ? 400 : 600, color: check.state === 'ok' ? undefined : 'var(--text-red-700)' }}>{check.words}</div>
      )}
    </div>
  )
}

/**
 * On an awarded statement of work: the company's own schedule of values. None yet: Send your
 * schedule of values, adding up to the price. Sent: its lines, and how far its billing reaches on
 * them, so both sides read the same draw on their own lines (owner, 2026-10-04, question 4).
 */
export function TheirSovOnSow({ sow, onSend }: { sow: Sow; onSend: (lines: TheirSovLine[]) => void }) {
  const { lang, t } = usePortalLang()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<SovDraft>(() => portalSovStart(lang).map((label) => ({ label, amount: '' })))
  const lines = sow.theirSov ?? []
  if (lines.length > 0) {
    return (
      <div style={{ display: 'grid', gap: '0.15rem', borderTop: `1px solid ${RULE}`, paddingTop: '0.4rem' }}>
        <strong>{t('sovTitle')}</strong>
        <span style={{ opacity: 0.8 }}>{lines.map((l) => `${l.label} ${money(l.amount)}`).join(' · ')}</span>
        <span style={{ fontSize: '0.85rem' }}>{portalSovReached(lines, claimedToDate(sow), lang)}</span>
      </div>
    )
  }
  if (!open) {
    return (
      <div>
        <Btn onClick={() => setOpen(true)}>{t('sovSendBtn')}</Btn>
      </div>
    )
  }
  const check = portalSovCheck(
    draft.map((l) => ({ label: l.label, amount: Number(l.amount) || 0 })),
    sow.price,
    lang,
  )
  return (
    <div style={{ display: 'grid', gap: '0.4rem' }}>
      <SovEditor value={draft} onChange={setDraft} target={sow.price} help={t('sovSowHelp', { gc: GC_COMPANY.shortName, amount: money(sow.price) })} />
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Btn kind="primary" disabled={check.state !== 'ok'} onClick={() => onSend(check.lines)}>
          {t('sendTo', { gc: GC_COMPANY.shortName })}
        </Btn>
        <Btn kind="quiet" onClick={() => setOpen(false)}>
          {t('notNow')}
        </Btn>
      </div>
    </div>
  )
}
