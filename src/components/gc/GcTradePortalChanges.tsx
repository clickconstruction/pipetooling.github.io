import { useState } from 'react'
import { GC_COMPANY } from '../../lib/gc/company'
import { PORTAL_CHANGE_WHY, portalCanAskChange, portalChangeRequests } from '../../lib/gc/portal'
import type { ChangeOrderReason, GcProject, TradePackage } from '../../lib/gc/types'
import { HAIR } from '../../lib/portal/portalTheme'
import { Btn, Chip, input } from './gcUi'
import { usePortalLang } from './gcTradePortalLang'
import { usePress } from './gcTradePortalPress'
import { PortalFilePick } from './GcTradePortalFile'
import { portalFileUpload, type PickedFile } from '../../lib/gc/tradePortalFile'
import { PortalBlock } from './GcTradePortalUi'

/**
 * GC mode, the trade partner portal (P4b-ii): a company asks for a change to its work, from the design spike's
 * `GcPortalChanges.tsx`. It says what changed, why, what it asks and the working days it adds (`ask_change`). Below,
 * each change it asked for and where it stands: with the office, turned down, with the customer as a change order, and
 * its part of it, never our price to the customer. A photo or ticket goes by email until P5a's files. Only while the company holds
 * a signed statement of work on a job that is ours: `portalCanAskChange` holds that rule.
 */

const GC = GC_COMPANY.shortName
const PROBLEM = { color: 'var(--text-red-700)', fontSize: '0.8rem' } as const

export function GcTradePortalChanges({ project, pkg, partnerId }: { project: GcProject; pkg: TradePackage; partnerId: string }) {
  const { lang, t } = usePortalLang()
  const [asking, setAsking] = useState(false)
  if (!portalCanAskChange(project, pkg, partnerId)) return null
  const rows = portalChangeRequests(project, pkg, partnerId, lang)
  return (
    <PortalBlock title={t('crTitle', { trade: pkg.trade })}>
      <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
        {rows.length === 0 && !asking && <div style={{ opacity: 0.85 }}>{t('crHelp', { gc: GC })}</div>}
        {rows.map((row, i) => (
          <div key={row.request.id} style={{ display: 'grid', gap: '0.2rem', paddingTop: i === 0 ? 0 : '0.45rem', borderTop: i === 0 ? 'none' : `1px solid ${HAIR}` }}>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <strong>{row.request.description}</strong>
              <Chip tone={row.tone}>{row.chip}</Chip>
            </div>
            <span style={{ fontSize: '0.8rem', opacity: 0.75 }}>
              {row.why} · {row.asked}
            </span>
            <span style={{ fontSize: '0.85rem', color: row.tone === 'red' ? 'var(--text-red-700)' : row.tone === 'amber' ? 'var(--text-amber-800)' : undefined }}>{row.words}</span>
          </div>
        ))}
        {asking ? (
          <AskForm packageId={pkg.id} onDone={() => setAsking(false)} />
        ) : (
          <div style={{ borderTop: rows.length > 0 ? `1px solid ${HAIR}` : 'none', paddingTop: rows.length > 0 ? '0.45rem' : 0 }}>
            <Btn onClick={() => setAsking(true)}>{t('crAsk')}</Btn>
          </div>
        )}
      </div>
    </PortalBlock>
  )
}

/**
 * What changed, why, what it asks and the working days: a whole number, as the submit function takes it. Since P5a-1 a
 * photo or a ticket is picked here: it goes up first, into the job's Team only → From trades folder, and its link rides
 * with the change. A refused upload sends nothing, so what was typed stays.
 */
function AskForm({ packageId, onDone }: { packageId: string; onDone: () => void }) {
  const { t } = usePortalLang()
  const { busy, problem, runWithFile } = usePress()
  const [picked, setPicked] = useState<PickedFile | null>(null)
  const [description, setDescription] = useState('')
  const [reason, setReason] = useState<ChangeOrderReason>('field')
  const [amount, setAmount] = useState('')
  const [days, setDays] = useState('0')
  const asked = Number(amount.replace(/[$,\s]/g, ''))
  const dayCount = Number(days)
  const ready = description.trim() !== '' && Number.isFinite(asked) && asked > 0 && Number.isInteger(dayCount) && dayCount >= 0
  const label = { display: 'grid', gap: '0.2rem', fontSize: '0.85rem' } as const
  const field = { ...input, width: '100%', minWidth: 0, boxSizing: 'border-box' } as const
  return (
    <div style={{ display: 'grid', gap: '0.5rem', borderTop: `1px solid ${HAIR}`, paddingTop: '0.5rem' }}>
      <label style={label}>
        <strong>{t('crWhat')}</strong>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('crWhatHint')} rows={3} style={{ ...field, resize: 'vertical' }} />
      </label>
      <fieldset style={{ border: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.2rem', fontSize: '0.85rem' }}>
        <legend style={{ padding: 0, marginBottom: '0.2rem' }}>
          <strong>{t('crWhy')}</strong>
        </legend>
        {PORTAL_CHANGE_WHY.map((w) => (
          <label key={w.reason} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <input type="radio" name={`cr-why-${packageId}`} checked={reason === w.reason} onChange={() => setReason(w.reason)} />
            {t(w.key)}
          </label>
        ))}
      </fieldset>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))', gap: '0.5rem' }}>
        <label style={label}>
          <strong>{t('crAmount')}</strong>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="$" style={field} />
        </label>
        <label style={label}>
          <strong>{t('crDays')}</strong>
          <input type="number" min={0} step={1} value={days} onChange={(e) => setDays(e.target.value)} style={field} />
        </label>
      </div>
      <PortalFilePick label={t('crFile')} picked={picked} onPick={setPicked} disabled={busy} />
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Btn
          kind="primary"
          disabled={!ready || busy}
          onClick={() => {
            void runWithFile(portalFileUpload('change', packageId, picked), 'ask_change', (placed) => ({
              packageId,
              description: description.trim(),
              reason,
              amount: asked,
              days: dayCount,
              ...(placed ? { fileUrl: placed.url } : {}),
            })).then((ok) => ok && onDone())
          }}
        >
          {t('crSend', { gc: GC })}
        </Btn>
        <Btn kind="quiet" disabled={busy} onClick={onDone}>
          {t('notNow')}
        </Btn>
      </div>
      {problem && <span style={PROBLEM}>{problem}</span>}
    </div>
  )
}
