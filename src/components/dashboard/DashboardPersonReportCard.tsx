import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { DashboardGroupCard } from './DashboardGroupCard'

/**
 * "HR Report" — the field-report intake card (v2.2235), for master
 * technicians and devs. Writes a dated observation about a person into
 * person_reports, where it queues on People → HR → Pending reports until a
 * dev (or the HR agent) files it as an append-only entry on that person's
 * file.
 *
 * The point is capture-while-fresh: the master saw it, the file needs it, and
 * nobody should have to remember it until the next review. Authors see only
 * their own submissions and their status; the queue itself is dev-only.
 *
 * Fail-soft: if the migration isn't pushed yet the card renders nothing.
 */

type PersonOpt = { id: string; name: string; kind: string | null }
type MineRow = { id: string; subject_person_id: string; content: string; status: string; created_at: string }

const PENDING_STATUS_STYLE = { bg: 'var(--bg-subtle)', fg: 'var(--text-amber-700)', label: 'pending' }
const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  pending: PENDING_STATUS_STYLE,
  filed: { bg: 'var(--bg-subtle)', fg: '#16a34a', label: 'filed' },
  dismissed: { bg: 'var(--bg-muted)', fg: 'var(--text-muted)', label: 'closed' },
}

export function DashboardPersonReportCard({ visible }: { visible: boolean }) {
  const { user: authUser, profileName } = useAuth()
  const { showToast } = useToastContext()
  const [people, setPeople] = useState<PersonOpt[] | null>(null)
  const [mine, setMine] = useState<MineRow[]>([])
  const [unavailable, setUnavailable] = useState(false)
  const [personId, setPersonId] = useState('')
  const [occurred, setOccurred] = useState(() => calendarYmdInAppTzFromIso(new Date().toISOString()))
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!visible || !authUser?.id) return
    const [pRes, mRes] = await Promise.all([
      supabase.from('people').select('id, name, kind, archived_at').is('archived_at', null).order('name'),
      supabase
        .from('person_reports')
        .select('id, subject_person_id, content, status, created_at')
        .eq('author_user_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(5),
    ])
    setPeople(((pRes.data ?? []) as (PersonOpt & { archived_at: string | null })[]).map((p) => ({ id: p.id, name: p.name, kind: p.kind })))
    if (mRes.error) {
      // 42P01 before the migration lands — hide the card entirely.
      setUnavailable(true)
      return
    }
    setUnavailable(false)
    setMine((mRes.data ?? []) as MineRow[])
  }, [visible, authUser?.id])

  useEffect(() => {
    void load()
  }, [load])

  const nameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of people ?? []) m.set(p.id, p.name)
    return m
  }, [people])

  if (!visible || unavailable || people == null) return null

  const canSend = personId !== '' && content.trim() !== '' && occurred !== '' && !busy

  async function send() {
    if (!canSend || !authUser?.id) return
    setBusy(true)
    const { error } = await supabase.from('person_reports').insert({
      subject_person_id: personId,
      author_user_id: authUser.id,
      author_name: profileName || '',
      occurred_date: occurred,
      content: content.trim(),
    })
    if (error) {
      showToast(`Could not send: ${error.message}`, 'error')
    } else {
      showToast('Sent to HR — it will be filed on their record.', 'success')
      setContent('')
      setPersonId('')
      await load()
    }
    setBusy(false)
  }

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    font: 'inherit',
    fontSize: '0.875rem',
    padding: '0.4rem 0.5rem',
    border: '1px solid var(--border)',
    borderRadius: 7,
    background: 'var(--surface)',
    color: 'inherit',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.72rem',
    fontWeight: 650,
    color: 'var(--text-700)',
    margin: '0.55rem 0 0.2rem',
  }

  return (
    <DashboardGroupCard
      title="HR Report"
      collapseStorageKey="dashboard_person_report_card_v1"
      defaultCollapsed
    >
      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.2rem' }}>
        For anything worth remembering — good or bad. A dev folds it into their record.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 190px', minWidth: 0 }}>
          <label style={labelStyle} htmlFor="person-report-who">Who is this about?</label>
          <select id="person-report-who" style={fieldStyle} value={personId} onChange={(e) => setPersonId(e.target.value)}>
            <option value="">Pick a person…</option>
            {(people ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.kind ? ` — ${p.kind}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: '0 1 150px' }}>
          <label style={labelStyle} htmlFor="person-report-when">When did it happen?</label>
          <input id="person-report-when" type="date" style={fieldStyle} value={occurred} onChange={(e) => setOccurred(e.target.value)} />
        </div>
      </div>

      <label style={labelStyle} htmlFor="person-report-what">What happened?</label>
      <textarea
        id="person-report-what"
        style={{ ...fieldStyle, minHeight: '5.5rem', resize: 'vertical', lineHeight: 1.5 }}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="No-show at Kingsbury this morning — crew waited 45 min, called 3 times, no callback…"
      />
      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.3rem 0 0' }}>
        Facts and dates hold up later — “missed Tue and Thu, third time this month” beats “unreliable.” If it’s your read
        rather than a fact, say so.
      </p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Visible to devs only.</span>
        <button
          type="button"
          onClick={() => void send()}
          disabled={!canSend}
          style={{
            font: 'inherit',
            fontSize: '0.85rem',
            fontWeight: 650,
            padding: '0.45rem 0.9rem',
            borderRadius: 7,
            border: 'none',
            background: '#2563eb',
            color: 'var(--surface)',
            cursor: canSend ? 'pointer' : 'default',
            opacity: canSend ? 1 : 0.5,
          }}
        >
          {busy ? 'Sending…' : 'Send to HR'}
        </button>
      </div>

      {mine.length > 0 ? (
        <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.75rem', paddingTop: '0.5rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 650, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
            Your recent reports
          </div>
          {mine.map((r) => {
            const s = STATUS_STYLE[r.status] ?? PENDING_STATUS_STYLE
            return (
              <div key={r.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', padding: '0.3rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.8rem' }}>
                <span style={{ fontWeight: 650, flex: 'none' }}>{nameById.get(r.subject_person_id) ?? 'Someone'}</span>
                <span style={{ flex: 1, minWidth: 0, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.content}
                </span>
                <span style={{ flex: 'none', fontSize: '0.68rem', fontWeight: 700, padding: '0.05rem 0.4rem', borderRadius: 999, background: s.bg, color: s.fg }}>
                  {s.label}
                </span>
              </div>
            )
          })}
        </div>
      ) : null}
    </DashboardGroupCard>
  )
}
