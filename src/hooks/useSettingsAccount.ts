import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useToastContext } from '../contexts/ToastContext'
import { cascadePersonNameInPayTables } from '../lib/cascadePersonName'
import { buildSalariedWorkdayPickerRows } from '../lib/buildSalariedWorkdayPickerRows'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { isSubcontractorLikeRole } from '../lib/subcontractorLikeRole'
import type { UserRole } from './useAuth'
import type { PayConfigRow } from '../types/peoplePayConfig'
import type { UserRow } from '../types/settingsRows'

/**
 * Settings → Your account engine: profile form (with duplicate-name check and
 * pay-table name cascade), password-change modal state (the modal renders in
 * SettingsAccountTab but is OPENED from the page shell header, so the parent
 * destructures openPasswordChange), push-notification test, location
 * permission, the self-salaried flag, and the dev-only "All salaried" picker.
 * Extracted verbatim from Settings.tsx (v2.859). The parent's loadData still
 * hydrates the profile fields from its own users-row fetch via
 * `applyProfileRow` + `refreshSelfPaySalaryForPayName` (no duplicate query).
 */
export function useSettingsAccount({
  authUser,
  myRole,
  users,
}: {
  authUser: { id: string; email?: string | null } | null
  myRole: UserRole | null
  users: UserRow[]
}) {
  const { showToast } = useToastContext()

  const [testNotificationSending, setTestNotificationSending] = useState(false)
  const [testNotificationError, setTestNotificationError] = useState<string | null>(null)
  const [testNotificationSuccess, setTestNotificationSuccess] = useState<string | null>(null)
  const [locationPermission, setLocationPermission] = useState<'unknown' | 'prompt' | 'granted' | 'denied'>('unknown')
  const [locationLoading, setLocationLoading] = useState(false)
  const [passwordChangeOpen, setPasswordChangeOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null)
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false)
  const [passwordChangeSubmitting, setPasswordChangeSubmitting] = useState(false)
  const [myProfileName, setMyProfileName] = useState('')
  const [myProfileEmail, setMyProfileEmail] = useState('')
  const [myProfilePhone, setMyProfilePhone] = useState('')
  const [myProfileOriginalName, setMyProfileOriginalName] = useState('')
  const [myProfileSaving, setMyProfileSaving] = useState(false)
  const [myProfileError, setMyProfileError] = useState<string | null>(null)
  const [selfIsSalariedInPayConfig, setSelfIsSalariedInPayConfig] = useState(false)
  const [selfPaySalaryLoaded, setSelfPaySalaryLoaded] = useState(false)
  const [salaryWorkdaySectionOpen, setSalaryWorkdaySectionOpen] = useState(true)
  const [allSalariedDevSectionOpen, setAllSalariedDevSectionOpen] = useState(false)
  const [devPayConfigForSalaried, setDevPayConfigForSalaried] = useState<Record<string, PayConfigRow> | null>(null)
  const [devPayConfigLoading, setDevPayConfigLoading] = useState(false)
  const [devSalariedSelectedUserId, setDevSalariedSelectedUserId] = useState<string | null>(null)
  const [timeOffSectionOpen, setTimeOffSectionOpen] = useState(true)

  /** Hydrate the profile form from the users row loadData already fetched. */
  function applyProfileRow(row: { name?: string; email?: string; phone?: string | null } | null) {
    const loadedName = row?.name ?? ''
    setMyProfileName(loadedName)
    setMyProfileOriginalName(loadedName)
    setMyProfileEmail(row?.email ?? '')
    setMyProfilePhone(row?.phone ?? '')
  }

  async function refreshSelfPaySalaryForPayName(payNameRaw: string) {
    const payName = payNameRaw.trim()
    if (!payName) {
      setSelfIsSalariedInPayConfig(false)
      setSelfPaySalaryLoaded(true)
      return
    }
    try {
      const payRow = await withSupabaseRetry(
        async () =>
          supabase.from('people_pay_config').select('is_salary').eq('person_name', payName).maybeSingle(),
        'settings self pay salary flag',
      )
      setSelfIsSalariedInPayConfig(!!(payRow as { is_salary?: boolean } | null)?.is_salary)
    } catch {
      setSelfIsSalariedInPayConfig(false)
    } finally {
      setSelfPaySalaryLoaded(true)
    }
  }

  async function handleTestNotification() {
    if (!authUser?.id) return
    setTestNotificationError(null)
    setTestNotificationSuccess(null)
    setTestNotificationSending(true)
    try {
      const {
        data: { session: refreshedSession },
        error: refreshErr,
      } = await supabase.auth.refreshSession()
      if (refreshErr || !refreshedSession?.access_token) {
        setTestNotificationError('Session expired. Please sign out and sign back in.')
        return
      }
      const { data, error } = await supabase.functions.invoke('send-checklist-notification', {
        headers: {
          Authorization: `Bearer ${refreshedSession.access_token}`,
        },
        body: {
          recipient_user_id: authUser.id,
          push_title: 'Test notification',
          push_body: 'If you see this, push notifications are working!',
          push_url: '/settings',
          tag: 'test-notification',
        },
      })
      if (error) throw error
      const res = data as { error?: string; push_sent?: number } | null
      if (res?.error) throw new Error(res.error)
      const sent = res?.push_sent ?? 0
      setTestNotificationSuccess(
        sent > 0
          ? `Notification sent to ${sent} device(s).`
          : 'Notification sent. (On iOS with the app open, the system notification may not appear—try backgrounding the app.)'
      )
    } catch (err) {
      let msg = err instanceof Error ? err.message : 'Failed to send test notification'
      if (err instanceof FunctionsHttpError && err.context?.json) {
        try {
          const body = (await err.context.json()) as { error?: string } | null
          if (body?.error) msg = body.error
        } catch { /* ignore */ }
      }
      setTestNotificationError(msg)
    } finally {
      setTestNotificationSending(false)
    }
  }

  function handleEnableLocation() {
    if (!('geolocation' in navigator)) return
    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocationPermission('granted')
        setLocationLoading(false)
      },
      (err) => {
        setLocationPermission(err.code === 1 ? 'denied' : 'unknown')
        setLocationLoading(false)
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: Infinity }
    )
  }

  async function checkDuplicateName(nameToCheck: string, excludeUserId?: string): Promise<boolean> {
    const trimmedName = nameToCheck.trim().toLowerCase()
    if (!trimmedName) return false

    // Check in people table (exclude archived)
    const { data: peopleData } = await supabase
      .from('people')
      .select('id, name')
      .is('archived_at', null)

    // Check in users table (exclude current user when editing)
    const { data: usersData } = await supabase
      .from('users')
      .select('id, name')

    // Case-insensitive comparison; exclude user being edited from duplicate check
    const hasDuplicateInPeople = peopleData?.some(p => p.name?.toLowerCase() === trimmedName) ?? false
    const hasDuplicateInUsers = usersData?.some(u => (u.id !== excludeUserId) && u.name?.toLowerCase() === trimmedName) ?? false

    return hasDuplicateInPeople || hasDuplicateInUsers
  }

  async function saveMyProfile(e: FormEvent) {
    e.preventDefault()
    if (!authUser?.id) return
    const trimmedEmail = myProfileEmail.trim()
    const trimmedName = myProfileName.trim()
    const trimmedPhone = myProfilePhone.trim() || null
    setMyProfileError(null)
    if (!trimmedEmail) {
      setMyProfileError('Email is required.')
      return
    }
    const canEditName = !isSubcontractorLikeRole(myRole)
    if (canEditName && trimmedName) {
      const isDuplicate = await checkDuplicateName(trimmedName, authUser.id)
      if (isDuplicate) {
        setMyProfileError(`A person or user with the name "${trimmedName}" already exists. Names must be unique.`)
        return
      }
    }
    setMyProfileSaving(true)
    const updates: { name?: string; email: string; phone: string | null } = { email: trimmedEmail, phone: trimmedPhone }
    if (canEditName) updates.name = trimmedName
    const { error: err } = await supabase
      .from('users')
      .update(updates)
      .eq('id', authUser.id)
    if (err) {
      setMyProfileError(err.message)
      setMyProfileSaving(false)
      return
    }
    if (myProfileOriginalName.trim() && myProfileOriginalName.trim() !== trimmedName) {
      await cascadePersonNameInPayTables(myProfileOriginalName.trim(), trimmedName)
    }
    setMyProfileOriginalName(trimmedName)
    await refreshSelfPaySalaryForPayName(trimmedName)
    setMyProfileSaving(false)
    showToast('Profile saved.', 'success')
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

  async function handlePasswordChange(e: FormEvent) {
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

  useEffect(() => {
    if (!('permissions' in navigator)) return
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        setLocationPermission(status.state as 'granted' | 'denied' | 'prompt')
        status.onchange = () => setLocationPermission(status.state as 'granted' | 'denied' | 'prompt')
      })
      .catch(() => {})
  }, [])

  const devSalariedPickerRows = useMemo(() => {
    if (devPayConfigForSalaried == null) return []
    return buildSalariedWorkdayPickerRows(devPayConfigForSalaried, users)
  }, [devPayConfigForSalaried, users])

  const devSalariedSelectedPayName = useMemo(
    () =>
      devSalariedPickerRows.find((r) => r.userId === devSalariedSelectedUserId)?.personName ?? '',
    [devSalariedPickerRows, devSalariedSelectedUserId],
  )

  useEffect(() => {
    if (!allSalariedDevSectionOpen) {
      setDevPayConfigForSalaried(null)
      setDevSalariedSelectedUserId(null)
      return
    }
    if (myRole !== 'dev') return
    let cancelled = false
    setDevPayConfigLoading(true)
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          async () =>
            supabase
              .from('people_pay_config')
              .select(
                'person_name, hourly_wage, is_salary, record_hours_but_salary',
              ),
          'settings dev all salaried pay config',
        )
        if (cancelled) return
        const record: Record<string, PayConfigRow> = {}
        for (const r of (Array.isArray(data) ? data : []) as PayConfigRow[]) {
          record[r.person_name] = r
        }
        setDevPayConfigForSalaried(record)
      } catch (e) {
        if (!cancelled) {
          showToast(formatErrorMessage(e), 'error')
          setDevPayConfigForSalaried({})
        }
      } finally {
        if (!cancelled) setDevPayConfigLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [allSalariedDevSectionOpen, myRole, showToast])

  useEffect(() => {
    if (devPayConfigForSalaried == null) return
    setDevSalariedSelectedUserId((prev) => {
      if (prev && devSalariedPickerRows.some((r) => r.userId === prev)) return prev
      return devSalariedPickerRows.find((r) => r.userId != null)?.userId ?? null
    })
  }, [devPayConfigForSalaried, devSalariedPickerRows])

  return {
    applyProfileRow,
    refreshSelfPaySalaryForPayName,
    testNotificationSending,
    testNotificationError,
    testNotificationSuccess,
    locationPermission,
    locationLoading,
    passwordChangeOpen,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    passwordChangeError,
    setPasswordChangeError,
    passwordChangeSuccess,
    passwordChangeSubmitting,
    myProfileName,
    setMyProfileName,
    myProfileEmail,
    setMyProfileEmail,
    myProfilePhone,
    setMyProfilePhone,
    myProfileOriginalName,
    myProfileSaving,
    myProfileError,
    selfIsSalariedInPayConfig,
    setSelfIsSalariedInPayConfig,
    selfPaySalaryLoaded,
    setSelfPaySalaryLoaded,
    salaryWorkdaySectionOpen,
    setSalaryWorkdaySectionOpen,
    allSalariedDevSectionOpen,
    setAllSalariedDevSectionOpen,
    devPayConfigForSalaried,
    devPayConfigLoading,
    devSalariedSelectedUserId,
    setDevSalariedSelectedUserId,
    devSalariedPickerRows,
    devSalariedSelectedPayName,
    timeOffSectionOpen,
    setTimeOffSectionOpen,
    handleTestNotification,
    handleEnableLocation,
    checkDuplicateName,
    saveMyProfile,
    openPasswordChange,
    closePasswordChange,
    handlePasswordChange,
  }
}
