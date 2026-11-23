/**
 * The all-bills search's one read (punch list #431, PR 5): `search_supply_bills`, as the signed-in reader, so the
 * tables' own policies decide what comes back. One interface, so a smoke hands the box a fake.
 */
import { supabase } from '../../supabase'
import { formatErrorMessage } from '../../../utils/errorHandling'
import { BILL_SEARCH_LIMIT, BILL_SEARCH_WORDS, type BillSearchArgs, type BillSearchHit } from './billSearch'

export interface BillSearchIo {
  /** The bills a search finds, newest first. Rejects in words when the search did not run. */
  search(args: BillSearchArgs): Promise<BillSearchHit[]>
}

export const supabaseBillSearchIo: BillSearchIo = {
  async search(args) {
    // The generated types learn the function after the push; until then its name and arguments are plain here.
    const { data, error } = await supabase.rpc('search_supply_bills' as never, { p_words: args.words, p_year: args.year, p_month: args.month, p_day: args.day, p_limit: BILL_SEARCH_LIMIT } as never)
    if (error) throw new Error(formatErrorMessage(error, BILL_SEARCH_WORDS.failed))
    return (data ?? []) as BillSearchHit[]
  },
}
