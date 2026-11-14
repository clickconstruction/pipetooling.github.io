import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { lienNoticeMonthsAfter, type LienNoticeToExtend } from './lienNoticeOwed'

/**
 * The *paper named it too* door's write (punch list #353, part 2): the owed months join the recorded notice's
 * `months_covered`, one UPDATE on `job_lien_filings` under the office's own update policy. Nothing else on the row
 * changes: the sends, the claim and the saved copy stay as the paper went. The desk's readers see the month as noticed
 * on the next read.
 */
export async function addMonthsToLienNotice(filing: LienNoticeToExtend, months: ReadonlyArray<string>): Promise<string[]> {
  const after = lienNoticeMonthsAfter(filing, months)
  await withSupabaseRetry(() => supabase.from('job_lien_filings').update({ months_covered: after } as never).eq('id', filing.id), 'lien desk: the notice’s months')
  return after
}
