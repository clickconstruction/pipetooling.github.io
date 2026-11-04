import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { CHARGE_STANDINGS, CHARGE_STANDING_HINTS, CHARGE_STANDING_WORDS, chargeStandingSavedWords, parseChargeStanding, type ChargeStanding } from '../../lib/charges/rateCard'

/**
 * Settings → Jobs & billing → Rates charged by crew → Who counts as what (punch list #254, the live pass of 2026-11-03):
 * every person with their *Charged as* in one list (those no longer here after them, since their past days still price
 * by it), so the office sets the standings that price a crew-day here instead of on each desk. Until someone out on a
 * day counts as a master, a tech or a helper, that day prices at nothing, and on the day the train went live nobody did.
 * Writes `users.charge_standing` as the desk does, under the desk's gate (a dev, not in training mode); anyone else reads
 * the list. Samples, digital twins and walk testers are left out. Since v2.6501 the People records with no login sit in
 * a group of their own with the same select, writing `people.charge_standing`: their days come from the pay records,
 * and the standing on the record prices them. A record linked to a login is not listed twice; the login's row is it.
 */

type Person = { id: string; name: string; role: string | null; standing: ChargeStanding; archived: boolean; /** A People record with no login: the pick saves to `people.charge_standing`. */ noLogin: boolean }

const ROLE_WORDS: Record<string, string> = {
  dev: 'Dev',
  master_technician: 'Master',
  primary: 'Primary',
  assistant: 'Assistant',
  controller: 'Controller',
  superintendent: 'Superintendent',
  estimator: 'Estimator',
  helpers: 'Helper',
  helper: 'Helper',
  subcontractor: 'Subcontractor',
  sub: 'Sub',
}

const cell = { padding: '0.3rem 0.4rem', borderBottom: '1px solid var(--border)' } as const

function whoCountsCountWords(people: ReadonlyArray<{ standing: ChargeStanding }>): string {
  const counted = people.filter((p) => p.standing !== 'none').length
  return `${counted} of ${people.length} ${people.length === 1 ? 'person counts' : 'people count'} as a master, a tech or a helper.`
}

export function WhoCountsAsWhatList() {
  const { role, readOnly } = useAuth()
  const { showToast } = useToastContext()
  const editable = role === 'dev' && !readOnly
  const [people, setPeople] = useState<Person[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [{ data, error: readError }, { data: records, error: recordsError }] = await Promise.all([
        supabase.from('users').select('*').order('name'),
        // The People records with no login (v2.6501): each holds its own Charged as.
        supabase.from('people').select('*').is('account_user_id', null).order('name'),
      ])
      if (readError) throw readError
      if (recordsError) throw recordsError
      const rows = (data ?? []) as unknown as Array<{ id: string; name: string | null; role: string | null; charge_standing?: unknown; is_sample?: boolean | null; is_digital_twin?: boolean | null; is_walk_tester?: boolean | null; archived_at?: string | null }>
      const recordRows = (records ?? []) as unknown as Array<{ id: string; name: string | null; kind: string | null; charge_standing?: unknown; archived_at?: string | null }>
      setPeople([
        ...rows
          .filter((u) => !u.is_sample && !u.is_digital_twin && !u.is_walk_tester && (u.name ?? '').trim() !== '')
          .map((u) => ({ id: u.id, name: (u.name ?? '').trim(), role: u.role, standing: parseChargeStanding(u.charge_standing), archived: Boolean(u.archived_at), noLogin: false })),
        ...recordRows
          .filter((p) => (p.name ?? '').trim() !== '')
          .map((p) => ({ id: p.id, name: (p.name ?? '').trim(), role: p.kind, standing: parseChargeStanding(p.charge_standing), archived: Boolean(p.archived_at), noLogin: true })),
      ])
    } catch (e) {
      setError(formatErrorMessage(e, 'The people could not be read.'))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function setStanding(p: Person, next: ChargeStanding) {
    if (next === p.standing || busyId) return
    setBusyId(p.id)
    setPeople((prev) => prev?.map((x) => (x.id === p.id ? { ...x, standing: next } : x)) ?? prev)
    try {
      const { error: writeError } = p.noLogin
        ? await supabase.from('people').update({ charge_standing: next } as never).eq('id', p.id)
        : await supabase.from('users').update({ charge_standing: next } as never).eq('id', p.id)
      if (writeError) throw writeError
      showToast(chargeStandingSavedWords(p.name, next), 'success')
    } catch (e) {
      setPeople((prev) => prev?.map((x) => (x.id === p.id ? { ...x, standing: p.standing } : x)) ?? prev)
      showToast(formatErrorMessage(e, `${p.name}’s standing could not be saved.`), 'error')
    } finally {
      setBusyId(null)
    }
  }

  const rowFor = (p: Person) => (
    <tr key={p.id} data-testid="who-counts-row" data-no-login={p.noLogin ? 'true' : undefined}>
      <td style={cell}>
        {p.name}
        <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {ROLE_WORDS[p.role ?? ''] ?? p.role ?? ''}
          {p.noLogin && p.archived ? ' · left' : ''}
        </span>
      </td>
      <td style={{ ...cell, textAlign: 'right' }}>
        {editable ? (
          <select
            value={p.standing}
            disabled={busyId != null}
            onChange={(e) => void setStanding(p, e.target.value as ChargeStanding)}
            aria-label={`${p.name} is charged as`}
            title={CHARGE_STANDING_HINTS[p.standing]}
            style={{ padding: '0.3rem 0.4rem', fontSize: '0.8125rem', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)' }}
          >
            {CHARGE_STANDINGS.map((s) => (
              <option key={s} value={s}>
                {CHARGE_STANDING_WORDS[s]}
              </option>
            ))}
          </select>
        ) : (
          <span style={{ color: p.standing === 'none' ? 'var(--text-muted)' : 'var(--text-base)' }}>{CHARGE_STANDING_WORDS[p.standing]}</span>
        )}
      </td>
    </tr>
  )

  const here = (people ?? []).filter((p) => !p.archived && !p.noLogin)
  const gone = (people ?? []).filter((p) => p.archived && !p.noLogin)
  // A record with no login: listed while here, and after leaving while a standing still prices its past days.
  const noLogin = (people ?? []).filter((p) => p.noLogin && (!p.archived || p.standing !== 'none'))

  return (
    <section id="who-counts-as-what" data-testid="who-counts-as-what" style={{ display: 'grid', gap: '0.5rem', maxWidth: 560, marginTop: '1.25rem', scrollMarginTop: '5rem' }}>
      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-strong)' }}>Who counts as what</h4>
      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8125rem', lineHeight: 1.45 }}>
        Each person’s Charged as, the same choice as on their desk. A day prices only when someone out counts as a master, a tech or a helper.
        {editable ? ' A change saves as you pick it.' : ' A dev sets these.'}
      </p>
      {error ? (
        <div style={{ display: 'grid', gap: '0.4rem', justifyItems: 'start' }}>
          <p style={{ margin: 0, color: 'var(--text-red-600)', fontSize: '0.8125rem' }} data-testid="who-counts-error">
            {error}
          </p>
          <button type="button" onClick={() => void load()} style={{ padding: '0.35rem 0.8rem', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer', fontSize: '0.8125rem' }}>
            Try again
          </button>
        </div>
      ) : people == null ? (
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Reading…</p>
      ) : (
        <>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-base)', fontWeight: 600 }} data-testid="who-counts-count">
            {whoCountsCountWords(here)}
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <tbody>{here.map(rowFor)}</tbody>
          </table>
          {noLogin.length ? (
            <div data-testid="who-counts-no-login" style={{ display: 'grid', gap: '0.3rem', marginTop: '0.5rem' }}>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>People with no login · their days come from the pay records</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <tbody>{noLogin.map(rowFor)}</tbody>
              </table>
            </div>
          ) : null}
          {gone.length ? (
            <div data-testid="who-counts-archived" style={{ display: 'grid', gap: '0.3rem', marginTop: '0.5rem' }}>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>People who left · their past days still price by it</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <tbody>{gone.map(rowFor)}</tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
