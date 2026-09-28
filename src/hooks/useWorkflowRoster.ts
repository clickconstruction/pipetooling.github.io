/**
 * Who is looking at the Workflow page, and who can be put on a step: the
 * viewer's role and name, the Assign picker's roster, every readable account
 * name, the contact details behind a name, and which names are
 * subcontractors (the header's Subs strip).
 *
 * One read of the viewer's own `users` row, then `people` (the viewer's own
 * roster — a superintendent's is its adopted masters') and one `users` read of
 * every assignable role, in parallel. RLS trims what each viewer may see.
 */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import { WORKFLOW_ASSIGNABLE_USER_ROLES, buildWorkflowUserRoster } from '../lib/workflow/stepAssignment'

export type WorkflowViewerRole = 'dev' | 'master_technician' | 'assistant' | 'subcontractor' | 'helpers' | 'superintendent'

export type WorkflowRoster = {
  /** Null until the viewer's own row has been read. */
  userRole: WorkflowViewerRole | null
  /** The viewer's name, else their email. */
  currentUserName: string | null
  /** The Assign picker: active accounts, then the viewer's roster people (with their id), by name. */
  roster: { name: string; personId?: string | null }[]
  /** Every readable account name, lower-cased — a held step whose name is here is not a ghost. */
  userNames: Set<string>
  /** Email and phone by name; a roster person wins over an account of the same name. */
  personContacts: Record<string, { email: string | null; phone: string | null }>
  /** Roster people of kind "sub" by id, and sub names (people and subcontractor accounts) lower-cased. */
  subIdentity: { ids: Set<string>; namesLower: Set<string> }
}

export function useWorkflowRoster(authUserId: string | undefined): WorkflowRoster {
  const [userRole, setUserRole] = useState<WorkflowViewerRole | null>(null)
  const [currentUserName, setCurrentUserName] = useState<string | null>(null)
  const [roster, setRoster] = useState<{ name: string; personId?: string | null }[]>([])
  const [userNames, setUserNames] = useState<Set<string>>(new Set())
  const [personContacts, setPersonContacts] = useState<Record<string, { email: string | null; phone: string | null }>>({})
  const [subIdentity, setSubIdentity] = useState<{ ids: Set<string>; namesLower: Set<string> }>({ ids: new Set(), namesLower: new Set() })

  useEffect(() => {
    if (!authUserId) return
    ;(async () => {
      // Load user role and name
      const { data: userData } = await supabase
        .from('users')
        .select('role, name, email')
        .eq('id', authUserId)
        .single()
      if (userData) {
        setUserRole((userData as { role: 'dev' | 'master_technician' | 'assistant' | 'subcontractor' | 'helpers' | 'superintendent' }).role)
        const userName = (userData as { name: string | null; email: string | null }).name || (userData as { name: string | null; email: string | null }).email
        setCurrentUserName(userName)
      }

      const role = (userData as { role: string } | null)?.role
      let peopleRes: { data: { id: string; name: string; email: string | null; phone: string | null; kind: string }[] | null }
      type WorkflowUserRead = { name: string | null; email: string | null; role: string | null; archived_at: string | null; is_digital_twin: boolean | null }
      let usersRes: { data: WorkflowUserRead[] | null }

      // One users read for every viewer (J31-N3, v2.2900): the superintendent
      // branch used to fetch only sub/helper/primary, so every office assignee
      // rendered "(not a user)" and could not be picked. The role list is the
      // shared kernel's; RLS trims what each viewer may actually see.
      const usersQuery = supabase
        .from('users')
        .select('name, email, role, archived_at, is_digital_twin')
        .in('role', WORKFLOW_ASSIGNABLE_USER_ROLES as Database['public']['Enums']['user_role'][])
      if (role === 'superintendent') {
        const { data: adopted } = await supabase
          .from('master_superintendents')
          .select('master_id')
          .eq('superintendent_id', authUserId)
        const adoptedMasterIds = (adopted ?? []).map((r) => r.master_id)
        ;[peopleRes, usersRes] = await Promise.all([
          adoptedMasterIds.length > 0
            ? supabase.from('people').select('id, name, email, phone, kind').is('archived_at', null).in('master_user_id', adoptedMasterIds).order('name')
            : { data: [] as { id: string; name: string; email: string | null; phone: string | null; kind: string }[] },
          usersQuery,
        ])
      } else {
        ;[peopleRes, usersRes] = await Promise.all([
          supabase.from('people').select('id, name, email, phone, kind').is('archived_at', null).eq('master_user_id', authUserId).order('name'),
          usersQuery,
        ])
      }
      const fromPeople = (peopleRes.data as { id: string; name: string; email: string | null; phone: string | null; kind: string }[] | null) ?? []
      const fromUsers = (usersRes.data as WorkflowUserRead[] | null) ?? []
      // Picker offers active accounts only (twins/archived drop out, #19);
      // userNames keeps every readable account so no held step looks like a ghost.
      const { roster: activeUsers, userNamesLower } = buildWorkflowUserRoster(fromUsers)
      // people-sourced entries carry their roster id so assignment can write
      // assigned_person_id explicitly (users-sourced entries resolve server-side)
      const rosterEntries = [
        ...activeUsers.filter((r): r is WorkflowUserRead & { name: string } => !!r.name).map((r) => ({ name: r.name, personId: null as string | null })),
        ...fromPeople.filter((r) => !!r.name).map((r) => ({ name: r.name, personId: r.id })),
      ].sort((a, b) => a.name.localeCompare(b.name))
      setRoster(rosterEntries)
      setUserNames(userNamesLower)
      
      // Build contact map
      const contacts: Record<string, { email: string | null; phone: string | null }> = {}
      fromPeople.forEach((p) => {
        if (p.name) {
          contacts[p.name] = { email: p.email, phone: p.phone }
        }
      })
      fromUsers.forEach((u) => {
        if (u.name) {
          // Only set if not already set (people take precedence)
          if (!contacts[u.name]) {
            contacts[u.name] = { email: u.email, phone: null }
          }
        }
      })
      setPersonContacts(contacts)

      // Sub identity for the header "Subs" strip: roster ids of kind='sub'
      // plus subcontractor-role login names (person-id first, name fallback).
      const subIds = new Set<string>()
      const subNamesLower = new Set<string>()
      fromPeople.forEach((p) => {
        if (p.kind === 'sub') {
          subIds.add(p.id)
          if (p.name) subNamesLower.add(p.name.trim().toLowerCase())
        }
      })
      fromUsers.forEach((u) => {
        if (u.role === 'subcontractor' && u.name) subNamesLower.add(u.name.trim().toLowerCase())
      })
      setSubIdentity({ ids: subIds, namesLower: subNamesLower })
    })()
  }, [authUserId])

  return { userRole, currentUserName, roster, userNames, personContacts, subIdentity }
}
