// Banking → Accounting → Tags: the manager for bank-category tags (Variant D,
// v2.2718). Left: the tags. Right: the selected tag's name / icon / color,
// the bank categories it covers, the accounting labels it stands for, and
// the two switches. Rules point at tags, so saving here changes what those
// rules match without re-saving them.

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { Database } from '../../types/database'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import {
  CATEGORY_TAG_COLORS,
  DEFAULT_TAGGED_BANK_CATEGORIES,
  type CategoryTagColor,
  type CategoryTagLookups,
  type CategoryTagMemberRow,
  type CategoryTagRow,
} from '../../lib/banking/categoryTags'
import { deleteCategoryTag, mergeCategoryTags, resetDefaultCategoryTags, saveCategoryTag, saveCategoryTagMembers, type CategoryTagDraft } from '../../lib/banking/categoryTagsData'
import { parseAccountingLabelRuleCriteria } from '../../lib/accountingLabelRuleMatch'
import { CategoryTagChip, categoryTagChipStyle } from './CategoryTagChip'
import { MERCURY_BANK_CATEGORY_SUGGESTIONS } from './AccountingRuleFormModal'

type RuleRow = Database['public']['Tables']['mercury_accounting_label_rules']['Row']
type DragLabelRow = Database['public']['Tables']['mercury_drag_sort_labels']['Row']

const TAG_ICON_SUGGESTIONS = ['⛽', '🛒', '💻', '🧾', '🏛', '🍔', '🚚', '🔧', '🏨', '📦', '🧰', '🪪', '📶', '🛡', '🏷']

const btn: CSSProperties = {
  padding: '0.4rem 0.85rem',
  fontWeight: 600,
  background: 'var(--bg-slate-100)',
  color: 'var(--text-slate-900)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  cursor: 'pointer',
  font: 'inherit',
}
const primaryBtn: CSSProperties = { ...btn, background: '#2563eb', color: '#fff', border: '1px solid #2563eb' }
const fieldLabel: CSSProperties = { fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const input: CSSProperties = { padding: '0.4rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit', background: 'var(--surface)', color: 'var(--text-base)' }

function emptyDraft(): CategoryTagDraft {
  return { id: null, name: '', icon: '🏷', color: 'gray', show_as_cost_line: false, hide_from_picker: false }
}

export function BankingMercuryCategoryTagsModal({
  open,
  onClose,
  tags,
  members,
  lookups,
  labels,
  rules,
  loading,
  onChanged,
  zIndex = 1100,
}: {
  open: boolean
  onClose: () => void
  tags: CategoryTagRow[]
  members: CategoryTagMemberRow[]
  lookups: CategoryTagLookups
  labels: DragLabelRow[]
  rules: RuleRow[]
  loading: boolean
  /** Reload tags + members after a save / delete / reset. */
  onChanged: () => Promise<void>
  zIndex?: number
}) {
  const { showToast } = useToastContext()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<CategoryTagDraft>(emptyDraft)
  const [draftCategories, setDraftCategories] = useState<Set<string>>(() => new Set())
  const [draftLabelIds, setDraftLabelIds] = useState<Set<string>>(() => new Set())
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [mergeTargetId, setMergeTargetId] = useState('')

  // Rule counts per tag: bankTag clauses + rules whose label belongs to the tag.
  const ruleCountByTagId = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rules) {
      const c = parseAccountingLabelRuleCriteria(r.criteria)
      const id = (c?.bankTag?.tagId && lookups.tagsById.has(c.bankTag.tagId) ? c.bankTag.tagId : null) ?? lookups.tagIdByLabelId.get(r.label_id) ?? null
      if (id) m.set(id, (m.get(id) ?? 0) + 1)
    }
    return m
  }, [rules, lookups])

  const allBankCategories = useMemo(() => {
    const set = new Set<string>([...MERCURY_BANK_CATEGORY_SUGGESTIONS, ...DEFAULT_TAGGED_BANK_CATEGORIES])
    for (const m of members) if (m.bank_category) set.add(m.bank_category)
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [members])
  const unassignedCategories = useMemo(
    () => allBankCategories.filter((c) => !lookups.tagIdByCategory.has(c.toLowerCase())),
    [allBankCategories, lookups],
  )

  // Load the selected tag into the draft.
  useEffect(() => {
    if (!open) return
    if (selectedId == null) return
    const t = tags.find((x) => x.id === selectedId)
    if (!t) {
      setSelectedId(null)
      return
    }
    setDraft({ id: t.id, name: t.name, icon: t.icon, color: t.color, show_as_cost_line: t.show_as_cost_line, hide_from_picker: t.hide_from_picker })
    setDraftCategories(new Set(members.filter((m) => m.tag_id === t.id && m.bank_category).map((m) => m.bank_category as string)))
    setDraftLabelIds(new Set(members.filter((m) => m.tag_id === t.id && m.label_id).map((m) => m.label_id as string)))
    setConfirmDelete(false)
    setMergeTargetId('')
  }, [open, selectedId, tags, members])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, busy])

  if (!open) return null

  const startNew = () => {
    setSelectedId(null)
    setDraft(emptyDraft())
    setDraftCategories(new Set())
    setDraftLabelIds(new Set())
    setConfirmDelete(false)
  }
  const toggleCategory = (c: string) =>
    setDraftCategories((s) => {
      const n = new Set(s)
      const key = [...n].find((x) => x.toLowerCase() === c.toLowerCase())
      if (key) n.delete(key)
      else n.add(c)
      return n
    })
  const toggleLabel = (id: string) =>
    setDraftLabelIds((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const save = async () => {
    if (!draft.name.trim()) {
      showToast('Give the tag a name.', 'error')
      return
    }
    setBusy(true)
    try {
      const nextSort = tags.reduce((s, t) => Math.max(s, t.sort_order), -10) + 10
      const id = await saveCategoryTag(draft, nextSort)
      await saveCategoryTagMembers(id, members, [...draftCategories], [...draftLabelIds])
      await onChanged()
      setSelectedId(id)
      showToast(draft.id ? 'Tag saved.' : 'Tag created.', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }
  const remove = async () => {
    if (!draft.id) return
    setBusy(true)
    try {
      await deleteCategoryTag(draft.id)
      await onChanged()
      startNew()
      showToast('Tag deleted. Rules that used it keep matching from their saved categories.', 'info')
    } catch (e) {
      showToast(formatErrorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }
  // Merge (v2.2723): move every category + label into the target, repoint the
  // rules that named this tag, then delete it. Nothing stops matching.
  const merge = async () => {
    if (!draft.id || !mergeTargetId || mergeTargetId === draft.id) return
    const target = tags.find((t) => t.id === mergeTargetId)
    if (!target) return
    setBusy(true)
    try {
      const r = await mergeCategoryTags(draft.id, mergeTargetId)
      await onChanged()
      setSelectedId(mergeTargetId)
      showToast(`Merged into ${target.icon} ${target.name} — ${r.movedMembers} member${r.movedMembers === 1 ? '' : 's'} moved, ${r.repointedRules} rule${r.repointedRules === 1 ? '' : 's'} repointed.`, 'success')
    } catch (e) {
      showToast(formatErrorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }
  const reset = async () => {
    setBusy(true)
    try {
      await resetDefaultCategoryTags()
      await onChanged()
      showToast('Default tags restored where they were missing.', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  const rulesUsingDraft = draft.id ? (ruleCountByTagId.get(draft.id) ?? 0) : 0
  const sortedLabels = [...labels].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bank-category tags"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex }}
    >
      <div style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 12, width: 'min(1040px, 100%)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 18px 50px rgba(15, 23, 42, 0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '1rem 1.25rem 0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Tags ({tags.length})</h3>
          <button type="button" onClick={onClose} disabled={busy} style={btn}>Close</button>
        </div>
        <p style={{ margin: '0 1.25rem 0.75rem', color: 'var(--text-muted)' }}>
          Group the bank's categories and your accounting labels into tags you can pick on rules and see on rows.
          {unassignedCategories.length > 0 ? (
            <> <b style={{ color: 'var(--text-700)' }}>{unassignedCategories.length} bank {unassignedCategories.length === 1 ? 'category has' : 'categories have'} no tag yet</b> — {unassignedCategories.slice(0, 6).join(', ')}{unassignedCategories.length > 6 ? ', …' : ''}.</>
          ) : (
            <> Every bank category has a tag.</>
          )}
        </p>
        <div style={{ display: 'flex', gap: 8, padding: '0 1.25rem 0.75rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={startNew} disabled={busy} style={primaryBtn}>New tag</button>
          <button type="button" onClick={() => void reset()} disabled={busy} style={btn} title="Re-plant the six default families where they are missing. Never moves a category you have re-homed.">Reset to defaults</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 1fr) minmax(0, 2fr)', gap: 14, padding: '0 1.25rem 1.25rem', overflow: 'auto', minHeight: 0 }}>
          <div style={{ display: 'grid', gap: 6, alignContent: 'start', minWidth: 0 }}>
            {loading && tags.length === 0 ? <div style={{ color: 'var(--text-muted)' }}>Loading tags…</div> : null}
            {tags.map((t) => {
              const cats = members.filter((m) => m.tag_id === t.id && m.bank_category).length
              const lbls = members.filter((m) => m.tag_id === t.id && m.label_id).length
              const on = t.id === selectedId
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  aria-pressed={on}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto minmax(0, 1fr)',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    border: `1px solid ${on ? 'var(--text-link)' : 'var(--border-soft)'}`,
                    borderRadius: 8,
                    background: on ? 'var(--bg-subtle)' : 'var(--surface)',
                    cursor: 'pointer',
                    font: 'inherit',
                    textAlign: 'left',
                    minWidth: 0,
                  }}
                >
                  <CategoryTagChip tag={t} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right', minWidth: 0 }}>
                    {cats} cat{cats === 1 ? '' : 's'} · {lbls} label{lbls === 1 ? '' : 's'} · {ruleCountByTagId.get(t.id) ?? 0} rule{(ruleCountByTagId.get(t.id) ?? 0) === 1 ? '' : 's'}
                    {t.show_as_cost_line ? ' · ★' : ''}
                  </span>
                </button>
              )
            })}
            {!loading && tags.length === 0 ? <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No tags yet — Reset to defaults plants six.</div> : null}
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.85rem 1rem', display: 'grid', gap: 12, alignContent: 'start' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...categoryTagChipStyle(draft.color), fontSize: '0.9rem' }}>
                  <span aria-hidden="true">{draft.icon || '🏷'}</span>
                  {draft.name.trim() || 'New tag'}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{draft.id ? 'editing' : 'new'}</span>
              </div>
              {draft.id ? (
                confirmDelete ? (
                  <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: '0.8rem' }}>
                    Delete this tag?
                    <button type="button" onClick={() => void remove()} disabled={busy} style={{ ...btn, color: 'var(--text-red-700)' }}>Delete</button>
                    <button type="button" onClick={() => setConfirmDelete(false)} disabled={busy} style={btn}>Keep</button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirmDelete(true)} disabled={busy} title="Delete tag" style={{ ...btn, color: 'var(--text-red-700)' }}>Delete</button>
                )
              ) : null}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
              <label style={{ display: 'grid', gap: 4, flex: '1 1 180px' }}>
                <span style={fieldLabel}>Name</span>
                <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} maxLength={60} placeholder="Fuel & gas" style={input} />
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={fieldLabel}>Icon</span>
                <input value={draft.icon} onChange={(e) => setDraft((d) => ({ ...d, icon: e.target.value }))} maxLength={8} list="category-tag-icons" style={{ ...input, width: 70, textAlign: 'center' }} />
                <datalist id="category-tag-icons">
                  {TAG_ICON_SUGGESTIONS.map((i) => (
                    <option key={i} value={i} />
                  ))}
                </datalist>
              </label>
              <div style={{ display: 'grid', gap: 4 }}>
                <span style={fieldLabel}>Color</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', height: 32 }}>
                  {CATEGORY_TAG_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Color ${c}`}
                      aria-pressed={draft.color === c}
                      onClick={() => setDraft((d) => ({ ...d, color: c as CategoryTagColor }))}
                      style={{ ...categoryTagChipStyle(c, { selected: draft.color === c }), width: 22, height: 22, padding: 0, borderRadius: '50%', cursor: 'pointer' }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div style={fieldLabel}>Bank categories in this tag <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>· click to add or remove</span></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {allBankCategories.map((c) => {
                  const inDraft = [...draftCategories].some((x) => x.toLowerCase() === c.toLowerCase())
                  const ownerId = lookups.tagIdByCategory.get(c.toLowerCase())
                  const owner = ownerId && ownerId !== draft.id ? lookups.tagsById.get(ownerId) : null
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCategory(c)}
                      aria-pressed={inDraft}
                      title={owner ? `Currently in ${owner.icon} ${owner.name} — click to move it here` : undefined}
                      style={inDraft ? { ...categoryTagChipStyle(draft.color, { selected: true }), cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 600 } : { ...categoryTagChipStyle('gray', { muted: !!owner }), cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 500 }}
                    >
                      {c}
                      {owner ? <span style={{ opacity: 0.7, fontWeight: 400 }}> · {owner.icon} {owner.name}</span> : null}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <div style={fieldLabel}>Accounting labels this tag stands for</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {sortedLabels.map((l) => {
                  const inDraft = draftLabelIds.has(l.id)
                  const ownerId = lookups.tagIdByLabelId.get(l.id)
                  const owner = ownerId && ownerId !== draft.id ? lookups.tagsById.get(ownerId) : null
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => toggleLabel(l.id)}
                      aria-pressed={inDraft}
                      title={owner ? `Currently in ${owner.icon} ${owner.name} — click to move it here` : undefined}
                      style={inDraft ? { ...categoryTagChipStyle(draft.color, { selected: true }), cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 600 } : { ...categoryTagChipStyle('gray', { muted: !!owner }), cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 500 }}
                    >
                      {l.name}
                      {owner ? <span style={{ opacity: 0.7, fontWeight: 400 }}> · {owner.icon}</span> : null}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.85rem' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={draft.show_as_cost_line} onChange={(e) => setDraft((d) => ({ ...d, show_as_cost_line: e.target.checked }))} />
                Show as its own cost line on Review and Job Summary
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={draft.hide_from_picker} onChange={(e) => setDraft((d) => ({ ...d, hide_from_picker: e.target.checked }))} />
                Hide from the rule tag picker
              </label>
            </div>

            {draft.id && tags.length > 1 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '0.85rem', paddingTop: 8, borderTop: '1px solid var(--border-soft)' }}>
                <span style={fieldLabel}>Merge into</span>
                <select value={mergeTargetId} onChange={(e) => setMergeTargetId(e.target.value)} disabled={busy} style={{ ...input, padding: '0.3rem 0.5rem' }} aria-label="Merge this tag into">
                  <option value="">Choose a tag…</option>
                  {tags.filter((t) => t.id !== draft.id).map((t) => (
                    <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
                  ))}
                </select>
                <button type="button" onClick={() => void merge()} disabled={busy || !mergeTargetId} style={btn} title="Move every category and label into the chosen tag, repoint rules that name this tag, then delete it.">
                  Merge
                </button>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Members and rules move over; this tag goes away.</span>
              </div>
            ) : null}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => void save()} disabled={busy} style={primaryBtn}>{busy ? 'Saving…' : draft.id ? 'Save tag' : 'Create tag'}</button>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {draft.id ? `${rulesUsingDraft} rule${rulesUsingDraft === 1 ? '' : 's'} use this tag — they follow the change immediately.` : 'Categories and labels you pick move here from wherever they were.'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
