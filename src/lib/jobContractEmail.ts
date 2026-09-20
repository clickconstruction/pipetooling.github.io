/**
 * Client door to the job-contract email builders the senders use (v2.3510), so Settings → What
 * customers see renders the same email over the sample. One builder, no mirror.
 */
export {
  buildJobContractPaperEmail,
  buildJobContractReminderEmail,
  buildJobContractSendEmail,
  buildJobContractSignedCopyEmail,
  type BuiltEmail,
  type JobContractReminderEmailInput,
  type JobContractSendEmailInput,
  type JobContractSignedCopyEmailInput,
} from '../../supabase/functions/_shared/jobContractEmail'
