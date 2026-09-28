/**
 * Bids → Pricing: the eight windows behind the header's quotes / RFQ / robot doors (region P6
 * of `docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md`). The JSX moved out of `BidsPricingTab`
 * as it was; the open flags and the bid's requests come from `usePricingQuoteDesk`.
 *
 * The windows open each other through the desk's setters (Compare ↔ Plug in ↔ Desk ↔
 * Compose), and every write bumps the desk's nonce so the chip re-reads. Division 22's audit
 * needs no bid; the other seven render only with one.
 */
import type { LedgerPrefixMap } from '../../lib/ledgerDisplayPrefixes'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { BidCountRow } from '../../types/bids'
import type { PricingQuoteDesk } from '../../hooks/usePricingQuoteDesk'
import { bidPackageLabel } from '../../lib/bidPackageLabel'
import { SpecSectionAuditModal } from './SpecSectionAuditModal'
import { PrepareFixtureCopyModal } from './PrepareFixtureCopyModal'
import { PlugInQuotesModal } from './PlugInQuotesModal'
import { PlugInScheduleModal } from './PlugInScheduleModal'
import { PriceWithRobotModal } from './PriceWithRobotModal'
import { QuoteCompareModal } from './QuoteCompareModal'
import { RfqDeskModal } from './RfqDeskModal'
import { RfqComposeModal } from './RfqComposeModal'

export function PricingQuoteModals({
  desk,
  selectedBidForPricing,
  ledgerPrefixMap,
  pricingCountRows,
  selectedPricingVersionId,
  canPackageAndSendBidPricing,
  takeoffMaterialsByCountRowId,
  taxPercent,
  currentTotals,
  onCostsApplied,
}: {
  desk: PricingQuoteDesk
  selectedBidForPricing: BidWithBuilder | null
  ledgerPrefixMap: LedgerPrefixMap
  pricingCountRows: BidCountRow[]
  selectedPricingVersionId: string | null
  canPackageAndSendBidPricing: boolean
  takeoffMaterialsByCountRowId: Record<string, number>
  /** The tab's tax fallback, already parsed (the map's quirk 2). */
  taxPercent: number
  /** The Workbench's live totals, for the compare's before / after. */
  currentTotals: { totalRevenue: number; totalCost: number } | null
  /** The compare wrote quote costs — the tab reloads them. */
  onCostsApplied: () => void
}) {
  const {
    rfqChip,
    openRobotChip,
    activePriceMatrixRequest,
    priceMatrixSupported,
    reloadPriceMatrixRequests,
    d22AuditOpen,
    setD22AuditOpen,
    prepareCopyOpen,
    setPrepareCopyOpen,
    plugInQuoteOpen,
    setPlugInQuoteOpen,
    plugInScheduleOpen,
    setPlugInScheduleOpen,
    priceWithRobotOpen,
    setPriceWithRobotOpen,
    quotesCompareOpen,
    setQuotesCompareOpen,
    rfqDeskOpen,
    setRfqDeskOpen,
    composeScope,
    setComposeScope,
    openRfqHouseIds,
    bumpQuoteNonce,
  } = desk
  return (
    <>
      <SpecSectionAuditModal open={d22AuditOpen} onClose={() => setD22AuditOpen(false)} />

      {selectedBidForPricing ? (
        <PrepareFixtureCopyModal
          open={prepareCopyOpen}
          onClose={() => setPrepareCopyOpen(false)}
          bidLabel={bidPackageLabel(selectedBidForPricing, ledgerPrefixMap)}
          rows={pricingCountRows.map((r) => ({ id: r.id, fixture: r.fixture, count: r.count, unit: r.unit }))}
          quoteLink={
            canPackageAndSendBidPricing
              ? { bidId: selectedBidForPricing.id, bidVersionId: selectedPricingVersionId ?? null }
              : undefined
          }
          onRfqMinted={() => bumpQuoteNonce()}
          onSendByEmail={
            canPackageAndSendBidPricing
              ? (scope) => {
                  setPrepareCopyOpen(false)
                  setComposeScope(scope)
                }
              : undefined
          }
        />
      ) : null}

      {selectedBidForPricing ? (
        <RfqDeskModal
          open={rfqDeskOpen}
          onClose={() => setRfqDeskOpen(false)}
          onCompare={() => {
            setRfqDeskOpen(false)
            setQuotesCompareOpen(true)
          }}
          onNewRequest={() => {
            setRfqDeskOpen(false)
            setPrepareCopyOpen(true)
          }}
          onChanged={() => bumpQuoteNonce()}
          bidId={selectedBidForPricing.id}
          bidLabel={bidPackageLabel(selectedBidForPricing, ledgerPrefixMap)}
          rows={pricingCountRows.map((r) => ({ id: r.id, fixture: r.fixture, count: r.count }))}
        />
      ) : null}

      {selectedBidForPricing && composeScope ? (
        <RfqComposeModal
          open={composeScope != null}
          onClose={() => setComposeScope(null)}
          onSent={() => {
            bumpQuoteNonce()
            setRfqDeskOpen(true)
          }}
          bidId={selectedBidForPricing.id}
          bidVersionId={selectedPricingVersionId ?? null}
          bidLabel={bidPackageLabel(selectedBidForPricing, ledgerPrefixMap)}
          scope={composeScope}
          openRfqHouseIds={openRfqHouseIds}
          plansLink={selectedBidForPricing.plans_link ?? null}
        />
      ) : null}

      {selectedBidForPricing ? (
        <PlugInQuotesModal
          open={plugInQuoteOpen}
          onClose={() => setPlugInQuoteOpen(false)}
          onSaved={() => {
            bumpQuoteNonce()
            setQuotesCompareOpen(true)
          }}
          bidId={selectedBidForPricing.id}
          bidVersionId={selectedPricingVersionId ?? null}
          bidLabel={bidPackageLabel(selectedBidForPricing, ledgerPrefixMap)}
          rows={pricingCountRows.map((r) => ({ id: r.id, fixture: r.fixture, count: r.count, unit: r.unit }))}
        />
      ) : null}

      {selectedBidForPricing ? (
        <PlugInScheduleModal
          open={plugInScheduleOpen}
          onClose={() => setPlugInScheduleOpen(false)}
          onSaved={() => bumpQuoteNonce()}
          bidId={selectedBidForPricing.id}
          bidLabel={bidPackageLabel(selectedBidForPricing, ledgerPrefixMap)}
          rows={pricingCountRows.map((r) => ({ id: r.id, fixture: r.fixture, count: r.count }))}
        />
      ) : null}

      {selectedBidForPricing ? (
        <PriceWithRobotModal
          open={priceWithRobotOpen}
          onClose={() => setPriceWithRobotOpen(false)}
          bidId={selectedBidForPricing.id}
          bidVersionId={selectedPricingVersionId ?? null}
          bidLabel={bidPackageLabel(selectedBidForPricing, ledgerPrefixMap)}
          rows={pricingCountRows.map((r) => ({ id: r.id, fixture: r.fixture, count: r.count, unit: r.unit }))}
          activeRequest={activePriceMatrixRequest}
          supported={priceMatrixSupported}
          onChanged={() => {
            reloadPriceMatrixRequests()
            bumpQuoteNonce()
          }}
          onOpenCompare={() => {
            setPriceWithRobotOpen(false)
            if (activePriceMatrixRequest && rfqChip.kind === 'robot') void openRobotChip(rfqChip)
          }}
        />
      ) : null}

      {selectedBidForPricing ? (
        <QuoteCompareModal
          open={quotesCompareOpen}
          onClose={() => setQuotesCompareOpen(false)}
          onPlugIn={() => {
            setQuotesCompareOpen(false)
            setPlugInQuoteOpen(true)
          }}
          onPlugInSchedule={() => {
            setQuotesCompareOpen(false)
            setPlugInScheduleOpen(true)
          }}
          bidId={selectedBidForPricing.id}
          bidLabel={bidPackageLabel(selectedBidForPricing, ledgerPrefixMap)}
          rows={pricingCountRows.map((r) => ({ id: r.id, fixture: r.fixture, count: r.count }))}
          takeoffMaterialsByCountRowId={takeoffMaterialsByCountRowId}
          taxPercent={taxPercent}
          currentTotals={currentTotals}
          onCostsApplied={onCostsApplied}
        />
      ) : null}
    </>
  )
}
