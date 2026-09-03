import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { resolvePersonKey, type PersonKey, type PersonKeyPersonRow, type PersonKeyUserRow } from '../lib/people/personKey'

export type PersonDeskUserRow = PersonKeyUserRow & {
  estimator_service_type_ids: string[] | null
  primary_service_type_ids: string[] | null
  superintendent_service_type_ids: string[] | null
  subcontractor_service_type_ids: string[] | null
  helpers_service_type_ids: string[] | null
}

export type PersonDeskData = {
  key: PersonKey | null
  user: PersonDeskUserRow | null
  person: PersonKeyPersonRow | null
  loading: boolean
  error: string | null
  reload: () => void
}

const USER_SELECT =
  'id, name, email, role, archived_at, read_only, last_sign_in_at, estimator_service_type_ids, primary_service_type_ids, superintendent_service_type_ids, subcontractor_service_type_ids, helpers_service_type_ids'
const PERSON_SELECT = 'id, name, email, kind, archived_at, account_user_id'

/**
 * Resolve a Person Desk key from whichever id the opener had (v2.2701):
 * the account row, its linked roster row (or an email-matched unlinked one,
 * reported as a gap, never auto-linked), and whether a pay-config row exists
 * under the pay name. `changeKey` refetches after a section writes.
 */
export function usePersonDesk(
  args: { userId?: string | null; personId?: string | null } | null,
  changeKey: number,
): PersonDeskData {
  const [user, setUser] = useState<PersonDeskUserRow | null>(null)
  const [person, setPerson] = useState<PersonKeyPersonRow | null>(null)
  const [key, setKey] = useState<PersonKey | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [localBump, setLocalBump] = useState(0)

  const reload = useCallback(() => setLocalBump((n) => n + 1), [])

  const userId = args?.userId ?? null
  const personId = args?.personId ?? null

  useEffect(() => {
    if (!userId && !personId) {
      setUser(null)
      setPerson(null)
      setKey(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        let u: PersonDeskUserRow | null = null
        let p: PersonKeyPersonRow | null = null

        if (personId) {
          const { data, error: e } = await supabase.from('people').select(PERSON_SELECT).eq('id', personId).maybeSingle()
          if (e) throw e
          p = (data as PersonKeyPersonRow | null) ?? null
        }
        const accountId = userId ?? p?.account_user_id ?? null
        if (accountId) {
          const { data, error: e } = await supabase.from('users').select(USER_SELECT).eq('id', accountId).maybeSingle()
          if (e) throw e
          u = (data as PersonDeskUserRow | null) ?? null
        }
        if (!p && u) {
          const { data, error: e } = await supabase
            .from('people')
            .select(PERSON_SELECT)
            .eq('account_user_id', u.id)
            .order('archived_at', { ascending: true, nullsFirst: true })
            .limit(1)
          if (e) throw e
          p = ((data ?? [])[0] as PersonKeyPersonRow | undefined) ?? null
        }
        let emailMatched: PersonKeyPersonRow | null = null
        if (!p && u?.email && !u.email.includes('"')) {
          const { data } = await supabase
            .from('people')
            .select(PERSON_SELECT)
            .is('account_user_id', null)
            .is('archived_at', null)
            .ilike('email', u.email.trim())
            .limit(1)
          emailMatched = ((data ?? [])[0] as PersonKeyPersonRow | undefined) ?? null
        }

        const names = Array.from(new Set([u?.name?.trim(), p?.name?.trim()].filter((n): n is string => Boolean(n))))
        let payConfigNames: string[] | null = null
        if (names.length > 0) {
          const { data, error: e } = await supabase.from('people_pay_config').select('person_name').in('person_name', names)
          // A role that cannot read the table gets no gap rather than a false one.
          payConfigNames = e ? null : ((data ?? []) as Array<{ person_name: string }>).map((r) => r.person_name)
        }

        if (cancelled) return
        setUser(u)
        setPerson(p)
        setKey(resolvePersonKey({ user: u, person: p, emailMatchedPerson: emailMatched, payConfigNames }))
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Could not load this person')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, personId, changeKey, localBump])

  return { key, user, person, loading, error, reload }
}
