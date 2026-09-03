// Supabase side of bank-category tags: load, save, membership, delete, reset.
// Thin over `mercury_category_tags` / `mercury_category_tag_members`; the
// pure logic lives in `categoryTags.ts` and `categoryTagMembersDiff.ts`.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { Database } from '../../types/database'
import { buildCategoryTagLookups, type CategoryTagColor, type CategoryTagLookups, type CategoryTagMemberRow, type CategoryTagRow } from './categoryTags'
import { diffCategoryTagMembers } from './categoryTagMembersDiff'

type TagDbRow = Database['public']['Tables']['mercury_category_tags']['Row']
type MemberDbRow = Database['public']['Tables']['mercury_category_tag_members']['Row']

function toTagRow(r: TagDbRow): CategoryTagRow {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon,
    color: r.color as CategoryTagColor,
    sort_order: r.sort_order,
    default_key: r.default_key,
    show_as_cost_line: r.show_as_cost_line,
    hide_from_picker: r.hide_from_picker,
  }
}

export async function loadCategoryTags(): Promise<{ tags: CategoryTagRow[]; members: CategoryTagMemberRow[] }> {
  const [tagsRes, membersRes] = await Promise.all([
    withSupabaseRetry(
      async () => await supabase.from('mercury_category_tags').select('*').order('sort_order').order('name'),
      'load category tags',
    ),
    withSupabaseRetry(async () => await supabase.from('mercury_category_tag_members').select('tag_id, bank_category, label_id'), 'load category tag members'),
  ])
  const tags = ((tagsRes as TagDbRow[] | null) ?? []).map(toTagRow)
  const members = ((membersRes as Pick<MemberDbRow, 'tag_id' | 'bank_category' | 'label_id'>[] | null) ?? []).map((m) => ({
    tag_id: m.tag_id,
    bank_category: m.bank_category,
    label_id: m.label_id,
  }))
  return { tags, members }
}

export type CategoryTagDraft = {
  id: string | null
  name: string
  icon: string
  color: CategoryTagColor
  show_as_cost_line: boolean
  hide_from_picker: boolean
}

/** Insert or update the tag row; returns its id. */
export async function saveCategoryTag(draft: CategoryTagDraft, nextSortOrder: number): Promise<string> {
  const name = draft.name.trim()
  const icon = draft.icon.trim() || '🏷'
  if (draft.id) {
    const { error } = await supabase
      .from('mercury_category_tags')
      .update({ name, icon, color: draft.color, show_as_cost_line: draft.show_as_cost_line, hide_from_picker: draft.hide_from_picker, updated_at: new Date().toISOString() })
      .eq('id', draft.id)
    if (error) throw new Error(error.message)
    return draft.id
  }
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('mercury_category_tags')
    .insert({ name, icon, color: draft.color, show_as_cost_line: draft.show_as_cost_line, hide_from_picker: draft.hide_from_picker, sort_order: nextSortOrder, created_by: user?.id ?? null })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

/**
 * Bring a tag's membership to exactly `nextCategories` + `nextLabelIds`. A
 * category or label can live in one tag only, so an add first evicts it from
 * wherever it was (the unique indexes would otherwise refuse the insert).
 */
export async function saveCategoryTagMembers(
  tagId: string,
  current: readonly CategoryTagMemberRow[],
  nextCategories: readonly string[],
  nextLabelIds: readonly string[],
): Promise<void> {
  const d = diffCategoryTagMembers(tagId, current, nextCategories, nextLabelIds)
  for (const cat of d.removeCategories) {
    const { error } = await supabase.from('mercury_category_tag_members').delete().eq('tag_id', tagId).ilike('bank_category', cat)
    if (error) throw new Error(error.message)
  }
  for (const id of d.removeLabelIds) {
    const { error } = await supabase.from('mercury_category_tag_members').delete().eq('tag_id', tagId).eq('label_id', id)
    if (error) throw new Error(error.message)
  }
  for (const cat of d.addCategories) {
    const evict = await supabase.from('mercury_category_tag_members').delete().ilike('bank_category', cat)
    if (evict.error) throw new Error(evict.error.message)
    const { error } = await supabase.from('mercury_category_tag_members').insert({ tag_id: tagId, bank_category: cat })
    if (error) throw new Error(error.message)
  }
  for (const id of d.addLabelIds) {
    const evict = await supabase.from('mercury_category_tag_members').delete().eq('label_id', id)
    if (evict.error) throw new Error(evict.error.message)
    const { error } = await supabase.from('mercury_category_tag_members').insert({ tag_id: tagId, label_id: id })
    if (error) throw new Error(error.message)
  }
}

/** Members cascade. Rules that pointed at the tag keep matching from their saved category snapshot. */
export async function deleteCategoryTag(tagId: string): Promise<void> {
  const { error } = await supabase.from('mercury_category_tags').delete().eq('id', tagId)
  if (error) throw new Error(error.message)
}

/** Re-plants the six default families where they are missing; never moves a category the owner has re-homed. */
export async function resetDefaultCategoryTags(): Promise<void> {
  const { error } = await supabase.rpc('seed_default_mercury_category_tags')
  if (error) throw new Error(error.message)
}

export function useCategoryTags(enabled: boolean): {
  tags: CategoryTagRow[]
  members: CategoryTagMemberRow[]
  lookups: CategoryTagLookups
  loading: boolean
  error: string | null
  reload: () => Promise<void>
} {
  const [tags, setTags] = useState<CategoryTagRow[]>([])
  const [members, setMembers] = useState<CategoryTagMemberRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const r = await loadCategoryTags()
      setTags(r.tags)
      setMembers(r.members)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    if (!enabled) return
    void reload()
  }, [enabled, reload])
  const lookups = useMemo(() => buildCategoryTagLookups(tags, members), [tags, members])
  return { tags, members, lookups, loading, error, reload }
}
