/**
 * Edit the customer's standard terms (Signing it on paper PR 4, v2.3642) — the door the sweep
 * and the Contract window never had: until the seed, the wording was a source constant. One
 * Contract Book document (audience customer), saved through `update_contract_book_entry` — the
 * Book's own write, so the version date, the name checks and the role gate are one rule — with
 * today as the new version date. It says how far the edit reaches before a word is typed.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { standardTermsLabel, standardTermsReachLine, standardTermsSaveBlocker, type StandardTermsDoc } from '../../lib/jobs/standardTerms'

const btn: CSSProperties = { padding: '0.35rem 0.8rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }
const btnPrimary: CSSProperties = { ...btn, background: 'var(--text-link)', borderColor: 'var(--text-link)', color: 'white' }
const field: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.85rem' }

export type StandardTermsEditModalProps = {
  doc: StandardTermsDoc
  /** Jobs still waiting in the sweep (0 when opened from one job's Contract window). */
  openJobs: number
  onClose: () => void
  /** The saved document, so the caller re-reads its terms from it. */
  onSaved: (doc: StandardTermsDoc) => void
}

export default function StandardTermsEditModal({ doc, openJobs, onClose, onSaved }: StandardTermsEditModalProps) {
  const { showToast } = useToastContext()
  const [name, setName] = useState(doc.document_name)
  const [body, setBody] = useState(doc.book_body_html ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(doc.document_name)
    setBody(doc.book_body_html ?? '')
    setError(null)
  }, [doc.id, doc.document_name, doc.book_body_html])

  const blocker = standardTermsSaveBlocker({ name, body, originalBody: doc.book_body_html ?? '', originalName: doc.document_name })

  async function save() {
    if (saving || blocker) return
    setSaving(true)
    setError(null)
    const versionDate = todayYmdInAppTz()
    // Tags and the canonical link are the Book's; this door does not touch them.
    const { data: current } = await supabase.from('contract_template_documents').select('tags, canonical_document_url').eq('id', doc.id).maybeSingle()
    const { error: rpcError } = await supabase.rpc('update_contract_book_entry', {
      p_contract_template_document_id: doc.id,
      p_document_name: name.trim(),
      p_book_body_html: body,
      p_book_body_format: doc.book_body_format,
      p_tags: ((current as { tags?: string[] | null } | null)?.tags ?? []) as string[],
      p_canonical_document_url: ((current as { canonical_document_url?: string | null } | null)?.canonical_document_url ?? '') as string,
      p_book_version_date: versionDate,
    })
    setSaving(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    const saved: StandardTermsDoc = { ...doc, document_name: name.trim(), book_body_html: body, book_version_date: versionDate }
    showToast(`Standard terms saved — ${standardTermsLabel(saved)}`, 'success')
    onSaved(saved)
  }

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '0.74rem', color: error ? 'var(--text-red-700)' : 'var(--text-muted)' }} data-testid="standard-terms-hint">
        {error ?? blocker ?? 'Saves as a new version dated today.'}
      </span>
      <span style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" style={btn} onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button type="button" style={{ ...btnPrimary, opacity: blocker || saving ? 0.55 : 1 }} onClick={() => void save()} disabled={Boolean(blocker) || saving}>
          {saving ? 'Saving…' : 'Save standard terms'}
        </button>
      </span>
    </div>
  )

  return (
    <ResponsiveModalShell title="Edit standard terms" onRequestClose={onClose} maxWidthDesktop={720} zIndex={1300} footer={footer}>
      <div style={{ display: 'grid', gap: '0.7rem' }}>
        <div role="note" data-testid="standard-terms-reach" style={{ padding: '0.55rem 0.75rem', borderRadius: 8, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', fontSize: '0.8rem', lineHeight: 1.45 }}>
          <strong>{standardTermsLabel(doc)}</strong> — {standardTermsReachLine(openJobs)} To change one job only — its scope, amount or payment line — use <em>This job</em> instead.
        </div>
        <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          Document name
          <input style={field} value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
        </label>
        <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          The terms every agreement prints{doc.book_body_format !== 'plain' ? ` (${doc.book_body_format})` : ''}
          <textarea style={{ ...field, minHeight: '46vh', resize: 'vertical', lineHeight: 1.5, fontFamily: doc.book_body_format === 'plain' ? 'inherit' : 'ui-monospace, SFMono-Regular, Menlo, monospace' }} value={body} onChange={(e) => setBody(e.target.value)} disabled={saving} aria-label="Standard terms" />
        </label>
      </div>
    </ResponsiveModalShell>
  )
}
