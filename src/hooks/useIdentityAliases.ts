import { useCallback, useEffect, useState } from 'react'
import { loadIdentityAliases, type IdentityAliasMap, type IdentityKind } from '../lib/identityAliases'

/** The alias map for one identity kind, loaded once; `refresh()` after a save. */
export function useIdentityAliases(kind: IdentityKind): { aliases: IdentityAliasMap; refresh: () => Promise<void> } {
  const [aliases, setAliases] = useState<IdentityAliasMap>(() => new Map())
  const refresh = useCallback(async () => {
    setAliases(await loadIdentityAliases(kind))
  }, [kind])
  useEffect(() => {
    void refresh()
  }, [refresh])
  return { aliases, refresh }
}
