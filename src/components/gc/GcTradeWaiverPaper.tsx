import type { TradeWaiverPaper } from '../../lib/gc/tradeWaiverPaper'
import { HAIR } from '../../lib/portal/portalTheme'
import { LienWaiverFootPreview } from '../jobs/LienWaiverFootPreview'

/**
 * GC mode, the trade partner portal (P5c-3b, P5c-3c-ii): a lien waiver the company signs, drawn as the Release of Lien
 * window draws its paper: the form's title, its paragraphs and the foot to sign on. The unconditional waiver on a paid
 * draw and the conditional one a pay application signs both lay it out here.
 */
export function TradeWaiverPaperView({ paper }: { paper: TradeWaiverPaper }) {
  return (
    <div
      data-trade-waiver-paper={paper.formType}
      style={{
        background: 'var(--surface)',
        color: 'var(--text-base)',
        border: `1px solid ${HAIR}`,
        borderRadius: 4,
        padding: '1rem 1.1rem',
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: '0.8125rem',
        lineHeight: 1.7,
      }}
    >
      <p style={{ textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 0.9em' }}>{paper.title}</p>
      {paper.paragraphs.map((text, i) => (
        <p key={i} style={{ margin: '0 0 0.7em' }}>
          {text}
        </p>
      ))}
      <LienWaiverFootPreview foot={paper.foot} />
    </div>
  )
}
