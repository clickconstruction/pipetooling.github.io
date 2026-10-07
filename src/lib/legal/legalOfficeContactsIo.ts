import type { SupabaseClient } from '@supabase/supabase-js'
import { PORTAL_COMPANY } from '../../../supabase/functions/_shared/portalCompany'
import { LEGAL_OFFICE_CONTACT_ROLES, officeContactsFromUsers, type LegalOfficeContacts } from './legalOfficeContacts'

/**
 * The office's read of who the firm's page names (v2.4755), for the Legal desk's firm
 * window — the same rows the `legal-portal` function reads, so the desk can say when the
 * firm's page is missing a controller. Null when the read fails, so the window shows nothing.
 */
export async function readLegalOfficeContacts(db: SupabaseClient): Promise<LegalOfficeContacts | null> {
  try {
    const { data, error } = await db.from('users').select('name, phone, role').eq('is_sample', false).eq('is_digital_twin', false).is('archived_at', null).in('role', [...LEGAL_OFFICE_CONTACT_ROLES]).order('name')
    if (error || !Array.isArray(data)) return null
    return officeContactsFromUsers(data as Array<{ name: string | null; phone: string | null; role: string }>, PORTAL_COMPANY.phone)
  } catch {
    return null
  }
}
