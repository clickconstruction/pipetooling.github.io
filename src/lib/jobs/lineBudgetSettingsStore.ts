import { supabase } from '../supabase'
import { APP_SETTINGS_KEY_LINE_BUDGET_SETTINGS_V1 } from '../appSettingsKeys'
import { DEFAULT_LINE_BUDGET_SETTINGS, parseLineBudgetSettings, serializeLineBudgetSettings, type LineBudgetSettings } from './lineBudgets'

/**
 * The company's line budget settings as one snapshot every reader shares (punch list #234 PR 1b):
 * the splits a typed line takes per stage kind, the burdened cost rate the hours use, the target
 * margin. Read once from `app_settings.line_budget_settings_v1`, fail-soft to v2.6300's constants,
 * written by the owner from Settings → Jobs & billing → Line budgets; every subscriber re-reads on
 * `line-budget-settings-changed`. `useLineBudgetSettings` is the hook over it; a kernel caller with
 * no render reads `readLineBudgetSettings()`.
 */
export const LINE_BUDGET_SETTINGS_CHANGED_EVENT = 'line-budget-settings-changed'

type Snapshot = { settings: LineBudgetSettings; loaded: boolean; savedAt: string | null }

let snapshot: Snapshot = { settings: DEFAULT_LINE_BUDGET_SETTINGS, loaded: false, savedAt: null }
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function subscribeLineBudgetSettings(l: () => void): () => void {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
export const getLineBudgetSettingsSnapshot = (): Snapshot => snapshot

/** The settings as last read; the constants until the first read lands. */
export function readLineBudgetSettings(): LineBudgetSettings {
  return snapshot.settings
}

/** Read the row once; later calls share the read. A failed read keeps the constants and says nothing. */
export function loadLineBudgetSettings(force = false): Promise<void> {
  if (loading && !force) return loading
  if (snapshot.loaded && !force) return Promise.resolve()
  loading = (async () => {
    try {
      const { data, error } = await supabase.from('app_settings').select('value_text').eq('key', APP_SETTINGS_KEY_LINE_BUDGET_SETTINGS_V1).maybeSingle()
      if (error) throw error
      const row = data as { value_text?: string | null } | null
      snapshot = { settings: parseLineBudgetSettings(row?.value_text ?? null), loaded: true, savedAt: snapshot.savedAt }
    } catch {
      snapshot = { ...snapshot, loaded: true }
    } finally {
      loading = null
      emit()
    }
  })()
  return loading
}

/** The owner's Save: an UPDATE on the one key (the row exists from the migration), then every reader moves. */
export async function saveLineBudgetSettings(next: LineBudgetSettings): Promise<void> {
  const { data, error } = await supabase.from('app_settings').update({ value_text: serializeLineBudgetSettings(next) }).eq('key', APP_SETTINGS_KEY_LINE_BUDGET_SETTINGS_V1).select('key')
  if (error) throw error
  if (!Array.isArray(data) || data.length === 0) throw new Error('the setting row is missing — apply the v2.6656 migration')
  snapshot = { settings: parseLineBudgetSettings(serializeLineBudgetSettings(next)), loaded: true, savedAt: new Date().toISOString() }
  emit()
  window.dispatchEvent(new Event(LINE_BUDGET_SETTINGS_CHANGED_EVENT))
}

/** Tests and the Settings card's own reload. */
export function resetLineBudgetSettingsForTests(settings: LineBudgetSettings = DEFAULT_LINE_BUDGET_SETTINGS): void {
  snapshot = { settings, loaded: false, savedAt: null }
  loading = null
  emit()
}
