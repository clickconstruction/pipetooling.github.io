/**
 * Office-side read / write of the one `company_bank_transfer_details` row
 * (v2.3308). RLS: office roles read (is_office_staff), dev + master write.
 * The customer portal never comes through here — its edge function reads
 * the row with the service role.
 */
import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { bankTransferDetailsToRow, parseBankTransferDetails, type BankTransferDetails } from './bankTransferDetails'

export const COMPANY_BANK_TRANSFER_DETAILS_ID = 'default' as const

/** The row, or null when the office has not entered anything yet. Throws on a real error. */
export async function fetchCompanyBankTransferDetails(): Promise<BankTransferDetails | null> {
  const data = await withSupabaseRetry(
    async () => supabase.from('company_bank_transfer_details').select('*').eq('id', COMPANY_BANK_TRANSFER_DETAILS_ID).maybeSingle(),
    'fetchCompanyBankTransferDetails',
  )
  return parseBankTransferDetails(data)
}

/** Upsert the single row, stamped with who saved it. */
export async function saveCompanyBankTransferDetails(details: BankTransferDetails, userId: string | null): Promise<void> {
  await withSupabaseRetry(
    async () =>
      supabase
        .from('company_bank_transfer_details')
        .upsert(
          { id: COMPANY_BANK_TRANSFER_DETAILS_ID, ...bankTransferDetailsToRow(details), updated_by: userId, updated_at: new Date().toISOString() },
          { onConflict: 'id' },
        ),
    'saveCompanyBankTransferDetails',
  )
}
