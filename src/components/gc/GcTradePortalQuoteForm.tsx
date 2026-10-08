import { useState } from 'react'
import { GC_COMPANY } from '../../lib/gc/company'
import { exclusionName, exclusionsFor } from '../../lib/gc/exclusions'
import { alternateWords, GOOD_FOR_DAYS, portalSovCheck, portalSovStart } from '../../lib/gc/portal'
import { pExclusion, type PortalLang } from '../../lib/gc/portalI18n'
import type { BidAlternate, Includes, Invite, QuoteExclusion, TradePackage } from '../../lib/gc/types'
import { HAIR } from '../../lib/portal/portalTheme'
import { Btn, input } from './gcUi'
import { usePortalLang } from './gcTradePortalLang'
import { usePress } from './gcTradePortalPress'

/**
 * GC mode, the trade partner portal's quote form (P2b-ii), from the design spike's BidBlock in `GcTradePortal.tsx` and
 * `GcPortalBidExtras.tsx`: the number, a tick for each scope line, how long it is good for, a note, their own
 * schedule of values, alternates, and what it leaves out. Their own quote file waits for P5a (decision 9), so the
 * form says to email it. It posts `submit_quote`; the SQL (`gc_trade_submit_quote`) holds the same rules.
 */

const PROBLEM = { color: 'var(--text-red-700)', fontSize: '0.8rem' } as const
const SECTION = { display: 'grid', gap: '0.35rem', fontSize: '0.9rem', borderTop: `1px solid ${HAIR}`, paddingTop: '0.5rem' } as const

type SovDraft = { label: string; amount: string }[]
type ExclusionDraft = { name: string; said?: string; on: boolean; amount: string; unit: string }[]

export function QuoteForm({ pkg, invite, notVetted, onDone }: { pkg: TradePackage; invite: Invite; notVetted: boolean; onDone: () => void }) {
  const { lang, t } = usePortalLang()
  const { busy, problem, run } = usePress()
  const was = invite.bid
  const [amount, setAmount] = useState(was ? String(was.amount) : '')
  const [note, setNote] = useState(was?.note ?? '')
  const [includes, setIncludes] = useState<Record<string, Includes>>(() => Object.fromEntries(pkg.scope.map((item) => [item.id, was?.includes[item.id] === 'no' ? 'no' : 'yes'])))
  const [goodFor, setGoodFor] = useState(was?.goodForDays ?? 30)
  const [alternates, setAlternates] = useState<BidAlternate[]>(was?.alternates ?? [])
  // Their own schedule of values (question 4): the stages to start, or what they sent before.
  const [sov, setSov] = useState<SovDraft>(() => was?.sov?.map((l) => ({ label: l.label, amount: String(l.amount) })) ?? portalSovStart(lang).map((label) => ({ label, amount: '' })))
  const sovCheck = portalSovCheck(sov.map((l) => ({ label: l.label, amount: Number(l.amount) || 0 })), Number(amount) || 0, lang)
  const sovBad = sovCheck.state === 'short' || sovCheck.state === 'over'
  // What it leaves out: every usual exclusion for the trade as a tick, ticked when its last quote left it out, then any it typed.
  const [exRows, setExRows] = useState<ExclusionDraft>(() => {
    const before = was?.exclusions ?? []
    const choices = exclusionsFor(pkg.trade)
    const rows: ExclusionDraft = choices.map((name) => {
      const e = before.find((x) => exclusionName(x.name) === name)
      return { name, on: Boolean(e), amount: e?.unitPrice ? String(e.unitPrice.amount) : '', unit: e?.unitPrice?.unit ?? '' }
    })
    for (const e of before) if (!choices.includes(exclusionName(e.name))) rows.push({ name: e.name, said: e.said ?? e.name, on: true, amount: e.unitPrice ? String(e.unitPrice.amount) : '', unit: e.unitPrice?.unit ?? '' })
    return rows
  })
  const opened = invite.seenRev !== null
  const ready = opened && Number(amount) > 0 && !sovBad
  const send = async () => {
    const exclusions: QuoteExclusion[] = exRows
      .filter((r) => r.on)
      .map((r) => {
        const name = exclusionName(r.said ?? r.name)
        const price = Number(r.amount)
        return { name, ...(r.said && r.said !== name ? { said: r.said } : {}), ...(price > 0 && r.unit.trim() !== '' ? { unitPrice: { amount: price, unit: r.unit.trim() } } : {}) }
      })
    const quote = {
      amount: Number(amount),
      includes,
      note: note.trim(),
      goodForDays: goodFor,
      alternates,
      ...(sovCheck.state === 'ok' ? { sov: sovCheck.lines } : {}),
      ...(exRows.length > 0 ? { exclusions, exclusionsAnswered: [...new Set(exRows.map((r) => exclusionName(r.said ?? r.name)))] } : {}),
    }
    if (await run('submit_quote', { inviteId: invite.id, quote })) onDone()
  }
  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>{t('quoteTickHelp')}</div>
      {pkg.scope.map((item) => (
        <label key={item.id} style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', fontSize: '0.9rem', minHeight: 32 }}>
          <input type="checkbox" checked={includes[item.id] === 'yes'} onChange={(e) => setIncludes({ ...includes, [item.id]: e.target.checked ? 'yes' : 'no' })} />
          {item.label}
        </label>
      ))}
      <ExclusionsEditor value={exRows} onChange={setExRows} />
      <label style={{ fontSize: '0.9rem', display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', borderTop: `1px solid ${HAIR}`, paddingTop: '0.5rem' }}>
        {t('yourNumber')}
        <input type="number" min={0} step={100} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ ...input, width: '9rem' }} />
      </label>
      <label style={{ fontSize: '0.9rem', display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {t('goodFor')}
        <select value={goodFor} onChange={(e) => setGoodFor(Number(e.target.value))} style={{ ...input, width: 'auto' }}>
          {GOOD_FOR_DAYS.map((d) => (
            <option key={d} value={d}>
              {t('daysN', { n: d })}
            </option>
          ))}
        </select>
      </label>
      <input style={{ ...input, width: '100%', boxSizing: 'border-box' }} placeholder={t('anythingKnow')} aria-label={t('anythingKnow')} value={note} onChange={(e) => setNote(e.target.value)} />
      <SovEditor value={sov} onChange={setSov} words={sovCheck.words} bad={sovBad} help={t('sovHelp')} />
      <AlternatesEditor value={alternates} onChange={setAlternates} lang={lang} />
      {notVetted && <div style={{ fontSize: '0.85rem', opacity: 0.85 }}>{t('vetBidNote', { gc: GC_COMPANY.shortName })}</div>}
      {problem && <div style={PROBLEM}>{problem}</div>}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <Btn kind="primary" disabled={!ready || busy} title={!opened ? t('openFirst') : sovBad ? t('sovMustAdd') : undefined} onClick={() => void send()}>
          {t(was ? 'sendNew' : 'sendBid')}
        </Btn>
        {was && (
          <Btn kind="quiet" disabled={busy} onClick={onDone}>
            {t('keepBid')}
          </Btn>
        )}
        {!opened && <span style={PROBLEM}>{t('openFirst')}</span>}
      </div>
    </div>
  )
}

function SovEditor({ value, onChange, words, bad, help }: { value: SovDraft; onChange: (next: SovDraft) => void; words: string | null; bad: boolean; help: string }) {
  const { t } = usePortalLang()
  const set = (i: number, patch: Partial<SovDraft[number]>) => onChange(value.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  return (
    <div style={SECTION}>
      <div>
        <strong>{t('sovTitle')}</strong> <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>· {help}</span>
      </div>
      {value.map((l, i) => (
        <div key={i} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input style={{ ...input, flex: '1 1 9rem', minWidth: 0 }} value={l.label} aria-label={t('sovLineAria')} onChange={(e) => set(i, { label: e.target.value })} />
          <input style={{ ...input, width: '7.5rem' }} type="number" min={0} step={100} inputMode="numeric" value={l.amount} aria-label={t('sovAmountAria')} onChange={(e) => set(i, { amount: e.target.value })} />
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
      {words && <div style={{ fontSize: '0.85rem', fontWeight: bad ? 600 : 400, color: bad ? 'var(--text-red-700)' : undefined }}>{words}</div>}
    </div>
  )
}

function AlternatesEditor({ value, onChange, lang }: { value: BidAlternate[]; onChange: (next: BidAlternate[]) => void; lang: PortalLang }) {
  const { t } = usePortalLang()
  const [label, setLabel] = useState('')
  const [sign, setSign] = useState<'adds' | 'takes off'>('adds')
  const [amount, setAmount] = useState('')
  const ready = label.trim() !== '' && Number(amount) > 0
  return (
    <div style={SECTION}>
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
      <input style={{ ...input, width: '100%', boxSizing: 'border-box' }} placeholder={t('altPlaceholder')} value={label} onChange={(e) => setLabel(e.target.value)} aria-label={t('altWhat')} />
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={sign} onChange={(e) => setSign(e.target.value as 'adds' | 'takes off')} style={{ ...input, width: 'auto' }} aria-label={t('addsOrTakes')}>
          <option value="adds">{t('adds')}</option>
          <option value="takes off">{t('takesOff')}</option>
        </select>
        <input type="number" min={0} step={100} value={amount} onChange={(e) => setAmount(e.target.value)} style={{ ...input, width: '8rem' }} aria-label={t('howMuch')} placeholder={t('howMuch')} />
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

function ExclusionsEditor({ value, onChange }: { value: ExclusionDraft; onChange: (next: ExclusionDraft) => void }) {
  const { lang, t } = usePortalLang()
  const [other, setOther] = useState('')
  const set = (i: number, patch: Partial<ExclusionDraft[number]>) => onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  return (
    <div style={SECTION}>
      <div>
        <strong>{t('exTitle')}</strong> <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>· {t('exHelp')}</span>
      </div>
      {value.map((r, i) => (
        <div key={`${r.name}:${i}`} style={{ display: 'grid', gap: '0.2rem' }}>
          <label style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', minHeight: 32 }}>
            <input type="checkbox" checked={r.on} onChange={(e) => set(i, { on: e.target.checked })} />
            {r.said ?? pExclusion(lang, r.name)}
          </label>
          {r.on && (
            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexWrap: 'wrap', paddingLeft: '1.45rem', fontSize: '0.85rem' }}>
              <span style={{ opacity: 0.8 }}>{t('exIfComes')}</span>
              <input style={{ ...input, width: '6rem' }} type="number" min={0} inputMode="decimal" placeholder="$" aria-label={t('exPriceAria')} value={r.amount} onChange={(e) => set(i, { amount: e.target.value })} />
              <span style={{ opacity: 0.8 }}>{t('exPer')}</span>
              <input style={{ ...input, width: '4.5rem' }} placeholder="cy" aria-label={t('exUnitAria')} value={r.unit} onChange={(e) => set(i, { unit: e.target.value })} />
            </div>
          )}
        </div>
      ))}
      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input style={{ ...input, flex: '1 1 10rem', minWidth: 0 }} placeholder={t('exOther')} aria-label={t('exOther')} value={other} onChange={(e) => setOther(e.target.value)} />
        <Btn
          kind="quiet"
          disabled={other.trim() === ''}
          onClick={() => {
            onChange([...value, { name: other.trim(), said: other.trim(), on: true, amount: '', unit: '' }])
            setOther('')
          }}
        >
          {t('addIt')}
        </Btn>
      </div>
    </div>
  )
}
