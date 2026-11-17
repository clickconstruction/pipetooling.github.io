import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useJobFormAutosaveSlice } from '../components/jobs/useJobFormAutosaveSlice'
import { useToastContext } from '../contexts/ToastContext'
import type { ValidUntilPresetDays } from '../lib/addCalendarDaysYmd'
import { heldDatesToTell } from '../lib/autosaveDateHold'
import { checkGoogleDriveAttachmentUrl } from '../lib/checkGoogleDriveAttachmentUrl'
import { extractContactFromCustomer, getCustomerDisplay, type CustomerRow } from '../lib/customerContactDisplay'
import type { EstimateAcceptHeaderBrand } from '../lib/estimateAcceptHeaderBrand'
import { catalogDbRowsToLineItems, fetchEstimateCatalogLive } from '../lib/estimateCatalogApi'
import { EMPTY_ESTIMATE_CHANGE_ORDER_FIELDS, isChangeOrderDocKind, type EstimateChangeOrderFields } from '../lib/estimateChangeOrder'
import { normalizeCustomerAttachmentDraftForDb, normalizeCustomerAttachmentUrl } from '../lib/estimateCustomerAttachment'
import { ESTIMATE_EXPERIENCE_APP_KEY_LIST, parseEstimateExperienceOverrides, type EstimateExperienceOverrideKey } from '../lib/estimateCustomerExperience'
import { estimateDraftFormSnapshot, shouldDiscardFreshEstimateDraftOnLeave } from '../lib/estimateFreshDraftDiscard'
import type { EstimateCatalogLineItem } from '../lib/estimateLineItemCatalog'
import { sumNormalizedLineItems, type EstimateLineItemNormalized } from '../lib/estimateLineItemNormalize'
import { isEstimateUuidSegment, parseEstimateQuoteNumberSegment } from '../lib/estimateRouteSegment'
import { readStoredEstimateAcceptUrl } from '../lib/estimates/estimateAcceptUrlSession'
import { customerFieldsFromEstimate, defaultAcceptNotifyIds, estimateFormFromRow, estimateInitialTitle } from '../lib/estimates/estimateDetailHydration'
import type { EstimateDetailRow } from '../lib/estimates/estimateDetailRow'
import { buildEstimateDraftPersistPayload, estimateDraftHeldDateMessage, estimateDraftUnfinishedDateBlocksSend, estimateDraftUnfinishedDates } from '../lib/estimates/estimateDraftPersist'
import type { EstimateNotifyUserOption } from '../lib/estimates/estimateNotifyOptions'
import type { EstimateOption } from '../lib/estimates/estimateOptions'
import { estimateRecipientEmail } from '../lib/estimates/estimateSendPlan'
import { supabase } from '../lib/supabase'
import type { Tables } from '../types/database'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { useAuth } from './useAuth'

/**
 * The estimate detail page's engine: the row, the form it opens as, the reads behind it, the draft's
 * save, both autosaves and the rule that deletes an untouched fresh draft on the way out.
 *
 * Moved whole from `EstimateDetail` (v2.7627, punch list #46 row 3, cut 7 of the Estimates map). Every
 * statement is the page's own, in the page's own order, so the effects fire in the order they always
 * did. The page calls this first and destructures it, and keeps what is only screen: the rail, the
 * customer gates, the option moves, the send flow, the sent side.
 *
 * Three things must stay together here and never be split across files:
 * - `buildDraftPersistPayload` is both what a save writes and what the autosave compares, so "dirty"
 *   can never disagree with what a save would write;
 * - `saveDraft` reloads the row unless told not to, and the autosave tells it not to, because a reload
 *   re-seeds the editor and would clobber what was typed while the save was in flight;
 * - the leave rule is keyed on the route, not the row: its cleanup runs while the state is still the
 *   old row's, which is the row it must judge.
 */
export function useEstimateDetailData({ routeSegment }: { routeSegment: string }) {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const navigate = useNavigate()
  const location = useLocation()
  // Fresh-draft marker from createDraft's navigate state (decision 17, v2.2885):
  // captured per render into a ref so load() can stamp the row it hydrates.
  const locationFreshDraftRef = useRef(false)
  locationFreshDraftRef.current =
    (location.state as { freshEstimateDraft?: boolean } | null | undefined)?.freshEstimateDraft === true
  /** The row id this visit minted (New estimate / New change order / the Projects deep link). */
  const freshDraftRowIdRef = useRef<string | null>(null)
  /** The row id that received any write since hydration (autosave / Save draft / pre-send save / delete). */
  const committedDraftRowIdRef = useRef<string | null>(null)
  /** The date boxes the last draft save held back half typed — the autosave says each once (`heldDatesToTell`), and again the next time the draft is opened. */
  const toldHeldDraftDatesRef = useRef<string[]>([])
  const [row, setRow] = useState<EstimateDetailRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [terms, setTerms] = useState('')
  const [lines, setLines] = useState<EstimateLineItemNormalized[]>([])
  // Estimate Options (v2.2457): the row's options; empty = a normal single-option estimate.
  // `lines` always holds the VIEWED option's lines while options exist — the editor below the
  // cards keeps operating on `lines` exactly as before, and switches/saves sync it back.
  const [estimateOptions, setEstimateOptions] = useState<EstimateOption[]>([])
  const [viewedOptionKey, setViewedOptionKey] = useState<string | null>(null)
  // The staff Page preview's own selection — rehearses the customer's picker.
  const [previewSelectedOptionKeys, setPreviewSelectedOptionKeys] = useState<string[]>([])
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [customersLoading, setCustomersLoading] = useState(false)
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [sendEmailOverride, setSendEmailOverride] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [validUntilPreset, setValidUntilPreset] = useState<ValidUntilPresetDays | null>(null)
  const [forAddress, setForAddress] = useState('')
  /** Linked `projects.id` ('' = not linked); internal-only, saved with the draft. */
  const [linkedProjectId, setLinkedProjectId] = useState('')
  const [projectsForPicker, setProjectsForPicker] = useState<Array<{ id: string; name: string | null; project_number: string | null }> | null>(null)
  const [internalNotes, setInternalNotes] = useState('')
  const [customerAttachmentUrl, setCustomerAttachmentUrl] = useState('')
  const [customerAttachmentLabel, setCustomerAttachmentLabel] = useState('')
  const [attachmentCheckStatus, setAttachmentCheckStatus] = useState<
    'idle' | 'loading' | 'success' | 'warn' | 'error'
  >('idle')
  const [attachmentCheckMessage, setAttachmentCheckMessage] = useState('')
  const [acceptHeaderBrand, setAcceptHeaderBrand] = useState<EstimateAcceptHeaderBrand | null>(null)
  const [acceptorSignatureSignedUrl, setAcceptorSignatureSignedUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [lastAcceptUrl, setLastAcceptUrl] = useState<string | null>(null)
  const [appCxSettings, setAppCxSettings] = useState<{ key: string; value_text: string | null }[]>([])
  const [catalogLineItems, setCatalogLineItems] = useState<EstimateCatalogLineItem[]>([])
  const [estimateCustomerEvents, setEstimateCustomerEvents] = useState<Tables<'estimate_customer_events'>[]>([])
  const [estimateCustomerEventsLoading, setEstimateCustomerEventsLoading] = useState(false)
  const [cxOverrideFields, setCxOverrideFields] = useState<
    Partial<Record<EstimateExperienceOverrideKey, string>>
  >({})
  const [acceptNotifyUserIds, setAcceptNotifyUserIds] = useState<string[]>([])
  const [notifyUserOptions, setNotifyUserOptions] = useState<EstimateNotifyUserOption[]>([])
  const [acceptNotifyResolvedUsers, setAcceptNotifyResolvedUsers] = useState<EstimateNotifyUserOption[]>([])
  /** Tracks last persisted customer link for draft auto-save; `undefined` = skip first run after load/navigation. */
  const prevCustomerIdForAutosave = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    setLastAcceptUrl(null)
    setValidUntilPreset(null)
    setCustomerAttachmentUrl('')
    setCustomerAttachmentLabel('')
    setAttachmentCheckStatus('idle')
    setAttachmentCheckMessage('')
    prevCustomerIdForAutosave.current = undefined
    toldHeldDraftDatesRef.current = []
    setAcceptNotifyUserIds([])
    setAcceptNotifyResolvedUsers([])
  }, [routeSegment])
  useEffect(() => {
    setAttachmentCheckStatus('idle')
    setAttachmentCheckMessage('')
  }, [customerAttachmentUrl])
  useEffect(() => {
    const path = row?.acceptor_signature_storage_path?.trim()
    if (!path) {
      setAcceptorSignatureSignedUrl(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const signed = await withSupabaseRetry(
          async () => await supabase.storage.from('estimate-acceptor-signatures').createSignedUrl(path, 3600),
          'estimate acceptor signature url',
        )
        if (cancelled) return
        setAcceptorSignatureSignedUrl(signed?.signedUrl ?? null)
      } catch {
        if (!cancelled) setAcceptorSignatureSignedUrl(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [row?.acceptor_signature_storage_path, row?.id])
  const loadCatalogFromDb = useCallback(async () => {
    try {
      const rows = await fetchEstimateCatalogLive(supabase)
      setCatalogLineItems(catalogDbRowsToLineItems(rows))
    } catch {
      setCatalogLineItems([])
    }
  }, [])
  useEffect(() => {
    void loadCatalogFromDb()
  }, [loadCatalogFromDb])
  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!user?.id) {
        if (!cancelled) setNotifyUserOptions([])
        return
      }
      try {
        const [usersRes, meRes] = await Promise.all([
          withSupabaseRetry(
            async () =>
              await supabase
                .from('users')
                .select('id, name, email, role')
                .in('role', [
                  'assistant',
                  'controller' as 'assistant',
                  'master_technician',
                  'subcontractor',
                  'helpers',
                  'estimator',
                  'primary',
                  'superintendent',
                ])
                .order('name'),
            'load estimate notify user options',
          ),
          supabase.from('users').select('role').eq('id', user.id).single(),
        ])
        let usersList = (usersRes as EstimateNotifyUserOption[]) ?? []
        const meRole = (meRes.data as { role?: string } | null)?.role
        if (meRole === 'dev') {
          const { data: devUsers } = await supabase.from('users').select('id, name, email, role').eq('role', 'dev')
          if (devUsers?.length) {
            const existingIds = new Set(usersList.map((u) => u.id))
            const newDevs = (devUsers as EstimateNotifyUserOption[]).filter((u) => !existingIds.has(u.id))
            usersList = [...usersList, ...newDevs]
          }
        }
        if (!cancelled) setNotifyUserOptions(usersList)
      } catch {
        if (!cancelled) setNotifyUserOptions([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const rows = await withSupabaseRetry(
          async () =>
            await supabase.from('app_settings').select('key, value_text').in('key', ESTIMATE_EXPERIENCE_APP_KEY_LIST),
          'load estimate app_settings',
        )
        const list = (rows ?? []) as { key: string; value_text: string | null }[]
        if (!cancelled) setAppCxSettings(list)
      } catch {
        if (!cancelled) setAppCxSettings([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])
  const loadEstimateCustomerEvents = useCallback(async () => {
    const id = row?.id
    const st = row?.status
    if (!id || (st !== 'sent' && st !== 'customer_accepted' && st !== 'declined')) {
      setEstimateCustomerEvents([])
      setEstimateCustomerEventsLoading(false)
      return
    }
    setEstimateCustomerEventsLoading(true)
    try {
      const data = await withSupabaseRetry(
        async () =>
          await supabase
            .from('estimate_customer_events')
            .select('id, estimate_id, occurred_at, event_type, source, client_ip, user_agent, metadata')
            .eq('estimate_id', id)
            .order('occurred_at', { ascending: false }),
        'load estimate customer events',
      )
      const rows = (data ?? []) as Tables<'estimate_customer_events'>[]
      setEstimateCustomerEvents(rows)
    } catch (e) {
      setEstimateCustomerEvents([])
    } finally {
      setEstimateCustomerEventsLoading(false)
    }
  }, [row?.id, row?.status])
  useEffect(() => {
    void loadEstimateCustomerEvents()
  }, [loadEstimateCustomerEvents])
  useEffect(() => {
    if (row?.status !== 'sent' && row?.status !== 'customer_accepted') return
    const onFocus = () => void loadEstimateCustomerEvents()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [row?.status, loadEstimateCustomerEvents])
  function hydrateCustomerFieldsFromEstimate(r: EstimateDetailRow, custList: CustomerRow[]) {
    const fields = customerFieldsFromEstimate(r, custList)
    setCustomerSearch(fields.customerSearch)
    setSendEmailOverride(fields.sendEmailOverride)
  }
  const load = useCallback(async (opts?: { refresh?: boolean }) => {
    // A refresh keeps the loaded page up and swaps the row in when the read lands (v2.5695, punch list #139): the
    // loading flag blanks the whole detail tree, which unmounted the Tell sheet mid-send and lost its receipt.
    if (!opts?.refresh) setLoading(true)
    try {
      let data: EstimateDetailRow | null = null

      const detailSelect = '*, jobs_ledger(hcp_number)'

      if (isEstimateUuidSegment(routeSegment)) {
        const one = await withSupabaseRetry(
          async () =>
            await supabase.from('estimates').select(detailSelect).eq('id', routeSegment).maybeSingle(),
          'load estimate',
        )
        data = (one ?? null) as EstimateDetailRow | null
      } else {
        const n = parseEstimateQuoteNumberSegment(routeSegment)
        if (n === null) {
          showToast('Invalid estimate link.', 'error')
          navigate('/estimates')
          return
        }
        const one = await withSupabaseRetry(
          async () =>
            await supabase.from('estimates').select(detailSelect).eq('estimate_number', n).maybeSingle(),
          'load estimate',
        )
        data = (one ?? null) as EstimateDetailRow | null
      }

      if (!data) {
        showToast('Estimate not found.', 'error')
        navigate('/estimates')
        return
      }
      const r = data

      if (isEstimateUuidSegment(routeSegment) && String(r.estimate_number) !== routeSegment) {
        navigate(`/estimates/${r.estimate_number}`, { replace: true })
      }

      if (locationFreshDraftRef.current && r.status === 'draft') freshDraftRowIdRef.current = r.id
      setRow(r)
      // What the row opens as (`lib/estimates/estimateDetailHydration`, v2.7607); the reads and their order stay here.
      const form = estimateFormFromRow(r)
      setAcceptHeaderBrand(form.acceptHeaderBrand)
      setTerms(form.terms)
      setEstimateOptions(form.options)
      setViewedOptionKey(form.viewedOptionKey)
      setPreviewSelectedOptionKeys(form.previewSelectedOptionKeys)
      setLines(form.lines)
      setCoFields(form.coFields)
      setCustomerId(form.customerId)
      setValidUntil(form.validUntil)
      setValidUntilPreset(form.validUntilPreset)
      setForAddress(form.forAddress)
      setLinkedProjectId(form.linkedProjectId)
      setInternalNotes(form.internalNotes)
      if (form.acceptNotifyIds !== 'draft-default') {
        setAcceptNotifyUserIds(form.acceptNotifyIds)
      } else if (user?.id) {
        try {
          const masterRows =
            (await withSupabaseRetry(
              async () =>
                await supabase.from('users').select('id').eq('role', 'master_technician'),
              'load estimate default notify master technicians',
            )) ?? []
          setAcceptNotifyUserIds(defaultAcceptNotifyIds(user.id, masterRows.map((row) => row.id)))
        } catch {
          setAcceptNotifyUserIds([user.id])
        }
      } else {
        setAcceptNotifyUserIds([])
      }
      if (form.acceptNotifyDisplayIds.length > 0) {
        try {
          const nu = await withSupabaseRetry(
            async () =>
              await supabase.from('users').select('id, name, email').in('id', form.acceptNotifyDisplayIds),
            'load estimate notify display users',
          )
          setAcceptNotifyResolvedUsers((nu ?? []) as EstimateNotifyUserOption[])
        } catch {
          setAcceptNotifyResolvedUsers([])
        }
      } else {
        setAcceptNotifyResolvedUsers([])
      }
      setCustomerAttachmentUrl(form.attachmentUrl)
      setCustomerAttachmentLabel(form.attachmentLabel)
      if (r.status === 'sent' || r.status === 'customer_accepted') {
        const stored = readStoredEstimateAcceptUrl(r.id)
        if (stored) setLastAcceptUrl(stored)
      }

      if (!user?.id) {
        setCustomers([])
        hydrateCustomerFieldsFromEstimate(r, [])
        setTitle(r.title ?? '')
        return
      }
      setCustomersLoading(true)
      try {
        const cust = await withSupabaseRetry(
          async () =>
            await supabase
              .from('customers')
              .select('id, name, address, contact_info, date_met, master_user_id, customer_type, archived_at')
              .order('name'),
          'load customers for estimate',
        )
        const list = (cust ?? []) as CustomerRow[]
        setTitle(estimateInitialTitle(r, list))
        setCustomers(list)
        hydrateCustomerFieldsFromEstimate(r, list)
      } catch {
        setCustomers([])
        hydrateCustomerFieldsFromEstimate(r, [])
        setTitle(r.title ?? '')
      } finally {
        setCustomersLoading(false)
      }
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load estimate'), 'error')
      navigate('/estimates')
    } finally {
      setLoading(false)
    }
  }, [routeSegment, navigate, showToast, user?.id])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    if (!row) {
      setCxOverrideFields({})
      return
    }
    setCxOverrideFields(parseEstimateExperienceOverrides(row.customer_experience_overrides))
  }, [row?.id, row?.updated_at, row?.customer_experience_overrides])
  const refetchCustomersAfterEdit = useCallback(
    async (forCustomerId: string) => {
      if (!user?.id) return
      try {
        const cust = await withSupabaseRetry(
          async () =>
            await supabase
              .from('customers')
              .select('id, name, address, contact_info, date_met, master_user_id, customer_type, archived_at')
              .order('name'),
          'refetch customers after edit',
        )
        const list = (cust ?? []) as CustomerRow[]
        setCustomers(list)
        const c = list.find((x) => x.id === forCustomerId)
        if (c) {
          setCustomerSearch(getCustomerDisplay(c))
          if (extractContactFromCustomer(c).email.trim()) setSendEmailOverride('')
        }
      } catch (e) {
        showToast(formatErrorMessage(e, 'Could not refresh customers'), 'error')
      }
    },
    [user?.id, showToast],
  )
  const isDraft = row?.status === 'draft'
  /** CO train (v2.1832): change orders reuse this whole page in CO mode. */
  const isCO = isChangeOrderDocKind(row?.doc_kind)
  const [coFields, setCoFields] = useState<EstimateChangeOrderFields>(EMPTY_ESTIMATE_CHANGE_ORDER_FIELDS)
  const totalCents = sumNormalizedLineItems(lines)
  function resolveCustomerEmailForPersist(): string | null {
    if (!customerId) return null
    const sel = customers.find((x) => x.id === customerId)
    const crm = sel ? extractContactFromCustomer(sel).email.trim() : ''
    return estimateRecipientEmail(crm, sendEmailOverride) || null
  }
  function buildCustomerExperienceOverridesPayload(): Record<string, string> | null {
    const parsed = parseEstimateExperienceOverrides(cxOverrideFields)
    return Object.keys(parsed).length > 0 ? parsed : null
  }
  // Lazy projects fetch for the draft's linked-project picker (first draft render only).
  useEffect(() => {
    if (!row || !isDraft || projectsForPicker !== null) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase.from('projects').select('id, name, project_number').order('name')
      if (cancelled) return
      setProjectsForPicker((data ?? []) as Array<{ id: string; name: string | null; project_number: string | null }>)
    })()
    return () => {
      cancelled = true
    }
  }, [row, isDraft, projectsForPicker])
  /**
   * The exact draft UPDATE payload — one builder shared by saveDraft and the
   * autosave dirty check (v2.2592), so "dirty" can never disagree with what a
   * save would actually write.
   */
  function buildDraftPersistPayload(attDb: { url: string | null; label: string | null }) {
    // The one builder (`lib/estimates/estimateDraftPersist`, v2.3867); the page resolves the
    // two state-derived values and hands over the fields.
    return buildEstimateDraftPersistPayload(
      {
        isChangeOrder: isCO,
        title,
        terms,
        lines,
        totalCents,
        options: estimateOptions,
        viewedOptionKey,
        validUntil,
        forAddress,
        linkedProjectId,
        internalNotes,
        customerId,
        customerEmail: resolveCustomerEmailForPersist(),
        customerExperienceOverrides: buildCustomerExperienceOverridesPayload(),
        acceptHeaderBrand,
        acceptNotifyUserIds,
        changeOrderFields: coFields,
      },
      attDb,
    )
  }
  /** The date boxes caught half typed: the payload above leaves them out, a save says so, and nothing goes out past one. */
  function unfinishedDraftDates() {
    return estimateDraftUnfinishedDates({ isChangeOrder: isCO, validUntil, changeOrderFields: coFields })
  }
  /** Says why and answers true when a half-typed date stops the draft going out — what is sent is what is saved. */
  function unfinishedDateStopsSending(): boolean {
    const why = estimateDraftUnfinishedDateBlocksSend(unfinishedDraftDates(), new Date().getFullYear())
    if (why) showToast(why, 'error')
    return why !== null
  }
  async function saveDraft(options?: { quiet?: boolean; skipReload?: boolean }): Promise<boolean> {
    if (!row || !isDraft || saving) return false
    const quiet = options?.quiet ?? false
    const attDb = normalizeCustomerAttachmentDraftForDb(customerAttachmentUrl, customerAttachmentLabel)
    if (customerAttachmentUrl.trim() && !attDb.url) {
      showToast('Supporting document URL must be a valid https link.', 'error')
      return false
    }
    setSaving(true)
    try {
      await withSupabaseRetry(
        async () =>
          await supabase
            .from('estimates')
            .update(buildDraftPersistPayload(attDb))
            .eq('id', row.id)
            .eq('status', 'draft'),
        'save estimate',
      )
      committedDraftRowIdRef.current = row.id
      // A date caught half typed was left out of that write: say so — once per box from the autosave, every time from Save draft.
      const heldDates = unfinishedDraftDates()
      const heldBoxes = heldDates.map((box) => `${row.id}:${box}`)
      if (heldDates.length > 0 && (!quiet || heldDatesToTell(toldHeldDraftDatesRef.current, heldBoxes))) {
        showToast(estimateDraftHeldDateMessage(heldDates, new Date().getFullYear()), 'info')
      } else if (!quiet) showToast('Saved', 'success')
      toldHeldDraftDatesRef.current = heldBoxes
      // Autosave (v2.2592) skips the reload: load() re-seeds the whole editor
      // from the row (resets lines, options, the viewed option) and would
      // clobber whatever was typed while the save was in flight.
      if (!options?.skipReload) await load()
      return true
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save'), 'error')
      return false
    } finally {
      setSaving(false)
    }
  }
  useEffect(() => {
    if (!row || !isDraft || loading) return
    if (prevCustomerIdForAutosave.current === undefined) {
      prevCustomerIdForAutosave.current = customerId
      return
    }
    if (prevCustomerIdForAutosave.current === customerId) return
    const nextId = customerId
    void (async () => {
      const ok = await saveDraft({ quiet: true })
      if (ok) prevCustomerIdForAutosave.current = nextId
    })()
    // Customer-link changes only; avoid re-saving on every keystroke. saveDraft reads latest form state when the IIFE runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, row?.id, isDraft, loading])
  // Draft autosave (v2.2592, Taunya: work wiped by a hard reload mid-edit).
  // Reuses the Edit-Job autosave slice: baseline vs the EXACT persist payload,
  // ~1.5s debounce after the last change, quiet + reload-skipping save. jobId
  // gates on !loading so the baseline is captured only after hydration
  // completes — never against a half-hydrated editor.
  const draftAutosaveAttachment = normalizeCustomerAttachmentDraftForDb(customerAttachmentUrl, customerAttachmentLabel)
  const draftAutosaveBlocked = Boolean(customerAttachmentUrl.trim() && !draftAutosaveAttachment.url)
  const draftAutosaveSliceJson =
    row && isDraft && !draftAutosaveBlocked ? JSON.stringify(buildDraftPersistPayload(draftAutosaveAttachment)) : ''
  const draftAutosave = useJobFormAutosaveSlice({
    jobId: row && isDraft && !loading ? row.id : null,
    sliceJson: draftAutosaveSliceJson,
    save: () => saveDraft({ quiet: true, skipReload: true }),
    enabled: !saving && !sending && !draftAutosaveBlocked,
    debounceMs: 1500,
  })
  const draftAutosaveFlushRef = useRef(draftAutosave.flush)
  draftAutosaveFlushRef.current = draftAutosave.flush
  // Leave hook (decision 17, v2.2885): a draft this visit minted that never
  // received a commit — no autosave landed, no Save draft, no Send — and is
  // still empty deletes itself when you navigate away or the editor unmounts.
  // Keyed on routeSegment, not row.id: at a route change the state below is
  // still the OLD row's (load() hasn't run yet), which is what must be judged.
  const freshDraftLeaveRef = useRef<() => void>(() => {})
  freshDraftLeaveRef.current = () => {
    if (!row) return
    const discard = shouldDiscardFreshEstimateDraftOnLeave({
      fresh: freshDraftRowIdRef.current === row.id,
      everSaved: committedDraftRowIdRef.current === row.id,
      form: estimateDraftFormSnapshot({
        status: row.status,
        docKind: row.doc_kind,
        title,
        customerId,
        lines,
        terms,
        changeOrderFields: coFields,
        forAddress,
        internalNotes,
      }),
    })
    if (!discard) return
    draftAutosave.cancelPending()
    freshDraftRowIdRef.current = null
    void supabase
      .from('estimates')
      .delete()
      .eq('id', row.id)
      .eq('status', 'draft')
      .then(
        () => {},
        () => {
          /* best-effort — the Pipeline's Clean up empty drafts sweep catches stragglers */
        },
      )
  }
  useEffect(
    () => () => {
      freshDraftLeaveRef.current()
    },
    [routeSegment],
  )
  useEffect(() => {
    // Her loss scenario is "ran off to look something up": flush the pending
    // debounce the moment the tab is hidden, so the save lands before any
    // later hard reload can wipe it.
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void draftAutosaveFlushRef.current()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])
  const checkCustomerAttachmentUrl = useCallback(async () => {
    const u = normalizeCustomerAttachmentUrl(customerAttachmentUrl)
    if (!u) {
      showToast('Enter a valid https URL first.', 'error')
      return
    }
    setAttachmentCheckStatus('loading')
    setAttachmentCheckMessage('')
    const result = await checkGoogleDriveAttachmentUrl(customerAttachmentUrl)
    if (result.status === 'error' && result.message === 'Not signed in.') {
      showToast('Not signed in', 'error')
    }
    setAttachmentCheckStatus(
      result.status === 'success' ? 'success' : result.status === 'warn' ? 'warn' : 'error',
    )
    setAttachmentCheckMessage(result.message)
  }, [customerAttachmentUrl, showToast])

  return {
    committedDraftRowIdRef,
    row,
    loading,
    title,
    setTitle,
    terms,
    setTerms,
    lines,
    setLines,
    estimateOptions,
    setEstimateOptions,
    viewedOptionKey,
    setViewedOptionKey,
    previewSelectedOptionKeys,
    setPreviewSelectedOptionKeys,
    customers,
    setCustomers,
    customersLoading,
    customerId,
    setCustomerId,
    customerSearch,
    setCustomerSearch,
    sendEmailOverride,
    setSendEmailOverride,
    validUntil,
    setValidUntil,
    validUntilPreset,
    setValidUntilPreset,
    forAddress,
    setForAddress,
    linkedProjectId,
    setLinkedProjectId,
    projectsForPicker,
    internalNotes,
    setInternalNotes,
    customerAttachmentUrl,
    setCustomerAttachmentUrl,
    customerAttachmentLabel,
    setCustomerAttachmentLabel,
    attachmentCheckStatus,
    attachmentCheckMessage,
    acceptHeaderBrand,
    setAcceptHeaderBrand,
    acceptorSignatureSignedUrl,
    saving,
    sending,
    setSending,
    lastAcceptUrl,
    setLastAcceptUrl,
    appCxSettings,
    catalogLineItems,
    estimateCustomerEvents,
    estimateCustomerEventsLoading,
    cxOverrideFields,
    setCxOverrideFields,
    acceptNotifyUserIds,
    setAcceptNotifyUserIds,
    notifyUserOptions,
    acceptNotifyResolvedUsers,
    loadCatalogFromDb,
    loadEstimateCustomerEvents,
    load,
    refetchCustomersAfterEdit,
    isDraft,
    isCO,
    coFields,
    setCoFields,
    totalCents,
    unfinishedDateStopsSending,
    saveDraft,
    draftAutosave,
    checkCustomerAttachmentUrl,
  }
}
