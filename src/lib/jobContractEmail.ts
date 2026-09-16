/**
 * Client door to the job-contract email builders the senders use (v2.3510), so Settings → What
 * customers see renders the same email over the sample. One builder, no mirror.
 */
export {
  buildJobContractReminderEmail,
  buildJobContractSendEmail,
  type BuiltEmail,
  type JobContractReminderEmailInput,
  type JobContractSendEmailInput,
} from '../../supabase/functions/_shared/jobContractEmail'
