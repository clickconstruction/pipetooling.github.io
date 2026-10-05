import { useState, type Dispatch } from 'react'
import {
  GC_COMPANY,
  PORTAL_CHANGE_WHY,
  portalCanAskChange,
  portalChangeRequests,
  type ChangeOrderReason,
  type GcAction,
  type GcProject,
  type TradePackage,
} from '../../lib/gcMode/gcModel'
import { Btn, Chip, input } from './gcUi'
import { PortalBlock } from './GcPortalUi'
import { usePortalLang } from './gcPortalLang'

/**
 * GC mode design spike: a trade asks for a change to its work, from its job page (owner,
 * 2026-10-04). It says what changed, why, what it asks and the days it adds, with a photo or ticket
 * if it has one. Below, each change it asked for and where it stands: with the office, turned down,
 * with the customer as a change order, and its signature once the customer says yes. It sees its
 * own part, never our price to the customer.
 */

const GC = GC_COMPANY.shortName
const RULE = '#d9d2c3'

export function GcPortalChanges({ project, pkg, partnerId, dispatch }: { project: GcProject; pkg: TradePackage; partnerId: string; dispatch: Dispatch<GcAction> }) {
  const { lang, t } = usePortalLang()
  const [asking, setAsking] = useState(false)
  if (!portalCanAskChange(project, pkg, partnerId)) return null
  const rows = portalChangeRequests(project, pkg, partnerId, lang)
  return (
    <PortalBlock title={t('crTitle', { trade: pkg.trade })}>
      <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
        {rows.length === 0 && !asking && <div style={{ opacity: 0.85 }}>{t('crHelp', { gc: GC })}</div>}
        {rows.map((row, i) => (
          <div key={row.request.id} style={{ display: 'grid', gap: '0.2rem', paddingTop: i === 0 ? 0 : '0.45rem', borderTop: i === 0 ? 'none' : `1px solid ${RULE}` }}>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <strong>{row.request.description}</strong>
              <Chip tone={row.tone}>{row.chip}</Chip>
            </div>
            <span style={{ fontSize: '0.8rem', opacity: 0.75 }}>
              {row.why} · {row.asked}
              {row.request.file ? ` · ${row.request.file}` : ''}
            </span>
            <span style={{ fontSize: '0.85rem', color: row.tone === 'red' ? 'var(--text-red-700)' : row.tone === 'amber' ? 'var(--text-amber-800)' : undefined }}>{row.words}</span>
          </div>
        ))}
        {asking ? (
          <AskForm
            onSend={(form) => {
              dispatch({ type: 'tradeAskChange', projectId: project.id, packageId: pkg.id, partnerId, ...form })
              setAsking(false)
            }}
            onCancel={() => setAsking(false)}
          />
        ) : (
          <div style={{ borderTop: rows.length > 0 ? `1px solid ${RULE}` : 'none', paddingTop: rows.length > 0 ? '0.45rem' : 0 }}>
            <Btn onClick={() => setAsking(true)}>{t('crAsk')}</Btn>
          </div>
        )}
      </div>
    </PortalBlock>
  )
}

interface AskDraft {
  description: string
  reason: ChangeOrderReason
  amount: number
  days: number
  file: string | null
}

function AskForm({ onSend, onCancel }: { onSend: (form: AskDraft) => void; onCancel: () => void }) {
  const { t } = usePortalLang()
  const [description, setDescription] = useState('')
  const [reason, setReason] = useState<ChangeOrderReason>('field')
  const [amount, setAmount] = useState('')
  const [days, setDays] = useState('0')
  const [file, setFile] = useState('')
  const asked = Number(amount.replace(/[$,\s]/g, ''))
  const dayCount = Number(days)
  const ready = description.trim() !== '' && Number.isFinite(asked) && asked > 0 && Number.isFinite(dayCount) && dayCount >= 0
  const label = { display: 'grid', gap: '0.2rem', fontSize: '0.85rem' } as const
  const field = { ...input, width: '100%', minWidth: 0, boxSizing: 'border-box' } as const
  return (
    <div style={{ display: 'grid', gap: '0.5rem', borderTop: `1px solid ${RULE}`, paddingTop: '0.5rem' }}>
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
            <input type="radio" name="cr-why" checked={reason === w.reason} onChange={() => setReason(w.reason)} />
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
          <input type="number" min={0} value={days} onChange={(e) => setDays(e.target.value)} style={field} />
        </label>
      </div>
      <label style={label}>
        <strong>{t('crFile')}</strong>
        {file ? (
          <span style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip tone="grey">{file}</Chip>
            <Btn kind="quiet" onClick={() => setFile('')}>
              {t('remove')}
            </Btn>
          </span>
        ) : (
          // A bare file input will not shrink below about 300px, wider than a phone's form.
          <input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0]?.name ?? '')} style={{ width: '100%', minWidth: 0 }} />
        )}
      </label>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Btn kind="primary" disabled={!ready} onClick={() => onSend({ description: description.trim(), reason, amount: asked, days: dayCount, file: file || null })}>
          {t('crSend', { gc: GC })}
        </Btn>
        <Btn kind="quiet" onClick={onCancel}>
          {t('notNow')}
        </Btn>
      </div>
    </div>
  )
}
