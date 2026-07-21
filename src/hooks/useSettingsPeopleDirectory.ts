import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { cascadePersonNameInPayTables } from '../lib/cascadePersonName'
import { findPersonUserDuplicates, findNameSimilarDuplicates, mergePersonIntoUser } from '../lib/mergePersonUserDuplicates'
import type { PayConfigRowForMerge } from '../lib/mergePersonUserDuplicates'
import type { PersonRow, UserRow } from '../types/settingsRows'

/**
 * Settings → People & accounts directory engine (dev only): Additional People
 * (myPeople/nonUserPeople + person edit/delete with pay-table name cascade),
 * Task Dispatch / Estimator Inbox group toggles, Pay Approved Masters, and the
 * find/merge-duplicates flow. Extracted verbatim from Settings.tsx (v2.857);
 * loads on mount when `enabled` (dev). `setError` is the parent's shared error
 * state (map quirk #4 — the Additional People section is its only real render
 * site). `onDataChanged` is the parent's full `loadData` reload, awaited after
 * a merge exactly as before.
 */
export function useSettingsPeopleDirectory({
  enabled,
  authUserId,
  users,
  setError,
  onDataChanged,
}: {
  enabled: boolean
  authUserId: string | null
  users: UserRow[]
  setError: (message: string | null) => void
  onDataChanged: () => Promise<void> | void
}) {
  const [myPeople, setMyPeople] = useState<PersonRow[]>([])
  const [nonUserPeople, setNonUserPeople] = useState<PersonRow[]>([])
  const [allPeopleCount, setAllPeopleCount] = useState<number>(0)
  const [dispatchMemberIds, setDispatchMemberIds] = useState<Set<string>>(new Set())
  const [dispatchGroupError, setDispatchGroupError] = useState<string | null>(null)
  const [dispatchGroupSavingUserId, setDispatchGroupSavingUserId] = useState<string | null>(null)
  const [estimatorMemberIds, setEstimatorMemberIds] = useState<Set<string>>(new Set())
  const [estimatorGroupError, setEstimatorGroupError] = useState<string | null>(null)
  const [estimatorGroupSavingUserId, setEstimatorGroupSavingUserId] = useState<string | null>(null)
  const [payApprovedMasterIds, setPayApprovedMasterIds] = useState<Set<string>>(new Set())
  const [payApprovedMasters, setPayApprovedMasters] = useState<UserRow[]>([])
  const [payApprovedSaving, setPayApprovedSaving] = useState(false)
  const [payApprovedError, setPayApprovedError] = useState<string | null>(null)
  const [payApprovedMastersSectionOpen, setPayApprovedMastersSectionOpen] = useState(false)
  const [taskDispatchSectionOpen, setTaskDispatchSectionOpen] = useState(false)
  const [estimatorInboxSectionOpen, setEstimatorInboxSectionOpen] = useState(false)
  const [additionalPeopleSectionOpen, setAdditionalPeopleSectionOpen] = useState(false)
  const [roleVisibilityExpanded, setRoleVisibilityExpanded] = useState(false)
  const [editingNonUserPerson, setEditingNonUserPerson] = useState<PersonRow | null>(null)
  const [editPersonName, setEditPersonName] = useState('')
  const [editPersonEmail, setEditPersonEmail] = useState('')
  const [editPersonPhone, setEditPersonPhone] = useState('')
  const [editPersonNotes, setEditPersonNotes] = useState('')
  const [editPersonSaving, setEditPersonSaving] = useState(false)
  const [editPersonError, setEditPersonError] = useState<string | null>(null)
  const [deletingPersonId, setDeletingPersonId] = useState<string | null>(null)
  const [mergeDuplicatesModalOpen, setMergeDuplicatesModalOpen] = useState(false)
  const [mergeDuplicatesLoading, setMergeDuplicatesLoading] = useState(false)
  const [mergeDuplicates, setMergeDuplicates] = useState<Array<{ personName: string; userDisplayName: string; email: string }>>([])
  const [mergingPersonName, setMergingPersonName] = useState<string | null>(null)

  async function toggleDispatchGroupMember(userId: string, currentlyMember: boolean) {
    if (!enabled) return
    setDispatchGroupSavingUserId(userId)
    setDispatchGroupError(null)
    try {
      if (currentlyMember) {
        const { error } = await supabase.from('dispatch_group_members').delete().eq('user_id', userId)
        if (error) setDispatchGroupError(error.message)
        else
          setDispatchMemberIds((prev) => {
            const n = new Set(prev)
            n.delete(userId)
            return n
          })
      } else {
        const { error } = await supabase.from('dispatch_group_members').insert({ user_id: userId })
        if (error) setDispatchGroupError(error.message)
        else setDispatchMemberIds((prev) => new Set(prev).add(userId))
      }
    } finally {
      setDispatchGroupSavingUserId(null)
    }
  }

  async function toggleEstimatorGroupMember(userId: string, currentlyMember: boolean) {
    if (!enabled) return
    setEstimatorGroupSavingUserId(userId)
    setEstimatorGroupError(null)
    try {
      if (currentlyMember) {
        const { error } = await supabase.from('estimator_group_members').delete().eq('user_id', userId)
        if (error) setEstimatorGroupError(error.message)
        else
          setEstimatorMemberIds((prev) => {
            const n = new Set(prev)
            n.delete(userId)
            return n
          })
      } else {
        const { error } = await supabase.from('estimator_group_members').insert({ user_id: userId })
        if (error) setEstimatorGroupError(error.message)
        else setEstimatorMemberIds((prev) => new Set(prev).add(userId))
      }
    } finally {
      setEstimatorGroupSavingUserId(null)
    }
  }

  async function loadPeopleForDev() {
    if (!authUserId || !enabled) return
    const { data: list } = await supabase.from('users').select('id, email, name').order('name')
    const userEmails = new Set((list as UserRow[] | null)?.map(u => u.email?.toLowerCase()).filter(Boolean) ?? [])
    const { data: allPeople, error: ePeople } = await supabase
      .from('people')
      .select('id, master_user_id, kind, name, email, phone, notes')
      .is('archived_at', null)
      .order('name')
    if (ePeople) {
      setAllPeopleCount(0)
      return
    }
    if (!allPeople) {
      setMyPeople([])
      setNonUserPeople([])
      setAllPeopleCount(0)
      return
    }
    setAllPeopleCount(allPeople.length)
    type PeopleRow = { id: string; master_user_id: string; kind: string; name: string; email: string | null; phone: string | null; notes: string | null }
    const peopleFromMe = (allPeople as PeopleRow[]).filter(p => p.master_user_id === authUserId)
    const peopleFromOthers = (allPeople as PeopleRow[]).filter(p => p.master_user_id !== authUserId)
    setMyPeople(peopleFromMe.map(p => ({
      ...p,
      creator_name: null,
      creator_email: null,
      is_user: p.email ? userEmails.has(p.email.toLowerCase()) : false,
    })))
    if (peopleFromOthers.length === 0) {
      setNonUserPeople([])
      return
    }
    const creatorIds = [...new Set(peopleFromOthers.map(p => p.master_user_id))]
    const { data: creators } = await supabase.from('users').select('id, name, email').in('id', creatorIds)
    const creatorMap = new Map((creators as Array<{ id: string; name: string; email: string }> | null)?.map(c => [c.id, c]) ?? [])
    setNonUserPeople(peopleFromOthers.map(p => ({
      ...p,
      creator_name: creatorMap.get(p.master_user_id)?.name ?? null,
      creator_email: creatorMap.get(p.master_user_id)?.email ?? null,
      is_user: p.email ? userEmails.has(p.email.toLowerCase()) : false,
    })))
  }

  async function saveNonUserPersonEdit(e: FormEvent) {
    e.preventDefault()
    if (!editingNonUserPerson) return
    const trimmedName = editPersonName.trim()
    if (!trimmedName) {
      setEditPersonError('Name is required')
      return
    }
    setEditPersonSaving(true)
    setEditPersonError(null)
    const { error: err } = await supabase.from('people').update({
      name: trimmedName,
      email: editPersonEmail.trim() || null,
      phone: editPersonPhone.trim() || null,
      notes: editPersonNotes.trim() || null,
    }).eq('id', editingNonUserPerson.id)
    setEditPersonSaving(false)
    if (err) setEditPersonError(err.message)
    else {
      const oldName = editingNonUserPerson.name?.trim()
      if (oldName && oldName !== trimmedName) {
        await cascadePersonNameInPayTables(oldName, trimmedName)
      }
      setEditingNonUserPerson(null)
      await loadPeopleForDev()
    }
  }

  async function deleteNonUserPerson(p: PersonRow) {
    if (!confirm(`Delete "${p.name}"? A dev can put them back for 90 days from Settings → Data & migration → Recently deleted.`)) return
    setDeletingPersonId(p.id)
    setError(null)
    const { error: err } = await supabase.from('people').delete().eq('id', p.id)
    setDeletingPersonId(null)
    if (err) setError(err.message)
    else await loadPeopleForDev()
  }

  async function loadPayApprovedMasters() {
    const { data: approvedData, error: approvedErr } = await supabase
      .from('pay_approved_masters')
      .select('master_id')
    if (approvedErr) {
      setPayApprovedError(approvedErr.message)
      return
    }
    setPayApprovedMasterIds(new Set((approvedData ?? []).map((r: { master_id: string }) => r.master_id)))
    const { data: mastersData, error: mastersErr } = await supabase
      .from('users')
      .select('id, email, name, role')
      .in('role', ['master_technician', 'dev'])
      .order('name')
    if (mastersErr) {
      setPayApprovedError(mastersErr.message)
    } else {
      setPayApprovedMasters((mastersData as UserRow[]) ?? [])
    }
  }

  async function togglePayApproved(masterId: string, isApproved: boolean) {
    if (!enabled) return
    setPayApprovedSaving(true)
    setPayApprovedError(null)
    if (isApproved) {
      const { error } = await supabase.from('pay_approved_masters').delete().eq('master_id', masterId)
      if (error) setPayApprovedError(error.message)
      else setPayApprovedMasterIds((prev) => { const n = new Set(prev); n.delete(masterId); return n })
    } else {
      const { error } = await supabase.from('pay_approved_masters').insert({ master_id: masterId })
      if (error) setPayApprovedError(error.message)
      else setPayApprovedMasterIds((prev) => new Set(prev).add(masterId))
    }
    setPayApprovedSaving(false)
  }

  async function openFindDuplicatesModal() {
    setMergeDuplicatesModalOpen(true)
    setMergeDuplicatesLoading(true)
    try {
      const { data } = await supabase
        .from('people_pay_config')
        .select('person_name, person_id, hourly_wage, is_salary, record_hours_but_salary')
      const payConfig: Record<string, PayConfigRowForMerge> = {}
      for (const r of (data ?? []) as PayConfigRowForMerge[]) {
        payConfig[r.person_name] = r
      }
      const people = [...myPeople, ...nonUserPeople]
      const emailDups = findPersonUserDuplicates(people, users, payConfig)
      const nameSimilarDups = findNameSimilarDuplicates(payConfig)
      const seen = new Set<string>()
      const dups = [...emailDups]
      for (const d of emailDups) seen.add(`${d.personName}|${d.userDisplayName}`)
      for (const d of nameSimilarDups) {
        const key = `${d.personName}|${d.userDisplayName}`
        if (!seen.has(key)) {
          seen.add(key)
          dups.push(d)
        }
      }
      setMergeDuplicates(dups)
    } finally {
      setMergeDuplicatesLoading(false)
    }
  }

  async function handleMergeDuplicate(dup: { personName: string; userDisplayName: string; email: string }) {
    setMergingPersonName(dup.personName)
    setError(null)
    let userId: string | undefined
    if (dup.email?.trim()) {
      userId = users.find((u) => u.email?.toLowerCase() === dup.email?.toLowerCase())?.id
    } else {
      userId = users.find((u) => u.name?.trim() === dup.personName)?.id ?? users.find((u) => u.name?.trim() === dup.userDisplayName)?.id
    }
    try {
      const { data } = await supabase
        .from('people_pay_config')
        .select('person_name, person_id, hourly_wage, is_salary, record_hours_but_salary')
      const payConfig: Record<string, PayConfigRowForMerge> = {}
      for (const r of (data ?? []) as PayConfigRowForMerge[]) {
        payConfig[r.person_name] = r
      }
      const mergePeople = [...myPeople, ...nonUserPeople].map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        archived_at: 'archived_at' in p ? (p as { archived_at?: string | null }).archived_at : null,
      }))
      await mergePersonIntoUser(dup.personName, dup.userDisplayName, payConfig, userId, mergePeople)
      await onDataChanged()
      setMergeDuplicates((prev) => prev.filter((x) => x.personName !== dup.personName))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge failed')
    } finally {
      setMergingPersonName(null)
    }
  }

  // Initial loads (were part of Settings.tsx loadData's dev branch)
  useEffect(() => {
    if (!enabled || !authUserId) return
    void loadPeopleForDev()
    void loadPayApprovedMasters()
    void (async () => {
      const [dgmRes, egmRes] = await Promise.all([
        supabase.from('dispatch_group_members').select('user_id'),
        supabase.from('estimator_group_members').select('user_id'),
      ])
      if (dgmRes.error) setError(dgmRes.error.message)
      else setDispatchMemberIds(new Set((dgmRes.data ?? []).map((r: { user_id: string }) => r.user_id)))
      if (egmRes.error) setError(egmRes.error.message)
      else setEstimatorMemberIds(new Set((egmRes.data ?? []).map((r: { user_id: string }) => r.user_id)))
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, authUserId])

  return {
    myPeople,
    nonUserPeople,
    allPeopleCount,
    dispatchMemberIds,
    dispatchGroupError,
    dispatchGroupSavingUserId,
    estimatorMemberIds,
    estimatorGroupError,
    estimatorGroupSavingUserId,
    payApprovedMasterIds,
    payApprovedMasters,
    payApprovedSaving,
    payApprovedError,
    payApprovedMastersSectionOpen,
    setPayApprovedMastersSectionOpen,
    taskDispatchSectionOpen,
    setTaskDispatchSectionOpen,
    estimatorInboxSectionOpen,
    setEstimatorInboxSectionOpen,
    additionalPeopleSectionOpen,
    setAdditionalPeopleSectionOpen,
    roleVisibilityExpanded,
    setRoleVisibilityExpanded,
    editingNonUserPerson,
    setEditingNonUserPerson,
    editPersonName,
    setEditPersonName,
    editPersonEmail,
    setEditPersonEmail,
    editPersonPhone,
    setEditPersonPhone,
    editPersonNotes,
    setEditPersonNotes,
    editPersonSaving,
    editPersonError,
    setEditPersonError,
    deletingPersonId,
    mergeDuplicatesModalOpen,
    setMergeDuplicatesModalOpen,
    mergeDuplicatesLoading,
    mergeDuplicates,
    mergingPersonName,
    toggleDispatchGroupMember,
    toggleEstimatorGroupMember,
    loadPeopleForDev,
    saveNonUserPersonEdit,
    deleteNonUserPerson,
    loadPayApprovedMasters,
    togglePayApproved,
    openFindDuplicatesModal,
    handleMergeDuplicate,
  }
}
