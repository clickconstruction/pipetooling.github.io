/**
 * The reads and the presses behind **Secrecy on this site** (punch list #439, piece 4): the table `site_secrecy` and
 * the three functions of `20261127052337_site_secrecy.sql`. One interface, so a block's smoke hands it a fake; one
 * implementation on the app's client.
 *
 * The names are cast because the generated types do not hold them until the migration is pushed and the types are
 * made again. `readLive` answers `'not-there'` while the database has no such table, and the block then draws nothing.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { normalizeAddressKey } from '../developments/notInIt'
import type { BookPaperRow } from '../jobs/jobPapers'
import { supabaseJobPapersIo } from '../jobs/jobPapersIo'
import { type SecrecyCounts, type SecrecyPreview, type SecrecySite, type SiteSecrecyRow, SITE_SECRECY_SELECT, liveSecrecy, parseSecrecyPreview, secrecyNotThereYet } from './siteSecrecy'

export interface SiteSecrecyIo {
  /** The site's row that is on, null when it is off, `'not-there'` before the migration is pushed. */
  readLive(site: SecrecySite): Promise<SiteSecrecyRow | null | 'not-there'>
  /** The jobs that carry the site's paper and the people who have signed it. */
  readCounts(siteSecrecyId: string): Promise<SecrecyCounts>
  /** What turning it on would reach. Writes nothing. Office only. */
  preview(site: SecrecySite): Promise<SecrecyPreview>
  /** The Contract Book's entries, for the paper our own people sign. */
  readBook(): Promise<BookPaperRow[]>
  /** Turn it on with this Contract Book paper. Answers how many jobs now carry the paper. */
  turnOn(site: SecrecySite, bookDocumentId: string): Promise<{ id: string; jobs: number }>
  /** Turn it off. The jobs open at once and every signature is kept. */
  turnOff(siteSecrecyId: string): Promise<void>
}

type Answer<T> = { data: T | null; error: unknown; count?: number | null }

const siteArgs = (site: SecrecySite) => ('developmentId' in site ? { p_development_id: site.developmentId, p_address: null } : { p_development_id: null, p_address: site.address })

export const supabaseSiteSecrecyIo: SiteSecrecyIo = {
  async readLive(site) {
    const base = supabase.from('site_secrecy' as never).select(SITE_SECRECY_SELECT).is('turned_off_at', null)
    const key = 'developmentId' in site ? '' : normalizeAddressKey(site.address)
    if (!('developmentId' in site) && !key) return null
    const answer = (await ('developmentId' in site ? base.eq('development_id', site.developmentId) : base.eq('address_key', key)).limit(5)) as unknown as Answer<SiteSecrecyRow[]>
    if (answer.error) {
      if (secrecyNotThereYet(answer.error)) return 'not-there'
      throw answer.error
    }
    return liveSecrecy(answer.data ?? [])
  },
  async readCounts(siteSecrecyId) {
    const jobs = (await supabase
      .from('job_required_papers' as never)
      .select('id', { count: 'exact', head: true })
      .eq('site_secrecy_id', siteSecrecyId)
      .is('removed_at', null)) as unknown as Answer<unknown>
    if (jobs.error) throw jobs.error
    // Who signed: the signed copies on any row of the site, a row taken off included, one person counted once. A help,
    // not a must: when it cannot be read the line is left out.
    const signed = (await supabase
      .from('person_contract_documents' as never)
      .select('person_id, job_required_papers!inner(site_secrecy_id)')
      .eq('job_required_papers.site_secrecy_id', siteSecrecyId)
      .eq('status', 'signed')
      .limit(1000)) as unknown as Answer<{ person_id: string | null }[]>
    const people = signed.error ? null : new Set((signed.data ?? []).map((r) => r.person_id).filter(Boolean)).size
    return { jobs: jobs.count ?? 0, signed: people }
  },
  async preview(site) {
    return parseSecrecyPreview(await withSupabaseRetry(() => supabase.rpc('site_secrecy_preview' as never, siteArgs(site) as never) as never, 'count what secrecy would reach'))
  },
  readBook: () => supabaseJobPapersIo.readBook(),
  async turnOn(site, bookDocumentId) {
    const raw = await withSupabaseRetry<unknown>(
      () => supabase.rpc('site_secrecy_turn_on' as never, { ...siteArgs(site), p_book_document_id: bookDocumentId } as never) as never,
      'turn on secrecy for the site',
      { maxRetries: 0 },
    )
    const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    if (typeof o.id !== 'string' || !o.id) throw new Error('Secrecy could not be turned on.')
    return { id: o.id, jobs: typeof o.jobs === 'number' ? o.jobs : 0 }
  },
  async turnOff(siteSecrecyId) {
    await withSupabaseRetry(() => supabase.rpc('site_secrecy_turn_off' as never, { p_site_secrecy_id: siteSecrecyId } as never) as never, 'turn off secrecy for the site', { maxRetries: 0 })
  },
}
