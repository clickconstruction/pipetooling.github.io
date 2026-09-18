/**
 * Client re-export of the shared payment-attribution kernel (v2.3592 — which bill an
 * unlinked payment pays: oldest bill first). See `supabase/functions/_shared/paymentAttribution.ts`;
 * tests live beside this file.
 */
export {
  attributeJobPayments,
  billPaymentSlices,
  isSentBill,
  paymentsAppliedToBill,
  type AttributionBill,
  type AttributionPayment,
  type BillAttribution,
  type JobPaymentAttribution,
  type PaymentSlice,
} from '../../../supabase/functions/_shared/paymentAttribution'
