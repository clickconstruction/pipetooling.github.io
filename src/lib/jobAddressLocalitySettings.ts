import { supabase } from './supabase'
import { APP_SETTINGS_KEY_JOB_ADDRESS_EXTRA_LOCALITIES_V1 } from './appSettingsKeys'
import { parseExtraTxLocalitiesText, setExtraTxLocalityKeywords } from './txLocalityAddressSplit'

/** Parse the stored extras text and apply it to the address-split module state. */
export function applyExtraJobAddressLocalitiesText(text: string): void {
  setExtraTxLocalityKeywords(parseExtraTxLocalitiesText(text))
}

/**
 * Hydrate the org's extra address-split cities from app_settings (once per session,
 * called from Layout after auth). Fail-soft: on any error the built-in list still works.
 */
export async function loadAndApplyExtraJobAddressLocalities(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value_text')
      .eq('key', APP_SETTINGS_KEY_JOB_ADDRESS_EXTRA_LOCALITIES_V1)
      .maybeSingle()
    if (error) return
    applyExtraJobAddressLocalitiesText(data?.value_text ?? '')
  } catch {
    // fail-soft — built-in city list still applies
  }
}
