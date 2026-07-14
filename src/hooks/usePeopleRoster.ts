import { useEffect, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { supabase } from '../lib/supabase'
import { cascadePersonNameInPayTables } from '../lib/cascadePersonName'

export type Person = {
  id: string
  master_user_id: string
  kind: string
  name: string
  email: string | null
  phone: string | null
  notes: string | null
}
export type UserRow = {
  id: string
  email: string | null
  name: string
  role: string
  notes: string | null
  phone: string | null
}
export type PersonKind =
  | 'assistant'
  | 'master_technician'
  | 'sub'
  | 'helper'
  | 'estimator'
  | 'primary'
  | 'superintendent'
  | 'controller'

/**
 * Page-owned dependencies the roster loaders/handlers reach into. These live on
 * the parent component (general page error/loading/role state and the active
 * projects loader) and are read lazily via a ref so this hook can be invoked at
 * the top of the component before those values are declared, while still
 * observing their latest values when a loader/handler actually runs.
 */
export type UsePeopleRosterDeps = {
  setLoading: Dispatch<SetStateAction<boolean>>
  setError: Dispatch<SetStateAction<string | null>>
  setAuthUserRole: Dispatch<SetStateAction<string | null>>
  loadPersonProjects: () => Promise<void>
  isDev: boolean
  authUserRole: string | null
}

/**
 * Owns the People page roster layer: the `users`/`people`/`archivedPeople`
 * lists, creator-name lookups, the person create/edit form state, and the
 * loaders/handlers that mutate them. The parent component destructures the
 * returned object; loaders that touch page-level state read those through the
 * `depsRef` so the boundary stays explicit.
 */
export function usePeopleRoster(
  authUserId: string | undefined,
  depsRef: MutableRefObject<UsePeopleRosterDeps>,
) {
  const [users, setUsers] = useState<UserRow[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [archivedPeople, setArchivedPeople] = useState<Array<Person & { archived_at: string }>>([])
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({})
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Person | null>(null)
  const [kind, setKind] = useState<PersonKind>('assistant')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadPeople() {
    const deps = depsRef.current
    if (!authUserId) {
      deps.setLoading(false)
      return
    }
    deps.setError(null)
    const [peopleRes, usersRes, meRes] = await Promise.all([
      supabase.from('people').select('id, master_user_id, kind, name, email, phone, notes').is('archived_at', null).order('kind').order('name'),
      supabase.from('users').select('id, email, name, role, notes, phone').is('archived_at', null).in('role', ['assistant', 'master_technician', 'subcontractor', 'helpers', 'estimator', 'primary', 'superintendent', 'controller' as 'assistant']),
      supabase.from('users').select('role').eq('id', authUserId).single(),
    ])
    if (peopleRes.error) deps.setError(peopleRes.error.message)
    else setPeople((peopleRes.data as Person[]) ?? [])
    let usersList = (usersRes.data as UserRow[]) ?? []
    const myRole = (meRes.data as { role?: string } | null)?.role ?? null
    deps.setAuthUserRole(myRole)
    if (myRole === 'dev') {
      const { data: devUsers } = await supabase.from('users').select('id, email, name, role, notes, phone').is('archived_at', null).eq('role', 'dev')
      if (devUsers && devUsers.length > 0) {
        const existingIds = new Set(usersList.map((u) => u.id))
        const newDevs = (devUsers as UserRow[]).filter((u) => !existingIds.has(u.id))
        usersList = [...usersList, ...newDevs]
      }
    }
    if (usersRes.error) deps.setError(usersRes.error.message)
    setUsers(usersList)

    // Load creator names for shared people (created by others)
    const peopleData = (peopleRes.data as Person[]) ?? []
    const creatorIds = [...new Set(peopleData.filter((p) => p.master_user_id !== authUserId).map((p) => p.master_user_id))]
    if (creatorIds.length > 0) {
      const { data: creators } = await supabase.from('users').select('id, name, email').is('archived_at', null).in('id', creatorIds)
      const map: Record<string, string> = {}
      for (const c of (creators as Array<{ id: string; name: string | null; email: string | null }>) ?? []) {
        map[c.id] = c.name ?? c.email ?? 'Unknown'
      }
      setCreatorNames(map)
    } else {
      setCreatorNames({})
    }

    // Load active projects for all people
    await deps.loadPersonProjects()

    await loadArchivedPeople(myRole === 'dev')
    deps.setLoading(false)
  }

  function openAdd(k: PersonKind) {
    setEditing(null)
    setKind(k)
    setName('')
    setEmail('')
    setPhone('')
    setNotes('')
    setFormOpen(true)
    depsRef.current.setError(null)
  }

  function openEdit(p: Person) {
    setEditing(p)
    setKind(p.kind as PersonKind)
    setName(p.name)
    setEmail(p.email ?? '')
    setPhone(p.phone ?? '')
    setNotes(p.notes ?? '')
    setFormOpen(true)
    depsRef.current.setError(null)
  }

  function closeForm() {
    setFormOpen(false)
  }

  async function checkDuplicateName(nameToCheck: string, excludeId?: string): Promise<boolean> {
    const trimmedName = nameToCheck.trim().toLowerCase()
    if (!trimmedName) return false

    // Check in people table (excluding current person if editing, exclude archived)
    const peopleQuery = supabase
      .from('people')
      .select('id, name')
      .is('archived_at', null)
    if (excludeId) {
      peopleQuery.neq('id', excludeId)
    }
    const { data: peopleData } = await peopleQuery

    // Check in users table
    const { data: usersData } = await supabase
      .from('users')
      .select('id, name')
      .is('archived_at', null)

    // Case-insensitive comparison
    const hasDuplicateInPeople = peopleData?.some(p => p.name?.toLowerCase() === trimmedName) ?? false
    const hasDuplicateInUsers = usersData?.some(u => u.name?.toLowerCase() === trimmedName) ?? false

    return hasDuplicateInPeople || hasDuplicateInUsers
  }

  async function handleSave(e: React.FormEvent) {
    const deps = depsRef.current
    e.preventDefault()
    if (!authUserId) return
    setSaving(true)
    deps.setError(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      deps.setError('Name is required')
      setSaving(false)
      return
    }

    // Check for duplicate names (case-insensitive)
    const isDuplicate = await checkDuplicateName(trimmedName, editing?.id)
    if (isDuplicate) {
      deps.setError(`A person or user with the name "${trimmedName}" already exists. Names must be unique.`)
      setSaving(false)
      return
    }

    const canCreatePeopleInRoster =
      deps.authUserRole !== null && ['dev', 'master_technician', 'assistant', 'controller'].includes(deps.authUserRole)
    if (!editing && !canCreatePeopleInRoster) {
      deps.setError('You do not have permission to add people to the roster.')
      setSaving(false)
      return
    }

    const payload = {
      kind,
      name: trimmedName,
      email: email.trim() || null,
      phone: phone.trim() || null,
      notes: notes.trim() || null,
    }
    if (editing) {
      const { error: err } = await supabase.from('people').update(payload).eq('id', editing.id)
      if (err) deps.setError(err.message)
      else {
        const oldName = editing.name?.trim()
        if (oldName && oldName !== trimmedName) {
          await cascadePersonNameInPayTables(oldName, trimmedName)
        }
        setPeople((prev) => prev.map((p) => (p.id === editing.id ? { ...p, ...payload } : p)))
        closeForm()
      }
    } else {
      const { data, error: err } = await supabase.from('people').insert({ master_user_id: authUserId, ...payload }).select('id, master_user_id, kind, name, email, phone, notes').single()
      if (err) deps.setError(err.message)
      else if (data) {
        setPeople((prev) => [...prev, data as Person].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)))
        closeForm()
      }
    }
    setSaving(false)
  }

  async function loadArchivedPeople(showAll?: boolean) {
    if (!authUserId) return
    const { data } = await supabase
      .from('people')
      .select('id, master_user_id, kind, name, email, phone, notes, archived_at')
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false })
    const list = (data ?? []) as Array<Person & { archived_at: string }>
    const visible = (showAll ?? depsRef.current.isDev) ? list : list.filter((p) => p.master_user_id === authUserId)
    setArchivedPeople(visible)
  }

  useEffect(() => {
    loadPeople()
  }, [authUserId])

  return {
    users,
    setUsers,
    people,
    setPeople,
    archivedPeople,
    setArchivedPeople,
    creatorNames,
    setCreatorNames,
    formOpen,
    setFormOpen,
    editing,
    setEditing,
    kind,
    setKind,
    name,
    setName,
    email,
    setEmail,
    phone,
    setPhone,
    notes,
    setNotes,
    saving,
    setSaving,
    loadPeople,
    loadArchivedPeople,
    handleSave,
    openAdd,
    openEdit,
    closeForm,
  }
}
