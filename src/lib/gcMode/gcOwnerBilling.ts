/**
 * GC mode — design spike. Billing the owner: the lines we bill the owner against, the work done on
 * each, and this month's pay application. It reads the work the trades report (the Building
 * lane's) and never writes it.
 *
 * The math is the AIA pay application's (G702 on top, G703 the lines), said in plain words: work
 * done so far, less what the owner holds, less what we billed before, is this bill.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { AllJobsMoney, JobMoney, OwedBill, OwnerCloseout, OwnerCloseoutKey, OwnerCloseoutStep, OwnerPayAppForm, ProjectCash, SentPayAppLine, TradeCash, TradeWaiverCheck } from '../gc/ownerBilling'
export { allJobsMoney, changeOrderPct, missingTradeWaivers, owedDrawWords, ownerAllBilled, ownerCloseout, ownerFinalPayAppToSend, ownerPayApp, ownerPayAppForm, ownerPayAppParties, projectCash, sentPayAppLines, tradeWaiverChecks, tradesOwingUnconditional } from '../gc/ownerBilling'

export type { OurOwnerWaiver, OwnerAccount, OwnerLine, OwnerLineKind, OwnerPayApp, OwnerPayDue, SpreadLine } from '../gc/ownerBilling'
export { CHANGE_ORDER_REASON_WORDS, OUR_COST_LINE_IDS, OWNER_BILL_DAY, OWNER_RETAINAGE_DEFAULT_PCT, appCertified, appClaimed, appOpen, appPaid, changeOrderPrice, changeOrderScheduleWords, changeOrderWho, daysWords, isChangeOrderLineId, markupOnTop, nextOwnerBillDay, ourOwnerWaivers, ownerAccount, ownerCarriedForward, ownerContractPrice, ownerContractWorthNow, ownerContractWorthOf, ownerExpectPaidOn, ownerLateBills, ownerPayAppHasWork, ownerPayAppToSend, ownerPayAppsSent, ownerPayDue, ownerReleasedRetainage, ownerRetainageOn, ownerRetainageWords, spreadMarkup } from '../gc/ownerBilling'

export { changeOrderDays, contractDaysAdded, projectChangeOrders, signedChangeOrders } from '../gc/ownerBilling'
