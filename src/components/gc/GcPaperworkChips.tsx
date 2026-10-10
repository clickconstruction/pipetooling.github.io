import type { ReactNode } from 'react'
import type { Partner } from '../../lib/gc/types'
import { daysUntil, shortDate } from '../../lib/gc/words'
import { useCompanyOpener } from './gcCompanyOpener'
import { Chip } from './gcUi'

/**
 * GC mode, the real build (the Board's B6-c-ii): a company's papers as three chips, the master agreement, insurance and
 * the W-9, from the design spike's `PaperworkChips` (`GcOfficeTabs.tsx`). Each opens the company's window at that paper
 * (the owner, 2026-10-04); plain where no window can open, like a portal. The spike's company-form chip waits for its
 * Documents row.
 */
export function PaperworkChips({ partner, today }: { partner: Partner; today: string }) {
  const coiOk = partner.coiExpires !== null && daysUntil(partner.coiExpires, today) >= 0
  const opener = useCompanyOpener()
  const wrap = (doc: string, label: string, chip: ReactNode) =>
    opener ? (
      <button
        type="button"
        onClick={() => opener.openPartner(partner.id, { tab: 'documents', doc })}
        title={`Open ${partner.company}: ${label}`}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}
      >
        {chip}
      </button>
    ) : (
      chip
    )
  return (
    <span data-gc-paperwork={partner.id} style={{ display: 'inline-flex', gap: '0.3rem', flexWrap: 'wrap' }}>
      {wrap(
        'msa',
        'the master agreement',
        <Chip tone={partner.msa === 'signed' ? 'green' : partner.msa === 'sent' ? 'amber' : 'red'}>
          {partner.msa === 'signed' ? 'Master agreement signed' : partner.msa === 'sent' ? 'Master agreement sent' : 'No master agreement'}
        </Chip>,
      )}
      {wrap(
        'insurance',
        'the insurance certificate',
        <Chip tone={coiOk ? 'green' : 'red'}>
          {partner.coiExpires ? (coiOk ? `Insured to ${shortDate(partner.coiExpires)}` : `Insurance expired ${shortDate(partner.coiExpires)}`) : 'No insurance on file'}
        </Chip>,
      )}
      {wrap('w9', 'the W-9', <Chip tone={partner.w9 ? 'green' : 'red'}>{partner.w9 ? 'W-9' : 'No W-9'}</Chip>)}
    </span>
  )
}
