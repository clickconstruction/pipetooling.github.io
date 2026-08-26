import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  ADDRESS_SUGGEST_DEBOUNCE_MS,
  ADDRESS_SUGGEST_MIN_CHARS,
  parseAddressSuggestions,
  type AddressSuggestion,
} from '../lib/addressAutocomplete'

/**
 * Debounced Google address suggestions for a typed input (v2.2338). Asks the
 * address-autocomplete edge function once typing pauses (~300ms) past the
 * minimum length; stale responses are dropped; any error yields [] so the
 * caller's field degrades to a plain input. `enabled` false (e.g. right after
 * a pick, or when the user pasted) suppresses requests entirely.
 */
export function useAddressSuggestions(input: string, enabled: boolean): {
  suggestions: AddressSuggestion[]
  clearSuggestions: () => void
} {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const seqRef = useRef(0)

  useEffect(() => {
    const trimmed = input.trim()
    if (!enabled || trimmed.length < ADDRESS_SUGGEST_MIN_CHARS) {
      seqRef.current += 1
      setSuggestions([])
      return
    }
    const seq = (seqRef.current += 1)
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const { data, error } = await supabase.functions.invoke('address-autocomplete', {
            body: { input: trimmed },
          })
          if (seq !== seqRef.current) return
          setSuggestions(error ? [] : parseAddressSuggestions(data as unknown))
        } catch {
          if (seq === seqRef.current) setSuggestions([])
        }
      })()
    }, ADDRESS_SUGGEST_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [input, enabled])

  return {
    suggestions,
    clearSuggestions: () => {
      seqRef.current += 1
      setSuggestions([])
    },
  }
}

/**
 * Fire-and-forget geocode pre-warm after a suggestion is taken: rides the
 * existing geocode-address-batch pipeline (cache write to address_geocodes),
 * so the Map page and travel hints never have to self-heal this address.
 * Errors (role gate, offline) are deliberately swallowed.
 */
export function prewarmAddressGeocode(address: string): void {
  const a = address.trim()
  if (a === '') return
  void supabase.functions.invoke('geocode-address-batch', { body: { addresses: [a] } }).then(
    () => undefined,
    () => undefined,
  )
}
