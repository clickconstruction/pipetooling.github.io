import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import type { Database } from '../types/database'
import { useAuth, type UserRole } from './useAuth'

const NICKNAME_ROLES: UserRole[] = ['dev', 'master_technician', 'assistant', 'controller']

function canLoadNicknames(role: UserRole | null): boolean {
  return role !== null && NICKNAME_ROLES.includes(role)
}

async function fetchMercuryNicknameMaps(): Promise<{
  nicknameByAccount: Record<string, string>
  nicknameByDebitCard: Record<string, string>
}> {
  const [accRaw, debRaw] = await Promise.all([
    withSupabaseRetry(
      async () => supabase.from('mercury_account_nicknames').select('mercury_account_id, nickname'),
      'load mercury_account_nicknames',
    ),
    withSupabaseRetry(
      async () => supabase.from('mercury_debit_card_nicknames').select('mercury_debit_card_id, nickname'),
      'load mercury_debit_card_nicknames',
    ),
  ])
  const nicknameByAccount: Record<string, string> = {}
  const nicknameByDebitCard: Record<string, string> = {}
  const accList =
    (accRaw ?? []) as Pick<
      Database['public']['Tables']['mercury_account_nicknames']['Row'],
      'mercury_account_id' | 'nickname'
    >[]
  for (const r of accList) nicknameByAccount[r.mercury_account_id] = r.nickname
  const debList =
    (debRaw ?? []) as Pick<
      Database['public']['Tables']['mercury_debit_card_nicknames']['Row'],
      'mercury_debit_card_id' | 'nickname'
    >[]
  for (const r of debList) {
    nicknameByDebitCard[String(r.mercury_debit_card_id).toLowerCase()] = r.nickname
  }
  return { nicknameByAccount, nicknameByDebitCard }
}

export type UseMercuryLedgerNicknamesOptions = {
  /** When false, no fetch runs (default true). Use e.g. `open` on a modal to load only when visible. */
  enabled?: boolean
}

export function useMercuryLedgerNicknames(options?: UseMercuryLedgerNicknamesOptions) {
  const { role } = useAuth()
  const enabled = options?.enabled !== false
  const [nicknameByAccount, setNicknameByAccount] = useState<Record<string, string>>({})
  const [nicknameByDebitCard, setNicknameByDebitCard] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!canLoadNicknames(role)) {
      setNicknameByAccount({})
      setNicknameByDebitCard({})
      return
    }
    setLoading(true)
    try {
      const m = await fetchMercuryNicknameMaps()
      setNicknameByAccount(m.nicknameByAccount)
      setNicknameByDebitCard(m.nicknameByDebitCard)
    } catch {
      setNicknameByAccount({})
      setNicknameByDebitCard({})
    } finally {
      setLoading(false)
    }
  }, [role])

  useEffect(() => {
    if (!canLoadNicknames(role)) {
      setNicknameByAccount({})
      setNicknameByDebitCard({})
      return
    }
    if (!enabled) return

    let cancelled = false
    setLoading(true)
    void fetchMercuryNicknameMaps()
      .then((m) => {
        if (!cancelled) {
          setNicknameByAccount(m.nicknameByAccount)
          setNicknameByDebitCard(m.nicknameByDebitCard)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNicknameByAccount({})
          setNicknameByDebitCard({})
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      setLoading(false)
    }
  }, [enabled, role])

  return { nicknameByAccount, nicknameByDebitCard, loading, reload }
}
