import { portalPreBid, type GcProject, type GcState, type Partner } from '../../lib/gcMode/gcModel'
import { PortalBlock, PortalTag } from './GcPortalUi'
import { usePortalLang } from './gcPortalLang'

/**
 * GC mode design spike: the pre-bid meeting on a trade's project page (the New Project lane's
 * meeting, owner 2026-10-04): who runs it, when and where, whether coming is required to quote,
 * and afterwards whether the company came. Only for a company asked to it while it quotes.
 */
export function GcPortalPreBid({ state, project, partner }: { state: GcState; project: GcProject; partner: Partner }) {
  const { t, lang } = usePortalLang()
  const pb = portalPreBid(state, project, partner.id, lang)
  if (!pb) return null
  return (
    <PortalBlock title={t('pbTitle')}>
      <div style={{ display: 'grid', gap: '0.3rem', fontSize: '0.9rem' }}>
        <strong>{pb.when}</strong>
        <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>{pb.host}</span>
        <span style={{ fontWeight: pb.mandatory ? 600 : 400 }}>{pb.rule}</span>
        <div>
          <PortalTag tone={pb.missed ? 'red' : pb.came ? 'green' : 'grey'}>{pb.after}</PortalTag>
        </div>
      </div>
    </PortalBlock>
  )
}
