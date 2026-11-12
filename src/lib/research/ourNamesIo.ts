/**
 * Bids and permits (punch list #307): the read and the write behind the names that are us on a
 * plumbing permit. One row of `app_settings` holds the list, and the company name on paper
 * bills rides the same read. Read once a session and shared by every panel; a save reads again
 * and tells the panels. The rules are in `ourNames.ts`. No kernel logic here.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { APP_SETTINGS_KEY_PHYSICAL_INVOICE_ISSUER_V1 } from '../appSettingsKeys'
import { parsePhysicalInvoiceIssuerStoredJson } from '../physicalInvoiceIssuer'
import { OUR_NAMES_SETTINGS_KEY, addOurName, parseOurNames, removeOurName, storeOurNames, type OurNameChange, type OurNames } from './ourNames'

let held: Promise<OurNames> | null = null
const listeners = new Set<() => void>()

async function read(): Promise<OurNames> {
  const rows = await withSupabaseRetry(
    async () => await supabase.from('app_settings').select('key, value_text').in('key', [OUR_NAMES_SETTINGS_KEY, APP_SETTINGS_KEY_PHYSICAL_INVOICE_ISSUER_V1]),
    'read the names that are us on permits',
  )
  const byKey = new Map((rows ?? []).map((r) => [r.key, r.value_text]))
  let companyName: string | null = null
  const issuer = byKey.get(APP_SETTINGS_KEY_PHYSICAL_INVOICE_ISSUER_V1)
  if (issuer) {
    try {
      companyName = parsePhysicalInvoiceIssuerStoredJson(JSON.parse(issuer)).companyName.trim() || null
    } catch {
      companyName = null
    }
  }
  return { names: parseOurNames(byKey.get(OUR_NAMES_SETTINGS_KEY)), companyName }
}

/** The names that are us, read once a session. A failed read is not kept, so the next ask reads again. */
export function loadOurNames(): Promise<OurNames> {
  if (!held) {
    const mine: Promise<OurNames> = read().catch((e) => {
      if (held === mine) held = null
      throw e
    })
    held = mine
  }
  return held
}

/** Run `fn` whenever the list is saved, so an open bid and the Bid Board agree with Settings. Returns the unsubscribe. */
export function onOurNamesChanged(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/**
 * Add a name or take one back. The list is read fresh first, so two people editing do not drop
 * each other's name. A refusal by the kernel comes back as its reason and nothing is written.
 */
export async function changeOurNames(change: { add: string } | { remove: string }): Promise<{ result: OurNameChange; ours: OurNames }> {
  held = null
  const ours = await loadOurNames()
  const result: OurNameChange = 'add' in change ? addOurName(ours, change.add) : { ok: true, names: removeOurName(ours.names, change.remove) }
  if (!result.ok) return { result, ours }
  await withSupabaseRetry(
    async () => await supabase.from('app_settings').upsert({ key: OUR_NAMES_SETTINGS_KEY, value_text: storeOurNames(result.names) }, { onConflict: 'key' }),
    'save the names that are us on permits',
  )
  const next: OurNames = { names: result.names, companyName: ours.companyName }
  held = Promise.resolve(next)
  for (const fn of listeners) fn()
  return { result, ours: next }
}
