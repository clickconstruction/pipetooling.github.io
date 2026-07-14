import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { denverWorkDateToday, syncSalaryClockSessionsForUserDay } from '../lib/salaryScheduleSync'
import { resolvePersonIdFromRosterName } from '../lib/payPersonSubject'
import type { PayConfigRow } from '../types/peoplePayConfig'
import type { Person, UserRow } from './usePeopleRoster'

export interface UsePayConfigDeps {
  canAccessPay: boolean
  canAccessHours: boolean
  canViewCostMatrixShared: boolean
  setError: (msg: string) => void
  showToast: (message: string, kind?: 'success' | 'error' | 'info') => void
  /** Live roster ref (people) for person-id resolution. */
  peopleRosterRef: React.MutableRefObject<Person[]>
  /** Live users ref for name -> login-user-id matching + salary-template lookup. */
  usersRef: React.MutableRefObject<UserRow[]>
  /** Live roster-grouping ref used to scope the salary-template indicator lookup. */
  payConfigRosterSectionsRef: React.MutableRefObject<Array<{ label: string; names: string[] }>>
}

export interface UsePayConfigResult {
  payConfig: Record<string, PayConfigRow>
  payConfigDraft: Record<string, string>
  payConfigOfficeWageDraft: Record<string, string>
  payConfigSaving: boolean
  salaryTemplateByPersonName: Record<string, boolean>
  loadPayConfig: () => Promise<void>
  loadPayConfigSalaryTemplateIndicators: () => Promise<void>
  upsertPayConfig: (personName: string, row: Partial<PayConfigRow>) => void
  updatePayConfigHourlyWage: (personName: string, rawValue: string) => void
  updatePayConfigOfficeHourlyWage: (personName: string, rawValue: string) => void
}

/**
 * Owns the People pay-config data layer: the `people_pay_config` map + edit draft,
 * its debounced per-person saves (with salaried-schedule sync side effects), and the
 * salary-work-schedule-template orphan indicators. Extracted from People.tsx; the
 * pay-config modal JSX, `payConfigModalOpen`, and `payConfigRosterSections` stay in
 * the parent and are wired through this hook's inputs/return.
 */
export function usePayConfig(deps: UsePayConfigDeps): UsePayConfigResult {
  const {
    canAccessPay,
    canAccessHours,
    canViewCostMatrixShared,
    setError,
    showToast,
    peopleRosterRef,
    usersRef,
    payConfigRosterSectionsRef,
  } = deps

  const [payConfig, setPayConfig] = useState<Record<string, PayConfigRow>>({})
  const [payConfigSaving, setPayConfigSaving] = useState(false)
  const [payConfigDraft, setPayConfigDraft] = useState<Record<string, string>>({})
  const [payConfigOfficeWageDraft, setPayConfigOfficeWageDraft] = useState<Record<string, string>>({})
  const payConfigRef = useRef(payConfig)
  payConfigRef.current = payConfig
  const payConfigDraftRef = useRef(payConfigDraft)
  payConfigDraftRef.current = payConfigDraft
  const payConfigOfficeWageDraftRef = useRef(payConfigOfficeWageDraft)
  payConfigOfficeWageDraftRef.current = payConfigOfficeWageDraft
  const payConfigDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  /** Last successful DB `is_salary` per pay row; used to detect false->true after debounced save. */
  const lastPersistedPayConfigRef = useRef<Record<string, { is_salary: boolean }>>({})
  /** Roster name -> still has salary_work_schedule_templates row (for pay config modal orphan indicator). */
  const [salaryTemplateByPersonName, setSalaryTemplateByPersonName] = useState<Record<string, boolean>>({})

  const loadPayConfig = useCallback(async () => {
    if (!canAccessPay && !canAccessHours && !canViewCostMatrixShared) return
    // Hours-only viewers (assistants) can't SELECT people_pay_config since the pay lockdown
    // (v2.660) — they load the non-wage flags via the RPC instead. Wage fields stay null,
    // which is fine: every wage-editing surface is canAccessPay-gated.
    const wageAccess = canAccessPay || canViewCostMatrixShared
    const { data, error } = wageAccess
      ? await supabase
          .from('people_pay_config')
          .select('person_name, person_id, hourly_wage, office_hourly_wage, is_salary, show_in_hours, show_in_cost_matrix, record_hours_but_salary')
      : await supabase.rpc('list_people_pay_flags')
    if (error) {
      setError(error.message)
      return
    }
    const map: Record<string, PayConfigRow> = {}
    const persistedSalary: Record<string, { is_salary: boolean }> = {}
    for (const raw of (data ?? []) as Array<Partial<PayConfigRow> & { person_name: string }>) {
      const r: PayConfigRow = {
        person_name: raw.person_name,
        person_id: raw.person_id ?? null,
        hourly_wage: raw.hourly_wage ?? null,
        office_hourly_wage: raw.office_hourly_wage ?? null,
        is_salary: !!raw.is_salary,
        show_in_hours: !!raw.show_in_hours,
        show_in_cost_matrix: !!raw.show_in_cost_matrix,
        record_hours_but_salary: !!raw.record_hours_but_salary,
      }
      map[r.person_name] = r
      persistedSalary[r.person_name] = { is_salary: r.is_salary }
    }
    lastPersistedPayConfigRef.current = persistedSalary
    setPayConfig(map)
    setPayConfigDraft({})
  }, [canAccessPay, canAccessHours, canViewCostMatrixShared, setError])

  const loadPayConfigSalaryTemplateIndicators = useCallback(async () => {
    const nameSet = new Set<string>()
    for (const sec of payConfigRosterSectionsRef.current) {
      for (const raw of sec.names) {
        const t = raw.trim()
        if (t) nameSet.add(t)
      }
    }
    const names = [...nameSet]
    const nameToUid = new Map<string, string>()
    for (const u of usersRef.current) {
      const tn = u.name?.trim()
      if (tn && nameSet.has(tn)) nameToUid.set(tn, u.id)
    }
    const uids = [...new Set(nameToUid.values())]
    if (uids.length === 0) {
      setSalaryTemplateByPersonName({})
      return
    }
    try {
      const rows = await withSupabaseRetry(
        async () =>
          supabase.from('salary_work_schedule_templates').select('user_id').in('user_id', uids),
        'pay config salary template indicators',
      )
      const list = (rows ?? []) as Array<{ user_id: string }>
      const templateUids = new Set(list.map((r) => r.user_id))
      const out: Record<string, boolean> = {}
      for (const n of names) {
        const uid = nameToUid.get(n)
        out[n] = uid != null && templateUids.has(uid)
      }
      setSalaryTemplateByPersonName(out)
    } catch {
      setSalaryTemplateByPersonName({})
    }
    // Reads live refs (stable identities); the parent's trigger effect re-invokes on roster/users change.
  }, [payConfigRosterSectionsRef, usersRef])

  function upsertPayConfig(personName: string, row: Partial<PayConfigRow>) {
    if (!canAccessPay) return
    const roster = peopleRosterRef.current
    const resolvedPid = resolvePersonIdFromRosterName(roster, personName)
    const cur =
      payConfig[personName] ?? {
        person_name: personName,
        person_id: resolvedPid,
        hourly_wage: null,
        office_hourly_wage: null,
        is_salary: false,
        show_in_hours: false,
        show_in_cost_matrix: false,
        record_hours_but_salary: false,
      }
    const full = {
      person_name: personName,
      person_id: row.person_id ?? resolvedPid ?? cur.person_id ?? null,
      hourly_wage: row.hourly_wage ?? cur.hourly_wage,
      office_hourly_wage: row.office_hourly_wage ?? cur.office_hourly_wage ?? null,
      is_salary: row.is_salary ?? cur.is_salary,
      show_in_hours: row.show_in_hours ?? cur.show_in_hours,
      show_in_cost_matrix: row.show_in_cost_matrix ?? cur.show_in_cost_matrix,
      record_hours_but_salary: row.record_hours_but_salary ?? cur.record_hours_but_salary,
    }
    setPayConfig((prev) => ({ ...prev, [personName]: full }))
    const prevTimeout = payConfigDebounceRef.current[personName]
    if (prevTimeout) clearTimeout(prevTimeout)
    payConfigDebounceRef.current[personName] = setTimeout(async () => {
      delete payConfigDebounceRef.current[personName]
      setPayConfigSaving(true)
      const toSave = payConfigRef.current[personName] ?? full
      const prevPersistedSalary = lastPersistedPayConfigRef.current[personName]?.is_salary === true
      const { error } = await supabase.from('people_pay_config').upsert(toSave, { onConflict: 'person_name' })
      if (error) {
        setError(error.message)
      } else {
        const becameSalary = toSave.is_salary === true && !prevPersistedSalary
        const stoppedBeingSalary = toSave.is_salary === false && prevPersistedSalary
        lastPersistedPayConfigRef.current[personName] = { is_salary: !!toSave.is_salary }
        const uidMatch = usersRef.current.find((u) => u.name?.trim() === personName.trim())?.id
        if (becameSalary) {
          if (uidMatch) {
            const { error: syncErr } = await syncSalaryClockSessionsForUserDay(uidMatch, denverWorkDateToday())
            if (syncErr) showToast(syncErr, 'error')
          } else {
            showToast(
              'Salary saved. No matching login user for this name—salary time sync skipped.',
              'info',
            )
          }
        } else if (stoppedBeingSalary) {
          try {
            const payload = await withSupabaseRetry(
              async () =>
                supabase.rpc('pay_staff_clear_salary_schedule_by_person_name', {
                  p_person_name: personName.trim(),
                }),
              'pay_staff_clear_salary_schedule_by_person_name',
            )
            const result = payload as { ok?: boolean; message?: string }
            if (result?.ok === true) {
              showToast('Salaried work schedule removed.', 'success')
              void loadPayConfigSalaryTemplateIndicators()
            } else {
              showToast(
                typeof result?.message === 'string' && result.message.length > 0
                  ? result.message
                  : 'Could not remove salaried work schedule.',
                'error',
              )
            }
          } catch (e) {
            showToast(formatErrorMessage(e, 'Could not remove salaried work schedule'), 'error')
          }
        }
      }
      setPayConfigSaving(false)
    }, 2000)
  }

  function updatePayConfigHourlyWage(personName: string, rawValue: string) {
    if (!canAccessPay) return
    setPayConfigDraft((prev) => ({ ...prev, [personName]: rawValue }))
    const roster = peopleRosterRef.current
    const resolvedPid = resolvePersonIdFromRosterName(roster, personName)
    const cur =
      payConfig[personName] ?? {
        person_name: personName,
        person_id: resolvedPid,
        hourly_wage: null,
        office_hourly_wage: null,
        is_salary: false,
        show_in_hours: false,
        show_in_cost_matrix: false,
        record_hours_but_salary: false,
      }
    const parsed = rawValue === '' ? null : parseFloat(rawValue) || null
    const full = { ...cur, hourly_wage: parsed }
    setPayConfig((prev) => ({ ...prev, [personName]: full }))
    const prevTimeout = payConfigDebounceRef.current[personName]
    if (prevTimeout) clearTimeout(prevTimeout)
    payConfigDebounceRef.current[personName] = setTimeout(async () => {
      delete payConfigDebounceRef.current[personName]
      setPayConfigSaving(true)
      const draftVal = payConfigDraftRef.current[personName]
      const finalWage = draftVal !== undefined ? (draftVal === '' ? null : parseFloat(draftVal) || null) : (payConfigRef.current[personName]?.hourly_wage ?? null)
      const toSave = { ...(payConfigRef.current[personName] ?? full), hourly_wage: finalWage }
      const { error } = await supabase.from('people_pay_config').upsert(toSave, { onConflict: 'person_name' })
      if (error) setError(error.message)
      else {
        lastPersistedPayConfigRef.current[personName] = { is_salary: !!toSave.is_salary }
        setPayConfigDraft((prev) => {
          const next = { ...prev }
          delete next[personName]
          return next
        })
      }
      setPayConfigSaving(false)
    }, 2000)
  }

  function updatePayConfigOfficeHourlyWage(personName: string, rawValue: string) {
    if (!canAccessPay) return
    setPayConfigOfficeWageDraft((prev) => ({ ...prev, [personName]: rawValue }))
    const roster = peopleRosterRef.current
    const resolvedPid = resolvePersonIdFromRosterName(roster, personName)
    const cur =
      payConfig[personName] ?? {
        person_name: personName,
        person_id: resolvedPid,
        hourly_wage: null,
        office_hourly_wage: null,
        is_salary: false,
        show_in_hours: false,
        show_in_cost_matrix: false,
        record_hours_but_salary: false,
      }
    const parsed = rawValue === '' ? null : parseFloat(rawValue) || null
    const full = { ...cur, office_hourly_wage: parsed }
    setPayConfig((prev) => ({ ...prev, [personName]: full }))
    // Separate debounce key so an office-wage edit never cancels a pending hourly-wage save.
    const key = `${personName}:office`
    const prevTimeout = payConfigDebounceRef.current[key]
    if (prevTimeout) clearTimeout(prevTimeout)
    payConfigDebounceRef.current[key] = setTimeout(async () => {
      delete payConfigDebounceRef.current[key]
      setPayConfigSaving(true)
      const draftVal = payConfigOfficeWageDraftRef.current[personName]
      const finalWage =
        draftVal !== undefined
          ? draftVal === ''
            ? null
            : parseFloat(draftVal) || null
          : payConfigRef.current[personName]?.office_hourly_wage ?? null
      const toSave = { ...(payConfigRef.current[personName] ?? full), office_hourly_wage: finalWage }
      const { error } = await supabase.from('people_pay_config').upsert(toSave, { onConflict: 'person_name' })
      if (error) setError(error.message)
      else {
        lastPersistedPayConfigRef.current[personName] = { is_salary: !!toSave.is_salary }
        setPayConfigOfficeWageDraft((prev) => {
          const next = { ...prev }
          delete next[personName]
          return next
        })
      }
      setPayConfigSaving(false)
    }, 2000)
  }

  useEffect(() => {
    return () => {
      for (const t of Object.values(payConfigDebounceRef.current)) clearTimeout(t)
      payConfigDebounceRef.current = {}
    }
  }, [])

  return {
    payConfig,
    payConfigDraft,
    payConfigOfficeWageDraft,
    payConfigSaving,
    salaryTemplateByPersonName,
    loadPayConfig,
    loadPayConfigSalaryTemplateIndicators,
    upsertPayConfig,
    updatePayConfigHourlyWage,
    updatePayConfigOfficeHourlyWage,
  }
}
