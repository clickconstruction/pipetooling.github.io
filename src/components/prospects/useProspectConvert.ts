import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { NewCustomerFormPayload } from '../NewCustomerForm'
import { supabase } from '../../lib/supabase'
import { searchConvertProspects, suggestRecentlyAnswered } from '../../lib/prospects/convertProspectSearch'
import { convertBidRows, convertContactRows, markProspectConverted, recordProspectConverted } from '../../lib/prospects/prospectConversion'
import type { ProspectLastCall } from '../../lib/prospects/prospectListGrouping'
import type { Prospect } from '../../lib/prospects/prospectRow'
import { localCalendarDayKey } from '../../utils/dateUtils'
import { formatErrorMessage } from '../../utils/errorHandling'

/**
 * The Convert tab's engine (the Customers lane): who is being converted, the contact and bid cards, the three
 * reads the form needs, and the submit that makes the customer, its people and its first bids, then marks the
 * prospect. Moved out of `src/pages/Prospects.tsx` unchanged.
 *
 * The page calls this hook and `ProspectsConvertTab` draws its value. The state lives with the page on purpose:
 * the tab unmounts when the caller looks at another tab, and the picked prospect and the typed cards are still
 * there on the way back.
 */
export function useProspectConvert({
  active,
  prospectListProspects,
  followUpProspects,
  prospectLastCallMap,
  authUserId,
  authRole,
  onConverted,
}: {
  /** The Convert tab is the one on screen: its service types load then. */
  active: boolean
  prospectListProspects: Prospect[]
  followUpProspects: Prospect[]
  prospectLastCallMap: Record<string, ProspectLastCall>
  authUserId: string | null
  authRole: string | null
  /** The prospect was marked converted: the page patches its caches. */
  onConverted: (prospectId: string) => void
}) {
  const navigate = useNavigate()
  const [convertProspectId, setConvertProspectId] = useState<string | null>(null)
  const [convertSearchQuery, setConvertSearchQuery] = useState('')
  const [convertContactPersons, setConvertContactPersons] = useState<{ name: string; phone: string; email: string; note: string }[]>([{ name: '', phone: '', email: '', note: '' }])
  const [convertBids, setConvertBids] = useState<{ project_name: string; service_type_id: string }[]>([{ project_name: '', service_type_id: '' }])
  const [convertServiceTypes, setConvertServiceTypes] = useState<{ id: string; name: string }[]>([])
  const [convertSaving, setConvertSaving] = useState(false)
  const [convertError, setConvertError] = useState<string | null>(null)
  const [convertFirstInteractionDate, setConvertFirstInteractionDate] = useState<string>('')


  // The Convert tab starts on its search (v2.2879, J34-F6): it used to
  // pre-select the Follow Up queue head, which hid the tab's own
  // "recently answered" suggestions and put a never-called company under
  // "Who are you converting?".

  // Load first interaction date for Convert (earliest prospect_comment)
  useEffect(() => {
    if (!convertProspectId) {
      setConvertFirstInteractionDate('')
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const { data } = await supabase
          .from('prospect_comments')
          .select('created_at')
          .eq('prospect_id', convertProspectId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()
        if (cancelled) return
        if (data?.created_at) {
          const d = new Date(data.created_at)
          setConvertFirstInteractionDate(localCalendarDayKey(d))
        } else {
          setConvertFirstInteractionDate('')
        }
      } catch {
        if (!cancelled) setConvertFirstInteractionDate('')
      }
    })()
    return () => { cancelled = true }
  }, [convertProspectId])

  // Load service types when Convert tab is active
  useEffect(() => {
    if (!active) return
    supabase
      .from('service_types' as any)
      .select('id, name')
      .eq('billing_only', false)
      .order('sequence_order', { ascending: true })
      .then(({ data }) => setConvertServiceTypes((data as unknown as { id: string; name: string }[]) ?? []))
  }, [active])

  // Pre-fill first contact person when prospect changes
  const convertProspect = prospectListProspects.find((p) => p.id === convertProspectId) ?? followUpProspects.find((p) => p.id === convertProspectId)
  const convertPickerPool = [...prospectListProspects, ...followUpProspects.filter((p) => !prospectListProspects.some((lp) => lp.id === p.id))]
  const convertSearchResults = searchConvertProspects(convertPickerPool, convertSearchQuery)
  const convertSuggestions = suggestRecentlyAnswered(convertPickerPool, prospectLastCallMap, Date.now())

  function pickConvertProspect(p: Prospect) {
    setConvertProspectId(p.id)
    setConvertSearchQuery('')
  }
  useEffect(() => {
    if (!convertProspect) return
    setConvertContactPersons((prev) => {
      const first = prev[0]
      return [{ name: convertProspect.contact_name ?? '', phone: convertProspect.phone_number ?? '', email: first?.email ?? '', note: first?.note ?? '' }, ...prev.slice(1)]
    })
  }, [convertProspectId, convertProspect?.id])

  async function handleConvertSubmit(payload: NewCustomerFormPayload) {
    if (!authUserId || convertSaving) return
    setConvertSaving(true)
    setConvertError(null)
    try {
      const { data: customer, error: custErr } = await supabase.from('customers').insert(payload).select().single()
      if (custErr) throw new Error(custErr.message)
      if (!customer) throw new Error('Failed to create customer')
      const customerId = (customer as { id: string }).id

      for (const row of convertContactRows(convertContactPersons, customerId)) {
        const { error: cpErr } = await supabase.from('customer_contact_persons').insert(row)
        if (cpErr) throw new Error(`Failed to add contact: ${cpErr.message}`)
      }

      for (const row of convertBidRows(convertBids, customerId, authUserId)) {
        const { error: bidErr } = await supabase.from('bids').insert(row)
        if (bidErr) throw new Error(`Failed to add bid: ${bidErr.message}`)
      }

      // Mark the source prospect converted so it leaves the calling queue
      // (shared tail with Add customer and Follow Up). The customer already
      // exists at this point, so a failure here must not block navigation.
      if (convertProspectId) {
        const marked = await markProspectConverted(convertProspectId, customerId, payload.name, authUserId)
        if (!marked.ok) {
          console.error('[Prospects] failed to mark prospect converted:', marked.error)
        } else {
          recordProspectConverted(authUserId, authRole, 'convert-tab')
          onConverted(convertProspectId)
        }
      }

      navigate(`/customers/${customerId}`)
    } catch (err) {
      setConvertError(formatErrorMessage(err, 'Failed to convert'))
      throw err
    } finally {
      setConvertSaving(false)
    }
  }

  return {
    convertProspectId,
    convertSearchQuery,
    setConvertSearchQuery,
    convertContactPersons,
    setConvertContactPersons,
    convertBids,
    setConvertBids,
    convertServiceTypes,
    convertSaving,
    convertError,
    convertFirstInteractionDate,
    convertProspect,
    convertPickerPool,
    convertSearchResults,
    convertSuggestions,
    pickConvertProspect,
    handleConvertSubmit,
  }
}

export type ProspectConvert = ReturnType<typeof useProspectConvert>
