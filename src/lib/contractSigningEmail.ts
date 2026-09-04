/**
 * Client door to the contract-signing email builder (v2.2773). The Deno file is
 * dependency-free, so the send dialog's preview renders the exact message
 * `send-contract-for-signature` sends — one builder, no mirror to keep in sync
 * (the estimate letterhead set the precedent).
 */
export {
  buildContractSigningEmail,
  clampContractEmailIntro,
  clampContractEmailSubject,
  contractSigningEmailDefaultSubject,
  CONTRACT_SIGNING_EMAIL_COMPANY,
  CONTRACT_SIGNING_EMAIL_DEFAULT_INTRO,
  CONTRACT_SIGNING_EMAIL_MAX_INTRO,
  CONTRACT_SIGNING_EMAIL_MAX_SUBJECT,
  formatYmdForContractEmail,
  portalUrlForDisplay,
  splitIntroParagraphs,
  type ContractSigningEmail,
  type ContractSigningEmailInput,
  type ContractSigningEmailSender,
} from '../../supabase/functions/_shared/contractSigningEmail'
