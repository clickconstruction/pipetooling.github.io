/**
 * Punch list #140 PR 8: the two writes behind a lead's doors (`leadDoors.ts`). `convert` makes the customer's row and
 * re-points the lead's contact at it through `name_contact` (never `contact_for_customer`, which would make a second,
 * empty contact for the customer), so the thread and its STOP come with them. `startEstimate` opens a draft estimate on
 * the customer, the same row the Estimates page's own button makes, with the customer on it; the editor's fresh-draft
 * rule keeps a draft with a customer on leave. One interface, so a smoke hands it a fake.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserRole } from '../../hooks/useAuth'
import type { Database } from '../../types/database'
import { checkSupabaseError } from '../../utils/errorHandling'
import { resolveCompanyOwnerUserId } from '../companyOwner'
import { resolveEstimateMasterUserId } from '../estimateMasterUser'
import { defaultDraftFirstLine } from '../estimates/estimateDraftLines'
import { recordNavClick } from '../navClickTelemetry'
import { supabase } from '../supabase'
import { customerPayloadFrom, type LeadFacts } from './leadDoors'
import { nameContact } from './messagesIo'

export interface LeadDoorsIo {
  /** The customer made from the lead and the thread re-pointed at them. Resolves to the customer's id. */
  convert(contactId: string, facts: LeadFacts, by: { userId: string }, todayYmd: string): Promise<{ customerId: string }>
  /** A draft estimate on the customer. Resolves to its number, for `/estimates/<n>`. */
  startEstimate(customerId: string, by: { userId: string; role: UserRole | null }): Promise<{ estimateNumber: number }>
}

export function supabaseLeadDoorsIo(client: SupabaseClient<Database> = supabase, name: typeof nameContact = nameContact): LeadDoorsIo {
  return {
    async convert(contactId, facts, by, todayYmd) {
      const owner = await resolveCompanyOwnerUserId(client, by.userId)
      const made = await client.from('customers').insert(customerPayloadFrom(facts, owner, todayYmd)).select('id').single()
      checkSupabaseError(made, 'make them a customer')
      const customerId = (made.data as { id: string }).id
      await name(contactId, { record: { table: 'customers', id: customerId }, kind: 'customer' })
      return { customerId }
    },
    async startEstimate(customerId, by) {
      const master = await resolveEstimateMasterUserId(by.userId, by.role)
      if (!master) throw new Error('Could not find the company owner for the estimate.')
      const made = await client
        .from('estimates')
        .insert({
          master_user_id: master,
          created_by: by.userId,
          title: '',
          line_items_snapshot: [defaultDraftFirstLine()],
          terms_snapshot: '',
          total_cents: 0,
          project_id: null,
          customer_id: customerId,
        })
        .select('id, estimate_number')
        .single()
      checkSupabaseError(made, 'start the estimate')
      const row = made.data as { id: string; estimate_number: number }
      recordNavClick(by.userId, by.role, 'estimate_draft_created', '#lead:estimate')
      return { estimateNumber: row.estimate_number }
    },
  }
}
