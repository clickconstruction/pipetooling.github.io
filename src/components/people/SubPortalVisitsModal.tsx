/**
 * The visits modal (v2.2922): the whole trail for one sub's portal — two
 * summary tiles (outside opens · team looks), an All · Outside · Team switch,
 * the trail grouped by day with who and how, and Copy link / Preview at the
 * bottom. Opened by tap, click or long press on a visit line (Who's owed, the
 * sheet story's Portal cell) and from the globe's Trail row. Previews are
 * never on the list — the RPC drops them.
 */
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { resolveSubPortalUrl } from '../../lib/subPortal/resolveSubPortalUrl'
import { withPreviewFlag } from '../../lib/publicViewCounting'
import { fetchSubPortalVisitSummaries } from '../../hooks/useSubPortalVisitSummaries'
import { groupVisitsByDay, parseVisitRow, timeWord, visitHow, visitMatches, whenWord, type SubPortalVisit, type SubPortalVisitSummary, type VisitFilter } from '../../lib/portal/subPortalVisits'

export type SubPortalVisitsModalProps = {
  personId: string | null
  personName: string
  onClose: () => void
}

const tag = (viewer: SubPortalVisit['viewer']) => (
  <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, background: viewer === 'staff' ? 'var(--bg-blue-tint)' : 'var(--bg-green-tint)', color: viewer === 'staff' ? 'var(--text-blue-700)' : 'var(--text-green-700)', whiteSpace: 'nowrap' }}>
    {viewer === 'staff' ? 'Team' : 'Outside'}
  </span>
)

export function SubPortalVisitsModal({ personId, personName, onClose }: SubPortalVisitsModalProps) {
  const { showToast } = useToastContext()
  const [summary, setSummary] = useState<SubPortalVisitSummary | null>(null)
  const [visits, setVisits] = useState<SubPortalVisit[] | null>(null)
  /** The RPCs are not there yet (migration not pushed) or this viewer may not read them. */
  const [unavailable, setUnavailable] = useState(false)
  const [filter, setFilter] = useState<VisitFilter>('all')
  const [busy, setBusy] = useState(false)
  const now = useMemo(() => new Date(), [])

  useEffect(() => {
    if (!personId) return
    setSummary(null)
    setVisits(null)
    setUnavailable(false)
    setFilter('all')
    let cancelled = false
    void (async () => {
      const [m, { data, error }] = await Promise.all([fetchSubPortalVisitSummaries([personId]), supabase.rpc('sub_portal_visits' as never, { p_person_id: personId, p_limit: 300 } as never)])
      if (cancelled) return
      if (!m || error) {
        setUnavailable(true)
        setVisits([])
        return
      }
      setSummary(m.get(personId) ?? null)
      setVisits(((data ?? []) as unknown[]).map(parseVisitRow).filter((v): v is SubPortalVisit => v != null))
    })()
    return () => {
      cancelled = true
    }
  }, [personId])

  useEffect(() => {
    if (!personId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [personId, onClose])

  if (!personId) return null

  const firstShared = summary?.firstOutsideAt ?? null
  const days = groupVisitsByDay((visits ?? []).filter((v) => visitMatches(filter, v)), now)
  const counts = { all: (visits ?? []).filter((v) => v.viewer !== 'preview').length, outside: (visits ?? []).filter((v) => v.viewer === 'outside').length, staff: (visits ?? []).filter((v) => v.viewer === 'staff').length }

  async function copyLink() {
    setBusy(true)
    try {
      const url = await resolveSubPortalUrl(personId!)
      if (!url) throw new Error('No portal link for this sub yet')
      await navigator.clipboard.writeText(url)
      showToast('Link copied', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not copy the link', 'error')
    } finally {
      setBusy(false)
    }
  }
  function preview() {
    const tab = window.open('about:blank', '_blank')
    if (tab) tab.opener = null
    void (async () => {
      const base = await resolveSubPortalUrl(personId!, { tokenOnly: true })
      if (!base) {
        tab?.close()
        showToast('No portal link for this sub yet', 'error')
        return
      }
      const url = withPreviewFlag(base)
      if (tab) tab.location.href = url
      else window.open(url, '_blank', 'noopener')
    })()
  }

  const tile = (k: string, v: string, s: string) => (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', minWidth: 0 }}>
      <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 600 }}>{k}</div>
      <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{v}</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s}</div>
    </div>
  )
  const btn = (primary: boolean) => ({ padding: '0.35rem 0.8rem', background: primary ? '#2563eb' : 'var(--surface)', color: primary ? 'white' : 'var(--text-700)', border: primary ? 'none' : '1px solid var(--border-strong)', borderRadius: 6, cursor: busy ? 'wait' : 'pointer', fontSize: '0.8125rem', fontWeight: 600 }) as const

  return (
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
      <div role="dialog" aria-modal="true" aria-label={`${personName}'s portal visits`} onClick={(e) => e.stopPropagation()} style={{ width: 'min(540px, 100%)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', color: 'inherit', border: '1px solid var(--border-strong)', borderRadius: 12, boxShadow: '0 20px 50px rgba(0,0,0,0.35)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '0.85rem 1rem 0.6rem', borderBottom: '1px solid var(--border)' }}>
          <b style={{ fontSize: '0.95rem' }}>{personName}'s portal · visits</b>
          <button type="button" onClick={onClose} aria-label="Close" style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: '1.1rem', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0.75rem 1rem' }}>
            {tile('Outside', summary ? `${summary.outsideOpens} open${summary.outsideOpens === 1 ? '' : 's'}` : unavailable ? '—' : '…', summary?.lastOutsideAt ? `last ${whenWord(summary.lastOutsideAt, now)}, ${timeWord(summary.lastOutsideAt)}${firstShared ? ` · first ${whenWord(firstShared, now)}` : ''}` : summary ? 'never opened' : '')}
            {tile('Team', summary ? `${summary.staffLooks} look${summary.staffLooks === 1 ? '' : 's'}` : unavailable ? '—' : '…', summary?.lastStaffAt ? `last ${summary.lastStaffName ? summary.lastStaffName.split(/\s+/)[0] + ' · ' : ''}${whenWord(summary.lastStaffAt, now)}, ${timeWord(summary.lastStaffAt)}` : summary ? 'nobody on the team yet' : '')}
          </div>
          <div style={{ display: 'flex', gap: 6, padding: '0 1rem 0.5rem' }}>
            {(['all', 'outside', 'staff'] as const).map((f) => {
              const on = filter === f
              return (
                <button key={f} type="button" aria-pressed={on} onClick={() => setFilter(f)} style={{ border: `1px solid ${on ? 'var(--text-700)' : 'var(--border-strong)'}`, background: on ? 'var(--text-700)' : 'var(--surface)', color: on ? 'var(--surface)' : 'var(--text-700)', borderRadius: 999, padding: '0.15rem 0.65rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                  {f === 'all' ? 'All' : f === 'outside' ? 'Outside' : 'Team'} <span style={{ opacity: 0.7 }}>{counts[f]}</span>
                </button>
              )
            })}
          </div>
          {unavailable ? (
            <p style={{ padding: '0.5rem 1rem 1rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Visit records aren't available yet.</p>
          ) : visits == null ? (
            <p style={{ padding: '0.5rem 1rem 1rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Loading the trail…</p>
          ) : days.length === 0 ? (
            <p style={{ padding: '0.5rem 1rem 1rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{filter === 'staff' ? 'Nobody on the team has opened this page.' : filter === 'outside' ? 'Nobody outside the team has opened this page yet.' : 'No visits on record yet.'}</p>
          ) : (
            days.map((d) => (
              <div key={d.day}>
                <div style={{ padding: '0.5rem 1rem 0', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 600 }}>{d.day}</div>
                {d.rows.map((v, i) => (
                  <div key={`${v.occurredAt}-${i}`} style={{ display: 'grid', gridTemplateColumns: '68px 1fr auto', gap: 10, padding: '0.35rem 1rem', fontSize: '0.8125rem', borderBottom: '1px dotted var(--border)', alignItems: 'baseline' }}>
                    <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', fontSize: '0.75rem' }}>{timeWord(v.occurredAt)}</span>
                    <span>
                      {tag(v.viewer)}
                      {v.viewer === 'staff' ? <span style={{ marginLeft: 6 }}>{v.staffName ?? 'a teammate'}</span> : null}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      {visitHow(v)}
                      {firstShared && v.viewer === 'outside' && v.occurredAt === firstShared ? ' · first open' : ''}
                    </span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '0.7rem 1rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" style={btn(true)} disabled={busy} onClick={() => void copyLink()}>Copy link</button>
          <button type="button" style={btn(false)} disabled={busy} onClick={preview}>Preview as {personName.trim().split(/\s+/)[0] || 'the sub'}</button>
          <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Previews are not on this list</span>
        </div>
      </div>
    </div>
  )
}
