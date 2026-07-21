import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { UserRow } from '../types/settingsRows'

/**
 * State + handlers for the Settings "Sharing and Adoption" section (dev|master):
 * adopt assistants / primaries / superintendents (master_assistants /
 * master_primaries / master_superintendents) and share with other masters
 * (master_shares). A dev can manage another master's adoptions via the
 * master picker (`selectedMasterIdForAdoptions`); sharing always acts as self.
 */
export function useMasterAdoptions(authUserId: string | null, isDev: boolean) {
  const [assistants, setAssistants] = useState<UserRow[]>([])
  const [adoptedAssistantIds, setAdoptedAssistantIds] = useState<Set<string>>(new Set())
  const [adoptionSaving, setAdoptionSaving] = useState(false)
  const [adoptionError, setAdoptionError] = useState<string | null>(null)
  const [primaries, setPrimaries] = useState<UserRow[]>([])
  const [adoptedPrimaryIds, setAdoptedPrimaryIds] = useState<Set<string>>(new Set())
  const [primaryAdoptionSaving, setPrimaryAdoptionSaving] = useState(false)
  const [primaryAdoptionError, setPrimaryAdoptionError] = useState<string | null>(null)
  const [superintendents, setSuperintendents] = useState<UserRow[]>([])
  const [adoptedSuperintendentIds, setAdoptedSuperintendentIds] = useState<Set<string>>(new Set())
  const [superintendentAdoptionSaving, setSuperintendentAdoptionSaving] = useState(false)
  const [superintendentAdoptionError, setSuperintendentAdoptionError] = useState<string | null>(null)
  // Dev-only: which master's adoptions we're managing (null = current user)
  const [selectedMasterIdForAdoptions, setSelectedMasterIdForAdoptions] = useState<string | null>(null)
  const [masters, setMasters] = useState<UserRow[]>([])
  const [sharedMasterIds, setSharedMasterIds] = useState<Set<string>>(new Set())
  const [sharingSaving, setSharingSaving] = useState(false)
  const [sharingError, setSharingError] = useState<string | null>(null)

  async function loadAssistantsAndAdoptions(masterId: string) {
    // Load all assistants
    const { data: assistantsData, error: assistantsErr } = await supabase
      .from('users')
      .select('id, email, name, role')
      .in('role', ['assistant', 'controller' as 'assistant'])
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

  async function loadPrimariesAndAdoptions(masterId: string) {
    const { data: primariesData, error: primariesErr } = await supabase
      .from('users')
      .select('id, email, name, role')
      .eq('role', 'primary')
      .order('name')

    if (primariesErr) {
      console.error('Error loading primaries:', primariesErr)
      setPrimaryAdoptionError(primariesErr.message)
    } else {
      setPrimaries((primariesData as UserRow[]) ?? [])
    }

    const { data: adoptions, error: adoptionsErr } = await supabase
      .from('master_primaries')
      .select('primary_id')
      .eq('master_id', masterId)

    if (adoptionsErr) {
      console.error('Error loading primary adoptions:', adoptionsErr)
      setPrimaryAdoptionError(adoptionsErr.message)
    } else {
      const adoptedSet = new Set<string>()
      adoptions?.forEach(a => adoptedSet.add(a.primary_id))
      setAdoptedPrimaryIds(adoptedSet)
    }
  }

  async function loadSuperintendentsAndAdoptions(masterId: string) {
    const { data: superintendentsData, error: superintendentsErr } = await supabase
      .from('users')
      .select('id, email, name, role')
      .eq('role', 'superintendent')
      .order('name')

    if (superintendentsErr) {
      console.error('Error loading superintendents:', superintendentsErr)
      setSuperintendentAdoptionError(superintendentsErr.message)
    } else {
      setSuperintendents((superintendentsData as UserRow[]) ?? [])
    }

    const { data: adoptions, error: adoptionsErr } = await supabase
      .from('master_superintendents')
      .select('superintendent_id')
      .eq('master_id', masterId)

    if (adoptionsErr) {
      console.error('Error loading superintendent adoptions:', adoptionsErr)
      setSuperintendentAdoptionError(adoptionsErr.message)
    } else {
      const adoptedSet = new Set<string>()
      adoptions?.forEach(a => adoptedSet.add(a.superintendent_id))
      setAdoptedSuperintendentIds(adoptedSet)
    }
  }

  // When dev has selected another master, we manage that master's adoptions; otherwise current user's
  const adoptionMasterId = (isDev && selectedMasterIdForAdoptions) ? selectedMasterIdForAdoptions : authUserId

  async function toggleAdoption(assistantId: string, isAdopted: boolean) {
    const masterId = adoptionMasterId ?? authUserId
    if (!masterId) return

    setAdoptionSaving(true)
    setAdoptionError(null)

    if (isAdopted) {
      // Unadopt: Delete the relationship
      const { error } = await supabase
        .from('master_assistants')
        .delete()
        .eq('master_id', masterId)
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
          master_id: masterId,
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

  async function togglePrimaryAdoption(primaryId: string, isAdopted: boolean) {
    const masterId = adoptionMasterId ?? authUserId
    if (!masterId) return

    setPrimaryAdoptionSaving(true)
    setPrimaryAdoptionError(null)

    if (isAdopted) {
      const { error } = await supabase
        .from('master_primaries')
        .delete()
        .eq('master_id', masterId)
        .eq('primary_id', primaryId)

      if (error) {
        setPrimaryAdoptionError(error.message)
      } else {
        setAdoptedPrimaryIds(prev => {
          const next = new Set(prev)
          next.delete(primaryId)
          return next
        })
      }
    } else {
      const { error } = await supabase
        .from('master_primaries')
        .insert({
          master_id: masterId,
          primary_id: primaryId,
        })

      if (error) {
        setPrimaryAdoptionError(error.message)
      } else {
        setAdoptedPrimaryIds(prev => new Set(prev).add(primaryId))
      }
    }

    setPrimaryAdoptionSaving(false)
  }

  async function toggleSuperintendentAdoption(superintendentId: string, isAdopted: boolean) {
    const masterId = adoptionMasterId ?? authUserId
    if (!masterId) return

    setSuperintendentAdoptionSaving(true)
    setSuperintendentAdoptionError(null)

    if (isAdopted) {
      const { error } = await supabase
        .from('master_superintendents')
        .delete()
        .eq('master_id', masterId)
        .eq('superintendent_id', superintendentId)

      if (error) {
        setSuperintendentAdoptionError(error.message)
      } else {
        setAdoptedSuperintendentIds(prev => {
          const next = new Set(prev)
          next.delete(superintendentId)
          return next
        })
      }
    } else {
      const { error } = await supabase
        .from('master_superintendents')
        .insert({
          master_id: masterId,
          superintendent_id: superintendentId,
        })

      if (error) {
        setSuperintendentAdoptionError(error.message)
      } else {
        setAdoptedSuperintendentIds(prev => new Set(prev).add(superintendentId))
      }
    }

    setSuperintendentAdoptionSaving(false)
  }

  async function handleAdoptionMasterChange(masterId: string | null) {
    setSelectedMasterIdForAdoptions(masterId)
    if (authUserId) {
      const targetMasterId = masterId ?? authUserId
      await loadAssistantsAndAdoptions(targetMasterId)
      await loadPrimariesAndAdoptions(targetMasterId)
      await loadSuperintendentsAndAdoptions(targetMasterId)
    }
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
    if (!authUserId) return

    setSharingSaving(true)
    setSharingError(null)

    if (isShared) {
      // Unshare: Delete the relationship
      const { error } = await supabase
        .from('master_shares')
        .delete()
        .eq('sharing_master_id', authUserId)
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
          sharing_master_id: authUserId,
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

  useEffect(() => {
    if (!authUserId) return
    void Promise.all([
      loadAssistantsAndAdoptions(authUserId),
      loadPrimariesAndAdoptions(authUserId),
      loadSuperintendentsAndAdoptions(authUserId),
      loadMastersAndShares(authUserId),
    ])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserId])

  return {
    assistants,
    adoptedAssistantIds,
    adoptionSaving,
    adoptionError,
    primaries,
    adoptedPrimaryIds,
    primaryAdoptionSaving,
    primaryAdoptionError,
    superintendents,
    adoptedSuperintendentIds,
    superintendentAdoptionSaving,
    superintendentAdoptionError,
    selectedMasterIdForAdoptions,
    masters,
    sharedMasterIds,
    sharingSaving,
    sharingError,
    adoptionMasterId,
    toggleAdoption,
    togglePrimaryAdoption,
    toggleSuperintendentAdoption,
    toggleSharing,
    handleAdoptionMasterChange,
  }
}
