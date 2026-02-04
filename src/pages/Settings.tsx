import { useEffect, useState } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

type UserRole = 'dev' | 'master_technician' | 'assistant' | 'subcontractor' | 'estimator'

type UserRow = {
  id: string
  email: string
  name: string
  role: UserRole
  last_sign_in_at: string | null
}

type PersonRow = {
  id: string
  master_user_id: string
  kind: string
  name: string
  email: string | null
  phone: string | null
  notes: string | null
  creator_name: string | null
  creator_email: string | null
  is_user: boolean
}

type EmailTemplate = {
  id: string
  template_type: 'invitation' | 'sign_in' | 'login_as' | 
    'stage_assigned_started' | 'stage_assigned_complete' | 'stage_assigned_reopened' |
    'stage_me_started' | 'stage_me_complete' | 'stage_me_reopened' |
    'stage_next_complete_or_approved' | 'stage_prior_rejected'
  subject: string
  body: string
  updated_at: string | null
}

const ROLES: UserRole[] = ['dev', 'master_technician', 'assistant', 'subcontractor', 'estimator']

const VARIABLE_HINT = '{{name}}, {{email}}, {{role}}, {{link}}'

function timeSinceAgo(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso).getTime()
  const now = Date.now()
  const sec = Math.floor((now - d) / 1000)
  if (sec < 60) return 'Just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hr ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} day${day === 1 ? '' : 's'} ago`
  const mo = Math.floor(day / 30)
  return `${mo} mo ago`
}

export default function Settings() {
  const navigate = useNavigate()
  const { user: authUser } = useAuth()
  const [myRole, setMyRole] = useState<UserRole | null>(null)
  const [users, setUsers] = useState<UserRow[]>([])
  const [myPeople, setMyPeople] = useState<PersonRow[]>([])
  const [nonUserPeople, setNonUserPeople] = useState<PersonRow[]>([])
  const [allPeopleCount, setAllPeopleCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([])
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [templateSubject, setTemplateSubject] = useState('')
  const [templateBody, setTemplateBody] = useState('')
  const [templateSaving, setTemplateSaving] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [testingTemplate, setTestingTemplate] = useState<EmailTemplate | null>(null)
  const [testSending, setTestSending] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [codeSubmitting, setCodeSubmitting] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('master_technician')
  const [inviteName, setInviteName] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSubmitting, setInviteSubmitting] = useState(false)
  const [manualAddOpen, setManualAddOpen] = useState(false)
  const [manualAddEmail, setManualAddEmail] = useState('')
  const [manualAddName, setManualAddName] = useState('')
  const [manualAddRole, setManualAddRole] = useState<UserRole>('master_technician')
  const [manualAddPassword, setManualAddPassword] = useState('')
  const [manualAddError, setManualAddError] = useState<string | null>(null)
  const [manualAddSubmitting, setManualAddSubmitting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteEmail, setDeleteEmail] = useState('')
  const [deleteName, setDeleteName] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [sendingSignInEmailId, setSendingSignInEmailId] = useState<string | null>(null)
  const [loggingInAsId, setLoggingInAsId] = useState<string | null>(null)
  const [setPasswordUser, setSetPasswordUser] = useState<UserRow | null>(null)
  const [setPasswordValue, setSetPasswordValue] = useState('')
  const [setPasswordConfirm, setSetPasswordConfirm] = useState('')
  const [setPasswordSubmitting, setSetPasswordSubmitting] = useState(false)
  const [setPasswordError, setSetPasswordError] = useState<string | null>(null)
  const [passwordChangeOpen, setPasswordChangeOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null)
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false)
  const [passwordChangeSubmitting, setPasswordChangeSubmitting] = useState(false)
  const [assistants, setAssistants] = useState<UserRow[]>([])
  const [adoptedAssistantIds, setAdoptedAssistantIds] = useState<Set<string>>(new Set())
  const [adoptionSaving, setAdoptionSaving] = useState(false)
  const [adoptionError, setAdoptionError] = useState<string | null>(null)
  const [masters, setMasters] = useState<UserRow[]>([])
  const [sharedMasterIds, setSharedMasterIds] = useState<Set<string>>(new Set())
  const [sharingSaving, setSharingSaving] = useState(false)
  const [sharingError, setSharingError] = useState<string | null>(null)

  type OrphanedPriceRow = {
    id: string
    partId: string | null
    partName: string
    supplyHouseId: string | null
    supplyHouseName: string
    price: number
    effectiveDate: string | null
    reason: 'missing_part' | 'missing_supply_house' | 'both'
  }

  const [viewingOrphanPrices, setViewingOrphanPrices] = useState(false)
  const [orphanPrices, setOrphanPrices] = useState<OrphanedPriceRow[]>([])
  const [loadingOrphanPrices, setLoadingOrphanPrices] = useState(false)
  const [orphanError, setOrphanError] = useState<string | null>(null)

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/sign-in', { replace: true })
  }
  const [convertMasterId, setConvertMasterId] = useState<string>('')
  const [convertNewMasterId, setConvertNewMasterId] = useState<string>('')
  const [convertNewRole, setConvertNewRole] = useState<'assistant' | 'subcontractor'>('assistant')
  const [convertAutoAdopt, setConvertAutoAdopt] = useState<boolean>(true)
  const [convertSubmitting, setConvertSubmitting] = useState(false)
  const [convertError, setConvertError] = useState<string | null>(null)
  const [convertSummary, setConvertSummary] = useState<string | null>(null)
  const [exportProjectsLoading, setExportProjectsLoading] = useState(false)
  const [exportMaterialsLoading, setExportMaterialsLoading] = useState(false)
  const [exportBidsLoading, setExportBidsLoading] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  function downloadJson(filename: string, data: unknown) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async function exportProjectsBackup() {
    setExportError(null)
    setExportProjectsLoading(true)
    try {
      const [
        r1, r2, r3, r4, r5, r6, r7, r8,
      ] = await Promise.all([
        supabase.from('customers').select('*'),
        supabase.from('projects').select('*'),
        supabase.from('project_workflows').select('*'),
        supabase.from('project_workflow_steps').select('*'),
        supabase.from('project_workflow_step_actions').select('*'),
        supabase.from('step_subscriptions').select('*'),
        supabase.from('workflow_step_line_items').select('*'),
        supabase.from('workflow_projections').select('*'),
      ])
      const err = r1.error || r2.error || r3.error || r4.error || r5.error || r6.error || r7.error || r8.error
      if (err) {
        setExportError(err.message)
        return
      }
      const payload = {
        exportedAt: new Date().toISOString(),
        tables: {
          customers: r1.data ?? [],
          projects: r2.data ?? [],
          project_workflows: r3.data ?? [],
          project_workflow_steps: r4.data ?? [],
          project_workflow_step_actions: r5.data ?? [],
          step_subscriptions: r6.data ?? [],
          workflow_step_line_items: r7.data ?? [],
          workflow_projections: r8.data ?? [],
        },
      }
      downloadJson(`projects-backup-${new Date().toISOString().slice(0, 10)}.json`, payload)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExportProjectsLoading(false)
    }
  }

  async function exportMaterialsBackup() {
    setExportError(null)
    setExportMaterialsLoading(true)
    try {
      const [r1, r2, r3, r4, r5] = await Promise.all([
        supabase.from('supply_houses').select('*'),
        supabase.from('material_parts').select('*'),
        supabase.from('material_part_prices').select('*'),
        supabase.from('material_templates').select('*'),
        supabase.from('material_template_items').select('*'),
      ])
      const err = r1.error || r2.error || r3.error || r4.error || r5.error
      if (err) {
        setExportError(err.message)
        return
      }
      const payload = {
        exportedAt: new Date().toISOString(),
        tables: {
          supply_houses: r1.data ?? [],
          material_parts: r2.data ?? [],
          material_part_prices: r3.data ?? [],
          material_templates: r4.data ?? [],
          material_template_items: r5.data ?? [],
        },
      }
      downloadJson(`materials-backup-${new Date().toISOString().slice(0, 10)}.json`, payload)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExportMaterialsLoading(false)
    }
  }

  async function loadOrphanMaterialPrices() {
    setOrphanError(null)
    setLoadingOrphanPrices(true)
    try {
      const { data, error } = await supabase
        .from('material_part_prices')
        .select('*, material_parts(*), supply_houses(*)')
      if (error) {
        setOrphanError(error.message)
        setOrphanPrices([])
        return
      }
      const rows = (data as any[]) ?? []
      const classified = rows
        .map((row) => {
          const part = (row.material_parts ?? null) as { id: string; name: string | null } | null
          const sh = (row.supply_houses ?? null) as { id: string; name: string | null } | null
          const missingPart = !part
          const missingSupplyHouse = !sh
          if (!missingPart && !missingSupplyHouse) return null
          const reason: OrphanedPriceRow['reason'] =
            missingPart && missingSupplyHouse
              ? 'both'
              : missingPart
              ? 'missing_part'
              : 'missing_supply_house'
          return {
            id: row.id as string,
            partId: (row.part_id as string | null) ?? null,
            partName: part?.name ?? `Unknown part (${row.part_id ?? 'no id'})`,
            supplyHouseId: (row.supply_house_id as string | null) ?? null,
            supplyHouseName: sh?.name ?? `Unknown supply house (${row.supply_house_id ?? 'no id'})`,
            price: Number(row.price ?? 0),
            effectiveDate: (row.effective_date as string | null) ?? null,
            reason,
          } as OrphanedPriceRow
        })
        .filter((r): r is OrphanedPriceRow => r !== null)

      setOrphanPrices(classified)
    } catch (e) {
      setOrphanError(e instanceof Error ? e.message : 'Failed to load orphaned prices')
      setOrphanPrices([])
    } finally {
      setLoadingOrphanPrices(false)
    }
  }

  async function deleteOrphanPrice(id: string) {
    if (!id) return
    const { error } = await supabase.from('material_part_prices').delete().eq('id', id)
    if (error) {
      setOrphanError(error.message)
      return
    }
    setOrphanPrices((prev) => prev.filter((p) => p.id !== id))
  }

  async function deleteAllOrphanPrices() {
    if (orphanPrices.length === 0) return
    if (!confirm('Delete ALL orphaned material prices listed here? This cannot be undone.')) return
    const ids = orphanPrices.map((p) => p.id)
    const { error } = await supabase.from('material_part_prices').delete().in('id', ids)
    if (error) {
      setOrphanError(error.message)
      return
    }
    setOrphanPrices([])
  }

  async function exportBidsBackup() {
    setExportError(null)
    setExportBidsLoading(true)
    try {
      const [
        r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12, r13, r14, r15, r16,
      ] = await Promise.all([
        supabase.from('bids').select('*'),
        supabase.from('bids_gc_builders').select('*'),
        supabase.from('bids_count_rows').select('*'),
        supabase.from('bids_submission_entries').select('*'),
        supabase.from('cost_estimates').select('*'),
        supabase.from('cost_estimate_labor_rows').select('*'),
        supabase.from('fixture_labor_defaults').select('*'),
        supabase.from('bid_pricing_assignments').select('*'),
        supabase.from('price_book_versions').select('*'),
        supabase.from('price_book_entries').select('*'),
        supabase.from('labor_book_versions').select('*'),
        supabase.from('labor_book_entries').select('*'),
        supabase.from('takeoff_book_versions').select('*'),
        supabase.from('takeoff_book_entries').select('*'),
        supabase.from('purchase_orders').select('*'),
        supabase.from('purchase_order_items').select('*'),
      ])
      const err = r1.error || r2.error || r3.error || r4.error || r5.error || r6.error || r7.error || r8.error || r9.error || r10.error || r11.error || r12.error || r13.error || r14.error || r15.error || r16.error
      if (err) {
        setExportError(err.message)
        return
      }
      const payload = {
        exportedAt: new Date().toISOString(),
        tables: {
          bids: r1.data ?? [],
          bids_gc_builders: r2.data ?? [],
          bids_count_rows: r3.data ?? [],
          bids_submission_entries: r4.data ?? [],
          cost_estimates: r5.data ?? [],
          cost_estimate_labor_rows: r6.data ?? [],
          fixture_labor_defaults: r7.data ?? [],
          bid_pricing_assignments: r8.data ?? [],
          price_book_versions: r9.data ?? [],
          price_book_entries: r10.data ?? [],
          labor_book_versions: r11.data ?? [],
          labor_book_entries: r12.data ?? [],
          takeoff_book_versions: r13.data ?? [],
          takeoff_book_entries: r14.data ?? [],
          purchase_orders: r15.data ?? [],
          purchase_order_items: r16.data ?? [],
        },
      }
      downloadJson(`bids-backup-${new Date().toISOString().slice(0, 10)}.json`, payload)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExportBidsLoading(false)
    }
  }

  async function loadData() {
    if (!authUser?.id) {
      setLoading(false)
      return
    }
    const { data: me, error: eMe } = await supabase
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .single()
    if (eMe) {
      setError(eMe.message)
      setLoading(false)
      return
    }
    const role = (me as { role: UserRole } | null)?.role ?? null
    setMyRole(role)
    
    // Load assistants and adoptions for masters and devs
    if (role === 'master_technician' || role === 'dev') {
      await loadAssistantsAndAdoptions(authUser.id)
      await loadMastersAndShares(authUser.id)
    }
    
    if (role !== 'dev') {
      setLoading(false)
      return
    }
    
    // Load all users
    const { data: list, error: eList } = await supabase
      .from('users')
      .select('id, email, name, role, last_sign_in_at')
      .order('name')
    if (eList) setError(eList.message)
    else setUsers((list as UserRow[]) ?? [])
    
    // Load all people entries (RLS may restrict, but we'll filter client-side)
    // Note: RLS policy may need to allow owners to see all people entries
    const { data: allPeople, error: ePeople } = await supabase
      .from('people')
      .select('id, master_user_id, kind, name, email, phone, notes')
      .order('name')
    
    if (ePeople) {
      console.error('Error loading people:', ePeople)
      setError(ePeople.message)
      setAllPeopleCount(0)
    } else if (allPeople) {
      setAllPeopleCount(allPeople.length)
      
      // Get all user emails to check if people are users
      const userEmails = new Set((list as UserRow[] | null)?.map(u => u.email?.toLowerCase()).filter(Boolean) ?? [])
      
      // Separate people created by me vs others
      const peopleFromMe = allPeople.filter(p => p.master_user_id === authUser.id)
      const peopleFromOthers = allPeople.filter(p => p.master_user_id !== authUser.id)
      
      // Process people created by me
      const myPeopleWithInfo: PersonRow[] = peopleFromMe.map(p => ({
        ...p,
        creator_name: null, // Created by me, so no need to show creator
        creator_email: null,
        is_user: p.email ? userEmails.has(p.email.toLowerCase()) : false,
      }))
      setMyPeople(myPeopleWithInfo)
      
      // Process people created by others
      if (peopleFromOthers.length > 0) {
        // Get creator information for each person
        const creatorIds = [...new Set(peopleFromOthers.map(p => p.master_user_id))]
        const { data: creators, error: eCreators } = await supabase
          .from('users')
          .select('id, name, email')
          .in('id', creatorIds)
        
        if (eCreators) {
          console.error('Error loading creators:', eCreators)
          setError(eCreators.message)
        } else {
          const creatorMap = new Map(
            (creators as Array<{ id: string; name: string; email: string }> | null)?.map(c => [c.id, c]) ?? []
          )
          
          const peopleWithCreators: PersonRow[] = peopleFromOthers.map(p => ({
            ...p,
            creator_name: creatorMap.get(p.master_user_id)?.name ?? null,
            creator_email: creatorMap.get(p.master_user_id)?.email ?? null,
            is_user: p.email ? userEmails.has(p.email.toLowerCase()) : false,
          }))
          
          setNonUserPeople(peopleWithCreators)
        }
      } else {
        setNonUserPeople([])
      }
    } else {
      // No people entries at all
      setMyPeople([])
      setNonUserPeople([])
    }
    
    // Load email templates if dev
    if (role === 'dev') {
      await loadEmailTemplates()
    }
    
    setLoading(false)
  }

  async function loadAssistantsAndAdoptions(masterId: string) {
    // Load all assistants
    const { data: assistantsData, error: assistantsErr } = await supabase
      .from('users')
      .select('id, email, name, role')
      .eq('role', 'assistant')
      .order('name')
    
    if (assistantsErr) {
      console.error('Error loading assistants:', assistantsErr)
      setAdoptionError(assistantsErr.message)
    } else {
      setAssistants((assistantsData as UserRow[]) ?? [])
    }
    
    // Load current adoptions for this master
    const { data: adoptions, error: adoptionsErr } = await supabase
      .from('master_assistants')
      .select('assistant_id')
      .eq('master_id', masterId)
    
    if (adoptionsErr) {
      console.error('Error loading adoptions:', adoptionsErr)
      setAdoptionError(adoptionsErr.message)
    } else {
      const adoptedSet = new Set<string>()
      adoptions?.forEach(a => adoptedSet.add(a.assistant_id))
      setAdoptedAssistantIds(adoptedSet)
    }
  }

  async function toggleAdoption(assistantId: string, isAdopted: boolean) {
    if (!authUser?.id) return
    
    setAdoptionSaving(true)
    setAdoptionError(null)
    
    if (isAdopted) {
      // Unadopt: Delete the relationship
      const { error } = await supabase
        .from('master_assistants')
        .delete()
        .eq('master_id', authUser.id)
        .eq('assistant_id', assistantId)
      
      if (error) {
        setAdoptionError(error.message)
      } else {
        setAdoptedAssistantIds(prev => {
          const next = new Set(prev)
          next.delete(assistantId)
          return next
        })
      }
    } else {
      // Adopt: Insert the relationship
      const { error } = await supabase
        .from('master_assistants')
        .insert({
          master_id: authUser.id,
          assistant_id: assistantId,
        })
      
      if (error) {
        setAdoptionError(error.message)
      } else {
        setAdoptedAssistantIds(prev => new Set(prev).add(assistantId))
      }
    }
    
    setAdoptionSaving(false)
  }

  async function loadMastersAndShares(sharingMasterId: string) {
    // Load all masters (excluding self)
    const { data: mastersData, error: mastersErr } = await supabase
      .from('users')
      .select('id, email, name, role')
      .eq('role', 'master_technician')
      .neq('id', sharingMasterId)
      .order('name')
    
    if (mastersErr) {
      console.error('Error loading masters:', mastersErr)
      setSharingError(mastersErr.message)
    } else {
      setMasters((mastersData as UserRow[]) ?? [])
    }
    
    // Load current shares for this master
    const { data: shares, error: sharesErr } = await supabase
      .from('master_shares')
      .select('viewing_master_id')
      .eq('sharing_master_id', sharingMasterId)
    
    if (sharesErr) {
      console.error('Error loading shares:', sharesErr)
      setSharingError(sharesErr.message)
    } else {
      const sharedSet = new Set<string>()
      shares?.forEach(s => sharedSet.add(s.viewing_master_id))
      setSharedMasterIds(sharedSet)
    }
  }

  async function toggleSharing(viewingMasterId: string, isShared: boolean) {
    if (!authUser?.id) return
    
    setSharingSaving(true)
    setSharingError(null)
    
    if (isShared) {
      // Unshare: Delete the relationship
      const { error } = await supabase
        .from('master_shares')
        .delete()
        .eq('sharing_master_id', authUser.id)
        .eq('viewing_master_id', viewingMasterId)
      
      if (error) {
        setSharingError(error.message)
      } else {
        setSharedMasterIds(prev => {
          const next = new Set(prev)
          next.delete(viewingMasterId)
          return next
        })
      }
    } else {
      // Share: Insert the relationship
      const { error } = await supabase
        .from('master_shares')
        .insert({
          sharing_master_id: authUser.id,
          viewing_master_id: viewingMasterId,
        })
      
      if (error) {
        setSharingError(error.message)
      } else {
        setSharedMasterIds(prev => new Set(prev).add(viewingMasterId))
      }
    }
    
    setSharingSaving(false)
  }

  async function loadEmailTemplates() {
    const { data, error: eTemplates } = await supabase
      .from('email_templates')
      .select('id, template_type, subject, body, updated_at')
      .order('template_type')
    
    if (eTemplates) {
      console.error('Error loading email templates:', eTemplates)
      // Don't set error here - templates might not exist yet
    } else {
      setEmailTemplates((data as EmailTemplate[]) ?? [])
    }
  }

  function openEditTemplate(template: EmailTemplate | undefined, templateType: EmailTemplate['template_type']) {
    if (template) {
      setEditingTemplate(template)
      setTemplateSubject(template.subject)
      setTemplateBody(template.body)
    } else {
      // Create new template with defaults
      const defaults: Record<EmailTemplate['template_type'], { subject: string; body: string }> = {
        invitation: {
          subject: 'Invitation to join Pipetooling',
          body: 'Hi {{name}},\n\nYou\'ve been invited to join Pipetooling as a {{role}}. Click the link below to set up your account:\n\n{{link}}\n\nIf you didn\'t expect this invitation, you can safely ignore this email.',
        },
        sign_in: {
          subject: 'Sign in to Pipetooling',
          body: 'Hi {{name}},\n\nClick the link below to sign in to your Pipetooling account:\n\n{{link}}\n\nIf you didn\'t request this sign-in link, you can safely ignore this email.',
        },
        login_as: {
          subject: 'Sign in to Pipetooling',
          body: 'Hi {{name}},\n\nA dev has requested to sign in as you. Click the link below:\n\n{{link}}\n\nIf you didn\'t expect this, please contact your administrator.',
        },
        stage_assigned_started: {
          subject: 'Workflow stage started: {{stage_name}}',
          body: 'Hi {{assigned_to_name}},\n\nThe workflow stage "{{stage_name}}" for project "{{project_name}}" has been started.\n\nProject: {{project_name}}\nStage: {{stage_name}}\n\nView the workflow: {{workflow_link}}',
        },
        stage_assigned_complete: {
          subject: 'Workflow stage completed: {{stage_name}}',
          body: 'Hi {{assigned_to_name}},\n\nThe workflow stage "{{stage_name}}" for project "{{project_name}}" has been completed.\n\nProject: {{project_name}}\nStage: {{stage_name}}\n\nView the workflow: {{workflow_link}}',
        },
        stage_assigned_reopened: {
          subject: 'Workflow stage re-opened: {{stage_name}}',
          body: 'Hi {{assigned_to_name}},\n\nThe workflow stage "{{stage_name}}" for project "{{project_name}}" has been re-opened.\n\nProject: {{project_name}}\nStage: {{stage_name}}\n\nView the workflow: {{workflow_link}}',
        },
        stage_me_started: {
          subject: 'Workflow stage started: {{stage_name}}',
          body: 'Hi {{name}},\n\nThe workflow stage "{{stage_name}}" for project "{{project_name}}" has been started.\n\nProject: {{project_name}}\nStage: {{stage_name}}\nAssigned to: {{assigned_to_name}}\n\nView the workflow: {{workflow_link}}',
        },
        stage_me_complete: {
          subject: 'Workflow stage completed: {{stage_name}}',
          body: 'Hi {{name}},\n\nThe workflow stage "{{stage_name}}" for project "{{project_name}}" has been completed.\n\nProject: {{project_name}}\nStage: {{stage_name}}\nAssigned to: {{assigned_to_name}}\n\nView the workflow: {{workflow_link}}',
        },
        stage_me_reopened: {
          subject: 'Workflow stage re-opened: {{stage_name}}',
          body: 'Hi {{name}},\n\nThe workflow stage "{{stage_name}}" for project "{{project_name}}" has been re-opened.\n\nProject: {{project_name}}\nStage: {{stage_name}}\nAssigned to: {{assigned_to_name}}\n\nView the workflow: {{workflow_link}}',
        },
        stage_next_complete_or_approved: {
          subject: 'Next workflow stage ready: {{stage_name}}',
          body: 'Hi {{assigned_to_name}},\n\nThe previous workflow stage for project "{{project_name}}" has been completed or approved. Your stage "{{stage_name}}" is now ready to begin.\n\nProject: {{project_name}}\nYour stage: {{stage_name}}\nPrevious stage: {{previous_stage_name}}\n\nView the workflow: {{workflow_link}}',
        },
        stage_prior_rejected: {
          subject: 'Workflow stage rejected: {{stage_name}}',
          body: 'Hi {{assigned_to_name}},\n\nThe workflow stage "{{stage_name}}" for project "{{project_name}}" that you completed has been rejected.\n\nProject: {{project_name}}\nStage: {{stage_name}}\nRejection reason: {{rejection_reason}}\n\nView the workflow: {{workflow_link}}',
        },
      }
      const defaultTemplate = defaults[templateType]
      setEditingTemplate({
        id: '', // Will be created
        template_type: templateType,
        subject: defaultTemplate.subject,
        body: defaultTemplate.body,
        updated_at: null,
      })
      setTemplateSubject(defaultTemplate.subject)
      setTemplateBody(defaultTemplate.body)
    }
    setTemplateError(null)
  }

  function replaceTemplateVariables(template: EmailTemplate, variables: Record<string, string>): { subject: string; body: string } {
    let subject = template.subject
    let body = template.body
    
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
      subject = subject.replace(regex, value)
      body = body.replace(regex, value)
    })
    
    return { subject, body }
  }

  async function sendTestEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!testingTemplate || !authUser?.email) return
    
    setTestSending(true)
    setTestError(null)
    
    // Ensure we have an active session with a valid JWT
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      setTestError('Not authenticated. Please sign in again.')
      setTestSending(false)
      return
    }
    
    const userEmail = authUser.email
    
    // Replace variables with test data
    const testVariables: Record<string, string> = {
      name: 'Test User',
      email: userEmail,
      role: 'assistant',
      link: 'https://example.com/test-link',
      project_name: 'Test Project',
      stage_name: 'Test Stage',
      assigned_to_name: 'John Doe',
      workflow_link: 'https://example.com/workflow',
      previous_stage_name: 'Previous Stage',
      rejection_reason: 'Test rejection reason',
    }
    
    const { subject, body } = replaceTemplateVariables(testingTemplate, testVariables)
    
    // Call test email function
    // Note: Supabase client automatically includes JWT from current session
    const { data, error: eFn } = await supabase.functions.invoke('test-email', {
      body: {
        to: userEmail,
        subject,
        body,
        template_type: testingTemplate.template_type,
      },
    })
    
    setTestSending(false)
    
    if (eFn) {
      let msg = eFn.message
      let statusCode = ''
      if (eFn instanceof FunctionsHttpError) {
        statusCode = ` (Status: ${eFn.context?.status || 'unknown'})`
        if (eFn.context?.json) {
          try {
            const b = (await eFn.context.json()) as { error?: string; message?: string } | null
            if (b?.error) msg = b.error
            else if (b?.message) msg = b.message
          } catch { /* ignore */ }
        }
        // Try to get response text as well
        if (eFn.context?.response) {
          try {
            const text = await eFn.context.response.text()
            if (text) msg += ` - ${text}`
          } catch { /* ignore */ }
        }
      }
      setTestError(`Error: ${msg}${statusCode}`)
      return
    }
    
    const err = (data as { error?: string } | null)?.error
    if (err) {
      setTestError(err)
    } else {
      alert(`Test email sent to ${userEmail}!\n\nSubject: ${subject}\n\nBody:\n${body}`)
      setTestingTemplate(null)
    }
  }

  function openTestEmail(template: EmailTemplate | { template_type: EmailTemplate['template_type']; subject: string; body: string }) {
    setTestingTemplate(template as EmailTemplate)
    setTestError(null)
  }

  function testCurrentTemplate() {
    if (!editingTemplate || !templateSubject.trim() || !templateBody.trim()) {
      setTemplateError('Please fill in both subject and body before testing')
      return
    }
    // Create a temporary template object from current form values
    const tempTemplate: EmailTemplate = {
      id: editingTemplate.id || '',
      template_type: editingTemplate.template_type,
      subject: templateSubject.trim(),
      body: templateBody.trim(),
      updated_at: null,
    }
    openTestEmail(tempTemplate)
  }

  function closeTestEmail() {
    setTestingTemplate(null)
    setTestError(null)
  }

  function closeEditTemplate() {
    setEditingTemplate(null)
    setTemplateSubject('')
    setTemplateBody('')
    setTemplateError(null)
  }

  async function saveEmailTemplate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingTemplate) return
    
    setTemplateSaving(true)
    setTemplateError(null)
    
    if (editingTemplate.id) {
      // Update existing template
      const { error: e } = await supabase
        .from('email_templates')
        .update({
          subject: templateSubject.trim(),
          body: templateBody.trim(),
        })
        .eq('id', editingTemplate.id)
      
      setTemplateSaving(false)
      
      if (e) {
        setTemplateError(e.message)
      } else {
        await loadEmailTemplates()
        closeEditTemplate()
      }
    } else {
      // Create new template
      const { error: e } = await supabase
        .from('email_templates')
        .insert({
          template_type: editingTemplate.template_type,
          subject: templateSubject.trim(),
          body: templateBody.trim(),
          updated_at: new Date().toISOString(),
        })
      
      setTemplateSaving(false)
      
      if (e) {
        setTemplateError(e.message)
      } else {
        await loadEmailTemplates()
        closeEditTemplate()
      }
    }
  }

  useEffect(() => {
    loadData()
  }, [authUser?.id])

  async function handleClaimCode(e: React.FormEvent) {
    e.preventDefault()
    setCodeError(null)
    setCodeSubmitting(true)
    const { data, error: eRpc } = await supabase.rpc('claim_dev_with_code', { code_input: code.trim() })
    setCodeSubmitting(false)
    if (eRpc) {
      setCodeError(eRpc.message)
      return
    }
    if (data) {
      setCode('')
      setCodeError(null)
      await loadData()
    } else {
      setCodeError('Invalid code')
    }
  }

  async function updateRole(id: string, role: UserRole) {
    setUpdatingId(id)
    setError(null)
    const { error: e } = await supabase.from('users').update({ role }).eq('id', id)
    if (e) {
      setError(e.message)
    } else {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)))
    }
    setUpdatingId(null)
  }

  async function sendSignInEmail(u: UserRow) {
    setSendingSignInEmailId(u.id)
    setError(null)
    const redirectTo = new URL('dashboard', window.location.href).href
    const { error: e } = await supabase.auth.signInWithOtp({
      email: u.email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: redirectTo,
      },
    })
    if (e) setError(e.message)
    setSendingSignInEmailId(null)
  }

  async function loginAsUser(u: UserRow) {
    setLoggingInAsId(u.id)
    setError(null)
    // Construct redirect URL - use the current origin to ensure it works in all environments
    const redirectTo = `${window.location.origin}/dashboard`
    const { data, error: eFn } = await supabase.functions.invoke('login-as-user', {
      body: { email: u.email, redirectTo },
    })
    setLoggingInAsId(null)
    if (eFn) {
      let msg = eFn.message
      if (eFn instanceof FunctionsHttpError && eFn.context?.json) {
        try {
          const b = (await eFn.context.json()) as { error?: string } | null
          if (b?.error) msg = b.error
        } catch { /* ignore */ }
      }
      setError(msg)
      return
    }
    const link = (data as { action_link?: string } | null)?.action_link
    if (!link) {
      setError('Could not get login link')
      return
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token && session?.refresh_token) {
      sessionStorage.setItem('impersonation_original', JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      }))
    }
    window.location.href = link
  }

  function openInvite() {
    setInviteOpen(true)
    setInviteEmail('')
    setInviteRole('master_technician')
    setInviteName('')
    setInviteError(null)
  }

  function closeInvite() {
    setInviteOpen(false)
  }

  function openManualAdd() {
    setManualAddOpen(true)
    setManualAddEmail('')
    setManualAddName('')
    setManualAddRole('master_technician')
    setManualAddPassword('')
    setManualAddError(null)
  }

  function closeManualAdd() {
    setManualAddOpen(false)
  }

  function openDelete() {
    setDeleteOpen(true)
    setDeleteEmail('')
    setDeleteName('')
    setDeleteError(null)
  }

  function closeDelete() {
    setDeleteOpen(false)
  }

  function closeSetPassword() {
    setSetPasswordUser(null)
    setSetPasswordValue('')
    setSetPasswordConfirm('')
    setSetPasswordError(null)
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!setPasswordUser) return
    setSetPasswordError(null)
    if (setPasswordValue !== setPasswordConfirm) {
      setSetPasswordError('Passwords do not match.')
      return
    }
    if (setPasswordValue.length < 6) {
      setSetPasswordError('Password must be at least 6 characters.')
      return
    }
    setSetPasswordSubmitting(true)
    const { data, error: eFn } = await supabase.functions.invoke('set-user-password', {
      body: { user_id: setPasswordUser.id, password: setPasswordValue },
    })
    setSetPasswordSubmitting(false)
    if (eFn) {
      let msg = eFn.message
      if (eFn instanceof FunctionsHttpError && eFn.context?.json) {
        try {
          const b = (await eFn.context.json()) as { error?: string } | null
          if (b?.error) msg = b.error
        } catch { /* ignore */ }
      }
      setSetPasswordError(msg)
      return
    }
    const err = (data as { error?: string } | null)?.error
    if (err) {
      setSetPasswordError(err)
      return
    }
    closeSetPassword()
  }

  function openPasswordChange() {
    setPasswordChangeOpen(true)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordChangeError(null)
    setPasswordChangeSuccess(false)
  }

  function closePasswordChange() {
    setPasswordChangeOpen(false)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordChangeError(null)
    setPasswordChangeSuccess(false)
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPasswordChangeError(null)
    setPasswordChangeSuccess(false)

    if (newPassword !== confirmPassword) {
      setPasswordChangeError('New passwords do not match')
      return
    }

    if (newPassword.length < 6) {
      setPasswordChangeError('Password must be at least 6 characters')
      return
    }

    setPasswordChangeSubmitting(true)

    // First verify current password by attempting to sign in
    if (authUser?.email) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: authUser.email,
        password: currentPassword,
      })

      if (signInError) {
        setPasswordChangeSubmitting(false)
        setPasswordChangeError('Current password is incorrect')
        return
      }
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    setPasswordChangeSubmitting(false)

    if (updateError) {
      setPasswordChangeError(updateError.message)
      return
    }

    setPasswordChangeSuccess(true)
    // Clear form after a delay
    setTimeout(() => {
      closePasswordChange()
    }, 2000)
  }

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault()
    setDeleteError(null)
    setDeleteSubmitting(true)
    const { data, error: eFn } = await supabase.functions.invoke('delete-user', {
      body: { email: deleteEmail.trim(), name: deleteName.trim() },
    })
    setDeleteSubmitting(false)
    if (eFn) {
      let msg = eFn.message
      if (eFn instanceof FunctionsHttpError && eFn.context?.json) {
        try {
          const b = (await eFn.context.json()) as { error?: string } | null
          if (b?.error) msg = b.error
        } catch { /* ignore */ }
      }
      setDeleteError(msg)
      return
    }
    const err = (data as { error?: string } | null)?.error
    if (err) {
      setDeleteError(err)
      return
    }
    closeDelete()
    await loadData()
  }

  async function handleConvertMaster(e: React.FormEvent) {
    e.preventDefault()
    setConvertError(null)
    setConvertSummary(null)

    if (!convertMasterId || !convertNewMasterId) {
      setConvertError('Please select both the master to convert and the new master owner.')
      return
    }
    if (convertMasterId === convertNewMasterId) {
      setConvertError('The new master owner must be different from the master being converted.')
      return
    }

    const masterUser = users.find((u) => u.id === convertMasterId)
    const newMasterUser = users.find((u) => u.id === convertNewMasterId)

    const masterLabel = masterUser?.name || masterUser?.email || 'Selected master'
    const newMasterLabel = newMasterUser?.name || newMasterUser?.email || 'New master'
    const roleLabel = convertNewRole === 'assistant' ? 'assistant' : 'subcontractor'

    const confirmed = window.confirm(
      `Convert "${masterLabel}" from master to ${roleLabel} and reassign all of their customers, projects, and people to "${newMasterLabel}"? This cannot easily be undone.`
    )
    if (!confirmed) return

    setConvertSubmitting(true)
    try {
      const { data, error } = await supabase.rpc('convert_master_user', {
        old_master_id: convertMasterId,
        new_master_id: convertNewMasterId,
        new_role: convertNewRole,
        auto_adopt: convertAutoAdopt,
      })
      if (error) {
        setConvertError(error.message)
        return
      }
      const result = (data as {
        customers_moved?: number
        projects_moved?: number
        people_moved?: number
        new_role?: string
      }) || {}
      const c = result.customers_moved ?? 0
      const p = result.projects_moved ?? 0
      const pe = result.people_moved ?? 0
      const nr = result.new_role ?? convertNewRole
      setConvertSummary(
        `Converted "${masterLabel}" to ${nr}. Reassigned ${c} customers, ${p} projects, and ${pe} people to "${newMasterLabel}".`
      )
      setConvertMasterId('')
      setConvertNewMasterId('')
      setConvertNewRole('assistant')
      setConvertAutoAdopt(true)
      await loadData()
    } catch (err) {
      setConvertError(err instanceof Error ? err.message : 'Unknown error converting master')
    } finally {
      setConvertSubmitting(false)
    }
  }

  async function checkDuplicateName(nameToCheck: string): Promise<boolean> {
    const trimmedName = nameToCheck.trim().toLowerCase()
    if (!trimmedName) return false
    
    // Check in people table
    const { data: peopleData } = await supabase
      .from('people')
      .select('id, name')
    
    // Check in users table
    const { data: usersData } = await supabase
      .from('users')
      .select('id, name')
    
    // Case-insensitive comparison
    const hasDuplicateInPeople = peopleData?.some(p => p.name?.toLowerCase() === trimmedName) ?? false
    const hasDuplicateInUsers = usersData?.some(u => u.name?.toLowerCase() === trimmedName) ?? false
    
    return hasDuplicateInPeople || hasDuplicateInUsers
  }

  async function handleManualAdd(e: React.FormEvent) {
    e.preventDefault()
    setManualAddError(null)
    setManualAddSubmitting(true)
    
    const trimmedName = manualAddName.trim()
    if (trimmedName) {
      // Check for duplicate names (case-insensitive)
      const isDuplicate = await checkDuplicateName(trimmedName)
      if (isDuplicate) {
        setManualAddError(`A person or user with the name "${trimmedName}" already exists. Names must be unique.`)
        setManualAddSubmitting(false)
        return
      }
    }
    
    const { data, error: eFn } = await supabase.functions.invoke('create-user', {
      body: {
        email: manualAddEmail.trim(),
        password: manualAddPassword,
        role: manualAddRole,
        name: trimmedName || undefined,
      },
    })
    setManualAddSubmitting(false)
    if (eFn) {
      let msg = eFn.message
      if (eFn instanceof FunctionsHttpError && eFn.context?.json) {
        try {
          const b = (await eFn.context.json()) as { error?: string } | null
          if (b?.error) msg = b.error
        } catch { /* ignore */ }
      }
      setManualAddError(msg)
      return
    }
    const err = (data as { error?: string } | null)?.error
    if (err) {
      setManualAddError(err)
      return
    }
    closeManualAdd()
    await loadData()
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError(null)
    setInviteSubmitting(true)
    
    const trimmedName = inviteName.trim()
    if (trimmedName) {
      // Check for duplicate names (case-insensitive)
      const isDuplicate = await checkDuplicateName(trimmedName)
      if (isDuplicate) {
        setInviteError(`A person or user with the name "${trimmedName}" already exists. Names must be unique.`)
        setInviteSubmitting(false)
        return
      }
    }
    
    const { data, error: eFn } = await supabase.functions.invoke('invite-user', {
      body: { email: inviteEmail.trim(), role: inviteRole, name: trimmedName || undefined },
    })
    setInviteSubmitting(false)
    if (eFn) {
      let msg = eFn.message
      if (eFn instanceof FunctionsHttpError && eFn.context?.json) {
        try {
          const b = (await eFn.context.json()) as { error?: string } | null
          if (b?.error) msg = b.error
        } catch { /* ignore */ }
      }
      setInviteError(msg)
      return
    }
    const err = (data as { error?: string } | null)?.error
    if (err) {
      setInviteError(err)
      return
    }
    closeInvite()
  }

  if (loading) return <p>Loading…</p>
  if (error && !myRole) return <p style={{ color: '#b91c1c' }}>{error}</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Settings</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" onClick={openPasswordChange} style={{ padding: '0.5rem 1rem' }}>
            Change password
          </button>
          <button type="button" onClick={handleSignOut} style={{ padding: '0.5rem 1rem' }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Inline Change Password form - toggled from header button */}
      {passwordChangeOpen && (
        <form onSubmit={handlePasswordChange} style={{ marginBottom: '2rem', padding: '1rem 0' }}>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="current-password" style={{ display: 'block', marginBottom: 4 }}>Current password *</label>
              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value)
                  setPasswordChangeError(null)
                }}
                required
                autoComplete="current-password"
                style={{ width: '100%', maxWidth: 400, padding: '0.5rem' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="new-password" style={{ display: 'block', marginBottom: 4 }}>New password *</label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value)
                  setPasswordChangeError(null)
                }}
                required
                autoComplete="new-password"
                minLength={6}
                style={{ width: '100%', maxWidth: 400, padding: '0.5rem' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="confirm-password" style={{ display: 'block', marginBottom: 4 }}>Confirm new password *</label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  setPasswordChangeError(null)
                }}
                required
                autoComplete="new-password"
                minLength={6}
                style={{ width: '100%', maxWidth: 400, padding: '0.5rem' }}
              />
            </div>
            {passwordChangeError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{passwordChangeError}</p>}
            {passwordChangeSuccess && <p style={{ color: '#059669', marginBottom: '1rem' }}>Password changed successfully!</p>}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" disabled={passwordChangeSubmitting} style={{ padding: '0.5rem 1rem' }}>
                {passwordChangeSubmitting ? 'Changing…' : 'Change password'}
              </button>
              <button type="button" onClick={closePasswordChange} disabled={passwordChangeSubmitting} style={{ padding: '0.5rem 1rem' }}>
                Cancel
              </button>
            </div>
          </form>
        )}

      {myRole !== 'dev' && <p style={{ marginBottom: '1.5rem' }}>Only devs can manage user roles.</p>}

      {myRole === 'dev' && (
        <>
          <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
            Set user class for everyone who has signed up. Only owners can change these.
          </p>
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button type="button" onClick={openInvite} style={{ padding: '0.5rem 1rem' }}>
              Invite via email
            </button>
            <button type="button" onClick={openManualAdd} style={{ padding: '0.5rem 1rem' }}>
              Manually add user
            </button>
            <button type="button" onClick={openDelete} style={{ padding: '0.5rem 1rem' }}>
              Delete user
            </button>
          </div>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 640 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Email</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Name</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Role</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Last login</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{u.email}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{u.name}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <select
                        value={u.role}
                        onChange={(e) => updateRole(u.id, e.target.value as UserRole)}
                        disabled={updatingId === u.id}
                        style={{ padding: '0.25rem 0.5rem' }}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r.charAt(0).toUpperCase() + r.slice(1)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{timeSinceAgo(u.last_sign_in_at)}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => sendSignInEmail(u)}
                          disabled={sendingSignInEmailId === u.id}
                          style={{ padding: '0.25rem 0.5rem', whiteSpace: 'nowrap' }}
                        >
                          {sendingSignInEmailId === u.id ? 'Sending…' : 'Send email to sign in'}
                        </button>
                        <button
                          type="button"
                          onClick={() => loginAsUser(u)}
                          disabled={loggingInAsId === u.id}
                          style={{ padding: '0.25rem 0.5rem', whiteSpace: 'nowrap' }}
                        >
                          {loggingInAsId === u.id ? 'Redirecting…' : 'imitate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSetPasswordUser(u)
                            setSetPasswordValue('')
                            setSetPasswordConfirm('')
                            setSetPasswordError(null)
                          }}
                          disabled={setPasswordSubmitting}
                          style={{ padding: '0.25rem 0.5rem', whiteSpace: 'nowrap' }}
                        >
                          Set password
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {users.length === 0 && <p style={{ marginTop: '1rem' }}>No users yet.</p>}

          {/* Convert Master to Assistant/Subcontractor */}
          {users.length > 0 && (
            <div style={{ marginTop: '2rem', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', maxWidth: 640 }}>
              <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Convert Master to Assistant/Subcontractor</h2>
              <p style={{ marginBottom: '0.75rem', color: '#6b7280', fontSize: '0.875rem' }}>
                Convert an existing master into an assistant or subcontractor. All of their customers, projects, and people
                will be reassigned to another master.
              </p>
              <form onSubmit={handleConvertMaster}>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label htmlFor="convert-master" style={{ display: 'block', marginBottom: 4 }}>Master to convert *</label>
                  <select
                    id="convert-master"
                    value={convertMasterId}
                    onChange={(e) => { setConvertMasterId(e.target.value); setConvertError(null); setConvertSummary(null) }}
                    disabled={convertSubmitting}
                    style={{ width: '100%', maxWidth: 400, padding: '0.5rem' }}
                  >
                    <option value="">Select master…</option>
                    {users
                      .filter((u) => u.role === 'master_technician')
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name || u.email} ({u.email})
                        </option>
                      ))}
                  </select>
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label htmlFor="convert-new-master" style={{ display: 'block', marginBottom: 4 }}>New master owner *</label>
                  <select
                    id="convert-new-master"
                    value={convertNewMasterId}
                    onChange={(e) => { setConvertNewMasterId(e.target.value); setConvertError(null); setConvertSummary(null) }}
                    disabled={convertSubmitting}
                    style={{ width: '100%', maxWidth: 400, padding: '0.5rem' }}
                  >
                    <option value="">Select new master…</option>
                    {users
                      .filter((u) => u.role === 'master_technician' && u.id !== convertMasterId)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name || u.email} ({u.email})
                        </option>
                      ))}
                  </select>
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <span style={{ display: 'block', marginBottom: 4 }}>New role *</span>
                  <label style={{ marginRight: '1rem' }}>
                    <input
                      type="radio"
                      name="convert-new-role"
                      value="assistant"
                      checked={convertNewRole === 'assistant'}
                      onChange={() => { setConvertNewRole('assistant'); setConvertError(null); setConvertSummary(null) }}
                      disabled={convertSubmitting}
                    />{' '}
                    Assistant
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="convert-new-role"
                      value="subcontractor"
                      checked={convertNewRole === 'subcontractor'}
                      onChange={() => { setConvertNewRole('subcontractor'); setConvertError(null); setConvertSummary(null) }}
                      disabled={convertSubmitting}
                    />{' '}
                    Subcontractor
                  </label>
                </div>
                {convertNewRole === 'assistant' && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label>
                      <input
                        type="checkbox"
                        checked={convertAutoAdopt}
                        onChange={(e) => { setConvertAutoAdopt(e.target.checked); setConvertError(null); setConvertSummary(null) }}
                        disabled={convertSubmitting}
                        style={{ marginRight: 4 }}
                      />
                      Auto-adopt this assistant to the new master
                    </label>
                  </div>
                )}
                <p style={{ marginBottom: '0.75rem', color: '#b45309', fontSize: '0.8125rem' }}>
                  This operation reassigns all customers, projects, and people owned by the selected master to the new master and
                  changes their role. It is not easily reversible.
                </p>
                {convertError && <p style={{ color: '#b91c1c', marginBottom: '0.75rem' }}>{convertError}</p>}
                {convertSummary && <p style={{ color: '#059669', marginBottom: '0.75rem' }}>{convertSummary}</p>}
                <button
                  type="submit"
                  disabled={
                    convertSubmitting ||
                    !convertMasterId ||
                    !convertNewMasterId ||
                    convertMasterId === convertNewMasterId
                  }
                >
                  {convertSubmitting ? 'Converting…' : 'Convert master'}
                </button>
              </form>
            </div>
          )}
        </>
      )}

      {viewingOrphanPrices && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, maxWidth: '900px', width: '95%', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>Orphaned material prices</h2>
              <button
                type="button"
                onClick={() => {
                  setViewingOrphanPrices(false)
                  setOrphanError(null)
                  setOrphanPrices([])
                }}
                style={{ padding: '0.25rem 0.5rem', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}
              >
                ×
              </button>
            </div>
            <p style={{ marginTop: 0, marginBottom: '0.75rem', color: '#6b7280', fontSize: '0.875rem' }}>
              These are material prices whose part or supply house no longer exists. They do not appear in the Materials Price Book.
            </p>
            {loadingOrphanPrices && <p>Loading orphaned prices…</p>}
            {orphanError && <p style={{ color: '#b91c1c', marginBottom: '0.75rem' }}>{orphanError}</p>}
            {!loadingOrphanPrices && orphanPrices.length === 0 && !orphanError && (
              <p style={{ marginBottom: '0.75rem', color: '#16a34a' }}>No orphaned prices found.</p>
            )}
            {!loadingOrphanPrices && orphanPrices.length > 0 && (
              <>
                <p style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: '#374151' }}>
                  Found {orphanPrices.length} orphaned price{orphanPrices.length === 1 ? '' : 's'}.
                </p>
                <div style={{ marginBottom: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={deleteAllOrphanPrices}
                    style={{ padding: '0.35rem 0.75rem', background: '#b91c1c', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                  >
                    Delete all shown
                  </button>
                </div>
                <div style={{ maxHeight: '60vh', overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead style={{ background: '#f9fafb' }}>
                      <tr>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Part</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Supply house</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Price</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Effective date</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Reason</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orphanPrices.map((row) => (
                        <tr key={row.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '0.5rem 0.75rem' }}>{row.partName}</td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>{row.supplyHouseName}</td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${row.price.toFixed(2)}</td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>{row.effectiveDate || '—'}</td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            {row.reason === 'both'
                              ? 'Missing part & supply house'
                              : row.reason === 'missing_part'
                              ? 'Missing part'
                              : 'Missing supply house'}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <button
                              type="button"
                              onClick={() => deleteOrphanPrice(row.id)}
                              style={{ padding: '0.25rem 0.5rem', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {(myRole === 'master_technician' || myRole === 'dev') && (
        <>
          <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Adopt Assistants</h2>
          <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
            Adopt assistants to give them access to your customers and projects. Assistants can create projects and assign them to you. Assistants can not see private notes or financials.
          </p>
          {adoptionError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{adoptionError}</p>}
          {assistants.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No assistants found.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 640 }}>
              {assistants.map((assistant) => {
                const isAdopted = adoptedAssistantIds.has(assistant.id)
                return (
                  <label
                    key={assistant.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: 4,
                      cursor: adoptionSaving ? 'not-allowed' : 'pointer',
                      background: isAdopted ? '#f0fdf4' : 'white',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isAdopted}
                      onChange={() => toggleAdoption(assistant.id, isAdopted)}
                      disabled={adoptionSaving}
                      style={{ cursor: adoptionSaving ? 'not-allowed' : 'pointer' }}
                    />
                    <span style={{ flex: 1 }}>
                      <span style={{ fontWeight: 500 }}>{assistant.name || assistant.email}</span>
                      {assistant.email && assistant.name && (
                        <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                          ({assistant.email})
                        </span>
                      )}
                    </span>
                    {isAdopted && (
                      <span style={{ fontSize: '0.875rem', color: '#059669', fontWeight: 500 }}>
                        Adopted
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          )}
        </>
      )}

      {(myRole === 'master_technician' || myRole === 'dev') && (
        <>
          <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Share with other Master</h2>
          <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
            Share your customers and projects with another master. They will see your jobs with assistant-level access (cannot see private notes or financials).
          </p>
          {sharingError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{sharingError}</p>}
          {masters.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No other masters found.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 640 }}>
              {masters.map((master) => {
                const isShared = sharedMasterIds.has(master.id)
                return (
                  <label
                    key={master.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: 4,
                      cursor: sharingSaving ? 'not-allowed' : 'pointer',
                      background: isShared ? '#f0fdf4' : 'white',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isShared}
                      onChange={() => toggleSharing(master.id, isShared)}
                      disabled={sharingSaving}
                      style={{ cursor: sharingSaving ? 'not-allowed' : 'pointer' }}
                    />
                    <span style={{ flex: 1 }}>
                      <span style={{ fontWeight: 500 }}>{master.name || master.email}</span>
                      {master.email && master.name && (
                        <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                          ({master.email})
                        </span>
                      )}
                    </span>
                    {isShared && (
                      <span style={{ fontSize: '0.875rem', color: '#059669', fontWeight: 500 }}>
                        Shared
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          )}
        </>
      )}

      {myRole === 'dev' && (
        <>
          <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>People Created by Me</h2>
          <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
            People entries in your roster.
          </p>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 640 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Name</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Email</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Phone</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Kind</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {myPeople.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{p.name}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      {p.email ? (
                        <a href={`mailto:${p.email}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                          {p.email}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      {p.phone ? (
                        <a href={`tel:${p.phone}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                          {p.phone}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      {p.kind === 'assistant' ? 'Assistant' : p.kind === 'master_technician' ? 'Master Technician' : 'Subcontractor'}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      {p.is_user ? (
                        <span style={{ color: '#059669', fontWeight: 500 }}>Has account</span>
                      ) : (
                        <span style={{ color: '#6b7280' }}>No account</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {myPeople.length === 0 && <p style={{ marginTop: '1rem' }}>No people entries created by you.</p>}

          <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>People Created by Other Users</h2>
          <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
            People entries in rosters created by other users, and who created them.
          </p>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
          {nonUserPeople.length === 0 && allPeopleCount > 0 && (
            <p style={{ color: '#f59e0b', marginBottom: '1rem', fontSize: '0.875rem' }}>
              Note: All {allPeopleCount} visible people entry{allPeopleCount !== 1 ? 'ies' : ''} belong to you. The RLS policy for the &apos;people&apos; table may be restricting access to other users&apos; entries. To see people created by other users, the RLS policy needs to allow owners to read all entries.
            </p>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 640 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Name</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Email</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Phone</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Kind</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Status</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Created by</th>
                </tr>
              </thead>
              <tbody>
                {nonUserPeople.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{p.name}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      {p.email ? (
                        <a href={`mailto:${p.email}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                          {p.email}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      {p.phone ? (
                        <a href={`tel:${p.phone}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                          {p.phone}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      {p.kind === 'assistant' ? 'Assistant' : p.kind === 'master_technician' ? 'Master Technician' : 'Subcontractor'}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      {p.is_user ? (
                        <span style={{ color: '#059669', fontWeight: 500 }}>Has account</span>
                      ) : (
                        <span style={{ color: '#6b7280' }}>No account</span>
                      )}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      {p.creator_name || p.creator_email ? (
                        <span>
                          {p.creator_name || 'Unknown'}
                          {p.creator_email && (
                            <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.35rem' }}>
                              ({p.creator_email})
                            </span>
                          )}
                        </span>
                      ) : (
                        'Unknown'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {nonUserPeople.length === 0 && <p style={{ marginTop: '1rem' }}>No people entries created by other users.</p>}
        </>
      )}

      {inviteOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>Invite via email</h2>
            <form onSubmit={handleInvite}>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="invite-email" style={{ display: 'block', marginBottom: 4 }}>Email *</label>
                <input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => { setInviteEmail(e.target.value); setInviteError(null) }}
                  required
                  disabled={inviteSubmitting}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="invite-role" style={{ display: 'block', marginBottom: 4 }}>Role</label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  disabled={inviteSubmitting}
                  style={{ width: '100%', padding: '0.5rem' }}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="invite-name" style={{ display: 'block', marginBottom: 4 }}>Name (optional)</label>
                <input
                  id="invite-name"
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  disabled={inviteSubmitting}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              {inviteError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{inviteError}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={inviteSubmitting}>
                  {inviteSubmitting ? 'Sending…' : 'Send invite'}
                </button>
                <button type="button" onClick={closeInvite} disabled={inviteSubmitting}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {manualAddOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>Manually add user</h2>
            <form onSubmit={handleManualAdd}>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="manual-email" style={{ display: 'block', marginBottom: 4 }}>Email *</label>
                <input
                  id="manual-email"
                  type="email"
                  value={manualAddEmail}
                  onChange={(e) => { setManualAddEmail(e.target.value); setManualAddError(null) }}
                  required
                  disabled={manualAddSubmitting}
                  autoComplete="username"
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="manual-password" style={{ display: 'block', marginBottom: 4 }}>Initial password *</label>
                <input
                  id="manual-password"
                  type="password"
                  value={manualAddPassword}
                  onChange={(e) => { setManualAddPassword(e.target.value); setManualAddError(null) }}
                  required
                  disabled={manualAddSubmitting}
                  style={{ width: '100%', padding: '0.5rem' }}
                  autoComplete="new-password"
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="manual-role" style={{ display: 'block', marginBottom: 4 }}>Role</label>
                <select
                  id="manual-role"
                  value={manualAddRole}
                  onChange={(e) => setManualAddRole(e.target.value as UserRole)}
                  disabled={manualAddSubmitting}
                  style={{ width: '100%', padding: '0.5rem' }}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="manual-name" style={{ display: 'block', marginBottom: 4 }}>Name (optional)</label>
                <input
                  id="manual-name"
                  type="text"
                  value={manualAddName}
                  onChange={(e) => setManualAddName(e.target.value)}
                  disabled={manualAddSubmitting}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              {manualAddError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{manualAddError}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={manualAddSubmitting}>
                  {manualAddSubmitting ? 'Creating…' : 'Create user'}
                </button>
                <button type="button" onClick={closeManualAdd} disabled={manualAddSubmitting}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>Delete user</h2>
            <p style={{ color: '#6b7280', marginBottom: '1rem', fontSize: '0.875rem' }}>
              Type the user&apos;s email and name exactly. Both must match to delete.
            </p>
            <form onSubmit={handleDelete}>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="delete-email" style={{ display: 'block', marginBottom: 4 }}>Email *</label>
                <input
                  id="delete-email"
                  type="email"
                  value={deleteEmail}
                  onChange={(e) => { setDeleteEmail(e.target.value); setDeleteError(null) }}
                  required
                  disabled={deleteSubmitting}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="delete-name" style={{ display: 'block', marginBottom: 4 }}>Name *</label>
                <input
                  id="delete-name"
                  type="text"
                  value={deleteName}
                  onChange={(e) => { setDeleteName(e.target.value); setDeleteError(null) }}
                  required
                  disabled={deleteSubmitting}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              {deleteError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{deleteError}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={deleteSubmitting} style={{ color: '#b91c1c' }}>
                  {deleteSubmitting ? 'Deleting…' : 'Delete user'}
                </button>
                <button type="button" onClick={closeDelete} disabled={deleteSubmitting}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {setPasswordUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>Set password for {setPasswordUser.email}</h2>
            <form onSubmit={handleSetPassword}>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="set-password-new" style={{ display: 'block', marginBottom: 4 }}>New password *</label>
                <input
                  id="set-password-new"
                  type="password"
                  value={setPasswordValue}
                  onChange={(e) => { setSetPasswordValue(e.target.value); setSetPasswordError(null) }}
                  required
                  minLength={6}
                  disabled={setPasswordSubmitting}
                  autoComplete="new-password"
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="set-password-confirm" style={{ display: 'block', marginBottom: 4 }}>Confirm password *</label>
                <input
                  id="set-password-confirm"
                  type="password"
                  value={setPasswordConfirm}
                  onChange={(e) => { setSetPasswordConfirm(e.target.value); setSetPasswordError(null) }}
                  required
                  minLength={6}
                  disabled={setPasswordSubmitting}
                  autoComplete="new-password"
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              {setPasswordError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{setPasswordError}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={setPasswordSubmitting}>
                  {setPasswordSubmitting ? 'Setting…' : 'Set password'}
                </button>
                <button type="button" onClick={closeSetPassword} disabled={setPasswordSubmitting}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <form onSubmit={handleClaimCode} style={{ marginTop: '2rem', marginBottom: '1.5rem' }}>
        <label htmlFor="code" style={{ display: 'block', marginBottom: 4 }}>Enter code</label>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            id="code"
            type="text"
            value={code}
            onChange={(e) => { setCode(e.target.value); setCodeError(null) }}
            disabled={codeSubmitting}
            placeholder="Admin code"
            style={{ padding: '0.5rem', minWidth: 160 }}
            autoComplete="one-time-code"
          />
          <button type="submit" disabled={codeSubmitting || !code.trim()}>
            {codeSubmitting ? 'Checking…' : 'Submit'}
          </button>
        </div>
        {codeError && <p style={{ color: '#b91c1c', marginTop: 4, marginBottom: 0 }}>{codeError}</p>}
      </form>

      {myRole === 'dev' && (
        <>
          <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Data backup (dev)</h2>
          <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
            Export projects (customers, projects, workflows, steps, line items, projections), materials (supply houses, parts, prices, templates, template items), or bids (bids, counts, takeoffs, cost estimates, pricing / price book, purchase orders and PO items) as JSON for backup. Files respect RLS.
          </p>
          {exportError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{exportError}</p>}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={exportProjectsBackup}
              disabled={exportProjectsLoading || exportMaterialsLoading || exportBidsLoading}
              style={{ padding: '0.5rem 1rem', background: '#1e40af', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
            >
              {exportProjectsLoading ? 'Exporting…' : 'Export projects backup'}
            </button>
            <button
              type="button"
              onClick={exportMaterialsBackup}
              disabled={exportProjectsLoading || exportMaterialsLoading || exportBidsLoading}
              style={{ padding: '0.5rem 1rem', background: '#065f46', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
            >
              {exportMaterialsLoading ? 'Exporting…' : 'Export materials backup'}
            </button>
            <button
              type="button"
              onClick={exportBidsBackup}
              disabled={exportProjectsLoading || exportMaterialsLoading || exportBidsLoading}
              style={{ padding: '0.5rem 1rem', background: '#7c2d12', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
            >
              {exportBidsLoading ? 'Exporting…' : 'Export bids backup'}
            </button>
          </div>

          <h3 style={{ marginTop: '2rem', marginBottom: '0.5rem' }}>Maintenance: Materials prices</h3>
          <p style={{ marginBottom: '0.75rem', color: '#6b7280', fontSize: '0.875rem' }}>
            Review and clean up material prices that don&apos;t match any part or supply house (these won&apos;t appear in the Price Book).
          </p>
          <button
            type="button"
            onClick={() => {
              setViewingOrphanPrices(true)
              loadOrphanMaterialPrices()
            }}
            style={{ padding: '0.5rem 1rem', background: '#92400e', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
          >
            Review orphaned material prices
          </button>
        </>
      )}

      {myRole === 'dev' && (
        <>
          <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Email Templates</h2>
          <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
            Customize the content of emails sent to users. Use variables like {VARIABLE_HINT} in your templates.
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>User Management</h3>
            {[
              { type: 'invitation' as const, label: 'Invitation Email', description: 'Sent when inviting a new user' },
              { type: 'sign_in' as const, label: 'Sign-In Email', description: 'Sent when requesting a sign-in link' },
              { type: 'login_as' as const, label: 'Login As Email', description: 'Sent when dev logs in as another user' },
            ].map(({ type, label, description }) => {
              const template = emailTemplates.find(t => t.template_type === type)
              return (
                <div key={type} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{label}</h3>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>{description}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {template && (
                        <button
                          type="button"
                          onClick={() => openTestEmail(template)}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}
                        >
                          Test
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEditTemplate(template, type)}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}
                      >
                        {template ? 'Edit' : 'Create'}
                      </button>
                    </div>
                  </div>
                  {template && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                      <div><strong>Subject:</strong> {template.subject}</div>
                      <div style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap', maxHeight: '3rem', overflow: 'hidden' }}>
                        <strong>Body:</strong> {template.body.substring(0, 100)}{template.body.length > 100 ? '...' : ''}
                      </div>
                      {template.updated_at && (
                        <div style={{ marginTop: '0.25rem', fontSize: '0.8125rem' }}>
                          Last updated: {new Date(template.updated_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            
            <h3 style={{ margin: '1.5rem 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Workflow Stage Notifications</h3>
            <h4 style={{ margin: '0.5rem 0', fontSize: '0.875rem', fontWeight: 500, color: '#6b7280' }}>Notify Assigned Person</h4>
            {[
              { type: 'stage_assigned_started' as const, label: 'Stage Started (Assigned)', description: 'Sent to assigned person when stage is started' },
              { type: 'stage_assigned_complete' as const, label: 'Stage Complete (Assigned)', description: 'Sent to assigned person when stage is completed' },
              { type: 'stage_assigned_reopened' as const, label: 'Stage Re-opened (Assigned)', description: 'Sent to assigned person when stage is re-opened' },
            ].map(({ type, label, description }) => {
              const template = emailTemplates.find(t => t.template_type === type)
              return (
                <div key={type} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{label}</h3>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>{description}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {template && (
                        <button
                          type="button"
                          onClick={() => openTestEmail(template)}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}
                        >
                          Test
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEditTemplate(template, type)}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}
                      >
                        {template ? 'Edit' : 'Create'}
                      </button>
                    </div>
                  </div>
                  {template && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                      <div><strong>Subject:</strong> {template.subject}</div>
                      <div style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap', maxHeight: '3rem', overflow: 'hidden' }}>
                        <strong>Body:</strong> {template.body.substring(0, 100)}{template.body.length > 100 ? '...' : ''}
                      </div>
                      {template.updated_at && (
                        <div style={{ marginTop: '0.25rem', fontSize: '0.8125rem' }}>
                          Last updated: {new Date(template.updated_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            
            <h4 style={{ margin: '1rem 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 500, color: '#6b7280' }}>Notify Me (Current User)</h4>
            {[
              { type: 'stage_me_started' as const, label: 'Stage Started (ME)', description: 'Sent to you when a subscribed stage is started' },
              { type: 'stage_me_complete' as const, label: 'Stage Complete (ME)', description: 'Sent to you when a subscribed stage is completed' },
              { type: 'stage_me_reopened' as const, label: 'Stage Re-opened (ME)', description: 'Sent to you when a subscribed stage is re-opened' },
            ].map(({ type, label, description }) => {
              const template = emailTemplates.find(t => t.template_type === type)
              return (
                <div key={type} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{label}</h3>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>{description}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {template && (
                        <button
                          type="button"
                          onClick={() => openTestEmail(template)}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}
                        >
                          Test
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEditTemplate(template, type)}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}
                      >
                        {template ? 'Edit' : 'Create'}
                      </button>
                    </div>
                  </div>
                  {template && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                      <div><strong>Subject:</strong> {template.subject}</div>
                      <div style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap', maxHeight: '3rem', overflow: 'hidden' }}>
                        <strong>Body:</strong> {template.body.substring(0, 100)}{template.body.length > 100 ? '...' : ''}
                      </div>
                      {template.updated_at && (
                        <div style={{ marginTop: '0.25rem', fontSize: '0.8125rem' }}>
                          Last updated: {new Date(template.updated_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            
            <h4 style={{ margin: '1rem 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 500, color: '#6b7280' }}>Cross-Step Notifications</h4>
            {[
              { type: 'stage_next_complete_or_approved' as const, label: 'Next Stage Ready', description: 'Sent to next stage assignee when current stage is completed or approved' },
              { type: 'stage_prior_rejected' as const, label: 'Prior Stage Rejected', description: 'Sent to prior stage assignee when their stage is rejected' },
            ].map(({ type, label, description }) => {
              const template = emailTemplates.find(t => t.template_type === type)
              return (
                <div key={type} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{label}</h3>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>{description}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {template && (
                        <button
                          type="button"
                          onClick={() => openTestEmail(template)}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}
                        >
                          Test
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEditTemplate(template, type)}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}
                      >
                        {template ? 'Edit' : 'Create'}
                      </button>
                    </div>
                  </div>
                  {template && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                      <div><strong>Subject:</strong> {template.subject}</div>
                      <div style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap', maxHeight: '3rem', overflow: 'hidden' }}>
                        <strong>Body:</strong> {template.body.substring(0, 100)}{template.body.length > 100 ? '...' : ''}
                      </div>
                      {template.updated_at && (
                        <div style={{ marginTop: '0.25rem', fontSize: '0.8125rem' }}>
                          Last updated: {new Date(template.updated_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {editingTemplate && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 500, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto' }}>
                <h2 style={{ marginTop: 0 }}>
                  Edit {editingTemplate.template_type === 'invitation' ? 'Invitation' : 
                    editingTemplate.template_type === 'sign_in' ? 'Sign-In' : 
                    editingTemplate.template_type === 'login_as' ? 'Login As' :
                    editingTemplate.template_type === 'stage_assigned_started' ? 'Stage Started (Assigned)' :
                    editingTemplate.template_type === 'stage_assigned_complete' ? 'Stage Complete (Assigned)' :
                    editingTemplate.template_type === 'stage_assigned_reopened' ? 'Stage Re-opened (Assigned)' :
                    editingTemplate.template_type === 'stage_me_started' ? 'Stage Started (ME)' :
                    editingTemplate.template_type === 'stage_me_complete' ? 'Stage Complete (ME)' :
                    editingTemplate.template_type === 'stage_me_reopened' ? 'Stage Re-opened (ME)' :
                    editingTemplate.template_type === 'stage_next_complete_or_approved' ? 'Next Stage Ready' :
                    editingTemplate.template_type === 'stage_prior_rejected' ? 'Prior Stage Rejected' :
                    'Email'} Template
                </h2>
                <form onSubmit={saveEmailTemplate}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label htmlFor="template-subject" style={{ display: 'block', marginBottom: 4 }}>Subject *</label>
                    <input
                      id="template-subject"
                      type="text"
                      value={templateSubject}
                      onChange={(e) => { setTemplateSubject(e.target.value); setTemplateError(null) }}
                      required
                      disabled={templateSaving}
                      placeholder="e.g., Welcome to Pipetooling"
                      style={{ width: '100%', padding: '0.5rem' }}
                    />
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>
                      Available variables: {
                        editingTemplate.template_type.startsWith('stage_') 
                          ? '{{name}}, {{email}}, {{project_name}}, {{stage_name}}, {{assigned_to_name}}, {{workflow_link}}, {{previous_stage_name}}, {{rejection_reason}}'
                          : VARIABLE_HINT
                      }
                    </p>
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label htmlFor="template-body" style={{ display: 'block', marginBottom: 4 }}>Body *</label>
                    <textarea
                      id="template-body"
                      value={templateBody}
                      onChange={(e) => { setTemplateBody(e.target.value); setTemplateError(null) }}
                      required
                      disabled={templateSaving}
                      rows={12}
                      placeholder="e.g., Hi {{name}},&#10;&#10;You've been invited to join Pipetooling as a {{role}}. Click the link below to set up your account:&#10;&#10;{{link}}"
                      style={{ width: '100%', padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.875rem' }}
                    />
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>
                      Available variables: {
                        editingTemplate.template_type.startsWith('stage_') 
                          ? '{{name}}, {{email}}, {{project_name}}, {{stage_name}}, {{assigned_to_name}}, {{workflow_link}}, {{previous_stage_name}}, {{rejection_reason}}'
                          : VARIABLE_HINT
                      }
                    </p>
                  </div>
                  {templateError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{templateError}</p>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" disabled={templateSaving}>
                      {templateSaving ? 'Saving…' : 'Save template'}
                    </button>
                    <button 
                      type="button" 
                      onClick={testCurrentTemplate}
                      disabled={templateSaving || !templateSubject.trim() || !templateBody.trim()}
                      style={{ background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}
                    >
                      Test Email
                    </button>
                    <button type="button" onClick={closeEditTemplate} disabled={templateSaving}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {testingTemplate && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400 }}>
                <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  Send a test email to <strong>{authUser?.email || 'your account email'}</strong> with the template to verify it works. Variables will be replaced with test data.
                </p>
                <form onSubmit={sendTestEmail}>
                  <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f9fafb', borderRadius: 4, fontSize: '0.875rem' }}>
                    <div><strong>Template:</strong> {testingTemplate.template_type}</div>
                    <div style={{ marginTop: '0.5rem' }}><strong>Subject:</strong> {testingTemplate.subject}</div>
                    <div style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}><strong>Body Preview:</strong><br />{testingTemplate.body.substring(0, 200)}{testingTemplate.body.length > 200 ? '...' : ''}</div>
                  </div>
                  {testError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{testError}</p>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" disabled={testSending || !authUser?.email}>
                      {testSending ? 'Sending…' : 'Send Test Email'}
                    </button>
                    <button type="button" onClick={closeTestEmail} disabled={testSending}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
