/** Client door to the law firm's email and page builders `legal-notify-dispatch` and `submit-legal-portal` use (v2.3512). */
export {
  buildLegalConfirmEmail,
  buildLegalDigestEmail,
  buildLegalNowEmail,
  legalConfirmedPageBody,
  legalPageHtml,
  legalUnsubscribedPageBody,
  legalWrapHtml,
  type LegalDigestEvent,
  type LegalDigestMatter,
  type LegalEmail,
  type LegalNowTrigger,
} from '../../supabase/functions/_shared/legalEmails'
