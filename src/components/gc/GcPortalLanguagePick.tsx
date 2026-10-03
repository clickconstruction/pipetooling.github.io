import type { Dispatch } from 'react'
import type { GcAction, Partner } from '../../lib/gcMode/gcModel'

/**
 * GC mode design spike (Portal lane, shown on the office's Trade partners): the office sets a
 * company's language, say when it asks for Spanish on a call. The same record the company's own
 * Español button sets: its portal opens in it and its messages go out in it.
 */
export function CompanyLanguagePick({ partner, dispatch }: { partner: Partner; dispatch: Dispatch<GcAction> }) {
  return (
    <label style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-600)' }}>
      Language
      <select
        value={partner.lang ?? 'en'}
        onChange={(e) => dispatch({ type: 'setPartnerLanguage', partnerId: partner.id, lang: e.target.value === 'es' ? 'es' : 'en' })}
        aria-label={`Language for ${partner.company}`}
        style={{ fontSize: '0.8rem', padding: '0.05rem 0.2rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'inherit' }}
      >
        <option value="en">English</option>
        <option value="es">Español</option>
      </select>
    </label>
  )
}
