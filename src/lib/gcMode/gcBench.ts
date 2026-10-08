/**
 * GC mode — design spike. Trade partners: the bench by trade, and Actions for assistants.
 * Split out of gcModel.ts verbatim; import from `./gcModel`, which re-exports every file.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { AssistantDo, AssistantItem, AssistantRule, PartnerAsk, TradeBench, TradeNeed } from '../gc/bench'
export { BENCH_WANTED, assistantRules, itemsByTrade, noticesSentAhead, partnerAsks, partnerBlockers, toldAheadWords, tradeBenches, tradeTodoCounts } from '../gc/bench'

