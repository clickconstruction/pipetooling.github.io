import { useState, type Dispatch } from 'react'
import { GC_COMPANY, type GcAction, type Partner, type PortalKey } from '../../lib/gcMode/gcModel'
import { Btn, input } from './gcUi'
import { PortalWindow } from './GcPortalUi'
import { usePortalLang } from './gcPortalLang'

/**
 * GC mode design spike: the master agreement a trade reads before signing it in the portal. The
 * terms are only the rules the prototype keeps, in plain words. The real build shows the Master
 * Subcontract Agreement from the contract library here.
 */

const TERMS: { title: PortalKey; body: PortalKey }[] = [
  { title: 'term1Title', body: 'term1' },
  { title: 'term2Title', body: 'term2' },
  { title: 'term3Title', body: 'term3' },
  { title: 'term4Title', body: 'term4' },
  { title: 'term5Title', body: 'term5' },
  { title: 'term6Title', body: 'term6' },
]

export function GcPortalAgreement({ partner, onClose, dispatch }: { partner: Partner; onClose: () => void; dispatch: Dispatch<GcAction> }) {
  const { t } = usePortalLang()
  const [name, setName] = useState('')
  const [agree, setAgree] = useState(false)
  const gc = GC_COMPANY.shortName

  return (
    <PortalWindow
      title={t('agreementTitle')}
      sub={t('between', { company: partner.company, gc: GC_COMPANY.name })}
      onClose={onClose}
      width={620}
      footer={
        <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
          <label style={{ display: 'grid', gap: '0.2rem' }}>
            {t('typeName')}
            <input style={input} value={name} placeholder={partner.contact} onChange={(e) => setName(e.target.value)} />
          </label>
          <label style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            {t('iAgree')}
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Btn
              kind="primary"
              disabled={!agree || name.trim() === ''}
              onClick={() => {
                dispatch({ type: 'tradeSignMsa', partnerId: partner.id })
                onClose()
              }}
            >
              {t('signMsa')}
            </Btn>
            <Btn kind="quiet" onClick={onClose}>{t('notNow')}</Btn>
          </div>
        </div>
      }
    >
      <div style={{ padding: '0.9rem', display: 'grid', gap: '0.75rem', fontSize: '0.92rem', lineHeight: 1.45 }}>
        <p style={{ margin: 0 }}>
          {t('msaIntro', { gc })}
        </p>
        {TERMS.map((term, i) => (
          <div key={term.title}>
            <div style={{ fontWeight: 700 }}>
              {i + 1}. {t(term.title)}
            </div>
            <div>{t(term.body, { gc })}</div>
          </div>
        ))}
        <div style={{ fontSize: '0.78rem', opacity: 0.7 }}>
          {t('protoAgreement')}
        </div>
      </div>
    </PortalWindow>
  )
}
