import { supabase } from './supabase'
import { APP_SETTINGS_KEY_TX_COUNTY_EXTRA_MAPPINGS_V1 } from './appSettingsKeys'
import { parseExtraTxCountyMappingsText, setExtraTxCountyMappings } from './txCountyLookup'

/** Parse the stored extras text and apply it to the county-lookup module state. */
export function applyExtraTxCountyMappingsText(text: string): void {
  setExtraTxCountyMappings(parseExtraTxCountyMappingsText(text))
}

/**
 * Hydrate the org's extra city→county pairs from app_settings (once per session,
 * called from Layout after auth — same shape as jobAddressLocalitySettings).
 * Fail-soft: on any error the built-in map still works.
 */
export async function loadAndApplyExtraTxCountyMappings(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value_text')
      .eq('key', APP_SETTINGS_KEY_TX_COUNTY_EXTRA_MAPPINGS_V1)
      .maybeSingle()
    if (error) return
    applyExtraTxCountyMappingsText(data?.value_text ?? '')
  } catch {
    // fail-soft — built-in county map still applies
  }
}
