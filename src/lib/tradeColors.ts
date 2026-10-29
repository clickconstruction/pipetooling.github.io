/**
 * The company's three trade colours (punch list #199): one source for the app's trade pills
 * (`BID_SERVICE_TYPE_TAGS` in utils/unifiedJobBidSearch) and the portal's trade words
 * (`PORTAL_TRADE_COLORS` in lib/portal/portalPayload), which used to copy them so the customer-facing
 * bundle stayed lean. This file imports nothing, so it costs that bundle three strings.
 *
 * Each is the lightest shade of its own hue that reads 4.5:1 on the portal's job band (`NOTE_BAND`
 * in lib/portal/portalTheme, the darkest ground a trade word sits on) and 5.3:1 with white words on
 * it as a pill: a burnt orange, an ochre and a teal, each still its trade. Before: PLUM `#e17235`
 * (2.68:1 on the band, 3.15:1 with white), ELEC `#EE9310` (2.02:1, 2.38:1), HVAC `#06b6d4` (2.06:1,
 * 2.43:1). `readablePairs.test.ts` holds each on every paper ground and with white.
 */
export const TRADE_COLORS = {
  plum: '#af4f1a',
  elec: '#985e0a',
  hvac: '#04768a',
} as const

export type TradeTag = keyof typeof TRADE_COLORS
