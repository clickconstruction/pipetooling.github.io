import { Fragment, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatCurrency } from '../lib/format'
import { SupplyHouseForm } from './SupplyHouseForm'
import type { Database } from '../types/database'

type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']
type SupplyHouseInvoice = Database['public']['Tables']['supply_house_invoices']['Row']
type InvoiceJobAllocation = { job_id: string; pct: number }
type SupplyHouseInvoiceWithAllocations = SupplyHouseInvoice & { job_allocations?: InvoiceJobAllocation[] }
type MaterialPart = Database['public']['Tables']['material_parts']['Row']
type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row']
type PurchaseOrderItem = Database['public']['Tables']['purchase_order_items']['Row']
type UserRole = 'dev' | 'master_technician' | 'assistant' | 'estimator' | 'primary'

type POItemWithDetails = PurchaseOrderItem & {
  part: MaterialPart
  supply_house?: SupplyHouse
  source_template?: { id: string; name: string } | null
}
type PurchaseOrderWithItems = PurchaseOrder & { items: POItemWithDetails[] }

type SupplyHouseSummaryRow = { supply_house_id: string; name: string; outstanding: number; monthlyPaymentDay: number | null }

interface SupplyHousesTabProps {
  supplyHouses?: SupplyHouse[]
  onSupplyHousesChange?: () => void | Promise<void>
  myRole?: UserRole | null
  showTitle?: boolean
  selectedServiceTypeId?: string
  onNavigateToPO?: (poId: string) => void
}

export function SupplyHousesTab({
  supplyHouses: supplyHousesProp,
  onSupplyHousesChange,
  myRole: myRoleProp,
  showTitle = false,
  selectedServiceTypeId: selectedServiceTypeIdProp,
  onNavigateToPO,
}: SupplyHousesTabProps) {
  const navigate = useNavigate()
  const { user: authUser, role: authRole } = useAuth()
  const myRole = myRoleProp ?? (authRole as UserRole | null) ?? null

  const [supplyHousesInternal, setSupplyHousesState] = useState<SupplyHouse[]>(supplyHousesProp ?? [])
  const supplyHousesList = supplyHousesProp ?? supplyHousesInternal

  const [error, setError] = useState<string | null>(null)
  const [supplyHouseFormOpen, setSupplyHouseFormOpen] = useState(false)
  const [editingSupplyHouse, setEditingSupplyHouse] = useState<SupplyHouse | null>(null)
  const [supplyHouseName, setSupplyHouseName] = useState('')
  const [supplyHouseContactName, setSupplyHouseContactName] = useState('')
  const [supplyHousePhone, setSupplyHousePhone] = useState('')
  const [supplyHouseEmail, setSupplyHouseEmail] = useState('')
  const [supplyHouseAddress, setSupplyHouseAddress] = useState('')
  const [supplyHouseNotes, setSupplyHouseNotes] = useState('')
  const [supplyHouseMonthlyPaymentDay, setSupplyHouseMonthlyPaymentDay] = useState('')
  const [savingSupplyHouse, setSavingSupplyHouse] = useState(false)

  const [supplyHouseSummary, setSupplyHouseSummary] = useState<SupplyHouseSummaryRow[]>([])
  const [supplyHouseSummaryLoading, setSupplyHouseSummaryLoading] = useState(false)
  const [selectedSupplyHouseForDetail, setSelectedSupplyHouseForDetail] = useState<SupplyHouse | null>(null)
  const [supplyHouseInvoices, setSupplyHouseInvoices] = useState<SupplyHouseInvoiceWithAllocations[]>([])
  const [supplyHousePOs, setSupplyHousePOs] = useState<PurchaseOrderWithItems[]>([])
  const [supplyHouseDetailLoading, setSupplyHouseDetailLoading] = useState(false)
  const [invoiceFormOpen, setInvoiceFormOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<SupplyHouseInvoice | null>(null)
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [invoiceDueDate, setInvoiceDueDate] = useState('')
  const [invoiceAmount, setInvoiceAmount] = useState('')
  const [invoicePurchaseOrderNumber, setInvoicePurchaseOrderNumber] = useState('')
  const [invoiceLink, setInvoiceLink] = useState('')
  const [invoiceIsPaid, setInvoiceIsPaid] = useState(false)
  const [invoiceJobAllocations, setInvoiceJobAllocations] = useState<InvoiceJobAllocation[]>([])
  const [invoiceJobSearchModal, setInvoiceJobSearchModal] = useState(false)
  const [invoiceJobSearchText, setInvoiceJobSearchText] = useState('')
  const [invoiceJobSearchResults, setInvoiceJobSearchResults] = useState<Array<{ id: string; hcp_number: string; job_name: string; job_address: string }>>([])
  const [invoiceJobDetailsMap, setInvoiceJobDetailsMap] = useState<Record<string, { hcp_number: string; job_name: string; job_address: string }>>({})
  const [supplyHouseJobDetailsMap, setSupplyHouseJobDetailsMap] = useState<Record<string, { hcp_number: string; job_name: string }>>({})
  const [savingInvoice, setSavingInvoice] = useState(false)
  const [applyPaymentFormOpen, setApplyPaymentFormOpen] = useState(false)
  const [applyPaymentLink, setApplyPaymentLink] = useState('')
  const [applyPaymentSelectedIds, setApplyPaymentSelectedIds] = useState<Set<string>>(new Set())
  const [applyPaymentShowAll, setApplyPaymentShowAll] = useState(false)
  const [savingApplyPayment, setSavingApplyPayment] = useState(false)
  const [creatingPOForSupplyHouse, setCreatingPOForSupplyHouse] = useState(false)
  const [firstServiceTypeId, setFirstServiceTypeId] = useState<string | null>(null)
  const [showPaidInvoices, setShowPaidInvoices] = useState(false)

  const serviceTypeId = selectedServiceTypeIdProp ?? firstServiceTypeId

  async function loadSupplyHousesInternal() {
    const { data, error: err } = await supabase.from('supply_houses').select('*').order('name')
    if (err) {
      const fallback = await supabase.from('supply_houses').select('id, name, contact_name, phone, email, address, notes, created_at, updated_at').order('name')
      if (fallback.error) setError(`Failed to load supply houses: ${err.message}`)
      else setSupplyHousesState((fallback.data ?? []).map((h) => ({ ...h, monthly_payment_day: null })) as SupplyHouse[])
    } else {
      setSupplyHousesState((data as SupplyHouse[]) ?? [])
    }
  }

  async function loadSupplyHouses() {
    if (supplyHousesProp) {
      await onSupplyHousesChange?.()
    } else {
      await loadSupplyHousesInternal()
    }
  }

  async function loadFirstServiceType() {
    const { data } = await supabase.from('service_types').select('id').order('sequence_order', { ascending: true }).limit(1)
    const first = (data as { id: string }[] | null)?.[0]
    setFirstServiceTypeId(first?.id ?? null)
  }

  function formatOrdinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'] as const
    const v = n % 100
    const ord = v >= 11 && v <= 13 ? 'th' : (s[v % 10] ?? 'th')
    return n + ord
  }

  async function loadSupplyHouseSummary() {
    setSupplyHouseSummaryLoading(true)
    let housesList: { id: string; name: string; monthly_payment_day: number | null }[]
    const housesRes = await supabase.from('supply_houses').select('id, name, monthly_payment_day').order('name')
    if (housesRes.error) {
      const fallbackRes = await supabase.from('supply_houses').select('id, name').order('name')
      const fallback = (fallbackRes.data ?? []) as { id: string; name: string }[]
      housesList = fallback.map((h) => ({ ...h, monthly_payment_day: null }))
    } else {
      housesList = (housesRes.data ?? []) as { id: string; name: string; monthly_payment_day: number | null }[]
    }
    const { data: invoices } = await supabase
      .from('supply_house_invoices')
      .select('supply_house_id, amount, is_paid')
    const invoicesList = (invoices ?? []) as { supply_house_id: string; amount: number; is_paid: boolean }[]
    const byHouse = new Map<string, number>()
    for (const h of housesList) byHouse.set(h.id, 0)
    for (const inv of invoicesList) {
      if (inv.is_paid) continue
      const cur = byHouse.get(inv.supply_house_id)
      if (cur !== undefined) byHouse.set(inv.supply_house_id, cur + inv.amount)
    }
    const rows: SupplyHouseSummaryRow[] = housesList.map((h) => ({
      supply_house_id: h.id,
      name: h.name,
      outstanding: byHouse.get(h.id) ?? 0,
      monthlyPaymentDay: h.monthly_payment_day,
    }))
    rows.sort((a, b) => b.outstanding - a.outstanding)
    setSupplyHouseSummary(rows)
    setSupplyHouseSummaryLoading(false)
  }

  async function loadSupplyHouseDetail(sh: SupplyHouse) {
    setSupplyHouseDetailLoading(true)
    const shRes = await supabase.from('supply_houses').select('*').eq('id', sh.id).single()
    const shData = shRes.error
      ? (await supabase.from('supply_houses').select('id, name, contact_name, phone, email, address, notes, created_at, updated_at').eq('id', sh.id).single()).data
      : shRes.data
    setSelectedSupplyHouseForDetail((shData as SupplyHouse) ?? sh)
    const [invRes, poRes, allocRes] = await Promise.all([
      supabase.from('supply_house_invoices').select('*').eq('supply_house_id', sh.id).order('invoice_date', { ascending: false }),
      supabase.from('purchase_orders').select('*').eq('supply_house_id', sh.id).order('created_at', { ascending: false }),
      supabase.from('supply_house_invoice_job_allocations').select('invoice_id, job_id, pct'),
    ])
    const invoices = (invRes.data as SupplyHouseInvoice[]) ?? []
    const allocations = (allocRes.data as { invoice_id: string; job_id: string; pct: number }[]) ?? []
    const byInvoice = new Map<string, InvoiceJobAllocation[]>()
    for (const a of allocations) {
      const list = byInvoice.get(a.invoice_id) ?? []
      list.push({ job_id: a.job_id, pct: Number(a.pct) })
      byInvoice.set(a.invoice_id, list)
    }
    const invoicesWithAllocations: SupplyHouseInvoiceWithAllocations[] = invoices.map((inv) => ({
      ...inv,
      job_allocations: byInvoice.get(inv.id) ?? [],
    }))
    setSupplyHouseInvoices(invoicesWithAllocations)
    const jobIds = [...new Set(allocations.map((a) => a.job_id))]
    if (jobIds.length > 0) {
      supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: jobIds }).then(({ data }) => {
        const map: Record<string, { hcp_number: string; job_name: string }> = {}
        for (const r of (data ?? []) as { id: string; hcp_number: string; job_name: string }[]) {
          map[r.id] = { hcp_number: r.hcp_number ?? '', job_name: r.job_name ?? '' }
        }
        setSupplyHouseJobDetailsMap(map)
      })
    } else {
      setSupplyHouseJobDetailsMap({})
    }
    const pos = (poRes.data as PurchaseOrder[]) ?? []
    const posWithItems: PurchaseOrderWithItems[] = await Promise.all(
      pos.map(async (po) => {
        const { data: itemsData } = await supabase
          .from('purchase_order_items')
          .select('*, material_parts(*), supply_houses(*), source_template:material_templates!source_template_id(id, name)')
          .eq('purchase_order_id', po.id)
          .order('sequence_order', { ascending: true })
        const items = (itemsData as unknown as (PurchaseOrderItem & { material_parts: MaterialPart; supply_houses: SupplyHouse | null; source_template?: { id: string; name: string } | null })[]) ?? []
        const itemsWithDetails: POItemWithDetails[] = items.map((item) => ({
          ...item,
          part: item.material_parts,
          supply_house: item.supply_houses ?? undefined,
          source_template: item.source_template ?? null,
        }))
        return { ...po, items: itemsWithDetails }
      })
    )
    setSupplyHousePOs(posWithItems)
    setSupplyHouseDetailLoading(false)
  }

  useEffect(() => {
    if (!selectedServiceTypeIdProp) loadFirstServiceType()
  }, [selectedServiceTypeIdProp])

  useEffect(() => {
    loadSupplyHouseSummary()
    if (!supplyHousesProp) loadSupplyHousesInternal()
  }, [])

  useEffect(() => {
    if (supplyHousesProp) setSupplyHousesState(supplyHousesProp)
  }, [supplyHousesProp])

  useEffect(() => {
    const t = setTimeout(() => {
      if (invoiceJobSearchModal && invoiceJobSearchText !== undefined) {
        supabase.rpc('search_jobs_ledger', { search_text: invoiceJobSearchText }).then(({ data }) => {
          setInvoiceJobSearchResults((data ?? []) as Array<{ id: string; hcp_number: string; job_name: string; job_address: string }>)
        })
      }
    }, 300)
    return () => clearTimeout(t)
  }, [invoiceJobSearchModal, invoiceJobSearchText])

  useEffect(() => {
    const jobIds = invoiceJobAllocations.map((a) => a.job_id).filter((id) => !invoiceJobDetailsMap[id])
    if (jobIds.length === 0) return
    supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: jobIds }).then(({ data }) => {
      const map: Record<string, { hcp_number: string; job_name: string; job_address: string }> = {}
      for (const r of (data ?? []) as { id: string; hcp_number: string; job_name: string; job_address: string }[]) {
        map[r.id] = { hcp_number: r.hcp_number ?? '', job_name: r.job_name ?? '', job_address: r.job_address ?? '' }
      }
      setInvoiceJobDetailsMap((prev) => ({ ...prev, ...map }))
    })
  }, [invoiceJobAllocations, invoiceJobDetailsMap])

  const canAccess = myRole === 'dev' || myRole === 'master_technician' || myRole === 'assistant'
  if (!canAccess) return null

  function closeSupplyHouseForm() {
    setSupplyHouseFormOpen(false)
    setEditingSupplyHouse(null)
  }

  function handleSupplyHouseChange(field: string, value: string) {
    switch (field) {
      case 'name': setSupplyHouseName(value); break
      case 'contact_name': setSupplyHouseContactName(value); break
      case 'phone': setSupplyHousePhone(value); break
      case 'email': setSupplyHouseEmail(value); break
      case 'address': setSupplyHouseAddress(value); break
      case 'notes': setSupplyHouseNotes(value); break
      case 'monthly_payment_day': setSupplyHouseMonthlyPaymentDay(value); break
    }
  }

  async function handleSupplyHouseSubmit(data: { name: string; contact_name: string; phone: string; email: string; address: string; notes: string; monthly_payment_day: number | null }) {
    if (!data.name.trim()) {
      setError('Supply house name is required')
      return
    }
    setSavingSupplyHouse(true)
    setError(null)

    if (editingSupplyHouse) {
      const { error: e } = await supabase
        .from('supply_houses')
        .update({
          name: data.name.trim(),
          contact_name: data.contact_name.trim() || null,
          phone: data.phone.trim() || null,
          email: data.email.trim() || null,
          address: data.address.trim() || null,
          notes: data.notes.trim() || null,
          monthly_payment_day: data.monthly_payment_day,
        })
        .eq('id', editingSupplyHouse.id)
      if (e) setError(e.message)
      else {
        await Promise.all([loadSupplyHouses(), loadSupplyHouseSummary()])
        if (selectedSupplyHouseForDetail?.id === editingSupplyHouse.id) await loadSupplyHouseDetail(editingSupplyHouse)
        closeSupplyHouseForm()
      }
    } else {
      const { error: e } = await supabase
        .from('supply_houses')
        .insert({
          name: data.name.trim(),
          contact_name: data.contact_name.trim() || null,
          phone: data.phone.trim() || null,
          email: data.email.trim() || null,
          address: data.address.trim() || null,
          notes: data.notes.trim() || null,
          monthly_payment_day: data.monthly_payment_day,
        })
      if (e) setError(e.message)
      else {
        await Promise.all([loadSupplyHouses(), loadSupplyHouseSummary()])
        closeSupplyHouseForm()
      }
    }
    setSavingSupplyHouse(false)
  }

  async function handleDeleteSupplyHouse(supplyHouseId: string) {
    const { data: prices } = await supabase
      .from('material_part_prices')
      .select('id')
      .eq('supply_house_id', supplyHouseId)
      .limit(1)
    const hasPrices = prices && prices.length > 0
    const message = hasPrices
      ? 'Delete this supply house? All prices associated with it will also be removed.'
      : 'Delete this supply house?'
    if (!confirm(message)) return
    setError(null)
    const { error } = await supabase.from('supply_houses').delete().eq('id', supplyHouseId)
    if (error) setError(error.message)
    else {
      await Promise.all([loadSupplyHouses(), loadSupplyHouseSummary()])
      closeSupplyHouseForm()
    }
  }

  function openAddSupplyHouse() {
    setEditingSupplyHouse(null)
    setSupplyHouseName('')
    setSupplyHouseContactName('')
    setSupplyHousePhone('')
    setSupplyHouseEmail('')
    setSupplyHouseAddress('')
    setSupplyHouseNotes('')
    setSupplyHouseMonthlyPaymentDay('')
    setSupplyHouseFormOpen(true)
    setError(null)
  }

  function handleOpenEditSupplyHouse(sh: SupplyHouse) {
    setEditingSupplyHouse(sh)
    setSupplyHouseName(sh.name)
    setSupplyHouseContactName(sh.contact_name ?? '')
    setSupplyHousePhone(sh.phone ?? '')
    setSupplyHouseEmail(sh.email ?? '')
    setSupplyHouseAddress(sh.address ?? '')
    setSupplyHouseNotes(sh.notes ?? '')
    setSupplyHouseMonthlyPaymentDay(sh.monthly_payment_day != null ? String(sh.monthly_payment_day) : '')
    setSupplyHouseFormOpen(true)
  }

  function handleNavigateToPO(poId: string) {
    if (onNavigateToPO) {
      onNavigateToPO(poId)
    } else {
      navigate('/materials', { state: { openPOId: poId } })
    }
  }

  async function createBlankPOForSupplyHouse(supplyHouseId: string) {
    if (!authUser?.id || !serviceTypeId) return
    setCreatingPOForSupplyHouse(true)
    setError(null)
    const sh = supplyHousesList.find((s: SupplyHouse) => s.id === supplyHouseId)
    const currentDate = new Date().toLocaleDateString()
    const { data: poData, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        name: `PO: ${sh?.name ?? 'Supply House'} [${currentDate}]`,
        status: 'draft',
        created_by: authUser.id,
        notes: null,
        service_type_id: serviceTypeId,
        supply_house_id: supplyHouseId,
      })
      .select('id')
      .single()
    setCreatingPOForSupplyHouse(false)
    if (poError) {
      setError(`Failed to create PO: ${poError.message}`)
      return
    }
    await loadSupplyHouseDetail(sh!)
    if (poData?.id) handleNavigateToPO(poData.id)
  }

  function openAddInvoice() {
    setEditingInvoice(null)
    setInvoiceNumber('')
    setInvoiceDate(new Date().toLocaleDateString('en-CA'))
    setInvoiceDueDate('')
    setInvoiceAmount('')
    setInvoiceLink('')
    setInvoiceIsPaid(false)
    setInvoicePurchaseOrderNumber('')
    setInvoiceJobAllocations([])
    setInvoiceFormOpen(true)
  }

  function openEditInvoice(inv: SupplyHouseInvoice | SupplyHouseInvoiceWithAllocations) {
    setEditingInvoice(inv)
    setInvoiceNumber(inv.invoice_number)
    setInvoiceDate(inv.invoice_date)
    setInvoiceDueDate(inv.due_date ?? '')
    setInvoiceAmount(inv.amount.toString())
    setInvoiceLink(inv.link ?? '')
    setInvoiceIsPaid(inv.is_paid)
    setInvoicePurchaseOrderNumber(inv.purchase_order_number ?? '')
    setInvoiceJobAllocations((inv as SupplyHouseInvoiceWithAllocations).job_allocations ?? [])
    setInvoiceFormOpen(true)
  }

  function closeInvoiceForm() {
    setInvoiceFormOpen(false)
    setEditingInvoice(null)
  }

  function openApplyPaymentForm() {
    setApplyPaymentLink('')
    setApplyPaymentSelectedIds(new Set())
    setApplyPaymentShowAll(false)
    setApplyPaymentFormOpen(true)
  }

  function closeApplyPaymentForm() {
    setApplyPaymentFormOpen(false)
    setApplyPaymentLink('')
    setApplyPaymentSelectedIds(new Set())
    setApplyPaymentShowAll(false)
  }

  async function applyPayment(e: React.FormEvent) {
    e.preventDefault()
    const ids = Array.from(applyPaymentSelectedIds)
    if (ids.length === 0) return
    setSavingApplyPayment(true)
    const linkValue = applyPaymentLink.trim() || null
    const { error } = await supabase
      .from('supply_house_invoices')
      .update({ is_paid: true, link: linkValue })
      .in('id', ids)
    if (!error && selectedSupplyHouseForDetail) {
      await loadSupplyHouseDetail(selectedSupplyHouseForDetail)
      await loadSupplyHouseSummary()
      closeApplyPaymentForm()
    }
    setSavingApplyPayment(false)
  }

  async function saveInvoice(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedSupplyHouseForDetail || !invoiceNumber.trim() || !invoiceDate) return
    const amt = parseFloat(invoiceAmount)
    if (isNaN(amt) || amt < 0) {
      setError('Amount must be a non-negative number')
      return
    }
    setSavingInvoice(true)
    setError(null)
    const payload = {
      supply_house_id: selectedSupplyHouseForDetail.id,
      invoice_number: invoiceNumber.trim(),
      invoice_date: invoiceDate,
      due_date: invoiceDueDate.trim() || null,
      amount: amt,
      link: invoiceLink.trim() || null,
      is_paid: invoiceIsPaid,
      purchase_order_number: invoicePurchaseOrderNumber.trim() || null,
    }
    let invoiceId: string | null = null
    if (editingInvoice) {
      const { error: err } = await supabase.from('supply_house_invoices').update(payload).eq('id', editingInvoice.id)
      if (err) {
        setError(err.message)
        setSavingInvoice(false)
        return
      }
      invoiceId = editingInvoice.id
    } else {
      const { data: inserted, error: err } = await supabase.from('supply_house_invoices').insert(payload).select('id').single()
      if (err) {
        setError(err.message)
        setSavingInvoice(false)
        return
      }
      invoiceId = (inserted as { id: string })?.id ?? null
    }
    if (invoiceId && invoiceJobAllocations.length > 0) {
      await supabase.from('supply_house_invoice_job_allocations').delete().eq('invoice_id', invoiceId)
      const toInsert = invoiceJobAllocations.filter((a) => a.job_id && Number(a.pct) > 0).map((a) => ({
        invoice_id: invoiceId!,
        job_id: a.job_id,
        pct: Number(a.pct),
      }))
      if (toInsert.length > 0) {
        const { error: allocErr } = await supabase.from('supply_house_invoice_job_allocations').insert(toInsert)
        if (allocErr) setError(allocErr.message)
      }
    } else if (invoiceId && editingInvoice) {
      await supabase.from('supply_house_invoice_job_allocations').delete().eq('invoice_id', invoiceId)
    }
    if (selectedSupplyHouseForDetail) {
      await loadSupplyHouseDetail(selectedSupplyHouseForDetail)
      await loadSupplyHouseSummary()
      closeInvoiceForm()
    }
    setSavingInvoice(false)
  }

  async function toggleInvoicePaid(inv: SupplyHouseInvoice) {
    const { error } = await supabase
      .from('supply_house_invoices')
      .update({ is_paid: !inv.is_paid })
      .eq('id', inv.id)
    if (!error && selectedSupplyHouseForDetail) {
      await loadSupplyHouseDetail(selectedSupplyHouseForDetail)
      await loadSupplyHouseSummary()
    }
  }

  async function deleteInvoice(inv: SupplyHouseInvoice) {
    if (!confirm('Delete this invoice?')) return
    const { error } = await supabase.from('supply_house_invoices').delete().eq('id', inv.id)
    if (!error && selectedSupplyHouseForDetail) {
      await loadSupplyHouseDetail(selectedSupplyHouseForDetail)
      await loadSupplyHouseSummary()
      closeInvoiceForm()
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        {showTitle && (
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0, textAlign: 'center', flex: 1 }}>
            Materials Supply Houses & External Subs
          </h2>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', marginLeft: showTitle ? 0 : 'auto' }}>
          <input
            type="checkbox"
            checked={showPaidInvoices}
            onChange={(e) => setShowPaidInvoices(e.target.checked)}
          />
          Show paid invoices
        </label>
      </div>
      {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}

      <section style={{ marginBottom: '2rem' }}>
        {supplyHouseSummaryLoading ? (
          <p style={{ color: '#6b7280' }}>Loading…</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ marginBottom: '0.75rem', fontSize: '1rem', fontWeight: 600, textAlign: 'center' }}>
              Supply Houses: ${formatCurrency(supplyHouseSummary.reduce((sum, row) => sum + row.outstanding, 0))}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Supply House</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Outstanding</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Due</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {supplyHouseSummary.map((row) => {
                  const sh = supplyHousesList.find((s: SupplyHouse) => s.id === row.supply_house_id)
                  const isExpanded = selectedSupplyHouseForDetail?.id === row.supply_house_id
                  return (
                    <Fragment key={row.supply_house_id}>
                      <tr
                        onClick={() => {
                          if (!sh) return
                          if (isExpanded) setSelectedSupplyHouseForDetail(null)
                          else loadSupplyHouseDetail(sh)
                        }}
                        style={{
                          borderBottom: '1px solid #e5e7eb',
                          cursor: 'pointer',
                          background: isExpanded ? '#f0f9ff' : undefined,
                        }}
                      >
                        <td style={{ padding: '0.75rem', fontWeight: 500 }}>{row.name}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: row.outstanding > 0 ? 600 : 400 }}>
                          ${formatCurrency(row.outstanding)}
                        </td>
                        <td style={{ padding: '0.75rem', color: '#6b7280' }}>
                          {row.monthlyPaymentDay ? formatOrdinal(row.monthlyPaymentDay) : '—'}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                          {isExpanded && selectedSupplyHouseForDetail && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleOpenEditSupplyHouse(selectedSupplyHouseForDetail)
                              }}
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                      {isExpanded && selectedSupplyHouseForDetail && (
                        <tr>
                          <td colSpan={4} style={{ padding: 0, verticalAlign: 'top', borderBottom: '1px solid #e5e7eb' }}>
                            <div style={{ padding: '1rem 1.5rem', background: '#f9fafb', borderLeft: '3px solid #3b82f6' }}>
                              {supplyHouseDetailLoading ? (
                                <p>Loading…</p>
                              ) : (
                                <>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                                    {selectedSupplyHouseForDetail.address && (
                                      <div><strong>Address:</strong> {selectedSupplyHouseForDetail.address}</div>
                                    )}
                                    {selectedSupplyHouseForDetail.phone && (
                                      <div><strong>Phone:</strong> {selectedSupplyHouseForDetail.phone}</div>
                                    )}
                                    {selectedSupplyHouseForDetail.email && (
                                      <div><strong>Email:</strong> {selectedSupplyHouseForDetail.email}</div>
                                    )}
                                    {selectedSupplyHouseForDetail.contact_name && (
                                      <div><strong>Contact:</strong> {selectedSupplyHouseForDetail.contact_name}</div>
                                    )}
                                  </div>
                                  <section style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                      <h3 style={{ margin: 0, fontSize: '1rem' }}>Invoices</h3>
                                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); openAddInvoice() }}
                                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                        >
                                          Add Invoice
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); openApplyPaymentForm() }}
                                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                        >
                                          Make Payment
                                        </button>
                                      </div>
                                    </div>
                                    <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                        <thead style={{ background: '#f9fafb' }}>
                                          <tr>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Invoice #</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Purchase Order #</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Date</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Due</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Amount</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Jobs</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Paid</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Link</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Actions</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(() => {
                                            const invoicesToShow = showPaidInvoices
                                              ? supplyHouseInvoices
                                              : supplyHouseInvoices.filter((inv) => !inv.is_paid)
                                            return invoicesToShow.length === 0 ? (
                                              <tr><td colSpan={9} style={{ padding: '1rem', color: '#6b7280', textAlign: 'center' }}>No invoices</td></tr>
                                            ) : (
                                              invoicesToShow.map((inv) => (
                                              <tr key={inv.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>{inv.invoice_number}</td>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>{inv.purchase_order_number ?? '—'}</td>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>{new Date(inv.invoice_date).toLocaleDateString()}</td>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</td>
                                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${formatCurrency(inv.amount)}</td>
                                                <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}>
                                                  {inv.job_allocations && inv.job_allocations.length > 0
                                                    ? inv.job_allocations
                                                        .map((a) => {
                                                          const d = supplyHouseJobDetailsMap[a.job_id]
                                                          return d ? `${d.hcp_number} · ${d.job_name} (${a.pct}%)` : a.job_id.slice(0, 8)
                                                        })
                                                        .join(', ')
                                                    : '—'}
                                                </td>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                                  <input
                                                    type="checkbox"
                                                    checked={inv.is_paid}
                                                    onChange={() => toggleInvoicePaid(inv)}
                                                  />
                                                </td>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                                  {inv.link ? (
                                                    <a href={inv.link} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>View</a>
                                                  ) : (
                                                    '—'
                                                  )}
                                                </td>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                                  <button type="button" onClick={(e) => { e.stopPropagation(); openEditInvoice(inv) }} title="Edit" aria-label="Edit" style={{ padding: '0.25rem', cursor: 'pointer', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width={16} height={16} fill="currentColor" aria-hidden="true">
                                                      <path d="M362.7 19.3L314.3 67.7 444.3 197.7 492.7 149.3c25-25 25-65.5 0-90.5L453.3 19.3c-25-25-65.5-25-90.5 0zm-71 71L58.6 323.5c-10.4 10.4-18.3 23.3-22.2 37.4L1 481.2C-1.5 489.7 .8 498.8 7 505s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4 27-11.8 37.4-22.2L421.7 220.3 291.7 90.3z" />
                                                    </svg>
                                                  </button>
                                                </td>
                                              </tr>
                                            ))
                                            )
                                          })()}
                                        </tbody>
                                      </table>
                                    </div>
                                  </section>
                                  <section>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                      <h3 style={{ margin: 0, fontSize: '1rem' }}>Purchase Orders</h3>
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); createBlankPOForSupplyHouse(selectedSupplyHouseForDetail.id) }}
                                        disabled={creatingPOForSupplyHouse || !serviceTypeId}
                                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: creatingPOForSupplyHouse || !serviceTypeId ? 'not-allowed' : 'pointer' }}
                                      >
                                        {creatingPOForSupplyHouse ? 'Creating…' : 'Create PO'}
                                      </button>
                                    </div>
                                    {!serviceTypeId && (
                                      <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                                        {selectedServiceTypeIdProp !== undefined ? 'Select a service type above to create POs.' : 'Loading service types…'}
                                      </p>
                                    )}
                                    <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                        <thead style={{ background: '#f9fafb' }}>
                                          <tr>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Name</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Status</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Actions</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {supplyHousePOs.length === 0 ? (
                                            <tr><td colSpan={3} style={{ padding: '1rem', color: '#6b7280', textAlign: 'center' }}>No purchase orders</td></tr>
                                          ) : (
                                            supplyHousePOs.map((po) => (
                                              <tr key={po.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>{po.name}</td>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>{po.status}</td>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); handleNavigateToPO(po.id) }}
                                                    style={{ marginRight: '0.5rem', padding: '0.2rem 0.5rem', fontSize: '0.8125rem', cursor: 'pointer' }}
                                                  >
                                                    View
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); handleNavigateToPO(po.id) }}
                                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.8125rem', cursor: 'pointer' }}
                                                  >
                                                    Edit
                                                  </button>
                                                </td>
                                              </tr>
                                            ))
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </section>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
        <button
          type="button"
          onClick={openAddSupplyHouse}
          style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          Add Supply House
        </button>
      </div>

      {supplyHouseFormOpen && (
        <SupplyHouseForm
          editingSupplyHouse={editingSupplyHouse}
          name={supplyHouseName}
          contactName={supplyHouseContactName}
          phone={supplyHousePhone}
          email={supplyHouseEmail}
          address={supplyHouseAddress}
          notes={supplyHouseNotes}
          monthlyPaymentDay={supplyHouseMonthlyPaymentDay}
          onChange={handleSupplyHouseChange}
          onSubmit={handleSupplyHouseSubmit}
          onClose={closeSupplyHouseForm}
          onDelete={editingSupplyHouse ? () => handleDeleteSupplyHouse(editingSupplyHouse.id) : undefined}
          saving={savingSupplyHouse}
          myRole={myRole}
          variant="modal"
        />
      )}

      {invoiceFormOpen && selectedSupplyHouseForDetail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 480 }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>{editingInvoice ? 'Edit Invoice' : 'Add Invoice'}</h3>
            <form onSubmit={saveInvoice}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Invoice Number *</label>
                <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Purchase Order #</label>
                <input type="text" value={invoicePurchaseOrderNumber} onChange={(e) => setInvoicePurchaseOrderNumber(e.target.value)} placeholder="e.g. PO-12345" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Invoice Date *</label>
                <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Amount *</label>
                <input type="number" step="0.01" min={0} value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
                  <input type="checkbox" checked={invoiceIsPaid} onChange={(e) => setInvoiceIsPaid(e.target.checked)} />
                  Paid
                </label>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Job allocations</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem' }}>
                  {invoiceJobAllocations.map((a, idx) => {
                    const details = invoiceJobDetailsMap[a.job_id]
                    const label = details ? `${details.hcp_number || '—'} · ${details.job_name || '—'}` : a.job_id.slice(0, 8)
                    return (
                      <span key={a.job_id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.4rem', background: '#f3f4f6', borderRadius: 4, fontSize: '0.8125rem' }}>
                        <span title={details?.job_address}>{label}</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={a.pct}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value) || 0
                            const rest = invoiceJobAllocations.filter((_, i) => i !== idx)
                            const restSum = rest.reduce((s, x) => s + x.pct, 0)
                            const scale = restSum > 0 ? (100 - v) / restSum : 1
                            let newAllocations = invoiceJobAllocations.map((x, i) =>
                              i === idx ? { ...x, pct: v } : { ...x, pct: Math.round(x.pct * scale * 10) / 10 }
                            )
                            const sum = newAllocations.reduce((s, x) => s + x.pct, 0)
                            if (Math.abs(sum - 100) > 0.01 && newAllocations.length > 0) {
                              const lastIdx = newAllocations.length - 1
                              newAllocations = newAllocations.map((x, i) =>
                                i === lastIdx ? { ...x, pct: Math.round((x.pct + (100 - sum)) * 10) / 10 } : x
                              )
                            }
                            setInvoiceJobAllocations(newAllocations)
                          }}
                          style={{ width: 44, padding: '0.15rem', fontSize: '0.875rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                        />
                        %
                        <button
                          type="button"
                          onClick={() => {
                            const rest = invoiceJobAllocations.filter((_, i) => i !== idx)
                            if (rest.length === 0) {
                              setInvoiceJobAllocations([])
                              return
                            }
                            const n = rest.length
                            const pctEach = Math.round((100 / n) * 10) / 10
                            const newAllocations = rest.map((x, i) => ({
                              ...x,
                              pct: i === n - 1 ? Math.round((100 - (n - 1) * pctEach) * 10) / 10 : pctEach,
                            }))
                            setInvoiceJobAllocations(newAllocations)
                          }}
                          style={{ padding: '0.1rem 0.25rem', border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '0.875rem', lineHeight: 1 }}
                          title="Remove job"
                        >
                          ×
                        </button>
                      </span>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setInvoiceJobSearchModal(true)
                      setInvoiceJobSearchText('')
                      setInvoiceJobSearchResults([])
                    }}
                    style={{ padding: '0.2rem 0.5rem', border: '1px dashed #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: '0.875rem' }}
                  >
                    +
                  </button>
                </div>
                {invoiceJobAllocations.length > 0 && (
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    Total: {invoiceJobAllocations.reduce((s, a) => s + a.pct, 0).toFixed(1)}%
                  </div>
                )}
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Due Date</label>
                <input type="date" value={invoiceDueDate} onChange={(e) => setInvoiceDueDate(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Link (URL)</label>
                <input type="url" value={invoiceLink} onChange={(e) => setInvoiceLink(e.target.value)} placeholder="https://..." style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                {editingInvoice ? (
                  <button
                    type="button"
                    onClick={() => deleteInvoice(editingInvoice)}
                    style={{ padding: '0.5rem 1rem', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Delete
                  </button>
                ) : null}
                <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                  <button type="button" onClick={closeInvoiceForm} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" disabled={savingInvoice} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{savingInvoice ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {invoiceJobSearchModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: '90%' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>Add job for invoice</h3>
            <input
              type="search"
              placeholder="Search HCP, job name, address…"
              value={invoiceJobSearchText}
              onChange={(e) => setInvoiceJobSearchText(e.target.value)}
              autoFocus
              style={{ width: '100%', padding: '0.5rem 0.75rem', marginBottom: '1rem', border: '1px solid #d1d5db', borderRadius: 4 }}
            />
            <div style={{ maxHeight: 300, overflow: 'auto' }}>
              {invoiceJobSearchResults.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => {
                    if (invoiceJobAllocations.some((a) => a.job_id === j.id)) {
                      setInvoiceJobSearchModal(false)
                      setInvoiceJobSearchText('')
                      setInvoiceJobSearchResults([])
                      return
                    }
                    const n = invoiceJobAllocations.length + 1
                    const pct = Math.round((100 / n) * 10) / 10
                    const newAllocations = invoiceJobAllocations.map((a) => ({ ...a, pct }))
                    newAllocations.push({ job_id: j.id, pct: 100 - newAllocations.reduce((s, x) => s + x.pct, 0) })
                    setInvoiceJobDetailsMap((prev) => ({ ...prev, [j.id]: { hcp_number: j.hcp_number, job_name: j.job_name, job_address: j.job_address } }))
                    setInvoiceJobAllocations(newAllocations)
                    setInvoiceJobSearchModal(false)
                    setInvoiceJobSearchText('')
                    setInvoiceJobSearchResults([])
                  }}
                  style={{ display: 'block', width: '100%', padding: '0.5rem', textAlign: 'left', border: 'none', borderBottom: '1px solid #e5e7eb', background: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  <div style={{ fontWeight: 500 }}>{j.hcp_number || '—'} · {j.job_name || '—'}</div>
                  {j.job_address && <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>{j.job_address}</div>}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => { setInvoiceJobSearchModal(false); setInvoiceJobSearchText(''); setInvoiceJobSearchResults([]) }} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>Cancel</button>
          </div>
        </div>
      )}

      {applyPaymentFormOpen && selectedSupplyHouseForDetail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 480 }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>Apply Payment</h3>
            <form onSubmit={applyPayment}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Link (optional)</label>
                <input
                  type="text"
                  value={applyPaymentLink}
                  onChange={(e) => setApplyPaymentLink(e.target.value)}
                  placeholder="Payment or receipt link..."
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
                  <input type="checkbox" checked={applyPaymentShowAll} onChange={(e) => setApplyPaymentShowAll(e.target.checked)} />
                  Show all invoices
                </label>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Select invoices to mark as paid</label>
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 4, padding: '0.5rem' }}>
                  {(() => {
                    const invoicesToShow = applyPaymentShowAll
                      ? supplyHouseInvoices
                      : supplyHouseInvoices.filter((inv) => !inv.is_paid)
                    if (invoicesToShow.length === 0) {
                      return <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>{applyPaymentShowAll ? 'No invoices' : 'No unpaid invoices'}</p>
                    }
                    return invoicesToShow.map((inv) => (
                      <label key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={applyPaymentSelectedIds.has(inv.id)}
                          onChange={(e) => {
                            setApplyPaymentSelectedIds((prev) => {
                              const next = new Set(prev)
                              if (e.target.checked) next.add(inv.id)
                              else next.delete(inv.id)
                              return next
                            })
                          }}
                        />
                        <span>{inv.invoice_number}</span>
                        <span style={{ color: '#6b7280', fontSize: '0.8125rem' }}>{new Date(inv.invoice_date).toLocaleDateString()}</span>
                        <span style={{ marginLeft: 'auto' }}>${formatCurrency(inv.amount)}</span>
                        {inv.is_paid && <span style={{ fontSize: '0.75rem', color: '#059669' }}>Paid</span>}
                      </label>
                    ))
                  })()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={closeApplyPaymentForm} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={savingApplyPayment || applyPaymentSelectedIds.size === 0} style={{ padding: '0.5rem 1rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: savingApplyPayment || applyPaymentSelectedIds.size === 0 ? 'not-allowed' : 'pointer' }}>
                  {savingApplyPayment ? 'Applying…' : 'Apply'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
