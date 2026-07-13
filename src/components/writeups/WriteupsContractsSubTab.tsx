import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import type { SearchableSelectOption } from '../SearchableSelect'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { WriteupEditorModal, type WriteupListRow } from './WriteupEditorModal'
import { WriteupTemplateManagerModal, type WriteupTemplateRow } from './WriteupTemplateManagerModal'
import { NcnsDetailModal } from './NcnsDetailModal'
import { NCNS_TEMPLATE_SORT_KEY, type NcnsListRow, type WriteupsTimelineRow } from './writeupsTimelineTypes'

type TemplateOption = {
  id: string
  name: string
  schema: unknown
  is_active: boolean
}

type Props = {
  users: { id: string; name: string }[]
  userOptions: SearchableSelectOption[]
  authUserId: string
  isDev: boolean
}

function formatNcnsWorkDateCell(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`)
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function WriteupsContractsSubTab({
  users,
  userOptions,
  authUserId,
  isDev,
}: Props) {
  const [templates, setTemplates] = useState<WriteupTemplateRow[]>([])
  const [writeups, setWriteups] = useState<WriteupListRow[]>([])
  const [ncnsRows, setNcnsRows] = useState<NcnsListRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadWriteupsData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const tplRows = await withSupabaseRetry(
        async () =>
          await supabase
            .from('writeup_templates')
            .select('id, name, description, is_active, schema, created_at')
            .order('name'),
        'fetch writeup templates'
      )
      const list = (tplRows ?? []) as WriteupTemplateRow[]
      setTemplates(list)
      const tplMap = new Map(list.map((t) => [t.id, t.name]))
      const [wRows, incidentRows] = await Promise.all([
        withSupabaseRetry(
          async () =>
            await supabase
              .from('writeups')
              .select(
                'id, template_id, subject_user_id, filled_by_user_id, status, disclosure, answers, submitted_at, created_at'
              )
              .order('created_at', { ascending: false }),
          'fetch writeups'
        ),
        withSupabaseRetry(
          async () =>
            await supabase
              .from('attendance_incidents')
              .select('id, subject_user_id, work_date, created_by_user_id, created_at, metadata, details')
              .eq('incident_type', 'no_call_no_show')
              .order('created_at', { ascending: false }),
          'fetch attendance incidents ncns'
        ),
      ])
      setWriteups(
        (wRows ?? []).map((r) => ({
          id: r.id,
          template_id: r.template_id,
          template_name: tplMap.get(r.template_id) ?? '—',
          subject_user_id: r.subject_user_id,
          subject_name: users.find((u) => u.id === r.subject_user_id)?.name ?? 'Unknown',
          filled_by_user_id: r.filled_by_user_id,
          author_name: users.find((u) => u.id === r.filled_by_user_id)?.name ?? 'Unknown',
          status: r.status as 'draft' | 'submitted',
          disclosure: r.disclosure ?? null,
          submitted_at: r.submitted_at ?? null,
          created_at: r.created_at,
          answers: r.answers,
        }))
      )
      setNcnsRows(
        (incidentRows ?? []).map((r) => {
          let hadApproved = false
          let source: string | null = null
          const meta = r.metadata
          if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
            const o = meta as Record<string, unknown>
            if (o.had_approved_sessions === true) hadApproved = true
            if (typeof o.source === 'string') source = o.source
          }
          return {
            id: r.id,
            subject_user_id: r.subject_user_id,
            subject_name: users.find((u) => u.id === r.subject_user_id)?.name ?? 'Unknown',
            created_by_user_id: r.created_by_user_id,
            author_name: users.find((u) => u.id === r.created_by_user_id)?.name ?? 'Unknown',
            work_date: r.work_date,
            created_at: r.created_at,
            had_approved_sessions: hadApproved,
            source,
            details: r.details ?? null,
          }
        })
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load writeups')
      setNcnsRows([])
    } finally {
      setLoading(false)
    }
  }, [users])

  useEffect(() => {
    void loadWriteupsData()
  }, [loadWriteupsData])

  const [tplModalOpen, setTplModalOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<'create' | 'edit_draft' | 'view_submitted'>('create')
  const [editorRow, setEditorRow] = useState<WriteupListRow | null>(null)
  const [ncnsDetailRow, setNcnsDetailRow] = useState<NcnsListRow | null>(null)

  const [filterSubject, setFilterSubject] = useState('')
  const [filterTemplateId, setFilterTemplateId] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'submitted'>('all')
  const [filterDisclosure, setFilterDisclosure] = useState<'all' | 'discussed_with_subject' | 'withheld_from_subject'>('all')
  const [sortKey, setSortKey] = useState<'created_at' | 'subject' | 'template'>('created_at')

  const templateOptionsForEditor: TemplateOption[] = useMemo(
    () => templates.map((t) => ({ id: t.id, name: t.name, schema: t.schema, is_active: t.is_active })),
    [templates]
  )

  const filteredSorted = useMemo((): WriteupsTimelineRow[] => {
    let wRows = [...writeups]
    const q = filterSubject.trim().toLowerCase()
    if (q) wRows = wRows.filter((r) => r.subject_name.toLowerCase().includes(q))
    if (filterTemplateId) wRows = wRows.filter((r) => r.template_id === filterTemplateId)
    if (filterStatus !== 'all') wRows = wRows.filter((r) => r.status === filterStatus)
    if (filterDisclosure !== 'all') wRows = wRows.filter((r) => r.disclosure === filterDisclosure)

    const includeNcns = !filterTemplateId && filterStatus === 'all' && filterDisclosure === 'all'
    let nRows = includeNcns ? [...ncnsRows] : []
    if (q) nRows = nRows.filter((r) => r.subject_name.toLowerCase().includes(q))

    const timeline: WriteupsTimelineRow[] = [
      ...wRows.map((w) => ({
        kind: 'writeup' as const,
        sortMs: new Date(w.created_at).getTime(),
        writeup: w,
      })),
      ...nRows.map((n) => ({
        kind: 'ncns' as const,
        sortMs: new Date(n.created_at).getTime(),
        ncns: n,
      })),
    ]

    timeline.sort((a, b) => {
      if (sortKey === 'subject') {
        const sa = a.kind === 'writeup' ? a.writeup.subject_name : a.ncns.subject_name
        const sb = b.kind === 'writeup' ? b.writeup.subject_name : b.ncns.subject_name
        const c = sa.localeCompare(sb, undefined, { sensitivity: 'base' })
        if (c !== 0) return c
        return b.sortMs - a.sortMs
      }
      if (sortKey === 'template') {
        const ta = a.kind === 'writeup' ? a.writeup.template_name : NCNS_TEMPLATE_SORT_KEY
        const tb = b.kind === 'writeup' ? b.writeup.template_name : NCNS_TEMPLATE_SORT_KEY
        const c = ta.localeCompare(tb, undefined, { sensitivity: 'base' })
        if (c !== 0) return c
        return b.sortMs - a.sortMs
      }
      return b.sortMs - a.sortMs
    })
    return timeline
  }, [writeups, ncnsRows, filterSubject, filterTemplateId, filterStatus, filterDisclosure, sortKey])

  async function deleteWriteup(r: WriteupListRow) {
    if (r.status === 'submitted' && !isDev) {
      alert('Only a dev can delete a submitted writeup.')
      return
    }
    if (!confirm(`Delete this ${r.status} writeup for ${r.subject_name}?`)) return
    try {
      await withSupabaseRetry(async () => supabase.from('writeups').delete().eq('id', r.id), 'delete writeup')
      await loadWriteupsData()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const selectStyle: CSSProperties = {
    padding: '0.35rem 0.5rem',
    border: '1px solid var(--border-strong)',
    borderRadius: 4,
    fontSize: '0.875rem',
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Writeups</h2>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Template writeups and no-call, no-show (NCNS) records share this list when filters allow.
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setTplModalOpen(true)}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer' }}
          >
            Manage templates
          </button>
          <button
            type="button"
            onClick={() => {
              setEditorRow(null)
              setEditorMode('create')
              setEditorOpen(true)
            }}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', border: '1px solid #3b82f6', borderRadius: 6, background: '#3b82f6', color: '#fff', cursor: 'pointer' }}
          >
            New writeup
          </button>
        </div>
      </div>

      {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '0.5rem',
          marginBottom: '1rem',
          alignItems: 'end',
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Subject search</label>
          <input
            type="search"
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            placeholder="Name…"
            style={{ width: '100%', padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Template</label>
          <select value={filterTemplateId} onChange={(e) => setFilterTemplateId(e.target.value)} style={{ ...selectStyle, width: '100%' }}>
            <option value="">All</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Status</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)} style={{ ...selectStyle, width: '100%' }}>
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Disclosure</label>
          <select
            value={filterDisclosure}
            onChange={(e) => setFilterDisclosure(e.target.value as typeof filterDisclosure)}
            style={{ ...selectStyle, width: '100%' }}
          >
            <option value="all">All</option>
            <option value="discussed_with_subject">Discussed</option>
            <option value="withheld_from_subject">Withheld</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Sort</label>
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as typeof sortKey)} style={{ ...selectStyle, width: '100%' }}>
            <option value="created_at">Date</option>
            <option value="subject">Subject</option>
            <option value="template">Template</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 4 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead style={{ background: 'var(--bg-subtle)' }}>
              <tr>
                <th style={th}>Type</th>
                <th style={th}>Subject</th>
                <th style={th}>Template / record</th>
                <th style={th}>Author</th>
                <th style={th}>Created</th>
                <th style={th}>Status</th>
                <th style={th}>Disclosure</th>
                <th style={{ ...th, width: 1 }} />
              </tr>
            </thead>
            <tbody>
              {filteredSorted.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                    No items match filters.
                  </td>
                </tr>
              ) : (
                filteredSorted.map((row) =>
                  row.kind === 'writeup' ? (
                    <tr key={`writeup-${row.writeup.id}`} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={td}>Writeup</td>
                      <td style={td}>{row.writeup.subject_name}</td>
                      <td style={td}>{row.writeup.template_name}</td>
                      <td style={td}>{row.writeup.author_name}</td>
                      <td style={td}>{new Date(row.writeup.created_at).toLocaleString()}</td>
                      <td style={td}>{row.writeup.status}</td>
                      <td style={td}>
                        {row.writeup.disclosure === 'discussed_with_subject'
                          ? 'Discussed'
                          : row.writeup.disclosure === 'withheld_from_subject'
                            ? 'Withheld'
                            : '—'}
                      </td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditorRow(row.writeup)
                            setEditorMode(row.writeup.status === 'draft' ? 'edit_draft' : 'view_submitted')
                            setEditorOpen(true)
                          }}
                          style={{ fontSize: '0.75rem', marginRight: '0.35rem', padding: '0.2rem 0.45rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer' }}
                        >
                          {row.writeup.status === 'draft' ? 'Edit' : 'View'}
                        </button>
                        {(row.writeup.status === 'draft' || isDev) && (
                          <button
                            type="button"
                            onClick={() => deleteWriteup(row.writeup)}
                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.45rem', border: '1px solid #fecaca', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-red-700)', cursor: 'pointer' }}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    <tr key={`ncns-${row.ncns.id}`} style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-amber-tint)' }}>
                      <td style={td}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            color: 'var(--text-amber-700)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.02em',
                          }}
                        >
                          NCNS
                        </span>
                      </td>
                      <td style={td}>{row.ncns.subject_name}</td>
                      <td style={td}>
                        <div>{NCNS_TEMPLATE_SORT_KEY}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Work date: {formatNcnsWorkDateCell(row.ncns.work_date)}</div>
                      </td>
                      <td style={td}>{row.ncns.author_name}</td>
                      <td style={td}>{new Date(row.ncns.created_at).toLocaleString()}</td>
                      <td style={td}>Recorded</td>
                      <td style={td}>—</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => setNcnsDetailRow(row.ncns)}
                          style={{ fontSize: '0.75rem', padding: '0.2rem 0.45rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer' }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      <WriteupTemplateManagerModal
        open={tplModalOpen}
        onClose={() => setTplModalOpen(false)}
        templates={templates}
        authUserId={authUserId}
        onAfterChange={loadWriteupsData}
      />
      <WriteupEditorModal
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false)
          setEditorRow(null)
        }}
        mode={editorMode}
        row={editorRow}
        templates={templateOptionsForEditor}
        userOptions={userOptions}
        authUserId={authUserId}
        onAfterSave={loadWriteupsData}
      />
      <NcnsDetailModal open={ncnsDetailRow != null} row={ncnsDetailRow} onClose={() => setNcnsDetailRow(null)} />
    </div>
  )
}

const th: CSSProperties = {
  padding: '0.75rem',
  textAlign: 'left',
  borderBottom: '1px solid var(--border)',
  fontWeight: 600,
}
const td: CSSProperties = { padding: '0.65rem 0.75rem' }