/**
 * Messages, cut 7f: what the reply box's Attach reads. One interface, so the box's smoke hands it a fake; one
 * implementation on the app's client.
 *
 * - A job's files are the one list (`documents/jobFilesIo.ts`, cut 7c), Drive's folder included.
 * - Whether the person has a portal link on is read as the office under its rules: a trade partner's
 *   `gc_trade_portal_links`, a customer's `customer_portal_links` where their GC jobs show. A read it may not make
 *   answers no portal (the lead, 2026-10-13), and the file then goes as our own link.
 * - A file from this computer is read to base64 for `messages-email`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { base64OfBytes } from '../../../supabase/functions/_shared/messagesEmailFiles'
import type { Contact } from '../contacts/kernel'
import type { DeviceBytes } from '../documents/emailFileAsks'
import type { JobFile } from '../documents/jobFiles'
import { loadJobFiles } from '../documents/jobFilesIo'
import { supabase } from '../supabase'
import { jobRefOf } from './load'
import type { DeviceFile } from './replyFiles'

export interface AttachIo {
  /** The job's one list of files, and whether Drive answered. */
  loadJobFiles(jobKey: string): Promise<{ files: JobFile[]; driveFailed: boolean }>
  /** Whether a link to their portal is on. False when it cannot be read. */
  hasPortal(contact: Pick<Contact, 'kind' | 'gcCompanyId' | 'customerId'>): Promise<boolean>
  /** A file from this computer, read to base64. */
  readDevice(file: DeviceFile): Promise<DeviceBytes>
}

export const supabaseAttachIo: AttachIo = {
  async loadJobFiles(jobKey) {
    const ref = jobRefOf(jobKey)
    if (!ref) return { files: [], driveFailed: false }
    const read = await loadJobFiles(ref)
    return { files: read.files, driveFailed: read.driveFailed }
  },
  async hasPortal(contact) {
    // Cut 7a's portal tables are not all in the generated types yet; a read the rules refuse is no portal.
    const db = supabase as unknown as SupabaseClient
    try {
      if (contact.kind === 'trade' && contact.gcCompanyId) {
        const { data, error } = await db.from('gc_trade_portal_links').select('id').eq('company_id', contact.gcCompanyId).is('revoked_at', null).not('token', 'is', null).limit(1)
        return !error && (data ?? []).length > 0
      }
      if (contact.kind === 'customer' && contact.customerId) {
        const { data, error } = await db.from('customer_portal_links').select('id').eq('customer_id', contact.customerId).is('revoked_at', null).in('audience', ['all', 'customer']).limit(1)
        return !error && (data ?? []).length > 0
      }
    } catch {
      return false
    }
    return false
  },
  async readDevice(file) {
    return { base64: base64OfBytes(new Uint8Array(await file.arrayBuffer())), mime: file.type || 'application/octet-stream' }
  },
}
