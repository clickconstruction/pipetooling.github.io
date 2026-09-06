/**
 * Client door to the GC-statement send-time dedupe rule (journey-map Tier-2 #45).
 * Same file both edge functions run — one rule, no mirror. The client reads
 * the windows and the email-type ids for the "What went out" list's lane labels.
 */
export {
  GC_STATEMENT_DEDUPE_WINDOW_MS,
  GC_STATEMENT_EMAIL_TYPES,
  describeAgo,
  describeDuplicateStatementSkip,
  dedupeSinceIso,
  findDuplicateStatementSend,
  isDuplicateStatementSend,
  statementEntityKey,
  type GcStatementEmailType,
  type RecentStatementSend,
  type StatementSendIdentity,
} from '../../supabase/functions/_shared/gcStatementSendDedupe'
