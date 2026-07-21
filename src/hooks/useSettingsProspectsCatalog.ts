import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useToastContext } from '../contexts/ToastContext'
import { formatErrorMessage } from '../utils/errorHandling'
import {
  builtinEstimateExperience,
  ESTIMATE_EXPERIENCE_APP_KEY_LIST,
  ESTIMATE_EXPERIENCE_FIELD_MAX_LEN,
} from '../lib/estimateCustomerExperience'
import { ESTIMATE_PUBLIC_TERMS_BODY_APP_KEY } from '../lib/estimatePublicTerms'
import type { EstimateCatalogLineItem } from '../lib/estimateLineItemCatalog'
import { catalogDbRowsToLineItems, fetchEstimateCatalogLive, replaceEstimateCatalogFromPayload } from '../lib/estimateCatalogApi'

/**
 * Settings → Catalogs & trades → prospects/estimate copy engine (dev only,
 * rendered by SettingsCatalogsProspectsTab): prospect copy defaults (6
 * `app_settings` keys), estimate customer-experience defaults, estimate public
 * terms, and the estimate line-item catalog. Extracted verbatim from
 * Settings.tsx (v2.856). Instantiated by the PARENT (not the tab) because the
 * tab is conditional-mount — parent-held state preserves unsaved edits across
 * tab switches (map quirk #1).
 * `setError` is the parent's shared error state (map quirk #4).
 */
export function useSettingsProspectsCatalog({
  enabled,
  setError,
}: {
  enabled: boolean
  setError: (message: string | null) => void
}) {
  const { showToast } = useToastContext()

  const [prospectCopyNoResponse, setProspectCopyNoResponse] = useState('')
  const [prospectCopyPhoneFollowup, setProspectCopyPhoneFollowup] = useState('')
  const [prospectCopyJustCheckingIn, setProspectCopyJustCheckingIn] = useState('')
  const [prospectCopyNoResponseSubject, setProspectCopyNoResponseSubject] = useState('')
  const [prospectCopyPhoneFollowupSubject, setProspectCopyPhoneFollowupSubject] = useState('')
  const [prospectCopyJustCheckingInSubject, setProspectCopyJustCheckingInSubject] = useState('')
  const [prospectCopySaving, setProspectCopySaving] = useState(false)
  const [prospectCopySectionOpen, setProspectCopySectionOpen] = useState(false)
  const [estimateCxSectionOpen, setEstimateCxSectionOpen] = useState(false)
  const [estimateCxSaving, setEstimateCxSaving] = useState(false)
  const [estimatePublicTermsSaving, setEstimatePublicTermsSaving] = useState(false)
  const [estimatePublicTermsBody, setEstimatePublicTermsBody] = useState('')
  const [estimatePublicTermsSectionOpen, setEstimatePublicTermsSectionOpen] = useState(false)
  const [estimateLineItemCatalogSectionOpen, setEstimateLineItemCatalogSectionOpen] = useState(false)
  const [estimateLineItemCatalogSaving, setEstimateLineItemCatalogSaving] = useState(false)
  const [estimateLineItemCatalogRows, setEstimateLineItemCatalogRows] = useState<EstimateCatalogLineItem[]>([])
  const [estimateCxByKey, setEstimateCxByKey] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {}
    for (const k of ESTIMATE_EXPERIENCE_APP_KEY_LIST) o[k] = ''
    return o
  })

  async function saveProspectCopyDefaults(e: FormEvent) {
    e.preventDefault()
    if (!enabled) return
    setProspectCopySaving(true)
    const { error } = await supabase.from('app_settings').upsert(
      [
        { key: 'prospect_copy_no_response_email', value_text: prospectCopyNoResponse },
        { key: 'prospect_copy_phone_followup_email', value_text: prospectCopyPhoneFollowup },
        { key: 'prospect_copy_just_checking_in_email', value_text: prospectCopyJustCheckingIn },
        { key: 'prospect_copy_no_response_email_subject', value_text: prospectCopyNoResponseSubject },
        { key: 'prospect_copy_phone_followup_email_subject', value_text: prospectCopyPhoneFollowupSubject },
        { key: 'prospect_copy_just_checking_in_email_subject', value_text: prospectCopyJustCheckingInSubject },
      ],
      { onConflict: 'key' }
    )
    setProspectCopySaving(false)
    if (error) setError(error.message)
    else showToast('Prospect copy defaults saved.', 'success')
  }

  async function saveEstimateCustomerCopyDefaults(e: FormEvent) {
    e.preventDefault()
    if (!enabled) return
    setEstimateCxSaving(true)
    const { error } = await supabase.from('app_settings').upsert(
      ESTIMATE_EXPERIENCE_APP_KEY_LIST.map((key) => ({
        key,
        value_text: (estimateCxByKey[key] ?? '').slice(0, ESTIMATE_EXPERIENCE_FIELD_MAX_LEN),
      })),
      { onConflict: 'key' },
    )
    setEstimateCxSaving(false)
    if (error) setError(error.message)
    else showToast('Estimate customer copy defaults saved.', 'success')
  }

  async function saveEstimatePublicTerms(e: FormEvent) {
    e.preventDefault()
    if (!enabled) return
    setEstimatePublicTermsSaving(true)
    const { error } = await supabase.from('app_settings').upsert(
      {
        key: ESTIMATE_PUBLIC_TERMS_BODY_APP_KEY,
        value_text: estimatePublicTermsBody.slice(0, ESTIMATE_EXPERIENCE_FIELD_MAX_LEN),
      },
      { onConflict: 'key' },
    )
    setEstimatePublicTermsSaving(false)
    if (error) setError(error.message)
    else showToast('Public terms page saved.', 'success')
  }

  async function saveEstimateLineItemCatalog(e: FormEvent) {
    e.preventDefault()
    if (!enabled) return
    setEstimateLineItemCatalogSaving(true)
    try {
      await replaceEstimateCatalogFromPayload(supabase, estimateLineItemCatalogRows)
      const ecRows = await fetchEstimateCatalogLive(supabase)
      setEstimateLineItemCatalogRows(catalogDbRowsToLineItems(ecRows))
      showToast('Estimate line item catalog saved.', 'success')
    } catch (err) {
      setError(formatErrorMessage(err, 'Could not save catalog'))
    } finally {
      setEstimateLineItemCatalogSaving(false)
    }
  }

  // Initial loads (were part of Settings.tsx loadData's dev branch)
  useEffect(() => {
    if (!enabled) return
    void (async () => {
      const prospectCopySettingKeys = [
        'prospect_copy_no_response_email',
        'prospect_copy_phone_followup_email',
        'prospect_copy_just_checking_in_email',
        'prospect_copy_no_response_email_subject',
        'prospect_copy_phone_followup_email_subject',
        'prospect_copy_just_checking_in_email_subject',
      ] as const
      const estimateCxSettingKeys = [...ESTIMATE_EXPERIENCE_APP_KEY_LIST, ESTIMATE_PUBLIC_TERMS_BODY_APP_KEY]

      const { data: settingsBatchRows } = await supabase
        .from('app_settings')
        .select('key, value_text, value_num')
        .in('key', [...prospectCopySettingKeys, ...estimateCxSettingKeys])

      const settingsByKey = new Map(
        (settingsBatchRows ?? []).map((r) => [r.key, r] as [string, { value_text: string | null; value_num: number | null }]),
      )

      const prospectCopyByKey = new Map(
        prospectCopySettingKeys.map((k) => [k, settingsByKey.get(k)?.value_text ?? ''] as const),
      )
      setProspectCopyNoResponse(prospectCopyByKey.get('prospect_copy_no_response_email') ?? '')
      setProspectCopyPhoneFollowup(prospectCopyByKey.get('prospect_copy_phone_followup_email') ?? '')
      setProspectCopyJustCheckingIn(prospectCopyByKey.get('prospect_copy_just_checking_in_email') ?? '')
      setProspectCopyNoResponseSubject(prospectCopyByKey.get('prospect_copy_no_response_email_subject') ?? '')
      setProspectCopyPhoneFollowupSubject(prospectCopyByKey.get('prospect_copy_phone_followup_email_subject') ?? '')
      setProspectCopyJustCheckingInSubject(prospectCopyByKey.get('prospect_copy_just_checking_in_email_subject') ?? '')

      const estimateCxRows = estimateCxSettingKeys
        .map((k) => {
          const row = settingsByKey.get(k)
          return row ? { key: k, value_text: row.value_text } : null
        })
        .filter((r): r is { key: string; value_text: string | null } => r != null)

      setEstimateCxByKey((prev) => {
        const next = { ...prev }
        for (const k of ESTIMATE_EXPERIENCE_APP_KEY_LIST) next[k] = next[k] ?? ''
        for (const r of estimateCxRows) {
          if (ESTIMATE_EXPERIENCE_APP_KEY_LIST.includes(r.key as (typeof ESTIMATE_EXPERIENCE_APP_KEY_LIST)[number]))
            next[r.key] = r.value_text ?? ''
        }
        const footerAppKey = 'estimate_accept_page_footer'
        if (!(next[footerAppKey]?.trim())) next[footerAppKey] = builtinEstimateExperience().accept_page_footer
        return next
      })
      const publicTermsRow = estimateCxRows.find((r) => r.key === ESTIMATE_PUBLIC_TERMS_BODY_APP_KEY)
      setEstimatePublicTermsBody(publicTermsRow?.value_text ?? '')

      try {
        const ecRows = await fetchEstimateCatalogLive(supabase)
        setEstimateLineItemCatalogRows(catalogDbRowsToLineItems(ecRows))
      } catch {
        setEstimateLineItemCatalogRows([])
      }
    })()
  }, [enabled])

  return {
    prospectCopyNoResponse,
    setProspectCopyNoResponse,
    prospectCopyPhoneFollowup,
    setProspectCopyPhoneFollowup,
    prospectCopyJustCheckingIn,
    setProspectCopyJustCheckingIn,
    prospectCopyNoResponseSubject,
    setProspectCopyNoResponseSubject,
    prospectCopyPhoneFollowupSubject,
    setProspectCopyPhoneFollowupSubject,
    prospectCopyJustCheckingInSubject,
    setProspectCopyJustCheckingInSubject,
    prospectCopySaving,
    prospectCopySectionOpen,
    setProspectCopySectionOpen,
    estimateCxSectionOpen,
    setEstimateCxSectionOpen,
    estimateCxSaving,
    estimateCxByKey,
    setEstimateCxByKey,
    estimatePublicTermsSaving,
    estimatePublicTermsBody,
    setEstimatePublicTermsBody,
    estimatePublicTermsSectionOpen,
    setEstimatePublicTermsSectionOpen,
    estimateLineItemCatalogSectionOpen,
    setEstimateLineItemCatalogSectionOpen,
    estimateLineItemCatalogSaving,
    estimateLineItemCatalogRows,
    setEstimateLineItemCatalogRows,
    saveProspectCopyDefaults,
    saveEstimateCustomerCopyDefaults,
    saveEstimatePublicTerms,
    saveEstimateLineItemCatalog,
  }
}
