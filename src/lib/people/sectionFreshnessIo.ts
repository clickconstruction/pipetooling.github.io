import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import type { DocRevision } from './sectionFreshness'

/** How many prior versions the fold reads. A long narrative is large, and the newest versions say the most. */
export const SECTION_FRESHNESS_REVISIONS = 12

/**
 * The prior versions of a person's summary or narrative, newest first (`person_file_revisions`, a dev's alone by its
 * RLS), for the fold that says when each section last changed (punch list #315). Read only when the fold is opened,
 * and at most `max` versions: `capped` says older ones exist, so a section that reads the same in every version read
 * is "not changed since before" the oldest of them. A read that fails names its reason and takes only the fold out.
 */
export async function loadDocRevisions(personId: string, kind: 'summary' | 'narrative', max = SECTION_FRESHNESS_REVISIONS): Promise<{ revisions: DocRevision[]; capped: boolean; heldWhy: string | null }> {
  try {
    const r = await supabase.from('person_file_revisions').select('content, replaced_at').eq('person_id', personId).eq('kind', kind).order('replaced_at', { ascending: false }).limit(max + 1)
    if (r.error) return { revisions: [], capped: false, heldWhy: r.error.message }
    const rows = r.data ?? []
    return { revisions: rows.slice(0, max), capped: rows.length > max, heldWhy: null }
  } catch (e) {
    return { revisions: [], capped: false, heldWhy: formatErrorMessage(e) }
  }
}
