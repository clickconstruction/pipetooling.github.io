import { linkNeverOpened, shortDate, type GcState } from '../../lib/gcMode/gcModel'
import { Chip } from './gcUi'

/**
 * GC mode design spike (Portal lane, shown on the office's screens): a company we asked that has
 * never opened its portal link. Amber at first, red once it is past the days a company should take
 * to open the plans. Nothing once the company has opened its link.
 */
export function LinkNeverOpenedChip({ state, partnerId, company }: { state: GcState; partnerId: string; company?: string }) {
  const never = linkNeverOpened(state, partnerId)
  if (!never) return null
  const when = never.days === 0 ? 'today' : never.days === 1 ? 'yesterday' : `${never.days} days ago`
  return (
    <Chip
      tone={never.late ? 'red' : 'amber'}
      title={`Asked ${shortDate(never.since)}, ${when}. They have not opened their portal link. Check the email reached them, or call.`}
    >
      {company ? `${company} · ` : ''}never opened the link
    </Chip>
  )
}
