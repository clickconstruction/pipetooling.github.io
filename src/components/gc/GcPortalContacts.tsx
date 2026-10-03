import { GC_COMPANY, portalContacts, type GcProject } from '../../lib/gcMode/gcModel'
import { PortalBlock } from './GcPortalUi'
import { usePortalLang } from './gcPortalLang'

/**
 * GC mode design spike: who to call, on a job page in the trade's portal. Our superintendent on
 * site and the project manager (while we bid, the project manager alone), then pay and paperwork.
 * Each with a link to call, text or email. The people and numbers are made up.
 */

const LINK = { color: 'var(--text-blue-500)', fontSize: '0.85rem', textDecoration: 'none' } as const

function digits(phone: string): string {
  return phone.replace(/[^\d+]/g, '')
}

export function GcPortalContacts({ project }: { project: GcProject }) {
  const { t } = usePortalLang()
  const { team, bidding } = portalContacts(project)
  const pay = GC_COMPANY.pay
  const rows = [
    ...team.map((c) => ({
      key: `${c.role}:${c.name}`,
      name: c.name,
      role: c.role === 'superintendent' ? t('roleSuper') : bidding ? t('rolePmBid') : t('rolePm'),
      phone: c.phone,
      email: c.email,
      text: c.role === 'superintendent',
    })),
    { key: 'pay', name: pay.name, role: t('rolePay'), phone: pay.phone, email: pay.email, text: false },
  ]

  return (
    <PortalBlock title={t('whoToCall')}>
      <div style={{ display: 'grid', gap: '0.45rem', fontSize: '0.9rem' }}>
        {rows.map((r) => (
          <div key={r.key} style={{ display: 'grid', gap: '0.1rem' }}>
            <div>
              <strong>{r.name}</strong> <span style={{ opacity: 0.75 }}>· {r.role}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.phone}</span>
              <a href={`tel:${digits(r.phone)}`} style={LINK}>
                {t('callLink')}
              </a>
              {r.text && (
                <a href={`sms:${digits(r.phone)}`} style={LINK}>
                  {t('textLink')}
                </a>
              )}
              {r.email && (
                <a href={`mailto:${r.email}`} style={LINK}>
                  {t('emailLink')}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </PortalBlock>
  )
}
