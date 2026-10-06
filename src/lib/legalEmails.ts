/** Client door to the law firm's email and page builders `legal-notify-dispatch` and `submit-legal-portal` use (v2.3512). */
export {
  FIRM_EMAIL_MODE_WORDS,
  LEGAL_CONFIRM_EXPIRED_REASON,
  buildLegalConfirmEmail,
  buildLegalDigestEmail,
  buildLegalNowEmail,
  buildLegalWelcomeEmail,
  legalConfirmedPageBody,
  legalFirmStageWords,
  legalPageHtml,
  legalUnsubscribedPageBody,
  legalWrapHtml,
  type LegalDigestEvent,
  type LegalDigestMatter,
  type LegalEmail,
  type LegalNowTrigger,
  type LegalWelcomeSender,
} from '../../supabase/functions/_shared/legalEmails'
