/**
 * A sub's company on People (punch list #403, step 6): the reads and the two doors. `person_trade_companies` is read by
 * the office's four roles alone, so anyone else reads no links and the list draws as it did. Browser io, not pure; the
 * rules and the words are `subCompanies.ts`.
 */
import { supabase } from '../supabase'
import { fetchAllRows } from '../supabasePaging'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { CompanyKeepPlan, PersonCompanyLink, SubCompany } from './subCompanies'

/** Every roster person's company link, and the trade companies the box offers. */
export async function loadSubCompanies(): Promise<{ links: PersonCompanyLink[]; companies: SubCompany[] }> {
  const [links, companies] = await Promise.all([
    fetchAllRows<PersonCompanyLink>(
      (from, to) => supabase.from('person_trade_companies').select('person_id, company_id, title').order('person_id').range(from, to),
      'load who works for which company',
    ),
    fetchAllRows<SubCompany>((from, to) => supabase.from('gc_companies').select('id, name').order('name').order('id').range(from, to), 'load the trade companies'),
  ])
  return { links, companies }
}

/** Keep a person's company as planned: take them off, link a company we have, or make it and link it. */
export async function keepPersonCompany(personId: string, plan: CompanyKeepPlan, title: string | null): Promise<void> {
  if (plan.kind === 'refused') throw new Error(plan.why)
  if (plan.kind === 'make') {
    await withSupabaseRetry(
      async () => supabase.rpc('person_trade_company_enter', { p_person_id: personId, p_company: { name: plan.name, trades: plan.trades }, p_title: title ?? undefined }),
      'enter their company',
    )
    return
  }
  await withSupabaseRetry(
    async () =>
      supabase.rpc('person_trade_company_set', {
        p_person_id: personId,
        p_company_id: (plan.kind === 'link' ? plan.company.id : null) as string,
        p_title: title ?? undefined,
      }),
    'keep their company',
  )
}

/** Keep what a person is at the company they work for. An empty title says nothing. */
export async function keepPersonCompanyTitle(personId: string, companyId: string, title: string): Promise<void> {
  await withSupabaseRetry(
    async () => supabase.rpc('person_trade_company_set', { p_person_id: personId, p_company_id: companyId, p_title: title.trim() || undefined }),
    'keep what they are there',
  )
}
