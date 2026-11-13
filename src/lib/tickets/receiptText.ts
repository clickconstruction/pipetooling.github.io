/**
 * The text about a card charge (punch list #299, PR 2): the switch's shape, which charges are asked, why a text cannot
 * go, the fold, the reminder's hour and every word, from `supabase/functions/_shared/receiptText.ts`, one source for
 * the `receipt-request` sweep and the app. Pure.
 */
export {
  RECEIPT_COMPANY_TZ,
  RECEIPT_FOLD_MAX,
  RECEIPT_FOLD_MS,
  RECEIPT_SHORT_ORIGIN,
  RECEIPT_SWEEP_HOURS,
  RECEIPT_TEXTS_KEY,
  RECEIPT_TEXTS_OFF,
  RECEIPT_TEXTS_WORDS,
  RECEIPT_TEXT_TRIES,
  foldReceiptCharges,
  parseReceiptTextsSetting,
  receiptChargeAsks,
  receiptCompanyHour,
  receiptHolderInTrial,
  receiptLineWords,
  receiptLinkUrl,
  receiptNoTextWhy,
  receiptReminderBody,
  receiptReminderDue,
  receiptSweepFloor,
  receiptTextBody,
  receiptTextsOnWords,
  receiptTextsValue,
  type ReceiptChargeRow,
  type ReceiptLine,
  type ReceiptLineTone,
  type ReceiptNoTextWhy,
  type ReceiptRequestState,
  type ReceiptTextCharge,
  type ReceiptTextsSetting,
  type ReceiptWaiting,
} from '../../../supabase/functions/_shared/receiptText'
