/**
 * Client door to the office's statement week (punch list #49, step 6b): the
 * payload get_my_statement_week() returns, and the grouping and wording the
 * morning email uses — the same file the edge function runs, no mirror.
 */
export {
  OFFICE_STANDARD,
  groupOfficeWeek,
  groupTitle,
  isOfficeWeekPayload,
  officeWeekStep,
  officeWeekSubject,
  officeWeekText,
  promiseLine,
  renderOfficeWeekHtml,
  type OfficeWeekGroup,
  type OfficeWeekItem,
  type OfficeWeekPayload,
  type OfficeWeekStep,
} from '../../supabase/functions/statement-round-email-dispatch/renderOfficeWeek'
