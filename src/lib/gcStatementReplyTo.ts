/**
 * Client door to the "Replies go to" rule (punch list #49, step 4). Same file
 * the edge function runs — one rule, no mirror.
 */
export {
  REPLY_TO_ROLES,
  canTakeStatementReplies,
  defaultReplyToUserId,
  describeReplyToOutcome,
  resolveStatementReplyTo,
  type ReplyToPerson,
  type StatementReplyTo,
} from '../../supabase/functions/_shared/gcStatementReplyTo'
