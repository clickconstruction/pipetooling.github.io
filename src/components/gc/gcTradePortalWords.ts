import { pt, type PortalKey, type PortalLang } from '../../lib/gc/portalI18n'

/**
 * The trade partner's portal: the words only the page draws, in English and Spanish (v2.8673). `portalI18n.ts` is a
 * kernel the edge functions carry a generated copy of, for the words an email or the server's answer says. A word no
 * function says lives here, so adding one changes nothing under `supabase/`. Nothing under `src/lib` imports this
 * file, which is what keeps it out of that copy. A block reads these through `usePortalLang().t`, as it reads the rest.
 */
const CLIENT = {
  // Who gets our emails: Remove asks first, in the row
  pplRemoveAsk: { en: 'Remove {name}? They stop getting our emails.', es: '¿Quitar a {name}? Dejará de recibir nuestros correos.' },
  pplRemoveYes: { en: 'Remove {name}', es: 'Quitar a {name}' },
  pplRemoveKeep: { en: 'Keep {name}', es: 'Dejar a {name}' },
} satisfies Record<string, Record<PortalLang, string>>

export type PortalClientKey = keyof typeof CLIENT

/** Every key the portal can draw: the kernel's and the page's own. */
export type PortalWordKey = PortalKey | PortalClientKey

/** Every key here, for the test that checks both languages carry the same blanks and none shadows a kernel key. */
export const PORTAL_CLIENT_KEYS = Object.keys(CLIENT) as PortalClientKey[]

/** The raw text of a key here in both languages, for the test. */
export function portalClientString(key: PortalClientKey): Record<PortalLang, string> {
  return CLIENT[key]
}

const isClientKey = (key: PortalWordKey): key is PortalClientKey => Object.prototype.hasOwnProperty.call(CLIENT, key)

/** One portal string in a language, its {blanks} filled: the page's own word when the key is one, else the kernel's. */
export function portalWord(lang: PortalLang, key: PortalWordKey, vars?: Record<string, string | number>): string {
  if (!isClientKey(key)) return pt(lang, key, vars)
  let out: string = CLIENT[key][lang]
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v))
  return out
}
