import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import {
  USAGE_ROLE_FILTERS,
  controlTotals,
  dockRanking,
  needsYouStats,
  peopleBreakdown,
  quietPages,
  topPages,
  weeklySeries,
  type UsageClickRow,
  type UsageCustomerRow,
  type UsagePageRow,
  type UsageRoleFilter,
  type UsageUserRow,
} from '../../lib/usageDashboard'

/**
 * Settings → Usage (v2.2342, dev only): the CX measurement plan's readout —
 * where time goes (since Jul 3), how people navigate (since Aug 26), Needs You
 * engagement, the customer side (portal + estimate opens), quiet pages, and
 * the People view (role → person → their top pages). Data comes from the
 * SECURITY DEFINER usage_* RPCs; each panel degrades to a quiet note when its
 * series has no rows yet.
 */

const RANGES = [7, 30, 60] as const
type UsageView = 'overview' | 'people'

const panelStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '1rem 1.25rem',
} as const

const panelTitleRow = { display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.75rem' } as const
const panelTitle = { margin: 0, fontSize: '0.9375rem', fontWeight: 700 } as const
const panelHint = { color: 'var(--text-faint)', fontSize: '0.75rem' } as const
const quietNote = { color: 'var(--text-muted)', fontSize: '0.8125rem', padding: '0.5rem 0' } as const

function chip(active: boolean): React.CSSProperties {
  return {
    padding: '0.2rem 0.75rem',
    fontSize: '0.75rem',
    fontWeight: active ? 700 : 400,
    border: active ? '1px solid var(--border-blue)' : '1px solid var(--border)',
    borderRadius: 999,
    background: active ? 'var(--bg-blue-tint)' : 'var(--surface)',
    color: active ? 'var(--text-blue-700)' : 'var(--text-muted)',
    cursor: 'pointer',
  }
}

function Bar({ frac, color }: { frac: number; color: string }) {
  return (
    <div style={{ flex: 1, height: 12, background: 'var(--bg-muted)', borderRadius: 3, minWidth: 60 }}>
      <div style={{ width: `${Math.round(frac * 100)}%`, height: '100%', background: color, borderRadius: 3 }} />
    </div>
  )
}

export function SettingsUsageTab() {
  const [days, setDays] = useState<number>(30)
  const [view, setView] = useState<UsageView>('overview')
  const [roleFilter, setRoleFilter] = useState<UsageRoleFilter>('all')
  const [showAllPages, setShowAllPages] = useState(false)
  const [expandedPeople, setExpandedPeople] = useState<Set<string>>(new Set())
  const [pageRows, setPageRows] = useState<UsagePageRow[] | null>(null)
  const [clickRows, setClickRows] = useState<UsageClickRow[] | null>(null)
  const [customerRows, setCustomerRows] = useState<UsageCustomerRow[] | null>(null)
  const [userRows, setUserRows] = useState<UsageUserRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoadError(null)
    const load = async () => {
      const call = async <T,>(fn: string): Promise<T[] | null> => {
        try {
          const data = await withSupabaseRetry(
            async () => {
              const { data, error } = await (supabase as any).rpc(fn, { p_days: days })
              if (error) throw error
              return data
            },
            fn,
          )
          return (data ?? []) as T[]
        } catch {
          return null
        }
      }
      const [pages, clicks, customers, users] = await Promise.all([
        call<UsagePageRow>('usage_page_minutes'),
        call<UsageClickRow>('usage_nav_clicks'),
        call<UsageCustomerRow>('usage_customer_views'),
        call<UsageUserRow>('usage_user_minutes'),
      ])
      if (cancelled) return
      setPageRows(pages)
      setClickRows(clicks)
      setCustomerRows(customers)
      setUserRows(users)
      if (pages === null && clicks === null && customers === null && users === null) {
        setLoadError('Could not load usage data — the reader functions may not be deployed yet.')
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [days])

  const pages = useMemo(() => topPages(pageRows ?? [], roleFilter, showAllPages ? 500 : 8), [pageRows, roleFilter, showAllPages])
  const allPagesCount = useMemo(() => topPages(pageRows ?? [], roleFilter, 500).length, [pageRows, roleFilter])
  const controls = useMemo(() => controlTotals(clickRows ?? []), [clickRows])
  const dock = useMemo(() => dockRanking(clickRows ?? []), [clickRows])
  const needsYou = useMemo(() => needsYouStats(clickRows ?? []), [clickRows])
  const quiet = useMemo(() => quietPages(pageRows ?? [], 30), [pageRows])
  const portal = useMemo(() => weeklySeries(customerRows ?? [], 'portal'), [customerRows])
  const estimates = useMemo(() => weeklySeries(customerRows ?? [], 'estimate_accept'), [customerRows])
  const people = useMemo(() => peopleBreakdown(userRows ?? [], 5), [userRows])

  const togglePerson = (key: string) =>
    setExpandedPeople((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {(['overview', 'people'] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} style={chip(view === v)} aria-pressed={view === v}>
              {v === 'overview' ? 'Overview' : 'People'}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {RANGES.map((d) => (
            <button key={d} type="button" onClick={() => setDays(d)} style={chip(days === d)} aria-pressed={days === d}>
              {d} days
            </button>
          ))}
        </div>
      </div>
      <div style={{ color: 'var(--text-faint)', fontSize: '0.75rem', marginTop: '-0.5rem' }}>
        Time on pages recorded since Jul 3 · nav clicks since Aug 26 · portal views since Aug 26 · estimate opens since Apr
      </div>
      {loadError ? <div style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{loadError}</div> : null}

      {view === 'people' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {people.length === 0 ? <div style={quietNote}>No activity recorded in this range yet.</div> : null}
          {people.map((group) => (
            <div key={group.role} style={panelStyle}>
              <div style={panelTitleRow}>
                <h3 style={panelTitle}>{group.role}</h3>
                <span style={panelHint}>
                  {group.people.length} {group.people.length === 1 ? 'person' : 'people'} ·{' '}
                  {group.minutes.toLocaleString('en-US')} min
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {group.people.map((p) => {
                  const key = `${group.role}:${p.name}`
                  const open = expandedPeople.has(key)
                  return (
                    <div key={key}>
                      <button
                        type="button"
                        onClick={() => togglePerson(key)}
                        aria-expanded={open}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.6rem',
                          width: '100%',
                          background: 'none',
                          border: 'none',
                          padding: '0.15rem 0',
                          cursor: 'pointer',
                          font: 'inherit',
                          color: 'inherit',
                          textAlign: 'left',
                        }}
                      >
                        <span aria-hidden style={{ width: 10, color: 'var(--text-faint)', fontSize: '0.6875rem' }}>
                          {open ? '▼' : '▶'}
                        </span>
                        <span style={{ width: 150, fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.name}
                        </span>
                        <Bar frac={p.frac} color="#3b82f6" />
                        <span style={{ width: 120, textAlign: 'right', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}>
                          {p.minutes.toLocaleString('en-US')} min · {p.activeDays}d
                        </span>
                      </button>
                      {open ? (
                        <div style={{ margin: '0.25rem 0 0.5rem 1.6rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {p.topPages.map((tp) => (
                            <div key={tp.page} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <span style={{ width: 150, fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {tp.page}
                              </span>
                              <Bar frac={tp.frac} color="var(--text-faint-300)" />
                              <span style={{ width: 70, textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                                {tp.minutes.toLocaleString('en-US')} min
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem' }}>
          <div style={panelStyle}>
            <div style={panelTitleRow}>
              <h3 style={panelTitle}>Where the time goes</h3>
              <span style={panelHint}>active minutes · people</span>
            </div>
            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {USAGE_ROLE_FILTERS.map((f) => (
                <button key={f.key} type="button" onClick={() => setRoleFilter(f.key)} style={{ ...chip(roleFilter === f.key), fontSize: '0.6875rem' }} aria-pressed={roleFilter === f.key}>
                  {f.label}
                </button>
              ))}
            </div>
            {pages.length === 0 ? <div style={quietNote}>Nothing recorded for this slice yet.</div> : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {pages.map((r) => (
                <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8125rem' }}>
                  <span style={{ width: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
                  <Bar frac={r.frac} color="#3b82f6" />
                  <span style={{ width: 84, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {r.value.toLocaleString('en-US')} · {r.people}
                  </span>
                </div>
              ))}
            </div>
            {allPagesCount > 8 ? (
              <button type="button" onClick={() => setShowAllPages((s) => !s)} style={{ background: 'none', border: 'none', color: 'var(--text-link)', fontSize: '0.75rem', cursor: 'pointer', padding: 0, marginTop: '0.625rem' }}>
                {showAllPages ? 'Show top 8 only' : `Show all ${allPagesCount} pages →`}
              </button>
            ) : null}
          </div>

          <div style={panelStyle}>
            <div style={panelTitleRow}>
              <h3 style={panelTitle}>How people get around</h3>
              <span style={panelHint}>clicks by control</span>
            </div>
            {controls.length === 0 ? <div style={quietNote}>No clicks recorded in this range yet.</div> : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {controls.map((r) => (
                <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8125rem' }}>
                  <span style={{ width: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
                  <Bar frac={r.frac} color="#8b5cf6" />
                  <span style={{ width: 60, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.value.toLocaleString('en-US')}</span>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.75rem', paddingTop: '0.625rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                Dashboard dock tabs, ranked
              </div>
              {dock.length === 0 ? <div style={quietNote}>No dock clicks yet.</div> : null}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', fontSize: '0.75rem' }}>
                {dock.map((d) => (
                  <span key={d.label} style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 999, padding: '0.15rem 0.6rem' }}>
                    {d.label} <b style={{ fontVariantNumeric: 'tabular-nums' }}>{d.clicks}</b>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div style={panelStyle}>
            <div style={panelTitleRow}>
              <h3 style={panelTitle}>Customers</h3>
              <span style={panelHint}>do they open what we send?</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem' }}>
              {[
                { title: 'Portal statements opened', series: portal, unit: 'companies', color: '#34d399' },
                { title: 'Estimates opened', series: estimates, unit: 'estimates', color: '#60a5fa' },
              ].map(({ title, series, unit, color }) => (
                <div key={title}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</div>
                  <div style={{ fontSize: '1.375rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {series.totalViews.toLocaleString('en-US')}{' '}
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                      · {series.totalEntities} {unit}
                    </span>
                  </div>
                  {series.weeks.length === 0 ? (
                    <div style={quietNote}>None recorded in this range.</div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 34, marginTop: '0.5rem' }}>
                      {series.weeks.map((w) => (
                        <div key={w.bucket} title={`${w.bucket}: ${w.views}`} style={{ flex: 1, height: `${Math.max(8, Math.round(w.frac * 100))}%`, background: color, opacity: w.frac === 1 ? 1 : 0.55, borderRadius: 2 }} />
                      ))}
                    </div>
                  )}
                  <div style={{ color: 'var(--text-faint)', fontSize: '0.6875rem', marginTop: 2 }}>by week</div>
                </div>
              ))}
            </div>
          </div>

          <div style={panelStyle}>
            <div style={panelTitleRow}>
              <h3 style={panelTitle}>Quiet pages</h3>
              <span style={panelHint}>under 30 minutes company-wide — fold candidates</span>
            </div>
            {quiet.length === 0 ? <div style={quietNote}>Nothing under the threshold in this range.</div> : null}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', fontSize: '0.75rem' }}>
              {quiet.map((q) => (
                <span key={q.page} style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 999, padding: '0.15rem 0.6rem', color: 'var(--text-muted)' }}>
                  {q.page} <b style={{ fontVariantNumeric: 'tabular-nums' }}>{q.minutes}m</b>
                </span>
              ))}
            </div>
            <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.875rem', paddingTop: '0.625rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                Needs You engagement
              </div>
              {needsYou.actions.length === 0 && needsYou.skips === 0 ? <div style={quietNote}>No Needs You clicks yet.</div> : null}
              <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.8125rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {needsYou.actions[0] ? (
                  <span style={{ color: 'var(--text-muted)' }}>
                    top action: <span style={{ color: 'var(--text-strong)' }}>{needsYou.actions[0].label} · {needsYou.actions[0].clicks}</span>
                  </span>
                ) : null}
                <span style={{ color: 'var(--text-muted)' }}>
                  skips: <span style={{ color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{needsYou.skips}</span>
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  switched to Walk <b style={{ fontVariantNumeric: 'tabular-nums' }}>{needsYou.modeSwitchesToWalk}</b> · to Cards{' '}
                  <b style={{ fontVariantNumeric: 'tabular-nums' }}>{needsYou.modeSwitchesToCards}</b>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
