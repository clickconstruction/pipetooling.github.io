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
    // A date part nobody typed is left out, and the function reads its own default for it.
    const { data, error } = await supabase.rpc('search_supply_bills', {
      p_words: args.words,
      p_year: args.year ?? undefined,
      p_month: args.month ?? undefined,
      p_day: args.day ?? undefined,
      p_limit: BILL_SEARCH_LIMIT,
    })
    if (error) throw new Error(formatErrorMessage(error, BILL_SEARCH_WORDS.failed))
    // The generated types call `jobs` JSON; the function builds it in the shape `BillSearchHit` names.
    return (data ?? []) as unknown as BillSearchHit[]
  },
}
