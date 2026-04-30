import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { buildLedgerPrefixMap, type LedgerPrefixMap } from '../lib/ledgerDisplayPrefixes'
import { withSupabaseRetry } from '../utils/errorHandling'

export type LedgerDisplayPrefixContextValue = {
  prefixMap: LedgerPrefixMap
  reload: () => Promise<void>
}

const LedgerDisplayPrefixContext = createContext<LedgerDisplayPrefixContextValue>({
  prefixMap: {},
  reload: async () => {},
})

type ProviderProps = {
  children: ReactNode
  authUserId: string | null
}

export function LedgerDisplayPrefixProvider({ children, authUserId }: ProviderProps) {
  const [prefixMap, setPrefixMap] = useState<LedgerPrefixMap>({})

  const load = useCallback(async () => {
    if (!authUserId) {
      setPrefixMap({})
      return
    }
    try {
      const rows = await withSupabaseRetry(
        async () =>
          supabase
            .from('service_types')
            .select('id, ledger_job_prefix, ledger_bid_prefix')
            .order('sequence_order', { ascending: true }),
        'LedgerDisplayPrefixProvider service_types',
      )
      const list = (rows ?? []) as { id: string; ledger_job_prefix: string | null; ledger_bid_prefix: string | null }[]
      setPrefixMap(buildLedgerPrefixMap(list))
    } catch {
      setPrefixMap({})
    }
  }, [authUserId])

  useEffect(() => {
    void load()
  }, [load])

  const value = useMemo<LedgerDisplayPrefixContextValue>(
    () => ({
      prefixMap,
      reload: load,
    }),
    [prefixMap, load],
  )

  return <LedgerDisplayPrefixContext.Provider value={value}>{children}</LedgerDisplayPrefixContext.Provider>
}

export function useLedgerDisplayPrefixes(): LedgerDisplayPrefixContextValue {
  return useContext(LedgerDisplayPrefixContext)
}

/** @deprecated Prefer useLedgerDisplayPrefixes().prefixMap */
export function useLedgerPrefixMap(): LedgerPrefixMap {
  return useContext(LedgerDisplayPrefixContext).prefixMap
}
