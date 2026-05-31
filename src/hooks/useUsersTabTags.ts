import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import {
  deleteLabel,
  fetchLabelUsageCounts,
  fetchLabelsForMasterIds,
  fetchPeopleLabelsForPersonIds,
  fetchUserLabelsForUserIds,
  type LabelRow,
} from '../lib/labels'
import {
  deleteUserTagOrg,
  fetchTagOrgOverridesForUserIds,
  fetchUserTagOrgSignals,
  upsertUserTagOrg,
  type UserTagOrgSignals,
} from '../lib/tagOrg'
import { resolveManagerUserIdForFeedback } from '../lib/teamFeedback'
import type { Person, UserRow } from './usePeopleRoster'

const SHOW_USERS_TAB_TAGS_KEY = 'people.usersTab.showTags'
const SHOW_USERS_TAB_TAG_ORG_SIGNALS_KEY = 'people.usersTab.showTagOrgSignals'

export type UsersTabTagAnchor =
  | { kind: 'person'; personId: string }
  | { kind: 'user'; userId: string }

interface UseUsersTabTagsParams {
  isDev: boolean
  activeTab: string
  people: Person[]
  users: UserRow[]
  authUserId: string | undefined
  showToast: (message: string, type: 'success' | 'error') => void
}

export interface UsersTabTagsApi {
  // Toggles (with localStorage persistence)
  showUsersTabTags: boolean
  setShowUsersTabTags: (v: boolean) => void
  showUsersTabTagOrgSignals: boolean
  setShowUsersTabTagOrgSignals: (v: boolean) => void
  // Loaded data
  usersTabLabels: LabelRow[]
  usersTabLabelsByPersonId: Record<string, string[]>
  usersTabLabelsByUserId: Record<string, string[]>
  usersTabMasterByUserId: Record<string, string | null>
  usersTabTagOrgSavedMasterId: Record<string, string | null>
  usersTabTagSignalsByUserId: Record<string, UserTagOrgSignals>
  tagOrgMasterSelectOptions: Array<{ id: string; name: string | null; email: string | null }>
  usersTabLabelUsageById: Record<string, { people: number; users: number }>
  usersTabLabelById: Map<string, LabelRow>
  // Status flags
  usersTabTagsLoading: boolean
  usersTabLabelUsageLoading: boolean
  usersTabLabelCatalogDeletingId: string | null
  usersTabTagOrgSavingUserId: string | null
  usersTabSavingTagKey: string | null
  usersTabTagDraftByKey: Record<string, string>
  // Setters used by the per-row panel's apply/add closures
  setUsersTabLabels: Dispatch<SetStateAction<LabelRow[]>>
  setUsersTabLabelsByPersonId: Dispatch<SetStateAction<Record<string, string[]>>>
  setUsersTabLabelsByUserId: Dispatch<SetStateAction<Record<string, string[]>>>
  setUsersTabSavingTagKey: Dispatch<SetStateAction<string | null>>
  setUsersTabTagDraftByKey: Dispatch<SetStateAction<Record<string, string>>>
  // Callbacks
  tagOrgMasterLabel: (masterId: string) => string
  applyUserTagOrgChange: (userId: string, nextMasterId: string) => Promise<void>
  deleteLabelFromCatalog: (rowId: string) => Promise<void>
}

/**
 * Owns the dev-only "users tab" tag/label subsystem: tag-org overrides, label
 * catalog, per-person/per-user label assignments, signals, and the two loader
 * effects. The roster render consumes this via the `PeopleUserTagsPanel`
 * component (per-row panel) and the inline label-catalog table / dev toggles.
 */
export function useUsersTabTags({
  isDev,
  activeTab,
  people,
  users,
  authUserId,
  showToast,
}: UseUsersTabTagsParams): UsersTabTagsApi {
  const [showUsersTabTags, setShowUsersTabTagsState] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem(SHOW_USERS_TAB_TAGS_KEY) === '1',
  )
  const [showUsersTabTagOrgSignals, setShowUsersTabTagOrgSignalsState] = useState(
    () =>
      typeof localStorage !== 'undefined' &&
      localStorage.getItem(SHOW_USERS_TAB_TAG_ORG_SIGNALS_KEY) !== '0',
  )
  const [usersTabLabels, setUsersTabLabels] = useState<LabelRow[]>([])
  const [usersTabLabelsByPersonId, setUsersTabLabelsByPersonId] = useState<Record<string, string[]>>({})
  const [usersTabLabelsByUserId, setUsersTabLabelsByUserId] = useState<Record<string, string[]>>({})
  const [usersTabMasterByUserId, setUsersTabMasterByUserId] = useState<Record<string, string | null>>({})
  const [usersTabTagOrgSavedMasterId, setUsersTabTagOrgSavedMasterId] = useState<Record<string, string | null>>({})
  const [usersTabTagSignalsByUserId, setUsersTabTagSignalsByUserId] = useState<Record<string, UserTagOrgSignals>>({})
  const [tagOrgMasterSelectOptions, setTagOrgMasterSelectOptions] = useState<
    Array<{ id: string; name: string | null; email: string | null }>
  >([])
  const [usersTabTagOrgSavingUserId, setUsersTabTagOrgSavingUserId] = useState<string | null>(null)
  const [usersTabLabelUsageById, setUsersTabLabelUsageById] = useState<
    Record<string, { people: number; users: number }>
  >({})
  const [usersTabLabelUsageLoading, setUsersTabLabelUsageLoading] = useState(false)
  const [usersTabLabelCatalogDeletingId, setUsersTabLabelCatalogDeletingId] = useState<string | null>(null)
  const [usersTabTagsLoading, setUsersTabTagsLoading] = useState(false)
  const [usersTabSavingTagKey, setUsersTabSavingTagKey] = useState<string | null>(null)
  const [usersTabTagDraftByKey, setUsersTabTagDraftByKey] = useState<Record<string, string>>({})

  const setShowUsersTabTags = useCallback((v: boolean) => {
    setShowUsersTabTagsState(v)
    try {
      localStorage.setItem(SHOW_USERS_TAB_TAGS_KEY, v ? '1' : '0')
    } catch {
      /* ignore quota / private mode */
    }
  }, [])

  const setShowUsersTabTagOrgSignals = useCallback((v: boolean) => {
    setShowUsersTabTagOrgSignalsState(v)
    try {
      localStorage.setItem(SHOW_USERS_TAB_TAG_ORG_SIGNALS_KEY, v ? '1' : '0')
    } catch {
      /* ignore quota / private mode */
    }
  }, [])

  useEffect(() => {
    if (!isDev || activeTab !== 'users' || !showUsersTabTags) return
    let cancelled = false
    setUsersTabTagsLoading(true)
    void (async () => {
      try {
        const userIds = users.map((u) => u.id)
        const [overrides, signals, mastersRes] = await Promise.all([
          fetchTagOrgOverridesForUserIds(userIds),
          fetchUserTagOrgSignals(userIds),
          withSupabaseRetry(
            async () =>
              supabase
                .from('users')
                .select('id, name, email')
                .eq('role', 'master_technician')
                .is('archived_at', null)
                .order('name', { ascending: true }),
            'tag org master dropdown',
          ),
        ])
        if (cancelled) return
        setUsersTabTagSignalsByUserId(signals)
        setTagOrgMasterSelectOptions(
          (mastersRes ?? []) as Array<{ id: string; name: string | null; email: string | null }>,
        )
        const saved: Record<string, string | null> = {}
        for (const id of userIds) {
          saved[id] = overrides[id] ?? null
        }
        setUsersTabTagOrgSavedMasterId(saved)

        const masterByUser: Record<string, string | null> = {}
        for (const id of userIds) {
          if (overrides[id]) masterByUser[id] = overrides[id]
        }
        const needHeuristic = userIds.filter((id) => !overrides[id])
        const heuristicPairs = await Promise.all(
          needHeuristic.map(async (id) => ({ id, master: await resolveManagerUserIdForFeedback(id) })),
        )
        if (cancelled) return
        for (const { id, master } of heuristicPairs) {
          masterByUser[id] = master
        }
        setUsersTabMasterByUserId(masterByUser)

        const masterIdsFromPeople = [...new Set(people.map((p) => p.master_user_id))]
        const masterIdsFromUsers = [
          ...new Set(
            [...Object.values(masterByUser), ...Object.values(overrides)].filter((m): m is string => m != null),
          ),
        ]
        const allMasterIds = [...new Set([...masterIdsFromPeople, ...masterIdsFromUsers])]
        const personIds = people.map((p) => p.id)
        const [labelsRows, plMap, ulMap] = await Promise.all([
          fetchLabelsForMasterIds(allMasterIds),
          fetchPeopleLabelsForPersonIds(personIds),
          fetchUserLabelsForUserIds(userIds),
        ])
        if (cancelled) return
        setUsersTabLabels(labelsRows)
        setUsersTabLabelsByPersonId(plMap)
        setUsersTabLabelsByUserId(ulMap)
      } catch (e) {
        if (!cancelled) {
          showToast(e instanceof Error ? e.message : 'Failed to load tags', 'error')
        }
      } finally {
        if (!cancelled) setUsersTabTagsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isDev, activeTab, showUsersTabTags, people, users, showToast])

  const usersTabLabelById = useMemo(() => {
    const m = new Map<string, LabelRow>()
    for (const l of usersTabLabels) m.set(l.id, l)
    return m
  }, [usersTabLabels])

  const usersTabLabelIdsCatalogKey = useMemo(
    () => [...new Set(usersTabLabels.map((l) => l.id))].filter(Boolean).sort().join(','),
    [usersTabLabels],
  )

  useEffect(() => {
    if (!isDev || activeTab !== 'users' || !showUsersTabTags || !showUsersTabTagOrgSignals) {
      setUsersTabLabelUsageById({})
      setUsersTabLabelUsageLoading(false)
      return
    }
    const ids = usersTabLabelIdsCatalogKey ? usersTabLabelIdsCatalogKey.split(',') : []
    if (ids.length === 0) {
      setUsersTabLabelUsageById({})
      setUsersTabLabelUsageLoading(false)
      return
    }
    let cancelled = false
    setUsersTabLabelUsageLoading(true)
    void fetchLabelUsageCounts(ids)
      .then((m) => {
        if (!cancelled) setUsersTabLabelUsageById(m)
      })
      .catch((e) => {
        if (!cancelled) {
          showToast(e instanceof Error ? e.message : 'Failed to load label usage', 'error')
          setUsersTabLabelUsageById({})
        }
      })
      .finally(() => {
        if (!cancelled) setUsersTabLabelUsageLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isDev, activeTab, showUsersTabTags, showUsersTabTagOrgSignals, usersTabLabelIdsCatalogKey, showToast])

  const tagOrgMasterLabel = useCallback(
    (masterId: string) => {
      const m = tagOrgMasterSelectOptions.find((x) => x.id === masterId)
      return m ? m.name?.trim() || m.email?.trim() || masterId : masterId
    },
    [tagOrgMasterSelectOptions],
  )

  const applyUserTagOrgChange = useCallback(
    async (userId: string, nextMasterId: string) => {
      if (!authUserId) return
      setUsersTabTagOrgSavingUserId(userId)
      try {
        let resolvedMaster: string | null
        if (!nextMasterId) {
          await deleteUserTagOrg(userId)
          setUsersTabTagOrgSavedMasterId((prev) => ({ ...prev, [userId]: null }))
          resolvedMaster = await resolveManagerUserIdForFeedback(userId)
        } else {
          await upsertUserTagOrg(userId, nextMasterId, authUserId)
          setUsersTabTagOrgSavedMasterId((prev) => ({ ...prev, [userId]: nextMasterId }))
          resolvedMaster = nextMasterId
        }
        setUsersTabMasterByUserId((prev) => {
          const next = { ...prev, [userId]: resolvedMaster }
          const allMasterIds = [
            ...new Set([
              ...people.map((p) => p.master_user_id),
              ...Object.values(next).filter((m): m is string => m != null),
            ]),
          ]
          void fetchLabelsForMasterIds(allMasterIds).then((rows) => setUsersTabLabels(rows))
          return next
        })
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Failed to save tag org', 'error')
      } finally {
        setUsersTabTagOrgSavingUserId(null)
      }
    },
    [authUserId, people, showToast],
  )

  const deleteLabelFromCatalog = useCallback(
    async (rowId: string) => {
      setUsersTabLabelCatalogDeletingId(rowId)
      try {
        await deleteLabel(rowId)
        setUsersTabLabels((prev) => prev.filter((l) => l.id !== rowId))
        setUsersTabLabelUsageById((prev) => {
          const next = { ...prev }
          delete next[rowId]
          return next
        })
        setUsersTabLabelsByPersonId((prev) => {
          const next: Record<string, string[]> = {}
          for (const [pid, arr] of Object.entries(prev)) {
            next[pid] = arr.filter((lid) => lid !== rowId)
          }
          return next
        })
        setUsersTabLabelsByUserId((prev) => {
          const next: Record<string, string[]> = {}
          for (const [uid, arr] of Object.entries(prev)) {
            next[uid] = arr.filter((lid) => lid !== rowId)
          }
          return next
        })
        showToast('Tag removed from catalog', 'success')
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Failed to delete tag', 'error')
      } finally {
        setUsersTabLabelCatalogDeletingId(null)
      }
    },
    [showToast],
  )

  return {
    showUsersTabTags,
    setShowUsersTabTags,
    showUsersTabTagOrgSignals,
    setShowUsersTabTagOrgSignals,
    usersTabLabels,
    usersTabLabelsByPersonId,
    usersTabLabelsByUserId,
    usersTabMasterByUserId,
    usersTabTagOrgSavedMasterId,
    usersTabTagSignalsByUserId,
    tagOrgMasterSelectOptions,
    usersTabLabelUsageById,
    usersTabLabelById,
    usersTabTagsLoading,
    usersTabLabelUsageLoading,
    usersTabLabelCatalogDeletingId,
    usersTabTagOrgSavingUserId,
    usersTabSavingTagKey,
    usersTabTagDraftByKey,
    setUsersTabLabels,
    setUsersTabLabelsByPersonId,
    setUsersTabLabelsByUserId,
    setUsersTabSavingTagKey,
    setUsersTabTagDraftByKey,
    tagOrgMasterLabel,
    applyUserTagOrgChange,
    deleteLabelFromCatalog,
  }
}
