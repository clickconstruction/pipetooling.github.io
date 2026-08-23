import { useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useIsMobile } from '../hooks/useIsMobile'
import { usePartnerJobs, usePartnerLedger } from '../hooks/usePartnerLedger'
import { invalidatePartnerNavStatus } from '../hooks/useIsPartner'
import { openHtmlPrintWindow } from '../lib/jobsDocuments/printWindow'
import { todayLongDate } from '../lib/partnerLedger/partnerStatementModel'
import { MUTED, PAPER } from '../lib/portal/portalTheme'
import { PartnerStatementPaper } from '../components/partner/PartnerStatementPaper'

/**
 * /my-statement — the partner's statement page (v2.2157): the customer
 * portal's sibling, on paper. The Dashboard's "Your statement" card opens it;
 * the office's "View as <partner>" lens embeds the same view
 * (`asPartnershipId`) through the dev-only *_as RPCs. Self-gating: a caller
 * with no live partnership sees a quiet note, never an error.
 */
export function PartnerStatementView({ asPartnershipId }: { asPartnershipId?: string } = {}) {
  const { summary, cards, fullRows, loaded, reload } = usePartnerLedger(asPartnershipId)
  const { jobs, openJob, costing, costingErr, toggleCosting } = usePartnerJobs(asPartnershipId)
  const [idx, setIdx] = useState(0)
  const [acking, setAcking] = useState(false)
  const isMobile = useIsMobile()
  const now = new Date()
  const todayLabel = todayLongDate(now)
  const nowYear = now.getFullYear()

  async function acknowledge(stubId: string) {
    setAcking(true)
    const { error } = await supabase.rpc('acknowledge_partner_statement', { p_pay_stub_id: stubId })
    if (!error) {
      await reload()
      invalidatePartnerNavStatus()
    }
    setAcking(false)
  }

  // D4: print IS the page — the identical paper rendered statically into the
  // print window (inline styles carry over; buttons/nav/costing drop out).
  async function print() {
    if (!summary) return
    const { renderToStaticMarkup } = await import('react-dom/server')
    const html = renderToStaticMarkup(
      <PartnerStatementPaper summary={summary} cards={cards} idx={idx} fullRows={fullRows} jobs={jobs} printMode isMobile={false} todayLabel={todayLabel} nowYear={nowYear} />,
    )
    openHtmlPrintWindow(
      `<!doctype html><html><head><meta charset="utf-8"><title>Partner statement — ${summary.display_name}</title></head><body style="margin:0;background:${PAPER}">${html}</body></html>`,
    )
  }

  const frame = (children: ReactNode) => (
    <div style={{ padding: isMobile ? 0 : '0.5rem 0 2rem' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', boxShadow: isMobile ? undefined : '0 10px 30px rgba(0,0,0,0.18)' }}>{children}</div>
    </div>
  )

  if (!loaded) {
    return frame(<div data-theme="light" style={{ background: PAPER, padding: '2rem 1.2rem', fontSize: 14, color: MUTED }}>Opening your statement…</div>)
  }
  if (!summary || !summary.modules.weekly_statement || cards.length === 0) {
    return frame(
      <div data-theme="light" style={{ background: PAPER, padding: '2rem 1.2rem', fontSize: 14, color: MUTED }}>
        {asPartnershipId
          ? 'Nothing renders for this partner yet — the deal may be paused or ended, or the weekly statement module is off.'
          : 'There’s no partner statement on this account.'}
      </div>,
    )
  }

  return frame(
    <PartnerStatementPaper
      summary={summary}
      cards={cards}
      idx={idx}
      onIdx={setIdx}
      fullRows={fullRows}
      jobs={jobs}
      openJob={openJob}
      costing={costing}
      costingErr={costingErr}
      onToggleCosting={(id) => void toggleCosting(id)}
      onAcknowledge={(id) => void acknowledge(id)}
      acking={acking}
      onPrint={() => void print()}
      lens={!!asPartnershipId}
      isMobile={isMobile}
      todayLabel={todayLabel}
      nowYear={nowYear}
    />,
  )
}

export default function PartnerStatement() {
  return <PartnerStatementView />
}
