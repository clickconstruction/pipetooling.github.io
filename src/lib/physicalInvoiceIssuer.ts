/** Company identity on customer-facing physical invoices (PDF/preview/email). Org-wide via `app_settings` with local mirror. */

import { APP_SETTINGS_KEY_PHYSICAL_INVOICE_ISSUER_V1 } from './appSettingsKeys'
import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

export type PhysicalInvoiceIssuer = {
  companyName: string
  /** Multiline mailing / service office address */
  addressText: string
  phone: string
  email: string
  tagline: string
  licenseLine: string
}

const LS_KEY = 'physical_invoice_issuer_v1'

const EMPTY: PhysicalInvoiceIssuer = {
  companyName: '',
  addressText: '',
  phone: '',
  email: '',
  tagline: '',
  licenseLine: '',
}

let sessionIssuer: PhysicalInvoiceIssuer | undefined

function cloneIssuer(i: PhysicalInvoiceIssuer): PhysicalInvoiceIssuer {
  return {
    companyName: i.companyName,
    addressText: i.addressText,
    phone: i.phone,
    email: i.email,
    tagline: i.tagline,
    licenseLine: i.licenseLine,
  }
}

/** Parse JSON from DB or local mirror. Unknown shapes yield empty fields. */
export function parsePhysicalInvoiceIssuerStoredJson(parsed: unknown): PhysicalInvoiceIssuer {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ...EMPTY }
  }
  const o = parsed as Record<string, unknown>
  return {
    companyName: typeof o.companyName === 'string' ? o.companyName : '',
    addressText: typeof o.addressText === 'string' ? o.addressText : '',
    phone: typeof o.phone === 'string' ? o.phone : '',
    email: typeof o.email === 'string' ? o.email : '',
    tagline: typeof o.tagline === 'string' ? o.tagline : '',
    licenseLine: typeof o.licenseLine === 'string' ? o.licenseLine : '',
  }
}

function isPhysicalInvoiceIssuerAllWhitespace(i: PhysicalInvoiceIssuer): boolean {
  return Object.values(i).every((v) => typeof v === 'string' && v.trim() === '')
}

function persistLocalMirror(i: PhysicalInvoiceIssuer): void {
  if (typeof window === 'undefined') return
  try {
    if (isPhysicalInvoiceIssuerAllWhitespace(i)) {
      window.localStorage.removeItem(LS_KEY)
      return
    }
    window.localStorage.setItem(LS_KEY, JSON.stringify(i))
  } catch {
    /* ignore */
  }
}

function readFromLocalMirrorOnly(): PhysicalInvoiceIssuer {
  if (typeof window === 'undefined') return { ...EMPTY }
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return { ...EMPTY }
    return parsePhysicalInvoiceIssuerStoredJson(JSON.parse(raw))
  } catch {
    return { ...EMPTY }
  }
}

function applySessionPin(i: PhysicalInvoiceIssuer): void {
  sessionIssuer = cloneIssuer(i)
  persistLocalMirror(sessionIssuer)
}

export function getPhysicalInvoiceIssuerDraft(): PhysicalInvoiceIssuer {
  if (sessionIssuer !== undefined) return cloneIssuer(sessionIssuer)
  return readFromLocalMirrorOnly()
}

async function deletePhysicalInvoiceIssuerFromAppSettings(): Promise<void> {
  await withSupabaseRetry(
    async () => supabase.from('app_settings').delete().eq('key', APP_SETTINGS_KEY_PHYSICAL_INVOICE_ISSUER_V1),
    'delete_physical_invoice_issuer_app_settings',
  )
}

export async function upsertPhysicalInvoiceIssuerToAppSettings(issuer: PhysicalInvoiceIssuer): Promise<void> {
  if (isPhysicalInvoiceIssuerAllWhitespace(issuer)) {
    await deletePhysicalInvoiceIssuerFromAppSettings()
    return
  }
  await withSupabaseRetry(
    async () =>
      supabase.from('app_settings').upsert(
        {
          key: APP_SETTINGS_KEY_PHYSICAL_INVOICE_ISSUER_V1,
          value_text: JSON.stringify(issuer),
        },
        { onConflict: 'key' },
      ),
    'upsert_physical_invoice_issuer_app_settings',
  )
}

export async function fetchPhysicalInvoiceIssuerFromAppSettings(opts?: {
  authRole?: string | null
}): Promise<{ rowExists: boolean }> {
  try {
    const data = (await withSupabaseRetry(
      async () =>
        supabase.from('app_settings').select('value_text').eq('key', APP_SETTINGS_KEY_PHYSICAL_INVOICE_ISSUER_V1).maybeSingle(),
      'fetch_physical_invoice_issuer_app_settings',
    )) as { value_text: string | null } | null

    if (data != null) {
      const text = data.value_text
      if (text != null && text.trim() !== '') {
        try {
          const parsed: unknown = JSON.parse(text)
          applySessionPin(parsePhysicalInvoiceIssuerStoredJson(parsed))
        } catch {
          applySessionPin({ ...EMPTY })
        }
      } else {
        applySessionPin({ ...EMPTY })
      }
      return { rowExists: true }
    }

    const localOnly = readFromLocalMirrorOnly()
    applySessionPin(localOnly)
    if (opts?.authRole === 'dev' && !isPhysicalInvoiceIssuerAllWhitespace(localOnly)) {
      try {
        await upsertPhysicalInvoiceIssuerToAppSettings(localOnly)
      } catch {
        /* RLS / network */
      }
    }
    return { rowExists: false }
  } catch {
    return { rowExists: false }
  }
}

/** Persists org-wide draft; throws on DB failure so Settings can toast. */
export async function savePhysicalInvoiceIssuerDraft(issuer: PhysicalInvoiceIssuer): Promise<void> {
  const next = cloneIssuer(issuer)
  await upsertPhysicalInvoiceIssuerToAppSettings(next)
  applySessionPin(next)
}

/** Values passed into the invoice document; omit empty optional blocks in PDF/preview. */
export function getPhysicalInvoiceIssuerForDocument(): PhysicalInvoiceIssuer {
  return getPhysicalInvoiceIssuerDraft()
}
