import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { DOCSMIT_CREDIT_NONE, DOCSMIT_READ_KEY_LIST, DOCSMIT_SETTINGS_DEFAULT, docsmitCreditFrom, docsmitSettingsFrom, type DocsmitCredit, type DocsmitSettings } from '../lib/mail/docsmitSettings'

/**
 * Docsmit's switches for the run (the Docsmit train, PR 5b): the `app_settings` `docsmit_*` rows as one
 * object with every default. `setUp` says a dev has saved the connection (a `docsmit_env` row exists), which
 * is when the run's Mail through Docsmit door appears; until then, and while paused, the run is paper only.
 */
export type DocsmitSettingsState = { settings: DocsmitSettings; setUp: boolean; loaded: boolean; /** The balance the poll last read (6b, the credit line); none until it has. */ credit: DocsmitCredit }

export function useDocsmitSettings(): DocsmitSettingsState {
  const [state, setState] = useState<DocsmitSettingsState>({ settings: DOCSMIT_SETTINGS_DEFAULT, setUp: false, loaded: false, credit: DOCSMIT_CREDIT_NONE })
  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const { data } = await supabase.from('app_settings').select('key, value_text, value_num').in('key', DOCSMIT_READ_KEY_LIST)
        const rows = (data ?? []) as Array<{ key: string; value_text?: string | null; value_num?: number | null }>
        if (live) setState({ settings: docsmitSettingsFrom(rows), setUp: rows.some((r) => r.key === 'docsmit_env'), loaded: true, credit: docsmitCreditFrom(rows) })
      } catch {
        if (live) setState((s) => ({ ...s, loaded: true }))
      }
    })()
    return () => {
      live = false
    }
  }, [])
  return state
}
