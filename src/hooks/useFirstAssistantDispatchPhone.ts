import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { parseFieldDispatchPhoneFromValueText } from '../lib/fieldDispatchPhone'

type ParsedPhone = { telHref: string; display: string }

/**
 * Loads the first non-archived `users` row with `role = 'assistant'` and a non-empty
 * `phone`, ordered by `name` ASC, and returns its parsed `tel:` href + display string.
 * Returns `null` until loaded or when no assistant has a phone on file.
 *
 * `enabled = false` skips the network call (e.g. for roles that don't need this).
 */
export function useFirstAssistantDispatchPhone(enabled: boolean): ParsedPhone | null {
  const [phone, setPhone] = useState<ParsedPhone | null>(null)

  useEffect(() => {
    if (!enabled) {
      setPhone(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('phone')
          .eq('role', 'assistant')
          .is('archived_at', null)
          .not('phone', 'is', null)
          .order('name', { ascending: true })
          .limit(1)
          .maybeSingle()
        if (cancelled) return
        if (error) {
          setPhone(null)
          return
        }
        const raw = (data as { phone: string | null } | null)?.phone ?? null
        if (!raw || String(raw).trim() === '') {
          setPhone(null)
          return
        }
        setPhone(parseFieldDispatchPhoneFromValueText(raw))
      } catch {
        if (!cancelled) setPhone(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])

  return phone
}
