import { useEffect, useRef, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { supabase } from '../../lib/supabase'
import {
  APP_SETTINGS_KEYS,
  APP_SUBJECT_SETTINGS_KEYS,
  foldCopyTemplateRows,
  getBlankFieldsForMail,
  getBlankPlaceholderFields,
  resolveCopyText,
  substituteCopyPlaceholders,
  type CopyTemplateKey,
} from '../../lib/prospects/prospectCopyTemplates'
import type { Prospect, ProspectComment } from '../../lib/prospects/prospectRow'

/**
 * The Follow Up card's three email templates (the Customers lane): the company's defaults and the person's own
 * words, the sender's phone, which templates were mailed to this prospect, and the four presses (Copy, Open in
 * email, Edit template, Save). Moved out of `src/pages/Prospects.tsx` unchanged; the rules are in
 * `lib/prospects/prospectCopyTemplates.ts`.
 *
 * The page calls this hook; `ProspectCopyTemplateRow` and the two copy windows draw its value.
 */
export function useProspectCopyTemplates({
  userId,
  userEmail,
  authUserName,
  currentProspect,
  comments,
}: {
  userId: string | null
  userEmail: string | null | undefined
  /** The sender's name off `users`, which the page reads once and also hands to the run's text. */
  authUserName: string
  currentProspect: Prospect | null
  comments: ProspectComment[]
}) {
  const { showToast } = useToastContext()
  // Copy templates (defaults from app_settings, overrides from user_prospect_copy_templates)
  const [copyDefaults, setCopyDefaults] = useState<Record<CopyTemplateKey, string>>({
    no_response_email: '',
    phone_followup_email: '',
    just_checking_in_email: '',
  })
  const [copyOverrides, setCopyOverrides] = useState<Record<CopyTemplateKey, string | null>>({
    no_response_email: null,
    phone_followup_email: null,
    just_checking_in_email: null,
  })
  const [copySubjectDefaults, setCopySubjectDefaults] = useState<Record<CopyTemplateKey, string>>({
    no_response_email: '',
    phone_followup_email: '',
    just_checking_in_email: '',
  })
  const [copySubjectOverrides, setCopySubjectOverrides] = useState<Record<CopyTemplateKey, string | null>>({
    no_response_email: null,
    phone_followup_email: null,
    just_checking_in_email: null,
  })
  const [personPhone, setPersonPhone] = useState<string | null>(null)
  const [editingCopyTemplateKey, setEditingCopyTemplateKey] = useState<CopyTemplateKey | null>(null)
  const [editingCopyText, setEditingCopyText] = useState('')
  const [editingCopySubject, setEditingCopySubject] = useState('')
  const [copyTemplateSaving, setCopyTemplateSaving] = useState(false)
  const [copyBlankFieldsModalOpen, setCopyBlankFieldsModalOpen] = useState(false)
  const [copyBlankFieldsList, setCopyBlankFieldsList] = useState<string[]>([])
  const [emailSentTemplateKeys, setEmailSentTemplateKeys] = useState<Set<string>>(new Set())
  const copyTemplateTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  async function loadCopyTemplates() {
    if (!userId) return
    const allKeys = [...Object.values(APP_SETTINGS_KEYS), ...Object.values(APP_SUBJECT_SETTINGS_KEYS)]
    const [defaultsRes, overridesRes] = await Promise.all([
      supabase.from('app_settings').select('key, value_text').in('key', allKeys),
      supabase.from('user_prospect_copy_templates').select('template_key, value_text, subject_text').eq('user_id', userId),
    ])
    const texts = foldCopyTemplateRows(defaultsRes.data ?? [], overridesRes.data ?? [])
    setCopyDefaults(texts.defaults)
    setCopySubjectDefaults(texts.subjectDefaults)
    setCopyOverrides(texts.overrides)
    setCopySubjectOverrides(texts.subjectOverrides)
  }

  async function loadPersonPhone() {
    if (!userId) return
    // Prefer users.phone (set in Settings > My Profile); fall back to people.phone
    const { data: userRow } = await supabase
      .from('users')
      .select('phone')
      .eq('id', userId)
      .maybeSingle()
    const userPhone = (userRow as { phone: string | null } | null)?.phone
    if (userPhone != null && userPhone.trim() !== '') {
      setPersonPhone(userPhone.trim())
      return
    }
    const { data: peopleData } = await supabase
      .from('people')
      .select('phone')
      .is('archived_at', null)
      .eq('master_user_id', userId)
      .not('phone', 'is', null)
      .limit(1)
    const first = (peopleData ?? [])[0] as { phone: string | null } | undefined
    setPersonPhone(first?.phone ?? null)
  }

  useEffect(() => {
    if (userId) {
      loadCopyTemplates()
      loadPersonPhone()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the page's per-user effect, keyed on the user alone as it was
  }, [userId])

  function getResolvedCopyText(key: CopyTemplateKey): string {
    return resolveCopyText(copyOverrides[key], copyDefaults[key])
  }

  function getResolvedCopySubject(key: CopyTemplateKey): string {
    return resolveCopyText(copySubjectOverrides[key], copySubjectDefaults[key])
  }

  async function handleCopyTemplate(key: CopyTemplateKey) {
    if (!userId || !currentProspect) return
    const text = getResolvedCopyText(key)
    if (!text.trim()) {
      showToast('No text to copy. Edit the template first.', 'warning')
      return
    }
    const blankFields = getBlankPlaceholderFields(
      text,
      authUserName ?? '',
      userEmail ?? '',
      currentProspect,
      personPhone,
      key,
      comments
    )
    if (blankFields.length > 0) {
      setCopyBlankFieldsList(blankFields)
      setCopyBlankFieldsModalOpen(true)
      return
    }
    const userInfo = { name: (authUserName || userEmail) ?? '', email: userEmail ?? '' }
    const substituted = substituteCopyPlaceholders(text, userInfo, currentProspect, personPhone, key, comments)
    try {
      await navigator.clipboard.writeText(substituted)
      showToast('Copied to clipboard', 'success')
    } catch {
      showToast('Failed to copy to clipboard', 'error')
    }
  }

  async function handleOpenMail(key: CopyTemplateKey) {
    if (!userId || !currentProspect) return
    const body = getResolvedCopyText(key)
    const subject = getResolvedCopySubject(key)
    const blankFields = getBlankFieldsForMail(
      body,
      subject,
      authUserName ?? '',
      userEmail ?? '',
      currentProspect,
      personPhone,
      key,
      comments
    )
    if (blankFields.length > 0) {
      setCopyBlankFieldsList(blankFields)
      setCopyBlankFieldsModalOpen(true)
      return
    }
    const userInfo = { name: (authUserName || userEmail) ?? '', email: userEmail ?? '' }
    const substitutedBody = substituteCopyPlaceholders(body, userInfo, currentProspect, personPhone, key, comments)
    const substitutedSubject = substituteCopyPlaceholders(subject, userInfo, currentProspect, personPhone, key, comments)
    const to = encodeURIComponent(currentProspect.email!.trim())
    const subjectEnc = encodeURIComponent(substitutedSubject)
    const bodyEnc = encodeURIComponent(substitutedBody)
    const mailtoUrl = `mailto:${to}?subject=${subjectEnc}&body=${bodyEnc}`
    window.location.href = mailtoUrl
    await supabase.from('prospect_email_sent').upsert(
      { prospect_id: currentProspect.id, user_id: userId, template_key: key },
      { onConflict: 'prospect_id,user_id,template_key' }
    )
    setEmailSentTemplateKeys((prev) => new Set([...prev, key]))
  }

  function openEditCopyModal(key: CopyTemplateKey) {
    setEditingCopyTemplateKey(key)
    setEditingCopyText(getResolvedCopyText(key))
    setEditingCopySubject(getResolvedCopySubject(key))
  }

  async function saveCopyTemplate(e: React.FormEvent) {
    e.preventDefault()
    if (!userId || !editingCopyTemplateKey) return
    setCopyTemplateSaving(true)
    const { error } = await supabase.from('user_prospect_copy_templates').upsert(
      { user_id: userId, template_key: editingCopyTemplateKey, value_text: editingCopyText, subject_text: editingCopySubject || null },
      { onConflict: 'user_id,template_key' }
    )
    setCopyTemplateSaving(false)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    setCopyOverrides((prev) => ({ ...prev, [editingCopyTemplateKey]: editingCopyText }))
    setCopySubjectOverrides((prev) => ({ ...prev, [editingCopyTemplateKey]: editingCopySubject || null }))
    setEditingCopyTemplateKey(null)
    showToast('Template saved', 'success')
  }

  async function loadEmailSentTemplateKeys(prospectId: string) {
    if (!userId) return
    const { data } = await supabase
      .from('prospect_email_sent')
      .select('template_key')
      .eq('prospect_id', prospectId)
      .eq('user_id', userId)
    const keys = new Set((data ?? []).map((r) => r.template_key))
    setEmailSentTemplateKeys(keys)
  }

  useEffect(() => {
    if (currentProspect?.id && userId) {
      loadEmailSentTemplateKeys(currentProspect.id)
    } else {
      setEmailSentTemplateKeys(new Set())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the card and the user, as the page had it
  }, [currentProspect?.id, userId])

  return {
    editingCopyTemplateKey,
    setEditingCopyTemplateKey,
    editingCopyText,
    setEditingCopyText,
    editingCopySubject,
    setEditingCopySubject,
    copyTemplateSaving,
    copyBlankFieldsModalOpen,
    setCopyBlankFieldsModalOpen,
    copyBlankFieldsList,
    emailSentTemplateKeys,
    copyTemplateTextareaRef,
    handleCopyTemplate,
    handleOpenMail,
    openEditCopyModal,
    saveCopyTemplate,
  }
}

export type ProspectCopyTemplates = ReturnType<typeof useProspectCopyTemplates>
