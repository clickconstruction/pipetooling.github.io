import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import { supabase } from '../lib/supabase'
import { addExpandedPartsToPO, expandTemplate, getTemplatePartsPreview } from '../lib/materialPOUtils'
import { useAuth } from '../hooks/useAuth'
import NewCustomerForm from '../components/NewCustomerForm'
import { PartFormModal } from '../components/PartFormModal'
import { Database } from '../types/database'
import type { Json } from '../types/database'

type GcBuilder = Database['public']['Tables']['bids_gc_builders']['Row']
type Customer = Database['public']['Tables']['customers']['Row']
type Bid = Database['public']['Tables']['bids']['Row']
type BidCountRow = Database['public']['Tables']['bids_count_rows']['Row']
type BidSubmissionEntry = Database['public']['Tables']['bids_submission_entries']['Row']
type MaterialTemplate = Database['public']['Tables']['material_templates']['Row']
type MaterialPart = Database['public']['Tables']['material_parts']['Row']
type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']
type CostEstimate = Database['public']['Tables']['cost_estimates']['Row']
type CostEstimateLaborRow = Database['public']['Tables']['cost_estimate_labor_rows']['Row']
type FixtureLaborDefault = Database['public']['Tables']['fixture_labor_defaults']['Row']
type PriceBookVersion = Database['public']['Tables']['price_book_versions']['Row']
type PriceBookEntry = Database['public']['Tables']['price_book_entries']['Row']
type BidPricingAssignment = Database['public']['Tables']['bid_pricing_assignments']['Row']
type LaborBookVersion = Database['public']['Tables']['labor_book_versions']['Row']
type LaborBookEntry = Database['public']['Tables']['labor_book_entries']['Row']
type TakeoffBookVersion = Database['public']['Tables']['takeoff_book_versions']['Row']
type TakeoffBookEntry = Database['public']['Tables']['takeoff_book_entries']['Row']
type TakeoffBookEntryItem = Database['public']['Tables']['takeoff_book_entry_items']['Row']
type TakeoffBookEntryWithItems = TakeoffBookEntry & { items: TakeoffBookEntryItem[] }
type UserRole = 'dev' | 'master_technician' | 'assistant' | 'estimator'
type OutcomeOption = 'won' | 'lost' | 'started_or_complete' | ''

type TakeoffStage = 'rough_in' | 'top_out' | 'trim_set'
type TakeoffMapping = { id: string; countRowId: string; templateId: string; stage: TakeoffStage; quantity: number; isSaved: boolean }
type DraftPO = { id: string; name: string }
type CostEstimatePO = { id: string; name: string; stage: string | null }

const STAGE_LABELS: Record<TakeoffStage, string> = { rough_in: 'Rough In', top_out: 'Top Out', trim_set: 'Trim Set' }

type EstimatorUser = { id: string; name: string | null; email: string }

interface ServiceType {
  id: string
  name: string
  description: string | null
  color: string | null
  sequence_order: number
  created_at: string
  updated_at: string
}

interface PartType {
  id: string
  service_type_id: string
  name: string
  category: string | null
  sequence_order: number
  created_at: string
  updated_at: string
}

type BidWithBuilder = Bid & {
  customers: Customer | null
  bids_gc_builders: GcBuilder | null
  estimator?: EstimatorUser | EstimatorUser[] | null
  account_manager?: EstimatorUser | EstimatorUser[] | null
  service_type?: ServiceType | null
}

// Extended types that include joined fixture_types data
// Note: BidCountRow uses free text `fixture` field, not FK
type LaborBookEntryWithFixture = LaborBookEntry & { 
  fixture_types?: { name: string } | null 
}

type PriceBookEntryWithFixture = PriceBookEntry & { 
  fixture_types?: { name: string } | null 
}

function extractContactInfo(ci: Json | null): { phone: string; email: string } {
  if (ci == null) return { phone: '', email: '' }
  if (typeof ci === 'object' && ci !== null) {
    const obj = ci as Record<string, unknown>
    return {
      phone: typeof obj.phone === 'string' ? obj.phone : '',
      email: typeof obj.email === 'string' ? obj.email : '',
    }
  }
  return { phone: '', email: '' }
}

function formatAddressWithoutZip(address: string | null): string {
  if (!address) return ''
  const parts = address.split(',')
  if (parts.length === 0) return address

  const lastIndex = parts.length - 1
  const lastPart = parts[lastIndex]?.trim()
  if (!lastPart) return address
  
  const tokens = lastPart.split(/\s+/)
  const lastToken = tokens[tokens.length - 1]
  if (!lastToken) return address

  // If the last token is mostly numeric (zip-like), drop it
  if (/^\d{3,}$/.test(lastToken)) {
    tokens.pop()
    parts[lastIndex] = tokens.join(' ')
    return parts.map((p) => p.trim()).filter(Boolean).join(', ')
  }

  return address
}

const tabStyle = (active: boolean) => ({
  padding: '0.75rem 1.5rem',
  border: 'none',
  background: 'none',
  borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
  color: active ? '#3b82f6' : '#6b7280',
  fontWeight: active ? 600 : 400,
  cursor: 'pointer' as const,
})

function formatTimeSinceLastContact(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso).getTime()
  const now = Date.now()
  const sec = Math.floor((now - d) / 1000)
  if (sec < 60) return 'Just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} minute${min !== 1 ? 's' : ''} ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hour${hr !== 1 ? 's' : ''} ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day} day${day !== 1 ? 's' : ''} ago`
  const week = Math.floor(day / 7)
  if (week < 4) return `${week} week${week !== 1 ? 's' : ''} ago`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo} month${mo !== 1 ? 's' : ''} ago`
  return `${Math.floor(mo / 12)} year${Math.floor(mo / 12) !== 1 ? 's' : ''} ago`
}

function formatTimeSinceDueDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const due = new Date(dateStr + 'T12:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  const diffMs = due.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000))
  if (diffDays < 0) return `+${Math.abs(diffDays)}`
  if (diffDays === 0) return '-0'
  return `-${diffDays}`
}

function formatShortDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}`
}

function formatDateYYMMDD(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T12:00:00')
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  
  // Calculate days until/since
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  const diffMs = d.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000))
  
  // Format with brackets
  const formattedDate = `${m}/${day}`
  if (diffDays < 0) return `${formattedDate} [+${Math.abs(diffDays)}]`
  return `${formattedDate} [-${diffDays}]`
}

function formatDateYYMMDDParts(dateStr: string | null): { date: string; bracket: string } | null {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T12:00:00')
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  const diffMs = d.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000))
  
  const formattedDate = `${m}/${day}`
  const bracket = diffDays < 0 ? `[+${Math.abs(diffDays)}]` : `[-${diffDays}]`
  
  return { date: formattedDate, bracket }
}

function formatBidNameWithValue(bid: BidWithBuilder): string {
  const baseName = bidDisplayName(bid) || bid.customers?.name || bid.bids_gc_builders?.name || bid.id.slice(0, 8)
  
  if (bid.bid_value != null && bid.bid_value !== 0) {
    const valueInThousands = Number(bid.bid_value) / 1000
    const formattedValue = valueInThousands >= 10 ? valueInThousands.toFixed(0) : valueInThousands.toFixed(1)
    return `${baseName} (${formattedValue})`
  }
  
  return baseName
}

function formatDesignDrawingPlanDate(dateStr: string | null): string {
  if (!dateStr || !dateStr.trim()) return ''
  const d = new Date(dateStr.trim() + 'T12:00:00')
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear() % 100
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${m}-${day}-${String(y).padStart(2, '0')}`
}

function formatDesignDrawingPlanDateLabel(dateStr: string | null): string {
  if (!dateStr || !dateStr.trim()) return ''
  const d = new Date(dateStr.trim() + 'T12:00:00')
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear() % 100
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${day}/${m}/${String(y).padStart(2, '0')}`
}

function formatCompactCurrency(n: number | null): string {
  if (n == null) return '—'
  const k = n / 1000
  if (k % 1 === 0) return `$${k}k`
  return `$${k.toFixed(1)}k`
}

function formatBidValueShort(n: number | null): string {
  if (n == null) return '—'
  const valueInThousands = n / 1000
  return valueInThousands >= 10 ? valueInThousands.toFixed(0) : valueInThousands.toFixed(1)
}

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function bidDisplayName(b: Bid): string {
  return b.project_name || ''
}

function marginFlag(marginPercent: number | null): 'red' | 'yellow' | 'green' | null {
  if (marginPercent == null) return null
  if (marginPercent < 20) return 'red'
  if (marginPercent < 40) return 'yellow'
  return 'green'
}

/** Convert amount (e.g. 31420.50) to "Thirty One Thousand Four Hundred Twenty 50/100 Dollars" */
function numberToWords(amount: number): string {
  const whole = Math.floor(Math.abs(amount))
  const cents = Math.round((Math.abs(amount) - whole) * 100)
  const centsStr = String(cents).padStart(2, '0')
  const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  function toHundreds(n: number): string {
    if (n === 0) return ''
    if (n < 20) return ONES[n] ?? ''
    if (n < 100) return (TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + (ONES[n % 10] ?? '') : '')).trim()
    return ((ONES[Math.floor(n / 100)] ?? '') + ' Hundred' + (n % 100 ? ' ' + toHundreds(n % 100) : '')).trim()
  }
  function toWords(n: number): string {
    if (n === 0) return 'Zero'
    const thousands = Math.floor(n / 1000)
    const rest = n % 1000
    const th = thousands ? toHundreds(thousands) + ' Thousand' : ''
    const r = rest ? toHundreds(rest) : ''
    return (th + (th && r ? ' ' : '') + r).trim()
  }
  const words = toWords(whole)
  return `${words} ${centsStr}/100 Dollars`
}

const DEFAULT_TERMS_AND_WARRANTY =
  'All work to be completed in a workmanlike manner in accordance with uniform code and/or specifications; workmanship warranty of one year for new construction projects considering substantial completion date. All material is guaranteed to be as specified; warranty by manufacturer, labor not included. No liability, no warranty on customer provided materials. All agreements contingent upon strikes, accidents or delays beyond our control. This estimate is subject to acceptance within thirty (30) days and is void thereafter at the option of Click Plumbing. Any alteration or deviation from above specifications involving extra cost, including rock excavation and removal or haul-off of spoils or debris will become an extra charge over and above the estimate.'

const DEFAULT_EXCLUSIONS = `Concrete cutting, removal, and/or pour back is excluded from this proposal.
This proposal excludes all impact fees.
This proposal excludes any work not specifically described within.
This proposal excludes any electrical, fire protection, fire alarm, drywall, framing, or architectural finishes of any type.`

const DEFAULT_INCLUSIONS = 'Permits'

/** Split address on first comma into [street, city/state/zip] for combined document. */
function addressLines(addr: string): string[] {
  const trimmed = (addr ?? '').trim()
  if (!trimmed) return ['']
  const commaIdx = trimmed.indexOf(',')
  if (commaIdx < 0) return [trimmed]
  return [trimmed.slice(0, commaIdx).trim(), trimmed.slice(commaIdx + 1).trim()]
}

function escapeHtml(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildCoverLetterHtml(
  customerName: string,
  customerAddress: string,
  projectName: string,
  projectAddress: string,
  revenueWords: string,
  revenueNumber: string,
  fixtureRows: { fixture: string; count: number }[],
  inclusions: string,
  exclusions: string,
  terms: string,
  designDrawingPlanDateFormatted: string | null
): string {
  const inclusionIndent = '     ' // 5 preceding spaces for Additional Inclusions (same as fixture header)
  const inclusionLines = inclusions.trim().split(/\n/).filter(Boolean).map((l) => inclusionIndent + '• ' + l.trim())
  const inclusionLinesToUse = inclusions.trim() ? inclusionLines : DEFAULT_INCLUSIONS.trim().split(/\n/).filter(Boolean).map((l) => inclusionIndent + '• ' + l.trim())
  const exclusionIndent = '     ' // 5 preceding spaces for Exclusions
  const exclusionLines = exclusions.trim().split(/\n/).filter(Boolean).map((l) => exclusionIndent + '• ' + l.trim())
  const termsLines = terms.trim().split(/\n/).filter(Boolean).map((l) => '• ' + l.trim())
  const fixtureBlock =
    fixtureRows.length > 0
      ? '     • Fixtures provided and installed by us per plan:\n            ' + fixtureRows.map((r) => '• [' + r.count + '] ' + r.fixture).join('\n            ')
      : ''
  const inclusionsBlock = [fixtureBlock, ...inclusionLinesToUse].filter(Boolean).join('\n')
  const amountBold = `${revenueWords} (${revenueNumber})`
  const revenueLinePrefix = 'As per plumbing plans and specifications, we propose to do the plumbing in the amount of: '
  const br = '<br/>'
  const pStyle = 'margin: 0 0 0.5em 0'
  const paragraphs: string[] = []
  // Customer + blank line + Project + blank line + revenue (one paragraph: soft return, empty line, soft return between each block)
  const customerAddr = addressLines(customerAddress).map((l) => escapeHtml(l)).join(br)
  const projectAddr = addressLines(projectAddress).map((l) => escapeHtml(l)).join(br)
  const customerBlock = '<strong>' + escapeHtml(customerName) + '</strong><br/>' + customerAddr
  const projectBlock = '<strong>' + escapeHtml(projectName) + '</strong><br/>' + projectAddr + br + br + (escapeHtml(revenueLinePrefix) + '<strong>' + escapeHtml(amountBold) + '</strong>')
  paragraphs.push(customerBlock + br + br + projectBlock)
  if (designDrawingPlanDateFormatted) {
    paragraphs.push('<strong>Design Drawings Plan Date: ' + escapeHtml(designDrawingPlanDateFormatted) + '</strong>')
  }
  // Inclusions heading (one paragraph)
  paragraphs.push('<strong>Inclusions:</strong>')
  // Inclusions content (one paragraph, newlines → br)
  paragraphs.push(escapeHtml(inclusionsBlock || '(none)').replace(/\n/g, br))
  // Exclusions heading (one paragraph)
  paragraphs.push('<strong>Exclusions and Scope:</strong>')
  // Exclusions content (one paragraph, newlines → br)
  const exclusionsContent = exclusions.trim()
    ? exclusionLines.join('\n')
    : DEFAULT_EXCLUSIONS.trim().split(/\n/).filter(Boolean).map((l) => exclusionIndent + '• ' + l.trim()).join('\n')
  paragraphs.push(escapeHtml(exclusionsContent).replace(/\n/g, br))
  // Terms content (one paragraph, newlines → br; heading hidden in Combined Document)
  const termsContent = terms.trim() ? termsLines.join('\n') : DEFAULT_TERMS_AND_WARRANTY
  paragraphs.push(escapeHtml(termsContent).replace(/\n/g, br))
  // Remaining blocks (one paragraph each)
  paragraphs.push(escapeHtml('No work shall commence until Click Plumbing has received acceptance of the estimate.'))
  paragraphs.push(escapeHtml('Respectfully submitted by Click Plumbing'))
  paragraphs.push('')
  paragraphs.push(escapeHtml('_______________________________'))
  paragraphs.push(escapeHtml('The above prices, specifications, and conditions are satisfactory and are hereby accepted. You are authorized to perform the work as specified.'))
  paragraphs.push('')
  paragraphs.push('<strong>' + escapeHtml('Acceptance of estimate') + '</strong>')
  paragraphs.push(escapeHtml('General Contractor / Builder Signature:'))
  paragraphs.push('')
  paragraphs.push(escapeHtml('____________________________________'))
  paragraphs.push('')
  paragraphs.push(escapeHtml('Date: ____________________________________'))
  return '<div style="white-space: pre-wrap">' + paragraphs.map((p) => (p ? '<p style="' + pStyle + '">' + p + '</p>' : '<p style="' + pStyle + '">&nbsp;</p>')).join('') + '</div>'
}

type EvaluateChecklistItem = {
  id: string
  title: string
  body: string[]
}

const evaluateChecklist: EvaluateChecklistItem[] = [
  {
    id: 'location',
    title: 'LOCATION',
    body: [
      'Is the bid date feasible to produce a thorough and complete proposal?',
      'If not, is the potential reward for taking on the risk objectively worth it when our project expects or start? Will present signed from providing our best work on projects we associate with?',
      '(costs associated with traveling and supervision)',
    ],
  },
  {
    id: 'payment_terms',
    title: 'PAYMENT TERMS',
    body: [
      "Are we comfortable with the payment terms? Is this a client we've worked with before?",
      'If not, are the payment terms outlined clearly in the front end docs?',
      "Do we know we're getting paid?",
    ],
  },
  {
    id: 'bid_documents',
    title: 'BID DOCUMENTS',
    body: [
      'Are the available bid documents adequate to have a clear understanding of scope?',
      'Is there a clear procedure for submitting and answering questions?',
      'Is there a substantial amount of information missing where we would be forced to assume / qualify the bid?',
    ],
  },
  {
    id: 'competition',
    title: 'COMPETITION',
    body: [
      'Do we know the other bidders on this project?',
      'Are they familiar competitors? Are any bidders we know from previous projects where bidding against them could be difficult?',
      'Are they likely to self-perform some or all of the labor that we may be sub-contracting?',
    ],
  },
  {
    id: 'strengths',
    title: 'STRENGTHS',
    body: [
      'Does this project play to our strengths?',
      'Are we able to self-perform the work to give ourselves an advantage?',
      'Do we have specific subcontractors that we know will bid to us, with better pricing on significant scope items?',
    ],
  },
]

function buildCoverLetterText(
  customerName: string,
  customerAddress: string,
  projectName: string,
  projectAddress: string,
  revenueWords: string,
  revenueNumber: string,
  fixtureRows: { fixture: string; count: number }[],
  inclusions: string,
  exclusions: string,
  terms: string,
  designDrawingPlanDateFormatted: string | null
): string {
  const inclusionIndent = '     ' // 5 preceding spaces for Additional Inclusions (same as fixture header)
  const inclusionLines = inclusions.trim().split(/\n/).filter(Boolean).map((l) => inclusionIndent + '• ' + l.trim())
  const inclusionLinesToUse = inclusions.trim() ? inclusionLines : DEFAULT_INCLUSIONS.trim().split(/\n/).filter(Boolean).map((l) => inclusionIndent + '• ' + l.trim())
  const exclusionIndent = '     ' // 5 preceding spaces for Exclusions
  const exclusionLines = exclusions.trim().split(/\n/).filter(Boolean).map((l) => exclusionIndent + '• ' + l.trim())
  const termsLines = terms.trim().split(/\n/).filter(Boolean).map((l) => '• ' + l.trim())
  const fixtureBlock =
    fixtureRows.length > 0
      ? '     • Fixtures provided and installed by us per plan:\n            ' + fixtureRows.map((r) => '• [' + r.count + '] ' + r.fixture).join('\n            ')
      : ''
  const inclusionsBlock = [fixtureBlock, ...inclusionLinesToUse].filter(Boolean).join('\n')
  const lines: string[] = [
    customerName,
    ...addressLines(customerAddress),
    '',
    projectName,
    ...addressLines(projectAddress),
    '',
    `As per plumbing plans and specifications, we propose to do the plumbing in the amount of: ${revenueWords} (${revenueNumber})`,
    '',
    ...(designDrawingPlanDateFormatted ? ['Design Drawings Plan Date: ' + designDrawingPlanDateFormatted, ''] : []),
    'Inclusions:',
    inclusionsBlock || '(none)',
    '',
    'Exclusions and Scope:',
    exclusions.trim() ? exclusionLines.join('\n') : DEFAULT_EXCLUSIONS.trim().split(/\n/).filter(Boolean).map((l) => exclusionIndent + '• ' + l.trim()).join('\n'),
    '',
    terms.trim() ? termsLines.join('\n') : DEFAULT_TERMS_AND_WARRANTY,
    '',
    'No work shall commence until Click Plumbing has received acceptance of the estimate.',
    'Respectfully submitted by Click Plumbing',
    '',
    '_______________________________',
    'The above prices, specifications, and conditions are satisfactory and are hereby accepted. You are authorized to perform the work as specified.',
    '',
    'Acceptance of estimate',
    'General Contractor / Builder Signature:',
    '',
    '____________________________________',
    '',
    'Date: ____________________________________',
  ]
  return lines.join('\n')
}

export default function Bids() {
  const { user: authUser } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [myRole, setMyRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'bid-board' | 'counts' | 'takeoffs' | 'cost-estimate' | 'pricing' | 'cover-letter' | 'submission-followup'>('bid-board')
  
  // Service Types state
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState<string>('')
  const [estimatorServiceTypeIds, setEstimatorServiceTypeIds] = useState<string[] | null>(null)
  const [fixtureTypes, setFixtureTypes] = useState<Array<{ id: string; name: string }>>([])
  
  // Helper function to find fixture_type_id by name
  const getFixtureTypeIdByName = (name: string): string | null => {
    const normalized = name.trim().toLowerCase()
    const match = fixtureTypes.find(ft => ft.name.toLowerCase() === normalized)
    return match?.id || null
  }

  // Helper function to get or auto-create fixture type
  async function getOrCreateFixtureTypeId(name: string): Promise<string | null> {
    const trimmedName = name.trim()
    if (!trimmedName) return null
    if (!selectedServiceTypeId) return null
    
    // Check if it already exists (case-insensitive match)
    const existingId = getFixtureTypeIdByName(trimmedName)
    if (existingId) return existingId
    
    // Auto-create new fixture type
    const maxSeqResult = await supabase
      .from('fixture_types')
      .select('sequence_order')
      .eq('service_type_id', selectedServiceTypeId)
      .order('sequence_order', { ascending: false })
      .limit(1)
      .single()
    
    const nextSeq = (maxSeqResult.data?.sequence_order ?? 0) + 1
    
    const { data, error } = await supabase
      .from('fixture_types')
      .insert({
        service_type_id: selectedServiceTypeId,
        name: trimmedName,
        category: 'Other',
        sequence_order: nextSeq
      })
      .select('id')
      .single()
    
    if (error || !data) {
      console.error('Failed to create fixture type:', error)
      return null
    }
    
    // Reload fixture types to update autocomplete suggestions
    await loadFixtureTypes()
    
    return data.id
  }

  const [bids, setBids] = useState<BidWithBuilder[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [lastContactFromEntries, setLastContactFromEntries] = useState<Record<string, string>>({})

  // Bid Board
  const [bidBoardSearchQuery, setBidBoardSearchQuery] = useState('')
  const [bidBoardHideLost, setBidBoardHideLost] = useState(false)
  const [bidFormOpen, setBidFormOpen] = useState(false)
  const [editingBid, setEditingBid] = useState<BidWithBuilder | null>(null)
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null)
  const [viewingGcBuilder, setViewingGcBuilder] = useState<GcBuilder | null>(null)
  const [savingBid, setSavingBid] = useState(false)
  const [deleteConfirmProjectName, setDeleteConfirmProjectName] = useState('')
  const [deletingBid, setDeletingBid] = useState(false)
  const [deleteBidModalOpen, setDeleteBidModalOpen] = useState(false)
  const [gcCustomerId, setGcCustomerId] = useState('')
  const [gcCustomerSearch, setGcCustomerSearch] = useState('')
  const [gcCustomerDropdownOpen, setGcCustomerDropdownOpen] = useState(false)
  const [addCustomerModalOpen, setAddCustomerModalOpen] = useState(false)
  const [evaluateModalOpen, setEvaluateModalOpen] = useState(false)
  const [evaluateChecked, setEvaluateChecked] = useState<{ [key: string]: boolean }>({})
  const [showSentBidScript, setShowSentBidScript] = useState(false)
  const [showBidQuestionScript, setShowBidQuestionScript] = useState(false)

  const [driveLink, setDriveLink] = useState('')
  const [plansLink, setPlansLink] = useState('')
  const [bidSubmissionLink, setBidSubmissionLink] = useState('')
  const [projectName, setProjectName] = useState('')
  const [address, setAddress] = useState('')
  const [gcContactName, setGcContactName] = useState('')
  const [gcContactPhone, setGcContactPhone] = useState('')
  const [gcContactEmail, setGcContactEmail] = useState('')
  const [estimatorId, setEstimatorId] = useState('')
  const [estimatorUsers, setEstimatorUsers] = useState<EstimatorUser[]>([])
  const [accountManagerId, setAccountManagerId] = useState('')
  const [formServiceTypeId, setFormServiceTypeId] = useState('')
  const [bidDueDate, setBidDueDate] = useState('')
  const [estimatedJobStartDate, setEstimatedJobStartDate] = useState('')
  const [designDrawingPlanDate, setDesignDrawingPlanDate] = useState('')
  const [bidDateSent, setBidDateSent] = useState('')
  const [outcome, setOutcome] = useState<OutcomeOption>('')
  const [lossReason, setLossReason] = useState('')
  const [bidValue, setBidValue] = useState('')
  const [agreedValue, setAgreedValue] = useState('')
  const [profit, setProfit] = useState('')
  const [distanceFromOffice, setDistanceFromOffice] = useState('')
  const [lastContact, setLastContact] = useState('')
  const [notes, setNotes] = useState('')
  const [notesModalBid, setNotesModalBid] = useState<BidWithBuilder | null>(null)
  const [notesModalText, setNotesModalText] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  // Counts tab
  const [countsSearchQuery, setCountsSearchQuery] = useState('')
  const [selectedBidForCounts, setSelectedBidForCounts] = useState<BidWithBuilder | null>(null)
  const [countRows, setCountRows] = useState<BidCountRow[]>([])
  const [addingCountRow, setAddingCountRow] = useState(false)

  // Submission & Followup tab
  const [submissionSearchQuery, setSubmissionSearchQuery] = useState('')
  const [selectedBidForSubmission, setSelectedBidForSubmission] = useState<BidWithBuilder | null>(null)
  const submissionSummaryCardRef = useRef<HTMLDivElement>(null)
  const contactTableRef = useRef<HTMLDivElement | null>(null)
  const [scrollToContactFromBidBoard, setScrollToContactFromBidBoard] = useState(false)
  const [submissionEntries, setSubmissionEntries] = useState<BidSubmissionEntry[]>([])
  const [addingSubmissionEntry, setAddingSubmissionEntry] = useState(false)
  const [submissionBidHasCostEstimate, setSubmissionBidHasCostEstimate] = useState<boolean | 'loading' | null>(null)
  const [submissionReviewGroupCollapsed, setSubmissionReviewGroupCollapsed] = useState(true)
  const [submissionBidCostEstimateAmount, setSubmissionBidCostEstimateAmount] = useState<number | null>(null)
  const [submissionPricingByVersion, setSubmissionPricingByVersion] = useState<Array<{ versionId: string; versionName: string; revenue: number | null; margin: number | null; complete: boolean }>>([])
  const [submissionSectionOpen, setSubmissionSectionOpen] = useState({ unsent: true, pending: true, won: true, startedOrComplete: true, lost: false })
  const [selectedAccountManagerForPrint, setSelectedAccountManagerForPrint] = useState<string>('')
  const [, setTick] = useState(0)

  // Takeoffs tab
  const [takeoffSearchQuery, setTakeoffSearchQuery] = useState('')
  const [selectedBidForTakeoff, setSelectedBidForTakeoff] = useState<BidWithBuilder | null>(null)
  const [takeoffCountRows, setTakeoffCountRows] = useState<BidCountRow[]>([])
  const [takeoffMappings, setTakeoffMappings] = useState<TakeoffMapping[]>([])
  const [materialTemplates, setMaterialTemplates] = useState<MaterialTemplate[]>([])
  const [draftPOs, setDraftPOs] = useState<DraftPO[]>([])
  const [takeoffExistingPOId, setTakeoffExistingPOId] = useState('')
  const [takeoffCreatingPO, setTakeoffCreatingPO] = useState(false)
  const [takeoffAddingToPO, setTakeoffAddingToPO] = useState(false)
  const [takeoffSuccessMessage, setTakeoffSuccessMessage] = useState<string | null>(null)
  const [takeoffTemplatePickerOpenMappingId, setTakeoffTemplatePickerOpenMappingId] = useState<string | null>(null)
  const [takeoffTemplatePickerQuery, setTakeoffTemplatePickerQuery] = useState('')
  const [takeoffCreatedPOId, setTakeoffCreatedPOId] = useState<string | null>(null)
  const [takeoffTemplatePreviewCache, setTakeoffTemplatePreviewCache] = useState<Record<string, { part_name: string; quantity: number }[] | 'loading' | null>>({})
  const [takeoffPreviewModalTemplateId, setTakeoffPreviewModalTemplateId] = useState<string | null>(null)
  const [takeoffPreviewModalTemplateName, setTakeoffPreviewModalTemplateName] = useState<string | null>(null)
  const [takeoffExistingPOItems, setTakeoffExistingPOItems] = useState<Array<{ part_name: string; quantity: number; price_at_time: number; template_name: string | null }> | 'loading' | null>(null)
  const [takeoffBookVersions, setTakeoffBookVersions] = useState<TakeoffBookVersion[]>([])
  const [takeoffBookEntries, setTakeoffBookEntries] = useState<TakeoffBookEntryWithItems[]>([])
  const [selectedTakeoffBookVersionId, setSelectedTakeoffBookVersionId] = useState<string | null>(null)
  const [takeoffBookSectionOpen, setTakeoffBookSectionOpen] = useState(true)
  const [takeoffBookEntriesVersionId, setTakeoffBookEntriesVersionId] = useState<string | null>(null)
  const [takeoffBookVersionFormOpen, setTakeoffBookVersionFormOpen] = useState(false)
  const [editingTakeoffBookVersion, setEditingTakeoffBookVersion] = useState<TakeoffBookVersion | null>(null)
  const [takeoffBookVersionNameInput, setTakeoffBookVersionNameInput] = useState('')
  const [savingTakeoffBookVersion, setSavingTakeoffBookVersion] = useState(false)
  const [takeoffBookEntryFormOpen, setTakeoffBookEntryFormOpen] = useState(false)
  const [editingTakeoffBookEntry, setEditingTakeoffBookEntry] = useState<TakeoffBookEntryWithItems | null>(null)
  const [takeoffBookEntryFixtureName, setTakeoffBookEntryFixtureName] = useState('')
  const [takeoffBookEntryAliasNames, setTakeoffBookEntryAliasNames] = useState('')
  const [takeoffBookEntryItemRows, setTakeoffBookEntryItemRows] = useState<Array<{ templateId: string; stage: TakeoffStage }>>([{ templateId: '', stage: 'rough_in' }])
  const [savingTakeoffBookEntry, setSavingTakeoffBookEntry] = useState(false)
  const [applyingTakeoffBookTemplates, setApplyingTakeoffBookTemplates] = useState(false)
  const [takeoffBookApplyMessage, setTakeoffBookApplyMessage] = useState<string | null>(null)
  const [takeoffAddTemplateModalOpen, setTakeoffAddTemplateModalOpen] = useState(false)
  const [takeoffAddTemplateForMappingId, setTakeoffAddTemplateForMappingId] = useState<string | null>(null)
  const [takeoffNewTemplateName, setTakeoffNewTemplateName] = useState('')
  const [takeoffNewTemplateDescription, setTakeoffNewTemplateDescription] = useState('')
  const [takeoffNewTemplateItems, setTakeoffNewTemplateItems] = useState<Array<{ item_type: 'part' | 'template'; part_id: string | null; nested_template_id: string | null; quantity: number }>>([])
  
  type MaterialPartWithType = MaterialPart & { part_types?: PartType | null }
  const [takeoffAddTemplateParts, setTakeoffAddTemplateParts] = useState<MaterialPartWithType[]>([])
  
  const [takeoffNewItemType, setTakeoffNewItemType] = useState<'part' | 'template'>('part')
  const [takeoffNewItemPartId, setTakeoffNewItemPartId] = useState('')
  const [takeoffNewItemTemplateId, setTakeoffNewItemTemplateId] = useState('')
  const [takeoffNewItemQuantity, setTakeoffNewItemQuantity] = useState('1')
  const [takeoffNewItemPartSearchQuery, setTakeoffNewItemPartSearchQuery] = useState('')
  const [takeoffNewItemPartDropdownOpen, setTakeoffNewItemPartDropdownOpen] = useState(false)
  const [takeoffNewItemTemplateSearchQuery, setTakeoffNewItemTemplateSearchQuery] = useState('')
  const [takeoffNewItemTemplateDropdownOpen, setTakeoffNewItemTemplateDropdownOpen] = useState(false)
  
  // Part Form Modal state
  const [bidsPartFormOpen, setBidsPartFormOpen] = useState(false)
  const [bidsPartFormInitialName, setBidsPartFormInitialName] = useState('')
  const [supplyHouses, setSupplyHouses] = useState<SupplyHouse[]>([])
  const [partTypes, setPartTypes] = useState<PartType[]>([])
  const [savingTakeoffNewTemplate, setSavingTakeoffNewTemplate] = useState(false)

  // Add Parts to Template Modal state
  const [addPartsToTemplateModalOpen, setAddPartsToTemplateModalOpen] = useState(false)
  const [addPartsToTemplateId, setAddPartsToTemplateId] = useState<string | null>(null)
  const [addPartsToTemplateName, setAddPartsToTemplateName] = useState<string | null>(null)
  const [addPartsSelectedPartId, setAddPartsSelectedPartId] = useState('')
  const [addPartsQuantity, setAddPartsQuantity] = useState('1')
  const [addPartsSearchQuery, setAddPartsSearchQuery] = useState('')
  const [addPartsDropdownOpen, setAddPartsDropdownOpen] = useState(false)
  const [savingTemplateParts, setSavingTemplateParts] = useState(false)

  // Edit Template Modal state
  const [editTemplateModalOpen, setEditTemplateModalOpen] = useState(false)
  const [editTemplateModalId, setEditTemplateModalId] = useState<string | null>(null)
  const [editTemplateModalName, setEditTemplateModalName] = useState<string | null>(null)
  const [editTemplateItems, setEditTemplateItems] = useState<Array<{ id: string; item_type: string; part_id: string | null; nested_template_id: string | null; quantity: number; sequence_order: number }>>([])
  const [editTemplateNewItemType, setEditTemplateNewItemType] = useState<'part' | 'template'>('part')
  const [editTemplateNewItemPartId, setEditTemplateNewItemPartId] = useState('')
  const [editTemplateNewItemTemplateId, setEditTemplateNewItemTemplateId] = useState('')
  const [editTemplateNewItemQuantity, setEditTemplateNewItemQuantity] = useState('1')
  const [editTemplateNewItemPartSearchQuery, setEditTemplateNewItemPartSearchQuery] = useState('')
  const [editTemplateNewItemTemplateSearchQuery, setEditTemplateNewItemTemplateSearchQuery] = useState('')
  const [editTemplateNewItemPartDropdownOpen, setEditTemplateNewItemPartDropdownOpen] = useState(false)
  const [editTemplateNewItemTemplateDropdownOpen, setEditTemplateNewItemTemplateDropdownOpen] = useState(false)
  const [editTemplateAddingItem, setEditTemplateAddingItem] = useState(false)

  // Cost Estimate tab
  const [costEstimateSearchQuery, setCostEstimateSearchQuery] = useState('')
  const [selectedBidForCostEstimate, setSelectedBidForCostEstimate] = useState<BidWithBuilder | null>(null)
  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null)
  const [costEstimateLaborRows, setCostEstimateLaborRows] = useState<CostEstimateLaborRow[]>([])
  const [costEstimateCountRows, setCostEstimateCountRows] = useState<BidCountRow[]>([])
  const [purchaseOrdersForCostEstimate, setPurchaseOrdersForCostEstimate] = useState<CostEstimatePO[]>([])
  const [costEstimateMaterialTotalRoughIn, setCostEstimateMaterialTotalRoughIn] = useState<number | null>(null)
  const [costEstimateMaterialTotalTopOut, setCostEstimateMaterialTotalTopOut] = useState<number | null>(null)
  const [costEstimateMaterialTotalTrimSet, setCostEstimateMaterialTotalTrimSet] = useState<number | null>(null)
  const [laborRateInput, setLaborRateInput] = useState('')
  const [drivingCostRate, setDrivingCostRate] = useState('0.70')
  const [hoursPerTrip, setHoursPerTrip] = useState('2')
  const [savingCostEstimate, setSavingCostEstimate] = useState(false)
  const [costEstimatePOModalPoId, setCostEstimatePOModalPoId] = useState<string | null>(null)
  const [costEstimatePOModalData, setCostEstimatePOModalData] = useState<{ name: string; items: Array<{ part_name: string; quantity: number; price_at_time: number; template_name: string | null }> } | 'loading' | null>(null)
  const [costEstimatePOModalTaxPercent, setCostEstimatePOModalTaxPercent] = useState('8.25')
  const [laborBookVersions, setLaborBookVersions] = useState<LaborBookVersion[]>([])
  const [laborBookEntries, setLaborBookEntries] = useState<LaborBookEntryWithFixture[]>([])
  const [selectedLaborBookVersionId, setSelectedLaborBookVersionId] = useState<string | null>(null)
  const [laborBookEntriesVersionId, setLaborBookEntriesVersionId] = useState<string | null>(null)
  const costEstimateBidIdRef = useRef<string | null>(null)
  const [laborVersionFormOpen, setLaborVersionFormOpen] = useState(false)
  const [editingLaborVersion, setEditingLaborVersion] = useState<LaborBookVersion | null>(null)
  const [laborVersionNameInput, setLaborVersionNameInput] = useState('')
  const [savingLaborVersion, setSavingLaborVersion] = useState(false)
  const [laborEntryFormOpen, setLaborEntryFormOpen] = useState(false)
  const [editingLaborEntry, setEditingLaborEntry] = useState<LaborBookEntryWithFixture | null>(null)
  const [laborEntryFixtureName, setLaborEntryFixtureName] = useState('')
  const [laborEntryAliasNames, setLaborEntryAliasNames] = useState('')
  const [laborEntryRoughIn, setLaborEntryRoughIn] = useState('')
  const [laborEntryTopOut, setLaborEntryTopOut] = useState('')
  const [laborEntryTrimSet, setLaborEntryTrimSet] = useState('')
  const [savingLaborEntry, setSavingLaborEntry] = useState(false)
  const [applyingLaborBookHours, setApplyingLaborBookHours] = useState(false)
  const [laborBookApplyMessage, setLaborBookApplyMessage] = useState<string | null>(null)
  const [missingLaborBookFixtures, setMissingLaborBookFixtures] = useState<Set<string>>(new Set())
  const [addMissingFixtureModalOpen, setAddMissingFixtureModalOpen] = useState(false)
  const [addMissingFixtureName, setAddMissingFixtureName] = useState('')
  const [addMissingFixtureRoughIn, setAddMissingFixtureRoughIn] = useState('')
  const [addMissingFixtureTopOut, setAddMissingFixtureTopOut] = useState('')
  const [addMissingFixtureTrimSet, setAddMissingFixtureTrimSet] = useState('')
  const [savingMissingFixture, setSavingMissingFixture] = useState(false)
  const [laborBookSectionOpen, setLaborBookSectionOpen] = useState(true)
  const [costEstimateDistanceInput, setCostEstimateDistanceInput] = useState('')
  const [updatingBidDistance, setUpdatingBidDistance] = useState(false)
  const [bidDistanceUpdateSuccess, setBidDistanceUpdateSuccess] = useState(false)

  // Pricing tab
  const [pricingSearchQuery, setPricingSearchQuery] = useState('')
  const [priceBookSectionOpen, setPriceBookSectionOpen] = useState(true)
  const [selectedBidForPricing, setSelectedBidForPricing] = useState<BidWithBuilder | null>(null)
  const [priceBookVersions, setPriceBookVersions] = useState<PriceBookVersion[]>([])
  const [priceBookEntries, setPriceBookEntries] = useState<PriceBookEntryWithFixture[]>([])
  const [bidPricingAssignments, setBidPricingAssignments] = useState<BidPricingAssignment[]>([])
  const [selectedPricingVersionId, setSelectedPricingVersionId] = useState<string | null>(null)
  const pricingBidIdRef = useRef<string | null>(null)
  const [pricingCountRows, setPricingCountRows] = useState<BidCountRow[]>([])
  const [pricingCostEstimate, setPricingCostEstimate] = useState<CostEstimate | null>(null)
  const [pricingLaborRows, setPricingLaborRows] = useState<CostEstimateLaborRow[]>([])
  const [pricingMaterialTotalRoughIn, setPricingMaterialTotalRoughIn] = useState<number | null>(null)
  const [pricingMaterialTotalTopOut, setPricingMaterialTotalTopOut] = useState<number | null>(null)
  const [pricingMaterialTotalTrimSet, setPricingMaterialTotalTrimSet] = useState<number | null>(null)
  const [pricingLaborRate, setPricingLaborRate] = useState<number | null>(null)
  const [pricingVersionFormOpen, setPricingVersionFormOpen] = useState(false)
  const [editingPricingVersion, setEditingPricingVersion] = useState<PriceBookVersion | null>(null)
  const [pricingVersionNameInput, setPricingVersionNameInput] = useState('')
  const [savingPricingVersion, setSavingPricingVersion] = useState(false)
  const [pricingEntryFormOpen, setPricingEntryFormOpen] = useState(false)
  const [editingPricingEntry, setEditingPricingEntry] = useState<PriceBookEntryWithFixture | null>(null)
  const [pricingEntryFixtureName, setPricingEntryFixtureName] = useState('')
  const [pricingEntryRoughIn, setPricingEntryRoughIn] = useState('')
  const [pricingEntryTopOut, setPricingEntryTopOut] = useState('')
  const [pricingEntryTrimSet, setPricingEntryTrimSet] = useState('')
  const [pricingEntryTotal, setPricingEntryTotal] = useState('')
  const [savingPricingEntry, setSavingPricingEntry] = useState(false)
  const [savingPricingAssignment, setSavingPricingAssignment] = useState<string | null>(null)
  const [deletePricingVersionModalOpen, setDeletePricingVersionModalOpen] = useState(false)
  const [pricingVersionToDelete, setPricingVersionToDelete] = useState<PriceBookVersion | null>(null)
  const [deletePricingVersionNameInput, setDeletePricingVersionNameInput] = useState('')
  const [deletePricingVersionError, setDeletePricingVersionError] = useState<string | null>(null)
  const [priceBookSearchQuery, setPriceBookSearchQuery] = useState('')
  const [pricingAssignmentSearches, setPricingAssignmentSearches] = useState<Record<string, string>>({})
  const [pricingAssignmentDropdownOpen, setPricingAssignmentDropdownOpen] = useState<string | null>(null)
  const [pricingFixtureMaterialsFromTakeoff, setPricingFixtureMaterialsFromTakeoff] = useState<Record<string, number>>({})
  const [pricingRowBreakdownModalCountRow, setPricingRowBreakdownModalCountRow] = useState<BidCountRow | null>(null)

  // Cover Letter tab
  const [coverLetterInclusionsByBid, setCoverLetterInclusionsByBid] = useState<Record<string, string>>({})
  const [coverLetterExclusionsByBid, setCoverLetterExclusionsByBid] = useState<Record<string, string>>({})
  const [coverLetterTermsByBid, setCoverLetterTermsByBid] = useState<Record<string, string>>({})
  const [coverLetterIncludeDesignDrawingPlanDateByBid, setCoverLetterIncludeDesignDrawingPlanDateByBid] = useState<Record<string, boolean>>({})
  const [coverLetterTermsCollapsed, setCoverLetterTermsCollapsed] = useState(true)
  const [coverLetterSearchQuery, setCoverLetterSearchQuery] = useState('')
  const [coverLetterCopySuccess, setCoverLetterCopySuccess] = useState(false)
  const [coverLetterBidSubmissionQuickAddBidId, setCoverLetterBidSubmissionQuickAddBidId] = useState<string | null>(null)
  const [coverLetterBidSubmissionQuickAddValue, setCoverLetterBidSubmissionQuickAddValue] = useState('')
  const [applyingBidValue, setApplyingBidValue] = useState(false)
  const [bidValueAppliedSuccess, setBidValueAppliedSuccess] = useState(false)
  const [bidSubmissionQuickAddSuccess, setBidSubmissionQuickAddSuccess] = useState<string | null>(null)

  /** Set selected bid for Counts, Takeoffs, Cost Estimate, Pricing, and Submission so selection stays in sync across tabs. */
  function setSharedBid(bid: BidWithBuilder | null) {
    setSelectedBidForCounts(bid)
    setSelectedBidForTakeoff(bid)
    setSelectedBidForCostEstimate(bid)
    setSelectedBidForPricing(bid)
    setSelectedBidForSubmission(bid)
  }

  function toggleSubmissionSection(key: 'unsent' | 'pending' | 'won' | 'startedOrComplete' | 'lost') {
    setSubmissionSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  useEffect(() => {
    if (activeTab !== 'submission-followup') return
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [activeTab])

  useEffect(() => {
    if (coverLetterBidSubmissionQuickAddBidId != null && selectedBidForPricing?.id !== coverLetterBidSubmissionQuickAddBidId) {
      setCoverLetterBidSubmissionQuickAddBidId(null)
      setCoverLetterBidSubmissionQuickAddValue('')
    }
  }, [selectedBidForPricing?.id, coverLetterBidSubmissionQuickAddBidId])

  async function loadRole() {
    if (!authUser?.id) {
      setLoading(false)
      return
    }
    const { data: me, error: eMe } = await supabase
      .from('users')
      .select('role, estimator_service_type_ids')
      .eq('id', authUser.id)
      .single()
    if (eMe) {
      setError(eMe.message)
      setLoading(false)
      return
    }
    const role = (me as { role: UserRole; estimator_service_type_ids?: string[] | null } | null)?.role ?? null
    const estIds = (me as { estimator_service_type_ids?: string[] | null } | null)?.estimator_service_type_ids
    setMyRole(role)
    if (role === 'estimator' && estIds && estIds.length > 0) {
      setEstimatorServiceTypeIds(estIds)
    } else {
      setEstimatorServiceTypeIds(null)
    }
    if (role !== 'dev' && role !== 'master_technician' && role !== 'assistant' && role !== 'estimator') {
      setLoading(false)
      return
    }
  }

  async function loadEstimatorUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email')
      .order('name', { ascending: true, nullsFirst: false })
    if (error) return
    setEstimatorUsers((data as EstimatorUser[]) ?? [])
  }

  async function loadCustomers() {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, address, master_user_id')
      .order('name')
    if (error) {
      setError(`Failed to load customers: ${error.message}`)
      return
    }
    setCustomers((data as Customer[]) ?? [])
  }

  async function loadServiceTypes() {
    const { data, error } = await supabase
      .from('service_types' as any)
      .select('*')
      .order('sequence_order', { ascending: true })
    
    if (error) {
      setError(`Failed to load service types: ${error.message}`)
      return
    }
    
    const types = (data as unknown as ServiceType[]) ?? []
    setServiceTypes(types)
    
    // For estimators with restrictions, filter to allowed types
    const visibleTypes = estimatorServiceTypeIds && estimatorServiceTypeIds.length > 0
      ? types.filter((st) => estimatorServiceTypeIds.includes(st.id))
      : types
    const firstId = visibleTypes[0]?.id
    if (firstId) {
      setSelectedServiceTypeId((prev) => {
        if (!prev || !visibleTypes.some((st) => st.id === prev)) return firstId
        return prev
      })
    }
  }

  async function loadFixtureTypes() {
    if (!selectedServiceTypeId) return
    const { data, error } = await supabase
      .from('fixture_types')
      .select('id, name')
      .eq('service_type_id', selectedServiceTypeId)
      .order('name', { ascending: true })
    if (!error && data) {
      setFixtureTypes(data)
    }
  }

  async function loadPartTypes() {
    if (!selectedServiceTypeId) {
      setPartTypes([])
      return
    }
    
    const { data, error } = await supabase
      .from('part_types')
      .select('*')
      .eq('service_type_id', selectedServiceTypeId)
      .order('sequence_order', { ascending: true })
    
    if (error) {
      console.error('Failed to load part types:', error)
      setPartTypes([])
      return
    }
    
    setPartTypes((data as unknown as PartType[]) ?? [])
  }

  async function loadSupplyHouses() {
    const { data, error } = await supabase
      .from('supply_houses')
      .select('*')
      .order('name')
    if (error) {
      console.error('Failed to load supply houses:', error)
      return
    }
    setSupplyHouses((data as SupplyHouse[]) ?? [])
  }

  async function loadBids(): Promise<BidWithBuilder[]> {
    const { data, error } = await supabase
      .from('bids')
      .select('*, customers(*), bids_gc_builders(*), estimator:users!bids_estimator_id_fkey(id, name, email), account_manager:users!bids_account_manager_id_fkey(id, name, email), service_type:service_types(id, name, color)')
      .eq('service_type_id', selectedServiceTypeId)
      .order('bid_due_date', { ascending: false, nullsFirst: false })
    if (error) {
      setError(`Failed to load bids: ${error.message}`)
      return []
    }
    type Raw = Bid & {
      customers: Customer | Customer[] | null
      bids_gc_builders: GcBuilder | GcBuilder[] | null
      estimator?: EstimatorUser | EstimatorUser[] | null
      account_manager?: EstimatorUser | EstimatorUser[] | null
    }
    const raw = (data as unknown as Raw[]) ?? []
    const rows: BidWithBuilder[] = raw.map((b) => {
      const est = b.estimator
      const estimatorNorm = est == null ? null : Array.isArray(est) ? est[0] ?? null : est
      const am = b.account_manager
      const accountManagerNorm = am == null ? null : Array.isArray(am) ? am[0] ?? null : am
      return {
        ...b,
        customers: Array.isArray(b.customers) ? b.customers[0] ?? null : b.customers,
        bids_gc_builders: Array.isArray(b.bids_gc_builders) ? b.bids_gc_builders[0] ?? null : b.bids_gc_builders,
        estimator: estimatorNorm,
        account_manager: accountManagerNorm,
      }
    })
    setBids(rows)
    const { data: entriesData } = await supabase
      .from('bids_submission_entries')
      .select('bid_id, occurred_at')
    const latestByBid: Record<string, string> = {}
    for (const row of entriesData ?? []) {
      const bidId = (row as { bid_id: string; occurred_at: string | null }).bid_id
      const at = (row as { bid_id: string; occurred_at: string | null }).occurred_at
      if (!at) continue
      const existing = latestByBid[bidId]
      if (!existing || new Date(at) > new Date(existing)) latestByBid[bidId] = at
    }
    setLastContactFromEntries(latestByBid)
    return rows
  }

  function getCustomerDisplay(c: Customer): string {
    if (c.address) return `${c.name} - ${c.address}`
    return c.name
  }

  async function loadCountRows(bidId: string) {
    const { data, error } = await supabase
      .from('bids_count_rows')
      .select('*')
      .eq('bid_id', bidId)
      .order('sequence_order', { ascending: true })
    if (error) {
      setError(`Failed to load count rows: ${error.message}`)
      return
    }
    setCountRows((data as BidCountRow[]) ?? [])
  }

  function refreshAfterCountsChange() {
    const bidId = selectedBidForCounts?.id
    if (!bidId) return
    loadCountRows(bidId)
    if (selectedBidForTakeoff?.id === bidId) loadTakeoffCountRows(bidId)
    if (selectedBidForCostEstimate?.id === bidId) loadCostEstimateData(bidId, selectedLaborBookVersionId)
  }

  async function loadSubmissionEntries(bidId: string) {
    const { data, error } = await supabase
      .from('bids_submission_entries')
      .select('*')
      .eq('bid_id', bidId)
      .order('occurred_at', { ascending: false })
    if (error) {
      setError(`Failed to load submission entries: ${error.message}`)
      return
    }
    setSubmissionEntries((data as BidSubmissionEntry[]) ?? [])
  }

  async function loadTakeoffCountRows(bidId: string) {
    const { data, error } = await supabase
      .from('bids_count_rows')
      .select('*')
      .eq('bid_id', bidId)
      .order('sequence_order', { ascending: true })
    if (error) {
      setError(`Failed to load count rows: ${error.message}`)
      return
    }
    const rows = (data as BidCountRow[]) ?? []
    setTakeoffCountRows(rows)
    
    // Load existing template mappings from database
    const { data: mappingsData, error: mappingsError } = await supabase
      .from('bids_takeoff_template_mappings')
      .select('*')
      .eq('bid_id', bidId)
      .order('sequence_order', { ascending: true })
    
    if (mappingsError) {
      console.error('Failed to load takeoff mappings:', mappingsError)
      // Continue with empty mappings rather than blocking
    }
    
    const savedMappings = (mappingsData as any[] | null) ?? []
    
    // Build mappings: use saved mappings where they exist, create new ones for rows without mappings
    const mappings: TakeoffMapping[] = []
    
    for (const row of rows) {
      const saved = savedMappings.filter(m => m.count_row_id === row.id)
      
      if (saved.length > 0) {
        // Use existing mappings from database
        for (const s of saved) {
          mappings.push({
            id: s.id,
            countRowId: s.count_row_id,
            templateId: s.template_id,
            stage: s.stage as TakeoffStage,
            quantity: s.quantity,
            isSaved: true
          })
        }
      } else {
        // Create new empty mapping for rows without any
        mappings.push({
          id: crypto.randomUUID(),
          countRowId: row.id,
          templateId: '',
          stage: 'rough_in' as TakeoffStage,
          quantity: Number(row.count),
          isSaved: false
        })
      }
    }
    
    setTakeoffMappings(mappings)
  }

  async function loadMaterialTemplates() {
    if (!selectedServiceTypeId) {
      setMaterialTemplates([])
      return
    }
    const { data, error } = await supabase
      .from('material_templates')
      .select('*')
      .eq('service_type_id', selectedServiceTypeId)
      .order('name', { ascending: true })
    if (error) {
      setError(`Failed to load templates: ${error.message}`)
      return
    }
    setMaterialTemplates((data as MaterialTemplate[]) ?? [])
  }

  function closeTakeoffAddTemplateModal() {
    setTakeoffAddTemplateModalOpen(false)
    setTakeoffAddTemplateForMappingId(null)
    setTakeoffNewTemplateName('')
    setTakeoffNewTemplateDescription('')
    setTakeoffNewTemplateItems([])
    setTakeoffNewItemType('part')
    setTakeoffNewItemPartId('')
    setTakeoffNewItemTemplateId('')
    setTakeoffNewItemQuantity('1')
    setTakeoffNewItemPartSearchQuery('')
    setTakeoffNewItemTemplateSearchQuery('')
  }

  async function saveTakeoffNewTemplate(e: React.FormEvent) {
    e.preventDefault()
    const name = takeoffNewTemplateName.trim()
    if (!name) {
      setError('Assembly name is required')
      return
    }
    setSavingTakeoffNewTemplate(true)
    setError(null)
    const { data: templateData, error: templateError} = await supabase
      .from('material_templates')
      .insert({ name, description: takeoffNewTemplateDescription.trim() || null, service_type_id: selectedServiceTypeId })
      .select('id')
      .single()
    if (templateError) {
      setError(templateError.message)
      setSavingTakeoffNewTemplate(false)
      return
    }
    const templateId = (templateData as { id: string }).id
    for (let i = 0; i < takeoffNewTemplateItems.length; i++) {
      const item = takeoffNewTemplateItems[i]
      if (!item) continue
      const { error: itemError } = await supabase.from('material_template_items').insert({
        template_id: templateId,
        item_type: item.item_type,
        part_id: item.item_type === 'part' ? item.part_id : null,
        nested_template_id: item.item_type === 'template' ? item.nested_template_id : null,
        quantity: item.quantity,
        sequence_order: i + 1,
        notes: null,
      })
      if (itemError) {
        setError(itemError.message)
        setSavingTakeoffNewTemplate(false)
        return
      }
    }
    await loadMaterialTemplates()
    if (takeoffAddTemplateForMappingId) {
      setTakeoffMapping(takeoffAddTemplateForMappingId, { templateId })
    }
    closeTakeoffAddTemplateModal()
    setSavingTakeoffNewTemplate(false)
  }

  function addTakeoffNewTemplateItem() {
    if (takeoffNewItemType === 'part' && !takeoffNewItemPartId) return
    if (takeoffNewItemType === 'template' && !takeoffNewItemTemplateId) return
    const qty = Math.max(1, parseInt(takeoffNewItemQuantity, 10) || 1)
    setTakeoffNewTemplateItems((prev) => [
      ...prev,
      {
        item_type: takeoffNewItemType,
        part_id: takeoffNewItemType === 'part' ? takeoffNewItemPartId : null,
        nested_template_id: takeoffNewItemType === 'template' ? takeoffNewItemTemplateId : null,
        quantity: qty,
      },
    ])
    setTakeoffNewItemPartId('')
    setTakeoffNewItemTemplateId('')
    setTakeoffNewItemQuantity('1')
    setTakeoffNewItemPartSearchQuery('')
    setTakeoffNewItemTemplateSearchQuery('')
  }

  // Add Parts to Existing Template Modal Functions
  function openAddPartsToTemplateModal(templateId: string, templateName: string) {
    setAddPartsToTemplateId(templateId)
    setAddPartsToTemplateName(templateName)
    setAddPartsSelectedPartId('')
    setAddPartsQuantity('1')
    setAddPartsSearchQuery('')
    setAddPartsDropdownOpen(false)
    setAddPartsToTemplateModalOpen(true)
  }

  function closeAddPartsToTemplateModal() {
    setAddPartsToTemplateModalOpen(false)
    setAddPartsToTemplateId(null)
    setAddPartsToTemplateName(null)
    setAddPartsSelectedPartId('')
    setAddPartsQuantity('1')
    setAddPartsSearchQuery('')
    setAddPartsDropdownOpen(false)
  }

  // Edit Template Modal Functions
  async function openEditTemplateModal(templateId: string, templateName: string) {
    setEditTemplateModalId(templateId)
    setEditTemplateModalName(templateName)
    setEditTemplateNewItemType('part')
    setEditTemplateNewItemPartId('')
    setEditTemplateNewItemTemplateId('')
    setEditTemplateNewItemQuantity('1')
    setEditTemplateNewItemPartSearchQuery('')
    setEditTemplateNewItemTemplateSearchQuery('')
    setEditTemplateNewItemPartDropdownOpen(false)
    setEditTemplateNewItemTemplateDropdownOpen(false)
    setEditTemplateModalOpen(true)
    await loadEditTemplateItems(templateId)
  }

  function closeEditTemplateModal() {
    setEditTemplateModalOpen(false)
    setEditTemplateModalId(null)
    setEditTemplateModalName(null)
    setEditTemplateItems([])
    setEditTemplateNewItemPartId('')
    setEditTemplateNewItemTemplateId('')
    setEditTemplateNewItemQuantity('1')
    setEditTemplateNewItemPartSearchQuery('')
    setEditTemplateNewItemTemplateSearchQuery('')
  }

  async function loadEditTemplateItems(templateId: string) {
    const { data, error } = await supabase
      .from('material_template_items')
      .select('id, item_type, part_id, nested_template_id, quantity, sequence_order')
      .eq('template_id', templateId)
      .order('sequence_order', { ascending: true })
    if (error) {
      setError(`Failed to load template items: ${error.message}`)
      setEditTemplateItems([])
      return
    }
    setEditTemplateItems((data as Array<{ id: string; item_type: string; part_id: string | null; nested_template_id: string | null; quantity: number; sequence_order: number }>) ?? [])
  }

  async function addEditTemplateItem() {
    if (!editTemplateModalId) return
    if (editTemplateNewItemType === 'part' && !editTemplateNewItemPartId) {
      setError('Please select a part')
      return
    }
    if (editTemplateNewItemType === 'template' && !editTemplateNewItemTemplateId) {
      setError('Please select an assembly')
      return
    }
    const quantity = Math.max(1, parseInt(editTemplateNewItemQuantity, 10) || 1)
    if (editTemplateNewItemType === 'template' && editTemplateNewItemTemplateId === editTemplateModalId) {
      setError('Cannot add an assembly to itself')
      return
    }
    setEditTemplateAddingItem(true)
    setError(null)
    const maxOrder = editTemplateItems.length === 0 ? 0 : Math.max(...editTemplateItems.map((i) => i.sequence_order))
    const { error: insertError } = await supabase.from('material_template_items').insert({
      template_id: editTemplateModalId,
      item_type: editTemplateNewItemType,
      part_id: editTemplateNewItemType === 'part' ? editTemplateNewItemPartId : null,
      nested_template_id: editTemplateNewItemType === 'template' ? editTemplateNewItemTemplateId : null,
      quantity,
      sequence_order: maxOrder + 1,
      notes: null,
    })
    if (insertError) {
      setError(insertError.message)
    } else {
      await loadEditTemplateItems(editTemplateModalId)
      setEditTemplateNewItemPartId('')
      setEditTemplateNewItemTemplateId('')
      setEditTemplateNewItemQuantity('1')
      setEditTemplateNewItemPartSearchQuery('')
      setEditTemplateNewItemTemplateSearchQuery('')
      setTakeoffTemplatePreviewCache((prev) => ({ ...prev, [editTemplateModalId]: 'loading' }))
      getTemplatePartsPreview(supabase, editTemplateModalId)
        .then((res) => setTakeoffTemplatePreviewCache((p) => ({ ...p, [editTemplateModalId]: res })))
        .catch(() => setTakeoffTemplatePreviewCache((p) => ({ ...p, [editTemplateModalId]: null })))
    }
    setEditTemplateAddingItem(false)
  }

  async function removeEditTemplateItem(itemId: string) {
    if (!confirm('Remove this item from the assembly?')) return
    if (!editTemplateModalId) return
    setError(null)
    const { error: deleteError } = await supabase.from('material_template_items').delete().eq('id', itemId)
    if (deleteError) {
      setError(deleteError.message)
    } else {
      await loadEditTemplateItems(editTemplateModalId)
      setTakeoffTemplatePreviewCache((prev) => ({ ...prev, [editTemplateModalId]: 'loading' }))
      getTemplatePartsPreview(supabase, editTemplateModalId)
        .then((res) => setTakeoffTemplatePreviewCache((p) => ({ ...p, [editTemplateModalId]: res })))
        .catch(() => setTakeoffTemplatePreviewCache((p) => ({ ...p, [editTemplateModalId]: null })))
    }
  }

  async function savePartsToTemplate() {
    if (!addPartsToTemplateId || !addPartsSelectedPartId) return
    
    setSavingTemplateParts(true)
    setError(null)

    const qty = Math.max(1, parseInt(addPartsQuantity, 10) || 1)

    // Get the current max sequence_order for this template
    const { data: existingItems } = await supabase
      .from('material_template_items')
      .select('sequence_order')
      .eq('template_id', addPartsToTemplateId)
      .order('sequence_order', { ascending: false })
      .limit(1)

    const maxOrder = existingItems && existingItems.length > 0 ? (existingItems[0]?.sequence_order ?? 0) : 0

    const { error: insertError } = await supabase
      .from('material_template_items')
      .insert({
        template_id: addPartsToTemplateId,
        item_type: 'part',
        part_id: addPartsSelectedPartId,
        nested_template_id: null,
        quantity: qty,
        sequence_order: maxOrder + 1,
        notes: null,
      })

    if (insertError) {
      setError(insertError.message)
      setSavingTemplateParts(false)
      return
    }

    // Reload template previews
    await loadMaterialTemplates()
    
    // Reload the preview for this specific template
    setTakeoffTemplatePreviewCache((prev) => ({ ...prev, [addPartsToTemplateId]: 'loading' }))
    getTemplatePartsPreview(supabase, addPartsToTemplateId)
      .then((res) => setTakeoffTemplatePreviewCache((p) => ({ ...p, [addPartsToTemplateId]: res })))
      .catch(() => setTakeoffTemplatePreviewCache((p) => ({ ...p, [addPartsToTemplateId]: null })))
    
    setSavingTemplateParts(false)
    closeAddPartsToTemplateModal()
  }

  function removeTakeoffNewTemplateItem(index: number) {
    setTakeoffNewTemplateItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleBidsPartCreated(part: MaterialPart) {
    // Reload parts list for the takeoff modal (filtered by service type)
    const { data } = await supabase
      .from('material_parts')
      .select('*, part_types(*)')
      .eq('service_type_id', selectedServiceTypeId)
      .order('name', { ascending: true })
    
    if (data) {
      setTakeoffAddTemplateParts(data as MaterialPartWithType[])
      
      // Auto-select the newly created part for whichever modal is open
      if (addPartsToTemplateModalOpen) {
        setAddPartsSelectedPartId(part.id)
        setAddPartsSearchQuery('')
        setAddPartsDropdownOpen(false)
      } else if (editTemplateModalOpen) {
        setEditTemplateNewItemPartId(part.id)
        setEditTemplateNewItemPartSearchQuery('')
        setEditTemplateNewItemPartDropdownOpen(false)
      } else {
        setTakeoffNewItemPartId(part.id)
        setTakeoffNewItemPartSearchQuery('')
        setTakeoffNewItemPartDropdownOpen(false)
      }
    }
    
    setBidsPartFormOpen(false)
  }

  async function loadDraftPOs() {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('id, name')
      .eq('status', 'draft')
      .order('updated_at', { ascending: false })
    if (error) {
      setError(`Failed to load draft POs: ${error.message}`)
      return
    }
    setDraftPOs((data as DraftPO[]) ?? [])
  }

  async function loadTakeoffBookVersions() {
    if (!selectedServiceTypeId) return
    
    const { data, error } = await supabase
      .from('takeoff_book_versions')
      .select('*')
      .eq('service_type_id', selectedServiceTypeId)
      .order('name', { ascending: true })
    if (error) {
      setError(`Failed to load takeoff book versions: ${error.message}`)
      return
    }
    setTakeoffBookVersions((data as TakeoffBookVersion[]) ?? [])
  }

  async function loadTakeoffBookEntries(versionId: string | null) {
    if (!versionId) {
      setTakeoffBookEntries([])
      return
    }
    const { data: entriesData, error: entriesErr } = await supabase
      .from('takeoff_book_entries')
      .select('*')
      .eq('version_id', versionId)
      .order('sequence_order', { ascending: true })
      .order('fixture_name', { ascending: true })
    if (entriesErr) {
      setError(`Failed to load takeoff book entries: ${entriesErr.message}`)
      setTakeoffBookEntries([])
      return
    }
    const entries = (entriesData as TakeoffBookEntry[]) ?? []
    if (entries.length === 0) {
      setTakeoffBookEntries([])
      return
    }
    const entryIds = entries.map((e) => e.id)
    const { data: itemsData, error: itemsErr } = await supabase
      .from('takeoff_book_entry_items')
      .select('*')
      .in('entry_id', entryIds)
      .order('sequence_order', { ascending: true })
    if (itemsErr) {
      setError(`Failed to load takeoff book entry items: ${itemsErr.message}`)
      setTakeoffBookEntries([])
      return
    }
    const items = (itemsData as TakeoffBookEntryItem[]) ?? []
    const itemsByEntryId = new Map<string, TakeoffBookEntryItem[]>()
    for (const item of items) {
      const list = itemsByEntryId.get(item.entry_id) ?? []
      list.push(item)
      itemsByEntryId.set(item.entry_id, list)
    }
    const entriesWithItems: TakeoffBookEntryWithItems[] = entries.map((e) => ({
      ...e,
      items: itemsByEntryId.get(e.id) ?? [],
    }))
    setTakeoffBookEntries(entriesWithItems)
  }

  async function saveBidSelectedTakeoffBookVersion(bidId: string, versionId: string | null) {
    const { error: err } = await supabase
      .from('bids')
      .update({ selected_takeoff_book_version_id: versionId })
      .eq('id', bidId)
    if (err) {
      setError(`Failed to save takeoff book version: ${err.message}`)
      return
    }
    await loadBids()
  }

  async function loadPurchaseOrdersForCostEstimate() {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('id, name, stage')
      .order('updated_at', { ascending: false })
    if (error) {
      setError(`Failed to load purchase orders: ${error.message}`)
      return
    }
    setPurchaseOrdersForCostEstimate((data as CostEstimatePO[]) ?? [])
  }

  async function loadPOTotal(poId: string): Promise<number> {
    const { data, error } = await supabase
      .from('purchase_order_items')
      .select('price_at_time, quantity')
      .eq('purchase_order_id', poId)
    if (error) return 0
    const items = (data as { price_at_time: number; quantity: number }[]) ?? []
    return items.reduce((sum, i) => sum + Number(i.price_at_time) * Number(i.quantity), 0)
  }

  async function loadCostEstimate(bidId: string) {
    const { data: existing, error: e } = await supabase
      .from('cost_estimates')
      .select('*')
      .eq('bid_id', bidId)
      .maybeSingle()
    if (e) {
      setError(`Failed to load cost estimate: ${e.message}`)
      setCostEstimate(null)
      return null
    }
    const est = (existing as CostEstimate | null) ?? null
    setCostEstimate(est)
    if (est) {
      setLaborRateInput(est.labor_rate != null ? String(est.labor_rate) : '')
      setDrivingCostRate((est as any).driving_cost_rate?.toString() ?? '0.70')
      setHoursPerTrip((est as any).hours_per_trip?.toString() ?? '2')
      const rough = est.purchase_order_id_rough_in ? await loadPOTotal(est.purchase_order_id_rough_in) : 0
      const top = est.purchase_order_id_top_out ? await loadPOTotal(est.purchase_order_id_top_out) : 0
      const trim = est.purchase_order_id_trim_set ? await loadPOTotal(est.purchase_order_id_trim_set) : 0
      setCostEstimateMaterialTotalRoughIn(est.purchase_order_id_rough_in ? rough : null)
      setCostEstimateMaterialTotalTopOut(est.purchase_order_id_top_out ? top : null)
      setCostEstimateMaterialTotalTrimSet(est.purchase_order_id_trim_set ? trim : null)
    } else {
      setLaborRateInput('')
      setDrivingCostRate('0.70')
      setHoursPerTrip('2')
      setCostEstimateMaterialTotalRoughIn(null)
      setCostEstimateMaterialTotalTopOut(null)
      setCostEstimateMaterialTotalTrimSet(null)
    }
    return est
  }

  async function loadCostEstimateCountRows(bidId: string) {
    const { data, error } = await supabase
      .from('bids_count_rows')
      .select('*')
      .eq('bid_id', bidId)
      .order('sequence_order', { ascending: true })
    if (error) {
      setError(`Failed to load count rows: ${error.message}`)
      setCostEstimateCountRows([])
      return []
    }
    const rows = (data as BidCountRow[]) ?? []
    setCostEstimateCountRows(rows)
    return rows
  }

  async function loadFixtureLaborDefaults(): Promise<FixtureLaborDefault[]> {
    const { data, error } = await supabase.from('fixture_labor_defaults').select('*')
    if (error) return []
    return (data as FixtureLaborDefault[]) ?? []
  }

  async function loadCostEstimateLaborRowsAndSync(estimateId: string, countRows: BidCountRow[], defaults: FixtureLaborDefault[]) {
    const { data: laborData, error: laborErr } = await supabase
      .from('cost_estimate_labor_rows')
      .select('*')
      .eq('cost_estimate_id', estimateId)
      .order('sequence_order', { ascending: true })
    if (laborErr) {
      setError(`Failed to load labor rows: ${laborErr.message}`)
      setCostEstimateLaborRows([])
      return
    }
    let rows = (laborData as CostEstimateLaborRow[]) ?? []
    const countByFixture = new Map<string, number>()
    for (const r of countRows) countByFixture.set(r.fixture ?? '', Number(r.count))
    const fixtureSet = new Set(countRows.map((r) => r.fixture ?? ''))
    const maxSeq = rows.length === 0 ? 0 : Math.max(...rows.map((r) => r.sequence_order))
    let seq = maxSeq
    for (const cr of countRows) {
      const existing = rows.find((l) => (l.fixture ?? '') === (cr.fixture ?? ''))
      const countVal = Number(cr.count)
      if (!existing) {
        const def = defaults.find((d) => d.fixture.toLowerCase() === (cr.fixture ?? '').toLowerCase())
        // If not found in primary defaults (labor book), fall back to fixture_labor_defaults
        let hours = { rough_in_hrs: 0, top_out_hrs: 0, trim_set_hrs: 0 }
        if (def) {
          hours = { rough_in_hrs: def.rough_in_hrs, top_out_hrs: def.top_out_hrs, trim_set_hrs: def.trim_set_hrs }
        } else {
          // Load from fixture_labor_defaults as fallback
          const { data: fallbackData } = await supabase
            .from('fixture_labor_defaults')
            .select('*')
            .ilike('fixture', cr.fixture ?? '')
            .limit(1)
            .maybeSingle()
          if (fallbackData) {
            hours = { 
              rough_in_hrs: Number(fallbackData.rough_in_hrs), 
              top_out_hrs: Number(fallbackData.top_out_hrs), 
              trim_set_hrs: Number(fallbackData.trim_set_hrs) 
            }
          }
        }
        
        const { data: inserted, error: insErr } = await supabase
          .from('cost_estimate_labor_rows')
          .insert({
            cost_estimate_id: estimateId,
            fixture: cr.fixture ?? '',
            count: countVal,
            rough_in_hrs_per_unit: hours.rough_in_hrs,
            top_out_hrs_per_unit: hours.top_out_hrs,
            trim_set_hrs_per_unit: hours.trim_set_hrs,
            sequence_order: ++seq,
            is_fixed: false,
          })
          .select('*')
          .single()
        if (!insErr && inserted) rows = [...rows, inserted as CostEstimateLaborRow]
      } else if (Number(existing.count) !== countVal) {
        await supabase.from('cost_estimate_labor_rows').update({ count: countVal }).eq('id', existing.id)
      }
    }
    const toDelete = rows.filter((r) => !fixtureSet.has(r.fixture ?? ''))
    for (const r of toDelete) {
      await supabase.from('cost_estimate_labor_rows').delete().eq('id', r.id)
    }
    const { data: refetched } = await supabase
      .from('cost_estimate_labor_rows')
      .select('*')
      .eq('cost_estimate_id', estimateId)
      .order('sequence_order', { ascending: true })
    setCostEstimateLaborRows((refetched as CostEstimateLaborRow[]) ?? [])
  }

  async function ensureCostEstimateForBid(bidId: string): Promise<CostEstimate | null> {
    let est = await loadCostEstimate(bidId)
    if (!est && authUser?.id) {
      const { data: inserted, error: insErr } = await supabase
        .from('cost_estimates')
        .insert({ bid_id: bidId })
        .select('*')
        .single()
      if (insErr) {
        setError(`Failed to create cost estimate: ${insErr.message}`)
        return null
      }
      est = inserted as CostEstimate
      setCostEstimate(est)
    }
    return est
  }

  async function loadCostEstimateData(bidId: string, laborBookVersionId: string | null) {
    const countRows = await loadCostEstimateCountRows(bidId)
    if (countRows.length === 0) {
      setCostEstimateLaborRows([])
      const est = await loadCostEstimate(bidId)
      if (!est) await ensureCostEstimateForBid(bidId)
      return
    }
    const est = await ensureCostEstimateForBid(bidId)
    if (!est) return
    let defaults: FixtureLaborDefault[]
    if (laborBookVersionId) {
      const { data: entries, error } = await supabase
        .from('labor_book_entries')
        .select('*, fixture_types(name)')
        .eq('version_id', laborBookVersionId)
        .order('sequence_order', { ascending: true })
      if (error || !entries?.length) {
        defaults = await loadFixtureLaborDefaults()
      } else {
        const map = new Map<string, { rough_in_hrs: number; top_out_hrs: number; trim_set_hrs: number }>()
        for (const e of entries as (LaborBookEntry & { fixture_types?: { name: string } | null })[]) {
          const hours = { rough_in_hrs: Number(e.rough_in_hrs), top_out_hrs: Number(e.top_out_hrs), trim_set_hrs: Number(e.trim_set_hrs) }
          const primary = (e.fixture_types?.name ?? '').trim().toLowerCase()
          if (primary && !map.has(primary)) map.set(primary, hours)
          for (const name of e.alias_names ?? []) {
            const key = name.trim().toLowerCase()
            if (key && !map.has(key)) map.set(key, hours)
          }
        }
        defaults = Array.from(map.entries()).map(([fixture, hrs]) => ({ fixture, ...hrs }))
      }
    } else {
      defaults = await loadFixtureLaborDefaults()
    }
    await loadCostEstimateLaborRowsAndSync(est.id, countRows, defaults)
  }

  async function loadLaborBookVersions() {
    if (!selectedServiceTypeId) return
    
    const { data, error } = await supabase
      .from('labor_book_versions')
      .select('*')
      .eq('service_type_id', selectedServiceTypeId)
      .order('name', { ascending: true })
    if (error) {
      setError(`Failed to load labor book versions: ${error.message}`)
      return
    }
    setLaborBookVersions((data as LaborBookVersion[]) ?? [])
  }

  async function loadLaborBookEntries(versionId: string | null) {
    if (!versionId) {
      setLaborBookEntries([])
      return
    }
    const { data, error } = await supabase
      .from('labor_book_entries')
      .select('*, fixture_types(name)')
      .eq('version_id', versionId)
      .order('sequence_order', { ascending: true })
      .order('fixture_types(name)', { ascending: true })
    if (error) {
      setError(`Failed to load labor book entries: ${error.message}`)
      setLaborBookEntries([])
      return
    }
    setLaborBookEntries((data as LaborBookEntry[]) ?? [])
  }

  async function saveBidSelectedLaborBookVersion(bidId: string, versionId: string | null) {
    const { error: err } = await supabase
      .from('bids')
      .update({ selected_labor_book_version_id: versionId })
      .eq('id', bidId)
    if (err) {
      setError(`Failed to save labor book version: ${err.message}`)
      return
    }
    await loadBids()
  }

  async function handleLaborBookVersionChange(bidId: string, versionId: string) {
    setSelectedLaborBookVersionId(versionId)
    await saveBidSelectedLaborBookVersion(bidId, versionId)
    await loadCostEstimateData(bidId, versionId)
  }

  async function loadPriceBookVersions() {
    if (!selectedServiceTypeId) return
    
    const { data, error } = await supabase
      .from('price_book_versions')
      .select('*')
      .eq('service_type_id', selectedServiceTypeId)
      .order('name', { ascending: true })
    if (error) {
      setError(`Failed to load price book versions: ${error.message}`)
      return
    }
    setPriceBookVersions((data as PriceBookVersion[]) ?? [])
  }

  async function loadPriceBookEntries(versionId: string | null) {
    if (!versionId) {
      setPriceBookEntries([])
      return
    }
    const { data, error } = await supabase
      .from('price_book_entries')
      .select('*, fixture_types(name)')
      .eq('version_id', versionId)
    if (error) {
      setError(`Failed to load price book entries: ${error.message}`)
      setPriceBookEntries([])
      return
    }
    const entries = (data as PriceBookEntryWithFixture[]) ?? []
    entries.sort((a, b) => (a.fixture_types?.name ?? '').localeCompare(b.fixture_types?.name ?? '', undefined, { numeric: true }))
    setPriceBookEntries(entries)
  }

  async function loadBidPricingAssignments(bidId: string, versionId: string | null) {
    if (versionId == null) {
      setBidPricingAssignments([])
      return
    }
    const { data, error } = await supabase
      .from('bid_pricing_assignments')
      .select('*')
      .eq('bid_id', bidId)
      .eq('price_book_version_id', versionId)
    if (error) {
      setError(`Failed to load pricing assignments: ${error.message}`)
      setBidPricingAssignments([])
      return
    }
    setBidPricingAssignments((data as BidPricingAssignment[]) ?? [])
  }

  async function loadPricingDataForBid(bidId: string) {
    const { data: countData, error: countErr } = await supabase
      .from('bids_count_rows')
      .select('*')
      .eq('bid_id', bidId)
      .order('sequence_order', { ascending: true })
    if (countErr) {
      setPricingCountRows([])
      setPricingCostEstimate(null)
      setPricingLaborRows([])
      setPricingMaterialTotalRoughIn(null)
      setPricingMaterialTotalTopOut(null)
      setPricingMaterialTotalTrimSet(null)
      setPricingLaborRate(null)
      setPricingFixtureMaterialsFromTakeoff({})
      return
    }
    const countRows = (countData as BidCountRow[]) ?? []
    setPricingCountRows(countRows)
    const { data: estData, error: estErr } = await supabase
      .from('cost_estimates')
      .select('*')
      .eq('bid_id', bidId)
      .maybeSingle()
    if (estErr || !estData) {
      setPricingCostEstimate(null)
      setPricingLaborRows([])
      setPricingMaterialTotalRoughIn(null)
      setPricingMaterialTotalTopOut(null)
      setPricingMaterialTotalTrimSet(null)
      setPricingLaborRate(null)
      setPricingFixtureMaterialsFromTakeoff({})
      return
    }
    const est = estData as CostEstimate
    setPricingCostEstimate(est)
    setPricingLaborRate(est.labor_rate != null ? Number(est.labor_rate) : null)
    const [roughTotal, topTotal, trimTotal] = await Promise.all([
      est.purchase_order_id_rough_in ? loadPOTotal(est.purchase_order_id_rough_in) : Promise.resolve(0),
      est.purchase_order_id_top_out ? loadPOTotal(est.purchase_order_id_top_out) : Promise.resolve(0),
      est.purchase_order_id_trim_set ? loadPOTotal(est.purchase_order_id_trim_set) : Promise.resolve(0),
    ])
    setPricingMaterialTotalRoughIn(est.purchase_order_id_rough_in ? roughTotal : null)
    setPricingMaterialTotalTopOut(est.purchase_order_id_top_out ? topTotal : null)
    setPricingMaterialTotalTrimSet(est.purchase_order_id_trim_set ? trimTotal : null)
    const { data: laborData, error: laborErr } = await supabase
      .from('cost_estimate_labor_rows')
      .select('*')
      .eq('cost_estimate_id', est.id)
      .order('sequence_order', { ascending: true })
    if (laborErr) {
      setPricingLaborRows([])
      setPricingFixtureMaterialsFromTakeoff({})
      return
    }
    setPricingLaborRows((laborData as CostEstimateLaborRow[]) ?? [])

    // Load takeoff mappings for per-fixture materials
    const { data: mappingsData } = await supabase
      .from('bids_takeoff_template_mappings')
      .select('id, count_row_id, template_id, stage, quantity')
      .eq('bid_id', bidId)
    // Load PO items for part prices (part_id -> price_at_time per stage)
    const loadPOItems = async (poId: string | null) => {
      if (!poId) return []
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select('part_id, quantity, price_at_time')
        .eq('purchase_order_id', poId)
      if (error) return []
      return (data as Array<{ part_id: string; quantity: number; price_at_time: number }>) ?? []
    }
    const [roughItems, topItems, trimItems] = await Promise.all([
      loadPOItems(est.purchase_order_id_rough_in),
      loadPOItems(est.purchase_order_id_top_out),
      loadPOItems(est.purchase_order_id_trim_set),
    ])
    // Compute per-fixture materials from takeoff (expandTemplate + PO part prices)
    const partPriceByStage: Record<string, Record<string, number>> = {
      rough_in: Object.fromEntries(roughItems.map((i) => [i.part_id, i.price_at_time])),
      top_out: Object.fromEntries(topItems.map((i) => [i.part_id, i.price_at_time])),
      trim_set: Object.fromEntries(trimItems.map((i) => [i.part_id, i.price_at_time])),
    }
    const mappings = (mappingsData as Array<{ id: string; count_row_id: string; template_id: string; stage: string; quantity: number }>) ?? []
    const fixtureMaterials: Record<string, number> = {}
    for (const countRow of countRows) {
      const rowMappings = mappings.filter((m) => m.count_row_id === countRow.id)
      if (rowMappings.length === 0) continue
      let sum = 0
      for (const m of rowMappings) {
        const parts = await expandTemplate(supabase, m.template_id, m.quantity)
        const priceMap = partPriceByStage[m.stage] ?? {}
        for (const { part_id, quantity } of parts) {
          const price = priceMap[part_id] ?? 0
          sum += quantity * price
        }
      }
      fixtureMaterials[countRow.id] = sum
    }
    setPricingFixtureMaterialsFromTakeoff(fixtureMaterials)
  }

  async function saveBidSelectedPriceBookVersion(bidId: string, versionId: string | null) {
    const { error: err } = await supabase
      .from('bids')
      .update({ selected_price_book_version_id: versionId })
      .eq('id', bidId)
    if (err) {
      setError(`Failed to save version: ${err.message}`)
      return
    }
    await loadBids()
  }

  async function savePricingAssignment(countRowId: string, priceBookEntryId: string) {
    const bidId = selectedBidForPricing?.id
    const versionId = selectedPricingVersionId
    if (!bidId || !versionId) return
    setSavingPricingAssignment(countRowId)
    const existing = bidPricingAssignments.find((a) => a.count_row_id === countRowId && a.price_book_version_id === versionId)
    if (existing) {
      const { error: err } = await supabase
        .from('bid_pricing_assignments')
        .update({ price_book_entry_id: priceBookEntryId })
        .eq('id', existing.id)
      if (err) setError(err.message)
      else await loadBidPricingAssignments(bidId, versionId)
    } else {
      const { error: err } = await supabase
        .from('bid_pricing_assignments')
        .insert({ bid_id: bidId, count_row_id: countRowId, price_book_entry_id: priceBookEntryId, price_book_version_id: versionId })
      if (err) setError(err.message)
      else await loadBidPricingAssignments(bidId, versionId)
    }
    setSavingPricingAssignment(null)
  }

  async function removePricingAssignment(countRowId: string) {
    const bidId = selectedBidForPricing?.id
    const versionId = selectedPricingVersionId
    if (!bidId || !versionId) return
    const existing = bidPricingAssignments.find((a) => a.count_row_id === countRowId && a.price_book_version_id === versionId)
    if (!existing) return
    const { error: err } = await supabase.from('bid_pricing_assignments').delete().eq('id', existing.id)
    if (err) setError(err.message)
    else await loadBidPricingAssignments(bidId, versionId)
  }

  async function togglePricingAssignmentFixedPrice(countRowId: string) {
    const bidId = selectedBidForPricing?.id
    const versionId = selectedPricingVersionId
    if (!bidId || !versionId) return
    
    const existing = bidPricingAssignments.find(
      (a) => a.count_row_id === countRowId && a.price_book_version_id === versionId
    )
    if (!existing) return
    
    const { error: err } = await supabase
      .from('bid_pricing_assignments')
      .update({ is_fixed_price: !existing.is_fixed_price })
      .eq('id', existing.id)
    
    if (err) setError(err.message)
    else await loadBidPricingAssignments(bidId, versionId)
  }

  function openNewPricingVersion() {
    setEditingPricingVersion(null)
    setPricingVersionNameInput('')
    setPricingVersionFormOpen(true)
  }

  function openEditPricingVersion(v: PriceBookVersion) {
    setEditingPricingVersion(v)
    setPricingVersionNameInput(v.name)
    setPricingVersionFormOpen(true)
  }

  function closePricingVersionForm() {
    setPricingVersionFormOpen(false)
    setEditingPricingVersion(null)
    setPricingVersionNameInput('')
  }

  async function savePricingVersion(e: React.FormEvent) {
    e.preventDefault()
    const name = pricingVersionNameInput.trim()
    if (!name) return
    
    // Check for duplicate name (case-insensitive)
    const isDuplicate = priceBookVersions.some((v) => 
      v.name.toLowerCase() === name.toLowerCase() && 
      v.id !== editingPricingVersion?.id
    )
    
    if (isDuplicate) {
      setError(`A price book named "${name}" already exists. Please use a different name.`)
      return
    }
    
    setSavingPricingVersion(true)
    setError(null)
    if (editingPricingVersion) {
      const { error: err } = await supabase.from('price_book_versions').update({ name }).eq('id', editingPricingVersion.id)
      if (err) setError(err.message)
      else {
        await loadPriceBookVersions()
        closePricingVersionForm()
      }
    } else {
      const { error: err } = await supabase.from('price_book_versions').insert({ name, service_type_id: selectedServiceTypeId })
      if (err) setError(err.message)
      else {
        await loadPriceBookVersions()
        closePricingVersionForm()
      }
    }
    setSavingPricingVersion(false)
  }

  function openDeletePricingVersionModal(v: PriceBookVersion) {
    setPricingVersionToDelete(v)
    setDeletePricingVersionNameInput('')
    setDeletePricingVersionError(null)
    setDeletePricingVersionModalOpen(true)
  }

  async function confirmDeletePricingVersion() {
    if (!pricingVersionToDelete) {
      setDeletePricingVersionModalOpen(false)
      return
    }
    const expected = pricingVersionToDelete.name.trim()
    const typed = deletePricingVersionNameInput.trim()
    if (typed !== expected) {
      setDeletePricingVersionError('Name does not match. Type the version name exactly to confirm.')
      return
    }

    const { error: err } = await supabase
      .from('price_book_versions')
      .delete()
      .eq('id', pricingVersionToDelete.id)
    if (err) {
      setDeletePricingVersionError(err.message)
      return
    }

    await loadPriceBookVersions()
    if (selectedPricingVersionId === pricingVersionToDelete.id) {
      setSelectedPricingVersionId(null)
      setPriceBookEntries([])
      if (selectedBidForPricing?.selected_price_book_version_id === pricingVersionToDelete.id) {
        saveBidSelectedPriceBookVersion(selectedBidForPricing.id, null)
        await loadBids()
      }
    }

    setDeletePricingVersionModalOpen(false)
    setPricingVersionToDelete(null)
    setDeletePricingVersionNameInput('')
    setDeletePricingVersionError(null)
  }

  function openNewPricingEntry() {
    setEditingPricingEntry(null)
    setPricingEntryFixtureName('')
    setPricingEntryRoughIn('')
    setPricingEntryTopOut('')
    setPricingEntryTrimSet('')
    setPricingEntryTotal('')
    setError(null)
    setPricingEntryFormOpen(true)
  }

  function openEditPricingEntry(entry: PriceBookEntryWithFixture) {
    setEditingPricingEntry(entry)
    setPricingEntryFixtureName(entry.fixture_types?.name ?? '')
    setPricingEntryRoughIn(String(entry.rough_in_price))
    setPricingEntryTopOut(String(entry.top_out_price))
    setPricingEntryTrimSet(String(entry.trim_set_price))
    setPricingEntryTotal(String(entry.total_price))
    setError(null)
    setPricingEntryFormOpen(true)
  }

  function closePricingEntryForm() {
    setPricingEntryFormOpen(false)
    setEditingPricingEntry(null)
    setPricingEntryFixtureName('')
    setPricingEntryRoughIn('')
    setPricingEntryTopOut('')
    setPricingEntryTrimSet('')
    setPricingEntryTotal('')
    setError(null)
  }

  async function savePricingEntry(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPricingVersionId) {
      setError('No price book version selected')
      return
    }
    const fixtureName = pricingEntryFixtureName.trim()
    if (!fixtureName) {
      setError('Please enter a fixture type')
      return
    }
    
    setSavingPricingEntry(true)
    setError(null)
    
    // Get or auto-create fixture type
    const fixtureTypeId = await getOrCreateFixtureTypeId(fixtureName)
    if (!fixtureTypeId) {
      setError(`Failed to create or find fixture type "${fixtureName}"`)
      setSavingPricingEntry(false)
      return
    }
    
    const rough = parseFloat(pricingEntryRoughIn) || 0
    const top = parseFloat(pricingEntryTopOut) || 0
    const trim = parseFloat(pricingEntryTrimSet) || 0
    const total = parseFloat(pricingEntryTotal) || 0
    if (editingPricingEntry) {
      const { error: err } = await supabase
        .from('price_book_entries')
        .update({ fixture_type_id: fixtureTypeId, rough_in_price: rough, top_out_price: top, trim_set_price: trim, total_price: total })
        .eq('id', editingPricingEntry.id)
      if (err) setError(err.message)
      else {
        await loadPriceBookEntries(selectedPricingVersionId)
        closePricingEntryForm()
      }
    } else {
      const maxSeq = priceBookEntries.length === 0 ? 0 : Math.max(...priceBookEntries.map((e) => e.sequence_order))
      const { error: err } = await supabase
        .from('price_book_entries')
        .insert({ version_id: selectedPricingVersionId, fixture_type_id: fixtureTypeId, rough_in_price: rough, top_out_price: top, trim_set_price: trim, total_price: total, sequence_order: maxSeq + 1 })
      if (err) setError(err.message)
      else {
        await loadPriceBookEntries(selectedPricingVersionId)
        closePricingEntryForm()
      }
    }
    setSavingPricingEntry(false)
  }

  async function deletePricingEntry(entry: PriceBookEntryWithFixture) {
    if (!confirm(`Delete "${entry.fixture_types?.name ?? ''}" from this price book?`)) return
    const { error: err } = await supabase.from('price_book_entries').delete().eq('id', entry.id)
    if (err) setError(err.message)
    else if (selectedPricingVersionId) await loadPriceBookEntries(selectedPricingVersionId)
  }

  function openNewLaborVersion() {
    setEditingLaborVersion(null)
    setLaborVersionNameInput('')
    setLaborVersionFormOpen(true)
  }

  function openEditLaborVersion(v: LaborBookVersion) {
    setEditingLaborVersion(v)
    setLaborVersionNameInput(v.name)
    setLaborVersionFormOpen(true)
  }

  function closeLaborVersionForm() {
    setLaborVersionFormOpen(false)
    setEditingLaborVersion(null)
    setLaborVersionNameInput('')
  }

  async function saveLaborVersion(e: React.FormEvent) {
    e.preventDefault()
    const name = laborVersionNameInput.trim()
    if (!name) return
    setSavingLaborVersion(true)
    setError(null)
    if (editingLaborVersion) {
      const { error: err } = await supabase.from('labor_book_versions').update({ name }).eq('id', editingLaborVersion.id)
      if (err) setError(err.message)
      else {
        await loadLaborBookVersions()
        closeLaborVersionForm()
      }
    } else {
      const { error: err } = await supabase.from('labor_book_versions').insert({ name, service_type_id: selectedServiceTypeId })
      if (err) setError(err.message)
      else {
        await loadLaborBookVersions()
        closeLaborVersionForm()
      }
    }
    setSavingLaborVersion(false)
  }

  async function deleteLaborVersion(v: LaborBookVersion) {
    if (!confirm(`Delete labor book "${v.name}"? This will delete all entries in this version.`)) return
    const { error: err } = await supabase.from('labor_book_versions').delete().eq('id', v.id)
    if (err) setError(err.message)
    else {
      await loadLaborBookVersions()
      if (laborBookEntriesVersionId === v.id) {
        setLaborBookEntriesVersionId(null)
        setLaborBookEntries([])
      }
      if (selectedLaborBookVersionId === v.id) {
        setSelectedLaborBookVersionId(null)
        if (selectedBidForCostEstimate?.selected_labor_book_version_id === v.id) {
          saveBidSelectedLaborBookVersion(selectedBidForCostEstimate.id, null)
          await loadBids()
        }
      }
    }
  }

  function openNewLaborEntry() {
    setEditingLaborEntry(null)
    setLaborEntryFixtureName('')
    setLaborEntryAliasNames('')
    setLaborEntryRoughIn('')
    setLaborEntryTopOut('')
    setLaborEntryTrimSet('')
    setError(null)
    setLaborEntryFormOpen(true)
  }

  function openEditLaborEntry(entry: LaborBookEntryWithFixture) {
    setEditingLaborEntry(entry)
    setLaborEntryFixtureName(entry.fixture_types?.name ?? '')
    setLaborEntryAliasNames((entry.alias_names ?? []).join(', '))
    setLaborEntryRoughIn(String(entry.rough_in_hrs))
    setLaborEntryTopOut(String(entry.top_out_hrs))
    setLaborEntryTrimSet(String(entry.trim_set_hrs))
    setError(null)
    setLaborEntryFormOpen(true)
  }

  function closeLaborEntryForm() {
    setLaborEntryFormOpen(false)
    setEditingLaborEntry(null)
    setLaborEntryFixtureName('')
    setLaborEntryAliasNames('')
    setLaborEntryRoughIn('')
    setLaborEntryTopOut('')
    setLaborEntryTrimSet('')
    setError(null)
  }

  async function saveLaborEntry(e: React.FormEvent) {
    e.preventDefault()
    if (!laborBookEntriesVersionId) {
      setError('No labor book version selected')
      return
    }
    const fixtureName = laborEntryFixtureName.trim()
    if (!fixtureName) {
      setError('Please enter a fixture type')
      return
    }
    
    setSavingLaborEntry(true)
    setError(null)
    
    // Get or auto-create fixture type
    const fixtureTypeId = await getOrCreateFixtureTypeId(fixtureName)
    if (!fixtureTypeId) {
      setError(`Failed to create or find fixture type "${fixtureName}"`)
      setSavingLaborEntry(false)
      return
    }
    
    const aliasNames = laborEntryAliasNames
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const rough = parseFloat(laborEntryRoughIn) || 0
    const top = parseFloat(laborEntryTopOut) || 0
    const trim = parseFloat(laborEntryTrimSet) || 0
    if (editingLaborEntry) {
      const { error: err } = await supabase
        .from('labor_book_entries')
        .update({ fixture_type_id: fixtureTypeId, alias_names: aliasNames, rough_in_hrs: rough, top_out_hrs: top, trim_set_hrs: trim })
        .eq('id', editingLaborEntry.id)
      if (err) setError(err.message)
      else {
        await loadLaborBookEntries(laborBookEntriesVersionId)
        closeLaborEntryForm()
      }
    } else {
      const maxSeq = laborBookEntries.length === 0 ? 0 : Math.max(...laborBookEntries.map((e) => e.sequence_order))
      const { error: err } = await supabase
        .from('labor_book_entries')
        .insert({ version_id: laborBookEntriesVersionId, fixture_type_id: fixtureTypeId, alias_names: aliasNames, rough_in_hrs: rough, top_out_hrs: top, trim_set_hrs: trim, sequence_order: maxSeq + 1 })
      if (err) setError(err.message)
      else {
        await loadLaborBookEntries(laborBookEntriesVersionId)
        closeLaborEntryForm()
      }
    }
    setSavingLaborEntry(false)
  }

  async function deleteLaborEntry(entry: LaborBookEntryWithFixture) {
    if (!confirm(`Delete "${entry.fixture_types?.name ?? ''}" from this labor book?`)) return
    const { error: err } = await supabase.from('labor_book_entries').delete().eq('id', entry.id)
    if (err) setError(err.message)
    else if (laborBookEntriesVersionId) await loadLaborBookEntries(laborBookEntriesVersionId)
  }

  function openEditTakeoffBookVersion(v: TakeoffBookVersion) {
    setEditingTakeoffBookVersion(v)
    setTakeoffBookVersionNameInput(v.name)
    setTakeoffBookVersionFormOpen(true)
  }

  function closeTakeoffBookVersionForm() {
    setTakeoffBookVersionFormOpen(false)
    setEditingTakeoffBookVersion(null)
    setTakeoffBookVersionNameInput('')
  }

  async function saveTakeoffBookVersion(e: React.FormEvent) {
    e.preventDefault()
    const name = takeoffBookVersionNameInput.trim()
    if (!name) return
    setSavingTakeoffBookVersion(true)
    setError(null)
    if (editingTakeoffBookVersion) {
      const { error: err } = await supabase.from('takeoff_book_versions').update({ name }).eq('id', editingTakeoffBookVersion.id)
      if (err) setError(err.message)
      else {
        await loadTakeoffBookVersions()
        closeTakeoffBookVersionForm()
      }
    } else {
      const { error: err } = await supabase.from('takeoff_book_versions').insert({ name, service_type_id: selectedServiceTypeId })
      if (err) setError(err.message)
      else {
        await loadTakeoffBookVersions()
        closeTakeoffBookVersionForm()
      }
    }
    setSavingTakeoffBookVersion(false)
  }

  async function deleteTakeoffBookVersion(v: TakeoffBookVersion) {
    if (!confirm(`Delete takeoff book "${v.name}"? This will delete all entries in this version.`)) return
    const { error: err } = await supabase.from('takeoff_book_versions').delete().eq('id', v.id)
    if (err) setError(err.message)
    else {
      await loadTakeoffBookVersions()
      if (takeoffBookEntriesVersionId === v.id) {
        setTakeoffBookEntriesVersionId(null)
        setTakeoffBookEntries([])
      }
      if (selectedTakeoffBookVersionId === v.id) {
        setSelectedTakeoffBookVersionId(null)
        if (selectedBidForTakeoff?.selected_takeoff_book_version_id === v.id) {
          saveBidSelectedTakeoffBookVersion(selectedBidForTakeoff.id, null)
          void loadBids()
        }
      }
    }
  }

  function openNewTakeoffBookVersion() {
    setEditingTakeoffBookVersion(null)
    setTakeoffBookVersionNameInput('')
    setTakeoffBookVersionFormOpen(true)
  }

  function openNewTakeoffBookEntry() {
    setEditingTakeoffBookEntry(null)
    setTakeoffBookEntryFixtureName('')
    setTakeoffBookEntryAliasNames('')
    setTakeoffBookEntryItemRows([{ templateId: '', stage: 'rough_in' }])
    setTakeoffBookEntryFormOpen(true)
  }

  function openEditTakeoffBookEntry(entry: TakeoffBookEntryWithItems) {
    setEditingTakeoffBookEntry(entry)
    setTakeoffBookEntryFixtureName(entry.fixture_name)
    setTakeoffBookEntryAliasNames((entry.alias_names ?? []).join(', '))
    setTakeoffBookEntryItemRows(
      entry.items.length > 0
        ? entry.items.map((i) => ({ templateId: i.template_id, stage: i.stage as TakeoffStage }))
        : [{ templateId: '', stage: 'rough_in' }]
    )
    setTakeoffBookEntryFormOpen(true)
  }

  function closeTakeoffBookEntryForm() {
    setTakeoffBookEntryFormOpen(false)
    setEditingTakeoffBookEntry(null)
    setTakeoffBookEntryFixtureName('')
    setTakeoffBookEntryAliasNames('')
    setTakeoffBookEntryItemRows([{ templateId: '', stage: 'rough_in' }])
  }

  async function saveTakeoffBookEntry(e: React.FormEvent) {
    e.preventDefault()
    const fixtureName = takeoffBookEntryFixtureName.trim()
    if (!fixtureName || !takeoffBookEntriesVersionId) return
    const aliasNames = takeoffBookEntryAliasNames
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const validRows = takeoffBookEntryItemRows.filter((r) => r.templateId.trim() !== '')
    if (validRows.length === 0) return
    setSavingTakeoffBookEntry(true)
    setError(null)
    if (editingTakeoffBookEntry) {
      const { error: updateErr } = await supabase
        .from('takeoff_book_entries')
        .update({ fixture_name: fixtureName, alias_names: aliasNames })
        .eq('id', editingTakeoffBookEntry.id)
      if (updateErr) {
        setError(updateErr.message)
        setSavingTakeoffBookEntry(false)
        return
      }
      const { error: deleteErr } = await supabase
        .from('takeoff_book_entry_items')
        .delete()
        .eq('entry_id', editingTakeoffBookEntry.id)
      if (deleteErr) {
        setError(deleteErr.message)
        setSavingTakeoffBookEntry(false)
        return
      }
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i]
        if (!row) continue
        const { error: insertErr } = await supabase.from('takeoff_book_entry_items').insert({
          entry_id: editingTakeoffBookEntry.id,
          template_id: row.templateId,
          stage: row.stage,
          sequence_order: i,
        })
        if (insertErr) {
          setError(insertErr.message)
          setSavingTakeoffBookEntry(false)
          return
        }
      }
      await loadTakeoffBookEntries(takeoffBookEntriesVersionId)
      closeTakeoffBookEntryForm()
    } else {
      const maxSeq = takeoffBookEntries.length === 0 ? 0 : Math.max(...takeoffBookEntries.map((e) => e.sequence_order), 0)
      const { data: insertedEntry, error: insertEntryErr } = await supabase
        .from('takeoff_book_entries')
        .insert({
          version_id: takeoffBookEntriesVersionId,
          fixture_name: fixtureName,
          alias_names: aliasNames,
          sequence_order: maxSeq + 1,
        })
        .select('id')
        .single()
      if (insertEntryErr || !insertedEntry) {
        setError(insertEntryErr?.message ?? 'Failed to create entry')
        setSavingTakeoffBookEntry(false)
        return
      }
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i]
        if (!row) continue
        const { error: insertItemErr } = await supabase.from('takeoff_book_entry_items').insert({
          entry_id: insertedEntry.id,
          template_id: row.templateId,
          stage: row.stage,
          sequence_order: i,
        })
        if (insertItemErr) {
          setError(insertItemErr.message)
          setSavingTakeoffBookEntry(false)
          return
        }
      }
      await loadTakeoffBookEntries(takeoffBookEntriesVersionId)
      closeTakeoffBookEntryForm()
    }
    setSavingTakeoffBookEntry(false)
  }

  async function deleteTakeoffBookEntry(entry: TakeoffBookEntryWithItems) {
    const n = entry.items.length
    if (!confirm(`Delete "${entry.fixture_name ?? ''}" and its ${n} template/stage pair(s) from this takeoff book?`)) return
    const { error: err } = await supabase.from('takeoff_book_entries').delete().eq('id', entry.id)
    if (err) setError(err.message)
    else if (takeoffBookEntriesVersionId) await loadTakeoffBookEntries(takeoffBookEntriesVersionId)
  }

  async function applyTakeoffBookTemplates() {
    if (!selectedBidForTakeoff || takeoffCountRows.length === 0 || !selectedTakeoffBookVersionId) return
    setTakeoffBookApplyMessage(null)
    setApplyingTakeoffBookTemplates(true)
    setError(null)
    try {
      const { data: entriesData, error: entriesErr } = await supabase
        .from('takeoff_book_entries')
        .select('id, fixture_name, alias_names')
        .eq('version_id', selectedTakeoffBookVersionId)
        .order('sequence_order', { ascending: true })
      if (entriesErr) {
        setError(`Failed to load takeoff book entries: ${entriesErr.message}`)
        setApplyingTakeoffBookTemplates(false)
        return
      }
      const entriesList = (entriesData as Pick<TakeoffBookEntry, 'id' | 'fixture_name' | 'alias_names'>[]) ?? []
      if (entriesList.length === 0) {
        setTakeoffBookApplyMessage('No new assemblies to add.')
        setTimeout(() => setTakeoffBookApplyMessage(null), 3000)
        setApplyingTakeoffBookTemplates(false)
        return
      }
      const entryIds = entriesList.map((e) => e.id)
      const { data: itemsData, error: itemsErr } = await supabase
        .from('takeoff_book_entry_items')
        .select('entry_id, template_id, stage')
        .in('entry_id', entryIds)
        .order('sequence_order', { ascending: true })
      if (itemsErr) {
        setError(`Failed to load takeoff book entry items: ${itemsErr.message}`)
        setApplyingTakeoffBookTemplates(false)
        return
      }
      const itemsList = (itemsData as { entry_id: string; template_id: string; stage: string }[]) ?? []
      const itemsByEntryId = new Map<string, { template_id: string; stage: string }[]>()
      for (const item of itemsList) {
        const list = itemsByEntryId.get(item.entry_id) ?? []
        list.push({ template_id: item.template_id, stage: item.stage })
        itemsByEntryId.set(item.entry_id, list)
      }
      const existingKeys = new Set(
        takeoffMappings
          .filter((m) => m.templateId && m.stage)
          .map((m) => `${m.countRowId}:${m.templateId}:${m.stage}`)
      )
      const toAdd: TakeoffMapping[] = []
      for (const row of takeoffCountRows) {
        const fixtureLower = (row.fixture ?? '').toLowerCase()
        for (const entry of entriesList) {
          const matchesPrimary = entry.fixture_name.toLowerCase() === fixtureLower
          const matchesAlias = (entry.alias_names ?? []).some((alias) => alias.trim().toLowerCase() === fixtureLower)
          if (!matchesPrimary && !matchesAlias) continue
          const items = itemsByEntryId.get(entry.id) ?? []
          for (const item of items) {
            const key = `${row.id}:${item.template_id}:${item.stage}`
            if (existingKeys.has(key)) continue
            existingKeys.add(key)
            toAdd.push({
              id: crypto.randomUUID(),
              countRowId: row.id,
              templateId: item.template_id,
              stage: item.stage as TakeoffStage,
              quantity: Number(row.count),
              isSaved: false,
            })
          }
        }
      }
      if (toAdd.length > 0) setTakeoffMappings((prev) => [...prev, ...toAdd])
      setTakeoffBookApplyMessage(toAdd.length === 0 ? 'No new assemblies to add.' : `Applied ${toAdd.length} assembly(ies).`)
      setTimeout(() => setTakeoffBookApplyMessage(null), 3000)
    } finally {
      setApplyingTakeoffBookTemplates(false)
    }
  }

  async function handlePricingVersionChange(bidId: string, versionId: string) {
    setSelectedPricingVersionId(versionId)
    await loadPriceBookEntries(versionId)
    await saveBidSelectedPriceBookVersion(bidId, versionId)
  }

  async function saveLaborRows() {
    for (const row of costEstimateLaborRows) {
      await supabase
        .from('cost_estimate_labor_rows')
        .update({
          rough_in_hrs_per_unit: row.rough_in_hrs_per_unit,
          top_out_hrs_per_unit: row.top_out_hrs_per_unit,
          trim_set_hrs_per_unit: row.trim_set_hrs_per_unit,
          count: row.count,
          is_fixed: row.is_fixed ?? false,
        })
        .eq('id', row.id)
    }
  }

  async function saveCostEstimate() {
    if (!costEstimate) return
    setSavingCostEstimate(true)
    setError(null)
    const laborRateNum = laborRateInput.trim() === '' ? null : parseFloat(laborRateInput)
    if (laborRateInput.trim() !== '' && (isNaN(laborRateNum!) || laborRateNum! < 0)) {
      setError('Labor rate must be a non-negative number.')
      setSavingCostEstimate(false)
      return
    }
    const drivingCostRateNum = drivingCostRate.trim() === '' ? 0.70 : parseFloat(drivingCostRate)
    const hoursPerTripNum = hoursPerTrip.trim() === '' ? 2.0 : parseFloat(hoursPerTrip)
    
    if (isNaN(drivingCostRateNum) || drivingCostRateNum < 0) {
      setError('Driving cost rate must be a non-negative number.')
      setSavingCostEstimate(false)
      return
    }
    
    if (isNaN(hoursPerTripNum) || hoursPerTripNum <= 0) {
      setError('Hours per trip must be a positive number.')
      setSavingCostEstimate(false)
      return
    }
    const { error: updateErr } = await supabase
      .from('cost_estimates')
      .update({
        purchase_order_id_rough_in: costEstimate.purchase_order_id_rough_in || null,
        purchase_order_id_top_out: costEstimate.purchase_order_id_top_out || null,
        purchase_order_id_trim_set: costEstimate.purchase_order_id_trim_set || null,
        labor_rate: laborRateNum,
        driving_cost_rate: drivingCostRateNum,
        hours_per_trip: hoursPerTripNum,
      })
      .eq('id', costEstimate.id)
    if (updateErr) {
      setError(`Failed to save cost estimate: ${updateErr.message}`)
      setSavingCostEstimate(false)
      return
    }
    setCostEstimate((prev) => (prev ? { ...prev, labor_rate: laborRateNum, driving_cost_rate: drivingCostRateNum, hours_per_trip: hoursPerTripNum } as any : null))
    await saveLaborRows()
    setSavingCostEstimate(false)
  }

  async function updateBidDistanceFromCostEstimate() {
    if (!selectedBidForCostEstimate?.id) return
    setUpdatingBidDistance(true)
    setError(null)
    const val = costEstimateDistanceInput.trim()
    const { error: err } = await supabase
      .from('bids')
      .update({ distance_from_office: val || null })
      .eq('id', selectedBidForCostEstimate.id)
    if (err) {
      setError(err.message)
    } else {
      const fresh = (await loadBids()).find((b) => b.id === selectedBidForCostEstimate.id)
      if (fresh) {
        setSelectedBidForCostEstimate(fresh)
        setCostEstimateDistanceInput(fresh.distance_from_office ?? '')
      }
      setBidDistanceUpdateSuccess(true)
      setTimeout(() => setBidDistanceUpdateSuccess(false), 3000)
    }
    setUpdatingBidDistance(false)
  }

  async function applyLaborBookHoursToEstimate() {
    if (!costEstimate?.id || !selectedLaborBookVersionId || costEstimateLaborRows.length === 0) return
    setLaborBookApplyMessage(null)
    setApplyingLaborBookHours(true)
    setError(null)
    try {
      // Auto-save current labor rows to database before applying labor book
      // This ensures non-matching fixtures preserve their current values
      await saveLaborRows()
      
      const { data: entries, error: fetchErr } = await supabase
        .from('labor_book_entries')
        .select('fixture_type_id, alias_names, rough_in_hrs, top_out_hrs, trim_set_hrs, fixture_types(name)')
        .eq('version_id', selectedLaborBookVersionId)
        .order('sequence_order', { ascending: true })
      if (fetchErr) {
        setError(`Failed to load labor book entries: ${fetchErr.message}`)
        setApplyingLaborBookHours(false)
        return
      }
      const entriesByFixtureName = new Map<string, { rough_in_hrs: number; top_out_hrs: number; trim_set_hrs: number }>()
      type LaborEntryWithFixture = LaborBookEntry & { fixture_types?: { name: string } | null }
      for (const e of (entries as LaborEntryWithFixture[]) ?? []) {
        const hours = { rough_in_hrs: Number(e.rough_in_hrs), top_out_hrs: Number(e.top_out_hrs), trim_set_hrs: Number(e.trim_set_hrs) }
        const name = e.fixture_types?.name ?? ''
        if (name) entriesByFixtureName.set(name.toLowerCase(), hours)
      }
      const missingFixtures = new Set<string>()
      for (const row of costEstimateLaborRows) {
        const entry = entriesByFixtureName.get((row.fixture ?? '').toLowerCase())
        if (!entry) {
          missingFixtures.add(row.fixture ?? '')
        }
      }
      for (const row of costEstimateLaborRows) {
        const entry = entriesByFixtureName.get((row.fixture ?? '').toLowerCase())
        if (!entry) continue
        const { error: updateErr } = await supabase
          .from('cost_estimate_labor_rows')
          .update({
            rough_in_hrs_per_unit: entry.rough_in_hrs,
            top_out_hrs_per_unit: entry.top_out_hrs,
            trim_set_hrs_per_unit: entry.trim_set_hrs,
          })
          .eq('id', row.id)
        if (updateErr) {
          setError(`Failed to update labor row: ${updateErr.message}`)
          setApplyingLaborBookHours(false)
          return
        }
      }
      const { data: refetched, error: refetchErr } = await supabase
        .from('cost_estimate_labor_rows')
        .select('*')
        .eq('cost_estimate_id', costEstimate.id)
        .order('sequence_order', { ascending: true })
      if (refetchErr) {
        setError(`Failed to refresh labor rows: ${refetchErr.message}`)
      } else {
        setCostEstimateLaborRows((refetched as CostEstimateLaborRow[]) ?? [])
        setLaborBookApplyMessage('Labor book hours applied.')
        setTimeout(() => setLaborBookApplyMessage(null), 3000)
        setMissingLaborBookFixtures(missingFixtures)
      }
    } finally {
      setApplyingLaborBookHours(false)
    }
  }

  function openAddMissingFixtureModal(fixtureName: string) {
    setAddMissingFixtureName(fixtureName)
    setAddMissingFixtureRoughIn('')
    setAddMissingFixtureTopOut('')
    setAddMissingFixtureTrimSet('')
    setAddMissingFixtureModalOpen(true)
  }

  async function saveMissingFixtureToLaborBook(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedLaborBookVersionId || !addMissingFixtureName.trim()) return
    
    const fixtureTypeId = getFixtureTypeIdByName(addMissingFixtureName.trim())
    if (!fixtureTypeId) {
      setError(`Fixture type "${addMissingFixtureName.trim()}" not found. Please select a valid fixture type.`)
      return
    }
    
    setSavingMissingFixture(true)
    setError(null)
    
    const rough = parseFloat(addMissingFixtureRoughIn) || 0
    const top = parseFloat(addMissingFixtureTopOut) || 0
    const trim = parseFloat(addMissingFixtureTrimSet) || 0
    
    // Get max sequence order for the version
    const { data: entries } = await supabase
      .from('labor_book_entries')
      .select('sequence_order')
      .eq('version_id', selectedLaborBookVersionId)
      .order('sequence_order', { ascending: false })
      .limit(1)
    
    const maxSeq = entries?.[0]?.sequence_order ?? 0
    
    const { error: insertErr } = await supabase
      .from('labor_book_entries')
      .insert({
        version_id: selectedLaborBookVersionId,
        fixture_type_id: fixtureTypeId,
        alias_names: [],
        rough_in_hrs: rough,
        top_out_hrs: top,
        trim_set_hrs: trim,
        sequence_order: maxSeq + 1
      })
    
    if (insertErr) {
      setError(`Failed to add fixture: ${insertErr.message}`)
    } else {
      // Remove from missing set
      setMissingLaborBookFixtures(prev => {
        const next = new Set(prev)
        next.delete(addMissingFixtureName)
        return next
      })
      setAddMissingFixtureModalOpen(false)
      // Reload labor book entries so the new entry appears instantly
      await loadLaborBookEntries(selectedLaborBookVersionId)
      // Re-apply labor hours to update the cost estimate row
      await applyLaborBookHoursToEstimate()
    }
    
    setSavingMissingFixture(false)
  }

  function setCostEstimatePO(stage: 'rough_in' | 'top_out' | 'trim_set', poId: string) {
    if (!costEstimate) return
    const key = stage === 'rough_in' ? 'purchase_order_id_rough_in' : stage === 'top_out' ? 'purchase_order_id_top_out' : 'purchase_order_id_trim_set'
    const id = poId || null
    setCostEstimate((prev) => (prev ? { ...prev, [key]: id } : null))
    if (id) {
      loadPOTotal(id).then((total) => {
        if (stage === 'rough_in') setCostEstimateMaterialTotalRoughIn(total)
        else if (stage === 'top_out') setCostEstimateMaterialTotalTopOut(total)
        else setCostEstimateMaterialTotalTrimSet(total)
      })
    } else {
      if (stage === 'rough_in') setCostEstimateMaterialTotalRoughIn(null)
      else if (stage === 'top_out') setCostEstimateMaterialTotalTopOut(null)
      else setCostEstimateMaterialTotalTrimSet(null)
    }
  }

  type CostEstimatePOModalItem = { part_name: string; quantity: number; price_at_time: number; template_name: string | null }

  function printCostEstimatePOForReview(poName: string, items: CostEstimatePOModalItem[], taxPercent: number) {
    const escapeHtml = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const title = escapeHtml(poName)
    const grandTotal = items.reduce((sum, item) => sum + item.price_at_time * item.quantity, 0)
    const withTaxAmount = grandTotal * (1 + taxPercent / 100)
    const tableRows = items.map((item) => {
      const partName = escapeHtml(item.part_name)
      const qty = item.quantity
      const template = escapeHtml(item.template_name ?? '—')
      const price = item.price_at_time.toFixed(2)
      const total = (item.price_at_time * item.quantity).toFixed(2)
      return `<tr><td>${partName}</td><td>${qty}</td><td>${template}</td><td>$${price}</td><td>$${total}</td></tr>`
    }).join('')
    const thead = '<tr><th>Part</th><th>Qty</th><th>Assembly</th><th>Cost</th><th>Total</th></tr>'
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
      body { font-family: sans-serif; margin: 1in; }
      table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
      th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
      th { background: #f5f5f5; }
      @media print { body { margin: 0.5in; } }
    </style></head><body>
      <h1>${title}</h1>
      <table>
        <thead>${thead}</thead>
        <tbody>${tableRows}</tbody>
        <tfoot><tr><td colspan="4" style="text-align:right; font-weight:600;">Grand Total:</td><td style="font-weight:600;">$${grandTotal.toFixed(2)}</td></tr><tr><td colspan="4" style="text-align:right; font-weight:600;">With Tax ${taxPercent}%:</td><td style="font-weight:600;">$${withTaxAmount.toFixed(2)}</td></tr></tfoot>
      </table>
    </body></html>`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
    win.onafterprint = () => win.close()
  }

  function printCostEstimatePOForSupplyHouse(poName: string, items: CostEstimatePOModalItem[], taxPercent: number) {
    const escapeHtml = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const title = escapeHtml(poName)
    const grandTotal = items.reduce((sum, item) => sum + item.price_at_time * item.quantity, 0)
    const withTaxAmount = grandTotal * (1 + taxPercent / 100)
    const tableRows = items.map((item) => {
      const partName = escapeHtml(item.part_name)
      const qty = item.quantity
      const price = item.price_at_time.toFixed(2)
      const total = (item.price_at_time * item.quantity).toFixed(2)
      return `<tr><td>${partName}</td><td>${qty}</td><td>$${price}</td><td>$${total}</td></tr>`
    }).join('')
    const thead = '<tr><th>Part</th><th>Qty</th><th>Price</th><th>Total</th></tr>'
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
      body { font-family: sans-serif; margin: 1in; }
      table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
      th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
      th { background: #f5f5f5; }
      @media print { body { margin: 0.5in; } }
    </style></head><body>
      <h1>${title}</h1>
      <table>
        <thead>${thead}</thead>
        <tbody>${tableRows}</tbody>
        <tfoot><tr><td colspan="3" style="text-align:right; font-weight:600;">Grand Total:</td><td style="font-weight:600;">$${grandTotal.toFixed(2)}</td></tr><tr><td colspan="3" style="text-align:right; font-weight:600;">With Tax ${taxPercent}%:</td><td style="font-weight:600;">$${withTaxAmount.toFixed(2)}</td></tr></tfoot>
      </table>
    </body></html>`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
    win.onafterprint = () => win.close()
  }

  async function printCostEstimatePage() {
    if (!selectedBidForCostEstimate) return
    const escapeHtml = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const title = escapeHtml(bidDisplayName(selectedBidForCostEstimate) || 'Bid') + ' — Cost Estimate'
    const poRoughName = escapeHtml(purchaseOrdersForCostEstimate.find((p) => p.id === costEstimate?.purchase_order_id_rough_in)?.name ?? '—')
    const poTopName = escapeHtml(purchaseOrdersForCostEstimate.find((p) => p.id === costEstimate?.purchase_order_id_top_out)?.name ?? '—')
    const poTrimName = escapeHtml(purchaseOrdersForCostEstimate.find((p) => p.id === costEstimate?.purchase_order_id_trim_set)?.name ?? '—')
    const matRough = costEstimateMaterialTotalRoughIn ?? 0
    const matTop = costEstimateMaterialTotalTopOut ?? 0
    const matTrim = costEstimateMaterialTotalTrimSet ?? 0
    const totalMaterials = matRough + matTop + matTrim
    
    // Load PO items for each stage
    const loadPOItems = async (poId: string | null | undefined) => {
      if (!poId) return []
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select('quantity, price_at_time, material_parts(name), source_template:material_templates!source_template_id(id, name)')
        .eq('purchase_order_id', poId)
        .order('sequence_order', { ascending: true })
      if (error) return []
      const rows = (data ?? []) as unknown as Array<{ quantity: number; price_at_time: number; material_parts: { name: string } | null; source_template: { id: string; name: string } | null }>
      return rows.map(row => ({
        part_name: row.material_parts?.name ?? '—',
        quantity: row.quantity,
        price_at_time: row.price_at_time,
        template_name: row.source_template?.name ?? null
      }))
    }
    
    const [roughItems, topItems, trimItems] = await Promise.all([
      loadPOItems(costEstimate?.purchase_order_id_rough_in),
      loadPOItems(costEstimate?.purchase_order_id_top_out),
      loadPOItems(costEstimate?.purchase_order_id_trim_set)
    ])
    
    const taxPercent = parseFloat(costEstimatePOModalTaxPercent || '8.25') || 0
    // Generate PO summary HTML
    const generatePOSummary = (items: Array<{ part_name: string; quantity: number; price_at_time: number; template_name: string | null }>, stageLabel: string) => {
      if (items.length === 0) return '<p style="margin:0.5rem 0; font-size:0.875rem; color:#6b7280;">No items in this PO.</p>'
      const tableRows = items.map(item => {
        const qty = item.quantity.toLocaleString('en-US')
        const price = item.price_at_time.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        const itemTotal = (item.quantity * item.price_at_time).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        return `<tr><td style="padding:0.25rem 0.5rem">${escapeHtml(item.part_name)}</td><td style="padding:0.25rem 0.5rem; text-align:center">${qty}</td><td style="padding:0.25rem 0.5rem; text-align:right">$${price}</td><td style="padding:0.25rem 0.5rem; text-align:right">$${itemTotal}</td></tr>`
      }).join('')
      const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price_at_time, 0)
      const taxAmount = subtotal * (taxPercent / 100)
      const stageTotal = subtotal + taxAmount
      const totalFormatted = subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      const taxFormatted = taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      const stageTotalFormatted = stageTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      return `
        <table style="width:100%; border-collapse:collapse; margin:0.5rem 0; font-size:0.875rem">
          <thead style="background:#f9fafb"><tr><th style="padding:0.25rem 0.5rem; text-align:left; border:1px solid #ccc">Part</th><th style="padding:0.25rem 0.5rem; text-align:center; border:1px solid #ccc">Qty</th><th style="padding:0.25rem 0.5rem; text-align:right; border:1px solid #ccc">Price</th><th style="padding:0.25rem 0.5rem; text-align:right; border:1px solid #ccc">Total</th></tr></thead>
          <tbody>${tableRows}<tr style="background:#f9fafb; font-weight:600"><td colspan="3" style="padding:0.25rem 0.5rem; text-align:right; border:1px solid #ccc">Subtotal:</td><td style="padding:0.25rem 0.5rem; text-align:right; border:1px solid #ccc">$${totalFormatted}</td></tr><tr style="background:#f9fafb; font-weight:600"><td colspan="3" style="padding:0.25rem 0.5rem; text-align:right; border:1px solid #ccc">Tax:</td><td style="padding:0.25rem 0.5rem; text-align:right; border:1px solid #ccc">$${taxFormatted}</td></tr><tr style="background:#f9fafb; font-weight:600"><td colspan="3" style="padding:0.25rem 0.5rem; text-align:right; border:1px solid #ccc">${stageLabel} Total:</td><td style="padding:0.25rem 0.5rem; text-align:right; border:1px solid #ccc">$${stageTotalFormatted}</td></tr></tbody>
        </table>`
    }
    const rate = laborRateInput.trim() === '' ? 0 : parseFloat(laborRateInput) || 0
    const totalHours = costEstimateLaborRows.reduce((s, r) => s + laborRowHours(r),
      0
    )
    const laborCost = totalHours * rate
    const grandTotal = totalMaterials + laborCost

    const laborRowsHtml =
      costEstimateLaborRows.length === 0
        ? '<tr><td colspan="6" style="text-align:center; color:#6b7280;">No labor rows</td></tr>'
        : costEstimateLaborRows
            .map((row) => {
              const rough = Number(row.rough_in_hrs_per_unit)
              const top = Number(row.top_out_hrs_per_unit)
              const trim = Number(row.trim_set_hrs_per_unit)
              const totalHrs = laborRowHours(row)
              return `<tr><td>${escapeHtml(row.fixture ?? '')}</td><td style="text-align:center">${Number(row.count)}</td><td style="text-align:center">${rough.toFixed(2)}</td><td style="text-align:center">${top.toFixed(2)}</td><td style="text-align:center">${trim.toFixed(2)}</td><td style="text-align:center; font-weight:600">${totalHrs.toFixed(2)}</td></tr>`
            })
            .join('')

    let totalsRowHtml = ''
    if (costEstimateLaborRows.length > 0) {
      const totalRough = costEstimateLaborRows.reduce((s, r) => s + laborRowRough(r), 0)
      const totalTop = costEstimateLaborRows.reduce((s, r) => s + laborRowTop(r), 0)
      const totalTrim = costEstimateLaborRows.reduce((s, r) => s + laborRowTrim(r), 0)
      totalsRowHtml = `<tr style="background:#f9fafb; font-weight:600"><td>Totals</td><td style="text-align:center"></td><td style="text-align:center">${totalRough.toFixed(2)} hrs</td><td style="text-align:center">${totalTop.toFixed(2)} hrs</td><td style="text-align:center">${totalTrim.toFixed(2)} hrs</td><td style="text-align:center">${totalHours.toFixed(2)} hrs</td></tr>`
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
  body { font-family: sans-serif; margin: 1in; }
  h1 { font-size: 1.25rem; margin-bottom: 1rem; }
  h2 { font-size: 1rem; margin: 1rem 0 0.5rem; text-align: center; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
  th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
  th { background: #f5f5f5; }
  .summary { margin-top: 1rem; padding: 0.75rem; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; }
  .summary p { margin: 0.25rem 0; text-align: right; }
  .po-section { margin-bottom: 1rem; padding: 0.75rem; background: #fafafa; border-left: 3px solid #3b82f6; }
  @media print { body { margin: 0.5in; } }
</style></head><body>
  <h1>${title}</h1>
  <h2>Materials</h2>
  <div class="po-section">
    <p style="margin:0 0 0.25rem; font-weight:600"><strong>PO (Rough In)</strong> ${poRoughName} — $${formatCurrency(matRough)}</p>
    ${generatePOSummary(roughItems, 'Rough In')}
  </div>
  <div class="po-section">
    <p style="margin:0 0 0.25rem; font-weight:600"><strong>PO (Top Out)</strong> ${poTopName} — $${formatCurrency(matTop)}</p>
    ${generatePOSummary(topItems, 'Top Out')}
  </div>
  <div class="po-section">
    <p style="margin:0 0 0.25rem; font-weight:600"><strong>PO (Trim Set)</strong> ${poTrimName} — $${formatCurrency(matTrim)}</p>
    ${generatePOSummary(trimItems, 'Trim Set')}
  </div>
  <p style="font-weight:600; text-align:right;">Materials Total: $${formatCurrency(totalMaterials)}</p>
  <h2>Labor</h2>
  <p>Labor rate: $${formatCurrency(rate)}/hr</p>
  <table>
    <thead><tr><th>Fixture or Tie-in</th><th style="text-align:center">Count</th><th style="text-align:center">Rough In</th><th style="text-align:center">Top Out</th><th style="text-align:center">Trim Set</th><th style="text-align:center">Total hrs</th></tr></thead>
    <tbody>${laborRowsHtml}${totalsRowHtml}</tbody>
  </table>
  <p style="font-weight:600; text-align:right; margin-top:0.5rem;">Labor total: $${formatCurrency(laborCost)}<br/><span style="font-weight:400; font-size:0.875rem;">(${totalHours.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} hrs × $${formatCurrency(rate)}/hr)</span></p>
  <h2>Summary</h2>
  <div class="summary">
    <p>Materials Total: $${formatCurrency(totalMaterials)}</p>
    <p>Labor total: $${formatCurrency(laborCost)}</p>
    <p style="font-weight:700; font-size:1.125rem;">Our total cost is: $${formatCurrency(grandTotal)}</p>
  </div>
</body></html>`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
    win.onafterprint = () => win.close()
  }

  function printRoughInSubSheet() {
    if (!selectedBidForCostEstimate) return
    const escapeHtml = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const title = escapeHtml(bidDisplayName(selectedBidForCostEstimate) || 'Bid') + ' — Rough In Labor Sub Sheet'
    const rate = laborRateInput.trim() === '' ? 0 : parseFloat(laborRateInput) || 0

    const laborRowsHtml =
      costEstimateLaborRows.length === 0
        ? '<tr><td colspan="3" style="text-align:center; color:#6b7280;">No labor rows</td></tr>'
        : costEstimateLaborRows
            .map((row) => {
              const quantity = Number(row.count)
              const hours = Number(row.rough_in_hrs_per_unit)
              const totalCost = rate * hours * quantity
              return `<tr><td>${escapeHtml(row.fixture ?? '')}</td><td style="text-align:center">${quantity}</td><td style="text-align:right">$${formatCurrency(totalCost)}</td></tr>`
            })
            .join('')

    let totalCost = 0
    if (costEstimateLaborRows.length > 0) {
      totalCost = costEstimateLaborRows.reduce((sum, row) => {
        return sum + rate * laborRowRough(row)
      }, 0)
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
  body { font-family: sans-serif; margin: 1in; }
  h1 { font-size: 1.25rem; margin-bottom: 1rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
  th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
  th { background: #f5f5f5; }
  @media print { body { margin: 0.5in; } }
</style></head><body>
  <h1>${title}</h1>
  <table>
    <thead><tr><th>Fixture or Tie-in</th><th style="text-align:center">Quantity</th><th style="text-align:right">Rate</th></tr></thead>
    <tbody>${laborRowsHtml}<tr style="background:#f9fafb; font-weight:600"><td colspan="2" style="text-align:right">Total:</td><td style="text-align:right">$${formatCurrency(totalCost)}</td></tr></tbody>
  </table>
</body></html>`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
    win.onafterprint = () => win.close()
  }

  function printTopOutSubSheet() {
    if (!selectedBidForCostEstimate) return
    const escapeHtml = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const title = escapeHtml(bidDisplayName(selectedBidForCostEstimate) || 'Bid') + ' — Top Out Labor Sub Sheet'
    const rate = laborRateInput.trim() === '' ? 0 : parseFloat(laborRateInput) || 0

    const laborRowsHtml =
      costEstimateLaborRows.length === 0
        ? '<tr><td colspan="3" style="text-align:center; color:#6b7280;">No labor rows</td></tr>'
        : costEstimateLaborRows
            .map((row) => {
              const quantity = Number(row.count)
              const hours = Number(row.top_out_hrs_per_unit)
              const totalCost = rate * hours * quantity
              return `<tr><td>${escapeHtml(row.fixture ?? '')}</td><td style="text-align:center">${quantity}</td><td style="text-align:right">$${formatCurrency(totalCost)}</td></tr>`
            })
            .join('')

    let totalCost = 0
    if (costEstimateLaborRows.length > 0) {
      totalCost = costEstimateLaborRows.reduce((sum, row) => {
        return sum + rate * laborRowTop(row)
      }, 0)
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
  body { font-family: sans-serif; margin: 1in; }
  h1 { font-size: 1.25rem; margin-bottom: 1rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
  th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
  th { background: #f5f5f5; }
  @media print { body { margin: 0.5in; } }
</style></head><body>
  <h1>${title}</h1>
  <table>
    <thead><tr><th>Fixture or Tie-in</th><th style="text-align:center">Quantity</th><th style="text-align:right">Rate</th></tr></thead>
    <tbody>${laborRowsHtml}<tr style="background:#f9fafb; font-weight:600"><td colspan="2" style="text-align:right">Total:</td><td style="text-align:right">$${formatCurrency(totalCost)}</td></tr></tbody>
  </table>
</body></html>`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
    win.onafterprint = () => win.close()
  }

  function printTrimSetSubSheet() {
    if (!selectedBidForCostEstimate) return
    const escapeHtml = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const title = escapeHtml(bidDisplayName(selectedBidForCostEstimate) || 'Bid') + ' — Trim Set Labor Sub Sheet'
    const rate = laborRateInput.trim() === '' ? 0 : parseFloat(laborRateInput) || 0

    const laborRowsHtml =
      costEstimateLaborRows.length === 0
        ? '<tr><td colspan="3" style="text-align:center; color:#6b7280;">No labor rows</td></tr>'
        : costEstimateLaborRows
            .map((row) => {
              const quantity = Number(row.count)
              const hours = Number(row.trim_set_hrs_per_unit)
              const totalCost = rate * hours * quantity
              return `<tr><td>${escapeHtml(row.fixture ?? '')}</td><td style="text-align:center">${quantity}</td><td style="text-align:right">$${formatCurrency(totalCost)}</td></tr>`
            })
            .join('')

    let totalCost = 0
    if (costEstimateLaborRows.length > 0) {
      totalCost = costEstimateLaborRows.reduce((sum, row) => {
        return sum + rate * laborRowTrim(row)
      }, 0)
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
  body { font-family: sans-serif; margin: 1in; }
  h1 { font-size: 1.25rem; margin-bottom: 1rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
  th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
  th { background: #f5f5f5; }
  @media print { body { margin: 0.5in; } }
</style></head><body>
  <h1>${title}</h1>
  <table>
    <thead><tr><th>Fixture or Tie-in</th><th style="text-align:center">Quantity</th><th style="text-align:right">Rate</th></tr></thead>
    <tbody>${laborRowsHtml}<tr style="background:#f9fafb; font-weight:600"><td colspan="2" style="text-align:right">Total:</td><td style="text-align:right">$${formatCurrency(totalCost)}</td></tr></tbody>
  </table>
</body></html>`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
    win.onafterprint = () => win.close()
  }

  function printAllSubSheets() {
    if (!selectedBidForCostEstimate) return
    const escapeHtml = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const bidName = escapeHtml(bidDisplayName(selectedBidForCostEstimate) || 'Bid')
    const rate = laborRateInput.trim() === '' ? 0 : parseFloat(laborRateInput) || 0

    // Helper to generate table for a stage
    const generateStageTable = (stageName: string, hoursField: 'rough_in_hrs_per_unit' | 'top_out_hrs_per_unit' | 'trim_set_hrs_per_unit') => {
      const laborRowsHtml =
        costEstimateLaborRows.length === 0
          ? '<tr><td colspan="3" style="text-align:center; color:#6b7280;">No labor rows</td></tr>'
          : costEstimateLaborRows
              .map((row) => {
                const quantity = Number(row.count)
                const hours = Number(row[hoursField])
                const totalCost = rate * hours * quantity
                return `<tr><td>${escapeHtml(row.fixture ?? '')}</td><td style="text-align:center">${quantity}</td><td style="text-align:right">$${formatCurrency(totalCost)}</td></tr>`
              })
              .join('')

      const totalCost = costEstimateLaborRows.reduce((sum, row) => {
        return sum + rate * (hoursField === 'rough_in_hrs_per_unit' ? laborRowRough(row) : hoursField === 'top_out_hrs_per_unit' ? laborRowTop(row) : laborRowTrim(row))
      }, 0)

      return `
      <h2>${stageName}</h2>
      <table>
        <thead><tr><th>Fixture or Tie-in</th><th style="text-align:center">Quantity</th><th style="text-align:right">Rate</th></tr></thead>
        <tbody>${laborRowsHtml}<tr style="background:#f9fafb; font-weight:600"><td colspan="2" style="text-align:right">Total:</td><td style="text-align:right">$${formatCurrency(totalCost)}</td></tr></tbody>
      </table>
    `
    }

    const roughInTable = generateStageTable('Rough In', 'rough_in_hrs_per_unit')
    const topOutTable = generateStageTable('Top Out', 'top_out_hrs_per_unit')
    const trimSetTable = generateStageTable('Trim Set', 'trim_set_hrs_per_unit')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${bidName} — Labor Sub Sheets</title><style>
  body { font-family: sans-serif; margin: 1in; }
  h1 { font-size: 1.25rem; margin-bottom: 1rem; }
  h2 { font-size: 1rem; margin: 1.5rem 0 0.5rem; page-break-before: auto; }
  h2:first-of-type { margin-top: 0.5rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; page-break-inside: avoid; }
  th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
  th { background: #f5f5f5; }
  @media print { 
    body { margin: 0.5in; }
    h2 { page-break-after: avoid; }
  }
</style></head><body>
  <h1>${bidName} — Labor Sub Sheets</h1>
  ${roughInTable}
  ${topOutTable}
  ${trimSetTable}
</body></html>`

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
    win.onafterprint = () => win.close()
  }

  function printPricingPage() {
    if (!selectedBidForPricing) return
    const escapeHtml = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const title = escapeHtml(bidDisplayName(selectedBidForPricing) || 'Bid') + ' — Pricing'
    const versionName = escapeHtml(priceBookVersions.find((v) => v.id === selectedPricingVersionId)?.name ?? '—')

    let bodyContent: string
    if (selectedPricingVersionId && pricingCountRows.length > 0 && pricingCostEstimate) {
      const totalMaterials = (pricingMaterialTotalRoughIn ?? 0) + (pricingMaterialTotalTopOut ?? 0) + (pricingMaterialTotalTrimSet ?? 0)
      const rate = pricingLaborRate ?? 0
      const totalLaborHours = pricingLaborRows.reduce(
        (s, r) => s + laborRowHours(r),
        0
      )
      const totalCost = totalMaterials + totalLaborHours * rate
      const entriesById = new Map(priceBookEntries.map((e) => [e.id, e]))
      let totalRevenue = 0
      const rows = pricingCountRows.map((countRow) => {
        const assignment = bidPricingAssignments.find((a) => a.count_row_id === countRow.id)
        const entry = assignment ? entriesById.get(assignment.price_book_entry_id) : priceBookEntries.find((e) => (e.fixture_types?.name ?? '').toLowerCase() === (countRow.fixture ?? '').toLowerCase())
        const laborRow = pricingLaborRows.find((l) => (l.fixture ?? '').toLowerCase() === (countRow.fixture ?? '').toLowerCase())
        const count = Number(countRow.count)
        const laborHrs = laborRow ? laborRowHours(laborRow) : 0
        const laborCost = laborHrs * rate
        const allocatedMaterials = totalLaborHours > 0 ? totalMaterials * (laborHrs / totalLaborHours) : 0
        const cost = laborCost + allocatedMaterials
        const unitPrice = entry ? Number(entry.total_price) : 0
        const isFixedPrice = assignment?.is_fixed_price ?? false
        const revenue = isFixedPrice ? unitPrice : count * unitPrice
        totalRevenue += revenue
        const margin = revenue > 0 ? ((revenue - cost) / revenue) * 100 : null
        return { countRow, entry, count, cost, revenue, margin }
      })
      const tableRows = rows
        .map(
          ({ countRow, entry, count, cost, revenue, margin }) =>
            `<tr><td>${escapeHtml(countRow.fixture ?? '')}</td><td style="text-align:center">${count}</td><td>${escapeHtml(entry?.fixture_types?.name ?? '—')}</td><td style="text-align:right">$${formatCurrency(cost)}</td><td style="text-align:right">$${formatCurrency(revenue)}</td><td style="text-align:center">${margin != null ? `${margin.toFixed(1)}%` : '—'}</td></tr>`
        )
        .join('')
      const overallMarginStr = totalRevenue > 0 ? `${(((totalRevenue - totalCost) / totalRevenue) * 100).toFixed(1)}%` : '—'
      bodyContent = `<h2>Price book</h2>
  <p>${versionName}</p>
  <table>
    <thead><tr><th>Fixture or Tie-in</th><th style="text-align:center">Count</th><th>Price book entry</th><th style="text-align:right">Our cost</th><th style="text-align:right">Revenue</th><th style="text-align:center">Margin %</th></tr></thead>
    <tbody>${tableRows}<tr style="background:#f9fafb; font-weight:600"><td>Total</td><td style="text-align:center"></td><td></td><td style="text-align:right">$${formatCurrency(totalCost)}</td><td style="text-align:right">$${formatCurrency(totalRevenue)}</td><td style="text-align:center">${overallMarginStr}</td></tr></tbody>
  </table>`
    } else {
      bodyContent = '<p style="color:#6b7280">Select a price book version and ensure Counts and Cost Estimate are set up.</p>'
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
  body { font-family: sans-serif; margin: 1in; }
  h1 { font-size: 1.25rem; margin-bottom: 1rem; }
  h2 { font-size: 1rem; margin: 1rem 0 0.5rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
  th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
  th { background: #f5f5f5; }
  @media print { body { margin: 0.5in; } }
</style></head><body>
  <h1>${title}</h1>
  ${bodyContent}
</body></html>`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
    win.onafterprint = () => win.close()
  }

  async function printAllPricingPages() {
    if (!selectedBidForPricing) return
    const escapeHtml = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const title = escapeHtml(bidDisplayName(selectedBidForPricing) || 'Bid') + ' — Pricing (All price books)'

    let bodyContent: string
    if (priceBookVersions.length === 0) {
      bodyContent = '<p style="color:#6b7280">No price book versions.</p>'
    } else if (!pricingCostEstimate || pricingCountRows.length === 0) {
      bodyContent = '<p style="color:#6b7280">Select a price book version and ensure Counts and Cost Estimate are set up.</p>'
    } else {
      const versionIds = priceBookVersions.map((v) => v.id)
      const [entriesResult, assignmentsResult] = await Promise.all([
        supabase.from('price_book_entries').select('*, fixture_types(name)').in('version_id', versionIds),
        supabase.from('bid_pricing_assignments').select('*').eq('bid_id', selectedBidForPricing.id),
      ])
      const { data: allEntries, error: entriesErr } = entriesResult
      if (entriesErr) {
        setError(`Failed to load price book entries: ${entriesErr.message}`)
        return
      }
      const allAssignments = (assignmentsResult.data as BidPricingAssignment[]) ?? []
      const entriesByVersion = new Map<string, PriceBookEntryWithFixture[]>()
      for (const e of (allEntries as PriceBookEntryWithFixture[]) ?? []) {
        const list = entriesByVersion.get(e.version_id) ?? []
        list.push(e)
        entriesByVersion.set(e.version_id, list)
      }
      for (const list of entriesByVersion.values()) {
        list.sort((a, b) => (a.fixture_types?.name ?? '').localeCompare(b.fixture_types?.name ?? '', undefined, { numeric: true }))
      }
      const totalMaterials = (pricingMaterialTotalRoughIn ?? 0) + (pricingMaterialTotalTopOut ?? 0) + (pricingMaterialTotalTrimSet ?? 0)
      const rate = pricingLaborRate ?? 0
      const totalLaborHours = pricingLaborRows.reduce(
        (s, r) => s + laborRowHours(r),
        0
      )
      const totalCost = totalMaterials + totalLaborHours * rate
      const sections: string[] = []
      for (let i = 0; i < priceBookVersions.length; i++) {
        const version = priceBookVersions[i]!
        const entries = entriesByVersion.get(version.id) ?? []
        const entriesById = new Map(entries.map((e) => [e.id, e]))
        const assignmentForVersion = (countRowId: string) =>
          allAssignments.find((a) => a.count_row_id === countRowId && a.price_book_version_id === version.id)
        let totalRevenue = 0
        const rows = pricingCountRows.map((countRow) => {
          const assignment = assignmentForVersion(countRow.id)
          const entry = assignment
            ? entriesById.get(assignment.price_book_entry_id)
            : entries.find((e) => (e.fixture_types?.name ?? '').toLowerCase() === (countRow.fixture ?? '').toLowerCase())
          const laborRow = pricingLaborRows.find((l) => (l.fixture ?? '').toLowerCase() === (countRow.fixture ?? '').toLowerCase())
          const count = Number(countRow.count)
          const laborHrs = laborRow
            ? count * (Number(laborRow.rough_in_hrs_per_unit) + Number(laborRow.top_out_hrs_per_unit) + Number(laborRow.trim_set_hrs_per_unit))
            : 0
          const laborCost = laborHrs * rate
          const allocatedMaterials = totalLaborHours > 0 ? totalMaterials * (laborHrs / totalLaborHours) : 0
          const cost = laborCost + allocatedMaterials
          const unitPrice = entry ? Number(entry.total_price) : 0
          const isFixedPrice = assignment?.is_fixed_price ?? false
          const revenue = isFixedPrice ? unitPrice : count * unitPrice
          totalRevenue += revenue
          const margin = revenue > 0 ? ((revenue - cost) / revenue) * 100 : null
          return { countRow, entry, count, cost, revenue, margin }
        })
        const tableRows = rows
          .map(
            ({ countRow, entry, count, cost, revenue, margin }) =>
              `<tr><td>${escapeHtml(countRow.fixture ?? '')}</td><td style="text-align:center">${count}</td><td>${escapeHtml(entry?.fixture_types?.name ?? '—')}</td><td style="text-align:right">$${formatCurrency(cost)}</td><td style="text-align:right">$${formatCurrency(revenue)}</td><td style="text-align:center">${margin != null ? `${margin.toFixed(1)}%` : '—'}</td></tr>`
          )
          .join('')
        const overallMarginStr = totalRevenue > 0 ? `${(((totalRevenue - totalCost) / totalRevenue) * 100).toFixed(1)}%` : '—'
        const pageBreak = i === priceBookVersions.length - 1 ? 'auto' : 'always'
        const versionName = version.name
        sections.push(
          `<section class="price-book-page" style="page-break-after: ${pageBreak}">
  <h2>${escapeHtml(versionName)}</h2>
  <table>
    <thead><tr><th>Fixture or Tie-in</th><th style="text-align:center">Count</th><th>Price book entry</th><th style="text-align:right">Our cost</th><th style="text-align:right">Revenue</th><th style="text-align:center">Margin %</th></tr></thead>
    <tbody>${tableRows}<tr style="background:#f9fafb; font-weight:600"><td>Total</td><td style="text-align:center"></td><td></td><td style="text-align:right">$${formatCurrency(totalCost)}</td><td style="text-align:right">$${formatCurrency(totalRevenue)}</td><td style="text-align:center">${overallMarginStr}</td></tr></tbody>
  </table>
</section>`
        )
      }
      bodyContent = sections.join('\n')
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
  body { font-family: sans-serif; margin: 1in; }
  h1 { font-size: 1.25rem; margin-bottom: 1rem; }
  h2 { font-size: 1rem; margin: 1rem 0 0.5rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
  th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
  th { background: #f5f5f5; }
  .price-book-page { margin-top: 1rem; }
  @media print { body { margin: 0.5in; } }
</style></head><body>
  <h1>${title}</h1>
  ${bodyContent}
</body></html>`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
    win.onafterprint = () => win.close()
  }

  function printCoverLetterDocument(combinedHtml: string) {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cover Letter</title><style>
  body { font-family: sans-serif; margin: 1in; font-size: 12pt; }
  @media print { body { margin: 0.5in; } }
</style></head><body>${combinedHtml}</body></html>`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
    win.onafterprint = () => win.close()
  }

  function downloadSubmissionSummaryPdf() {
    if (!selectedBidForSubmission) return
    const b = selectedBidForSubmission
    const doc = new jsPDF({ format: 'a4', unit: 'mm' })
    const margin = 20
    const lineHeight = 7
    let y = margin
    const push = (text: string) => {
      doc.text(text, margin, y)
      y += lineHeight
    }
    const pushLink = (label: string, url: string | null) => {
      doc.setFont('helvetica', 'bold')
      doc.text(label + ' ', margin, y)
      const labelW = doc.getTextWidth(label + ' ')
      doc.setFont('helvetica', 'normal')
      if (url?.trim()) {
        doc.setTextColor(0, 0, 255)
        const displayUrl = url.length > 70 ? url.slice(0, 67) + '...' : url
        doc.textWithLink(displayUrl, margin + labelW, y, { url })
        doc.setTextColor(0, 0, 0)
      } else {
        doc.text('—', margin + labelW, y)
      }
      y += lineHeight
    }

    doc.setFontSize(14)
    push(bidDisplayName(b) || 'Bid')
    y += lineHeight
    doc.setFontSize(11)
    push(`Bid Size: ${formatCompactCurrency(b.bid_value != null ? Number(b.bid_value) : null)}`)
    y += lineHeight
    push(`Builder Name: ${b.customers?.name ?? b.bids_gc_builders?.name ?? '—'}`)
    push(`Builder Address: ${b.customers?.address ?? b.bids_gc_builders?.address ?? '—'}`)
    push(`Builder Phone Number: ${b.customers ? extractContactInfo(b.customers.contact_info ?? null).phone || '—' : (b.bids_gc_builders?.contact_number ?? '—')}`)
    push(`Builder Email: ${b.customers ? extractContactInfo(b.customers.contact_info ?? null).email || '—' : (b.bids_gc_builders?.email ?? '—')}`)
    y += lineHeight
    push(`Project Name: ${b.project_name ?? '—'}`)
    push(`Project Address: ${b.address ?? '—'}`)
    y += lineHeight
    push(`Project Contact Name: ${b.gc_contact_name ?? '—'}`)
    push(`Project Contact Phone: ${b.gc_contact_phone ?? '—'}`)
    push(`Project Contact Email: ${b.gc_contact_email ?? '—'}`)
    y += lineHeight
    pushLink('Bid Submission:', b.bid_submission_link?.trim() || null)
    y += lineHeight
    pushLink('Project Folder:', b.drive_link?.trim() || null)
    y += lineHeight
    pushLink('Job Plans:', b.plans_link?.trim() || null)

    const filename = `Bid_Summary_${(bidDisplayName(b) || 'Bid').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 40)}.pdf`
    doc.save(filename)
  }

  async function downloadApprovalPdf() {
    const b = selectedBidForSubmission
    if (!b) return
    const bidId = b.id
    const margin = 20
    const lineHeight = 6
    const doc = new jsPDF({ format: 'a4', unit: 'mm' })
    let pageW = doc.internal.pageSize.getWidth()
    let pageH = doc.internal.pageSize.getHeight()
    let y = margin
    const push = (text: string, bold = false) => {
      if (bold) doc.setFont('helvetica', 'bold')
      const maxW = pageW - 2 * margin
      const lines = doc.splitTextToSize(text, maxW)
      for (const line of lines) {
        if (y > pageH - margin) { doc.addPage(); y = margin }
        doc.text(line, margin, y)
        y += lineHeight
      }
      if (bold) doc.setFont('helvetica', 'normal')
    }
    const pushLink = (label: string, url: string | null) => {
      doc.setFont('helvetica', 'bold')
      doc.text(label + ' ', margin, y)
      const labelW = doc.getTextWidth(label + ' ')
      doc.setFont('helvetica', 'normal')
      if (url?.trim()) {
        doc.setTextColor(0, 0, 255)
        const displayUrl = url.length > 70 ? url.slice(0, 67) + '...' : url
        doc.textWithLink(displayUrl, margin + labelW, y, { url })
        doc.setTextColor(0, 0, 0)
      } else {
        doc.text('—', margin + labelW, y)
      }
      y += lineHeight
    }

    const tableLineHeight = 6
    const drawTable = (
      startY: number,
      colWidths: number[],
      headers: string[],
      rows: string[][],
      headerBold = true,
      orientation: 'portrait' | 'landscape' = 'portrait'
    ): number => {
      let cy = startY
      const left = margin
      const totalW = colWidths.reduce((a, w) => a + w, 0)
      const clip = (str: string, w: number) => {
        const pad = 2
        if (doc.getTextWidth(str) <= w - pad) return str
        let s = str
        while (s.length && doc.getTextWidth(s + '…') > w - pad) s = s.slice(0, -1)
        return s + '…'
      }
      doc.setDrawColor(0.4, 0.4, 0.4)
      doc.setLineWidth(0.2)
      doc.line(left, startY, left + totalW, startY)
      for (let r = -1; r < rows.length; r++) {
        if (cy > pageH - margin) {
          doc.addPage('a4', orientation)
          const size = doc.internal.pageSize
          pageW = size.getWidth()
          pageH = size.getHeight()
          cy = margin
        }
        const cells: string[] = r === -1 ? headers : rows[r] ?? []
        let cellY = cy + 4
        let rowH = tableLineHeight
        for (let c = 0; c < colWidths.length; c++) {
          const x = left + colWidths.slice(0, c).reduce((a, w) => a + w, 0)
          const w = colWidths[c] ?? 0
          const text = (cells[c] ?? '').toString()
          const clipped = clip(text, w)
          if (headerBold && r === -1) doc.setFont('helvetica', 'bold')
          doc.text(clipped, x + 1, cellY)
          if (headerBold && r === -1) doc.setFont('helvetica', 'normal')
        }
        cy += rowH
        doc.line(left, cy, left + totalW, cy)
      }
      doc.line(left, startY, left, cy)
      let x = left
      for (const w of colWidths) {
        x += w
        doc.line(x, startY, x, cy)
      }
      return cy
    }

    // Fetch Margins data (cost estimate + pricing by version) for page 1
    let reviewGroupCostEstimateAmount: number | null = null
    let reviewGroupHasCostEstimate = false
    const reviewGroupPricingByVersion: Array<{ versionName: string; revenue: number; margin: number | null; complete: boolean }> = []
    const { data: estForReview } = await supabase.from('cost_estimates').select('*').eq('bid_id', bidId).maybeSingle()
    const estForReviewData = estForReview as CostEstimate | null
    if (estForReviewData) {
      reviewGroupHasCostEstimate = true
      const [laborResR, roughR, topR, trimR] = await Promise.all([
        supabase.from('cost_estimate_labor_rows').select('*').eq('cost_estimate_id', estForReviewData.id).order('sequence_order', { ascending: true }),
        estForReviewData.purchase_order_id_rough_in ? loadPOTotal(estForReviewData.purchase_order_id_rough_in) : Promise.resolve(0),
        estForReviewData.purchase_order_id_top_out ? loadPOTotal(estForReviewData.purchase_order_id_top_out) : Promise.resolve(0),
        estForReviewData.purchase_order_id_trim_set ? loadPOTotal(estForReviewData.purchase_order_id_trim_set) : Promise.resolve(0),
      ])
      const laborRowsR = (laborResR.data as CostEstimateLaborRow[]) ?? []
      const totalMaterialsR = (roughR ?? 0) + (topR ?? 0) + (trimR ?? 0)
      const rateR = estForReviewData.labor_rate != null ? Number(estForReviewData.labor_rate) : 0
      const totalHoursR = laborRowsR.reduce(
        (s, r) => s + laborRowHours(r),
        0
      )
      const distanceR = parseFloat(b.distance_from_office ?? '0') || 0
      const drivingRateR = (estForReviewData as any).driving_cost_rate ? Number((estForReviewData as any).driving_cost_rate) : 0.70
      const hrsPerTripR = (estForReviewData as any).hours_per_trip ? Number((estForReviewData as any).hours_per_trip) : 2.0
      const numTripsR = totalHoursR / hrsPerTripR
      const drivingCostR = numTripsR * drivingRateR * distanceR
      reviewGroupCostEstimateAmount = totalMaterialsR + (totalHoursR * rateR) + drivingCostR
    }
    const { data: countDataReview } = await supabase.from('bids_count_rows').select('*').eq('bid_id', bidId).order('sequence_order', { ascending: true })
    const countRowsReview = (countDataReview as BidCountRow[]) ?? []
    for (const v of priceBookVersions) {
      const [entriesResR, assignResR] = await Promise.all([
        supabase.from('price_book_entries').select('*, fixture_types(name)').eq('version_id', v.id),
        supabase.from('bid_pricing_assignments').select('*').eq('bid_id', bidId).eq('price_book_version_id', v.id),
      ])
      const entriesR = (entriesResR.data as PriceBookEntryWithFixture[]) ?? []
      entriesR.sort((a, b) => (a.fixture_types?.name ?? '').localeCompare(b.fixture_types?.name ?? '', undefined, { numeric: true }))
      const assignmentsR = (assignResR.data as BidPricingAssignment[]) ?? []
      const entriesByIdR = new Map(entriesR.map((e) => [e.id, e]))
      let totalRevenueR = 0
      let completeR = true
      for (const row of countRowsReview) {
        const assignment = assignmentsR.find((a) => a.count_row_id === row.id)
        const entry = assignment ? entriesByIdR.get(assignment.price_book_entry_id) : entriesR.find((e) => (e.fixture_types?.name ?? '').toLowerCase() === (row.fixture ?? '').toLowerCase())
        if (!entry) completeR = false
        totalRevenueR += Number(row.count) * (entry ? Number(entry.total_price) : 0)
      }
      const marginR = completeR && totalRevenueR > 0 && reviewGroupCostEstimateAmount != null
        ? (totalRevenueR - reviewGroupCostEstimateAmount) / totalRevenueR * 100
        : null
      reviewGroupPricingByVersion.push({ versionName: v.name, revenue: totalRevenueR, margin: marginR, complete: completeR })
    }

    // Page 1: Submission and followup (same as downloadSubmissionSummaryPdf)
    doc.setFontSize(16)
    push(`${bidDisplayName(b) || 'Bid'} — Submission and Followup`, true)
    y += lineHeight * 2
    doc.setFontSize(11)
    push(`Bid Size: ${formatCompactCurrency(b.bid_value != null ? Number(b.bid_value) : null)}`)
    push(`Builder Name: ${b.customers?.name ?? b.bids_gc_builders?.name ?? '—'}`)
    push(`Builder Address: ${b.customers?.address ?? b.bids_gc_builders?.address ?? '—'}`)
    push(`Builder Phone Number: ${b.customers ? extractContactInfo(b.customers.contact_info ?? null).phone || '—' : (b.bids_gc_builders?.contact_number ?? '—')}`)
    push(`Builder Email: ${b.customers ? extractContactInfo(b.customers.contact_info ?? null).email || '—' : (b.bids_gc_builders?.email ?? '—')}`)
    y += lineHeight
    push(`Project Name: ${b.project_name ?? '—'}`)
    push(`Project Address: ${b.address ?? '—'}`)
    y += lineHeight
    push(`Project Contact Name: ${b.gc_contact_name ?? '—'}`)
    push(`Project Contact Phone: ${b.gc_contact_phone ?? '—'}`)
    push(`Project Contact Email: ${b.gc_contact_email ?? '—'}`)
    y += lineHeight
    pushLink('Bid Submission:', b.bid_submission_link?.trim() || null)
    y += lineHeight
    pushLink('Project Folder:', b.drive_link?.trim() || null)
    y += lineHeight
    pushLink('Job Plans:', b.plans_link?.trim() || null)

    // Margins (same as UI section)
    y += lineHeight
    push('Margins', true)
    y += lineHeight
    push(`Cost estimate: ${reviewGroupHasCostEstimate ? (reviewGroupCostEstimateAmount != null ? `$${formatCurrency(reviewGroupCostEstimateAmount)}` : '—') : 'Not yet created'}`)
    for (const row of reviewGroupPricingByVersion) {
      push(`Price Book: ${row.versionName} | Revenue: ${row.complete ? `$${formatCurrency(row.revenue)}` : 'Incomplete'} | Margin: ${row.complete && row.margin != null ? `${row.margin.toFixed(1)}%` : 'Incomplete'}`)
    }

    // Page 2: Pricing (landscape)
    doc.addPage('a4', 'landscape')
    {
      const size = doc.internal.pageSize
      pageW = size.getWidth()
      pageH = size.getHeight()
    }
    y = margin
    doc.setFontSize(16)
    push(`${bidDisplayName(b) || 'Bid'} — Pricing`, true)
    y += lineHeight * 2
    doc.setFontSize(11)

    const versionId = b.selected_price_book_version_id ?? null
    const { data: countData } = await supabase.from('bids_count_rows').select('*').eq('bid_id', bidId).order('sequence_order', { ascending: true })
    const countRows = (countData as BidCountRow[]) ?? []
    let pricingContent = 'No price book selected or no count rows.'
    if (versionId && countRows.length > 0) {
      const [entriesRes, assignRes] = await Promise.all([
        supabase.from('price_book_entries').select('*, fixture_types(name)').eq('version_id', versionId),
        supabase.from('bid_pricing_assignments').select('*').eq('bid_id', bidId).eq('price_book_version_id', versionId),
      ])
      const entries = (entriesRes.data as PriceBookEntryWithFixture[]) ?? []
      entries.sort((a, b) => (a.fixture_types?.name ?? '').localeCompare(b.fixture_types?.name ?? '', undefined, { numeric: true }))
      const assignments = (assignRes.data as BidPricingAssignment[]) ?? []
      const entriesById = new Map(entries.map((e) => [e.id, e]))
      let totalRevenue = 0
      const versionName = priceBookVersions.find((v) => v.id === versionId)?.name ?? '—'
      push(`Price book: ${versionName}`)
      y += lineHeight
      const pricingColWidths = [48, 18, 48, 40, 48]
      const pricingRows: string[][] = []
      for (const row of countRows) {
        const assignment = assignments.find((a) => a.count_row_id === row.id)
        const entry = assignment ? entriesById.get(assignment.price_book_entry_id) : entries.find((e) => (e.fixture_types?.name ?? '').toLowerCase() === (row.fixture ?? '').toLowerCase())
        const unitPrice = entry ? Number(entry.total_price) : 0
        const revenue = Number(row.count) * unitPrice
        totalRevenue += revenue
        pricingRows.push([
          row.fixture ?? '',
          String(row.count),
          (entry as PriceBookEntryWithFixture | undefined)?.fixture_types?.name ?? '—',
          `$${Math.round(unitPrice).toLocaleString('en-US')}`,
          `$${Math.round(revenue).toLocaleString('en-US')}`,
        ])
      }
      y = drawTable(y, pricingColWidths, ['Fixture', 'Count', 'Entry', 'Per Unit', 'Revenue'], pricingRows, true, 'landscape')
      y += lineHeight
      push(`Total Revenue: $${formatCurrency(totalRevenue)}`, true)
    } else {
      push(pricingContent)
    }

    // Page 3: Cost Estimate (back to portrait)
    doc.addPage('a4', 'portrait')
    {
      const size = doc.internal.pageSize
      pageW = size.getWidth()
      pageH = size.getHeight()
    }
    y = margin
    doc.setFontSize(16)
    push(`${bidDisplayName(b) || 'Bid'} — Cost Estimate`, true)
    y += lineHeight * 2
    doc.setFontSize(11)

    const { data: estData } = await supabase.from('cost_estimates').select('*').eq('bid_id', bidId).maybeSingle()
    const est = estData as CostEstimate | null
    if (!est) {
      push('No cost estimate created.')
    } else {
      const [laborRes, roughTotal, topTotal, trimTotal] = await Promise.all([
        supabase.from('cost_estimate_labor_rows').select('*').eq('cost_estimate_id', est.id).order('sequence_order', { ascending: true }),
        est.purchase_order_id_rough_in ? loadPOTotal(est.purchase_order_id_rough_in) : Promise.resolve(0),
        est.purchase_order_id_top_out ? loadPOTotal(est.purchase_order_id_top_out) : Promise.resolve(0),
        est.purchase_order_id_trim_set ? loadPOTotal(est.purchase_order_id_trim_set) : Promise.resolve(0),
      ])
      const laborRows = (laborRes.data as CostEstimateLaborRow[]) ?? []
      const totalMaterials = (roughTotal ?? 0) + (topTotal ?? 0) + (trimTotal ?? 0)
      const rate = est.labor_rate != null ? Number(est.labor_rate) : 0
      const totalHours = laborRows.reduce(
        (s, r) => s + laborRowHours(r),
        0
      )
      const laborCost = totalHours * rate
      const distance = parseFloat(b.distance_from_office ?? '0') || 0
      const drivingRatePerMile = (est as any).driving_cost_rate ? Number((est as any).driving_cost_rate) : 0.70
      const hrsPerTrip = (est as any).hours_per_trip ? Number((est as any).hours_per_trip) : 2.0
      const numTrips = totalHours / hrsPerTrip
      const drivingCost = numTrips * drivingRatePerMile * distance
      const laborCostWithDriving = laborCost + drivingCost
      const grandTotal = totalMaterials + laborCostWithDriving

      push('Materials')
      y += lineHeight
      const materialsColWidths = [100, 70]
      y = drawTable(y, materialsColWidths, ['Item', 'Amount'], [
        ['PO (Rough In)', `$${formatCurrency(roughTotal ?? 0)}`],
        ['PO (Top Out)', `$${formatCurrency(topTotal ?? 0)}`],
        ['PO (Trim Set)', `$${formatCurrency(trimTotal ?? 0)}`],
        ['Materials Total', `$${formatCurrency(totalMaterials)}`],
      ])
      y += lineHeight
      push(`Labor — Rate: $${formatCurrency(rate)}/hr`)
      y += lineHeight
      const laborColWidths = [38, 14, 22, 22, 22, 24]
      const laborTableRows: string[][] = laborRows.map((row) => {
        const rough = Number(row.rough_in_hrs_per_unit)
        const top = Number(row.top_out_hrs_per_unit)
        const trim = Number(row.trim_set_hrs_per_unit)
        const totalHrs = laborRowHours(row)
        return [
          row.fixture ?? '',
          String(row.count),
          rough.toFixed(2),
          top.toFixed(2),
          trim.toFixed(2),
          totalHrs.toFixed(2),
        ]
      })
      y = drawTable(y, laborColWidths, ['Fixture', 'Count', 'Rough In', 'Top Out', 'Trim Set', 'Total hrs'], laborTableRows)
      y += lineHeight
      push(`Labor total: $${formatCurrency(laborCost)}`)
      push(`(${totalHours.toFixed(2)} hrs × $${formatCurrency(rate)}/hr)`)
      y += lineHeight
      if (distance > 0 && totalHours > 0) {
        push(`Driving cost: ${numTrips.toFixed(1)} trips × $${drivingRatePerMile.toFixed(2)}/mi × ${distance.toFixed(0)}mi = $${formatCurrency(drivingCost)}`)
        y += lineHeight
      }
      push('Summary', true)
      const summaryColWidths = [100, 70]
      const summaryRows: [string, string][] = [
        ['Materials Total', `$${formatCurrency(totalMaterials)}`],
        ['Labor', `$${formatCurrency(laborCost)}`],
      ]
      if (distance > 0 && totalHours > 0) {
        summaryRows.push(['Driving', `$${formatCurrency(drivingCost)}`])
      }
      summaryRows.push(
        ['Labor total', `$${formatCurrency(laborCostWithDriving)}`],
        ['Grand total', `$${formatCurrency(grandTotal)}`]
      )
      y = drawTable(y, summaryColWidths, ['Item', 'Amount'], summaryRows)
    }

    // Page 4: Cover Letter
    doc.addPage()
    y = margin
    doc.setFontSize(16)
    push(`${bidDisplayName(b) || 'Bid'} — Cover Letter`, true)
    y += lineHeight * 2
    doc.setFontSize(11)

    const customerName = b.customers?.name ?? b.bids_gc_builders?.name ?? '—'
    const customerAddress = b.customers?.address ?? b.bids_gc_builders?.address ?? '—'
    const projectNameVal = b.project_name ?? '—'
    const projectAddressVal = b.address ?? '—'
    let coverLetterRevenue = 0
    const fixtureRows: { fixture: string; count: number }[] = []
    if (versionId && countRows.length > 0) {
      const entriesRaw = (await supabase.from('price_book_entries').select('*, fixture_types(name)').eq('version_id', versionId)).data as PriceBookEntryWithFixture[] ?? []
      const entries = [...entriesRaw].sort((a, b) => (a.fixture_types?.name ?? '').localeCompare(b.fixture_types?.name ?? '', undefined, { numeric: true }))
      const assignments = (await supabase.from('bid_pricing_assignments').select('*').eq('bid_id', bidId).eq('price_book_version_id', versionId)).data as BidPricingAssignment[] ?? []
      const entriesById = new Map(entries.map((e) => [e.id, e]))
      countRows.forEach((countRow) => {
        const assignment = assignments.find((a) => a.count_row_id === countRow.id)
        const entry = assignment ? entriesById.get(assignment.price_book_entry_id) : entries.find((e) => (e.fixture_types?.name ?? '').toLowerCase() === (countRow.fixture ?? '').toLowerCase())
        const count = Number(countRow.count)
        const unitPrice = entry ? Number(entry.total_price) : 0
        const isFixedPrice = assignment?.is_fixed_price ?? false
        const revenue = isFixedPrice ? unitPrice : count * unitPrice
        coverLetterRevenue += revenue
        fixtureRows.push({ fixture: countRow.fixture ?? '', count: count })
      })
    }
    const revenueWords = numberToWords(coverLetterRevenue).toUpperCase()
    const revenueNumber = `$${formatCurrency(coverLetterRevenue)}`
    const inclusions = coverLetterInclusionsByBid[b.id] ?? DEFAULT_INCLUSIONS
    const exclusions = coverLetterExclusionsByBid[b.id] ?? DEFAULT_EXCLUSIONS
    const terms = coverLetterTermsByBid[b.id] ?? DEFAULT_TERMS_AND_WARRANTY
    const designDrawingPlanDateFormatted = (coverLetterIncludeDesignDrawingPlanDateByBid[b.id] && b.design_drawing_plan_date) ? formatDesignDrawingPlanDate(b.design_drawing_plan_date) : null
    const coverLetterText = buildCoverLetterText(customerName, customerAddress, projectNameVal, projectAddressVal, revenueWords, revenueNumber, fixtureRows, inclusions, exclusions, terms, designDrawingPlanDateFormatted)
    const coverLines = coverLetterText.split('\n')
    for (const line of coverLines) {
      if (y > pageH - margin) { doc.addPage(); y = margin }

      const isInclusionsHeading = line === 'Inclusions:'
      const isExclusionsHeading = line === 'Exclusions and Scope:'
      const makeBold = isInclusionsHeading || isExclusionsHeading

      if (makeBold) {
        doc.setFont('helvetica', 'bold')
      }

      const maxW = pageW - 2 * margin
      const wrapped = doc.splitTextToSize(line, maxW)
      for (const w of wrapped) {
        doc.text(w, margin, y)
        y += lineHeight
      }

      if (makeBold) {
        doc.setFont('helvetica', 'normal')
      }
    }

    const filename = `Approval_${(bidDisplayName(b) || 'Bid').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 40)}.pdf`
    doc.save(filename)
  }

  async function printFollowupSheet(accountManagerFilter: string) {
    if (!accountManagerFilter) return

    // Load all submission entries for the bids
    const { data: submissionEntries } = await supabase
      .from('bids_submission_entries')
      .select('*')
      .order('occurred_at', { ascending: false })
    
    // Group entries by bid_id and take latest 3
    const entriesByBid = new Map<string, BidSubmissionEntry[]>()
    for (const entry of submissionEntries ?? []) {
      if (!entry.bid_id) continue
      const existing = entriesByBid.get(entry.bid_id) ?? []
      if (existing.length < 3) {
        existing.push(entry)
        entriesByBid.set(entry.bid_id, existing)
      }
    }

    const escapeHtml = (s: string) => 
      (s ?? '').replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               .replace(/"/g, '&quot;')

    const formatOutcome = (outcome: string | null): string => {
      if (!outcome) return '—'
      if (outcome === 'won') return 'Won'
      if (outcome === 'lost') return 'Lost'
      if (outcome === 'started_or_complete') return 'Started/Complete'
      return '—'
    }

    // Helper to format submission entries HTML
    const renderSubmissionEntriesHtml = (bidId: string): string => {
      const entries = entriesByBid.get(bidId) ?? []
      if (entries.length === 0) return ''
      
      return `
        <div class="submission-entries">
          <div class="submission-header">Recent Contact Attempts:</div>
          ${entries.map((entry, idx) => `
            <div class="submission-entry">
              <span class="submission-label">${idx + 1}.</span>
              <span class="submission-label">Contact Method:</span> ${escapeHtml(entry.contact_method ?? '—')}
              <span class="submission-label">Notes:</span> ${escapeHtml(entry.notes ?? '—')}
              <span class="submission-label">Time:</span> ${entry.occurred_at ? new Date(entry.occurred_at).toLocaleString() : '—'}
            </div>
          `).join('')}
        </div>
      `
    }

    // Generate HTML for a single project
    const renderProjectHtml = (bid: BidWithBuilder): string => {
      const builderName = bid.customers?.name ?? bid.bids_gc_builders?.name ?? '—'
      const builderAddress = bid.customers?.address ?? bid.bids_gc_builders?.address ?? '—'
      const builderPhone = bid.customers 
        ? extractContactInfo(bid.customers.contact_info ?? null).phone || '—' 
        : (bid.bids_gc_builders?.contact_number ?? '—')
      const builderEmail = bid.customers 
        ? extractContactInfo(bid.customers.contact_info ?? null).email || '—' 
        : (bid.bids_gc_builders?.email ?? '—')

      return `<div class="project">
        <div class="project-title">Project: ${escapeHtml(bid.project_name ?? '—')}</div>
        <div class="field"><span class="label">Address:</span> ${escapeHtml(bid.address ?? '—')}</div>
        <div class="field-indented"><span class="label">Builder:</span> ${escapeHtml(builderName)}</div>
        <div class="field-indented"><span class="label">Builder Phone:</span> ${builderPhone !== '—' ? `<a href="tel:${builderPhone.replace(/[^0-9+]/g, '')}">${escapeHtml(builderPhone)}</a>` : '—'}</div>
        <div class="field-indented"><span class="label">Builder Address:</span> ${escapeHtml(builderAddress)}</div>
        <div class="field-indented"><span class="label">Builder Email:</span> ${builderEmail !== '—' ? `<a href="mailto:${escapeHtml(builderEmail)}">${escapeHtml(builderEmail)}</a>` : '—'}</div>
        <div class="field"><span class="label">Project Contact:</span> ${escapeHtml(bid.gc_contact_name ?? '—')}</div>
        <div class="field"><span class="label">Project Contact Phone:</span> ${bid.gc_contact_phone && bid.gc_contact_phone !== '—' ? `<a href="tel:${bid.gc_contact_phone.replace(/[^0-9+]/g, '')}">${escapeHtml(bid.gc_contact_phone)}</a>` : '—'}</div>
        <div class="field"><span class="label">Project Contact Email:</span> ${bid.gc_contact_email && bid.gc_contact_email !== '—' ? `<a href="mailto:${escapeHtml(bid.gc_contact_email)}">${escapeHtml(bid.gc_contact_email)}</a>` : '—'}</div>
        <div class="field-indented"><span class="label">Win/ Loss:</span> ${formatOutcome(bid.outcome)}</div>
        <div class="field-indented"><span class="label">Bid Date:</span> ${formatDateYYMMDD(bid.bid_due_date)}</div>
        <div class="field-indented"><span class="label">Bid Date Sent:</span> ${formatDateYYMMDD(bid.bid_date_sent)}</div>
        <div class="field-indented"><span class="label">Design Drawing Plan Date:</span> ${formatDesignDrawingPlanDate(bid.design_drawing_plan_date)}</div>
        <div class="field"><span class="label">Bid Value:</span> ${formatCompactCurrency(bid.bid_value != null ? Number(bid.bid_value) : null)}</div>
        <div class="field"><span class="label">Agreed Value:</span> ${formatCompactCurrency(bid.agreed_value != null ? Number(bid.agreed_value) : null)}</div>
        <div class="field"><span class="label">Distance to Office:</span> ${bid.distance_from_office ? parseFloat(bid.distance_from_office).toFixed(1) + ' mi' : '—'}</div>
        <div class="field"><span class="label">Notes:</span> ${escapeHtml(bid.notes ?? '—')}</div>
        ${renderSubmissionEntriesHtml(bid.id)}
      </div>`
    }

    // Generate HTML section for unassigned bids
    const renderUnassignedSection = (): string => {
      const unassignedBids = bids.filter(b => {
        const am = b.account_manager
        const accountManager = am == null ? null : Array.isArray(am) ? am[0] ?? null : am
        return !accountManager
      })
      const notYetWonOrLost = unassignedBids.filter(b => 
        !b.outcome || (b.outcome !== 'won' && b.outcome !== 'lost' && b.outcome !== 'started_or_complete')
      )
      const won = unassignedBids.filter(b => b.outcome === 'won')

      let html = '<h2>Not yet won or lost</h2>'
      if (notYetWonOrLost.length === 0) {
        html += '<p class="empty-section">None</p>'
      } else {
        html += notYetWonOrLost.map(renderProjectHtml).join('')
      }

      html += '<h2>Won</h2>'
      if (won.length === 0) {
        html += '<p class="empty-section">None</p>'
      } else {
        html += won.map(renderProjectHtml).join('')
      }

      return html
    }

    // Generate HTML section for one account manager
    const renderManagerSection = (managerId: string): string => {
      const bidsForManager = bids.filter(b => {
        const am = b.account_manager
        const accountManager = am == null ? null : Array.isArray(am) ? am[0] ?? null : am
        return accountManager?.id === managerId
      })
      const notYetWonOrLost = bidsForManager.filter(b => 
        !b.outcome || (b.outcome !== 'won' && b.outcome !== 'lost' && b.outcome !== 'started_or_complete')
      )
      const won = bidsForManager.filter(b => b.outcome === 'won')

      let html = '<h2>Not yet won or lost</h2>'
      if (notYetWonOrLost.length === 0) {
        html += '<p class="empty-section">None</p>'
      } else {
        html += notYetWonOrLost.map(renderProjectHtml).join('')
      }

      html += '<h2>Won</h2>'
      if (won.length === 0) {
        html += '<p class="empty-section">None</p>'
      } else {
        html += won.map(renderProjectHtml).join('')
      }

      return html
    }

    // Generate HTML content
    let bodyContent: string
    let title: string

    if (accountManagerFilter === 'ALL') {
      title = 'Followup Sheets - All Account Managers'
      const allSections: string[] = []
      
      // Add each account manager's section
      uniqueAccountManagers.forEach((manager) => {
        allSections.push(`<div style="page-break-after: always;">
          <h1>Followup Sheet for ${escapeHtml(manager.name)}</h1>
          ${renderManagerSection(manager.id)}
        </div>`)
      })
      
      // Add unassigned section (without page break after since it's the last)
      if (unassignedBidsCount > 0) {
        allSections.push(`<div>
          <h1>Followup Sheet for Unassigned</h1>
          ${renderUnassignedSection()}
        </div>`)
      }
      
      bodyContent = allSections.join('')
      
      if (uniqueAccountManagers.length === 0 && unassignedBidsCount === 0) {
        bodyContent = '<p class="empty-section">No bids found.</p>'
      }
    } else if (accountManagerFilter === 'UNASSIGNED') {
      title = 'Followup Sheet - Unassigned'
      bodyContent = `<h1>Followup Sheet for Unassigned</h1>
        ${renderUnassignedSection()}`
    } else {
      const manager = uniqueAccountManagers.find(m => m.id === accountManagerFilter)
      if (!manager) return
      title = `Followup Sheet - ${escapeHtml(manager.name)}`
      bodyContent = `<h1>Followup Sheet for ${escapeHtml(manager.name)}</h1>
        ${renderManagerSection(manager.id)}`
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
  body { font-family: sans-serif; margin: 1in; }
  h1 { font-size: 1.3rem; margin-bottom: 0.75rem; }
  h2 { font-size: 1.1rem; margin: 1rem 0 0.4rem; border-bottom: 2px solid #333; padding-bottom: 0.2rem; }
  .project { margin-bottom: 1rem; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px; page-break-inside: avoid; }
  .project-title { font-weight: bold; font-size: 1rem; margin-bottom: 0.4rem; }
  .field { margin: 0.15rem 0; }
  .field-indented { margin: 0.15rem 0; padding-left: 10ch; }
  .label { font-weight: bold; }
  .empty-section { color: #6b7280; font-style: italic; }
  a { color: #3b82f6; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .submission-entries { margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #e5e7eb; }
  .submission-header { font-weight: bold; margin-bottom: 0.3rem; font-size: 0.9rem; }
  .submission-entry { margin: 0.2rem 0; font-size: 0.85rem; padding-left: 1rem; }
  .submission-label { font-weight: bold; margin-right: 0.3rem; }
  @media print { 
    body { margin: 0.4in; }
    .project { page-break-inside: avoid; }
  }
</style></head><body>
  ${bodyContent}
</body></html>`

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
    win.onafterprint = () => win.close()
  }

  async function downloadFollowupSheetPdf(accountManagerFilter: string) {
    if (!accountManagerFilter) return

    // Load submission entries
    const { data: submissionEntries } = await supabase
      .from('bids_submission_entries')
      .select('*')
      .order('occurred_at', { ascending: false })
    
    const entriesByBid = new Map<string, BidSubmissionEntry[]>()
    for (const entry of submissionEntries ?? []) {
      if (!entry.bid_id) continue
      const existing = entriesByBid.get(entry.bid_id) ?? []
      if (existing.length < 3) {
        existing.push(entry)
        entriesByBid.set(entry.bid_id, existing)
      }
    }

    const formatOutcome = (outcome: string | null): string => {
      if (!outcome) return '—'
      if (outcome === 'won') return 'Won'
      if (outcome === 'lost') return 'Lost'
      if (outcome === 'started_or_complete') return 'Started/Complete'
      return '—'
    }

    const doc = new jsPDF({ format: 'a4', unit: 'mm' })
    const margin = 10
    const lineHeight = 5
    let y = margin
    const pageH = doc.internal.pageSize.getHeight()

    const push = (text: string, bold = false): void => {
      if (y > pageH - margin) { doc.addPage(); y = margin }
      if (bold) doc.setFont('helvetica', 'bold')
      doc.text(text, margin, y)
      if (bold) doc.setFont('helvetica', 'normal')
      y += lineHeight
    }

    const pushLink = (label: string, value: string, linkType: 'tel' | 'mailto' | null = null): void => {
      if (y > pageH - margin) { doc.addPage(); y = margin }
      doc.setFont('helvetica', 'bold')
      doc.text(label + ' ', margin, y)
      const labelW = doc.getTextWidth(label + ' ')
      doc.setFont('helvetica', 'normal')
      
      if (value !== '—' && linkType) {
        // Create clickable link
        let url = ''
        if (linkType === 'tel') {
          const phoneClean = value.replace(/[^0-9+]/g, '')
          url = `tel:${phoneClean}`
        } else if (linkType === 'mailto') {
          url = `mailto:${value}`
        }
        
        doc.setTextColor(0, 0, 255)
        doc.textWithLink(value, margin + labelW, y, { url })
        doc.setTextColor(0, 0, 0)
      } else {
        doc.text(value, margin + labelW, y)
      }
      y += lineHeight
    }

    const renderSubmissionEntriesPdf = (bidId: string): void => {
      const entries = entriesByBid.get(bidId) ?? []
      if (entries.length === 0) return
      
      y += lineHeight * 0.3
      push('Recent Contact Attempts:', true)
      doc.setFontSize(9)
      
      entries.forEach((entry, idx) => {
        push(`  ${idx + 1}. Contact Method: ${entry.contact_method ?? '—'}`)
        push(`     Notes: ${entry.notes ?? '—'}`)
        push(`     Time: ${entry.occurred_at ? new Date(entry.occurred_at).toLocaleString() : '—'}`)
        y += lineHeight * 0.2
      })
      
      doc.setFontSize(10)
    }

    const renderProjectPdf = (bid: BidWithBuilder): void => {
      const builderName = bid.customers?.name ?? bid.bids_gc_builders?.name ?? '—'
      const builderAddress = bid.customers?.address ?? bid.bids_gc_builders?.address ?? '—'
      const builderPhone = bid.customers 
        ? extractContactInfo(bid.customers.contact_info ?? null).phone || '—' 
        : (bid.bids_gc_builders?.contact_number ?? '—')
      const builderEmail = bid.customers 
        ? extractContactInfo(bid.customers.contact_info ?? null).email || '—' 
        : (bid.bids_gc_builders?.email ?? '—')

      if (y > pageH - margin - 80) { doc.addPage(); y = margin }
      
      push(`Project: ${bid.project_name ?? '—'}`, true)
      push(`  Address: ${bid.address ?? '—'}`)
      push(`          Builder: ${builderName}`)
      pushLink('          Builder Phone:', builderPhone, 'tel')
      push(`          Builder Address: ${builderAddress}`)
      pushLink('          Builder Email:', builderEmail, 'mailto')
      push(`  Project Contact: ${bid.gc_contact_name ?? '—'}`)
      pushLink('  Project Contact Phone:', bid.gc_contact_phone ?? '—', 'tel')
      pushLink('  Project Contact Email:', bid.gc_contact_email ?? '—', 'mailto')
      push(`          Win/ Loss: ${formatOutcome(bid.outcome)}`)
      push(`          Bid Date: ${formatDateYYMMDD(bid.bid_due_date)}`)
      push(`          Bid Date Sent: ${formatDateYYMMDD(bid.bid_date_sent)}`)
      push(`          Design Drawing Plan Date: ${formatDesignDrawingPlanDate(bid.design_drawing_plan_date)}`)
      push(`  Bid Value: ${formatCompactCurrency(bid.bid_value != null ? Number(bid.bid_value) : null)}`)
      push(`  Agreed Value: ${formatCompactCurrency(bid.agreed_value != null ? Number(bid.agreed_value) : null)}`)
      push(`  Distance to Office: ${bid.distance_from_office ? parseFloat(bid.distance_from_office).toFixed(1) + ' mi' : '—'}`)
      push(`  Notes: ${bid.notes ?? '—'}`)
      renderSubmissionEntriesPdf(bid.id)
      y += lineHeight * 0.5
    }

    const renderUnassignedBids = (): void => {
      const unassignedBids = bids.filter(b => {
        const am = b.account_manager
        const accountManager = am == null ? null : Array.isArray(am) ? am[0] ?? null : am
        return !accountManager
      })
      const notYetWonOrLost = unassignedBids.filter(b => 
        !b.outcome || (b.outcome !== 'won' && b.outcome !== 'lost' && b.outcome !== 'started_or_complete')
      )
      const won = unassignedBids.filter(b => b.outcome === 'won')

      push('Not yet won or lost', true)
      if (notYetWonOrLost.length === 0) {
        push('None')
      } else {
        notYetWonOrLost.forEach(renderProjectPdf)
      }

      y += lineHeight
      push('Won', true)
      if (won.length === 0) {
        push('None')
      } else {
        won.forEach(renderProjectPdf)
      }
    }

    const renderManagerBids = (managerId: string): void => {
      const bidsForManager = bids.filter(b => {
        const am = b.account_manager
        const accountManager = am == null ? null : Array.isArray(am) ? am[0] ?? null : am
        return accountManager?.id === managerId
      })
      const notYetWonOrLost = bidsForManager.filter(b => 
        !b.outcome || (b.outcome !== 'won' && b.outcome !== 'lost' && b.outcome !== 'started_or_complete')
      )
      const won = bidsForManager.filter(b => b.outcome === 'won')

      push('Not yet won or lost', true)
      if (notYetWonOrLost.length === 0) {
        push('None')
      } else {
        notYetWonOrLost.forEach(renderProjectPdf)
      }

      y += lineHeight
      push('Won', true)
      if (won.length === 0) {
        push('None')
      } else {
        won.forEach(renderProjectPdf)
      }
    }

    // Generate PDF content
    if (accountManagerFilter === 'ALL') {
      doc.setFontSize(14)
      push('Followup Sheets - All Account Managers', true)
      y += lineHeight
      doc.setFontSize(10)
      
      // Add each account manager's section
      uniqueAccountManagers.forEach((manager, idx) => {
        if (idx > 0) { doc.addPage(); y = margin }
        doc.setFontSize(12)
        push(`Followup Sheet for ${manager.name}`, true)
        y += lineHeight * 0.5
        doc.setFontSize(10)
        renderManagerBids(manager.id)
      })
      
      // Add unassigned section
      if (unassignedBidsCount > 0) {
        doc.addPage()
        y = margin
        doc.setFontSize(12)
        push('Followup Sheet for Unassigned', true)
        y += lineHeight * 0.5
        doc.setFontSize(10)
        renderUnassignedBids()
      }
    } else if (accountManagerFilter === 'UNASSIGNED') {
      doc.setFontSize(12)
      push('Followup Sheet - Unassigned', true)
      y += lineHeight
      doc.setFontSize(10)
      renderUnassignedBids()
    } else {
      const manager = uniqueAccountManagers.find(m => m.id === accountManagerFilter)
      if (!manager) return
      doc.setFontSize(12)
      push(`Followup Sheet - ${manager.name}`, true)
      y += lineHeight
      doc.setFontSize(10)
      renderManagerBids(manager.id)
    }

    // Download the PDF
    const filename = accountManagerFilter === 'ALL' 
      ? 'followup-sheets-all.pdf'
      : accountManagerFilter === 'UNASSIGNED'
      ? 'followup-sheet-unassigned.pdf'
      : `followup-sheet-${uniqueAccountManagers.find(m => m.id === accountManagerFilter)?.name.toLowerCase().replace(/\s+/g, '-') ?? 'manager'}.pdf`
    
    doc.save(filename)
  }

  function setCostEstimateLaborRow(rowId: string, updates: Partial<Pick<CostEstimateLaborRow, 'rough_in_hrs_per_unit' | 'top_out_hrs_per_unit' | 'trim_set_hrs_per_unit' | 'is_fixed'>>) {
    setCostEstimateLaborRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, ...updates } : r))
    )
  }

  function laborRowHours(r: CostEstimateLaborRow): number {
    const hrs = Number(r.rough_in_hrs_per_unit) + Number(r.top_out_hrs_per_unit) + Number(r.trim_set_hrs_per_unit)
    return r.is_fixed ? hrs : Number(r.count) * hrs
  }
  function laborRowRough(r: CostEstimateLaborRow): number {
    return r.is_fixed ? Number(r.rough_in_hrs_per_unit) : Number(r.count) * Number(r.rough_in_hrs_per_unit)
  }
  function laborRowTop(r: CostEstimateLaborRow): number {
    return r.is_fixed ? Number(r.top_out_hrs_per_unit) : Number(r.count) * Number(r.top_out_hrs_per_unit)
  }
  function laborRowTrim(r: CostEstimateLaborRow): number {
    return r.is_fixed ? Number(r.trim_set_hrs_per_unit) : Number(r.count) * Number(r.trim_set_hrs_per_unit)
  }

  function setTakeoffMapping(mappingId: string, updates: { templateId?: string; stage?: TakeoffStage; quantity?: number }) {
    setTakeoffMappings((prev) => {
      const originalMapping = prev.find(m => m.id === mappingId)
      
      // Check if we're changing template or stage on a saved mapping
      // If so, we need to delete the old one and insert a new one
      const isChangingUniqueFields = originalMapping?.isSaved && (
        (updates.templateId !== undefined && updates.templateId !== originalMapping.templateId) ||
        (updates.stage !== undefined && updates.stage !== originalMapping.stage)
      )
      
      let mappingToSave: TakeoffMapping | null = null
      
      const updated = prev.map((m) => {
        if (m.id === mappingId) {
          const updatedMapping = { 
            ...m, 
            ...(updates.templateId !== undefined && { templateId: updates.templateId }), 
            ...(updates.stage !== undefined && { stage: updates.stage }), 
            ...(updates.quantity !== undefined && { quantity: updates.quantity }) 
          }
          
          // If changing unique constraint fields, mark as not saved and generate new ID
          if (isChangingUniqueFields) {
            mappingToSave = { ...updatedMapping, isSaved: false, id: crypto.randomUUID() }
            return mappingToSave
          }
          
          mappingToSave = updatedMapping
          return updatedMapping
        }
        return m
      })
      
      // Delete old mapping if we're changing unique fields
      if (isChangingUniqueFields && originalMapping) {
        supabase
          .from('bids_takeoff_template_mappings')
          .delete()
          .eq('id', originalMapping.id)
          .then(({ error }) => {
            if (error) {
              console.error('Failed to delete old takeoff mapping:', error)
            }
          })
      }
      
      // Save the updated mapping to database
      if (mappingToSave) {
        saveTakeoffMapping(mappingToSave)
      }
      
      return updated
    })
  }

  async function saveTakeoffMapping(mapping: TakeoffMapping) {
    if (!selectedBidForTakeoff?.id || !mapping.templateId) return
    
    const mappingData: any = {
      bid_id: selectedBidForTakeoff.id,
      count_row_id: mapping.countRowId,
      template_id: mapping.templateId,
      stage: mapping.stage,
      quantity: mapping.quantity,
      sequence_order: takeoffMappings.filter(m => m.countRowId === mapping.countRowId).indexOf(mapping)
    }
    
    // Include ID if this is an existing mapping to ensure we update the correct record
    if (mapping.isSaved) {
      mappingData.id = mapping.id
    }
    
    // Use upsert to handle both insert and update cases
    // When ID is provided, it updates that specific record
    // When ID is not provided and there's a conflict on the unique constraint, it updates the conflicting record
    const { data, error } = await supabase
      .from('bids_takeoff_template_mappings')
      .upsert(mappingData, { 
        onConflict: 'count_row_id,template_id,stage',
        ignoreDuplicates: false 
      })
      .select()
      .single()
    
    if (error) {
      console.error('Failed to save takeoff mapping:', error)
      setError(`Failed to save template assignment: ${error.message}`)
    } else if (data && !mapping.isSaved) {
      // Update local state with database ID for newly created mappings
      const savedId = (data as { id: string }).id
      setTakeoffMappings(prev => prev.map(m => 
        m.id === mapping.id ? { ...m, id: savedId, isSaved: true } : m
      ))
    }
  }

  function addTakeoffTemplate(countRowId: string, count?: number) {
    const quantity = count != null && !Number.isNaN(Number(count)) ? Math.max(1, Number(count)) : 1
    const newMapping: TakeoffMapping = { 
      id: crypto.randomUUID(), 
      countRowId, 
      templateId: '', 
      stage: 'rough_in', 
      quantity,
      isSaved: false
    }
    setTakeoffMappings((prev) => [...prev, newMapping])
    // Don't save yet - wait until user selects a template
  }

  async function removeTakeoffMapping(mappingId: string) {
    const mapping = takeoffMappings.find(m => m.id === mappingId)
    
    // Remove from local state first for immediate UI update
    setTakeoffMappings((prev) => prev.filter((m) => m.id !== mappingId))
    
    // If it was saved to database, delete it
    if (mapping?.isSaved) {
      const { error } = await supabase
        .from('bids_takeoff_template_mappings')
        .delete()
        .eq('id', mappingId)
      
      if (error) {
        console.error('Failed to delete takeoff mapping:', error)
        // Revert local change on error
        setTakeoffMappings((prev) => [...prev, mapping])
      }
    }
  }

  async function createPOFromTakeoff() {
    if (!authUser?.id || !selectedBidForTakeoff) return
    const mapped = takeoffMappings.filter((m) => m.templateId.trim())
    if (mapped.length === 0) {
      setError('Select an assembly for at least one fixture to create a purchase order.')
      return
    }
    setTakeoffCreatingPO(true)
    setError(null)
    setTakeoffSuccessMessage(null)
    const projectName = selectedBidForTakeoff.project_name?.trim() || 'Project'
    const dateStr = new Date().toLocaleDateString()
    const stages: TakeoffStage[] = ['rough_in', 'top_out', 'trim_set']
    const createdIds: string[] = []
    const createdLabels: string[] = []
    const createdByStage: Partial<Record<'rough_in' | 'top_out' | 'trim_set', string>> = {}
    for (const stage of stages) {
      const mappingsForStage = mapped.filter((m) => m.stage === stage)
      if (mappingsForStage.length === 0) continue
      const stageLabel = STAGE_LABELS[stage]
      const poName = `${projectName} – Takeoff ${dateStr} – ${stageLabel}`
      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          name: poName,
          status: 'draft',
          created_by: authUser.id,
          notes: null,
          stage,
          service_type_id: selectedServiceTypeId,
        })
        .select('id')
        .single()
      if (poError) {
        setError(`Failed to create PO: ${poError.message}`)
        setTakeoffCreatingPO(false)
        return
      }
      const allParts: Array<{ part_id: string; quantity: number }> = []
      for (const m of mappingsForStage) {
        const qty = Math.max(1, Math.round(Number(m.quantity)) || 1)
        const parts = await expandTemplate(supabase, m.templateId, qty)
        allParts.push(...parts)
      }
      const addErr = await addExpandedPartsToPO(supabase, poData.id, allParts)
      if (addErr) {
        setError(addErr)
        setTakeoffCreatingPO(false)
        return
      }
      createdIds.push(poData.id)
      createdLabels.push(stageLabel)
      createdByStage[stage] = poData.id
    }
    setTakeoffCreatingPO(false)
    setTakeoffSuccessMessage(
      createdLabels.length === 1
        ? `Purchase order "${projectName} – Takeoff ${dateStr} – ${createdLabels[0]}" created. Open Materials → Purchase Orders to edit.`
        : `Purchase orders created for ${createdLabels.join(', ')}. Open Materials → Purchase Orders to edit.`
    )
    setTakeoffCreatedPOId(createdIds[0] ?? null)
    loadDraftPOs()
    if (selectedBidForTakeoff?.id && Object.keys(createdByStage).length > 0) {
      const est = await ensureCostEstimateForBid(selectedBidForTakeoff.id)
      if (est) {
        await supabase
          .from('cost_estimates')
          .update({
            purchase_order_id_rough_in: createdByStage.rough_in ?? est.purchase_order_id_rough_in ?? null,
            purchase_order_id_top_out: createdByStage.top_out ?? est.purchase_order_id_top_out ?? null,
            purchase_order_id_trim_set: createdByStage.trim_set ?? est.purchase_order_id_trim_set ?? null,
          })
          .eq('id', est.id)
        await loadPurchaseOrdersForCostEstimate()
        if (activeTab === 'cost-estimate' && selectedBidForCostEstimate?.id === selectedBidForTakeoff.id) {
          await loadCostEstimate(selectedBidForTakeoff.id)
        }
      }
    }
  }

  async function addTakeoffToExistingPO() {
    if (!authUser?.id || !takeoffExistingPOId.trim()) return
    const mapped = takeoffMappings.filter((m) => m.templateId.trim())
    if (mapped.length === 0) {
      setError('Select an assembly for at least one fixture to add to a purchase order.')
      return
    }
    setTakeoffAddingToPO(true)
    setError(null)
    setTakeoffSuccessMessage(null)
    for (const m of mapped) {
      const qty = Math.max(1, Math.round(Number(m.quantity)) || 1)
      const parts = await expandTemplate(supabase, m.templateId, qty)
      const addErr = await addExpandedPartsToPO(supabase, takeoffExistingPOId, parts, m.templateId)
      if (addErr) {
        setError(addErr)
        setTakeoffAddingToPO(false)
        return
      }
    }
    setTakeoffAddingToPO(false)
    const po = draftPOs.find((p) => p.id === takeoffExistingPOId)
    setTakeoffSuccessMessage(`Items added to "${po?.name ?? 'purchase order'}". Open Materials → Purchase Orders to view.`)
    setTakeoffCreatedPOId(takeoffExistingPOId)
    loadDraftPOs()
    setTakeoffExistingPOItems('loading')
    const { data, error } = await supabase
      .from('purchase_order_items')
      .select('quantity, price_at_time, material_parts(name), source_template:material_templates!source_template_id(id, name)')
      .eq('purchase_order_id', takeoffExistingPOId)
      .order('sequence_order', { ascending: true })
    if (!error && data) {
      const rows = data as unknown as Array<{ quantity: number; price_at_time: number; material_parts: { name: string } | null; source_template: { id: string; name: string } | null }>
      setTakeoffExistingPOItems(
        rows.map((row) => ({
          part_name: row.material_parts?.name ?? '—',
          quantity: row.quantity,
          price_at_time: row.price_at_time,
          template_name: row.source_template?.name ?? null,
        }))
      )
    } else {
      setTakeoffExistingPOItems(null)
    }
  }

  useEffect(() => {
    loadRole()
  }, [authUser?.id])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('new') === 'true') {
      openNewBid()
      // Remove the parameter from URL without causing a re-render
      navigate('/bids', { replace: true })
    }
  }, [location.search])

  useEffect(() => {
    if (myRole === 'dev' || myRole === 'master_technician' || myRole === 'assistant' || myRole === 'estimator') {
      const load = async () => {
        try {
          // Load service types first
          await loadServiceTypes()
          await loadFixtureTypes()
        } finally {
          setLoading(false)
        }
      }
      load()
    }
  }, [myRole, estimatorServiceTypeIds])
  
  // Reload data when service type changes
  useEffect(() => {
    if (selectedServiceTypeId && (myRole === 'dev' || myRole === 'master_technician' || myRole === 'assistant' || myRole === 'estimator')) {
      const loadForServiceType = async () => {
        await Promise.all([loadCustomers(), loadBids(), loadEstimatorUsers(), loadFixtureTypes(), loadPartTypes(), loadSupplyHouses(), loadTakeoffBookVersions(), loadLaborBookVersions(), loadPriceBookVersions(), loadMaterialTemplates()])
      }
      loadForServiceType()
    }
  }, [selectedServiceTypeId])

  useEffect(() => {
    if (selectedBidForCounts?.id) loadCountRows(selectedBidForCounts.id)
    else setCountRows([])
  }, [selectedBidForCounts?.id])

  useEffect(() => {
    if (selectedBidForSubmission?.id) loadSubmissionEntries(selectedBidForSubmission.id)
    else setSubmissionEntries([])
  }, [selectedBidForSubmission?.id])

  useEffect(() => {
    const bidId = selectedBidForSubmission?.id
    if (!bidId) {
      setSubmissionBidHasCostEstimate(null)
      setSubmissionBidCostEstimateAmount(null)
      setSubmissionPricingByVersion([])
      return
    }
    setSubmissionBidHasCostEstimate('loading')
    setSubmissionBidCostEstimateAmount(null)
    let cancelled = false
    ;(async () => {
      const { data: est, error: e } = await supabase
        .from('cost_estimates')
        .select('id, labor_rate, purchase_order_id_rough_in, purchase_order_id_top_out, purchase_order_id_trim_set')
        .eq('bid_id', bidId)
        .maybeSingle()
      if (e || cancelled) {
        if (!cancelled) setSubmissionBidHasCostEstimate(null)
        return
      }
      if (!est) {
        setSubmissionBidHasCostEstimate(false)
        return
      }
      const [laborRes, roughTotal, topTotal, trimTotal] = await Promise.all([
        supabase.from('cost_estimate_labor_rows').select('*').eq('cost_estimate_id', est.id),
        est.purchase_order_id_rough_in ? loadPOTotal(est.purchase_order_id_rough_in) : Promise.resolve(0),
        est.purchase_order_id_top_out ? loadPOTotal(est.purchase_order_id_top_out) : Promise.resolve(0),
        est.purchase_order_id_trim_set ? loadPOTotal(est.purchase_order_id_trim_set) : Promise.resolve(0),
      ])
      if (cancelled) return
      const laborRows = (laborRes.data as CostEstimateLaborRow[]) ?? []
      const totalMaterials = (roughTotal ?? 0) + (topTotal ?? 0) + (trimTotal ?? 0)
      const totalHours = laborRows.reduce(
        (s, r) => s + laborRowHours(r),
        0
      )
      const rate = est.labor_rate != null ? Number(est.labor_rate) : 0
      const laborCost = totalHours * rate
      const grandTotal = totalMaterials + laborCost
      setSubmissionBidHasCostEstimate(true)
      setSubmissionBidCostEstimateAmount(grandTotal)
    })()
    return () => { cancelled = true }
  }, [selectedBidForSubmission?.id])

  useEffect(() => {
    const bidId = selectedBidForSubmission?.id
    const cost = submissionBidCostEstimateAmount
    const versions = priceBookVersions
    if (!bidId || versions.length === 0) {
      setSubmissionPricingByVersion([])
      return
    }
    let cancelled = false
    ;(async () => {
      const { data: countData, error: countErr } = await supabase
        .from('bids_count_rows')
        .select('*')
        .eq('bid_id', bidId)
        .order('sequence_order', { ascending: true })
      if (countErr || cancelled) {
        if (!cancelled) setSubmissionPricingByVersion([])
        return
      }
      const countRows = (countData as BidCountRow[]) ?? []
      const results = await Promise.all(
        versions.map(async (v) => {
          const [entriesRes, assignRes] = await Promise.all([
            supabase.from('price_book_entries').select('*, fixture_types(name)').eq('version_id', v.id),
            supabase.from('bid_pricing_assignments').select('*').eq('bid_id', bidId).eq('price_book_version_id', v.id),
          ])
          const entries = (entriesRes.data as PriceBookEntryWithFixture[]) ?? []
          entries.sort((a, b) => (a.fixture_types?.name ?? '').localeCompare(b.fixture_types?.name ?? '', undefined, { numeric: true }))
          const assignments = (assignRes.data as BidPricingAssignment[]) ?? []
          const entriesById = new Map(entries.map((e) => [e.id, e]))
          let totalRevenue = 0
          let complete = true
          for (const row of countRows) {
            const assignment = assignments.find((a) => a.count_row_id === row.id)
            const entry = assignment ? entriesById.get(assignment.price_book_entry_id) : entries.find((e) => (e.fixture_types?.name ?? '').toLowerCase() === (row.fixture ?? '').toLowerCase())
            if (!entry) complete = false
            const unitPrice = entry ? Number(entry.total_price) : 0
            totalRevenue += Number(row.count) * unitPrice
          }
          const margin = complete && totalRevenue > 0 && cost != null ? (totalRevenue - cost) / totalRevenue * 100 : null
          return { versionId: v.id, versionName: v.name, revenue: totalRevenue, margin, complete }
        })
      )
      if (!cancelled) setSubmissionPricingByVersion(results)
    })()
    return () => { cancelled = true }
  }, [selectedBidForSubmission?.id, priceBookVersions, submissionBidCostEstimateAmount])

  useEffect(() => {
    if (selectedBidForTakeoff?.id) loadTakeoffCountRows(selectedBidForTakeoff.id)
    else {
      setTakeoffCountRows([])
      setTakeoffMappings([])
    }
  }, [selectedBidForTakeoff?.id, activeTab])

  useEffect(() => {
    const idsToLoad = Array.from(
      new Set(takeoffMappings.map((m) => m.templateId).filter(Boolean))
    ).filter((id) => takeoffTemplatePreviewCache[id] === undefined)
    if (idsToLoad.length === 0) return
    setTakeoffTemplatePreviewCache((prev) => {
      const next = { ...prev }
      for (const id of idsToLoad) next[id] = 'loading'
      return next
    })
    for (const tid of idsToLoad) {
      getTemplatePartsPreview(supabase, tid)
        .then((res) => setTakeoffTemplatePreviewCache((p) => ({ ...p, [tid]: res })))
        .catch(() => setTakeoffTemplatePreviewCache((p) => ({ ...p, [tid]: null })))
    }
  }, [takeoffMappings, takeoffTemplatePreviewCache])

  useEffect(() => {
    if (!takeoffExistingPOId.trim()) {
      setTakeoffExistingPOItems(null)
      return
    }
    setTakeoffExistingPOItems('loading')
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select('quantity, price_at_time, material_parts(name), source_template:material_templates!source_template_id(id, name)')
        .eq('purchase_order_id', takeoffExistingPOId)
        .order('sequence_order', { ascending: true })
      if (cancelled) return
      if (error) {
        setTakeoffExistingPOItems(null)
        return
      }
      const rows = (data ?? []) as unknown as Array<{ quantity: number; price_at_time: number; material_parts: { name: string } | null; source_template: { id: string; name: string } | null }>
      setTakeoffExistingPOItems(
        rows.map((row) => ({
          part_name: row.material_parts?.name ?? '—',
          quantity: row.quantity,
          price_at_time: row.price_at_time,
          template_name: row.source_template?.name ?? null,
        }))
      )
    })()
    return () => { cancelled = true }
  }, [takeoffExistingPOId])

  useEffect(() => {
    if (!takeoffAddTemplateModalOpen && !addPartsToTemplateModalOpen && !editTemplateModalOpen) return
    if (!selectedServiceTypeId) {
      setTakeoffAddTemplateParts([])
      return
    }
    let cancelled = false
    supabase
      .from('material_parts')
      .select('*, part_types(*)')
      .eq('service_type_id', selectedServiceTypeId)
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setTakeoffAddTemplateParts([])
          return
        }
        setTakeoffAddTemplateParts((data as MaterialPart[]) ?? [])
      })
    return () => { cancelled = true }
  }, [takeoffAddTemplateModalOpen, addPartsToTemplateModalOpen, editTemplateModalOpen, selectedServiceTypeId])

  useEffect(() => {
    if (activeTab === 'takeoffs') {
      loadMaterialTemplates()
      loadDraftPOs()
      loadTakeoffBookVersions()
    }
    if (activeTab === 'pricing' || activeTab === 'cover-letter' || activeTab === 'submission-followup') {
      loadPriceBookVersions()
    }
  }, [activeTab])

  useEffect(() => {
    if (
      activeTab === 'submission-followup' &&
      selectedBidForSubmission &&
      scrollToContactFromBidBoard
    ) {
      contactTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setScrollToContactFromBidBoard(false)
    }
  }, [activeTab, selectedBidForSubmission?.id, scrollToContactFromBidBoard])

  useEffect(() => {
    if (selectedBidForTakeoff?.selected_takeoff_book_version_id != null) {
      setSelectedTakeoffBookVersionId(selectedBidForTakeoff.selected_takeoff_book_version_id)
    } else {
      setSelectedTakeoffBookVersionId(null)
    }
  }, [selectedBidForTakeoff?.id, selectedBidForTakeoff?.selected_takeoff_book_version_id])

  useEffect(() => {
    if (selectedBidForTakeoff && selectedBidForTakeoff.selected_takeoff_book_version_id == null && takeoffBookVersions.length > 0) {
      const defaultVer = takeoffBookVersions.find((v) => v.name === 'Default')
      if (defaultVer) {
        setSelectedTakeoffBookVersionId(defaultVer.id)
        saveBidSelectedTakeoffBookVersion(selectedBidForTakeoff.id, defaultVer.id)
      }
    }
  }, [selectedBidForTakeoff?.id, selectedBidForTakeoff?.selected_takeoff_book_version_id, takeoffBookVersions])

  useEffect(() => {
    if (!takeoffBookEntriesVersionId) {
      setTakeoffBookEntries([])
      return
    }
    loadTakeoffBookEntries(takeoffBookEntriesVersionId)
  }, [takeoffBookEntriesVersionId])

  useEffect(() => {
    if (activeTab === 'cost-estimate') {
      loadPurchaseOrdersForCostEstimate()
      loadLaborBookVersions()
    }
  }, [activeTab])

  useEffect(() => {
    if (!laborBookEntriesVersionId) {
      setLaborBookEntries([])
      return
    }
    loadLaborBookEntries(laborBookEntriesVersionId)
  }, [laborBookEntriesVersionId])

  useEffect(() => {
    if (!costEstimatePOModalPoId?.trim()) {
      setCostEstimatePOModalData(null)
      return
    }
    setCostEstimatePOModalData('loading')
    const poName = purchaseOrdersForCostEstimate.find((p) => p.id === costEstimatePOModalPoId)?.name ?? 'Purchase order'
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select('quantity, price_at_time, material_parts(name), source_template:material_templates!source_template_id(id, name)')
        .eq('purchase_order_id', costEstimatePOModalPoId)
        .order('sequence_order', { ascending: true })
      if (cancelled) return
      if (error) {
        setCostEstimatePOModalData(null)
        return
      }
      const rows = (data ?? []) as unknown as Array<{ quantity: number; price_at_time: number; material_parts: { name: string } | null; source_template: { id: string; name: string } | null }>
      setCostEstimatePOModalData({
        name: poName,
        items: rows.map((row) => ({
          part_name: row.material_parts?.name ?? '—',
          quantity: row.quantity,
          price_at_time: row.price_at_time,
          template_name: row.source_template?.name ?? null,
        })),
      })
    })()
    return () => { cancelled = true }
  }, [costEstimatePOModalPoId, purchaseOrdersForCostEstimate])

  useEffect(() => {
    if (activeTab !== 'cost-estimate' || !selectedBidForCostEstimate?.id) {
      if (!selectedBidForCostEstimate?.id) {
        costEstimateBidIdRef.current = null
        setCostEstimate(null)
        setCostEstimateLaborRows([])
        setCostEstimateCountRows([])
        setSelectedLaborBookVersionId(null)
        setCostEstimateDistanceInput('')
      }
      return
    }
    setCostEstimateDistanceInput(selectedBidForCostEstimate.distance_from_office ?? '')
    const bidId = selectedBidForCostEstimate.id
    const bidJustChanged = costEstimateBidIdRef.current !== bidId
    if (bidJustChanged) {
      costEstimateBidIdRef.current = bidId
      // Auto-select first labor book if none is saved for this bid
      const savedLaborBookId = selectedBidForCostEstimate.selected_labor_book_version_id
      if (!savedLaborBookId && laborBookVersions.length > 0) {
        const firstLaborBookId = laborBookVersions[0]?.id
        if (firstLaborBookId) {
          setSelectedLaborBookVersionId(firstLaborBookId)
        }
      } else {
        setSelectedLaborBookVersionId(savedLaborBookId ?? null)
      }
    }
    const laborBookVersionId = bidJustChanged
      ? (selectedBidForCostEstimate.selected_labor_book_version_id ?? (laborBookVersions.length > 0 ? laborBookVersions[0]?.id ?? null : null))
      : selectedLaborBookVersionId
    loadCostEstimateData(bidId, laborBookVersionId)
  }, [activeTab, selectedBidForCostEstimate?.id, selectedBidForCostEstimate?.selected_labor_book_version_id, selectedLaborBookVersionId, laborBookVersions])

  useEffect(() => {
    if ((activeTab !== 'pricing' && activeTab !== 'cover-letter') || !selectedBidForPricing?.id) {
      pricingBidIdRef.current = null
      setBidPricingAssignments([])
      setPricingCountRows([])
      setPricingCostEstimate(null)
      setPricingLaborRows([])
      setPricingMaterialTotalRoughIn(null)
      setPricingMaterialTotalTopOut(null)
      setPricingMaterialTotalTrimSet(null)
      setPricingLaborRate(null)
      return
    }
    const bidId = selectedBidForPricing.id
    const bidJustChanged = pricingBidIdRef.current !== bidId
    if (bidJustChanged) {
      pricingBidIdRef.current = bidId
      const savedVersionId = selectedBidForPricing.selected_price_book_version_id
      if (!savedVersionId && priceBookVersions.length > 0) {
        // Auto-select "Default" if it exists
        const defaultVersion = priceBookVersions.find((v) => v.name === 'Default')
        if (defaultVersion) {
          setSelectedPricingVersionId(defaultVersion.id)
        } else {
          setSelectedPricingVersionId(null)
        }
      } else {
        setSelectedPricingVersionId(savedVersionId ?? null)
      }
    }
    const versionId = bidJustChanged ? (selectedBidForPricing.selected_price_book_version_id ?? null) : selectedPricingVersionId
    loadBidPricingAssignments(bidId, versionId)
    loadPricingDataForBid(bidId)
  }, [activeTab, selectedBidForPricing?.id, selectedBidForPricing?.selected_price_book_version_id, selectedPricingVersionId, priceBookVersions])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pricingAssignmentDropdownOpen) {
        const target = event.target as HTMLElement
        if (!target.closest('[data-pricing-assignment-dropdown]')) {
          setPricingAssignmentDropdownOpen(null)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [pricingAssignmentDropdownOpen])

  useEffect(() => {
    if (!selectedPricingVersionId) {
      setPriceBookEntries([])
      return
    }
    loadPriceBookEntries(selectedPricingVersionId)
  }, [selectedPricingVersionId])

  function openNewBid() {
    setEditingBid(null)
    setDriveLink('')
    setPlansLink('')
    setBidSubmissionLink('')
    setDesignDrawingPlanDate('')
    setGcCustomerId('')
    setGcCustomerSearch('')
    setProjectName('')
    setAddress('')
    setGcContactName('')
    setGcContactPhone('')
    setGcContactEmail('')
    setEstimatorId('')
    setAccountManagerId(authUser?.id ?? '')
    setBidDueDate('')
    setEstimatedJobStartDate('')
    setBidDateSent('')
    setOutcome('')
    setBidValue('')
    setAgreedValue('')
    setProfit('')
    setDistanceFromOffice('')
    setLastContact('')
    setNotes('')
    setFormServiceTypeId(selectedServiceTypeId)
    setBidFormOpen(true)
    setError(null)
  }

  function openEditBid(bid: BidWithBuilder) {
    setEditingBid(bid)
    setDriveLink(bid.drive_link ?? '')
    setPlansLink(bid.plans_link ?? '')
    setBidSubmissionLink(bid.bid_submission_link ?? '')
    if (bid.customer_id && bid.customers) {
      setGcCustomerId(bid.customer_id)
      setGcCustomerSearch(getCustomerDisplay(bid.customers))
    } else if (bid.gc_builder_id && bid.bids_gc_builders) {
      setGcCustomerId('')
      setGcCustomerSearch(bid.bids_gc_builders.name)
    } else {
      setGcCustomerId('')
      setGcCustomerSearch('')
    }
    setProjectName(bid.project_name ?? '')
    setAddress(bid.address ?? '')
    setGcContactName(bid.gc_contact_name ?? '')
    setGcContactPhone(bid.gc_contact_phone ?? '')
    setGcContactEmail(bid.gc_contact_email ?? '')
    setEstimatorId(bid.estimator_id ?? '')
    setAccountManagerId((bid as any).account_manager_id ?? '')
    setBidDueDate(bid.bid_due_date ?? '')
    setEstimatedJobStartDate(bid.estimated_job_start_date ?? '')
    setDesignDrawingPlanDate(bid.design_drawing_plan_date ?? '')
    setBidDateSent(bid.bid_date_sent ?? '')
    setOutcome((bid.outcome ?? '') as OutcomeOption)
    setLossReason((bid as { loss_reason?: string | null }).loss_reason ?? '')
    setBidValue(bid.bid_value != null ? String(bid.bid_value) : '')
    setAgreedValue(bid.agreed_value != null ? String(bid.agreed_value) : '')
    setProfit(bid.profit != null ? String(bid.profit) : '')
    setDistanceFromOffice(bid.distance_from_office ?? '')
    setLastContact(bid.last_contact ? bid.last_contact.slice(0, 16) : '')
    setNotes(bid.notes ?? '')
    setFormServiceTypeId((bid as any).service_type_id ?? selectedServiceTypeId)
    setDeleteConfirmProjectName('')
    setBidFormOpen(true)
    setError(null)
  }

  function closeBidForm() {
    setBidFormOpen(false)
    setEditingBid(null)
    setDeleteConfirmProjectName('')
    setDeletingBid(false)
    setDeleteBidModalOpen(false)
  }

  function handleLastContactClick(bid: BidWithBuilder) {
    setSelectedBidForSubmission(bid)
    setActiveTab('submission-followup')
    setScrollToContactFromBidBoard(true)
  }

  async function saveBid(e: React.FormEvent) {
    e.preventDefault()
    if (!authUser?.id) return
    if (!projectName.trim()) {
      setError('Project Name is required.')
      return
    }
    setSavingBid(true)
    setError(null)
    const payload = {
      drive_link: driveLink.trim() || null,
      plans_link: plansLink.trim() || null,
      bid_submission_link: bidSubmissionLink.trim() || null,
      design_drawing_plan_date: designDrawingPlanDate.trim() ? designDrawingPlanDate : null,
      customer_id: gcCustomerId || null,
      gc_builder_id: null,
      project_name: projectName.trim() || null,
      address: address.trim() || null,
      gc_contact_name: gcContactName.trim() || null,
      gc_contact_phone: gcContactPhone.trim() || null,
      gc_contact_email: gcContactEmail.trim() || null,
      estimator_id: estimatorId || null,
      account_manager_id: accountManagerId || null,
      bid_due_date: bidDueDate || null,
      estimated_job_start_date: estimatedJobStartDate.trim() ? estimatedJobStartDate : null,
      bid_date_sent: bidDateSent || null,
      outcome: outcome === 'won' || outcome === 'lost' || outcome === 'started_or_complete' ? outcome : null,
      loss_reason: outcome === 'lost' ? (lossReason.trim() || null) : null,
      bid_value: bidValue !== '' && !isNaN(Number(bidValue)) ? Number(bidValue) : null,
      agreed_value: agreedValue !== '' && !isNaN(Number(agreedValue)) ? Number(agreedValue) : null,
      profit: profit !== '' && !isNaN(Number(profit)) ? Number(profit) : null,
      distance_from_office: distanceFromOffice.trim() || null,
      last_contact: lastContact ? new Date(lastContact).toISOString() : null,
      notes: notes.trim() || null,
      service_type_id: formServiceTypeId,
    }
    if (editingBid) {
      const { error: err } = await supabase.from('bids').update(payload).eq('id', editingBid.id)
      if (err) {
        setError(err.message)
        setSavingBid(false)
        return
      }
    } else {
      const { error: err } = await supabase.from('bids').insert({ ...payload, created_by: authUser.id })
      if (err) {
        setError(err.message)
        setSavingBid(false)
        return
      }
    }
    const rows = await loadBids()
    if (editingBid) {
      const fresh = rows.find((b) => b.id === editingBid.id)
      if (fresh) {
        if (selectedBidForCounts?.id === editingBid.id) setSelectedBidForCounts(fresh)
        if (selectedBidForSubmission?.id === editingBid.id) setSelectedBidForSubmission(fresh)
        if (selectedBidForTakeoff?.id === editingBid.id) setSelectedBidForTakeoff(fresh)
        if (selectedBidForCostEstimate?.id === editingBid.id) setSelectedBidForCostEstimate(fresh)
        if (selectedBidForPricing?.id === editingBid.id) setSelectedBidForPricing(fresh)
      }
    }
    closeBidForm()
    setSavingBid(false)
  }

  async function saveBidAndOpenCounts(e: React.FormEvent) {
    e.preventDefault()
    if (!authUser?.id) return
    if (!projectName.trim()) {
      setError('Project Name is required.')
      return
    }
    setSavingBid(true)
    setError(null)
    const payload = {
      drive_link: driveLink.trim() || null,
      plans_link: plansLink.trim() || null,
      bid_submission_link: bidSubmissionLink.trim() || null,
      design_drawing_plan_date: designDrawingPlanDate.trim() ? designDrawingPlanDate : null,
      customer_id: gcCustomerId || null,
      gc_builder_id: null,
      project_name: projectName.trim() || null,
      address: address.trim() || null,
      gc_contact_name: gcContactName.trim() || null,
      gc_contact_phone: gcContactPhone.trim() || null,
      gc_contact_email: gcContactEmail.trim() || null,
      estimator_id: estimatorId || null,
      bid_due_date: bidDueDate || null,
      estimated_job_start_date: estimatedJobStartDate.trim() ? estimatedJobStartDate : null,
      bid_date_sent: bidDateSent || null,
      outcome: outcome === 'won' || outcome === 'lost' || outcome === 'started_or_complete' ? outcome : null,
      loss_reason: outcome === 'lost' ? (lossReason.trim() || null) : null,
      bid_value: bidValue !== '' && !isNaN(Number(bidValue)) ? Number(bidValue) : null,
      agreed_value: agreedValue !== '' && !isNaN(Number(agreedValue)) ? Number(agreedValue) : null,
      profit: profit !== '' && !isNaN(Number(profit)) ? Number(profit) : null,
      distance_from_office: distanceFromOffice.trim() || null,
      last_contact: lastContact ? new Date(lastContact).toISOString() : null,
      notes: notes.trim() || null,
      service_type_id: formServiceTypeId,
    }
    let bidId: string
    if (editingBid) {
      const { error: err } = await supabase.from('bids').update(payload).eq('id', editingBid.id)
      if (err) {
        setError(err.message)
        setSavingBid(false)
        return
      }
      bidId = editingBid.id
    } else {
      const { data: inserted, error: err } = await supabase.from('bids').insert({ ...payload, created_by: authUser.id }).select('id').single()
      if (err) {
        setError(err.message)
        setSavingBid(false)
        return
      }
      bidId = (inserted as { id: string }).id
    }
    const rows = await loadBids()
    if (editingBid) {
      const fresh = rows.find((b) => b.id === editingBid.id)
      if (fresh) {
        if (selectedBidForCounts?.id === editingBid.id) setSelectedBidForCounts(fresh)
        if (selectedBidForSubmission?.id === editingBid.id) setSelectedBidForSubmission(fresh)
        if (selectedBidForTakeoff?.id === editingBid.id) setSelectedBidForTakeoff(fresh)
        if (selectedBidForCostEstimate?.id === editingBid.id) setSelectedBidForCostEstimate(fresh)
        if (selectedBidForPricing?.id === editingBid.id) setSelectedBidForPricing(fresh)
      }
    }
    closeBidForm()
    setSavingBid(false)
    setActiveTab('counts')
    const bid = rows.find((b) => b.id === bidId)
    if (bid) setSharedBid(bid)
  }

  async function saveBidSubmissionQuickAdd(bidId: string, value: string) {
    const { error: err } = await supabase
      .from('bids')
      .update({ bid_submission_link: value.trim() || null })
      .eq('id', bidId)
    if (err) {
      setError(err.message)
      return
    }
    const rows = await loadBids()
    const fresh = rows.find((b) => b.id === bidId)
    if (fresh) {
      if (selectedBidForCounts?.id === bidId) setSelectedBidForCounts(fresh)
      if (selectedBidForSubmission?.id === bidId) setSelectedBidForSubmission(fresh)
      if (selectedBidForTakeoff?.id === bidId) setSelectedBidForTakeoff(fresh)
      if (selectedBidForCostEstimate?.id === bidId) setSelectedBidForCostEstimate(fresh)
      if (selectedBidForPricing?.id === bidId) setSelectedBidForPricing(fresh)
    }
    // Show success message
    setBidSubmissionQuickAddSuccess(bidId)
    setTimeout(() => setBidSubmissionQuickAddSuccess(null), 3000)
    setCoverLetterBidSubmissionQuickAddBidId(null)
    setCoverLetterBidSubmissionQuickAddValue('')
  }

  async function deleteBid() {
    if (!editingBid || deleteConfirmProjectName.trim() !== (editingBid.project_name ?? '').trim()) return
    setDeletingBid(true)
    setError(null)
    const { error: err } = await supabase.from('bids').delete().eq('id', editingBid.id)
    if (err) {
      setError(err.message)
      setDeletingBid(false)
      return
    }
    await loadBids()
    closeBidForm()
    setDeletingBid(false)
  }

  async function saveNotesModal() {
    if (!notesModalBid) return
    setSavingNotes(true)
    setError(null)
    const { error: err } = await supabase
      .from('bids')
      .update({ notes: notesModalText.trim() || null })
      .eq('id', notesModalBid.id)
    setSavingNotes(false)
    if (err) {
      setError(err.message)
      return
    }
    await loadBids()
    setNotesModalBid(null)
  }

  async function applyProposedAmountToBidValue(bidId: string, amount: number) {
    setApplyingBidValue(true)
    const { error } = await supabase
      .from('bids')
      .update({ bid_value: amount })
      .eq('id', bidId)
    
    if (error) {
      alert('Error updating bid value: ' + error.message)
    } else {
      // Reload bids to show updated value
      await loadBids()
      // Show success message
      setBidValueAppliedSuccess(true)
      setTimeout(() => setBidValueAppliedSuccess(false), 3000)
    }
    setApplyingBidValue(false)
  }

  function openGcBuilderOrCustomerModal(bid: BidWithBuilder) {
    if (bid.customer_id && bid.customers) {
      setViewingCustomer(bid.customers)
      setViewingGcBuilder(null)
    } else if (bid.gc_builder_id && bid.bids_gc_builders) {
      setViewingGcBuilder(bid.bids_gc_builders)
      setViewingCustomer(null)
    }
  }

  const filteredBidsForBidBoard = bidBoardSearchQuery.trim()
    ? bids.filter(
        (b) =>
          (b.project_name?.toLowerCase().includes(bidBoardSearchQuery.toLowerCase()) ?? false) ||
          (b.address?.toLowerCase().includes(bidBoardSearchQuery.toLowerCase()) ?? false) ||
          (b.customers?.name?.toLowerCase().includes(bidBoardSearchQuery.toLowerCase()) ?? false) ||
          (b.bids_gc_builders?.name?.toLowerCase().includes(bidBoardSearchQuery.toLowerCase()) ?? false)
      )
    : bids

  const bidsForBidBoardDisplay = bidBoardHideLost
    ? filteredBidsForBidBoard.filter((b) => b.outcome !== 'lost')
    : filteredBidsForBidBoard

  const filteredBidsForCounts = countsSearchQuery.trim()
    ? bids.filter(
        (b) =>
          (b.project_name?.toLowerCase().includes(countsSearchQuery.toLowerCase()) ?? false) ||
          (b.address?.toLowerCase().includes(countsSearchQuery.toLowerCase()) ?? false) ||
          (b.customers?.name?.toLowerCase().includes(countsSearchQuery.toLowerCase()) ?? false) ||
          (b.bids_gc_builders?.name?.toLowerCase().includes(countsSearchQuery.toLowerCase()) ?? false)
      )
    : bids

  const filteredBidsForSubmission = submissionSearchQuery.trim()
    ? bids.filter(
        (b) =>
          (b.project_name?.toLowerCase().includes(submissionSearchQuery.toLowerCase()) ?? false) ||
          (b.address?.toLowerCase().includes(submissionSearchQuery.toLowerCase()) ?? false) ||
          (b.customers?.name?.toLowerCase().includes(submissionSearchQuery.toLowerCase()) ?? false) ||
          (b.bids_gc_builders?.name?.toLowerCase().includes(submissionSearchQuery.toLowerCase()) ?? false)
      )
    : bids

  const filteredBidsForTakeoff = takeoffSearchQuery.trim()
    ? bids.filter(
        (b) =>
          (b.project_name?.toLowerCase().includes(takeoffSearchQuery.toLowerCase()) ?? false) ||
          (b.address?.toLowerCase().includes(takeoffSearchQuery.toLowerCase()) ?? false) ||
          (b.customers?.name?.toLowerCase().includes(takeoffSearchQuery.toLowerCase()) ?? false) ||
          (b.bids_gc_builders?.name?.toLowerCase().includes(takeoffSearchQuery.toLowerCase()) ?? false)
      )
    : bids

  const bidsTyped = bids as BidWithBuilder[]
  const filteredBidsForCostEstimate: BidWithBuilder[] = costEstimateSearchQuery.trim()
    ? bidsTyped.filter(
        (b) =>
          (b.project_name?.toLowerCase().includes(costEstimateSearchQuery.toLowerCase()) ?? false) ||
          (b.address?.toLowerCase().includes(costEstimateSearchQuery.toLowerCase()) ?? false) ||
          (b.customers?.name?.toLowerCase().includes(costEstimateSearchQuery.toLowerCase()) ?? false) ||
          (b.bids_gc_builders?.name?.toLowerCase().includes(costEstimateSearchQuery.toLowerCase()) ?? false)
      )
    : bidsTyped
  const costEstimateBidList: BidWithBuilder[] = Array.from(filteredBidsForCostEstimate, (row) => row as BidWithBuilder)

  const filteredBidsForPricing: BidWithBuilder[] = pricingSearchQuery.trim()
    ? bidsTyped.filter(
        (b) =>
          (b.project_name?.toLowerCase().includes(pricingSearchQuery.toLowerCase()) ?? false) ||
          (b.address?.toLowerCase().includes(pricingSearchQuery.toLowerCase()) ?? false) ||
          (b.customers?.name?.toLowerCase().includes(pricingSearchQuery.toLowerCase()) ?? false) ||
          (b.bids_gc_builders?.name?.toLowerCase().includes(pricingSearchQuery.toLowerCase()) ?? false)
      )
    : bidsTyped

  const takeoffMappedCount = takeoffMappings.filter((m) => m.templateId.trim()).length

  function filterTemplatesByQuery(templates: MaterialTemplate[], query: string, limit = 50): MaterialTemplate[] {
    const q = (query || '').trim().toLowerCase()
    if (!q) return templates.slice(0, limit)
    return templates
      .filter((t) => [t.name, t.description].some((f) => (f || '').toLowerCase().includes(q)))
      .slice(0, limit)
  }

  function takeoffTemplatePickerOptions(mapping: TakeoffMapping): MaterialTemplate[] {
    const filtered = filterTemplatesByQuery(materialTemplates, takeoffTemplatePickerQuery, 50)
    const selected = mapping.templateId ? materialTemplates.find((t) => t.id === mapping.templateId) : null
    if (!selected) return filtered
    if (filtered.some((t) => t.id === selected.id)) return filtered
    return [selected, ...filtered]
  }

  function filterPartsByQuery(parts: MaterialPartWithType[], query: string, limit = 50): MaterialPartWithType[] {
    const q = (query || '').trim().toLowerCase()
    if (!q) return parts.slice(0, limit)
    return parts
      .filter((p) => [p.name, p.manufacturer, p.part_types?.name, p.notes].some((f) => (f || '').toLowerCase().includes(q)))
      .slice(0, limit)
  }

  const uniqueAccountManagers = useMemo(() => {
    const managers = new Map<string, { id: string; name: string; count: number }>()
    bids.forEach((bid) => {
      const am = bid.account_manager
      const accountManager = am == null ? null : Array.isArray(am) ? am[0] ?? null : am
      if (accountManager && accountManager.id && accountManager.name) {
        const existing = managers.get(accountManager.id)
        if (existing) {
          existing.count++
        } else {
          managers.set(accountManager.id, {
            id: accountManager.id,
            name: accountManager.name,
            count: 1
          })
        }
      }
    })
    return Array.from(managers.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [bids])

  const unassignedBidsCount = useMemo(() => {
    return bids.filter((bid) => {
      const am = bid.account_manager
      const accountManager = am == null ? null : Array.isArray(am) ? am[0] ?? null : am
      return !accountManager
    }).length
  }, [bids])

  const totalBidsCount = useMemo(() => {
    return bids.length
  }, [bids])

  const submissionUnsent = filteredBidsForSubmission.filter((b) => !b.bid_date_sent && b.outcome !== 'won' && b.outcome !== 'lost' && b.outcome !== 'started_or_complete')
  const submissionPending = filteredBidsForSubmission.filter((b) => b.bid_date_sent && b.outcome !== 'won' && b.outcome !== 'lost' && b.outcome !== 'started_or_complete')
  const submissionWon = filteredBidsForSubmission
    .filter((b) => b.outcome === 'won')
    .sort((a, b) => {
      // Handle null dates - put them at the end
      if (!a.estimated_job_start_date && !b.estimated_job_start_date) return 0
      if (!a.estimated_job_start_date) return 1
      if (!b.estimated_job_start_date) return -1
      
      // Sort by date ascending (earliest first)
      return a.estimated_job_start_date.localeCompare(b.estimated_job_start_date)
    })
  const submissionStartedOrComplete = filteredBidsForSubmission.filter((b) => b.outcome === 'started_or_complete')
  const submissionLost = filteredBidsForSubmission.filter((b) => b.outcome === 'lost')

  function getSubmissionSectionKey(bid: BidWithBuilder): keyof typeof submissionSectionOpen | null {
    if (bid.outcome === 'won') return 'won'
    if (bid.outcome === 'started_or_complete') return 'startedOrComplete'
    if (bid.outcome === 'lost') return 'lost'
    if (!bid.bid_date_sent) return 'unsent'
    return 'pending'
  }

  function getGcBuilderPhone(): string {
    if (gcCustomerId) {
      const customer = customers.find((c) => c.id === gcCustomerId)
      if (customer) {
        return extractContactInfo(customer.contact_info ?? null).phone || '—'
      }
    }
    if (editingBid?.bids_gc_builders) {
      return editingBid.bids_gc_builders.contact_number ?? '—'
    }
    return '—'
  }

  function getGcBuilderEmail(): string {
    if (gcCustomerId) {
      const customer = customers.find((c) => c.id === gcCustomerId)
      if (customer) {
        return extractContactInfo(customer.contact_info ?? null).email || '—'
      }
    }
    if (editingBid?.bids_gc_builders) {
      return editingBid.bids_gc_builders.email ?? '—'
    }
    return '—'
  }

  function handleScrollToSelectedBidRow() {
    if (!selectedBidForSubmission) return
    const sectionKey = getSubmissionSectionKey(selectedBidForSubmission)
    if (!sectionKey) return

    if (!submissionSectionOpen[sectionKey]) {
      setSubmissionSectionOpen((prev) => ({ ...prev, [sectionKey]: true }))
    }
    setTimeout(() => {
      document.getElementById(`submission-row-${selectedBidForSubmission.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 0)
  }

  const wonBidsForCustomer = viewingCustomer ? bids.filter((b) => b.customer_id === viewingCustomer.id && b.outcome === 'won') : []
  const lostBidsForCustomer = viewingCustomer ? bids.filter((b) => b.customer_id === viewingCustomer.id && b.outcome === 'lost') : []
  const wonBidsForBuilder = viewingGcBuilder ? bids.filter((b) => b.gc_builder_id === viewingGcBuilder.id && b.outcome === 'won') : []
  const lostBidsForBuilder = viewingGcBuilder ? bids.filter((b) => b.gc_builder_id === viewingGcBuilder.id && b.outcome === 'lost') : []
  const allBidsForCustomer = viewingCustomer ? bids.filter((b) => b.customer_id === viewingCustomer.id) : []
  const allBidsForBuilder = viewingGcBuilder ? bids.filter((b) => b.gc_builder_id === viewingGcBuilder.id) : []

  function getBidStatusLabel(bid: BidWithBuilder): string {
    if (!bid.bid_date_sent) return 'Unsent'
    if (bid.outcome === 'won') return 'Won'
    if (bid.outcome === 'lost') return 'Lost'
    if (bid.outcome === 'started_or_complete') return 'Started or Complete'
    return 'Not yet won or lost'
  }

  // For estimators with restrictions, only show allowed service types
  const visibleServiceTypes = myRole === 'estimator' && estimatorServiceTypeIds && estimatorServiceTypeIds.length > 0
    ? serviceTypes.filter((st) => estimatorServiceTypeIds.includes(st.id))
    : serviceTypes

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        Loading…
      </div>
    )
  }

  if (myRole !== 'dev' && myRole !== 'master_technician' && myRole !== 'assistant' && myRole !== 'estimator') {
    return (
      <div style={{ padding: '2rem' }}>
        <p>You do not have access to Bids.</p>
      </div>
    )
  }

  return (
    <div className="pageWrap" style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {error && (
        <div style={{ padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: 4, marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Service Type Filter - for estimators with restrictions, only show allowed types */}
      {visibleServiceTypes.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {visibleServiceTypes.map(st => (
            <button
              key={st.id}
              type="button"
              onClick={() => {
                if (st.id !== selectedServiceTypeId) {
                  setSelectedServiceTypeId(st.id)
                  setSharedBid(null)
                }
              }}
              style={{
                padding: '0.5rem 1rem',
                border: selectedServiceTypeId === st.id ? '2px solid #3b82f6' : '1px solid #d1d5db',
                background: selectedServiceTypeId === st.id ? '#eff6ff' : 'white',
                color: selectedServiceTypeId === st.id ? '#3b82f6' : '#374151',
                borderRadius: 6,
                fontWeight: selectedServiceTypeId === st.id ? 600 : 400,
                cursor: 'pointer'
              }}
            >
              {st.name}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '2px solid #e5e7eb', marginBottom: '2rem' }}>
        <button type="button" onClick={() => setActiveTab('bid-board')} style={tabStyle(activeTab === 'bid-board')}>
          Bid Board
        </button>
        <span style={{ color: '#9ca3af', padding: '0 0.25rem', position: 'relative', top: '-1px' }}>|</span>
        <button type="button" onClick={() => setActiveTab('counts')} style={tabStyle(activeTab === 'counts')}>
          Counts
        </button>
        <button type="button" onClick={() => setActiveTab('takeoffs')} style={tabStyle(activeTab === 'takeoffs')}>
          Takeoffs
        </button>
        <button type="button" onClick={() => setActiveTab('cost-estimate')} style={tabStyle(activeTab === 'cost-estimate')}>
          Cost Estimate
        </button>
        <button type="button" onClick={() => setActiveTab('pricing')} style={tabStyle(activeTab === 'pricing')}>
          Pricing
        </button>
        <button type="button" onClick={() => setActiveTab('cover-letter')} style={tabStyle(activeTab === 'cover-letter')}>
          Cover Letter
        </button>
        <button type="button" onClick={() => setActiveTab('submission-followup')} style={tabStyle(activeTab === 'submission-followup')}>
          Submission & Followup
        </button>
      </div>

      {/* Bid Board Tab */}
      {activeTab === 'bid-board' && (
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder="Search (project name or GC/Builder)..."
              value={bidBoardSearchQuery}
              onChange={(e) => setBidBoardSearchQuery(e.target.value)}
              style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => { setEvaluateChecked({}); setEvaluateModalOpen(true) }}
                style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
              >
                Checklist
              </button>
              <button
                type="button"
                onClick={openNewBid}
                style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                New
              </button>
            </div>
          </div>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={{ padding: 0, textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Project Folder</th>
                  <th style={{ padding: 0, textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Job Plans</th>
                  <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>GC/Builder</th>
                  <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Project Name</th>
                  <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Address</th>
                  <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Account Man</th>
                  <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Bid</th>
                  <th style={{ padding: 0, textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>
                    <button
                      type="button"
                      onClick={() => setBidBoardHideLost((prev) => !prev)}
                      title={bidBoardHideLost ? 'Click to show lost bids' : 'Click to hide lost bids'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 'inherit', color: 'inherit', textDecoration: bidBoardHideLost ? 'underline' : undefined }}
                    >
                      W/L{bidBoardHideLost ? ' (hiding lost)' : ''}
                    </button>
                  </th>
                  <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Bid Date</th>
                  <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Sent Date</th>
                  <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Distance<br />to Office</th>
                  <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Last Contact</th>
                  <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Notes</th>
                  <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }} title="Edit" aria-label="Edit" />
                </tr>
              </thead>
              <tbody>
                {bidsForBidBoardDisplay.length === 0 ? (
                  <tr>
                    <td colSpan={14} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                      {filteredBidsForBidBoard.length === 0
                        ? (bids.length === 0 ? 'No bids yet. Click New to add one.' : 'No bids match your search.')
                        : (bidBoardHideLost ? 'No bids to show (lost are hidden).' : 'No bids yet. Click New to add one.')}
                    </td>
                  </tr>
                ) : (
                  bidsForBidBoardDisplay.map((bid) => (
                    <tr key={bid.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: 0, textAlign: 'center' }}>
                        {bid.drive_link ? (
                          <a href={bid.drive_link} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>
                            Link
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td style={{ padding: 0, textAlign: 'center' }}>
                        {bid.plans_link ? (
                          <a href={bid.plans_link} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>
                            Link
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td style={{ padding: '0.0625rem', maxWidth: 200, whiteSpace: 'normal', wordBreak: 'break-word', textAlign: 'center' }}>
                        {(bid.customers || bid.bids_gc_builders) ? (
                          <button
                            type="button"
                            onClick={() => openGcBuilderOrCustomerModal(bid)}
                            style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: 0, textDecoration: 'none' }}
                          >
                            {bid.customers?.name ?? bid.bids_gc_builders?.name ?? '—'}
                          </button>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td style={{ padding: '0.0625rem', maxWidth: 200, whiteSpace: 'normal', wordBreak: 'break-word', textAlign: 'center' }}>
                        {bid.project_name ?? '-'}
                      </td>
                      <td style={{ padding: '0.0625rem', maxWidth: 200, whiteSpace: 'normal', wordBreak: 'break-word', textAlign: 'center' }} title={bid.address ?? ''}>
                        {bid.address ? (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(bid.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#3b82f6' }}
                          >
                            {formatAddressWithoutZip(bid.address)}
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td style={{ padding: '0.0625rem', textAlign: 'center' }}>
                        {(() => {
                          const am = (bid as any).account_manager as EstimatorUser | EstimatorUser[] | null | undefined
                          const amNorm = am == null ? null : Array.isArray(am) ? am[0] ?? null : am
                          if (amNorm) return amNorm.name || amNorm.email
                          const est = Array.isArray(bid.estimator) ? bid.estimator[0] : bid.estimator
                          return est ? (est.name || est.email) : '—'
                        })()}
                      </td>
                      <td style={{ padding: '0.0625rem', textAlign: 'center' }}>{formatBidValueShort(bid.bid_value != null ? Number(bid.bid_value) : null)}</td>
                      <td style={{ padding: 0, textAlign: 'center' }}>{bid.outcome === 'started_or_complete' ? 'Started or Complete' : (bid.outcome ?? '-')}</td>
                      <td style={{ padding: '0.0625rem', textAlign: 'center' }}>
                        {(() => {
                          const parts = formatDateYYMMDDParts(bid.bid_due_date)
                          return parts ? (
                            <div style={{ lineHeight: 1.2 }}>
                              <div>{parts.date}</div>
                              <div>{parts.bracket}</div>
                            </div>
                          ) : '—'
                        })()}
                      </td>
                      <td style={{ padding: '0.0625rem', textAlign: 'center' }}>
                        {(() => {
                          const parts = formatDateYYMMDDParts(bid.bid_date_sent)
                          return parts ? (
                            <div style={{ lineHeight: 1.2 }}>
                              <div>{parts.date}</div>
                              <div>{parts.bracket}</div>
                            </div>
                          ) : '—'
                        })()}
                      </td>
                      <td style={{ padding: '0.0625rem', textAlign: 'center' }}>
                        {bid.distance_from_office != null && bid.distance_from_office !== ''
                          ? `${Number.isNaN(Number(bid.distance_from_office)) ? bid.distance_from_office : Math.round(Number(bid.distance_from_office))}mi`
                          : '—'}
                      </td>
                      <td style={{ padding: '0.0625rem', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleLastContactClick(bid)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#3b82f6',
                            cursor: 'pointer',
                            padding: 0,
                            textDecoration: 'none',
                          }}
                        >
                          {bid.last_contact ? formatShortDate(bid.last_contact) : '+'}
                        </button>
                      </td>
                      <td
                        role="button"
                        tabIndex={0}
                        onClick={() => { setNotesModalBid(bid); setNotesModalText(bid.notes ?? '') }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setNotesModalBid(bid); setNotesModalText(bid.notes ?? '') } }}
                        style={{ padding: '0.0625rem', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center', cursor: 'pointer' }}
                        title={bid.notes ? `${bid.notes} (click to edit)` : 'Click to add notes'}
                      >
                        {bid.notes ?? '-'}
                      </td>
                      <td style={{ padding: '0.0625rem', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => openEditBid(bid)}
                          title="Edit bid"
                          style={{ padding: 0, background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="20" height="20" fill="currentColor" aria-hidden="true">
                            <path d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Counts Tab */}
      {activeTab === 'counts' && (
        <div>
          {selectedBidForCounts && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1.5rem 2rem', background: 'white', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0 }}>{bidDisplayName(selectedBidForCounts) || 'Bid'}</h2>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => openEditBid(selectedBidForCounts)}
                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Edit Bid
                  </button>
                  <button
                    type="button"
                    onClick={() => setSharedBid(null)}
                    style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>
              </div>
              <div ref={contactTableRef} style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ background: '#f9fafb' }}>
                    <tr>
                      <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Count*</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Fixture or Tie-in*</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Plan Page</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }} aria-label="Actions"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {countRows.map((row) => (
                      <CountRow key={row.id} row={row} onUpdate={refreshAfterCountsChange} onDelete={refreshAfterCountsChange} />
                    ))}
                    {addingCountRow && (
                      <NewCountRow
                        bidId={selectedBidForCounts.id}
                        serviceTypeId={selectedBidForCounts.service_type_id ?? undefined}
                        onSaved={() => { setAddingCountRow(false); refreshAfterCountsChange() }}
                        onCancel={() => setAddingCountRow(false)}
                        onSavedAndAddAnother={refreshAfterCountsChange}
                      />
                    )}
                  </tbody>
                </table>
              </div>
              {!addingCountRow && (
                <button
                  type="button"
                  onClick={() => setAddingCountRow(true)}
                  style={{ marginTop: '0.75rem', padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                >
                  Add row
                </button>
              )}
            </div>
          )}
          {!selectedBidForCounts && (
            <input
              type="text"
              placeholder="Search bids (project name or GC/Builder)..."
              value={countsSearchQuery}
              onChange={(e) => setCountsSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
            />
          )}
          {!selectedBidForCounts && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Project Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Bid Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBidsForCounts.map((bid) => (
                    <tr
                      key={bid.id}
                      onClick={() => setSharedBid(bid)}
                      style={{
                        borderBottom: '1px solid #e5e7eb',
                        cursor: 'pointer',
                      }}
                    >
                      <td style={{ padding: '0.75rem' }}>{bidDisplayName(bid) || bid.customers?.name || bid.bids_gc_builders?.name || bid.id.slice(0, 8)}</td>
                      <td style={{ padding: '0.75rem' }}>{formatDateYYMMDD(bid.bid_due_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Takeoffs Tab */}
      {activeTab === 'takeoffs' && (
        <div>
          {!selectedBidForTakeoff && (
            <input
              type="text"
              placeholder="Search bids (project name or GC/Builder)..."
              value={takeoffSearchQuery}
              onChange={(e) => setTakeoffSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
            />
          )}
          {selectedBidForTakeoff && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1.5rem 2rem', background: 'white', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h2 style={{ margin: 0 }}>{bidDisplayName(selectedBidForTakeoff) || 'Bid'}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {takeoffCountRows.length > 0 && selectedTakeoffBookVersionId && (
                    <>
                      <button
                        type="button"
                        onClick={() => applyTakeoffBookTemplates()}
                        disabled={applyingTakeoffBookTemplates}
                        style={{
                          padding: '0.35rem 0.75rem',
                          background: applyingTakeoffBookTemplates ? '#9ca3af' : '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          cursor: applyingTakeoffBookTemplates ? 'wait' : 'pointer',
                          fontSize: '0.875rem',
                        }}
                      >
                        {applyingTakeoffBookTemplates ? 'Applying…' : 'Apply matching Fixture Assemblies'}
                      </button>
                      {takeoffBookApplyMessage && (
                        <span style={{ color: '#059669', fontSize: '0.875rem' }}>{takeoffBookApplyMessage}</span>
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => { setSharedBid(null); setTakeoffCreatedPOId(null) }}
                    style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>
              </div>
              {takeoffCountRows.length === 0 ? (
                <p style={{ color: '#6b7280', margin: 0 }}>Add fixtures in the Counts tab first.</p>
              ) : (
                <>
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                    Select an Assembly for each Fixture or Tie-in you want to include in a PO (Purchase Order). Materials broken down by stage allows for staged billing.
                  </p>
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ background: '#f9fafb' }}>
                        <tr>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Fixture or Tie-in</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Count</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Assembly</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Parts</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Stage</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Quantity</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {takeoffCountRows.map((row) => {
                          const mappingsForRow = takeoffMappings.filter((m) => m.countRowId === row.id)
                          if (mappingsForRow.length === 0) {
                            return (
                              <tr key={row.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '0.75rem' }}>{row.fixture ?? ''}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>{Number(row.count)}</td>
                                <td colSpan={5} style={{ padding: '0.75rem' }}>
                                  <button
                                    type="button"
                                    onClick={() => addTakeoffTemplate(row.id, Number(row.count))}
                                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                  >
                                    Add assembly
                                  </button>
                                </td>
                              </tr>
                            )
                          }
                          const PREVIEW_MAX_PARTS = 5
                          return (
                            <Fragment key={row.id}>
                              {mappingsForRow.map((mapping) => {
                                const preview = mapping.templateId ? takeoffTemplatePreviewCache[mapping.templateId] : undefined
                                const templateName = mapping.templateId ? materialTemplates.find((t) => t.id === mapping.templateId)?.name ?? null : null
                                let partsCell: React.ReactNode = '—'
                                if (mapping.templateId) {
                                  if (preview === undefined || preview === 'loading') partsCell = 'Loading…'
                                  else if (preview === null) partsCell = 'Error loading parts'
                                  else if (!Array.isArray(preview) || preview.length === 0) partsCell = (
                                    <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                      No parts{' '}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          openAddPartsToTemplateModal(mapping.templateId!, templateName!)
                                        }}
                                        style={{
                                          padding: '0.25rem 0.5rem',
                                          background: '#3b82f6',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: 4,
                                          cursor: 'pointer',
                                          fontSize: '0.75rem',
                                          fontWeight: 500
                                        }}
                                      >
                                        Add Parts
                                      </button>
                                    </span>
                                  )
                                  else {
                                    const short = preview.slice(0, PREVIEW_MAX_PARTS).map((p) => `${p.part_name} (${p.quantity})`).join(', ')
                                    const rest = preview.length > PREVIEW_MAX_PARTS ? preview.length - PREVIEW_MAX_PARTS : 0
                                    partsCell = (
                                      <span style={{ fontSize: '0.875rem' }}>
                                        {short}
                                        {rest > 0 && (
                                          <>
                                            {' '}
                                            <button
                                              type="button"
                                              onClick={() => { setTakeoffPreviewModalTemplateId(mapping.templateId); setTakeoffPreviewModalTemplateName(templateName) }}
                                              style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                                            >
                                              and {rest} more
                                            </button>
                                          </>
                                        )}
                                        {rest === 0 && preview.length > 2 && (
                                          <>
                                            {' '}
                                            <button
                                              type="button"
                                              onClick={() => { setTakeoffPreviewModalTemplateId(mapping.templateId); setTakeoffPreviewModalTemplateName(templateName) }}
                                              style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                                            >
                                              View all
                                            </button>
                                          </>
                                        )}
                                      </span>
                                    )
                                  }
                                }
                                return (
                                  <tr key={mapping.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                    <td style={{ padding: '0.75rem' }}>{row.fixture ?? ''}</td>
                                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>{Number(row.count)}</td>
                                    <td style={{ padding: '0.75rem' }}>
                                      <div style={{ position: 'relative' }}>
                                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                          <input
                                            type="text"
                                            value={takeoffTemplatePickerOpenMappingId === mapping.id ? takeoffTemplatePickerQuery : (mapping.templateId ? (materialTemplates.find((t) => t.id === mapping.templateId)?.name ?? '') : '')}
                                            onChange={(e) => setTakeoffTemplatePickerQuery(e.target.value)}
                                            onFocus={() => { setTakeoffTemplatePickerOpenMappingId(mapping.id); setTakeoffTemplatePickerQuery('') }}
                                            onBlur={() => setTimeout(() => setTakeoffTemplatePickerOpenMappingId(null), 150)}
                                            onKeyDown={(e) => { if (e.key === 'Escape') setTakeoffTemplatePickerOpenMappingId(null) }}
                                            readOnly={takeoffTemplatePickerOpenMappingId !== mapping.id && !!mapping.templateId}
                                            placeholder="Search assemblies by name or description…"
                                            style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: takeoffTemplatePickerOpenMappingId !== mapping.id && mapping.templateId ? '#f3f4f6' : undefined }}
                                          />
                                          {mapping.templateId && takeoffTemplatePickerOpenMappingId !== mapping.id && (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() => openEditTemplateModal(mapping.templateId!, templateName ?? '')}
                                                style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                              >
                                                Edit
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => { setTakeoffMapping(mapping.id, { templateId: '' }); setTakeoffTemplatePickerOpenMappingId(mapping.id); setTakeoffTemplatePickerQuery('') }}
                                                style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                              >
                                                Clear
                                              </button>
                                            </>
                                          )}
                                        </div>
                                        {takeoffTemplatePickerOpenMappingId === mapping.id && (
                                          <ul
                                            style={{
                                              position: 'absolute',
                                              left: 0,
                                              right: 0,
                                              top: '100%',
                                              margin: 0,
                                              marginTop: 2,
                                              padding: 0,
                                              listStyle: 'none',
                                              maxHeight: 240,
                                              overflowY: 'auto',
                                              border: '1px solid #d1d5db',
                                              borderRadius: 4,
                                              background: '#fff',
                                              zIndex: 50,
                                              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                            }}
                                          >
                                            {takeoffTemplatePickerOptions(mapping).length === 0 ? (
                                              <li style={{ padding: '0.75rem', color: '#6b7280' }}>
                                                No templates match.{' '}
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setTakeoffAddTemplateModalOpen(true)
                                                    setTakeoffAddTemplateForMappingId(mapping.id)
                                                    setTakeoffTemplatePickerOpenMappingId(null)
                                                  }}
                                                  style={{ marginLeft: '0.25rem', padding: '0.25rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                                                >
                                                  Add assembly
                                                </button>
                                              </li>
                                            ) : (
                                              takeoffTemplatePickerOptions(mapping).map((t) => (
                                                <li
                                                  key={t.id}
                                                  onClick={() => {
                                                    setTakeoffMapping(mapping.id, { templateId: t.id })
                                                    setTakeoffTemplatePickerQuery('')
                                                    setTakeoffTemplatePickerOpenMappingId(null)
                                                  }}
                                                  style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                                                >
                                                  <div style={{ fontWeight: 500 }}>{t.name}</div>
                                                  {t.description && <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{t.description}</div>}
                                                </li>
                                              ))
                                            )}
                                          </ul>
                                        )}
                                      </div>
                                    </td>
                                    <td style={{ padding: '0.75rem', fontSize: '0.875rem', maxWidth: 280 }}>{partsCell}</td>
                                    <td style={{ padding: '0.75rem' }}>
                                      <select
                                        value={mapping.stage}
                                        onChange={(e) => setTakeoffMapping(mapping.id, { stage: e.target.value as TakeoffStage })}
                                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                                      >
                                        {(['rough_in', 'top_out', 'trim_set'] as const).map((s) => (
                                          <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                                        ))}
                                      </select>
                                    </td>
                                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                      <input
                                        type="number"
                                        min={1}
                                        value={mapping.quantity}
                                        onChange={(e) => setTakeoffMapping(mapping.id, { quantity: e.target.value === '' ? 1 : Number(e.target.value) })}
                                        style={{ width: 80, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'center' }}
                                      />
                                    </td>
                                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                      <button
                                        type="button"
                                        onClick={() => removeTakeoffMapping(mapping.id)}
                                        style={{ padding: '0.25rem 0.5rem', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}
                                      >
                                        Remove
                                      </button>
                                    </td>
                                  </tr>
                                )
                              })}
                              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '0.75rem' }} />
                                <td style={{ padding: '0.75rem' }} />
                                <td colSpan={5} style={{ padding: '0.75rem' }}>
                                  <button
                                    type="button"
                                    onClick={() => addTakeoffTemplate(row.id, Number(row.count))}
                                    style={{ padding: '0.5rem 1rem', background: '#e0e7ff', color: '#3730a3', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                  >
                                    Add assembly
                                  </button>
                                </td>
                              </tr>
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={createPOFromTakeoff}
                      disabled={takeoffCreatingPO || takeoffMappedCount === 0}
                      style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: takeoffCreatingPO || takeoffMappedCount === 0 ? 'not-allowed' : 'pointer' }}
                    >
                      {takeoffCreatingPO ? 'Creating…' : 'Create purchase orders for Stages'}
                    </button>
                    <select
                      value={takeoffExistingPOId}
                      onChange={(e) => setTakeoffExistingPOId(e.target.value)}
                      style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, minWidth: 200 }}
                    >
                      <option value="">OR add to existing PO…</option>
                      {draftPOs.map((po) => (
                        <option key={po.id} value={po.id}>{po.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={addTakeoffToExistingPO}
                      disabled={takeoffAddingToPO || takeoffMappedCount === 0 || !takeoffExistingPOId.trim()}
                      style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: takeoffAddingToPO || takeoffMappedCount === 0 || !takeoffExistingPOId ? 'not-allowed' : 'pointer' }}
                    >
                      {takeoffAddingToPO ? 'Adding…' : 'Add to selected PO'}
                    </button>
                  </div>
                  {takeoffExistingPOId.trim() && (
                    <div style={{ marginTop: '1rem', border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden', maxHeight: 240, overflowY: 'auto' }}>
                      <div style={{ padding: '0.5rem 0.75rem', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: '0.875rem' }}>
                        Current items in this PO
                      </div>
                      {takeoffExistingPOItems === 'loading' && (
                        <p style={{ padding: '0.75rem 1rem', margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>Loading current items…</p>
                      )}
                      {takeoffExistingPOItems === null && (
                        <p style={{ padding: '0.75rem 1rem', margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>Could not load items.</p>
                      )}
                      {Array.isArray(takeoffExistingPOItems) && takeoffExistingPOItems.length === 0 && (
                        <p style={{ padding: '0.75rem 1rem', margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>This PO has no items yet.</p>
                      )}
                      {Array.isArray(takeoffExistingPOItems) && takeoffExistingPOItems.length > 0 && (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                          <thead style={{ background: '#f9fafb' }}>
                            <tr>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Part</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Assembly</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Qty</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Price</th>
                              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {takeoffExistingPOItems.map((item, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '0.5rem 0.75rem' }}>{item.part_name}</td>
                                <td style={{ padding: '0.5rem 0.75rem' }}>{item.template_name ?? '—'}</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{item.quantity}</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${item.price_at_time.toFixed(2)}</td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${(item.quantity * item.price_at_time).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot style={{ background: '#f9fafb' }}>
                            <tr>
                              <td colSpan={4} style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600, borderTop: '1px solid #e5e7eb' }}>Grand Total:</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600, borderTop: '1px solid #e5e7eb' }}>
                                ${takeoffExistingPOItems.reduce((sum, item) => sum + item.quantity * item.price_at_time, 0).toFixed(2)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>
                  )}
                  {takeoffSuccessMessage && (
                    <p style={{ margin: '1rem 0 0', color: '#059669', fontSize: '0.875rem' }}>{takeoffSuccessMessage}</p>
                  )}
                  {takeoffCreatedPOId && (
                    <p style={{ margin: '0.75rem 0 0' }}>
                      <Link
                        to="/materials"
                        state={{ openPOId: takeoffCreatedPOId }}
                        style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}
                      >
                        View purchase order
                      </Link>
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Add Template modal (from Takeoffs when no templates match) */}
          {takeoffAddTemplateModalOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
              <div style={{ background: 'white', padding: '2rem', borderRadius: 8, maxWidth: 560, width: '90%', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ margin: 0 }}>Add Assembly</h2>
                  <button type="button" onClick={closeTakeoffAddTemplateModal} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1 }}>×</button>
                </div>
                <form onSubmit={saveTakeoffNewTemplate}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Name *</label>
                    <input type="text" value={takeoffNewTemplateName} onChange={(e) => setTakeoffNewTemplateName(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                  </div>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Description</label>
                    <textarea value={takeoffNewTemplateDescription} onChange={(e) => setTakeoffNewTemplateDescription(e.target.value)} rows={2} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>Items (parts or nested templates)</div>
                    <div style={{ marginBottom: '0.75rem', padding: '0.75rem', background: '#f9fafb', borderRadius: 4 }}>
                      <select value={takeoffNewItemType} onChange={(e) => setTakeoffNewItemType(e.target.value as 'part' | 'template')} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '0.5rem' }}>
                        <option value="part">Part</option>
                        <option value="template">Nested Assembly</option>
                      </select>
                      {takeoffNewItemType === 'part' ? (
                        <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                            <input type="text" value={takeoffNewItemPartId ? (takeoffAddTemplateParts.find((p) => p.id === takeoffNewItemPartId)?.name ?? '') : takeoffNewItemPartSearchQuery} onChange={(e) => setTakeoffNewItemPartSearchQuery(e.target.value)} onFocus={() => setTakeoffNewItemPartDropdownOpen(true)} onBlur={() => setTimeout(() => setTakeoffNewItemPartDropdownOpen(false), 150)} onKeyDown={(e) => { if (e.key === 'Escape') setTakeoffNewItemPartDropdownOpen(false) }} readOnly={!!takeoffNewItemPartId} placeholder="Search parts by name, manufacturer, type, or notes…" style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: takeoffNewItemPartId ? '#f3f4f6' : undefined }} />
                            {takeoffNewItemPartId && <button type="button" onClick={() => { setTakeoffNewItemPartId(''); setTakeoffNewItemPartSearchQuery(''); setTakeoffNewItemPartDropdownOpen(true) }} style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>Clear</button>}
                          </div>
                          {takeoffNewItemPartDropdownOpen && (
                            <ul style={{ position: 'absolute', left: 0, right: 0, top: '100%', margin: 0, marginTop: 2, padding: 0, listStyle: 'none', maxHeight: 200, overflowY: 'auto', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', zIndex: 60, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                              {takeoffAddTemplateParts.length === 0 ? <li style={{ padding: '0.75rem', color: '#6b7280' }}>Loading parts…</li> : filterPartsByQuery(takeoffAddTemplateParts, takeoffNewItemPartSearchQuery).length === 0 ? <li style={{ padding: '0.75rem', color: '#6b7280' }}>No parts match.{' '}<button type="button" onClick={() => { setBidsPartFormInitialName(takeoffNewItemPartSearchQuery.trim()); setBidsPartFormOpen(true); setTakeoffNewItemPartDropdownOpen(false) }} style={{ marginLeft: '0.25rem', padding: '0.25rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}>Add Part</button></li> : filterPartsByQuery(takeoffAddTemplateParts, takeoffNewItemPartSearchQuery).map((p) => (<li key={p.id} onClick={() => { setTakeoffNewItemPartId(p.id); setTakeoffNewItemPartSearchQuery(''); setTakeoffNewItemPartDropdownOpen(false) }} style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}><div style={{ fontWeight: 500 }}>{p.name}</div>{(p.manufacturer || p.part_types?.name) && <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{[p.manufacturer, p.part_types?.name].filter(Boolean).join(' · ')}</div>}</li>))}
                            </ul>
                          )}
                        </div>
                      ) : (
                        <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                            <input type="text" value={takeoffNewItemTemplateId ? (materialTemplates.find((t) => t.id === takeoffNewItemTemplateId)?.name ?? '') : takeoffNewItemTemplateSearchQuery} onChange={(e) => setTakeoffNewItemTemplateSearchQuery(e.target.value)} onFocus={() => setTakeoffNewItemTemplateDropdownOpen(true)} onBlur={() => setTimeout(() => setTakeoffNewItemTemplateDropdownOpen(false), 150)} onKeyDown={(e) => { if (e.key === 'Escape') setTakeoffNewItemTemplateDropdownOpen(false) }} readOnly={!!takeoffNewItemTemplateId} placeholder="Search assemblies by name or description…" style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: takeoffNewItemTemplateId ? '#f3f4f6' : undefined }} />
                            {takeoffNewItemTemplateId && <button type="button" onClick={() => { setTakeoffNewItemTemplateId(''); setTakeoffNewItemTemplateSearchQuery(''); setTakeoffNewItemTemplateDropdownOpen(true) }} style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>Clear</button>}
                          </div>
                          {takeoffNewItemTemplateDropdownOpen && (
                            <ul style={{ position: 'absolute', left: 0, right: 0, top: '100%', margin: 0, marginTop: 2, padding: 0, listStyle: 'none', maxHeight: 200, overflowY: 'auto', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', zIndex: 60, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                              {filterTemplatesByQuery(materialTemplates, takeoffNewItemTemplateSearchQuery, 50).length === 0 ? <li style={{ padding: '0.75rem', color: '#6b7280' }}>No assemblies match.</li> : filterTemplatesByQuery(materialTemplates, takeoffNewItemTemplateSearchQuery, 50).map((t) => (<li key={t.id} onClick={() => { setTakeoffNewItemTemplateId(t.id); setTakeoffNewItemTemplateSearchQuery(''); setTakeoffNewItemTemplateDropdownOpen(false) }} style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}><div style={{ fontWeight: 500 }}>{t.name}</div>{t.description && <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{t.description}</div>}</li>))}
                            </ul>
                          )}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input type="number" min={1} value={takeoffNewItemQuantity} onChange={(e) => setTakeoffNewItemQuantity(e.target.value)} style={{ width: 80, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                        <button type="button" onClick={addTakeoffNewTemplateItem} disabled={(takeoffNewItemType === 'part' && !takeoffNewItemPartId) || (takeoffNewItemType === 'template' && !takeoffNewItemTemplateId)} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Add item</button>
                      </div>
                    </div>
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: '#f9fafb' }}><tr><th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Type</th><th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Name</th><th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Qty</th><th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}></th></tr></thead>
                        <tbody>
                          {takeoffNewTemplateItems.length === 0 ? (
                            <tr><td colSpan={4} style={{ padding: '1rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>No items yet. Add parts or nested assemblies above.</td></tr>
                          ) : (
                            takeoffNewTemplateItems.map((item, idx) => {
                              const name = item.item_type === 'part' && item.part_id ? (takeoffAddTemplateParts.find((p) => p.id === item.part_id)?.name ?? '—') : item.item_type === 'template' && item.nested_template_id ? (materialTemplates.find((t) => t.id === item.nested_template_id)?.name ?? '—') : '—'
                              return (
                                <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>{item.item_type === 'part' ? 'Part' : 'Assembly'}</td>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>{name}</td>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>{item.quantity}</td>
                                  <td style={{ padding: '0.5rem 0.75rem' }}><button type="button" onClick={() => removeTakeoffNewTemplateItem(idx)} style={{ padding: '0.25rem 0.5rem', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}>Remove</button></td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button type="button" onClick={closeTakeoffAddTemplateModal} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                    <button type="submit" disabled={savingTakeoffNewTemplate} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{savingTakeoffNewTemplate ? 'Saving…' : 'Save'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {takeoffPreviewModalTemplateId && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 50,
              }}
              onClick={() => { setTakeoffPreviewModalTemplateId(null); setTakeoffPreviewModalTemplateName(null) }}
            >
              <div
                style={{
                  background: 'white',
                  borderRadius: 8,
                  padding: '1.5rem',
                  maxWidth: 420,
                  maxHeight: '80vh',
                  overflow: 'auto',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>{takeoffPreviewModalTemplateName ?? 'Assembly parts'}</h3>
                  <button
                    type="button"
                    onClick={() => { setTakeoffPreviewModalTemplateId(null); setTakeoffPreviewModalTemplateName(null) }}
                    style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>
                {(() => {
                  const preview = takeoffTemplatePreviewCache[takeoffPreviewModalTemplateId]
                  if (preview === 'loading') return <p style={{ margin: 0, color: '#6b7280' }}>Loading…</p>
                  if (preview === null) return <p style={{ margin: 0, color: '#b91c1c' }}>Error loading parts.</p>
                  if (!preview || preview.length === 0) return (
                    <div>
                      <p style={{ margin: 0, marginBottom: '1rem', color: '#6b7280' }}>No parts in this template.</p>
                      <button
                        type="button"
                        onClick={() => {
                          openAddPartsToTemplateModal(takeoffPreviewModalTemplateId, takeoffPreviewModalTemplateName!)
                          setTakeoffPreviewModalTemplateId(null)
                          setTakeoffPreviewModalTemplateName(null)
                        }}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontWeight: 500
                        }}
                      >
                        Add Parts
                      </button>
                    </div>
                  )
                  return (
                    <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                      {preview.map((p, i) => (
                        <li key={i} style={{ marginBottom: '0.25rem' }}>{p.part_name} ({p.quantity})</li>
                      ))}
                    </ul>
                  )
                })()}
              </div>
            </div>
          )}
          {!selectedBidForTakeoff && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Project Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Bid Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBidsForTakeoff.map((bid) => (
                    <tr
                      key={bid.id}
                      onClick={() => setSharedBid(bid)}
                      style={{
                        borderBottom: '1px solid #e5e7eb',
                        cursor: 'pointer',
                      }}
                    >
                      <td style={{ padding: '0.75rem' }}>{bidDisplayName(bid) || bid.customers?.name || bid.bids_gc_builders?.name || bid.id.slice(0, 8)}</td>
                      <td style={{ padding: '0.75rem' }}>{formatDateYYMMDD(bid.bid_due_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', marginTop: '1.5rem' }}>
            <div>
              <button
                type="button"
                onClick={() => setTakeoffBookSectionOpen((prev) => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  margin: 0,
                  marginBottom: takeoffBookSectionOpen ? '0.75rem' : 0,
                  padding: 0,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 600,
                }}
              >
                <span style={{ fontSize: '0.75rem' }}>{takeoffBookSectionOpen ? '▼' : '▶'}</span>
                Takeoff book
              </button>
              {takeoffBookSectionOpen && (
              <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
                {takeoffBookVersions.map((v) => (
                  <span
                    key={v.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.35rem 0.5rem',
                      background: takeoffBookEntriesVersionId === v.id ? '#dbeafe' : '#f3f4f6',
                      border: takeoffBookEntriesVersionId === v.id ? '1px solid #3b82f6' : '1px solid #d1d5db',
                      borderRadius: 4,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => { setTakeoffBookEntriesVersionId(v.id); loadTakeoffBookEntries(v.id) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: takeoffBookEntriesVersionId === v.id ? 600 : 400, padding: 0 }}
                    >
                      {v.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditTakeoffBookVersion(v)}
                      style={{ padding: '0.15rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
                      title="Edit version name"
                    >
                      ✎
                    </button>
                    {v.name !== 'Default' && (
                      <button
                        type="button"
                        onClick={() => deleteTakeoffBookVersion(v)}
                        style={{ padding: '0.15rem', background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b', fontSize: '0.875rem' }}
                        title="Delete version"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
                <button
                  type="button"
                  onClick={openNewTakeoffBookVersion}
                  style={{ padding: '0.35rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  Add version
                </button>
              </div>
              {takeoffBookEntriesVersionId && (
                <>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Entries</h4>
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ background: '#f9fafb' }}>
                        <tr>
                          <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Fixture or Tie-in</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Assembly</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Stage</th>
                          <th style={{ padding: '0.5rem', width: 60, borderBottom: '1px solid #e5e7eb' }} />
                        </tr>
                      </thead>
                      <tbody>
                        {takeoffBookEntries.map((entry) => (
                          <tr key={entry.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '0.5rem' }}>{entry.fixture_name ?? ''}{entry.alias_names?.length ? (
                              <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.25rem' }}>also: {entry.alias_names.join(', ')}</span>
                            ) : null}</td>
                            <td style={{ padding: '0.5rem' }}>{entry.items.length === 0 ? '—' : entry.items.map((i) => materialTemplates.find((t) => t.id === i.template_id)?.name ?? i.template_id).join(', ')}</td>
                            <td style={{ padding: '0.5rem' }}>{entry.items.length === 0 ? '—' : entry.items.map((i) => STAGE_LABELS[i.stage as TakeoffStage] ?? i.stage).join(', ')}</td>
                            <td style={{ padding: '0.5rem' }}>
                              <button type="button" onClick={() => openEditTakeoffBookEntry(entry)} style={{ padding: '0.15rem', background: 'none', border: 'none', cursor: 'pointer' }} title="Edit">✎</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    type="button"
                    onClick={openNewTakeoffBookEntry}
                    style={{ marginTop: '0.5rem', padding: '0.35rem 0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                  >
                    Add entry
                  </button>
                </>
              )}
              {selectedBidForTakeoff && (
                <div style={{ marginTop: '1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <label style={{ fontSize: '0.875rem', marginRight: '0.25rem' }}>Takeoff book version</label>
                  <select
                    value={selectedTakeoffBookVersionId ?? ''}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v) {
                        setSelectedTakeoffBookVersionId(v)
                        saveBidSelectedTakeoffBookVersion(selectedBidForTakeoff.id, v)
                      } else {
                        setSelectedTakeoffBookVersionId(null)
                        saveBidSelectedTakeoffBookVersion(selectedBidForTakeoff.id, null)
                      }
                    }}
                    style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, minWidth: '12rem' }}
                  >
                    <option value="">— Select version —</option>
                    {takeoffBookVersions.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => { setSharedBid(null); setTakeoffCreatedPOId(null) }}
                    style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>
              )}
              </>
              )}
            </div>
          </div>
          {takeoffBookVersionFormOpen && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 50,
              }}
              onClick={closeTakeoffBookVersionForm}
            >
              <div
                style={{ background: 'white', borderRadius: 8, padding: '1.5rem', minWidth: 320, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ margin: '0 0 1rem' }}>{editingTakeoffBookVersion ? 'Edit version' : 'New version'}</h3>
                <form onSubmit={saveTakeoffBookVersion}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Name</label>
                  <input
                    type="text"
                    value={takeoffBookVersionNameInput}
                    onChange={(e) => setTakeoffBookVersionNameInput(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
                    placeholder="e.g. 2025 Standard"
                  />
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={closeTakeoffBookVersionForm} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                    <button type="submit" disabled={savingTakeoffBookVersion} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{savingTakeoffBookVersion ? 'Saving…' : 'Save'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
          {takeoffBookEntryFormOpen && takeoffBookEntriesVersionId && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 50,
              }}
              onClick={closeTakeoffBookEntryForm}
            >
              <div
                style={{ background: 'white', borderRadius: 8, padding: '1.5rem', minWidth: 360, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ margin: '0 0 1rem' }}>{editingTakeoffBookEntry ? 'Edit entry' : 'New entry'}</h3>
                <form onSubmit={saveTakeoffBookEntry}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Fixture or Tie-in</label>
                  <input
                    type="text"
                    value={takeoffBookEntryFixtureName}
                    onChange={(e) => setTakeoffBookEntryFixtureName(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '0.75rem', boxSizing: 'border-box' }}
                    placeholder="e.g. Toilet"
                  />
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Additional names (optional)</label>
                  <input
                    type="text"
                    value={takeoffBookEntryAliasNames}
                    onChange={(e) => setTakeoffBookEntryAliasNames(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '0.25rem', boxSizing: 'border-box' }}
                    placeholder="e.g. WC, Commode"
                  />
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: '#6b7280' }}>If any of these match a count row's Fixture or Tie-in, these assemblies and stages are applied.</p>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Assembly / Stage</label>
                    {takeoffBookEntryItemRows.map((row, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                        <select
                          value={row.templateId}
                          onChange={(e) => setTakeoffBookEntryItemRows((prev) => prev.map((r, i) => (i === idx ? { ...r, templateId: e.target.value } : r)))}
                          style={{ flex: '1 1 140px', minWidth: 120, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }}
                        >
                          <option value="">— Select assembly —</option>
                          {materialTemplates.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                        <select
                          value={row.stage}
                          onChange={(e) => setTakeoffBookEntryItemRows((prev) => prev.map((r, i) => (i === idx ? { ...r, stage: e.target.value as TakeoffStage } : r)))}
                          style={{ flex: '0 0 auto', minWidth: 100, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }}
                        >
                          {(['rough_in', 'top_out', 'trim_set'] as const).map((s) => (
                            <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setTakeoffBookEntryItemRows((prev) => prev.filter((_, i) => i !== idx))}
                          disabled={takeoffBookEntryItemRows.length <= 1}
                          style={{ padding: '0.5rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, cursor: takeoffBookEntryItemRows.length <= 1 ? 'not-allowed' : 'pointer', color: '#991b1b', opacity: takeoffBookEntryItemRows.length <= 1 ? 0.6 : 1 }}
                          title="Remove"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setTakeoffBookEntryItemRows((prev) => [...prev, { templateId: '', stage: 'rough_in' }])}
                      style={{ marginTop: '0.25rem', padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Add assembly & stage
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      {editingTakeoffBookEntry && (
                        <button
                          type="button"
                          onClick={async () => {
                            const n = editingTakeoffBookEntry.items?.length ?? 0
                            if (!confirm(`Delete "${editingTakeoffBookEntry.fixture_name ?? ''}" and its ${n} template/stage pair(s) from this takeoff book?`)) return
                            await deleteTakeoffBookEntry(editingTakeoffBookEntry)
                            closeTakeoffBookEntryForm()
                          }}
                          style={{ padding: '0.5rem 1rem', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" onClick={closeTakeoffBookEntryForm} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                      <button type="submit" disabled={savingTakeoffBookEntry || !takeoffBookEntryFixtureName.trim() || !takeoffBookEntryItemRows.some((r) => r.templateId.trim() !== '')} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{savingTakeoffBookEntry ? 'Saving…' : 'Save'}</button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cost Estimate Tab */}
      {activeTab === 'cost-estimate' && (
        <div>
          {!selectedBidForCostEstimate && (
            <input
              type="text"
              placeholder="Search bids (project name or GC/Builder)..."
              value={costEstimateSearchQuery}
              onChange={(e) => setCostEstimateSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
            />
          )}
          {selectedBidForCostEstimate && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1.5rem 2rem', background: 'white', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0 }}>{bidDisplayName(selectedBidForCostEstimate) || 'Bid'}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => void printCostEstimatePage()}
                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Print
                  </button>
                  <button
                    type="button"
                    onClick={() => setSharedBid(null)}
                    style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>
              </div>
              {costEstimateCountRows.length === 0 ? (
                <p style={{ color: '#6b7280', margin: 0 }}>Add fixtures in the Counts tab first.</p>
              ) : (
                <>
                  {/* Material section: three POs */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', textAlign: 'center' }}>MATERIALS</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>PO (Rough In)</label>
                        <select
                          value={costEstimate?.purchase_order_id_rough_in ?? ''}
                          onChange={(e) => setCostEstimatePO('rough_in', e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                        >
                          <option value="">—</option>
                          {purchaseOrdersForCostEstimate.filter((po) => po.stage === 'rough_in' || po.stage === null).map((po) => (
                            <option key={po.id} value={po.id}>{po.name}</option>
                          ))}
                        </select>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
                          Rough In materials: {costEstimateMaterialTotalRoughIn != null ? `$${formatCurrency(Number(costEstimateMaterialTotalRoughIn))}` : '—'}
                          {costEstimateMaterialTotalRoughIn != null && (
                            <>
                              <br />
                              {'\u00A0'.repeat(18)}with tax: ${formatCurrency(Number(costEstimateMaterialTotalRoughIn) * (1 + parseFloat(costEstimatePOModalTaxPercent || '8.25') / 100))}
                            </>
                          )}
                        </p>
                        {costEstimate?.purchase_order_id_rough_in && (
                          <button
                            type="button"
                            onClick={() => setCostEstimatePOModalPoId(costEstimate.purchase_order_id_rough_in)}
                            style={{ marginTop: '0.25rem', padding: 0, background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline' }}
                          >
                            View
                          </button>
                        )}
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>PO (Top Out)</label>
                        <select
                          value={costEstimate?.purchase_order_id_top_out ?? ''}
                          onChange={(e) => setCostEstimatePO('top_out', e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                        >
                          <option value="">—</option>
                          {purchaseOrdersForCostEstimate.filter((po) => po.stage === 'top_out' || po.stage === null).map((po) => (
                            <option key={po.id} value={po.id}>{po.name}</option>
                          ))}
                        </select>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
                          Top Out materials: {costEstimateMaterialTotalTopOut != null ? `$${formatCurrency(Number(costEstimateMaterialTotalTopOut))}` : '—'}
                          {costEstimateMaterialTotalTopOut != null && (
                            <>
                              <br />
                              {'\u00A0'.repeat(17)}with tax: ${formatCurrency(Number(costEstimateMaterialTotalTopOut) * (1 + parseFloat(costEstimatePOModalTaxPercent || '8.25') / 100))}
                            </>
                          )}
                        </p>
                        {costEstimate?.purchase_order_id_top_out && (
                          <button
                            type="button"
                            onClick={() => setCostEstimatePOModalPoId(costEstimate.purchase_order_id_top_out)}
                            style={{ marginTop: '0.25rem', padding: 0, background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline' }}
                          >
                            View
                          </button>
                        )}
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>PO (Trim Set)</label>
                        <select
                          value={costEstimate?.purchase_order_id_trim_set ?? ''}
                          onChange={(e) => setCostEstimatePO('trim_set', e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                        >
                          <option value="">—</option>
                          {purchaseOrdersForCostEstimate.filter((po) => po.stage === 'trim_set' || po.stage === null).map((po) => (
                            <option key={po.id} value={po.id}>{po.name}</option>
                          ))}
                        </select>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
                          Trim Set materials: {costEstimateMaterialTotalTrimSet != null ? `$${formatCurrency(Number(costEstimateMaterialTotalTrimSet))}` : '—'}
                          {costEstimateMaterialTotalTrimSet != null && (
                            <>
                              <br />
                              {'\u00A0'.repeat(17)}with tax: ${formatCurrency(Number(costEstimateMaterialTotalTrimSet) * (1 + parseFloat(costEstimatePOModalTaxPercent || '8.25') / 100))}
                            </>
                          )}
                        </p>
                        {costEstimate?.purchase_order_id_trim_set && (
                          <button
                            type="button"
                            onClick={() => setCostEstimatePOModalPoId(costEstimate.purchase_order_id_trim_set)}
                            style={{ marginTop: '0.25rem', padding: 0, background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline' }}
                          >
                            View
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <label style={{ fontSize: '0.875rem', color: '#6b7280' }}>Tax %</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={costEstimatePOModalTaxPercent}
                        onChange={(e) => setCostEstimatePOModalTaxPercent(e.target.value)}
                        style={{ width: '4rem', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'right', fontSize: '0.875rem' }}
                      />
                    </div>
                    <p style={{ margin: '0.5rem 0 0', fontWeight: 600, textAlign: 'right' }}>
                      Materials Total: $
                      {formatCurrency(
                        (costEstimateMaterialTotalRoughIn ?? 0) +
                        (costEstimateMaterialTotalTopOut ?? 0) +
                        (costEstimateMaterialTotalTrimSet ?? 0)
                      )}
                      <br />
                      <span style={{ fontWeight: 400 }}>{'\u00A0'.repeat(11)}With tax: ${formatCurrency(((costEstimateMaterialTotalRoughIn ?? 0) + (costEstimateMaterialTotalTopOut ?? 0) + (costEstimateMaterialTotalTrimSet ?? 0)) * (1 + parseFloat(costEstimatePOModalTaxPercent || '8.25') / 100))}</span>
                    </p>
                  </div>
                  {/* Labor section */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', textAlign: 'center' }}>LABOR</h3>
                    <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.875rem', marginRight: '0.5rem' }}>Labor book version</label>
                        <select
                          value={selectedLaborBookVersionId ?? ''}
                          onChange={(e) => {
                            const v = e.target.value
                            if (selectedBidForCostEstimate) {
                              if (v) handleLaborBookVersionChange(selectedBidForCostEstimate.id, v)
                              else {
                                saveBidSelectedLaborBookVersion(selectedBidForCostEstimate.id, null)
                                setSelectedLaborBookVersionId(null)
                                loadCostEstimateData(selectedBidForCostEstimate.id, null)
                              }
                            }
                          }}
                          style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, minWidth: '12rem' }}
                        >
                          <option value="">— Use defaults —</option>
                          {laborBookVersions.map((v) => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                          ))}
                        </select>
                      </div>
                      {costEstimateLaborRows.length > 0 && selectedLaborBookVersionId && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => applyLaborBookHoursToEstimate()}
                            disabled={applyingLaborBookHours}
                            style={{
                              padding: '0.35rem 0.75rem',
                              background: applyingLaborBookHours ? '#9ca3af' : '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: 4,
                              cursor: applyingLaborBookHours ? 'wait' : 'pointer',
                              fontSize: '0.875rem',
                            }}
                          >
                            {applyingLaborBookHours ? 'Applying…' : 'Apply matching Labor Hours'}
                          </button>
                          {laborBookApplyMessage && (
                            <span style={{ color: '#059669', fontSize: '0.875rem' }}>{laborBookApplyMessage}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: '#f9fafb' }}>
                          <tr>
                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Fixture or Tie-in</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Count</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>(hrs/unit)</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Rough In</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Top Out</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Trim Set</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Total hrs</th>
                          </tr>
                        </thead>
                        <tbody>
                          {costEstimateLaborRows.map((row) => {
                            const totalHrs = laborRowHours(row)
                            return (
                              <tr key={row.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span>{row.fixture ?? ''}</span>
                                  {missingLaborBookFixtures.has(row.fixture ?? '') && selectedLaborBookVersionId && (
                                    <button
                                      type="button"
                                      onClick={() => openAddMissingFixtureModal(row.fixture ?? '')}
                                      title="Add to labor book"
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: 0,
                                        display: 'flex',
                                        alignItems: 'center'
                                      }}
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 640 640"
                                        style={{ width: '1rem', height: '1rem', fill: '#3b82f6' }}
                                      >
                                        <path d="M192 576L512 576C529.7 576 544 561.7 544 544C544 526.3 529.7 512 512 512L512 445.3C530.6 438.7 544 420.9 544 400L544 112C544 85.5 522.5 64 496 64L192 64C139 64 96 107 96 160L96 480C96 533 139 576 192 576zM160 480C160 462.3 174.3 448 192 448L448 448L448 512L192 512C174.3 512 160 497.7 160 480zM288 184C288 175.2 295.2 168 304 168L336 168C344.8 168 352 175.2 352 184L352 224L392 224C400.8 224 408 231.2 408 240L408 272C408 280.8 400.8 288 392 288L352 288L352 328C352 336.8 344.8 344 336 344L304 344C295.2 344 288 336.8 288 328L288 288L248 288C239.2 288 232 280.8 232 272L232 240C232 231.2 239.2 224 248 224L288 224L288 184z"/>
                                      </svg>
                                    </button>
                                  )}
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>{Number(row.count)}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem', fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                    <input
                                      type="checkbox"
                                      checked={!!row.is_fixed}
                                      onChange={(e) => setCostEstimateLaborRow(row.id, { is_fixed: e.target.checked })}
                                      style={{ width: '0.875rem', height: '0.875rem', margin: 0 }}
                                    />
                                    <span style={{ color: '#6b7280' }}>fixed</span>
                                  </label>
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                  <input
                                    type="number"
                                    min={0}
                                    step={0.25}
                                    value={row.rough_in_hrs_per_unit}
                                    onChange={(e) => setCostEstimateLaborRow(row.id, { rough_in_hrs_per_unit: parseFloat(e.target.value) || 0 })}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    style={{ width: '5rem', padding: '0.25rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'center' }}
                                  />
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                  <input
                                    type="number"
                                    min={0}
                                    step={0.25}
                                    value={row.top_out_hrs_per_unit}
                                    onChange={(e) => setCostEstimateLaborRow(row.id, { top_out_hrs_per_unit: parseFloat(e.target.value) || 0 })}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    style={{ width: '5rem', padding: '0.25rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'center' }}
                                  />
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                  <input
                                    type="number"
                                    min={0}
                                    step={0.25}
                                    value={row.trim_set_hrs_per_unit}
                                    onChange={(e) => setCostEstimateLaborRow(row.id, { trim_set_hrs_per_unit: parseFloat(e.target.value) || 0 })}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    style={{ width: '5rem', padding: '0.25rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'center' }}
                                  />
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 500 }}>{totalHrs.toFixed(2)}</td>
                              </tr>
                            )
                          })}
                          {costEstimateLaborRows.length > 0 && (() => {
                            const totalRough = costEstimateLaborRows.reduce((s, r) => s + laborRowRough(r), 0)
                            const totalTop = costEstimateLaborRows.reduce((s, r) => s + laborRowTop(r), 0)
                            const totalTrim = costEstimateLaborRows.reduce((s, r) => s + laborRowTrim(r), 0)
                            const totalHours = totalRough + totalTop + totalTrim
                            return (
                              <tr style={{ background: '#f9fafb', fontWeight: 600 }}>
                                <td style={{ padding: '0.75rem' }}>Totals</td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }} />
                                <td style={{ padding: '0.75rem', textAlign: 'center' }} />
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>{totalRough.toFixed(2)} hrs</td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>{totalTop.toFixed(2)} hrs</td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>{totalTrim.toFixed(2)} hrs</td>
                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>{totalHours.toFixed(2)} hrs</td>
                              </tr>
                            )
                          })()}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <label style={{ marginRight: '0.5rem', fontWeight: 500 }}>Labor rate ($/hr)</label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={laborRateInput}
                          onChange={(e) => setLaborRateInput(e.target.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                          style={{ width: '8rem', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={printRoughInSubSheet}
                          style={{ padding: '0.35rem 0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                        >
                          Rough In sub sheet
                        </button>
                        <button
                          type="button"
                          onClick={printTopOutSubSheet}
                          style={{ padding: '0.35rem 0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                        >
                          Top Out sub sheet
                        </button>
                        <button
                          type="button"
                          onClick={printTrimSetSubSheet}
                          style={{ padding: '0.35rem 0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                        >
                          Trim Set sub sheet
                        </button>
                        <button
                          type="button"
                          onClick={printAllSubSheets}
                          style={{ padding: '0.35rem 0.75rem', background: '#10b981', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}
                        >
                          Print All
                        </button>
                      </div>
                    </div>
                    {costEstimateLaborRows.length > 0 && (() => {
                      const totalHours = costEstimateLaborRows.reduce(
                        (s, r) => s + laborRowHours(r),
                        0
                      )
                      const rate = laborRateInput.trim() === '' ? 0 : parseFloat(laborRateInput) || 0
                      const laborCost = totalHours * rate
                      return (
                        <p style={{ margin: '0.75rem 0 0', fontWeight: 600, textAlign: 'right' }}>
                          Labor total: ${formatCurrency(laborCost)}
                          <br />
                          <span style={{ fontWeight: 400, fontSize: '0.875rem' }}>({totalHours.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} hrs × ${formatCurrency(rate)}/hr)</span>
                        </p>
                      )
                    })()}
                    {/* Driving Cost Section */}
                    <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#fef3c7', borderRadius: 4, border: '1px solid #fde68a' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600 }}>Driving Cost Parameters</h4>
                        {selectedBidForCostEstimate && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <button
                              type="button"
                              onClick={() => openEditBid(selectedBidForCostEstimate)}
                              style={{ padding: '0.25rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500 }}
                            >
                              Edit bid
                            </button>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem' }}>
                              [
                              <input
                                type="number"
                                min={0}
                                step={0.1}
                                value={costEstimateDistanceInput}
                                onChange={(e) => setCostEstimateDistanceInput(e.target.value)}
                                onWheel={(e) => e.currentTarget.blur()}
                                placeholder="—"
                                style={{ width: '4rem', padding: '0.25rem 0.375rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', textAlign: 'right' }}
                              />
                              {' mi]'}
                            </span>
                            <button
                              type="button"
                              onClick={updateBidDistanceFromCostEstimate}
                              disabled={updatingBidDistance}
                              style={{ padding: '0.25rem 0.5rem', background: updatingBidDistance ? '#d1d5db' : '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: updatingBidDistance ? 'wait' : 'pointer', fontSize: '0.75rem', fontWeight: 500 }}
                            >
                              {updatingBidDistance ? 'Updating…' : 'Update bid distance'}
                            </button>
                            {bidDistanceUpdateSuccess && (
                              <span style={{ color: '#059669', fontSize: '0.75rem', fontWeight: 500 }}>✓ Distance updated</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                        <div>
                          <label style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>Rate per mile ($)</label>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={drivingCostRate}
                            onChange={(e) => setDrivingCostRate(e.target.value)}
                            onWheel={(e) => e.currentTarget.blur()}
                            style={{ width: '6rem', padding: '0.375rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                          />
                        </div>
                        <div>
                          <label style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>Hours per trip</label>
                          <input
                            type="number"
                            min={0.1}
                            step={0.1}
                            value={hoursPerTrip}
                            onChange={(e) => setHoursPerTrip(e.target.value)}
                            onWheel={(e) => e.currentTarget.blur()}
                            style={{ width: '6rem', padding: '0.375rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                          />
                        </div>
                      </div>
                      {(() => {
                        const distance = parseFloat(selectedBidForCostEstimate?.distance_from_office ?? '0') || 0
                        const totalHours = costEstimateLaborRows.reduce(
                          (s, r) => s + laborRowHours(r),
                          0
                        )
                        const ratePerMile = parseFloat(drivingCostRate) || 0.70
                        const hrsPerTrip = parseFloat(hoursPerTrip) || 2.0
                        const numTrips = totalHours / hrsPerTrip
                        const drivingCost = numTrips * ratePerMile * distance
                        
                        return (
                          <>
                            <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                              Distance to office: {distance > 0 ? `${distance.toFixed(1)} miles` : 'Not set'}
                            </p>
                            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem' }}>
                              Driving cost: {numTrips.toFixed(1)} trips × ${ratePerMile.toFixed(2)}/mi × {distance.toFixed(0)}mi = ${formatCurrency(drivingCost)}
                            </p>
                          </>
                        )
                      })()}
                    </div>
                  </div>
                  {/* Total */}
                  <div style={{ marginBottom: '1.5rem', padding: '1rem' }}>
                    <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', textAlign: 'center' }}>TOTAL</h3>
                    {(() => {
                      const totalMaterials =
                        (costEstimateMaterialTotalRoughIn ?? 0) + (costEstimateMaterialTotalTopOut ?? 0) + (costEstimateMaterialTotalTrimSet ?? 0)
                      const totalHours = costEstimateLaborRows.reduce(
                        (s, r) => s + laborRowHours(r),
                        0
                      )
                      const rate = laborRateInput.trim() === '' ? 0 : parseFloat(laborRateInput) || 0
                      const laborCost = totalHours * rate
                      const distance = parseFloat(selectedBidForCostEstimate?.distance_from_office ?? '0') || 0
                      const ratePerMile = parseFloat(drivingCostRate) || 0.70
                      const hrsPerTrip = parseFloat(hoursPerTrip) || 2.0
                      const numTrips = totalHours / hrsPerTrip
                      const drivingCost = numTrips * ratePerMile * distance
                      const laborCostWithDriving = laborCost + drivingCost
                      const materialsWithTax = totalMaterials * (1 + parseFloat(costEstimatePOModalTaxPercent || '8.25') / 100)
                      const grandTotal = materialsWithTax + laborCostWithDriving
                      return (
                        <>
                          <p style={{ margin: '0.25rem 0', textAlign: 'right', fontWeight: 600 }}>Materials with tax: ${formatCurrency(materialsWithTax)}</p>
                          <p style={{ margin: '0.25rem 0', textAlign: 'right' }}>Manhours: ${formatCurrency(laborCost)}</p>
                          <p style={{ margin: '0.25rem 0', textAlign: 'right' }}>Driving: ${formatCurrency(drivingCost)}</p>
                          <p style={{ margin: '0.25rem 0', textAlign: 'right', fontWeight: 600 }}>
                            Labor total: ${formatCurrency(laborCostWithDriving)}
                          </p>
                          <p style={{ margin: '0.5rem 0 0', fontWeight: 700, fontSize: '1.125rem', textAlign: 'right' }}>Grand total: ${formatCurrency(grandTotal)}</p>
                        </>
                      )
                    })()}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                    <button
                      type="button"
                      onClick={saveCostEstimate}
                      disabled={savingCostEstimate || !costEstimate}
                      style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: savingCostEstimate ? 'wait' : 'pointer' }}
                    >
                      {savingCostEstimate ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          {costEstimatePOModalPoId && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 50,
              }}
              onClick={() => setCostEstimatePOModalPoId(null)}
            >
              <div
                style={{
                  background: 'white',
                  borderRadius: 8,
                  padding: '1.5rem',
                  maxWidth: 560,
                  maxHeight: '90vh',
                  overflow: 'auto',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>{costEstimatePOModalData && costEstimatePOModalData !== 'loading' ? costEstimatePOModalData.name : 'Purchase order'}</h3>
                  <button
                    type="button"
                    onClick={() => setCostEstimatePOModalPoId(null)}
                    style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>
                {costEstimatePOModalData === 'loading' && (
                  <p style={{ margin: 0, color: '#6b7280' }}>Loading…</p>
                )}
                {costEstimatePOModalData === null && (
                  <p style={{ margin: 0, color: '#6b7280' }}>Could not load items.</p>
                )}
                {costEstimatePOModalData && costEstimatePOModalData !== 'loading' && (
                  <>
                    {costEstimatePOModalData.items.length === 0 ? (
                      <p style={{ margin: '0 0 1rem', color: '#6b7280' }}>No items in this PO.</p>
                    ) : null}
                    {costEstimatePOModalData.items.length > 0 ? (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', marginBottom: '1rem' }}>
                        <thead style={{ background: '#f9fafb' }}>
                          <tr>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Item</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Qty</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Assembly</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Cost</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {costEstimatePOModalData.items.map((item, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '0.5rem 0.75rem' }}>{item.part_name}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{item.quantity}</td>
                              <td style={{ padding: '0.5rem 0.75rem' }}>{item.template_name ?? '—'}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${item.price_at_time.toFixed(2)}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>${(item.quantity * item.price_at_time).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot style={{ background: '#f9fafb' }}>
                          <tr>
                            <td colSpan={4} style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600, borderTop: '1px solid #e5e7eb' }}>Grand Total:</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600, borderTop: '1px solid #e5e7eb' }}>
                              ${costEstimatePOModalData.items.reduce((sum, item) => sum + item.quantity * item.price_at_time, 0).toFixed(2)}
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={4} style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>
                              With Tax{' '}
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={costEstimatePOModalTaxPercent}
                                onChange={(e) => setCostEstimatePOModalTaxPercent(e.target.value)}
                                style={{ width: '5rem', padding: '0.25rem 0.5rem', margin: '0 0.25rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'right' }}
                              />
                              %:
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>
                              ${(costEstimatePOModalData.items.reduce((sum, item) => sum + item.quantity * item.price_at_time, 0) * (1 + (parseFloat(costEstimatePOModalTaxPercent) || 0) / 100)).toFixed(2)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    ) : (
                      <div style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
                        <p style={{ margin: 0 }}><strong>Grand Total:</strong> $0.00</p>
                        <p style={{ margin: '0.25rem 0 0' }}>
                          <strong>With Tax</strong>{' '}
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={costEstimatePOModalTaxPercent}
                            onChange={(e) => setCostEstimatePOModalTaxPercent(e.target.value)}
                            style={{ width: '5rem', padding: '0.25rem 0.5rem', margin: '0 0.25rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'right' }}
                          />
                          %: $0.00
                        </p>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const data = costEstimatePOModalData
                          if (data && typeof data === 'object' && 'items' in data) {
                            printCostEstimatePOForReview(data.name, data.items, parseFloat(costEstimatePOModalTaxPercent) || 0)
                          }
                        }}
                        disabled={false}
                        style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                      >
                        Print for Review
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const data = costEstimatePOModalData
                          if (data && typeof data === 'object' && 'items' in data) {
                            printCostEstimatePOForSupplyHouse(data.name, data.items, parseFloat(costEstimatePOModalTaxPercent) || 0)
                          }
                        }}
                        disabled={false}
                        style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                      >
                        Print for Supply House
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          {!selectedBidForCostEstimate && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Project Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Bid Date</th>
                  </tr>
                </thead>
                <tbody>
                  {costEstimateBidList.map((row) => {
                    const bid = row as unknown as BidWithBuilder
                    const sel = selectedBidForCostEstimate as BidWithBuilder | null
                    return (
                      <tr
                        key={bid.id}
                        onClick={() => setSharedBid(bid)}
                        style={{
                          cursor: 'pointer',
                          borderBottom: '1px solid #e5e7eb',
                          background: (sel?.id != null && sel.id === bid.id) ? '#eff6ff' : undefined,
                        }}
                      >
                        <td style={{ padding: '0.75rem' }}>{bidDisplayName(bid) || '—'}</td>
                        <td style={{ padding: '0.75rem' }}>{formatDateYYMMDD(bid.bid_due_date)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', marginTop: '1.5rem' }}>
            <div>
              <button
                type="button"
                onClick={() => setLaborBookSectionOpen((prev) => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  margin: 0,
                  marginBottom: laborBookSectionOpen ? '0.75rem' : 0,
                  padding: 0,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 600,
                }}
              >
                <span style={{ fontSize: '0.75rem' }}>{laborBookSectionOpen ? '▼' : '▶'}</span>
                Labor book
              </button>
              {laborBookSectionOpen && (
              <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {laborBookVersions.map((v) => (
                  <span
                    key={v.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.35rem 0.5rem',
                      background: laborBookEntriesVersionId === v.id ? '#dbeafe' : '#f3f4f6',
                      border: laborBookEntriesVersionId === v.id ? '1px solid #3b82f6' : '1px solid #d1d5db',
                      borderRadius: 4,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => { setLaborBookEntriesVersionId(v.id); loadLaborBookEntries(v.id) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: laborBookEntriesVersionId === v.id ? 600 : 400, padding: 0 }}
                    >
                      {v.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditLaborVersion(v)}
                      style={{ padding: '0.15rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
                      title="Edit version name"
                    >
                      ✎
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={openNewLaborVersion}
                  style={{ padding: '0.35rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  Add version
                </button>
              </div>
              {laborBookEntriesVersionId && (
                <>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Entries (hrs per stage)</h4>
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ background: '#f9fafb' }}>
                        <tr>
                          <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Fixture or Tie-in</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Rough In (hrs)</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Top Out (hrs)</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Trim Set (hrs)</th>
                          <th style={{ padding: '0.5rem', width: 60, borderBottom: '1px solid #e5e7eb' }} />
                        </tr>
                      </thead>
                      <tbody>
                        {laborBookEntries.map((entry) => (
                          <tr key={entry.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '0.5rem' }}>
                              {entry.fixture_types?.name ?? ''}
                              {entry.alias_names?.length ? (
                                <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.25rem' }}>also: {entry.alias_names.join(', ')}</span>
                              ) : null}
                            </td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(entry.rough_in_hrs)}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(entry.top_out_hrs)}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(entry.trim_set_hrs)}</td>
                            <td style={{ padding: '0.5rem' }}>
                              <button type="button" onClick={() => openEditLaborEntry(entry)} style={{ padding: '0.15rem', background: 'none', border: 'none', cursor: 'pointer' }} title="Edit">✎</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    type="button"
                    onClick={openNewLaborEntry}
                    style={{ marginTop: '0.5rem', padding: '0.35rem 0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                  >
                    Add entry
                  </button>
                </>
              )}
              </>
              )}
            </div>
          </div>
          {laborVersionFormOpen && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 50,
              }}
              onClick={closeLaborVersionForm}
            >
              <div
                style={{ background: 'white', borderRadius: 8, padding: '1.5rem', minWidth: 320, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ margin: '0 0 1rem' }}>{editingLaborVersion ? 'Edit version' : 'New version'}</h3>
                <form onSubmit={saveLaborVersion}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Name</label>
                  <input
                    type="text"
                    value={laborVersionNameInput}
                    onChange={(e) => setLaborVersionNameInput(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
                    placeholder="e.g. Default"
                  />
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      {editingLaborVersion && editingLaborVersion.name !== 'Default' && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm(`Delete labor book "${editingLaborVersion.name}"? This will delete all entries in this version.`)) return
                            await deleteLaborVersion(editingLaborVersion)
                            closeLaborVersionForm()
                          }}
                          style={{ padding: '0.5rem 1rem', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}
                        >
                          Delete version
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" onClick={closeLaborVersionForm} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                      <button type="submit" disabled={savingLaborVersion} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{savingLaborVersion ? 'Saving…' : 'Save'}</button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
          {laborEntryFormOpen && laborBookEntriesVersionId && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 50,
              }}
              onClick={closeLaborEntryForm}
            >
              <div
                style={{ background: 'white', borderRadius: 8, padding: '1.5rem', minWidth: 360, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ margin: '0 0 1rem' }}>{editingLaborEntry ? 'Edit entry' : 'New entry'}</h3>
                {error && (
                  <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: 4, fontSize: '0.875rem' }}>
                    {error}
                  </div>
                )}
                <form onSubmit={saveLaborEntry}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Fixture or Tie-in *</label>
                  <input
                    type="text"
                    list="labor-fixture-types"
                    value={laborEntryFixtureName}
                    onChange={(e) => setLaborEntryFixtureName(e.target.value)}
                    required
                    placeholder="Type or select fixture type..."
                    autoComplete="off"
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '0.75rem', boxSizing: 'border-box' }}
                  />
                  <datalist id="labor-fixture-types">
                    {fixtureTypes.map(ft => (
                      <option key={ft.id} value={ft.name} />
                    ))}
                  </datalist>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Additional names (optional)</label>
                  <input
                    type="text"
                    value={laborEntryAliasNames}
                    onChange={(e) => setLaborEntryAliasNames(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '0.25rem', boxSizing: 'border-box' }}
                    placeholder="e.g. WC, Commode"
                  />
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: '#6b7280' }}>If any of these match a count row's Fixture or Tie-in, this labor rate is applied.</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Rough In (hrs)</label>
                      <input type="number" min={0} step={0.01} value={laborEntryRoughIn} onChange={(e) => setLaborEntryRoughIn(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Top Out (hrs)</label>
                      <input type="number" min={0} step={0.01} value={laborEntryTopOut} onChange={(e) => setLaborEntryTopOut(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Trim Set (hrs)</label>
                      <input type="number" min={0} step={0.01} value={laborEntryTrimSet} onChange={(e) => setLaborEntryTrimSet(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      {editingLaborEntry && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm(`Delete "${editingLaborEntry.fixture_types?.name ?? ''}" from this labor book?`)) return
                            await deleteLaborEntry(editingLaborEntry)
                            closeLaborEntryForm()
                          }}
                          style={{ padding: '0.5rem 1rem', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" onClick={closeLaborEntryForm} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                      <button type="submit" disabled={savingLaborEntry} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{savingLaborEntry ? 'Saving…' : 'Save'}</button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
          {addMissingFixtureModalOpen && selectedLaborBookVersionId && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 50,
              }}
              onClick={() => setAddMissingFixtureModalOpen(false)}
            >
              <div
                style={{
                  background: 'white',
                  borderRadius: 8,
                  padding: '1.5rem',
                  maxWidth: 500,
                  width: '90%',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>
                  Add "{addMissingFixtureName}" to Labor Book
                </h3>
                <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  Adding to: <strong>{laborBookVersions.find(v => v.id === selectedLaborBookVersionId)?.name || 'Unknown'}</strong>
                </p>
                <form onSubmit={saveMissingFixtureToLaborBook}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>
                        Rough In
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={addMissingFixtureRoughIn}
                        onChange={(e) => setAddMissingFixtureRoughIn(e.target.value)}
                        onWheel={(e) => e.currentTarget.blur()}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                        autoFocus
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>
                        Top Out
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={addMissingFixtureTopOut}
                        onChange={(e) => setAddMissingFixtureTopOut(e.target.value)}
                        onWheel={(e) => e.currentTarget.blur()}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>
                        Trim Set
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={addMissingFixtureTrimSet}
                        onChange={(e) => setAddMissingFixtureTrimSet(e.target.value)}
                        onWheel={(e) => e.currentTarget.blur()}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setAddMissingFixtureModalOpen(false)}
                      style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingMissingFixture}
                      style={{
                        padding: '0.5rem 1rem',
                        background: savingMissingFixture ? '#9ca3af' : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        cursor: savingMissingFixture ? 'wait' : 'pointer'
                      }}
                    >
                      {savingMissingFixture ? 'Adding...' : 'Add to Labor Book'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pricing Tab */}
      {activeTab === 'pricing' && (
        <div>
          {!selectedBidForPricing && (
            <input
              type="text"
              placeholder="Search bids (project name or GC/Builder)..."
              value={pricingSearchQuery}
              onChange={(e) => setPricingSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
            />
          )}
          {selectedBidForPricing && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1.5rem 2rem', background: 'white', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0 }}>{bidDisplayName(selectedBidForPricing) || 'Bid'}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.875rem', marginRight: '0.25rem' }}>Price book</label>
                  <select
                    value={selectedPricingVersionId ?? ''}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v) handlePricingVersionChange(selectedBidForPricing.id, v)
                    }}
                    style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, minWidth: '12rem' }}
                  >
                    <option value="">— Select version —</option>
                    {priceBookVersions.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => printPricingPage()}
                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Print
                  </button>
                  <button
                    type="button"
                    onClick={() => void printAllPricingPages()}
                    style={{ padding: '0.5rem 1rem', background: '#f97316', color: 'black', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    Review
                  </button>
                  <button
                    type="button"
                    onClick={() => setSharedBid(null)}
                    style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>
              </div>
              {!pricingCostEstimate && pricingCountRows.length > 0 && (
                <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  Add fixtures in Counts and create a Cost Estimate first to see margin comparison.{' '}
                  <button
                    type="button"
                    onClick={() => setActiveTab('cost-estimate')}
                    style={{ padding: '0.25rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                  >
                    Go to Cost Estimate
                  </button>
                </p>
              )}
              {selectedPricingVersionId && pricingCountRows.length > 0 && pricingCostEstimate && (() => {
                const totalMaterials = (pricingMaterialTotalRoughIn ?? 0) + (pricingMaterialTotalTopOut ?? 0) + (pricingMaterialTotalTrimSet ?? 0)
                const rate = pricingLaborRate ?? 0
                const totalLaborHours = pricingLaborRows.reduce(
                  (s, r) => s + laborRowHours(r),
                  0
                )
                const taxPercent = parseFloat(costEstimatePOModalTaxPercent || '8.25') || 0
                const totalCost = totalMaterials + totalLaborHours * rate
                const entriesById = new Map(priceBookEntries.map((e) => [e.id, e]))
                let totalRevenue = 0
                const rows = pricingCountRows.map((countRow) => {
                  const assignment = bidPricingAssignments.find((a) => a.count_row_id === countRow.id)
                  const entry = assignment ? entriesById.get(assignment.price_book_entry_id) : priceBookEntries.find((e) => (e.fixture_types?.name ?? '').toLowerCase() === (countRow.fixture ?? '').toLowerCase())
                  const laborRow = pricingLaborRows.find((l) => (l.fixture ?? '').toLowerCase() === (countRow.fixture ?? '').toLowerCase())
                  const count = Number(countRow.count)
                  const laborHrs = laborRow ? laborRowHours(laborRow) : 0
                  const laborCost = laborHrs * rate
                  const materialsFromTakeoff = pricingFixtureMaterialsFromTakeoff[countRow.id]
                  const materialsBeforeTax = materialsFromTakeoff != null
                    ? materialsFromTakeoff
                    : (totalLaborHours > 0 ? totalMaterials * (laborHrs / totalLaborHours) : 0)
                  const materialsWithTax = materialsFromTakeoff != null
                    ? materialsBeforeTax * (1 + taxPercent / 100)
                    : materialsBeforeTax
                  const taxAmount = materialsFromTakeoff != null ? materialsBeforeTax * (taxPercent / 100) : 0
                  const cost = laborCost + materialsWithTax
                  const unitPrice = entry ? Number(entry.total_price) : 0
                  const isFixedPrice = assignment?.is_fixed_price ?? false
                  const revenue = isFixedPrice ? unitPrice : count * unitPrice
                  totalRevenue += revenue
                  const margin = revenue > 0 ? ((revenue - cost) / revenue) * 100 : null
                  const flag = marginFlag(margin)
                  return {
                    countRow,
                    entry,
                    laborRow,
                    count,
                    cost,
                    revenue,
                    margin,
                    flag,
                    assignment,
                    materialsBeforeTax,
                    materialsWithTax,
                    taxAmount,
                    laborCost,
                    materialsFromTakeoff: materialsFromTakeoff ?? null,
                  }
                })
                return (
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ background: '#f9fafb' }}>
                        <tr>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Fixture or Tie-in</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Count</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Price book entry</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Our cost</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Revenue</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Margin %</th>
                          <th style={{ padding: '0.75rem', width: 32, borderBottom: '1px solid #e5e7eb' }} />
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr
                            key={row.countRow.id}
                            style={{ borderBottom: '1px solid #e5e7eb', cursor: 'pointer' }}
                            onClick={() => setPricingRowBreakdownModalCountRow(row.countRow)}
                          >
                            <td style={{ padding: '0.75rem' }}>{row.countRow.fixture ?? ''}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>{row.count}</td>
                            <td style={{ padding: '0.75rem', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                              <div style={{ position: 'relative' }} data-pricing-assignment-dropdown>
                                <input
                                  type="text"
                                  value={pricingAssignmentSearches[row.countRow.id] !== undefined 
                                    ? pricingAssignmentSearches[row.countRow.id] 
                                    : (row.entry?.fixture_types?.name ?? '')}
                                  onChange={(e) => {
                                    setPricingAssignmentSearches((prev) => ({ ...prev, [row.countRow.id]: e.target.value }))
                                    setPricingAssignmentDropdownOpen(row.countRow.id)
                                  }}
                                  onFocus={() => setPricingAssignmentDropdownOpen(row.countRow.id)}
                                  placeholder="Search or assign..."
                                  disabled={savingPricingAssignment === row.countRow.id}
                                  style={{ 
                                    width: '100%',
                                    padding: '0.35rem', 
                                    border: '1px solid #d1d5db', 
                                    borderRadius: 4, 
                                    minWidth: '10rem',
                                    boxSizing: 'border-box',
                                    paddingRight: row.entry ? '5rem' : '0.35rem'
                                  }}
                                />
                                {row.entry && (
                                  <>
                                    <label
                                      style={{
                                        position: 'absolute',
                                        right: '2rem',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.25rem',
                                        fontSize: '0.75rem',
                                        color: '#6b7280',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap'
                                      }}
                                      title="Fixed price: don't multiply by count"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={row.assignment?.is_fixed_price ?? false}
                                        onChange={() => togglePricingAssignmentFixedPrice(row.countRow.id)}
                                        style={{ cursor: 'pointer' }}
                                      />
                                      Fixed
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        removePricingAssignment(row.countRow.id)
                                        setPricingAssignmentSearches((prev) => {
                                          const next = { ...prev }
                                          delete next[row.countRow.id]
                                          return next
                                        })
                                      }}
                                      style={{
                                        position: 'absolute',
                                        right: '0.5rem',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: '#6b7280',
                                        fontSize: '1.25rem',
                                        lineHeight: 1,
                                        padding: 0
                                      }}
                                      title="Clear assignment"
                                    >
                                      ×
                                    </button>
                                  </>
                                )}
                                {pricingAssignmentDropdownOpen === row.countRow.id && (() => {
                                  const searchTerm = pricingAssignmentSearches[row.countRow.id] || ''
                                  const filtered = priceBookEntries.filter((e) => 
                                    (e.fixture_types?.name ?? '').toLowerCase().includes(searchTerm.toLowerCase())
                                  )
                                  return (
                                    <div style={{
                                      position: 'absolute',
                                      top: '100%',
                                      left: 0,
                                      right: 0,
                                      background: 'white',
                                      border: '1px solid #d1d5db',
                                      borderRadius: 4,
                                      marginTop: '0.25rem',
                                      maxHeight: '200px',
                                      overflowY: 'auto',
                                      zIndex: 10,
                                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                    }}>
                                      {filtered.length > 0 ? (
                                        filtered.map((e) => (
                                          <div
                                            key={e.id}
                                            onClick={() => {
                                              savePricingAssignment(row.countRow.id, e.id)
                                              setPricingAssignmentSearches((prev) => {
                                                const next = { ...prev }
                                                delete next[row.countRow.id]
                                                return next
                                              })
                                              setPricingAssignmentDropdownOpen(null)
                                            }}
                                            style={{
                                              padding: '0.5rem',
                                              cursor: 'pointer',
                                              borderBottom: '1px solid #f3f4f6',
                                              background: row.entry?.id === e.id ? '#eff6ff' : 'white'
                                            }}
                                            onMouseEnter={(ev) => { ev.currentTarget.style.background = '#f9fafb' }}
                                            onMouseLeave={(ev) => { ev.currentTarget.style.background = row.entry?.id === e.id ? '#eff6ff' : 'white' }}
                                          >
                                            {e.fixture_types?.name ?? ''}
                                          </div>
                                        ))
                                      ) : searchTerm ? (
                                        <div style={{ padding: '0.75rem', textAlign: 'center', color: '#6b7280' }}>
                                          No matches for "{searchTerm}"
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingPricingEntry(null)
                                              setPricingEntryFixtureName(searchTerm)
                                              setPricingEntryRoughIn('')
                                              setPricingEntryTopOut('')
                                              setPricingEntryTrimSet('')
                                              setPricingEntryTotal('')
                                              setPricingEntryFormOpen(true)
                                              setPricingAssignmentDropdownOpen(null)
                                            }}
                                            style={{
                                              display: 'block',
                                              margin: '0.5rem auto 0',
                                              padding: '0.5rem 1rem',
                                              background: '#3b82f6',
                                              color: 'white',
                                              border: 'none',
                                              borderRadius: 4,
                                              cursor: 'pointer',
                                              fontSize: '0.875rem'
                                            }}
                                          >
                                            Add "{searchTerm}" to Price Book
                                          </button>
                                        </div>
                                      ) : (
                                        <div style={{ padding: '0.5rem', color: '#6b7280', textAlign: 'center' }}>
                                          Start typing to search...
                                        </div>
                                      )}
                                    </div>
                                  )
                                })()}
                              </div>
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>${formatCurrency(row.cost)}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>${formatCurrency(row.revenue)}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                              {row.margin != null ? `${row.margin.toFixed(1)}%` : '—'}
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                              {row.flag && (
                                <span
                                  title={row.flag === 'red' ? '< 20%' : row.flag === 'yellow' ? '< 40%' : '≥ 40%'}
                                  style={{
                                    display: 'inline-block',
                                    width: 16,
                                    height: 16,
                                    borderRadius: '50%',
                                    background: row.flag === 'red' ? '#dc2626' : row.flag === 'yellow' ? '#ca8a04' : '#16a34a',
                                  }}
                                  aria-hidden
                                />
                              )}
                            </td>
                          </tr>
                        ))}
                        <tr style={{ background: '#f9fafb', fontWeight: 600 }}>
                          <td style={{ padding: '0.75rem' }}>Total</td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }} />
                          <td style={{ padding: '0.75rem' }} />
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>${formatCurrency(totalCost)}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>${formatCurrency(totalRevenue)}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            {totalRevenue > 0 ? `${(((totalRevenue - totalCost) / totalRevenue) * 100).toFixed(1)}%` : '—'}
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            {totalRevenue > 0 && (() => {
                              const m = ((totalRevenue - totalCost) / totalRevenue) * 100
                              const f = marginFlag(m)
                              return f ? (
                                <span
                                  title={f === 'red' ? '< 20%' : f === 'yellow' ? '< 40%' : '≥ 40%'}
                                  style={{
                                    display: 'inline-block',
                                    width: 16,
                                    height: 16,
                                    borderRadius: '50%',
                                    background: f === 'red' ? '#dc2626' : f === 'yellow' ? '#ca8a04' : '#16a34a',
                                  }}
                                  aria-hidden
                                />
                              ) : null
                            })()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )
              })()}
            </div>
          )}
          {pricingRowBreakdownModalCountRow && selectedBidForPricing && pricingCostEstimate && (() => {
            const totalMaterials = (pricingMaterialTotalRoughIn ?? 0) + (pricingMaterialTotalTopOut ?? 0) + (pricingMaterialTotalTrimSet ?? 0)
            const rate = pricingLaborRate ?? 0
            const totalLaborHours = pricingLaborRows.reduce((s, r) => s + laborRowHours(r), 0)
            const taxPercent = parseFloat(costEstimatePOModalTaxPercent || '8.25') || 0
            const laborRow = pricingLaborRows.find((l) => (l.fixture ?? '').toLowerCase() === (pricingRowBreakdownModalCountRow!.fixture ?? '').toLowerCase())
            const laborHrs = laborRow ? laborRowHours(laborRow) : 0
            const laborCost = laborHrs * rate
            const materialsFromTakeoff = pricingFixtureMaterialsFromTakeoff[pricingRowBreakdownModalCountRow!.id]
            const materialsBeforeTax = materialsFromTakeoff != null
              ? materialsFromTakeoff
              : (totalLaborHours > 0 ? totalMaterials * (laborHrs / totalLaborHours) : 0)
            const taxAmount = materialsFromTakeoff != null ? materialsBeforeTax * (taxPercent / 100) : 0
            const ourCost = laborCost + materialsBeforeTax + taxAmount
            return (
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="pricing-breakdown-title"
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1000,
                }}
                onClick={() => setPricingRowBreakdownModalCountRow(null)}
              >
                <div
                  style={{
                    background: 'white',
                    borderRadius: 8,
                    padding: '1.5rem 2rem',
                    minWidth: 320,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h2 id="pricing-breakdown-title" style={{ margin: '0 0 1rem', fontSize: '1.125rem' }}>
                    Cost breakdown: {pricingRowBreakdownModalCountRow.fixture ?? ''}
                  </h2>
                  <dl style={{ margin: 0, display: 'grid', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                      <dt style={{ margin: 0, color: '#6b7280' }}>Materials {materialsFromTakeoff != null ? '(from takeoff)' : '(proportional)'}</dt>
                      <dd style={{ margin: 0 }}>${formatCurrency(materialsBeforeTax)}</dd>
                    </div>
                    {taxAmount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                        <dt style={{ margin: 0, color: '#6b7280' }}>Tax ({taxPercent}%)</dt>
                        <dd style={{ margin: 0 }}>${formatCurrency(taxAmount)}</dd>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                      <dt style={{ margin: 0, color: '#6b7280' }}>Labor</dt>
                      <dd style={{ margin: 0 }}>${formatCurrency(laborCost)}</dd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontWeight: 600, paddingTop: '0.5rem', borderTop: '1px solid #e5e7eb' }}>
                      <dt style={{ margin: 0 }}>Our cost</dt>
                      <dd style={{ margin: 0 }}>${formatCurrency(ourCost)}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    onClick={() => setPricingRowBreakdownModalCountRow(null)}
                    style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', width: '100%' }}
                  >
                    Close
                  </button>
                </div>
              </div>
            )
          })()}
          {!selectedBidForPricing && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Project Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Bid Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBidsForPricing.map((bid) => (
                    <tr
                      key={bid.id}
                      onClick={() => setSharedBid(bid)}
                      style={{
                        cursor: 'pointer',
                        borderBottom: '1px solid #e5e7eb',
                      }}
                    >
                      <td style={{ padding: '0.75rem' }}>{bidDisplayName(bid) || '—'}</td>
                      <td style={{ padding: '0.75rem' }}>{formatDateYYMMDD(bid.bid_due_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', marginTop: '1.5rem' }}>
            <div>
              <button
                type="button"
                onClick={() => setPriceBookSectionOpen((prev) => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  margin: 0,
                  marginBottom: priceBookSectionOpen ? '0.75rem' : 0,
                  padding: 0,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 600,
                }}
              >
                <span style={{ fontSize: '0.75rem' }}>{priceBookSectionOpen ? '▼' : '▶'}</span>
                Price book
              </button>
              {priceBookSectionOpen && (
              <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {priceBookVersions.map((v) => (
                  <span
                    key={v.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.35rem 0.5rem',
                      background: selectedPricingVersionId === v.id ? '#dbeafe' : '#f3f4f6',
                      border: selectedPricingVersionId === v.id ? '1px solid #3b82f6' : '1px solid #d1d5db',
                      borderRadius: 4,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => { setSelectedPricingVersionId(v.id); loadPriceBookEntries(v.id) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: selectedPricingVersionId === v.id ? 600 : 400, padding: 0 }}
                    >
                      {v.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditPricingVersion(v)}
                      style={{ padding: '0.15rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
                      title="Edit version name"
                    >
                      ✎
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={openNewPricingVersion}
                  style={{ padding: '0.35rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  Add version
                </button>
              </div>
              {selectedPricingVersionId && (
                <>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Entries</h4>
                  <input
                    type="text"
                    placeholder="Search fixture/tie-in name..."
                    value={priceBookSearchQuery}
                    onChange={(e) => setPriceBookSearchQuery(e.target.value)}
                    style={{ 
                      width: '100%', 
                      padding: '0.5rem', 
                      border: '1px solid #d1d5db', 
                      borderRadius: 4, 
                      marginBottom: '0.5rem', 
                      boxSizing: 'border-box' 
                    }}
                  />
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ background: '#f9fafb' }}>
                        <tr>
                          <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Fixture / Tie-in</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Rough In</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Top Out</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Trim Set</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Total</th>
                          <th style={{ padding: '0.5rem', width: 60, borderBottom: '1px solid #e5e7eb' }} />
                        </tr>
                      </thead>
                      <tbody>
                        {priceBookEntries
                          .filter((entry) => 
                            (entry.fixture_types?.name ?? '').toLowerCase().includes(priceBookSearchQuery.toLowerCase())
                          )
                          .map((entry) => (
                          <tr key={entry.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '0.5rem' }}>{entry.fixture_types?.name ?? ''}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>${formatCurrency(Number(entry.rough_in_price))}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>${formatCurrency(Number(entry.top_out_price))}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>${formatCurrency(Number(entry.trim_set_price))}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>${formatCurrency(Number(entry.total_price))}</td>
                            <td style={{ padding: '0.5rem' }}>
                              <button type="button" onClick={() => openEditPricingEntry(entry)} style={{ padding: '0.15rem', background: 'none', border: 'none', cursor: 'pointer' }} title="Edit">✎</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {priceBookSearchQuery && 
                   priceBookEntries.filter((e) => 
                     (e.fixture_types?.name ?? '').toLowerCase().includes(priceBookSearchQuery.toLowerCase())
                   ).length === 0 && (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: '1rem', 
                      color: '#6b7280' 
                    }}>
                      No entries match "{priceBookSearchQuery}"
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPricingEntry(null)
                          setPricingEntryFixtureName(priceBookSearchQuery)
                          setPricingEntryRoughIn('')
                          setPricingEntryTopOut('')
                          setPricingEntryTrimSet('')
                          setPricingEntryTotal('')
                          setPricingEntryFormOpen(true)
                        }}
                        style={{ 
                          display: 'block',
                          margin: '0.5rem auto 0',
                          padding: '0.5rem 1rem', 
                          background: '#3b82f6', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: 4, 
                          cursor: 'pointer',
                          fontSize: '0.875rem'
                        }}
                      >
                        Add "{priceBookSearchQuery}" to Price Book
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={openNewPricingEntry}
                    style={{ marginTop: '0.5rem', padding: '0.35rem 0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                  >
                    Add entry
                  </button>
                </>
              )}
              </>
              )}
            </div>
          </div>
          {pricingVersionFormOpen && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 50,
              }}
              onClick={closePricingVersionForm}
            >
              <div
                style={{ background: 'white', borderRadius: 8, padding: '1.5rem', minWidth: 320, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ margin: '0 0 1rem' }}>{editingPricingVersion ? 'Edit version' : 'New version'}</h3>
                <form onSubmit={savePricingVersion}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Name</label>
                  <input
                    type="text"
                    value={pricingVersionNameInput}
                    onChange={(e) => setPricingVersionNameInput(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
                    placeholder="e.g. 2025 Standard"
                  />
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                    {editingPricingVersion && editingPricingVersion.name !== 'Default' ? (
                      <button
                        type="button"
                        onClick={() => openDeletePricingVersionModal(editingPricingVersion)}
                        style={{ padding: '0.5rem 1rem', background: 'white', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}
                      >
                        Delete version
                      </button>
                    ) : (
                      <span />
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button type="button" onClick={closePricingVersionForm} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                      <button type="submit" disabled={savingPricingVersion} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{savingPricingVersion ? 'Saving…' : 'Save'}</button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
          {deletePricingVersionModalOpen && pricingVersionToDelete && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 50,
              }}
              onClick={() => {
                setDeletePricingVersionModalOpen(false)
                setPricingVersionToDelete(null)
                setDeletePricingVersionNameInput('')
                setDeletePricingVersionError(null)
              }}
            >
              <div
                style={{ background: 'white', borderRadius: 8, padding: '1.5rem', minWidth: 360, maxWidth: '90vw', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ margin: '0 0 0.75rem', color: '#b91c1c' }}>Delete price book version</h3>
                <p style={{ margin: '0 0 0.75rem', color: '#374151', fontSize: '0.9rem' }}>
                  This will permanently delete the price book version{' '}
                  <strong>{pricingVersionToDelete.name}</strong> and all entries it contains.
                </p>
                <p style={{ margin: '0 0 0.5rem', color: '#4b5563', fontSize: '0.875rem' }}>
                  Type the name of this price book version to confirm:
                </p>
                <input
                  type="text"
                  value={deletePricingVersionNameInput}
                  onChange={(e) => {
                    setDeletePricingVersionNameInput(e.target.value)
                    if (deletePricingVersionError) setDeletePricingVersionError(null)
                  }}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    marginBottom: '0.5rem',
                    boxSizing: 'border-box',
                  }}
                  placeholder={pricingVersionToDelete.name}
                />
                {deletePricingVersionError && (
                  <p style={{ margin: '0 0 0.5rem', color: '#b91c1c', fontSize: '0.875rem' }}>
                    {deletePricingVersionError}
                  </p>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setDeletePricingVersionModalOpen(false)
                      setPricingVersionToDelete(null)
                      setDeletePricingVersionNameInput('')
                      setDeletePricingVersionError(null)
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#f3f4f6',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeletePricingVersion}
                    disabled={!deletePricingVersionNameInput.trim()}
                    style={{
                      padding: '0.5rem 1rem',
                      background: deletePricingVersionNameInput.trim() ? '#b91c1c' : '#e5e7eb',
                      color: deletePricingVersionNameInput.trim() ? 'white' : '#9ca3af',
                      border: 'none',
                      borderRadius: 4,
                      cursor: deletePricingVersionNameInput.trim() ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
          {pricingEntryFormOpen && selectedPricingVersionId && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 50,
              }}
              onClick={closePricingEntryForm}
            >
              <div
                style={{ background: 'white', borderRadius: 8, padding: '1.5rem', minWidth: 360, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ margin: '0 0 1rem' }}>{editingPricingEntry ? 'Edit entry' : 'New entry'}</h3>
                {error && (
                  <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: 4, fontSize: '0.875rem' }}>
                    {error}
                  </div>
                )}
                <form onSubmit={savePricingEntry}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Fixture / Tie-in *</label>
                  <input
                    type="text"
                    list="pricing-fixture-types"
                    value={pricingEntryFixtureName}
                    onChange={(e) => setPricingEntryFixtureName(e.target.value)}
                    required
                    placeholder="Type or select fixture type..."
                    autoComplete="off"
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '0.75rem', boxSizing: 'border-box' }}
                  />
                  <datalist id="pricing-fixture-types">
                    {fixtureTypes.map(ft => (
                      <option key={ft.id} value={ft.name} />
                    ))}
                  </datalist>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Rough In</label>
                      <input type="number" min={0} step={0.01} value={pricingEntryRoughIn} onChange={(e) => setPricingEntryRoughIn(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Top Out</label>
                      <input type="number" min={0} step={0.01} value={pricingEntryTopOut} onChange={(e) => setPricingEntryTopOut(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Trim Set</label>
                      <input type="number" min={0} step={0.01} value={pricingEntryTrimSet} onChange={(e) => setPricingEntryTrimSet(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Total</label>
                      <input type="number" min={0} step={0.01} value={pricingEntryTotal} onChange={(e) => setPricingEntryTotal(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      {editingPricingEntry && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm(`Delete "${editingPricingEntry.fixture_types?.name ?? ''}" from this price book?`)) return
                            await deletePricingEntry(editingPricingEntry)
                            closePricingEntryForm()
                          }}
                          style={{ padding: '0.5rem 1rem', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" onClick={closePricingEntryForm} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                      <button type="submit" disabled={savingPricingEntry} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{savingPricingEntry ? 'Saving…' : 'Save'}</button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cover Letter Tab */}
      {activeTab === 'cover-letter' && (
        <div>
          {!selectedBidForPricing && (
            <input
              type="text"
              placeholder="Search bids (project name or GC/Builder)..."
              value={coverLetterSearchQuery}
              onChange={(e) => setCoverLetterSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
            />
          )}
          {!selectedBidForPricing ? (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Project Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Bid Date</th>
                  </tr>
                </thead>
                <tbody>
                  {bids
                    .filter((b) => {
                      const q = coverLetterSearchQuery.toLowerCase()
                      if (!q) return true
                      const name = bidDisplayName(b).toLowerCase()
                      const cust = (b.customers?.name ?? '').toLowerCase()
                      const gc = (b.bids_gc_builders?.name ?? '').toLowerCase()
                      return name.includes(q) || cust.includes(q) || gc.includes(q)
                    })
                    .map((bid) => (
                      <tr
                        key={bid.id}
                        onClick={() => setSharedBid(bid)}
                        style={{
                          cursor: 'pointer',
                          borderBottom: '1px solid #e5e7eb',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'white' }}
                      >
                        <td style={{ padding: '0.75rem' }}>{bidDisplayName(bid) || '—'}</td>
                        <td style={{ padding: '0.75rem' }}>{formatDateYYMMDD(bid.bid_due_date)}</td>
                      </tr>
                    ))}
                  {bids.filter((b) => {
                    const q = coverLetterSearchQuery.toLowerCase()
                    if (!q) return true
                    const name = bidDisplayName(b).toLowerCase()
                    const cust = (b.customers?.name ?? '').toLowerCase()
                    const gc = (b.bids_gc_builders?.name ?? '').toLowerCase()
                    return name.includes(q) || cust.includes(q) || gc.includes(q)
                  }).length === 0 && (
                    <tr>
                      <td colSpan={2} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                        {bids.length === 0 ? 'No bids yet.' : 'No bids match your search.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (() => {
            const bid = selectedBidForPricing
            const customer = bid.customers
            const customerName = customer?.name ?? '—'
            const customerAddress = customer?.address ?? '—'
            const projectNameVal = bid.project_name ?? '—'
            const projectAddressVal = bid.address ?? '—'
            const entriesById = new Map(priceBookEntries.map((e) => [e.id, e]))
            let coverLetterRevenue = 0
            pricingCountRows.forEach((countRow) => {
              const assignment = bidPricingAssignments.find((a) => a.count_row_id === countRow.id)
              const entry = assignment ? entriesById.get(assignment.price_book_entry_id) : priceBookEntries.find((e) => (e.fixture_types?.name ?? '').toLowerCase() === (countRow.fixture ?? '').toLowerCase())
              const count = Number(countRow.count)
              const unitPrice = entry ? Number(entry.total_price) : 0
              const isFixedPrice = assignment?.is_fixed_price ?? false
              const revenue = isFixedPrice ? unitPrice : count * unitPrice
              coverLetterRevenue += revenue
            })
            const revenueWords = numberToWords(coverLetterRevenue).toUpperCase()
            const revenueNumber = `$${formatCurrency(coverLetterRevenue)}`
            const fixtureRows = pricingCountRows.map((r) => ({ fixture: r.fixture ?? '', count: Number(r.count) }))
            const inclusions = coverLetterInclusionsByBid[bid.id] ?? ''
            const inclusionsDisplay = coverLetterInclusionsByBid[bid.id] ?? DEFAULT_INCLUSIONS
            const exclusions = coverLetterExclusionsByBid[bid.id] ?? ''
            const exclusionsDisplay = coverLetterExclusionsByBid[bid.id] ?? DEFAULT_EXCLUSIONS
            const terms = coverLetterTermsByBid[bid.id] ?? ''
            const termsDisplay = coverLetterTermsByBid[bid.id] ?? DEFAULT_TERMS_AND_WARRANTY
            const designDrawingPlanDateFormatted = (coverLetterIncludeDesignDrawingPlanDateByBid[bid.id] && bid.design_drawing_plan_date) ? formatDesignDrawingPlanDate(bid.design_drawing_plan_date) : null
            const combinedText = buildCoverLetterText(customerName, customerAddress, projectNameVal, projectAddressVal, revenueWords, revenueNumber, fixtureRows, inclusions, exclusions, terms, designDrawingPlanDateFormatted)
            const combinedHtml = buildCoverLetterHtml(customerName, customerAddress, projectNameVal, projectAddressVal, revenueWords, revenueNumber, fixtureRows, inclusions, exclusions, terms, designDrawingPlanDateFormatted)
            const now = new Date()
            const yy = now.getFullYear() % 100
            const mm = String(now.getMonth() + 1).padStart(2, '0')
            const dd = String(now.getDate()).padStart(2, '0')
            const datePart = `${yy}${mm}${dd}`
            const sanitizedProjectName = (projectNameVal ?? '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Project'
            const templateCopyTarget = `ClickProposal_${datePart}_${sanitizedProjectName}`
            
            // Get service type name to use appropriate Google Docs template
            const bidServiceType = serviceTypes.find(st => st.id === bid.service_type_id)
            const serviceTypeName = bidServiceType?.name ?? 'Plumbing'
            
            // Service-type-specific Google Docs template URLs
            let googleDocsTemplateId = '1Xs76a1fAZfj4GGyIQ-wH_x98rtjnfoB7RVt7cMBmPP8' // Default: Plumbing
            if (serviceTypeName === 'Electrical') {
              googleDocsTemplateId = '1WO7egdTaavsl3YABBc7cR9va-IwmF9PTdIubxDw7ips'
            } else if (serviceTypeName === 'HVAC') {
              googleDocsTemplateId = '1Xs76a1fAZfj4GGyIQ-wH_x98rtjnfoB7RVt7cMBmPP8' // TODO: Update when HVAC template is available
            }
            
            const googleDocsCopyUrl = `https://docs.google.com/document/d/${googleDocsTemplateId}/copy?title=` + encodeURIComponent(templateCopyTarget)
            const copyToClipboard = () => {
              if (navigator.clipboard && navigator.clipboard.write) {
                const htmlBlob = new Blob([combinedHtml], { type: 'text/html' })
                const textBlob = new Blob([combinedText], { type: 'text/plain' })
                const item = new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })
                navigator.clipboard.write([item]).then(
                  () => {
                    setCoverLetterCopySuccess(true)
                    setTimeout(() => setCoverLetterCopySuccess(false), 2000)
                  },
                  () => {
                    navigator.clipboard.writeText(combinedText).then(() => {
                      setCoverLetterCopySuccess(true)
                      setTimeout(() => setCoverLetterCopySuccess(false), 2000)
                    })
                  }
                )
              } else {
                navigator.clipboard.writeText(combinedText).then(() => {
                  setCoverLetterCopySuccess(true)
                  setTimeout(() => setCoverLetterCopySuccess(false), 2000)
                })
              }
            }
            return (
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1.5rem 2rem', background: 'white', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h2 style={{ margin: 0 }}>{bidDisplayName(bid) || 'Bid'}</h2>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => openEditBid(bid)}
                      title="Edit bid"
                      style={{ padding: '0.5rem 1rem', background: '#eff6ff', border: '1px solid #3b82f6', borderRadius: 4, color: '#1d4ed8', cursor: 'pointer' }}
                    >
                      Edit bid
                    </button>
                    <button
                      type="button"
                      onClick={() => printCoverLetterDocument(combinedHtml)}
                      title="Print combined document"
                      style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Print
                    </button>
                    <button
                      type="button"
                      onClick={() => setSharedBid(null)}
                      style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Close
                    </button>
                  </div>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Customer</div>
                  <div>{customerName}</div>
                  {addressLines(customerAddress).map((line, i) => (
                    <div key={i} style={{ color: '#6b7280' }}>{line}</div>
                  ))}
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Project</div>
                  <div>{projectNameVal}</div>
                  {addressLines(projectAddressVal).map((line, i) => (
                    <div key={i} style={{ color: '#6b7280' }}>{line}</div>
                  ))}
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Proposed amount (from Pricing)</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => applyProposedAmountToBidValue(bid.id, coverLetterRevenue)}
                        disabled={applyingBidValue || coverLetterRevenue === 0}
                        style={{
                          padding: '0.25rem 0.75rem',
                          background: applyingBidValue || coverLetterRevenue === 0 ? '#d1d5db' : '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          cursor: applyingBidValue || coverLetterRevenue === 0 ? 'not-allowed' : 'pointer',
                          fontSize: '0.875rem'
                        }}
                        title="Apply this amount to Bid Value"
                      >
                        {applyingBidValue ? 'Applying...' : 'Apply to Bid Value'}
                      </button>
                      {bidValueAppliedSuccess && (
                        <span style={{ fontSize: '0.875rem', color: '#059669', fontWeight: 500 }}>
                          ✓ Applied successfully
                        </span>
                      )}
                    </div>
                  </div>
                  <div>{revenueWords} ({revenueNumber})</div>
                  {bid.bid_value != null && bid.bid_value !== coverLetterRevenue && (
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                      Current Bid Value: ${formatCurrency(bid.bid_value)}
                    </div>
                  )}
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem', fontWeight: 500 }}>Include in combined document</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!!coverLetterIncludeDesignDrawingPlanDateByBid[bid.id]}
                      onChange={() => setCoverLetterIncludeDesignDrawingPlanDateByBid((prev) => ({ ...prev, [bid.id]: !prev[bid.id] }))}
                    />
                    {bid.design_drawing_plan_date
                      ? `Design Drawings Plan Date [${formatDesignDrawingPlanDateLabel(bid.design_drawing_plan_date)}]`
                      : 'Design Drawings Plan Date: [not set]'}
                  </label>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Additional Inclusions (one per line, shown as bullets)</label>
                  <textarea
                    value={inclusionsDisplay}
                    onChange={(e) => setCoverLetterInclusionsByBid((prev) => ({ ...prev, [bid.id]: e.target.value }))}
                    rows={4}
                    placeholder="e.g. Labor and materials for rough-in, top-out, trim"
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Exclusions and Scope (one per line, shown as bullets)</label>
                  <textarea
                    value={exclusionsDisplay}
                    onChange={(e) => setCoverLetterExclusionsByBid((prev) => ({ ...prev, [bid.id]: e.target.value }))}
                    rows={4}
                    placeholder="e.g. Owner-supplied fixtures"
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setCoverLetterTermsCollapsed((c) => !c)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '1rem' }}
                  >
                    {coverLetterTermsCollapsed ? '\u25B6' : '\u25BC'} Terms and Warranty
                  </button>
                  {!coverLetterTermsCollapsed && (
                    <textarea
                      value={termsDisplay}
                      onChange={(e) => setCoverLetterTermsByBid((prev) => ({ ...prev, [bid.id]: e.target.value }))}
                      rows={4}
                      placeholder="e.g. 1-year warranty on labor"
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box', marginTop: '0.5rem' }}
                    />
                  )}
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Combined document (copy to send)</label>
                  <div
                    key={`combined-preview-${bid.id}-${!!coverLetterIncludeDesignDrawingPlanDateByBid[bid.id]}`}
                    style={{ width: '100%', minHeight: 360, padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: 4, fontFamily: 'inherit', fontSize: '0.875rem', boxSizing: 'border-box', whiteSpace: 'pre-wrap' }}
                    dangerouslySetInnerHTML={{ __html: combinedHtml }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={copyToClipboard}
                      style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                    >
                      {coverLetterCopySuccess ? 'Copied!' : 'Copy to clipboard'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        copyToClipboard()
                        window.open(googleDocsCopyUrl, templateCopyTarget)
                        setCoverLetterBidSubmissionQuickAddBidId(bid.id)
                        setCoverLetterBidSubmissionQuickAddValue(bid.bid_submission_link ?? '')
                      }}
                      style={{ padding: '0.5rem 1rem', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: 'inherit' }}
                    >
                      Open in Google Docs
                    </button>
                    {coverLetterBidSubmissionQuickAddBidId === bid.id && (
                      <>
                        <input
                          type="url"
                          value={coverLetterBidSubmissionQuickAddValue}
                          onChange={(e) => setCoverLetterBidSubmissionQuickAddValue(e.target.value)}
                          placeholder="Set the sharing permissions and paste the Proposal link here to quick add: https://docs.google.com/…"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              void saveBidSubmissionQuickAdd(bid.id, coverLetterBidSubmissionQuickAddValue)
                            }
                          }}
                          style={{ flex: 1, minWidth: 200, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }}
                        />
                        <button
                          type="button"
                          onClick={() => void saveBidSubmissionQuickAdd(bid.id, coverLetterBidSubmissionQuickAddValue)}
                          style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                        >
                          Add
                        </button>
                      </>
                    )}
                    {bidSubmissionQuickAddSuccess === bid.id && (
                      <span style={{ fontSize: '0.875rem', color: '#059669', fontWeight: 500 }}>
                        ✓ Link added successfully
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Submission & Followup Tab */}
      {activeTab === 'submission-followup' && (
        <div>
          {/* Print Followup Sheet UI */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <label htmlFor="account-manager-print" style={{ fontWeight: 500 }}>
              Followup sheet for:
            </label>
            <select
              id="account-manager-print"
              value={selectedAccountManagerForPrint}
              onChange={(e) => setSelectedAccountManagerForPrint(e.target.value)}
              style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, minWidth: '180px' }}
            >
              <option value="">Select...</option>
              <option value="ALL">ALL ({totalBidsCount})</option>
              <option value="UNASSIGNED">UNASSIGNED ({unassignedBidsCount})</option>
              {uniqueAccountManagers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.name} ({manager.count})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => printFollowupSheet(selectedAccountManagerForPrint)}
              disabled={!selectedAccountManagerForPrint}
              style={{ 
                padding: '0.5rem 1rem', 
                background: selectedAccountManagerForPrint ? '#3b82f6' : '#d1d5db', 
                color: 'white', 
                border: 'none', 
                borderRadius: 4, 
                cursor: selectedAccountManagerForPrint ? 'pointer' : 'not-allowed',
                fontWeight: 500
              }}
            >
              Print
            </button>
            <button
              type="button"
              onClick={() => downloadFollowupSheetPdf(selectedAccountManagerForPrint)}
              disabled={!selectedAccountManagerForPrint}
              style={{ 
                padding: '0.5rem 1rem', 
                background: selectedAccountManagerForPrint ? '#10b981' : '#d1d5db', 
                color: 'white', 
                border: 'none', 
                borderRadius: 4, 
                cursor: selectedAccountManagerForPrint ? 'pointer' : 'not-allowed',
                fontWeight: 500
              }}
            >
              PDF
            </button>
          </div>

          <input
            type="text"
            placeholder="Search bids (project name or GC/Builder)..."
            value={submissionSearchQuery}
            onChange={(e) => setSubmissionSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
          />
          {selectedBidForSubmission && (
            <div ref={submissionSummaryCardRef} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1.5rem 2rem', background: 'white', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0 }}>{bidDisplayName(selectedBidForSubmission) || 'Bid'}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => openEditBid(selectedBidForSubmission)}
                    title="Edit bid"
                    style={{ padding: '0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="20" height="20" fill="currentColor" aria-hidden="true">
                      <path d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadSubmissionSummaryPdf()}
                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  >
                    PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBidForSubmission(null)}
                    style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>
              </div>
              <div style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
                <p style={{ margin: '0.25rem 0' }}><strong>Bid Size</strong> {formatCompactCurrency(selectedBidForSubmission.bid_value != null ? Number(selectedBidForSubmission.bid_value) : null)}</p>
                <p style={{ margin: '1.5rem 0' }} />
                <p style={{ margin: '0.25rem 0' }}>
                  <strong>Builder Name</strong>{' '}
                  {(selectedBidForSubmission.customers || selectedBidForSubmission.bids_gc_builders) ? (
                    <button 
                      type="button" 
                      onClick={() => openGcBuilderOrCustomerModal(selectedBidForSubmission)} 
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        color: '#3b82f6', 
                        cursor: 'pointer', 
                        textDecoration: 'underline', 
                        padding: 0, 
                        textAlign: 'left' 
                      }}
                    >
                      {selectedBidForSubmission.customers?.name ?? selectedBidForSubmission.bids_gc_builders?.name}
                    </button>
                  ) : (
                    '—'
                  )}
                </p>
                <p style={{ margin: '0.25rem 0' }}><strong>Builder Address</strong> {selectedBidForSubmission.customers?.address ?? selectedBidForSubmission.bids_gc_builders?.address ?? '—'}</p>
                <p style={{ margin: '0.25rem 0' }}><strong>Builder Phone Number</strong> {selectedBidForSubmission.customers ? extractContactInfo(selectedBidForSubmission.customers.contact_info ?? null).phone || '—' : (selectedBidForSubmission.bids_gc_builders?.contact_number ?? '—')}</p>
                <p style={{ margin: '0.25rem 0' }}><strong>Builder Email</strong> {selectedBidForSubmission.customers ? extractContactInfo(selectedBidForSubmission.customers.contact_info ?? null).email || '—' : (selectedBidForSubmission.bids_gc_builders?.email ?? '—')}</p>
                <p style={{ margin: '1.5rem 0' }} />
                <p style={{ margin: '0.25rem 0' }}><strong>Project Name</strong> {selectedBidForSubmission.project_name ?? '—'}</p>
                <p style={{ margin: '0.25rem 0' }}><strong>Project Address</strong> {selectedBidForSubmission.address ?? '—'}</p>
                <p style={{ margin: '1.5rem 0' }} />
                <p style={{ margin: '0.25rem 0' }}><strong>Project Contact Name</strong> {selectedBidForSubmission.gc_contact_name ?? '—'}</p>
                <p style={{ margin: '0.25rem 0' }}><strong>Project Contact Phone</strong> {selectedBidForSubmission.gc_contact_phone ?? '—'}</p>
                <p style={{ margin: '0.25rem 0' }}><strong>Project Contact Email</strong> {selectedBidForSubmission.gc_contact_email ?? '—'}</p>
                <p style={{ margin: '1.5rem 0' }} />
                <p style={{ margin: '0.25rem 0' }}>
                  <strong>Bid Submission</strong>{' '}
                  {selectedBidForSubmission.bid_submission_link?.trim() ? (
                    <a href={selectedBidForSubmission.bid_submission_link} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>{selectedBidForSubmission.bid_submission_link}</a>
                  ) : '—'}
                </p>
                <p style={{ margin: '1.5rem 0' }} />
                <p style={{ margin: '0.25rem 0' }}>
                  <strong>Project Folder</strong>{' '}
                  {selectedBidForSubmission.drive_link?.trim() ? (
                    <a href={selectedBidForSubmission.drive_link} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>{selectedBidForSubmission.drive_link}</a>
                  ) : '—'}
                </p>
                <p style={{ margin: '1.5rem 0' }} />
                <p style={{ margin: '0.25rem 0' }}>
                  <strong>Job Plans</strong>{' '}
                  {selectedBidForSubmission.plans_link?.trim() ? (
                    <a href={selectedBidForSubmission.plans_link} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>{selectedBidForSubmission.plans_link}</a>
                  ) : '—'}
                </p>
              </div>
              <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setSubmissionReviewGroupCollapsed((c) => !c)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '1rem' }}
                >
                  {submissionReviewGroupCollapsed ? '\u25B6' : '\u25BC'} Margins
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={handleScrollToSelectedBidRow}
                    title="Go to bid in table"
                    aria-label="Go to bid in table"
                    style={{ padding: '0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="20" height="20" fill="currentColor" aria-hidden="true">
                      <path d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM303 441L223 361C213.6 351.6 213.6 336.4 223 327.1C232.4 317.8 247.6 317.7 256.9 327.1L295.9 366.1L295.9 216C295.9 202.7 306.6 192 319.9 192C333.2 192 343.9 202.7 343.9 216L343.9 366.1L382.9 327.1C392.3 317.7 407.5 317.7 416.8 327.1C426.1 336.5 426.2 351.7 416.8 361L336.8 441C327.4 450.4 312.2 450.4 302.9 441z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => void downloadApprovalPdf()}
                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                  >
                    Approval PDF
                  </button>
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                {!submissionReviewGroupCollapsed && (
                  <>
                    {submissionBidHasCostEstimate === 'loading' && (
                      <p style={{ margin: '0.5rem 0', fontSize: '0.875rem', color: '#6b7280' }}>Loading cost estimate info…</p>
                    )}
                    {submissionBidHasCostEstimate !== 'loading' && submissionBidHasCostEstimate !== null && (
                      <>
                        <div style={{ marginBottom: '0.5rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <span><strong>Cost estimate:</strong> {submissionBidHasCostEstimate ? (submissionBidCostEstimateAmount != null ? `$${formatCurrency(Number(submissionBidCostEstimateAmount))}` : '—') : 'Not yet created'}{' '}
                          <button
                            type="button"
                            onClick={() => {
                              setSharedBid(selectedBidForSubmission)
                              setActiveTab('cost-estimate')
                            }}
                            style={{ padding: 0, background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 'inherit', textDecoration: 'underline' }}
                          >
                            [cost estimate]
                          </button>
                          </span>
                        </div>
                        {submissionPricingByVersion.map((row) => (
                          <div key={row.versionId} style={{ marginBottom: '0.5rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <span><strong>Price Book:</strong> {row.versionName}</span>
                            <span><strong>Revenue:</strong> {row.complete ? `$${formatCurrency(row.revenue ?? 0)}` : 'Incomplete'}</span>
                            <span><strong>Margin:</strong> {row.complete && row.margin != null ? `${row.margin.toFixed(1)}%` : 'Incomplete'}</span>
                          </div>
                        ))}
                        <div style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSharedBid(selectedBidForSubmission)
                              setActiveTab('pricing')
                            }}
                            style={{ padding: 0, background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 'inherit', textDecoration: 'underline' }}
                          >
                            [pricing]
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
              <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setShowSentBidScript(true)}
                  style={{ padding: '0.375rem 0.75rem', background: '#16a34a', color: 'white', border: '1px solid #15803d', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  Sent Bid Script
                </button>
                <button
                  type="button"
                  onClick={() => setShowBidQuestionScript(true)}
                  style={{ padding: '0.375rem 0.75rem', background: '#16a34a', color: 'white', border: '1px solid #15803d', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  Bid Question Script
                </button>
              </div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ background: '#f9fafb' }}>
                    <tr>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Contact method</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Notes</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Time and date</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissionEntries.map((entry) => (
                      <SubmissionEntryRow
                        key={entry.id}
                        entry={entry}
                        onUpdate={() => { loadSubmissionEntries(selectedBidForSubmission.id); loadBids() }}
                        onDelete={() => { loadSubmissionEntries(selectedBidForSubmission.id); loadBids() }}
                      />
                    ))}
                    {addingSubmissionEntry && (
                      <NewSubmissionEntryRow
                        bidId={selectedBidForSubmission.id}
                        onSaved={() => { setAddingSubmissionEntry(false); loadSubmissionEntries(selectedBidForSubmission.id); loadBids() }}
                        onCancel={() => setAddingSubmissionEntry(false)}
                      />
                    )}
                  </tbody>
                </table>
              </div>
              {!addingSubmissionEntry && (
                <button
                  type="button"
                  onClick={() => setAddingSubmissionEntry(true)}
                  style={{ marginTop: '0.75rem', padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                >
                  Add row
                </button>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => toggleSubmissionSection('unsent')}
            aria-expanded={submissionSectionOpen.unsent}
            style={{ margin: '1.5rem 0 0.5rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <span aria-hidden>{submissionSectionOpen.unsent ? '\u25BC' : '\u25B6'}</span>
            Unsent bids ({submissionUnsent.length})
          </button>
          {submissionSectionOpen.unsent && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Project / GC</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Bid Date</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Bid Date Sent</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Last Contact</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Bid Date</th>
                    <th style={{ padding: '0.75rem', width: 44, borderBottom: '1px solid #e5e7eb' }} />
                  </tr>
                </thead>
                <tbody>
                  {submissionUnsent.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: '0.75rem', color: '#6b7280' }}>No bids in this group</td></tr>
                  ) : (
                    submissionUnsent.map((bid) => (
                      <tr
                        key={bid.id}
                        id={`submission-row-${bid.id}`}
                        onClick={() => setSharedBid(bid)}
                        style={{
                          borderBottom: '1px solid #e5e7eb',
                          cursor: 'pointer',
                          background: selectedBidForSubmission?.id === bid.id ? '#eff6ff' : undefined,
                        }}
                      >
                        <td style={{ padding: '0.75rem' }}>{formatBidNameWithValue(bid)}</td>
                        <td style={{ padding: '0.75rem' }}>{formatDateYYMMDD(bid.bid_due_date)}</td>
                        <td style={{ padding: '0.75rem' }}>{formatDateYYMMDD(bid.bid_date_sent)}</td>
                        <td style={{ padding: '0.75rem' }}>{formatTimeSinceLastContact(
                          (() => {
                            const a = bid.last_contact
                            const b = lastContactFromEntries[bid.id]
                            if (!a) return b ?? null
                            if (!b) return a
                            return new Date(b) > new Date(a) ? b : a
                          })()
                        )}</td>
                        <td style={{ padding: '0.75rem' }}>{formatTimeSinceDueDate(bid.bid_due_date)}</td>
                        <td style={{ padding: '0.75rem', width: 44 }}>
                          {selectedBidForSubmission?.id === bid.id && (
                            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                              <button
                                type="button"
                                title="Go to summary"
                                aria-label="Go to summary"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSharedBid(bid)
                                  setTimeout(() => submissionSummaryCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
                                }}
                                style={{ padding: '0.25rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" width="18" height="18" aria-hidden="true">
                                  <path d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM337 199L417 279C426.4 288.4 426.4 303.6 417 312.9C407.6 322.2 392.4 322.3 383.1 312.9L344.1 273.9L344.1 424C344.1 437.3 333.4 448 320.1 448C306.8 448 296.1 437.3 296.1 424L296.1 273.9L257.1 312.9C247.7 322.3 232.5 322.3 223.2 312.9C213.9 303.5 213.8 288.3 223.2 279L303.2 199C312.6 189.6 327.8 189.6 337.1 199z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                title="Edit bid"
                                onClick={(e) => { e.stopPropagation(); openEditBid(bid) }}
                                style={{ padding: '0.25rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" width="18" height="18" aria-hidden="true">
                                  <path d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          <button
            type="button"
            onClick={() => toggleSubmissionSection('pending')}
            aria-expanded={submissionSectionOpen.pending}
            style={{ margin: '1.5rem 0 0.5rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <span aria-hidden>{submissionSectionOpen.pending ? '\u25BC' : '\u25B6'}</span>
            Not yet won or lost ({submissionPending.length})
          </button>
          {submissionSectionOpen.pending && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Project / GC</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>GC/Builder (customer)</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Account Man</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Last Contact</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Bid Date</th>
                    <th style={{ padding: '0.75rem', width: 44, borderBottom: '1px solid #e5e7eb' }} />
                  </tr>
                </thead>
                <tbody>
                  {submissionPending.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: '0.75rem', color: '#6b7280' }}>No bids in this group</td></tr>
                  ) : (
                    submissionPending.map((bid) => (
                      <tr
                        key={bid.id}
                        id={`submission-row-${bid.id}`}
                        onClick={() => setSharedBid(bid)}
                        style={{
                          borderBottom: '1px solid #e5e7eb',
                          cursor: 'pointer',
                          background: selectedBidForSubmission?.id === bid.id ? '#eff6ff' : undefined,
                        }}
                      >
                        <td style={{ padding: '0.75rem' }}>
                          <div>
                            <div>{formatBidNameWithValue(bid)}</div>
                            {bid.address && (
                              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.125rem' }}>
                                {bid.address}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'left' }}>
                          {(bid.customers || bid.bids_gc_builders) ? (
                            <button type="button" onClick={(e) => { e.stopPropagation(); openGcBuilderOrCustomerModal(bid) }} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', textDecoration: 'underline', padding: 0, textAlign: 'left' }}>
                              {bid.customers?.name ?? bid.bids_gc_builders?.name ?? '—'}
                            </button>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          {(() => {
                            const am = bid.account_manager as EstimatorUser | null
                            return am ? (am.name || am.email) : '—'
                          })()}
                        </td>
                        <td style={{ padding: '0.75rem' }}>{formatTimeSinceLastContact(
                          (() => {
                            const a = bid.last_contact
                            const b = lastContactFromEntries[bid.id]
                            if (!a) return b ?? null
                            if (!b) return a
                            return new Date(b) > new Date(a) ? b : a
                          })()
                        )}</td>
                        <td style={{ padding: '0.75rem' }}>{formatTimeSinceDueDate(bid.bid_due_date)}</td>
                        <td style={{ padding: '0.75rem', width: 44 }}>
                          {selectedBidForSubmission?.id === bid.id && (
                            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                              <button
                                type="button"
                                title="Go to summary"
                                aria-label="Go to summary"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSharedBid(bid)
                                  setTimeout(() => submissionSummaryCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
                                }}
                                style={{ padding: '0.25rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" width="18" height="18" aria-hidden="true">
                                  <path d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM337 199L417 279C426.4 288.4 426.4 303.6 417 312.9C407.6 322.2 392.4 322.3 383.1 312.9L344.1 273.9L344.1 424C344.1 437.3 333.4 448 320.1 448C306.8 448 296.1 437.3 296.1 424L296.1 273.9L257.1 312.9C247.7 322.3 232.5 322.3 223.2 312.9C213.9 303.5 213.8 288.3 223.2 279L303.2 199C312.6 189.6 327.8 189.6 337.1 199z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                title="Edit bid"
                                onClick={(e) => { e.stopPropagation(); openEditBid(bid) }}
                                style={{ padding: '0.25rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" width="18" height="18" aria-hidden="true">
                                  <path d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          <button
            type="button"
            onClick={() => toggleSubmissionSection('won')}
            aria-expanded={submissionSectionOpen.won}
            style={{ margin: '1.5rem 0 0.5rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <span aria-hidden>{submissionSectionOpen.won ? '\u25BC' : '\u25B6'}</span>
            Won ({submissionWon.length})
          </button>
          {submissionSectionOpen.won && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Project / GC</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Start Date</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>GC/Builder (customer)</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Account Man</th>
                    <th style={{ padding: '0.75rem', width: 44, borderBottom: '1px solid #e5e7eb' }} />
                  </tr>
                </thead>
                <tbody>
                  {submissionWon.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: '0.75rem', color: '#6b7280' }}>No bids in this group</td></tr>
                  ) : (
                    submissionWon.map((bid) => (
                      <tr
                        key={bid.id}
                        id={`submission-row-${bid.id}`}
                        onClick={() => setSharedBid(bid)}
                        style={{
                          borderBottom: '1px solid #e5e7eb',
                          cursor: 'pointer',
                          background: selectedBidForSubmission?.id === bid.id ? '#eff6ff' : undefined,
                        }}
                      >
                        <td style={{ padding: '0.75rem' }}>{formatBidNameWithValue(bid)}</td>
                        <td style={{ padding: '0.75rem' }}>{formatDateYYMMDD(bid.estimated_job_start_date)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'left' }}>
                          {(bid.customers || bid.bids_gc_builders) ? (
                            <button type="button" onClick={(e) => { e.stopPropagation(); openGcBuilderOrCustomerModal(bid) }} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', textDecoration: 'underline', padding: 0, textAlign: 'left' }}>
                              {bid.customers?.name ?? bid.bids_gc_builders?.name ?? '—'}
                            </button>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          {(() => {
                            const am = bid.account_manager as EstimatorUser | null
                            return am ? (am.name || am.email) : '—'
                          })()}
                        </td>
                        <td style={{ padding: '0.75rem', width: 44 }}>
                          {selectedBidForSubmission?.id === bid.id && (
                            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                              <button
                                type="button"
                                title="Go to summary"
                                aria-label="Go to summary"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSharedBid(bid)
                                  setTimeout(() => submissionSummaryCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
                                }}
                                style={{ padding: '0.25rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" width="18" height="18" aria-hidden="true">
                                  <path d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM337 199L417 279C426.4 288.4 426.4 303.6 417 312.9C407.6 322.2 392.4 322.3 383.1 312.9L344.1 273.9L344.1 424C344.1 437.3 333.4 448 320.1 448C306.8 448 296.1 437.3 296.1 424L296.1 273.9L257.1 312.9C247.7 322.3 232.5 322.3 223.2 312.9C213.9 303.5 213.8 288.3 223.2 279L303.2 199C312.6 189.6 327.8 189.6 337.1 199z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                title="Edit bid"
                                onClick={(e) => { e.stopPropagation(); openEditBid(bid) }}
                                style={{ padding: '0.25rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" width="18" height="18" aria-hidden="true">
                                  <path d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          <button
            type="button"
            onClick={() => toggleSubmissionSection('startedOrComplete')}
            aria-expanded={submissionSectionOpen.startedOrComplete}
            style={{ margin: '1.5rem 0 0.5rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <span aria-hidden>{submissionSectionOpen.startedOrComplete ? '\u25BC' : '\u25B6'}</span>
            Started or Complete ({submissionStartedOrComplete.length})
          </button>
          {submissionSectionOpen.startedOrComplete && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Project / GC</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>GC/Builder (customer)</th>
                    <th style={{ padding: '0.75rem', width: 80, borderBottom: '1px solid #e5e7eb' }} />
                  </tr>
                </thead>
                <tbody>
                  {submissionStartedOrComplete.length === 0 ? (
                    <tr><td colSpan={3} style={{ padding: '0.75rem', color: '#6b7280' }}>No bids in this group</td></tr>
                  ) : (
                    submissionStartedOrComplete.map((bid) => (
                      <tr
                        key={bid.id}
                        id={`submission-row-${bid.id}`}
                        onClick={() => setSharedBid(bid)}
                        style={{
                          borderBottom: '1px solid #e5e7eb',
                          cursor: 'pointer',
                          background: selectedBidForSubmission?.id === bid.id ? '#eff6ff' : undefined,
                        }}
                      >
                        <td style={{ padding: '0.75rem' }}>{formatBidNameWithValue(bid)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'left' }}>
                          {(bid.customers || bid.bids_gc_builders) ? (
                            <button type="button" onClick={(e) => { e.stopPropagation(); openGcBuilderOrCustomerModal(bid) }} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', textDecoration: 'underline', padding: 0, textAlign: 'left' }}>
                              {bid.customers?.name ?? bid.bids_gc_builders?.name ?? '—'}
                            </button>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td style={{ padding: '0.75rem', width: 80 }}>
                          {selectedBidForSubmission?.id === bid.id && (
                            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                              <button
                                type="button"
                                title="Go to summary"
                                aria-label="Go to summary"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSharedBid(bid)
                                  setTimeout(() => submissionSummaryCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
                                }}
                                style={{ padding: '0.25rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" width="18" height="18" aria-hidden="true">
                                  <path d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM337 199L417 279C426.4 288.4 426.4 303.6 417 312.9C407.6 322.2 392.4 322.3 383.1 312.9L344.1 273.9L344.1 424C344.1 437.3 333.4 448 320.1 448C306.8 448 296.1 437.3 296.1 424L296.1 273.9L257.1 312.9C247.7 322.3 232.5 322.3 223.2 312.9C213.9 303.5 213.8 288.3 223.2 279L303.2 199C312.6 189.6 327.8 189.6 337.1 199z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                title="Edit bid"
                                onClick={(e) => { e.stopPropagation(); openEditBid(bid) }}
                                style={{ padding: '0.25rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" width="18" height="18" aria-hidden="true">
                                  <path d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          <button
            type="button"
            onClick={() => toggleSubmissionSection('lost')}
            aria-expanded={submissionSectionOpen.lost}
            style={{ margin: '1.5rem 0 0.5rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <span aria-hidden>{submissionSectionOpen.lost ? '\u25BC' : '\u25B6'}</span>
            Lost ({submissionLost.length})
          </button>
          {submissionSectionOpen.lost && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Project / GC</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Bid Date</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Loss Reason</th>
                  <th style={{ padding: '0.75rem', width: 44, borderBottom: '1px solid #e5e7eb' }} />
                </tr>
              </thead>
              <tbody>
                {submissionLost.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: '0.75rem', color: '#6b7280' }}>No bids in this group</td></tr>
                ) : (
                  submissionLost.map((bid) => (
                    <tr
                      key={bid.id}
                      id={`submission-row-${bid.id}`}
                      onClick={() => setSharedBid(bid)}
                      style={{
                        borderBottom: '1px solid #e5e7eb',
                        cursor: 'pointer',
                        background: selectedBidForSubmission?.id === bid.id ? '#eff6ff' : undefined,
                      }}
                    >
                      <td style={{ padding: '0.75rem' }}>{bidDisplayName(bid) || bid.customers?.name || bid.bids_gc_builders?.name || bid.id.slice(0, 8)}</td>
                      <td style={{ padding: '0.75rem' }}>{formatDateYYMMDD(bid.bid_due_date)}</td>
                      <td style={{ padding: '0.75rem' }}>{(bid as { loss_reason?: string | null }).loss_reason?.trim() || '—'}</td>
                      <td style={{ padding: '0.75rem', width: 44 }}>
                        {selectedBidForSubmission?.id === bid.id && (
                            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                              <button
                                type="button"
                                title="Go to summary"
                                aria-label="Go to summary"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSharedBid(bid)
                                  setTimeout(() => submissionSummaryCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
                                }}
                                style={{ padding: '0.25rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" width="18" height="18" aria-hidden="true">
                                  <path d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM337 199L417 279C426.4 288.4 426.4 303.6 417 312.9C407.6 322.2 392.4 322.3 383.1 312.9L344.1 273.9L344.1 424C344.1 437.3 333.4 448 320.1 448C306.8 448 296.1 437.3 296.1 424L296.1 273.9L257.1 312.9C247.7 322.3 232.5 322.3 223.2 312.9C213.9 303.5 213.8 288.3 223.2 279L303.2 199C312.6 189.6 327.8 189.6 337.1 199z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                title="Edit bid"
                                onClick={(e) => { e.stopPropagation(); openEditBid(bid) }}
                                style={{ padding: '0.25rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" width="18" height="18" aria-hidden="true">
                                  <path d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z" />
                                </svg>
                              </button>
                            </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      {/* New/Edit Bid Modal */}
      {bidFormOpen && (
        <div className="bid-form-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <style>{`
            @media (max-width: 640px) {
              .bid-form-overlay {
                align-items: stretch !important;
                justify-content: stretch !important;
              }
              .bid-form-grid-2 { grid-template-columns: 1fr !important; }
              .bid-form-grid-3 { grid-template-columns: 1fr !important; }
              .bid-form-modal {
                padding: 1rem !important;
                width: 100% !important;
                max-width: 100% !important;
                height: 100vh !important;
                max-height: 100vh !important;
                border-radius: 0 !important;
              }
            }
          `}</style>
          <div className="bid-form-modal" style={{ background: 'white', padding: '1rem 2rem 2rem', borderRadius: 8, maxWidth: '600px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>{editingBid ? 'Edit Bid' : 'New Bid'}</h2>
              <button type="button" onClick={closeBidForm} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
            <form onSubmit={saveBid}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Project Name *</label>
                <input type="text" value={projectName} onChange={(e) => { setProjectName(e.target.value); setError(null) }} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Service Type *</label>
                <select
                  value={formServiceTypeId}
                  onChange={(e) => setFormServiceTypeId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  required
                >
                  <option value="">Select service type...</option>
                  {visibleServiceTypes.map(st => (
                    <option key={st.id} value={st.id}>{st.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Win/ Loss</label>
                <select value={outcome} onChange={(e) => setOutcome(e.target.value as OutcomeOption)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}>
                  <option value="">—</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                  <option value="started_or_complete">Started or Complete</option>
                </select>
              </div>
              {outcome === 'lost' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Why did we lose?</label>
                  <input
                    type="text"
                    value={lossReason}
                    onChange={(e) => setLossReason(e.target.value)}
                    placeholder="e.g. Price, schedule, competitor, no response…"
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  />
                </div>
              )}
              {outcome === 'won' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Start Date</label>
                  <input type="date" value={estimatedJobStartDate} onChange={(e) => setEstimatedJobStartDate(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                </div>
              )}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Project Address [street, town, state zip]</label>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 12925 FM 20, Kingsbury, Texas 78638" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Project Folder{'\u00A0'.repeat(10)}
                  bid folders:{' '}
                  <a href="https://drive.google.com/drive/folders/1HRAnLDgQ-0__1o4umf59w6zpfW3rFvtB?usp=sharing" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>
                    [plumbing]
                  </a>
                  {' '}
                  <a href="https://drive.google.com/drive/folders/10gkh2r2xtyy2vlT3p_HnqgJI28vNN1q2?usp=sharing" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>
                    [electrical]
                  </a>
                  {' '}
                  <a href="https://drive.google.com/drive/folders/1PU1lRZOxSwm--bCQ1LcQ7eXYu5GTDKOL?usp=drive_link" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>
                    [HVAC]
                  </a>
                </label>
                <input type="url" value={driveLink} onChange={(e) => setDriveLink(e.target.value)} placeholder="https://drive.google.com/drive/... " style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Job Plans</label>
                <input type="url" value={plansLink} onChange={(e) => setPlansLink(e.target.value)} placeholder="https://drive.google.com/drive/... " style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Bid Submission</label>
                <input type="url" value={bidSubmissionLink} onChange={(e) => setBidSubmissionLink(e.target.value)} placeholder="https://drive.google.com/drive/... " style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Design Drawing Plan Date</label>
                <input type="date" value={designDrawingPlanDate} onChange={(e) => setDesignDrawingPlanDate(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ marginBottom: '1rem', position: 'relative' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>GC/Builder (customer)</label>
                <input
                  type="text"
                  value={gcCustomerSearch}
                  onChange={(e) => {
                    const value = e.target.value
                    setGcCustomerSearch(value)
                    setGcCustomerDropdownOpen(true)
                    if (gcCustomerId) {
                      const selected = customers.find((c) => c.id === gcCustomerId)
                      if (!selected || !value || getCustomerDisplay(selected).toLowerCase() !== value.toLowerCase()) {
                        setGcCustomerId('')
                      }
                    }
                  }}
                  onFocus={() => setGcCustomerDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setGcCustomerDropdownOpen(false), 200)}
                  placeholder="Search customers..."
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
                {gcCustomerDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: 4,
                      maxHeight: 200,
                      overflowY: 'auto',
                      zIndex: 100,
                      marginTop: 2,
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    {(myRole === 'dev' || myRole === 'master_technician' || myRole === 'assistant' || myRole === 'estimator') && (
                      <div
                        onClick={() => {
                          setAddCustomerModalOpen(true)
                          setGcCustomerDropdownOpen(false)
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        style={{
                          padding: '0.5rem',
                          cursor: 'pointer',
                          borderBottom: '1px solid #e5e7eb',
                          color: '#2563eb',
                          fontWeight: 500,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f3f4f6'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'white'
                        }}
                      >
                        + Add new customer
                      </div>
                    )}
                    {customers
                      .filter((c) => {
                        const searchLower = gcCustomerSearch.toLowerCase()
                        const nameLower = c.name.toLowerCase()
                        const addressLower = (c.address || '').toLowerCase()
                        return nameLower.includes(searchLower) || addressLower.includes(searchLower)
                      })
                      .map((c) => (
                        <div
                          key={c.id}
                          onClick={() => {
                            setGcCustomerId(c.id)
                            setGcCustomerSearch(getCustomerDisplay(c))
                            setGcCustomerDropdownOpen(false)
                          }}
                          style={{
                            padding: '0.5rem',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f3f4f6',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f3f4f6'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'white'
                          }}
                        >
                          <div style={{ fontWeight: 500 }}>{c.name}</div>
                          {c.address && <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 2 }}>{c.address}</div>}
                        </div>
                      ))}
                    {customers.filter((c) => {
                      const searchLower = gcCustomerSearch.toLowerCase()
                      return c.name.toLowerCase().includes(searchLower) || (c.address || '').toLowerCase().includes(searchLower)
                    }).length === 0 && (
                      <div style={{ padding: '0.5rem', color: '#6b7280', fontStyle: 'italic' }}>No customers found</div>
                    )}
                  </div>
                )}
              </div>
              {/* Display GC/Builder contact info (read-only) */}
              {(gcCustomerId || (editingBid?.gc_builder_id && editingBid?.bids_gc_builders)) && (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#6b7280' }}>
                      GC/Builder (customer) Contact Phone
                    </label>
                    <input
                      type="text"
                      value={getGcBuilderPhone()}
                      disabled
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: 4,
                        background: '#f9fafb',
                        color: '#6b7280',
                        cursor: 'not-allowed'
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#6b7280' }}>
                      GC/Builder (customer) Contact Email
                    </label>
                    <input
                      type="text"
                      value={getGcBuilderEmail()}
                      disabled
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: 4,
                        background: '#f9fafb',
                        color: '#6b7280',
                        cursor: 'not-allowed'
                      }}
                    />
                  </div>
                </>
              )}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Project Contact Name</label>
                <input type="text" value={gcContactName} onChange={(e) => setGcContactName(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Project Contact Phone</label>
                <input type="tel" value={gcContactPhone} onChange={(e) => setGcContactPhone(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Project Contact Email</label>
                <input type="email" value={gcContactEmail} onChange={(e) => setGcContactEmail(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Estimator</label>
                <select value={estimatorId} onChange={(e) => setEstimatorId(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}>
                  <option value="">—</option>
                  {estimatorUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name || u.email}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Account Man</label>
                <select value={accountManagerId} onChange={(e) => setAccountManagerId(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}>
                  <option value="">—</option>
                  {estimatorUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name || u.email}</option>
                  ))}
                </select>
              </div>
              <div className="bid-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Bid Date</label>
                  <input type="date" value={bidDueDate} onChange={(e) => setBidDueDate(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Bid Date Sent</label>
                  <input type="date" value={bidDateSent} onChange={(e) => setBidDateSent(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                </div>
              </div>
              <div className="bid-form-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Bid Value</label>
                  <input type="number" step="0.01" value={bidValue} onChange={(e) => setBidValue(e.target.value)} onWheel={(e) => e.currentTarget.blur()} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Agreed Value</label>
                  <input type="number" step="0.01" value={agreedValue} onChange={(e) => setAgreedValue(e.target.value)} onWheel={(e) => e.currentTarget.blur()} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Maximum Profit</label>
                  <input type="number" step="0.01" value={profit} onChange={(e) => setProfit(e.target.value)} onWheel={(e) => e.currentTarget.blur()} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <label style={{ fontWeight: 500, margin: 0 }}>Distance to Office (miles)</label>
                  {address && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        color: '#2563eb',
                        textDecoration: 'none',
                        cursor: 'pointer',
                      }}
                      title={`View ${address} on map`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 640 640"
                        style={{ width: '16px', height: '16px', fill: 'currentColor' }}
                      >
                        <path d="M576 112C576 103.7 571.7 96 564.7 91.6C557.7 87.2 548.8 86.8 541.4 90.5L416.5 152.1L244 93.4C230.3 88.7 215.3 89.6 202.1 95.7L77.8 154.3C69.4 158.2 64 166.7 64 176L64 528C64 536.2 68.2 543.9 75.1 548.3C82 552.7 90.7 553.2 98.2 549.7L225.5 489.8L396.2 546.7C409.9 551.3 424.7 550.4 437.8 544.2L562.2 485.7C570.6 481.7 576 473.3 576 464L576 112zM208 146.1L208 445.1L112 490.3L112 191.3L208 146.1zM256 449.4L256 148.3L384 191.8L384 492.1L256 449.4zM432 198L528 150.6L528 448.8L432 494L432 198z" />
                      </svg>
                    </a>
                  )}
                </div>
                <input type="number" min={0} step={0.1} value={distanceFromOffice} onChange={(e) => setDistanceFromOffice(e.target.value)} onWheel={(e) => e.currentTarget.blur()} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Last Contact</label>
                <input type="datetime-local" value={lastContact} onChange={(e) => setLastContact(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={saveBidAndOpenCounts}
                  disabled={savingBid}
                  style={{ marginRight: 'auto', padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                >
                  Save and Open Counts
                </button>
                {editingBid && (
                  <button
                    type="button"
                    onClick={() => { setDeleteBidModalOpen(true); setDeleteConfirmProjectName(''); setError(null) }}
                    style={{ marginRight: 'auto', padding: '0.5rem 1rem', color: '#b91c1b', background: 'white', border: '1px solid #b91c1b', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Delete bid
                  </button>
                )}
                <button type="submit" disabled={savingBid} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                  {savingBid ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Customer modal (from GC/Builder in Edit Bid) */}
      {addCustomerModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
          <div style={{ background: 'white', padding: '1rem 2rem 2rem', borderRadius: 8, maxWidth: '500px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <NewCustomerForm
              showQuickFill={false}
              mode="modal"
              onCancel={() => setAddCustomerModalOpen(false)}
              onCreated={(c) => {
                loadCustomers()
                setGcCustomerId(c.id)
                setGcCustomerSearch(getCustomerDisplay(c))
                setAddCustomerModalOpen(false)
              }}
            />
          </div>
        </div>
      )}

      {/* Delete bid confirmation modal */}
      {deleteBidModalOpen && editingBid && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>Delete bid</h2>
            <p style={{ marginBottom: '1rem' }}>
              {editingBid.project_name
                ? <>Type the project name <strong>{editingBid.project_name}</strong> to confirm.</>
                : 'This bid has no project name; leave the field empty to confirm.'}
            </p>
            <input
              type="text"
              value={deleteConfirmProjectName}
              onChange={(e) => { setDeleteConfirmProjectName(e.target.value); setError(null) }}
              placeholder={editingBid.project_name ? 'Project name' : 'No project name'}
              disabled={deletingBid}
              style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem', border: '1px solid #d1d5db', borderRadius: 4 }}
              autoComplete="off"
            />
            {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={deleteBid}
                disabled={deletingBid || deleteConfirmProjectName.trim() !== (editingBid.project_name ?? '').trim()}
                style={{ padding: '0.5rem 1rem', color: '#b91c1c', background: 'white', border: '1px solid #b91c1c', borderRadius: 4, cursor: deletingBid || deleteConfirmProjectName.trim() !== (editingBid.project_name ?? '').trim() ? 'not-allowed' : 'pointer' }}
              >
                {deletingBid ? 'Deleting…' : 'Delete bid'}
              </button>
              <button
                type="button"
                onClick={() => { setDeleteBidModalOpen(false); setDeleteConfirmProjectName(''); setError(null) }}
                disabled={deletingBid}
                style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: deletingBid ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes quick-edit modal */}
      {notesModalBid && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: 8, maxWidth: '500px', width: '90%' }}>
            <h2 style={{ marginBottom: '1rem' }}>Notes – {bidDisplayName(notesModalBid) || 'Bid'}</h2>
            <textarea
              value={notesModalText}
              onChange={(e) => setNotesModalText(e.target.value)}
              placeholder="Add or edit notes…"
              rows={6}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, resize: 'vertical', boxSizing: 'border-box' }}
              autoFocus
            />
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setNotesModalBid(null)}
                style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveNotesModal}
                disabled={savingNotes}
                style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                {savingNotes ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GC/Builder view modal (customer) */}
      {viewingCustomer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: 8, maxWidth: '500px', width: '90%' }}>
            <h2 style={{ marginBottom: '1rem' }}>{viewingCustomer.name}</h2>
            <p style={{ margin: '0.25rem 0' }}><strong>Address:</strong> {viewingCustomer.address || '—'}</p>
            {(() => {
              const contact = extractContactInfo(viewingCustomer.contact_info)
              return (
                <>
                  {contact.phone && <p style={{ margin: '0.25rem 0' }}><strong>Phone:</strong> {contact.phone}</p>}
                  {contact.email && <p style={{ margin: '0.25rem 0' }}><strong>Email:</strong> {contact.email}</p>}
                </>
              )
            })()}
            <p style={{ margin: '0.25rem 0' }}><strong>Won bids:</strong> {wonBidsForCustomer.length}</p>
            {wonBidsForCustomer.length > 0 && (
              <ul style={{ margin: '0.25rem 0 1rem 1.5rem', padding: 0 }}>
                {wonBidsForCustomer.map((b) => (
                  <li key={b.id}>{bidDisplayName(b) || b.id}</li>
                ))}
              </ul>
            )}
            <p style={{ margin: '0.25rem 0' }}><strong>Lost bids:</strong> {lostBidsForCustomer.length}</p>
            {lostBidsForCustomer.length > 0 && (
              <ul style={{ margin: '0.25rem 0 1rem 1.5rem', padding: 0 }}>
                {lostBidsForCustomer.map((b) => (
                  <li key={b.id}>{bidDisplayName(b) || b.id}</li>
                ))}
              </ul>
            )}
            <p style={{ margin: '1rem 0 0.5rem', fontWeight: 600 }}>All bids</p>
            <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Bid / Project</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...allBidsForCustomer]
                    .sort((a, b) => {
                      const order = (bid: BidWithBuilder) => (!bid.bid_date_sent ? 0 : bid.outcome === 'won' ? 1 : bid.outcome === 'started_or_complete' ? 2 : bid.outcome === 'lost' ? 3 : 4)
                      const o = order(a) - order(b)
                      if (o !== 0) return o
                      return (a.bid_due_date ?? '').localeCompare(b.bid_due_date ?? '')
                    })
                    .map((b) => (
                      <tr key={b.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{bidDisplayName(b) || b.id}</td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{getBidStatusLabel(b)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={() => setViewingCustomer(null)} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* GC/Builder view modal (legacy bids_gc_builders) */}
      {viewingGcBuilder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: 8, maxWidth: '500px', width: '90%' }}>
            <h2 style={{ marginBottom: '1rem' }}>{viewingGcBuilder.name}</h2>
            <p style={{ margin: '0.25rem 0' }}><strong>Address:</strong> {viewingGcBuilder.address || '—'}</p>
            <p style={{ margin: '0.25rem 0' }}><strong>Contact number:</strong> {viewingGcBuilder.contact_number || '—'}</p>
            <p style={{ margin: '0.25rem 0' }}><strong>Won bids:</strong> {wonBidsForBuilder.length}</p>
            {wonBidsForBuilder.length > 0 && (
              <ul style={{ margin: '0.25rem 0 1rem 1.5rem', padding: 0 }}>
                {wonBidsForBuilder.map((b) => (
                  <li key={b.id}>{bidDisplayName(b) || b.id}</li>
                ))}
              </ul>
            )}
            <p style={{ margin: '0.25rem 0' }}><strong>Lost bids:</strong> {lostBidsForBuilder.length}</p>
            {lostBidsForBuilder.length > 0 && (
              <ul style={{ margin: '0.25rem 0 1rem 1.5rem', padding: 0 }}>
                {lostBidsForBuilder.map((b) => (
                  <li key={b.id}>{bidDisplayName(b) || b.id}</li>
                ))}
              </ul>
            )}
            <p style={{ margin: '1rem 0 0.5rem', fontWeight: 600 }}>All bids</p>
            <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Bid / Project</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...allBidsForBuilder]
                    .sort((a, b) => {
                      const order = (bid: BidWithBuilder) => (!bid.bid_date_sent ? 0 : bid.outcome === 'won' ? 1 : bid.outcome === 'started_or_complete' ? 2 : bid.outcome === 'lost' ? 3 : 4)
                      const o = order(a) - order(b)
                      if (o !== 0) return o
                      return (a.bid_due_date ?? '').localeCompare(b.bid_due_date ?? '')
                    })
                    .map((b) => (
                      <tr key={b.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{bidDisplayName(b) || b.id}</td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{getBidStatusLabel(b)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={() => setViewingGcBuilder(null)} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Checklist modal */}
      {evaluateModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: 8,
              maxWidth: 700,
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Evaluate Bids Checklist</h2>
              <button
                type="button"
                onClick={() => { setEvaluateModalOpen(false); setEvaluateChecked({}) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {evaluateChecklist.map((item) => (
                <div key={item.id} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '0.75rem 1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={!!evaluateChecked[item.id]}
                      onChange={(e) =>
                        setEvaluateChecked((prev) => ({ ...prev, [item.id]: e.target.checked }))
                      }
                    />
                    <span>{item.title}</span>
                  </label>
                  {item.body.map((line, idx) => (
                    <p key={idx} style={{ margin: '0.125rem 0', fontSize: '0.9rem' }}>{line}</p>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ marginTop: '0.75rem', textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => { setEvaluateModalOpen(false); setEvaluateChecked({}) }}
                style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sent Bid Script modal */}
      {showSentBidScript && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, maxWidth: 600, width: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Sent Bid Script</h3>
              <button
                type="button"
                onClick={() => setShowSentBidScript(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            <div style={{ fontFamily: 'inherit', fontSize: '0.95rem', lineHeight: 1.6, margin: 0 }}>
              {[
                'This is [Master] from Click Plumbing and Electrical',
                'We just sent you our bid for [project name] [time since sent] from my email [your email]',
                'I wanted to make sure you received our email for your proposed work',
                'Is there else you need from me?',
                'If not I wanted to make myself available if you have any questions',
                "and if you know if there is a price point that we're above or below you would like to meet for your project",
              ].map((line, i) => (
                <div key={i} style={{ marginBottom: '0.5rem' }}>{i + 1}) {line}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bid Question Script modal */}
      {showBidQuestionScript && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, maxWidth: 600, width: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Bid Question Script</h3>
              <button
                type="button"
                onClick={() => setShowBidQuestionScript(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.95rem', lineHeight: 1.5, margin: 0 }}>
We saw some structural issues with your plans and I wanted to get clarity...
            </pre>
          </div>
        </div>
      )}

      {/* Part Form Modal */}
      <PartFormModal
        isOpen={bidsPartFormOpen}
        onClose={() => setBidsPartFormOpen(false)}
        onSave={handleBidsPartCreated}
        editingPart={null}
        initialName={bidsPartFormInitialName}
        selectedServiceTypeId={selectedServiceTypeId}
        supplyHouses={supplyHouses}
        partTypes={partTypes}
        serviceTypes={serviceTypes}
      />

      {/* Add Parts to Template Modal */}
      {addPartsToTemplateModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={closeAddPartsToTemplateModal}
        >
          <div
            style={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: 8,
              maxWidth: 500,
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Add Parts to {addPartsToTemplateName}</h3>
              <button
                type="button"
                onClick={closeAddPartsToTemplateModal}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}
              >
                ×
              </button>
            </div>

            {error && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: 4, fontSize: '0.875rem' }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Select Part *</label>
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={addPartsSelectedPartId ? (takeoffAddTemplateParts.find((p) => p.id === addPartsSelectedPartId)?.name ?? '') : addPartsSearchQuery}
                    onChange={(e) => setAddPartsSearchQuery(e.target.value)}
                    onFocus={() => setAddPartsDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setAddPartsDropdownOpen(false), 150)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setAddPartsDropdownOpen(false) }}
                    readOnly={!!addPartsSelectedPartId}
                    placeholder="Search parts by name, manufacturer, type, or notes…"
                    style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: addPartsSelectedPartId ? '#f3f4f6' : undefined }}
                  />
                  {addPartsSelectedPartId && (
                    <button
                      type="button"
                      onClick={() => {
                        setAddPartsSelectedPartId('')
                        setAddPartsSearchQuery('')
                        setAddPartsDropdownOpen(true)
                      }}
                      style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                {addPartsDropdownOpen && (
                  <ul style={{ position: 'absolute', left: 0, right: 0, top: '100%', margin: 0, marginTop: 2, padding: 0, listStyle: 'none', maxHeight: 200, overflowY: 'auto', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', zIndex: 60, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                    {takeoffAddTemplateParts.length === 0 ? (
                      <li style={{ padding: '0.75rem', color: '#6b7280' }}>Loading parts…</li>
                    ) : filterPartsByQuery(takeoffAddTemplateParts, addPartsSearchQuery).length === 0 ? (
                      <li style={{ padding: '0.75rem', color: '#6b7280' }}>
                        No parts match.{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setBidsPartFormInitialName(addPartsSearchQuery.trim())
                            setBidsPartFormOpen(true)
                            setAddPartsDropdownOpen(false)
                          }}
                          style={{ marginLeft: '0.25rem', padding: '0.25rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
                        >
                          Add Part
                        </button>
                      </li>
                    ) : (
                      filterPartsByQuery(takeoffAddTemplateParts, addPartsSearchQuery).map((p) => (
                        <li
                          key={p.id}
                          onClick={() => {
                            setAddPartsSelectedPartId(p.id)
                            setAddPartsSearchQuery('')
                            setAddPartsDropdownOpen(false)
                          }}
                          style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                          onMouseEnter={(e) => ((e.target as HTMLElement).style.background = '#f9fafb')}
                          onMouseLeave={(e) => ((e.target as HTMLElement).style.background = 'transparent')}
                        >
                          <div style={{ fontWeight: 500 }}>{p.name}</div>
                          {p.manufacturer && <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{p.manufacturer}</div>}
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Quantity *</label>
              <input
                type="number"
                min="1"
                value={addPartsQuantity}
                onChange={(e) => setAddPartsQuantity(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={closeAddPartsToTemplateModal}
                style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={savePartsToTemplate}
                disabled={!addPartsSelectedPartId || savingTemplateParts}
                style={{
                  padding: '0.5rem 1rem',
                  background: addPartsSelectedPartId && !savingTemplateParts ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: addPartsSelectedPartId && !savingTemplateParts ? 'pointer' : 'not-allowed'
                }}
              >
                {savingTemplateParts ? 'Adding...' : 'Add to Assembly'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Template Modal */}
      {editTemplateModalOpen && editTemplateModalId && editTemplateModalName && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
          }}
          onClick={closeEditTemplateModal}
        >
          <div
            style={{
              background: 'white',
              padding: '2rem',
              borderRadius: 8,
              maxWidth: 560,
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Edit Assembly: {editTemplateModalName}</h3>
              <button type="button" onClick={closeEditTemplateModal} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
            </div>

            {error && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: 4, fontSize: '0.875rem' }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>Existing items</div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ background: '#f9fafb' }}>
                    <tr>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Type</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Name</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Qty</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {editTemplateItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '1rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>No items yet. Add parts or nested templates below.</td>
                      </tr>
                    ) : (
                      editTemplateItems.map((item) => {
                        const name = item.item_type === 'part' && item.part_id
                          ? (takeoffAddTemplateParts.find((p) => p.id === item.part_id)?.name ?? '—')
                          : item.item_type === 'template' && item.nested_template_id
                            ? (materialTemplates.find((t) => t.id === item.nested_template_id)?.name ?? '—')
                            : '—'
                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{item.item_type === 'part' ? 'Part' : 'Assembly'}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{name}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{item.quantity}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              <button
                                type="button"
                                onClick={() => removeEditTemplateItem(item.id)}
                                style={{ padding: '0.25rem 0.5rem', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>Add item</div>
              <div style={{ padding: '0.75rem', background: '#f9fafb', borderRadius: 4 }}>
                <select
                  value={editTemplateNewItemType}
                  onChange={(e) => setEditTemplateNewItemType(e.target.value as 'part' | 'template')}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '0.5rem' }}
                >
                  <option value="part">Part</option>
                  <option value="template">Nested Template</option>
                </select>
                {editTemplateNewItemType === 'part' ? (
                  <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={editTemplateNewItemPartId ? (takeoffAddTemplateParts.find((p) => p.id === editTemplateNewItemPartId)?.name ?? '') : editTemplateNewItemPartSearchQuery}
                        onChange={(e) => setEditTemplateNewItemPartSearchQuery(e.target.value)}
                        onFocus={() => setEditTemplateNewItemPartDropdownOpen(true)}
                        onBlur={() => setTimeout(() => setEditTemplateNewItemPartDropdownOpen(false), 150)}
                        onKeyDown={(e) => { if (e.key === 'Escape') setEditTemplateNewItemPartDropdownOpen(false) }}
                        readOnly={!!editTemplateNewItemPartId}
                        placeholder="Search parts by name, manufacturer, type, or notes…"
                        style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: editTemplateNewItemPartId ? '#f3f4f6' : undefined }}
                      />
                      {editTemplateNewItemPartId && (
                        <button type="button" onClick={() => { setEditTemplateNewItemPartId(''); setEditTemplateNewItemPartSearchQuery(''); setEditTemplateNewItemPartDropdownOpen(true) }} style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>Clear</button>
                      )}
                    </div>
                    {editTemplateNewItemPartDropdownOpen && (
                      <ul style={{ position: 'absolute', left: 0, right: 0, top: '100%', margin: 0, marginTop: 2, padding: 0, listStyle: 'none', maxHeight: 200, overflowY: 'auto', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', zIndex: 60, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                        {takeoffAddTemplateParts.length === 0 ? <li style={{ padding: '0.75rem', color: '#6b7280' }}>Loading parts…</li> : filterPartsByQuery(takeoffAddTemplateParts, editTemplateNewItemPartSearchQuery).length === 0 ? <li style={{ padding: '0.75rem', color: '#6b7280' }}>No parts match.{' '}<button type="button" onClick={() => { setBidsPartFormInitialName(editTemplateNewItemPartSearchQuery.trim()); setBidsPartFormOpen(true); setEditTemplateNewItemPartDropdownOpen(false) }} style={{ marginLeft: '0.25rem', padding: '0.25rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}>Add Part</button></li> : filterPartsByQuery(takeoffAddTemplateParts, editTemplateNewItemPartSearchQuery).map((p) => (<li key={p.id} onClick={() => { setEditTemplateNewItemPartId(p.id); setEditTemplateNewItemPartSearchQuery(''); setEditTemplateNewItemPartDropdownOpen(false) }} style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}><div style={{ fontWeight: 500 }}>{p.name}</div>{(p.manufacturer || p.part_types?.name) && <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{[p.manufacturer, p.part_types?.name].filter(Boolean).join(' · ')}</div>}</li>))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={editTemplateNewItemTemplateId ? (materialTemplates.find((t) => t.id === editTemplateNewItemTemplateId)?.name ?? '') : editTemplateNewItemTemplateSearchQuery}
                        onChange={(e) => setEditTemplateNewItemTemplateSearchQuery(e.target.value)}
                        onFocus={() => setEditTemplateNewItemTemplateDropdownOpen(true)}
                        onBlur={() => setTimeout(() => setEditTemplateNewItemTemplateDropdownOpen(false), 150)}
                        onKeyDown={(e) => { if (e.key === 'Escape') setEditTemplateNewItemTemplateDropdownOpen(false) }}
                        readOnly={!!editTemplateNewItemTemplateId}
                        placeholder="Search assemblies by name or description…"
                        style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: editTemplateNewItemTemplateId ? '#f3f4f6' : undefined }}
                      />
                      {editTemplateNewItemTemplateId && (
                        <button type="button" onClick={() => { setEditTemplateNewItemTemplateId(''); setEditTemplateNewItemTemplateSearchQuery(''); setEditTemplateNewItemTemplateDropdownOpen(true) }} style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>Clear</button>
                      )}
                    </div>
                    {editTemplateNewItemTemplateDropdownOpen && (
                      <ul style={{ position: 'absolute', left: 0, right: 0, top: '100%', margin: 0, marginTop: 2, padding: 0, listStyle: 'none', maxHeight: 200, overflowY: 'auto', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', zIndex: 60, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                        {filterTemplatesByQuery(materialTemplates.filter((t) => t.id !== editTemplateModalId), editTemplateNewItemTemplateSearchQuery, 50).length === 0 ? <li style={{ padding: '0.75rem', color: '#6b7280' }}>No assemblies match.</li> : filterTemplatesByQuery(materialTemplates.filter((t) => t.id !== editTemplateModalId), editTemplateNewItemTemplateSearchQuery, 50).map((t) => (<li key={t.id} onClick={() => { setEditTemplateNewItemTemplateId(t.id); setEditTemplateNewItemTemplateSearchQuery(''); setEditTemplateNewItemTemplateDropdownOpen(false) }} style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}><div style={{ fontWeight: 500 }}>{t.name}</div>{t.description && <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{t.description}</div>}</li>))}
                      </ul>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input type="number" min={1} value={editTemplateNewItemQuantity} onChange={(e) => setEditTemplateNewItemQuantity(e.target.value)} style={{ width: 80, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                  <button type="button" onClick={addEditTemplateItem} disabled={editTemplateAddingItem || (editTemplateNewItemType === 'part' && !editTemplateNewItemPartId) || (editTemplateNewItemType === 'template' && !editTemplateNewItemTemplateId)} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{editTemplateAddingItem ? 'Adding…' : 'Add item'}</button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={closeEditTemplateModal} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CountRow({ row, onUpdate, onDelete }: { row: BidCountRow; onUpdate: () => void; onDelete: () => void }) {
  const [fixture, setFixture] = useState(row.fixture ?? '')
  const [count, setCount] = useState(String(row.count))
  const [page, setPage] = useState(row.page ?? '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const num = parseFloat(count)
    if (isNaN(num)) { setSaving(false); return }
    const { error } = await supabase.from('bids_count_rows').update({ fixture: fixture.trim(), count: num, page: page.trim() || null }).eq('id', row.id)
    if (error) { setSaving(false); return }
    setEditing(false)
    onUpdate()
    setSaving(false)
  }

  async function remove() {
    if (!confirm('Remove this row?')) return
    await supabase.from('bids_count_rows').delete().eq('id', row.id)
    onDelete()
  }

  if (editing) {
    return (
      <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
        <td style={{ padding: '0.75rem' }}>
          <input type="number" step="any" value={count} onChange={(e) => setCount(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
        </td>
        <td style={{ padding: '0.75rem' }}>
          <input type="text" value={fixture} onChange={(e) => setFixture(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
        </td>
        <td style={{ padding: '0.75rem' }}>
          <input type="text" value={page} onChange={(e) => setPage(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
        </td>
        <td style={{ padding: '0.75rem' }}>
          <button type="button" onClick={save} disabled={saving} style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Save</button>
          <button type="button" onClick={() => setEditing(false)} style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
        </td>
      </tr>
    )
  }
  return (
    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
      <td style={{ padding: '0.75rem' }}>{row.count}</td>
      <td style={{ padding: '0.75rem' }}>{row.fixture ?? ''}</td>
      <td style={{ padding: '0.75rem' }}>{row.page ?? '—'}</td>
      <td style={{ padding: '0.75rem' }}>
        <button type="button" onClick={() => setEditing(true)} style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Edit</button>
        <button type="button" onClick={remove} style={{ padding: '0.25rem 0.5rem', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer' }}>Delete</button>
      </td>
    </tr>
  )
}

function NewCountRow({ bidId, serviceTypeId, onSaved, onCancel, onSavedAndAddAnother }: { bidId: string; serviceTypeId?: string; onSaved: () => void; onCancel: () => void; onSavedAndAddAnother?: () => void }) {
  const [fixture, setFixture] = useState('')
  const [count, setCount] = useState('')
  const [page, setPage] = useState('')
  const [saving, setSaving] = useState(false)
  const [countsFixtureGroups, setCountsFixtureGroups] = useState<Array<{ label: string; fixtures: string[] }>>([])

  useEffect(() => {
    if (!serviceTypeId) {
      setCountsFixtureGroups([])
      return
    }
    const stId = serviceTypeId
    let cancelled = false
    async function load() {
      const { data: groupsData } = await supabase
        .from('counts_fixture_groups')
        .select('id, label, sequence_order')
        .eq('service_type_id', stId)
        .order('sequence_order', { ascending: true })
      if (cancelled || !groupsData?.length) {
        if (!cancelled) setCountsFixtureGroups([])
        return
      }
      const groupIds = (groupsData as { id: string }[]).map((g) => g.id)
      const { data: itemsData } = await supabase
        .from('counts_fixture_group_items')
        .select('group_id, name, sequence_order')
        .in('group_id', groupIds)
        .order('sequence_order', { ascending: true })
      if (cancelled) return
      const groups = (groupsData as { id: string; label: string; sequence_order: number }[]).map((g) => ({
        label: g.label,
        fixtures: ((itemsData as { group_id: string; name: string }[]) ?? [])
          .filter((i) => i.group_id === g.id)
          .map((i) => i.name),
      }))
      setCountsFixtureGroups(groups)
    }
    void load()
    return () => { cancelled = true }
  }, [serviceTypeId])

  async function submit() {
    const num = parseFloat(count)
    if (isNaN(num) || !fixture.trim()) return
    setSaving(true)
    const { error } = await supabase.from('bids_count_rows').insert({ bid_id: bidId, fixture: fixture.trim(), count: num, page: page.trim() || null })
    if (error) { setSaving(false); return }
    onSaved()
  }

  async function submitAndAdd() {
    const num = parseFloat(count)
    if (isNaN(num) || !fixture.trim()) return
    setSaving(true)
    const { error } = await supabase.from('bids_count_rows').insert({ bid_id: bidId, fixture: fixture.trim(), count: num, page: page.trim() || null })
    if (error) { setSaving(false); return }
    setFixture('')
    setCount('')
    setPage('')
    setSaving(false)
    onSavedAndAddAnother?.()
  }

  return (
    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
      <td colSpan={3} style={{ padding: '0.75rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input type="number" step="any" value={count} onChange={(e) => setCount(e.target.value)} placeholder="Count*" style={{ flex: 1, minWidth: 80, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
            <input type="text" value={fixture} onChange={(e) => setFixture(e.target.value)} placeholder="Fixture or Tie-in*" style={{ flex: 1, minWidth: 120, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
            <input type="text" value={page} onChange={(e) => setPage(e.target.value)} placeholder="Plan Page" style={{ flex: 1, minWidth: 100, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {countsFixtureGroups.map((group) => (
              <div key={group.label} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500, marginRight: '0.25rem', flexShrink: 0 }}>{group.label}</span>
                {group.fixtures.map((name) => (
                  <button key={name} type="button" onClick={() => setFixture(name)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>{name}</button>
                ))}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.25rem', maxWidth: 160 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                <button key={d} type="button" onClick={() => setCount((c) => c + String(d))} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>{d}</button>
              ))}
              <button type="button" onClick={() => setCount('')} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }} title="All clear">C</button>
              <button type="button" onClick={() => setCount((c) => c + '0')} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>0</button>
              <button type="button" onClick={() => setCount((c) => c.slice(0, -1))} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }} title="Delete">⌫</button>
            </div>
          </div>
        </div>
      </td>
      <td style={{ padding: '0.75rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button type="button" onClick={submit} disabled={saving || !fixture.trim() || isNaN(parseFloat(count))} style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Save</button>
            <button type="button" onClick={onCancel} style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
          </div>
          <button type="button" onClick={submitAndAdd} disabled={saving || !fixture.trim() || isNaN(parseFloat(count))} style={{ padding: '0.25rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', alignSelf: 'center' }}>Save and Add</button>
        </div>
      </td>
    </tr>
  )
}

function SubmissionEntryRow({ entry, onUpdate, onDelete }: { entry: BidSubmissionEntry; onUpdate: () => void; onDelete: () => void }) {
  const [contactMethod, setContactMethod] = useState(entry.contact_method ?? '')
  const [notes, setNotes] = useState(entry.notes ?? '')
  const [occurredAt, setOccurredAt] = useState(entry.occurred_at ? entry.occurred_at.slice(0, 16) : '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const occurredAtIso = occurredAt ? new Date(occurredAt).toISOString() : entry.occurred_at
    const { error } = await supabase
      .from('bids_submission_entries')
      .update({ contact_method: contactMethod.trim() || null, notes: notes.trim() || null, occurred_at: occurredAtIso })
      .eq('id', entry.id)
    if (error) { setSaving(false); return }
    if (occurredAtIso && entry.bid_id) {
      await supabase.from('bids').update({ last_contact: occurredAtIso }).eq('id', entry.bid_id)
    }
    setEditing(false)
    onUpdate()
    setSaving(false)
  }

  async function remove() {
    if (!confirm('Remove this entry?')) return
    await supabase.from('bids_submission_entries').delete().eq('id', entry.id)
    onDelete()
  }

  if (editing) {
    return (
      <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
        <td style={{ padding: '0.75rem' }}>
          <input type="text" value={contactMethod} onChange={(e) => setContactMethod(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
        </td>
        <td style={{ padding: '0.75rem' }}>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
        </td>
        <td style={{ padding: '0.75rem' }}>
          <input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
        </td>
        <td style={{ padding: '0.75rem' }}>
          <button type="button" onClick={save} disabled={saving} style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Save</button>
          <button type="button" onClick={() => setEditing(false)} style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
        </td>
      </tr>
    )
  }
  return (
    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
      <td style={{ padding: '0.75rem' }}>{entry.contact_method ?? '—'}</td>
      <td style={{ padding: '0.75rem' }}>{entry.notes ?? '—'}</td>
      <td style={{ padding: '0.75rem' }}>{entry.occurred_at ? new Date(entry.occurred_at).toLocaleString() : '—'}</td>
      <td style={{ padding: '0.75rem' }}>
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Edit"
          style={{ marginRight: '0.5rem', padding: '0.25rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={remove}
          title="Delete"
          style={{ padding: '0.25rem', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z" />
          </svg>
        </button>
      </td>
    </tr>
  )
}

function NewSubmissionEntryRow({ bidId, onSaved, onCancel }: { bidId: string; onSaved: () => void; onCancel: () => void }) {
  const [contactMethod, setContactMethod] = useState('')
  const [notes, setNotes] = useState('')
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    const occurredAtIso = new Date(occurredAt).toISOString()
    const { error } = await supabase.from('bids_submission_entries').insert({
      bid_id: bidId,
      contact_method: contactMethod.trim() || null,
      notes: notes.trim() || null,
      occurred_at: occurredAtIso,
    })
    if (error) { setSaving(false); return }
    await supabase.from('bids').update({ last_contact: occurredAtIso }).eq('id', bidId)
    onSaved()
  }

  return (
    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
      <td style={{ padding: '0.75rem' }}>
        <input type="text" value={contactMethod} onChange={(e) => setContactMethod(e.target.value)} placeholder="Contact method" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
      </td>
      <td style={{ padding: '0.75rem' }}>
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
      </td>
      <td style={{ padding: '0.75rem' }}>
        <input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
      </td>
      <td style={{ padding: '0.75rem' }}>
        <button type="button" onClick={submit} disabled={saving} style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Add</button>
        <button type="button" onClick={onCancel} style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
      </td>
    </tr>
  )
}
