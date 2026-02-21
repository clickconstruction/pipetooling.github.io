import { Fragment, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency } from '../../lib/format'
import type { Database } from '../../types/database'

type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']
type SupplyHouseInvoice = Database['public']['Tables']['supply_house_invoices']['Row']
type ExternalTeamJobPayment = Database['public']['Tables']['external_team_job_payments']['Row']
type PersonRow = Database['public']['Tables']['people']['Row']
type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row']
type PurchaseOrderItem = Database['public']['Tables']['purchase_order_items']['Row']
type MaterialPart = Database['public']['Tables']['material_parts']['Row']

type POItemWithDetails = PurchaseOrderItem & {
  part: MaterialPart
  supply_house?: SupplyHouse
  source_template?: { id: string; name: string } | null
}
type PurchaseOrderWithItems = PurchaseOrder & { items: POItemWithDetails[] }

type SupplyHouseSummaryRow = { supply_house_id: string; name: string; outstanding: number; dueDate: string | null }
type ExternalTeamSummaryRow = { person_id: string; name: string; outstanding: number; subManagerName: string | null }

export function SupplyHousesSection() {
  const navigate = useNavigate()
  const { user: authUser } = useAuth()
  const [error, setError] = useState<string | null>(null)

  const [supplyHouses, setSupplyHouses] = useState<SupplyHouse[]>([])
  const [supplyHouseFormOpen, setSupplyHouseFormOpen] = useState(false)
  const [editingSupplyHouse, setEditingSupplyHouse] = useState<SupplyHouse | null>(null)
  const [supplyHouseName, setSupplyHouseName] = useState('')
  const [supplyHouseContactName, setSupplyHouseContactName] = useState('')
  const [supplyHousePhone, setSupplyHousePhone] = useState('')
  const [supplyHouseEmail, setSupplyHouseEmail] = useState('')
  const [supplyHouseAddress, setSupplyHouseAddress] = useState('')
  const [supplyHouseNotes, setSupplyHouseNotes] = useState('')
  const [savingSupplyHouse, setSavingSupplyHouse] = useState(false)

  const [supplyHouseSummary, setSupplyHouseSummary] = useState<SupplyHouseSummaryRow[]>([])
  const [supplyHouseSummaryLoading, setSupplyHouseSummaryLoading] = useState(false)
  const [selectedSupplyHouseForDetail, setSelectedSupplyHouseForDetail] = useState<SupplyHouse | null>(null)
  const [supplyHouseInvoices, setSupplyHouseInvoices] = useState<SupplyHouseInvoice[]>([])
  const [supplyHousePOs, setSupplyHousePOs] = useState<PurchaseOrderWithItems[]>([])
  const [supplyHouseDetailLoading, setSupplyHouseDetailLoading] = useState(false)
  const [invoiceFormOpen, setInvoiceFormOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<SupplyHouseInvoice | null>(null)
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [invoiceDueDate, setInvoiceDueDate] = useState('')
  const [invoiceAmount, setInvoiceAmount] = useState('')
  const [invoiceLink, setInvoiceLink] = useState('')
  const [invoiceIsPaid, setInvoiceIsPaid] = useState(false)
  const [savingInvoice, setSavingInvoice] = useState(false)
  const [creatingPOForSupplyHouse, setCreatingPOForSupplyHouse] = useState(false)
  const [firstServiceTypeId, setFirstServiceTypeId] = useState<string | null>(null)

  const [externalTeamSummary, setExternalTeamSummary] = useState<ExternalTeamSummaryRow[]>([])
  const [externalTeamSummaryLoading, setExternalTeamSummaryLoading] = useState(false)
  const [selectedSubForDetail, setSelectedSubForDetail] = useState<PersonRow | null>(null)
  const [externalTeamPayments, setExternalTeamPayments] = useState<ExternalTeamJobPayment[]>([])
  const [externalTeamDetailLoading, setExternalTeamDetailLoading] = useState(false)
  const [externalTeamManagerCandidates, setExternalTeamManagerCandidates] = useState<Array<{ id: string; name: string | null; email: string | null }>>([])
  const [paymentFormOpen, setPaymentFormOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<ExternalTeamJobPayment | null>(null)
  const [paymentNote, setPaymentNote] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentIsPaid, setPaymentIsPaid] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)
  const [paymentForPersonId, setPaymentForPersonId] = useState<string | null>(null)
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null)
  const [subManagerForPersonId, setSubManagerForPersonId] = useState<string | null>(null)
  const [savingSubManager, setSavingSubManager] = useState(false)
  const [subFormOpen, setSubFormOpen] = useState(false)
  const [subName, setSubName] = useState('')
  const [subEmail, setSubEmail] = useState('')
  const [subPhone, setSubPhone] = useState('')
  const [subNotes, setSubNotes] = useState('')
  const [savingSub, setSavingSub] = useState(false)

  async function loadFirstServiceType() {
    const { data } = await supabase.from('service_types').select('id').order('sequence_order', { ascending: true }).limit(1)
    const first = (data as { id: string }[] | null)?.[0]
    setFirstServiceTypeId(first?.id ?? null)
  }

  async function loadSupplyHouses() {
    const { data, error: err } = await supabase.from('supply_houses').select('*').order('name')
    if (err) setError(`Failed to load supply houses: ${err.message}`)
    else setSupplyHouses((data as SupplyHouse[]) ?? [])
  }

  async function loadSupplyHouseSummary() {
    setSupplyHouseSummaryLoading(true)
    const { data: houses } = await supabase.from('supply_houses').select('id, name').order('name')
    const { data: invoices } = await supabase.from('supply_house_invoices').select('supply_house_id, amount, due_date, is_paid')
    const housesList = (houses ?? []) as { id: string; name: string }[]
    const invoicesList = (invoices ?? []) as { supply_house_id: string; amount: number; due_date: string | null; is_paid: boolean }[]
    const byHouse = new Map<string, { outstanding: number; dueDate: string | null }>()
    for (const h of housesList) byHouse.set(h.id, { outstanding: 0, dueDate: null })
    for (const inv of invoicesList) {
      if (inv.is_paid) continue
      const cur = byHouse.get(inv.supply_house_id)
      if (cur) {
        cur.outstanding += inv.amount
        if (inv.due_date && (!cur.dueDate || inv.due_date < cur.dueDate)) cur.dueDate = inv.due_date
      }
    }
    const rows: SupplyHouseSummaryRow[] = housesList.map((h) => {
      const c = byHouse.get(h.id) ?? { outstanding: 0, dueDate: null }
      return { supply_house_id: h.id, name: h.name, outstanding: c.outstanding, dueDate: c.dueDate }
    })
    rows.sort((a, b) => b.outstanding - a.outstanding)
    setSupplyHouseSummary(rows)
    setSupplyHouseSummaryLoading(false)
  }

  async function loadSupplyHouseDetail(sh: SupplyHouse) {
    setSupplyHouseDetailLoading(true)
    const { data: shData } = await supabase.from('supply_houses').select('*').eq('id', sh.id).single()
    setSelectedSupplyHouseForDetail((shData as SupplyHouse) ?? sh)
    const [invRes, poRes] = await Promise.all([
      supabase.from('supply_house_invoices').select('*').eq('supply_house_id', sh.id).order('invoice_date', { ascending: false }),
      supabase.from('purchase_orders').select('*').eq('supply_house_id', sh.id).order('created_at', { ascending: false }),
    ])
    setSupplyHouseInvoices((invRes.data as SupplyHouseInvoice[]) ?? [])
    const pos = (poRes.data as PurchaseOrder[]) ?? []
    const posWithItems: PurchaseOrderWithItems[] = await Promise.all(
      pos.map(async (po) => {
        const { data: itemsData } = await supabase
          .from('purchase_order_items')
          .select('*, material_parts(*), supply_houses(*), source_template:material_templates!source_template_id(id, name)')
          .eq('purchase_order_id', po.id)
          .order('sequence_order', { ascending: true })
        const items = (itemsData as unknown as (PurchaseOrderItem & { material_parts: MaterialPart; supply_houses: SupplyHouse | null; source_template?: { id: string; name: string } | null })[]) ?? []
        return { ...po, items: items.map((item) => ({ ...item, part: item.material_parts, supply_house: item.supply_houses ?? undefined, source_template: item.source_template ?? null })) }
      })
    )
    setSupplyHousePOs(posWithItems)
    setSupplyHouseDetailLoading(false)
  }

  async function loadExternalTeamSummary() {
    setExternalTeamSummaryLoading(true)
    const [peopleRes, paymentsRes, managersRes, usersRes] = await Promise.all([
      supabase.from('people').select('id, name').eq('kind', 'sub').order('name'),
      supabase.from('external_team_job_payments').select('person_id, amount, is_paid'),
      supabase.from('external_team_sub_managers').select('person_id, user_id'),
      supabase.from('users').select('id, name, email').in('role', ['dev', 'master_technician', 'assistant']).order('name'),
    ])
    const subs = (peopleRes.data ?? []) as { id: string; name: string }[]
    const payments = (paymentsRes.data ?? []) as { person_id: string; amount: number; is_paid: boolean }[]
    const managers = (managersRes.data ?? []) as { person_id: string; user_id: string }[]
    const users = (usersRes.data ?? []) as { id: string; name: string | null; email: string | null }[]
    setExternalTeamManagerCandidates(users)
    const userMap = new Map(users.map((u) => [u.id, u.name || u.email || 'Unknown']))
    const byPerson = new Map<string, number>()
    for (const p of subs) byPerson.set(p.id, 0)
    for (const pay of payments) {
      if (pay.is_paid) continue
      byPerson.set(pay.person_id, (byPerson.get(pay.person_id) ?? 0) + pay.amount)
    }
    const managerMap = new Map(managers.map((m) => [m.person_id, userMap.get(m.user_id) ?? null]))
    const rows: ExternalTeamSummaryRow[] = subs.map((p) => ({
      person_id: p.id,
      name: p.name,
      outstanding: byPerson.get(p.id) ?? 0,
      subManagerName: managerMap.get(p.id) ?? null,
    }))
    rows.sort((a, b) => b.outstanding - a.outstanding)
    setExternalTeamSummary(rows)
    setExternalTeamSummaryLoading(false)
  }

  async function loadExternalTeamDetail(person: PersonRow) {
    setExternalTeamDetailLoading(true)
    setSelectedSubForDetail(person)
    const { data } = await supabase.from('external_team_job_payments').select('*').eq('person_id', person.id).order('created_at', { ascending: false })
    setExternalTeamPayments((data as ExternalTeamJobPayment[]) ?? [])
    setExternalTeamDetailLoading(false)
  }

  function closeSupplyHouseForm() {
    setSupplyHouseFormOpen(false)
    setEditingSupplyHouse(null)
  }

  async function saveSupplyHouse(e: React.FormEvent) {
    e.preventDefault()
    if (!supplyHouseName.trim()) {
      setError('Supply house name is required')
      return
    }
    setSavingSupplyHouse(true)
    setError(null)
    if (editingSupplyHouse) {
      const { error: err } = await supabase.from('supply_houses').update({
        name: supplyHouseName.trim(),
        contact_name: supplyHouseContactName.trim() || null,
        phone: supplyHousePhone.trim() || null,
        email: supplyHouseEmail.trim() || null,
        address: supplyHouseAddress.trim() || null,
        notes: supplyHouseNotes.trim() || null,
      }).eq('id', editingSupplyHouse.id)
      if (err) setError(err.message)
      else {
        await Promise.all([loadSupplyHouses(), loadSupplyHouseSummary()])
        if (selectedSupplyHouseForDetail?.id === editingSupplyHouse.id) await loadSupplyHouseDetail(editingSupplyHouse)
        closeSupplyHouseForm()
      }
    } else {
      const { error: err } = await supabase.from('supply_houses').insert({
        name: supplyHouseName.trim(),
        contact_name: supplyHouseContactName.trim() || null,
        phone: supplyHousePhone.trim() || null,
        email: supplyHouseEmail.trim() || null,
        address: supplyHouseAddress.trim() || null,
        notes: supplyHouseNotes.trim() || null,
      })
      if (err) setError(err.message)
      else {
        await Promise.all([loadSupplyHouses(), loadSupplyHouseSummary()])
        closeSupplyHouseForm()
      }
    }
    setSavingSupplyHouse(false)
  }

  function openAddInvoice() {
    setEditingInvoice(null)
    setInvoiceNumber('')
    setInvoiceDate(new Date().toISOString().slice(0, 10))
    setInvoiceDueDate('')
    setInvoiceAmount('')
    setInvoiceLink('')
    setInvoiceIsPaid(false)
    setInvoiceFormOpen(true)
  }

  function openEditInvoice(inv: SupplyHouseInvoice) {
    setEditingInvoice(inv)
    setInvoiceNumber(inv.invoice_number)
    setInvoiceDate(inv.invoice_date)
    setInvoiceDueDate(inv.due_date ?? '')
    setInvoiceAmount(inv.amount.toString())
    setInvoiceLink(inv.link ?? '')
    setInvoiceIsPaid(inv.is_paid)
    setInvoiceFormOpen(true)
  }

  function closeInvoiceForm() {
    setInvoiceFormOpen(false)
    setEditingInvoice(null)
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
    }
    if (editingInvoice) {
      const { error: err } = await supabase.from('supply_house_invoices').update(payload).eq('id', editingInvoice.id)
      if (err) setError(err.message)
      else {
        await loadSupplyHouseDetail(selectedSupplyHouseForDetail)
        await loadSupplyHouseSummary()
        closeInvoiceForm()
      }
    } else {
      const { error: err } = await supabase.from('supply_house_invoices').insert(payload)
      if (err) setError(err.message)
      else {
        await loadSupplyHouseDetail(selectedSupplyHouseForDetail)
        await loadSupplyHouseSummary()
        closeInvoiceForm()
      }
    }
    setSavingInvoice(false)
  }

  async function toggleInvoicePaid(inv: SupplyHouseInvoice) {
    const { error: err } = await supabase.from('supply_house_invoices').update({ is_paid: !inv.is_paid }).eq('id', inv.id)
    if (!err && selectedSupplyHouseForDetail) {
      await loadSupplyHouseDetail(selectedSupplyHouseForDetail)
      await loadSupplyHouseSummary()
    }
  }

  async function deleteInvoice(inv: SupplyHouseInvoice) {
    if (!confirm('Delete this invoice?')) return
    const { error: err } = await supabase.from('supply_house_invoices').delete().eq('id', inv.id)
    if (!err && selectedSupplyHouseForDetail) {
      await loadSupplyHouseDetail(selectedSupplyHouseForDetail)
      await loadSupplyHouseSummary()
    }
  }

  async function createBlankPOForSupplyHouse(supplyHouseId: string) {
    if (!authUser?.id || !firstServiceTypeId) return
    setCreatingPOForSupplyHouse(true)
    setError(null)
    const sh = supplyHouses.find((s) => s.id === supplyHouseId)
    const currentDate = new Date().toLocaleDateString()
    const { data: poData, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        name: `PO: ${sh?.name ?? 'Supply House'} [${currentDate}]`,
        status: 'draft',
        created_by: authUser.id,
        notes: null,
        service_type_id: firstServiceTypeId,
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
    await loadSupplyHouseSummary()
    if (poData?.id) navigate('/materials', { state: { openPOId: poData.id } })
  }

  function openAddPayment(personId: string) {
    setPaymentForPersonId(personId)
    setEditingPayment(null)
    setPaymentNote('')
    setPaymentAmount('')
    setPaymentIsPaid(false)
    setPaymentFormOpen(true)
    setError(null)
  }

  function openEditPayment(pay: ExternalTeamJobPayment) {
    setPaymentForPersonId(pay.person_id)
    setEditingPayment(pay)
    setPaymentNote(pay.note)
    setPaymentAmount(String(pay.amount))
    setPaymentIsPaid(pay.is_paid)
    setPaymentFormOpen(true)
    setError(null)
  }

  function closePaymentForm() {
    setPaymentFormOpen(false)
    setPaymentForPersonId(null)
    setEditingPayment(null)
    setPaymentNote('')
    setPaymentAmount('')
    setPaymentIsPaid(false)
  }

  async function savePayment(e: React.FormEvent) {
    e.preventDefault()
    if (!paymentForPersonId) return
    const amountNum = parseFloat(paymentAmount) || 0
    setSavingPayment(true)
    setError(null)
    if (editingPayment) {
      const { error: err } = await supabase.from('external_team_job_payments').update({ note: paymentNote.trim(), amount: amountNum, is_paid: paymentIsPaid }).eq('id', editingPayment.id)
      if (err) setError(err.message)
      else {
        await loadExternalTeamSummary()
        if (selectedSubForDetail?.id === paymentForPersonId) await loadExternalTeamDetail(selectedSubForDetail)
        closePaymentForm()
      }
    } else {
      const { error: err } = await supabase.from('external_team_job_payments').insert({
        person_id: paymentForPersonId,
        note: paymentNote.trim(),
        amount: amountNum,
        is_paid: paymentIsPaid,
      })
      if (err) setError(err.message)
      else {
        await loadExternalTeamSummary()
        if (selectedSubForDetail?.id === paymentForPersonId) await loadExternalTeamDetail(selectedSubForDetail)
        closePaymentForm()
      }
    }
    setSavingPayment(false)
  }

  async function deletePayment(id: string) {
    if (!confirm('Delete this job payment?')) return
    setDeletingPaymentId(id)
    setError(null)
    const { error: err } = await supabase.from('external_team_job_payments').delete().eq('id', id)
    setDeletingPaymentId(null)
    if (err) setError(err.message)
    else {
      await loadExternalTeamSummary()
      if (selectedSubForDetail) await loadExternalTeamDetail(selectedSubForDetail)
    }
  }

  async function togglePaymentPaid(pay: ExternalTeamJobPayment) {
    const { error: err } = await supabase.from('external_team_job_payments').update({ is_paid: !pay.is_paid }).eq('id', pay.id)
    if (err) setError(err.message)
    else {
      await loadExternalTeamSummary()
      if (selectedSubForDetail?.id === pay.person_id) await loadExternalTeamDetail(selectedSubForDetail)
    }
  }

  async function saveSubManager(personId: string, userId: string) {
    setSavingSubManager(true)
    setError(null)
    const { error: err } = await supabase.from('external_team_sub_managers').upsert({ person_id: personId, user_id: userId }, { onConflict: 'person_id' })
    setSavingSubManager(false)
    if (err) setError(err.message)
    else {
      await loadExternalTeamSummary()
      setSubManagerForPersonId(null)
    }
  }

  async function removeSubManager(personId: string) {
    setError(null)
    const { error: err } = await supabase.from('external_team_sub_managers').delete().eq('person_id', personId)
    if (err) setError(err.message)
    else {
      await loadExternalTeamSummary()
      setSubManagerForPersonId(null)
    }
  }

  function openAddExternalSub() {
    setSubName('')
    setSubEmail('')
    setSubPhone('')
    setSubNotes('')
    setSubFormOpen(true)
    setError(null)
  }

  function closeSubForm() {
    setSubFormOpen(false)
  }

  async function saveExternalSub(e: React.FormEvent) {
    e.preventDefault()
    if (!authUser?.id) return
    const trimmedName = subName.trim()
    if (!trimmedName) {
      setError('Name is required.')
      return
    }
    setSavingSub(true)
    setError(null)
    const { error: err } = await supabase.from('people').insert({
      master_user_id: authUser.id,
      kind: 'sub',
      name: trimmedName,
      email: subEmail.trim() || null,
      phone: subPhone.trim() || null,
      notes: subNotes.trim() || null,
    })
    setSavingSub(false)
    if (err) setError(err.message)
    else {
      await loadExternalTeamSummary()
      closeSubForm()
    }
  }

  useEffect(() => {
    loadFirstServiceType()
    loadSupplyHouses()
    loadSupplyHouseSummary()
    loadExternalTeamSummary()
  }, [authUser?.id])

  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>Materials Supply Houses & External Subs</h2>
      {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}

      <div style={{ marginBottom: '2rem' }}>
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
                  const sh = supplyHouses.find((s) => s.id === row.supply_house_id)
                  const isExpanded = selectedSupplyHouseForDetail?.id === row.supply_house_id
                  return (
                    <Fragment key={row.supply_house_id}>
                      <tr
                        onClick={() => {
                          if (!sh) return
                          if (isExpanded) setSelectedSupplyHouseForDetail(null)
                          else loadSupplyHouseDetail(sh)
                        }}
                        style={{ borderBottom: '1px solid #e5e7eb', cursor: 'pointer', background: isExpanded ? '#f0f9ff' : undefined }}
                      >
                        <td style={{ padding: '0.75rem', fontWeight: 500 }}>{row.name}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: row.outstanding > 0 ? 600 : 400 }}>${formatCurrency(row.outstanding)}</td>
                        <td style={{ padding: '0.75rem', color: '#6b7280' }}>{row.dueDate ? new Date(row.dueDate).toLocaleDateString() : '—'}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                          {isExpanded && selectedSupplyHouseForDetail && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingSupplyHouse(selectedSupplyHouseForDetail)
                                setSupplyHouseName(selectedSupplyHouseForDetail.name)
                                setSupplyHouseContactName(selectedSupplyHouseForDetail.contact_name ?? '')
                                setSupplyHousePhone(selectedSupplyHouseForDetail.phone ?? '')
                                setSupplyHouseEmail(selectedSupplyHouseForDetail.email ?? '')
                                setSupplyHouseAddress(selectedSupplyHouseForDetail.address ?? '')
                                setSupplyHouseNotes(selectedSupplyHouseForDetail.notes ?? '')
                                setSupplyHouseFormOpen(true)
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
                                    {selectedSupplyHouseForDetail.address && <div><strong>Address:</strong> {selectedSupplyHouseForDetail.address}</div>}
                                    {selectedSupplyHouseForDetail.phone && <div><strong>Phone:</strong> {selectedSupplyHouseForDetail.phone}</div>}
                                    {selectedSupplyHouseForDetail.email && <div><strong>Email:</strong> {selectedSupplyHouseForDetail.email}</div>}
                                    {selectedSupplyHouseForDetail.contact_name && <div><strong>Contact:</strong> {selectedSupplyHouseForDetail.contact_name}</div>}
                                  </div>
                                  <section style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                      <h3 style={{ margin: 0, fontSize: '1rem' }}>Invoices</h3>
                                      <button type="button" onClick={(e) => { e.stopPropagation(); openAddInvoice() }} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Add Invoice</button>
                                    </div>
                                    <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                        <thead style={{ background: '#f9fafb' }}>
                                          <tr>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Invoice #</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Date</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Due</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Amount</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Paid</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Link</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Actions</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {supplyHouseInvoices.length === 0 ? (
                                            <tr><td colSpan={7} style={{ padding: '1rem', color: '#6b7280', textAlign: 'center' }}>No invoices</td></tr>
                                          ) : (
                                            supplyHouseInvoices.map((inv) => (
                                              <tr key={inv.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>{inv.invoice_number}</td>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>{new Date(inv.invoice_date).toLocaleDateString()}</td>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</td>
                                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${formatCurrency(inv.amount)}</td>
                                                <td style={{ padding: '0.5rem 0.75rem' }}><input type="checkbox" checked={inv.is_paid} onChange={() => toggleInvoicePaid(inv)} /></td>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>{inv.link ? <a href={inv.link} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>View</a> : '—'}</td>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                                  <button type="button" onClick={(e) => { e.stopPropagation(); openEditInvoice(inv) }} title="Edit" aria-label="Edit" style={{ marginRight: '0.5rem', padding: '0.25rem', cursor: 'pointer', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4 }}>Edit</button>
                                                  <button type="button" onClick={(e) => { e.stopPropagation(); deleteInvoice(inv) }} title="Delete" aria-label="Delete" style={{ padding: '0.25rem', cursor: 'pointer', background: 'none', border: 'none', color: '#dc2626' }}>Delete</button>
                                                </td>
                                              </tr>
                                            ))
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </section>
                                  <section>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                      <h3 style={{ margin: 0, fontSize: '1rem' }}>Purchase Orders</h3>
                                      <button type="button" onClick={(e) => { e.stopPropagation(); createBlankPOForSupplyHouse(selectedSupplyHouseForDetail.id) }} disabled={creatingPOForSupplyHouse || !firstServiceTypeId} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: creatingPOForSupplyHouse || !firstServiceTypeId ? 'not-allowed' : 'pointer' }}>{creatingPOForSupplyHouse ? 'Creating…' : 'Create PO'}</button>
                                    </div>
                                    {!firstServiceTypeId && <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Loading service types…</p>}
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
                                                  <button type="button" onClick={(e) => { e.stopPropagation(); navigate('/materials', { state: { openPOId: po.id } }) }} style={{ marginRight: '0.5rem', padding: '0.2rem 0.5rem', fontSize: '0.8125rem', cursor: 'pointer' }}>View / Edit</button>
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
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button type="button" onClick={() => { setEditingSupplyHouse(null); setSupplyHouseName(''); setSupplyHouseContactName(''); setSupplyHousePhone(''); setSupplyHouseEmail(''); setSupplyHouseAddress(''); setSupplyHouseNotes(''); setSupplyHouseFormOpen(true); setError(null) }} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Add Supply House</button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        {externalTeamSummaryLoading ? (
          <p style={{ color: '#6b7280' }}>Loading…</p>
        ) : (
          <>
            <div style={{ marginBottom: '0.75rem', fontSize: '1rem', fontWeight: 600, textAlign: 'center' }}>
              External Team: ${formatCurrency(externalTeamSummary.reduce((sum, row) => sum + row.outstanding, 0))}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>External Subcontractor</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Sub Manager (User)</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Outstanding</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', width: 140 }}></th>
                </tr>
              </thead>
              <tbody>
                {externalTeamSummary.map((row) => {
                  const isExpanded = selectedSubForDetail?.id === row.person_id
                  const person = { id: row.person_id, name: row.name } as PersonRow
                  return (
                    <Fragment key={row.person_id}>
                      <tr onClick={() => { if (isExpanded) setSelectedSubForDetail(null); else loadExternalTeamDetail(person) }} style={{ borderBottom: '1px solid #e5e7eb', cursor: 'pointer', background: isExpanded ? '#f0f9ff' : undefined }}>
                        <td style={{ padding: '0.75rem', fontWeight: 500 }}>{row.name}</td>
                        <td style={{ padding: '0.75rem', color: '#6b7280' }}>{row.subManagerName ?? '—'}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: row.outstanding > 0 ? 600 : 400 }}>${formatCurrency(row.outstanding)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <button type="button" onClick={() => openAddPayment(row.person_id)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Add Job Payment</button>
                        </td>
                      </tr>
                      {isExpanded && selectedSubForDetail && (
                        <tr>
                          <td colSpan={4} style={{ padding: 0, verticalAlign: 'top', borderBottom: '1px solid #e5e7eb' }}>
                            <div style={{ padding: '1rem 1.5rem', background: '#f9fafb', borderLeft: '3px solid #3b82f6' }}>
                              {externalTeamDetailLoading ? (
                                <p>Loading…</p>
                              ) : (
                                <>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', alignItems: 'center', marginBottom: '1rem' }}>
                                    <span style={{ marginRight: '0.5rem', fontWeight: 500 }}>Sub Manager:</span>
                                    {subManagerForPersonId === row.person_id ? (
                                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <select value="" onChange={(e) => { const uid = e.target.value; if (uid) saveSubManager(row.person_id, uid) }} disabled={savingSubManager} style={{ padding: '0.35rem 0.5rem', fontSize: '0.875rem', border: '1px solid #d1d5db', borderRadius: 4 }}>
                                          <option value="">Select…</option>
                                          {externalTeamManagerCandidates.map((u) => <option key={u.id} value={u.id}>{u.name || u.email || 'Unknown'}</option>)}
                                        </select>
                                        <button type="button" onClick={() => setSubManagerForPersonId(null)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.8125rem', cursor: 'pointer' }}>Cancel</button>
                                      </span>
                                    ) : (
                                      <>
                                        <span style={{ marginRight: '0.5rem' }}>{row.subManagerName ?? '—'}</span>
                                        <button type="button" onClick={() => setSubManagerForPersonId(row.person_id)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.8125rem', cursor: 'pointer' }}>{row.subManagerName ? 'Change' : 'Assign'}</button>
                                        {row.subManagerName && <button type="button" onClick={() => removeSubManager(row.person_id)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.8125rem', cursor: 'pointer', color: '#dc2626' }}>Remove</button>}
                                      </>
                                    )}
                                  </div>
                                  <section style={{ marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                      <h4 style={{ margin: 0, fontSize: '1rem' }}>Job Payments</h4>
                                      <button type="button" onClick={() => openAddPayment(row.person_id)} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Add Job Payment</button>
                                    </div>
                                    <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                        <thead style={{ background: '#f9fafb' }}>
                                          <tr>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Note</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Amount</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Paid</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Actions</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {externalTeamPayments.length === 0 ? (
                                            <tr><td colSpan={4} style={{ padding: '1rem', color: '#6b7280', textAlign: 'center' }}>No job payments yet.</td></tr>
                                          ) : (
                                            externalTeamPayments.map((pay) => (
                                              <tr key={pay.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>{pay.note}</td>
                                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${formatCurrency(pay.amount)}</td>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                                                    <input type="checkbox" checked={pay.is_paid} onChange={() => togglePaymentPaid(pay)} />
                                                    {pay.is_paid ? 'Paid' : 'Unpaid'}
                                                  </label>
                                                </td>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                                  <button type="button" onClick={() => openEditPayment(pay)} style={{ marginRight: '0.5rem', padding: '0.2rem 0.5rem', fontSize: '0.8125rem', cursor: 'pointer' }}>Edit</button>
                                                  <button type="button" onClick={() => deletePayment(pay.id)} disabled={deletingPaymentId === pay.id} style={{ padding: '0.2rem 0.5rem', fontSize: '0.8125rem', cursor: deletingPaymentId === pay.id ? 'not-allowed' : 'pointer', color: '#dc2626' }}>Delete</button>
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
          </>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
        <button type="button" onClick={openAddExternalSub} style={{ padding: '0.5rem 1rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Add External Subcontractor</button>
      </div>

      {supplyHouseFormOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, maxWidth: 480, width: '90%' }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>{editingSupplyHouse ? 'Edit Supply House' : 'Add Supply House'}</h3>
            <form onSubmit={saveSupplyHouse}>
              <div style={{ marginBottom: '0.75rem' }}><label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Name *</label><input type="text" value={supplyHouseName} onChange={(e) => setSupplyHouseName(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} /></div>
              <div style={{ marginBottom: '0.75rem' }}><label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Contact Name</label><input type="text" value={supplyHouseContactName} onChange={(e) => setSupplyHouseContactName(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} /></div>
              <div style={{ marginBottom: '0.75rem' }}><label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Phone</label><input type="tel" value={supplyHousePhone} onChange={(e) => setSupplyHousePhone(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} /></div>
              <div style={{ marginBottom: '0.75rem' }}><label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Email</label><input type="email" value={supplyHouseEmail} onChange={(e) => setSupplyHouseEmail(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} /></div>
              <div style={{ marginBottom: '0.75rem' }}><label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Address</label><textarea value={supplyHouseAddress} onChange={(e) => setSupplyHouseAddress(e.target.value)} rows={2} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} /></div>
              <div style={{ marginBottom: '1rem' }}><label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Notes</label><textarea value={supplyHouseNotes} onChange={(e) => setSupplyHouseNotes(e.target.value)} rows={2} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} /></div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={closeSupplyHouseForm} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={savingSupplyHouse} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: savingSupplyHouse ? 'not-allowed' : 'pointer' }}>{savingSupplyHouse ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {invoiceFormOpen && selectedSupplyHouseForDetail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 480 }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>{editingInvoice ? 'Edit Invoice' : 'Add Invoice'}</h3>
            <form onSubmit={saveInvoice}>
              <div style={{ marginBottom: '0.75rem' }}><label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Invoice Number *</label><input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} /></div>
              <div style={{ marginBottom: '0.75rem' }}><label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Invoice Date *</label><input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} /></div>
              <div style={{ marginBottom: '0.75rem' }}><label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Due Date</label><input type="date" value={invoiceDueDate} onChange={(e) => setInvoiceDueDate(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} /></div>
              <div style={{ marginBottom: '0.75rem' }}><label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Amount *</label><input type="number" step="0.01" min={0} value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} /></div>
              <div style={{ marginBottom: '0.75rem' }}><label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Link (URL)</label><input type="url" value={invoiceLink} onChange={(e) => setInvoiceLink(e.target.value)} placeholder="https://..." style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} /></div>
              <div style={{ marginBottom: '1rem' }}><label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}><input type="checkbox" checked={invoiceIsPaid} onChange={(e) => setInvoiceIsPaid(e.target.checked)} />Paid</label></div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}><button type="button" onClick={closeInvoiceForm} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button><button type="submit" disabled={savingInvoice} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: savingInvoice ? 'not-allowed' : 'pointer' }}>{savingInvoice ? 'Saving…' : 'Save'}</button></div>
            </form>
          </div>
        </div>
      )}

      {paymentFormOpen && paymentForPersonId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 480 }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>{editingPayment ? 'Edit Job Payment' : 'Add Job Payment'}</h3>
            <form onSubmit={savePayment}>
              <div style={{ marginBottom: '0.75rem' }}><label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Note *</label><input type="text" value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} /></div>
              <div style={{ marginBottom: '0.75rem' }}><label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Amount *</label><input type="number" step="0.01" min={0} value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} /></div>
              <div style={{ marginBottom: '1rem' }}><label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}><input type="checkbox" checked={paymentIsPaid} onChange={(e) => setPaymentIsPaid(e.target.checked)} />Paid</label></div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}><button type="button" onClick={closePaymentForm} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button><button type="submit" disabled={savingPayment} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: savingPayment ? 'not-allowed' : 'pointer' }}>{savingPayment ? 'Saving…' : 'Save'}</button></div>
            </form>
          </div>
        </div>
      )}

      {subFormOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, maxWidth: 480, width: '90%' }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>Add External Subcontractor</h3>
            <form onSubmit={saveExternalSub}>
              <div style={{ marginBottom: '0.75rem' }}><label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Name *</label><input type="text" value={subName} onChange={(e) => setSubName(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} /></div>
              <div style={{ marginBottom: '0.75rem' }}><label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Email</label><input type="email" value={subEmail} onChange={(e) => setSubEmail(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} /></div>
              <div style={{ marginBottom: '0.75rem' }}><label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Phone</label><input type="tel" value={subPhone} onChange={(e) => setSubPhone(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} /></div>
              <div style={{ marginBottom: '1rem' }}><label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Notes</label><textarea value={subNotes} onChange={(e) => setSubNotes(e.target.value)} rows={2} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} /></div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}><button type="button" onClick={closeSubForm} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button><button type="submit" disabled={savingSub} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: savingSub ? 'not-allowed' : 'pointer' }}>{savingSub ? 'Saving…' : 'Save'}</button></div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
