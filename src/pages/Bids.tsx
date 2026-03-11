import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { openInExternalBrowser } from '../lib/openInExternalBrowser'
import { addExpandedPartsToPO, expandTemplate, getTemplatePartsPreview } from '../lib/materialPOUtils'
import { useAuth } from '../hooks/useAuth'
import { useToastContext } from '../contexts/ToastContext'
import { useNewCustomerModal } from '../contexts/NewCustomerModalContext'
import { useEditCustomerModal } from '../contexts/EditCustomerModalContext'
import { PartFormModal } from '../components/PartFormModal'
import { Database } from '../types/database'
import type { Json } from '../types/database'

type GcBuilder = Database['public']['Tables']['bids_gc_builders']['Row']
type Customer = Database['public']['Tables']['customers']['Row']
type Bid = Database['public']['Tables']['bids']['Row']
type BidCountRow = Database['public']['Tables']['bids_count_rows']['Row']
type BidSubmissionEntry = Database['public']['Tables']['bids_submission_entries']['Row']
type CustomerContact = Database['public']['Tables']['customer_contacts']['Row']
type CustomerContactPerson = Database['public']['Tables']['customer_contact_persons']['Row']
type MaterialTemplate = Database['public']['Tables']['material_templates']['Row']
type MaterialPart = Database['public']['Tables']['material_parts']['Row']
type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']
type CostEstimate = Database['public']['Tables']['cost_estimates']['Row']
type CostEstimateLaborRow = Database['public']['Tables']['cost_estimate_labor_rows']['Row']
type FixtureLaborDefault = Database['public']['Tables']['fixture_labor_defaults']['Row']
type PriceBookVersion = Database['public']['Tables']['price_book_versions']['Row']
type PriceBookEntry = Database['public']['Tables']['price_book_entries']['Row']
type BidPricingAssignment = Database['public']['Tables']['bid_pricing_assignments']['Row']
type BidCountRowCustomPrice = Database['public']['Tables']['bid_count_row_custom_prices']['Row']
type LaborBookVersion = Database['public']['Tables']['labor_book_versions']['Row']
type LaborBookEntry = Database['public']['Tables']['labor_book_entries']['Row']
type TakeoffBookVersion = Database['public']['Tables']['takeoff_book_versions']['Row']
type TakeoffBookEntry = Database['public']['Tables']['takeoff_book_entries']['Row']
type TakeoffBookEntryItem = Database['public']['Tables']['takeoff_book_entry_items']['Row']
type TakeoffBookEntryWithItems = TakeoffBookEntry & { items: TakeoffBookEntryItem[] }
type UserRole = 'dev' | 'master_technician' | 'assistant' | 'estimator' | 'primary'
type OutcomeOption = 'won' | 'lost' | 'started_or_complete' | ''

type RfiFormData = {
  bidSubmittedDate: string
  submittedTo: string
  companyName: string
  contactPerson: string
  phoneEmail: string
  responseRequestDate: string
  detailedDescription: string
  impactStatement: string
  checklistExactLocation?: boolean
  checklistWhatIssue?: boolean
  checklistReferenceDocs?: boolean
  checklistWhyUnclear?: boolean
  checklistProposedSolution?: boolean
  checklistImpactStatement?: boolean
}

type ChangeOrderFormData = {
  bidSubmittedDate: string
  submittedTo: string
  companyName: string
  contactPerson: string
  phoneEmail: string
  responseRequestDate: string
  detailedDescriptionOfChange: string
  reasonForChange: string
  impactOnCost: string
  impactOnSchedule: string
  checklistDetailedDesc?: boolean
  checklistExactWork?: boolean
  checklistReferences?: boolean
  checklistSupportingDetails?: boolean
  checklistReasonForChange?: boolean
  checklistCostBreakdown?: boolean
  checklistNetChange?: boolean
  checklistUpdatedTotal?: boolean
  checklistScheduleDuration?: boolean
  checklistRevisedDate?: boolean
  checklistScheduleJustification?: boolean
}

type LienReleaseFormData = {
  invoiceAmount: string
  bidAmount: string
  invoicesToDate: string
  cc: string
  companyName: string
  companyAddress: string
  companyPhone: string
  companyEmail: string
  invoiceDate: string
  invoiceNumber: string
  descriptionOfWork: string
  conditionalWaiver: string
  paymentTerms: string
  lienStatusPhone: string
}

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
  padding: '0.5rem 0.6rem',
  border: 'none',
  background: 'none',
  borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
  color: active ? '#3b82f6' : '#6b7280',
  fontWeight: active ? 600 : 400,
  cursor: 'pointer' as const,
  fontSize: '0.9375rem',
})

const HIGHLIGHTED_TABS = ['counts', 'pricing', 'cover-letter'] as const
const SAFETY_ORANGE = '#FF6600' // ANSI/OSHA safety orange

function bidsTabStyle(active: boolean, tabId: string) {
  const base = tabStyle(active)
  if (HIGHLIGHTED_TABS.includes(tabId as (typeof HIGHLIGHTED_TABS)[number])) {
    return { ...base, fontWeight: 600, color: SAFETY_ORANGE, borderBottom: active ? '2px solid #FF6600' : '2px solid transparent' }
  }
  return base
}

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
  return `${m}/${day}/${String(y).padStart(2, '0')}`
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
  'All work to be completed in a workmanlike manner in accordance with uniform code and/or specifications; workmanship warranty of one year for new construction projects considering substantial completion date. All material is guaranteed to be as specified; warranty by manufacturer, labor not included. No liability, no warranty on customer provided materials. All agreements contingent upon strikes, accidents or delays beyond our control. This estimate is subject to acceptance within thirty (30) days and is void thereafter at the option of Click Plumbing and Electrical. Any alteration or deviation from above specifications involving extra cost, including rock excavation and removal or haul-off of spoils or debris will become an extra charge over and above the estimate.'

const DEFAULT_EXCLUSIONS = `Concrete cutting, removal, and/or pour back is excluded from this proposal.
This proposal excludes all impact fees.
This proposal excludes any work not specifically described within.
This proposal excludes any electrical, fire protection, fire alarm, drywall, framing, or architectural finishes of any type.`

const DEFAULT_INCLUSIONS = 'Permits'

const LIEN_RELEASE_DEFAULT_COMPANY_ADDRESS = '5501 Balcones Dr Ste A141, Austin, Texas 78731'
const LIEN_RELEASE_DEFAULT_LIEN_PHONE = '+1 512 360 0599'
const LIEN_RELEASE_DEFAULT_COMPANY_PHONE = '+1 512 360 0599'
const LIEN_RELEASE_DEFAULT_COMPANY_EMAIL = 'office@clickplumbing.com'
const LIEN_RELEASE_DEFAULT_CONDITIONAL_WAIVER = 'CONDITIONAL WAIVER AND RELEASE ONLY upon receipt and collection of good funds in the amount of ${{finalInvoice}} payable to Click Plumbing and Electrical, the undersigned hereby waives and releases any and all mechanic\'s lien rights, payment bond claims, or claims against the project or property described above that have arisen or may arise through the date of this invoice.\n\nThis waiver and release is expressly conditional and shall be void and of no effect if the ${{invoicesToDate}} payment is not actually received and collected in full. Click Plumbing and Electrical expressly reserves all lien, bond, and contract rights until payment is received and clears.'
const LIEN_RELEASE_DEFAULT_PAYMENT_TERMS = 'Payment of ${{finalInvoice}} is due immediately upon receipt of this invoice. Pursuant to Texas Property Code Chapter 28 (Prompt Payment Act), if payment in full is not received within 45 days of the invoice date, interest shall accrue at the rate of one and one-half percent (1.5%) per month (18% per annum) on the unpaid balance beginning on day 46, and {{ownerName}} shall also be liable for all reasonable attorney\'s fees, collection costs, and court costs incurred by Click Plumbing and Electrical to collect the overdue amount.'

/** Parse amount string and return formatted currency (e.g. "17242.50" -> "17,242.50") */
function formatAmountFromString(s: string): string {
  const n = parseFloat(String(s).replace(/,/g, ''))
  return isNaN(n) ? '' : formatCurrency(n)
}

/** Service-type word for cover letter (plumbing/electrical/HVAC). "Click Plumbing and Electrical" is never changed. */
function serviceTypeWordForCoverLetter(serviceTypeName: string): string {
  const name = (serviceTypeName ?? 'Plumbing').toLowerCase()
  if (name === 'electrical') return 'electrical'
  if (name === 'hvac') return 'HVAC'
  return 'plumbing'
}

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
  designDrawingPlanDateFormatted: string | null,
  serviceTypeName: string,
  includeSignature = true,
  includeFixturesPerPlan = true
): string {
  const inclusionIndent = '     ' // 5 preceding spaces for Additional Inclusions (same as fixture header)
  const inclusionLines = inclusions.trim().split(/\n/).filter(Boolean).map((l) => inclusionIndent + '• ' + l.trim())
  const inclusionLinesToUse = inclusions.trim() ? inclusionLines : []
  const exclusionIndent = '     ' // 5 preceding spaces for Exclusions
  const exclusionLines = exclusions.trim().split(/\n/).filter(Boolean).map((l) => exclusionIndent + '• ' + l.trim())
  const termsLines = terms.trim().split(/\n/).filter(Boolean).map((l) => '• ' + l.trim())
  const fixtureBlock =
    fixtureRows.length > 0 && includeFixturesPerPlan
      ? '     • Fixtures provided and installed by us per plan:\n            ' + fixtureRows.map((r) => '• [' + r.count + '] ' + r.fixture).join('\n            ')
      : ''
  const inclusionsBlock = [fixtureBlock, ...inclusionLinesToUse].filter(Boolean).join('\n')
  const amountBold = `${revenueWords} (${revenueNumber})`
  const stWord = serviceTypeWordForCoverLetter(serviceTypeName)
  const revenueLinePrefix = `As per ${stWord} plans and specifications, we propose to do the ${stWord} in the amount of: `
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
  paragraphs.push(escapeHtml('No work shall commence until Click Plumbing and Electrical has received acceptance of the estimate.'))
  paragraphs.push(escapeHtml('Respectfully submitted by Click Plumbing and Electrical'))
  paragraphs.push('')
  if (includeSignature) {
    paragraphs.push(escapeHtml('_______________________________'))
    paragraphs.push(escapeHtml('The above prices, specifications, and conditions are satisfactory and are hereby accepted. You are authorized to perform the work as specified.'))
    paragraphs.push('')
    paragraphs.push('<strong>' + escapeHtml('Acceptance of estimate') + '</strong>')
    paragraphs.push(escapeHtml('General Contractor / Builder Signature:'))
    paragraphs.push('')
    paragraphs.push(escapeHtml('____________________________________'))
    paragraphs.push('')
    paragraphs.push(escapeHtml('Date: ____________________________________'))
  }
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
  designDrawingPlanDateFormatted: string | null,
  serviceTypeName: string,
  includeSignature = true,
  includeFixturesPerPlan = true
): string {
  const inclusionIndent = '     ' // 5 preceding spaces for Additional Inclusions (same as fixture header)
  const inclusionLines = inclusions.trim().split(/\n/).filter(Boolean).map((l) => inclusionIndent + '• ' + l.trim())
  const inclusionLinesToUse = inclusions.trim() ? inclusionLines : []
  const exclusionIndent = '     ' // 5 preceding spaces for Exclusions
  const exclusionLines = exclusions.trim().split(/\n/).filter(Boolean).map((l) => exclusionIndent + '• ' + l.trim())
  const termsLines = terms.trim().split(/\n/).filter(Boolean).map((l) => '• ' + l.trim())
  const fixtureBlock =
    fixtureRows.length > 0 && includeFixturesPerPlan
      ? '     • Fixtures provided and installed by us per plan:\n            ' + fixtureRows.map((r) => '• [' + r.count + '] ' + r.fixture).join('\n            ')
      : ''
  const inclusionsBlock = [fixtureBlock, ...inclusionLinesToUse].filter(Boolean).join('\n')
  const stWord = serviceTypeWordForCoverLetter(serviceTypeName)
  const lines: string[] = [
    customerName,
    ...addressLines(customerAddress),
    '',
    projectName,
    ...addressLines(projectAddress),
    '',
    `As per ${stWord} plans and specifications, we propose to do the ${stWord} in the amount of: ${revenueWords} (${revenueNumber})`,
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
    'No work shall commence until Click Plumbing and Electrical has received acceptance of the estimate.',
    'Respectfully submitted by Click Plumbing and Electrical',
    '',
    ...(includeSignature ? [
      '_______________________________',
      'The above prices, specifications, and conditions are satisfactory and are hereby accepted. You are authorized to perform the work as specified.',
      '',
      'Acceptance of estimate',
      'General Contractor / Builder Signature:',
      '',
      '____________________________________',
      '',
      'Date: ____________________________________',
    ] : []),
  ]
  return lines.join('\n')
}

function buildRfiHtml(
  customerName: string,
  customerAddress: string,
  projectName: string,
  projectAddress: string,
  form: RfiFormData
): string {
  const br = '<br/>'
  const pStyle = 'margin: 0 0 0.5em 0'
  const customerAddr = addressLines(customerAddress).map((l) => escapeHtml(l)).join(br)
  const projectAddr = addressLines(projectAddress).map((l) => escapeHtml(l)).join(br)
  const customerBlock = '<strong>' + escapeHtml(customerName) + '</strong><br/>' + customerAddr
  const projectBlock = '<strong>' + escapeHtml(projectName) + '</strong><br/>' + projectAddr
  const paragraphs: string[] = [
    customerBlock + br + br + projectBlock,
    '',
    'Bid was submitted: ' + escapeHtml(form.bidSubmittedDate || '—') + br + 'The bid was submitted to ' + escapeHtml(form.submittedTo || '—'),
    '',
    'Response requested by ' + escapeHtml(form.responseRequestDate || '—'),
    '',
    '<strong>Question/Issue</strong>',
    escapeHtml(form.detailedDescription || '').replace(/\n/g, br) || '—',
    '',
    '<strong>Impact</strong>',
    escapeHtml(form.impactStatement || '').replace(/\n/g, br) || '—',
    '',
    'From ' + escapeHtml(form.companyName || '—') + br + escapeHtml(form.contactPerson || '—') + br + escapeHtml(form.phoneEmail || '—'),
  ]
  return '<div style="white-space: pre-wrap">' + paragraphs.map((p) => (p ? '<p style="' + pStyle + '">' + p + '</p>' : '<p style="' + pStyle + '">&nbsp;</p>')).join('') + '</div>'
}

function buildRfiText(
  customerName: string,
  customerAddress: string,
  projectName: string,
  projectAddress: string,
  form: RfiFormData
): string {
  const lines: string[] = [
    customerName,
    ...addressLines(customerAddress),
    '',
    projectName,
    ...addressLines(projectAddress),
    '',
    'Bid was submitted: ' + (form.bidSubmittedDate || '—') + '\nThe bid was submitted to ' + (form.submittedTo || '—'),
    '',
    'Response requested by ' + (form.responseRequestDate || '—'),
    '',
    'Question/Issue',
    form.detailedDescription || '—',
    '',
    'Impact',
    form.impactStatement || '—',
    '',
    'From ' + (form.companyName || '—') + '\n' + (form.contactPerson || '—') + '\n' + (form.phoneEmail || '—'),
  ]
  return lines.join('\n')
}

function buildChangeOrderHtml(
  customerName: string,
  customerAddress: string,
  projectName: string,
  projectAddress: string,
  form: ChangeOrderFormData
): string {
  const br = '<br/>'
  const pStyle = 'margin: 0 0 0.5em 0'
  const customerAddr = addressLines(customerAddress).map((l) => escapeHtml(l)).join(br)
  const projectAddr = addressLines(projectAddress).map((l) => escapeHtml(l)).join(br)
  const customerBlock = '<strong>' + escapeHtml(customerName) + '</strong><br/>' + customerAddr
  const projectBlock = '<strong>' + escapeHtml(projectName) + '</strong><br/>' + projectAddr
  const paragraphs: string[] = [
    customerBlock + br + br + projectBlock,
    '',
    'Bid was submitted: ' + escapeHtml(form.bidSubmittedDate || '—') + br + 'The bid was submitted to ' + escapeHtml(form.submittedTo || '—'),
    '',
    'Response requested by ' + escapeHtml(form.responseRequestDate || '—'),
    '',
    '<strong>Detailed Description of the Change</strong>',
    escapeHtml(form.detailedDescriptionOfChange || '').replace(/\n/g, br) || '—',
    '',
    '<strong>Reason for the Change</strong>',
    escapeHtml(form.reasonForChange || '').replace(/\n/g, br) || '—',
    '',
    '<strong>Impact on Cost (Contract Sum Adjustment)</strong>',
    escapeHtml(form.impactOnCost || '').replace(/\n/g, br) || '—',
    '',
    '<strong>Impact on Schedule (Contract Time Adjustment)</strong>',
    escapeHtml(form.impactOnSchedule || '').replace(/\n/g, br) || '—',
    '',
    'From ' + escapeHtml(form.companyName || '—') + br + escapeHtml(form.contactPerson || '—') + br + escapeHtml(form.phoneEmail || '—'),
  ]
  return '<div style="white-space: pre-wrap">' + paragraphs.map((p) => (p ? '<p style="' + pStyle + '">' + p + '</p>' : '<p style="' + pStyle + '">&nbsp;</p>')).join('') + '</div>'
}

function buildChangeOrderText(
  customerName: string,
  customerAddress: string,
  projectName: string,
  projectAddress: string,
  form: ChangeOrderFormData
): string {
  const lines: string[] = [
    customerName,
    ...addressLines(customerAddress),
    '',
    projectName,
    ...addressLines(projectAddress),
    '',
    'Bid was submitted: ' + (form.bidSubmittedDate || '—') + '\nThe bid was submitted to ' + (form.submittedTo || '—'),
    '',
    'Response requested by ' + (form.responseRequestDate || '—'),
    '',
    'Detailed Description of the Change',
    form.detailedDescriptionOfChange || '—',
    '',
    'Reason for the Change',
    form.reasonForChange || '—',
    '',
    'Impact on Cost (Contract Sum Adjustment)',
    form.impactOnCost || '—',
    '',
    'Impact on Schedule (Contract Time Adjustment)',
    form.impactOnSchedule || '—',
    '',
    'From ' + (form.companyName || '—') + '\n' + (form.contactPerson || '—') + '\n' + (form.phoneEmail || '—'),
  ]
  return lines.join('\n')
}

function buildLienReleaseHtml(
  customerName: string,
  _customerAddress: string,
  projectName: string,
  projectAddress: string,
  form: LienReleaseFormData,
  ownerName: string
): string {
  const br = '<br/>'
  const pStyle = 'margin: 0 0 0.5em 0'

  const invoiceAmtFmt = formatAmountFromString(form.invoiceAmount)
  const invToDateFmt = formatAmountFromString(form.invoicesToDate)
  const amountDisplay = invoiceAmtFmt || '—'
  const invToDateDisplay = invToDateFmt || '—'

  const boldAmount = '<strong>$' + amountDisplay + '</strong>'
  const boldInvToDate = '<strong>$' + invToDateDisplay + '</strong>'
  let conditionalWaiver = escapeHtml(form.conditionalWaiver || '')
    .replace(/\$\{\{finalInvoice\}\}/g, boldAmount)
    .replace(/\$\{\{invoicesToDate\}\}/g, boldInvToDate)
    .replace(/\{\{finalInvoice\}\}/g, boldAmount)
    .replace(/\{\{invoicesToDate\}\}/g, boldInvToDate)
  conditionalWaiver = conditionalWaiver.replace(/\n/g, br)
  conditionalWaiver = conditionalWaiver
    .replace(/(CONDITIONAL WAIVER AND RELEASE ONLY)( upon)/g, '<strong>$1</strong>$2')
    .replace(/(expressly )(conditional)( and shall be )/g, '$1<strong>$2</strong>$3')
    .replace(/(shall be )(void and of no effect)( if)/g, '$1<strong>$2</strong>$3')
    .replace(/(within )(45 days)( of)/g, '$1<strong>$2</strong>$3')
    .replace(/(at the rate of )(one and one-half percent \(1\.5\%\) per month)( \(18% per annum\))/g, '$1<strong>$2</strong>$3')

  let paymentTerms = escapeHtml(form.paymentTerms || '')
    .replace(/\$\{\{finalInvoice\}\}/g, boldAmount)
    .replace(/\{\{finalInvoice\}\}/g, boldAmount)
    .replace(/\{\{ownerName\}\}/g, ownerName || '—')
  paymentTerms = paymentTerms.replace(/\n/g, br)

  const projectAddr = addressLines(projectAddress).map((l) => escapeHtml(l)).join(br)
  const claimantAddr = addressLines(form.companyAddress).map((l) => escapeHtml(l)).join(br)

  const projectBlock = '<strong>Project:</strong>' + br + escapeHtml(projectName || '—') + br + projectAddr
  const ownerBlock = '<strong>Owner / Contracting Party:</strong>' + br + escapeHtml(customerName || '—')

  const claimantLines: string[] = [escapeHtml(form.companyName || '—'), claimantAddr]
  if (form.companyPhone) claimantLines.push('Phone: ' + escapeHtml(form.companyPhone))
  if (form.companyEmail) claimantLines.push('Email: ' + escapeHtml(form.companyEmail))
  const claimantBlock = '<strong>Claimant (Releasing Party):</strong>' + br + claimantLines.join(br)

  const invoiceDateStr = form.invoiceDate ? new Date(form.invoiceDate + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'
  const invoiceBlock = '<strong>Invoice / Application for Payment:</strong>' + br + 'Invoice Date: ' + escapeHtml(invoiceDateStr) + br + 'Invoice Number: ' + escapeHtml(form.invoiceNumber || '—') + br + 'Amount of this Application: ' + boldAmount

  const lienPhone = form.lienStatusPhone || LIEN_RELEASE_DEFAULT_LIEN_PHONE
  const lienBlock = '<strong>Lien Status Verification</strong>' + br + 'Current status of any lien filings or pencil-copy documentation may be verified at any time by calling: <strong>' + escapeHtml(lienPhone) + '</strong>'

  const sep = br + br
  let mainContent = projectBlock + sep + ownerBlock
  if ((form.cc || '').trim()) mainContent += sep + 'CC: ' + escapeHtml(form.cc.trim())
  mainContent += sep + claimantBlock + sep + invoiceBlock
  if ((form.descriptionOfWork || '').trim()) mainContent += sep + 'Description of Work / Period Covered:' + br + escapeHtml(form.descriptionOfWork.trim()).replace(/\n/g, br)
  mainContent += sep + conditionalWaiver + br + '<div style="text-align: center;"><strong>Payment Terms & Late Payment Consequences:</strong></div>' + paymentTerms + br + lienBlock

  const paragraphs: string[] = []
  const summaryLines: string[] = []
  if (invoiceAmtFmt) summaryLines.push(invoiceAmtFmt + ' - FINAL INVOICE')
  if (invToDateFmt) summaryLines.push(invToDateFmt + ' - Invoices to date')
  if (summaryLines.length > 0) {
    paragraphs.push(summaryLines.join(br))
    paragraphs.push('')
  }
  paragraphs.push(mainContent)

  const headerLines = [
    '<strong>' + escapeHtml('CONDITIONAL WAIVER AND RELEASE ON PROGRESS PAYMENT') + '</strong>',
    escapeHtml('(Texas Property Code § 53.284(c) – Conditional Waiver and Release on Progress Payment)'),
    '<strong>' + escapeHtml('Effective ONLY Upon Actual Receipt and Collection of Payment') + '</strong>',
  ]
  const headerHtml = '<p style="text-align: center; font-family: inherit; font-size: 0.875rem; margin: 0 0 0.5em 0; padding: 0; line-height: 1.15;">' + headerLines.join(br) + '</p>'
  const contentHtml = paragraphs.map((p) => (p ? '<p style="' + pStyle + '">' + p + '</p>' : '<p style="' + pStyle + '">&nbsp;</p>')).join('')
  return headerHtml + '<div style="white-space: pre-wrap; font-family: inherit; font-size: 0.875rem;">' + contentHtml + '</div>'
}

function buildLienReleaseText(
  customerName: string,
  _customerAddress: string,
  projectName: string,
  projectAddress: string,
  form: LienReleaseFormData,
  ownerName: string
): string {
  const invoiceAmtFmt = formatAmountFromString(form.invoiceAmount)
  const invToDateFmt = formatAmountFromString(form.invoicesToDate)

  const conditionalWaiver = (form.conditionalWaiver || '')
    .replace(/\{\{finalInvoice\}\}/g, invoiceAmtFmt || '—')
    .replace(/\{\{invoicesToDate\}\}/g, invToDateFmt || '—')
  const paymentTerms = (form.paymentTerms || '')
    .replace(/\{\{finalInvoice\}\}/g, invoiceAmtFmt || '—')
    .replace(/\{\{ownerName\}\}/g, ownerName || '—')

  const headerLines = [
    'CONDITIONAL WAIVER AND RELEASE ON PROGRESS PAYMENT',
    '(Texas Property Code § 53.284(c) – Conditional Waiver and Release on Progress Payment)',
    'Effective ONLY Upon Actual Receipt and Collection of Payment',
  ]
  const headerText = headerLines.join('\n')
  const sep = '\n\n'
  const lines: string[] = [headerText]
  if (invoiceAmtFmt) lines.push(invoiceAmtFmt + ' - FINAL INVOICE')
  if (invToDateFmt) lines.push(invToDateFmt + ' - Invoices to date')
  if (lines.length > 0) lines.push('')
  const projectSection = ['Project:', projectName || '—', ...addressLines(projectAddress)].join('\n')
  const ownerSection = ['Owner / Contracting Party:', customerName || '—'].join('\n')
  const claimantSection = ['Claimant (Releasing Party):', form.companyName || '—', ...addressLines(form.companyAddress), ...(form.companyPhone ? ['Phone: ' + form.companyPhone] : []), ...(form.companyEmail ? ['Email: ' + form.companyEmail] : [])].join('\n')
  const invoiceDateStr = form.invoiceDate ? new Date(form.invoiceDate + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'
  const invoiceSection = ['Invoice / Application for Payment:', 'Invoice Date: ' + invoiceDateStr, 'Invoice Number: ' + (form.invoiceNumber || '—'), 'Amount of this Application: $' + (invoiceAmtFmt || '—')].join('\n')
  let body = projectSection + sep + ownerSection
  if ((form.cc || '').trim()) body += sep + 'CC: ' + (form.cc || '').trim()
  body += sep + claimantSection + sep + invoiceSection
  if ((form.descriptionOfWork || '').trim()) body += sep + 'Description of Work / Period Covered:' + '\n' + form.descriptionOfWork.trim()
  const lienStatusText = 'Lien Status Verification' + '\n' + 'Current status of any lien filings or pencil-copy documentation may be verified at any time by calling: ' + (form.lienStatusPhone || LIEN_RELEASE_DEFAULT_LIEN_PHONE)
  body += sep + conditionalWaiver + '\n' + 'Payment Terms & Late Payment Consequences:' + '\n' + paymentTerms + '\n' + lienStatusText
  return lines.join('\n') + (lines.length > 0 ? '\n\n' : '') + body
}

export default function Bids() {
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const newCustomerModal = useNewCustomerModal()
  const editCustomerModal = useEditCustomerModal()
  const location = useLocation()
  const navigate = useNavigate()
  const [, setSearchParams] = useSearchParams()
  const [myRole, setMyRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'bid-board' | 'builder-review' | 'counts' | 'takeoffs' | 'cost-estimate' | 'pricing' | 'cover-letter' | 'submission-followup' | 'rfi' | 'change-order' | 'lien-release'>('bid-board')
  
  // Service Types state
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState<string>('')
  const [estimatorServiceTypeIds, setEstimatorServiceTypeIds] = useState<string[] | null>(null)
  const [primaryServiceTypeIds, setPrimaryServiceTypeIds] = useState<string[] | null>(null)
  const [fixtureTypes, setFixtureTypes] = useState<Array<{ id: string; name: string }>>([])
  
  // Helper function to find fixture_type_id by name
  const getFixtureTypeIdByName = (name: string): string | null => {
    const normalized = name.trim().toLowerCase()
    const match = fixtureTypes.find(ft => ft.name.toLowerCase() === normalized)
    return match?.id || null
  }

  // Helper function to get or auto-create fixture type. Returns { id, error } so callers can surface the real error.
  // serviceTypeIdOverride: when opening from a bid's Pricing tab, use the bid's service_type_id for robustness.
  async function getOrCreateFixtureTypeId(name: string, serviceTypeIdOverride?: string): Promise<{ id: string } | { id: null; error?: string }> {
    const trimmedName = name.trim()
    if (!trimmedName) return { id: null }
    const serviceTypeId = serviceTypeIdOverride ?? selectedServiceTypeId
    if (!serviceTypeId) {
      return { id: null, error: 'No service type selected. Please select Plumbing, Electrical, or HVAC.' }
    }
    // Check if it already exists (case-insensitive match)
    const existingId = getFixtureTypeIdByName(trimmedName)
    if (existingId) return { id: existingId }
    // Auto-create new fixture type
    const maxSeqResult = await supabase
      .from('fixture_types')
      .select('sequence_order')
      .eq('service_type_id', serviceTypeId)
      .order('sequence_order', { ascending: false })
      .limit(1)
      .single()
    
    const nextSeq = (maxSeqResult.data?.sequence_order ?? 0) + 1
    
    const { data, error } = await supabase
      .from('fixture_types')
      .insert({
        service_type_id: serviceTypeId,
        name: trimmedName,
        category: 'Other',
        sequence_order: nextSeq
      })
      .select('id')
      .single()
    
    if (error || !data) {
      return { id: null, error: error?.message ?? 'Failed to create fixture type' }
    }
    
    // Reload fixture types to update autocomplete suggestions
    await loadFixtureTypes()
    
    return { id: data.id }
  }

  const [bids, setBids] = useState<BidWithBuilder[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [lastContactFromEntries, setLastContactFromEntries] = useState<Record<string, string>>({})
  const [customerContacts, setCustomerContacts] = useState<CustomerContact[]>([])
  const [addContactModalCustomer, setAddContactModalCustomer] = useState<Customer | null>(null)
  const [addContactModalDate, setAddContactModalDate] = useState('')
  const [addContactModalDetails, setAddContactModalDetails] = useState('')
  const [savingContact, setSavingContact] = useState(false)
  const [customerContactPersons, setCustomerContactPersons] = useState<CustomerContactPerson[]>([])
  const [addContactPersonModalCustomer, setAddContactPersonModalCustomer] = useState<Customer | null>(null)
  const [editingContactPerson, setEditingContactPerson] = useState<CustomerContactPerson | null>(null)
  const [contactPersonName, setContactPersonName] = useState('')
  const [contactPersonPhones, setContactPersonPhones] = useState<string[]>([''])
  const [contactPersonEmail, setContactPersonEmail] = useState('')
  const [contactPersonNote, setContactPersonNote] = useState('')
  const [savingContactPerson, setSavingContactPerson] = useState(false)
  const [builderReviewSectionOpen, setBuilderReviewSectionOpen] = useState({ unsent: true, pending: true, won: true, startedOrComplete: true, lost: false })
  const [builderReviewCardExpanded, setBuilderReviewCardExpanded] = useState<Record<string, boolean>>({})
  const [builderReviewSearchQuery, setBuilderReviewSearchQuery] = useState('')
  const [builderReviewSortOrder, setBuilderReviewSortOrder] = useState<'oldest-first' | 'newest-first'>('oldest-first')
  const [builderReviewPiaCustomerIds, setBuilderReviewPiaCustomerIds] = useState<Set<string>>(() => new Set())

  // Bid Board
  const [bidBoardSearchQuery, setBidBoardSearchQuery] = useState('')
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
  const [evaluateModalOpen, setEvaluateModalOpen] = useState(false)
  const [evaluateChecked, setEvaluateChecked] = useState<{ [key: string]: boolean }>({})
  const [showSentBidScript, setShowSentBidScript] = useState(false)
  const [showBidQuestionScript, setShowBidQuestionScript] = useState(false)

  const [driveLink, setDriveLink] = useState('')
  const [plansLink, setPlansLink] = useState('')
  const [countToolingLink, setCountToolingLink] = useState('')
  const [bidSubmissionLink, setBidSubmissionLink] = useState('')
  const [projectName, setProjectName] = useState('')
  const bidFormMissingFields: string[] = []
  if (!projectName.trim()) bidFormMissingFields.push('Project Name')
  const bidFormCanSubmit = bidFormMissingFields.length === 0
  const [address, setAddress] = useState('')
  const [gcContactName, setGcContactName] = useState('')
  const [gcContactPhone, setGcContactPhone] = useState('')
  const [gcContactEmail, setGcContactEmail] = useState('')
  const [projectContactExpanded, setProjectContactExpanded] = useState(true)
  const [estimatorId, setEstimatorId] = useState('')
  const [estimatorUsers, setEstimatorUsers] = useState<EstimatorUser[]>([])
  const [accountManagerId, setAccountManagerId] = useState('')
  const [formServiceTypeId, setFormServiceTypeId] = useState('')
  const [bidDueDate, setBidDueDate] = useState('')
  const [estimatedJobStartDate, setEstimatedJobStartDate] = useState('')
  const [designDrawingPlanDate, setDesignDrawingPlanDate] = useState('')
  const [bidDateSent, setBidDateSent] = useState('')
  const [submittedTo, setSubmittedTo] = useState('')
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
  const [movingCountRow, setMovingCountRow] = useState(false)
  const [lastMovedId, setLastMovedId] = useState<string | null>(null)
  const [addingCountRow, setAddingCountRow] = useState(false)
  const [countsImportOpen, setCountsImportOpen] = useState(false)
  const [countsImportText, setCountsImportText] = useState('')
  const [countsImportError, setCountsImportError] = useState<string | null>(null)

  // Submission & Followup tab
  const [submissionSearchQuery, setSubmissionSearchQuery] = useState('')
  const [selectedBidForSubmission, setSelectedBidForSubmission] = useState<BidWithBuilder | null>(null)

  // RFI tab
  const [selectedBidForRfi, setSelectedBidForRfi] = useState<BidWithBuilder | null>(null)
  const [rfiSearchQuery, setRfiSearchQuery] = useState('')
  const [rfiFormByBid, setRfiFormByBid] = useState<Record<string, RfiFormData>>({})
  const [rfiCopySuccess, setRfiCopySuccess] = useState(false)

  // Change Order tab
  const [selectedBidForChangeOrder, setSelectedBidForChangeOrder] = useState<BidWithBuilder | null>(null)
  const [changeOrderSearchQuery, setChangeOrderSearchQuery] = useState('')
  const [changeOrderFormByBid, setChangeOrderFormByBid] = useState<Record<string, ChangeOrderFormData>>({})
  const [changeOrderCopySuccess, setChangeOrderCopySuccess] = useState(false)

  // Lien Release tab
  const [selectedBidForLienRelease, setSelectedBidForLienRelease] = useState<BidWithBuilder | null>(null)
  const [lienReleaseSearchQuery, setLienReleaseSearchQuery] = useState('')
  const [lienReleaseFormByBid, setLienReleaseFormByBid] = useState<Record<string, LienReleaseFormData>>({})
  const [lienReleaseCopySuccess, setLienReleaseCopySuccess] = useState(false)
  const [lienReleaseCompanyInfoCollapsed, setLienReleaseCompanyInfoCollapsed] = useState(true)
  const [lienReleaseConditionalWaiverCollapsed, setLienReleaseConditionalWaiverCollapsed] = useState(true)
  const [lienReleasePaymentTermsCollapsed, setLienReleasePaymentTermsCollapsed] = useState(true)
  const [lienReleaseLienStatusCollapsed, setLienReleaseLienStatusCollapsed] = useState(true)

  const submissionSummaryCardRef = useRef<HTMLDivElement>(null)
  const contactTableRef = useRef<HTMLDivElement | null>(null)
  const skipNextLoadCountRowsRef = useRef(false)
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
  const [takeoffPrinting, setTakeoffPrinting] = useState(false)
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

  // Part Prices modal (check/modify prices from Add Assembly / Edit Assembly item rows)
  const [partPricesModal, setPartPricesModal] = useState<{ partId: string; partName: string } | null>(null)
  const [partPricesModalData, setPartPricesModalData] = useState<Array<{ price_id: string; supply_house_name: string; supply_house_id: string; price: number }> | 'loading' | null>(null)
  const [partPricesModalEditing, setPartPricesModalEditing] = useState<Record<string, string>>({})
  const [partPricesModalUpdating, setPartPricesModalUpdating] = useState<string | null>(null)
  const [partPricesModalAddSupplyHouseId, setPartPricesModalAddSupplyHouseId] = useState('')
  const [partPricesModalAddPrice, setPartPricesModalAddPrice] = useState('')
  const [partPricesModalAdding, setPartPricesModalAdding] = useState(false)

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
  const [costEstimateAutosaveStatus, setCostEstimateAutosaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
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
  const [estimatorCostUseFlat, setEstimatorCostUseFlat] = useState(false)
  const [estimatorCostPerCount, setEstimatorCostPerCount] = useState('10')
  const [estimatorCostFlatAmount, setEstimatorCostFlatAmount] = useState('')

  // Pricing tab
  const [pricingSearchQuery, setPricingSearchQuery] = useState('')
  const [priceBookSectionOpen, setPriceBookSectionOpen] = useState(false)
  const [selectedBidForPricing, setSelectedBidForPricing] = useState<BidWithBuilder | null>(null)
  const [priceBookVersions, setPriceBookVersions] = useState<PriceBookVersion[]>([])
  const [priceBookEntries, setPriceBookEntries] = useState<PriceBookEntryWithFixture[]>([])
  const [bidPricingAssignments, setBidPricingAssignments] = useState<BidPricingAssignment[]>([])
  const [bidCountRowCustomPrices, setBidCountRowCustomPrices] = useState<BidCountRowCustomPrice[]>([])
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
  const [pricingViewModel, setPricingViewModel] = useState<'cost' | 'price'>('price')
  const [unitPriceEditValues, setUnitPriceEditValues] = useState<Record<string, string>>({})
  const [savingUnitPriceOverride, setSavingUnitPriceOverride] = useState<string | null>(null)

  // Cover Letter tab
  const [coverLetterInclusionsByBid, setCoverLetterInclusionsByBid] = useState<Record<string, string>>({})
  const [coverLetterExclusionsByBid, setCoverLetterExclusionsByBid] = useState<Record<string, string>>({})
  const [coverLetterTermsByBid, setCoverLetterTermsByBid] = useState<Record<string, string>>({})
  const [coverLetterIncludeDesignDrawingPlanDateByBid, setCoverLetterIncludeDesignDrawingPlanDateByBid] = useState<Record<string, boolean>>({})
  const [coverLetterCustomAmountByBid, setCoverLetterCustomAmountByBid] = useState<Record<string, string>>({})
  const [coverLetterUseCustomAmountByBid, setCoverLetterUseCustomAmountByBid] = useState<Record<string, boolean>>({})
  const [coverLetterIncludeSignatureByBid, setCoverLetterIncludeSignatureByBid] = useState<Record<string, boolean>>({})
  const [coverLetterIncludeFixturesPerPlanByBid, setCoverLetterIncludeFixturesPerPlanByBid] = useState<Record<string, boolean>>({})
  const [coverLetterTermsCollapsed, setCoverLetterTermsCollapsed] = useState(true)
  const [coverLetterSearchQuery, setCoverLetterSearchQuery] = useState('')
  const [coverLetterCopySuccess, setCoverLetterCopySuccess] = useState(false)
  const [coverLetterBidSubmissionQuickAddBidId, setCoverLetterBidSubmissionQuickAddBidId] = useState<string | null>(null)
  const [coverLetterBidSubmissionQuickAddValue, setCoverLetterBidSubmissionQuickAddValue] = useState('')
  const [applyingBidValue, setApplyingBidValue] = useState(false)
  const [bidValueAppliedSuccess, setBidValueAppliedSuccess] = useState(false)
  const [bidSubmissionQuickAddSuccess, setBidSubmissionQuickAddSuccess] = useState<string | null>(null)

  /** Set selected bid for Counts, Takeoffs, Cost Estimate, Pricing, Submission, RFI, Change Order, and Lien Release so selection stays in sync across tabs. */
  function setSharedBid(bid: BidWithBuilder | null) {
    setSelectedBidForCounts(bid)
    setSelectedBidForTakeoff(bid)
    setSelectedBidForCostEstimate(bid)
    setSelectedBidForPricing(bid)
    setSelectedBidForSubmission(bid)
    setSelectedBidForRfi(bid)
    setSelectedBidForChangeOrder(bid)
    setSelectedBidForLienRelease(bid)
  }

  /** Clear bid selection and remove bidId from URL so tab switches don't restore the old bid. */
  function closeSharedBidAndClearUrl() {
    setSharedBid(null)
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.delete('bidId')
      return next
    }, { replace: true })
  }

  /** Select a bid and sync URL so tab switches show the same bid. */
  function selectBidAndSyncUrl(bid: BidWithBuilder, tab: typeof activeTab) {
    setSharedBid(bid)
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.set('tab', tab)
      next.set('bidId', bid.id)
      return next
    }, { replace: true })
  }

  function toggleSubmissionSection(key: 'unsent' | 'pending' | 'won' | 'startedOrComplete' | 'lost') {
    setSubmissionSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function toggleBuilderReviewSection(key: 'unsent' | 'pending' | 'won' | 'startedOrComplete' | 'lost') {
    setBuilderReviewSectionOpen((prev: typeof builderReviewSectionOpen) => ({ ...prev, [key]: !prev[key] }))
  }

  function toggleBuilderReviewCard(customerId: string) {
    setBuilderReviewCardExpanded((prev) => ({ ...prev, [customerId]: !(prev[customerId] !== false) }))
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
      .select('role, estimator_service_type_ids, primary_service_type_ids')
      .eq('id', authUser.id)
      .single()
    if (eMe) {
      setError(eMe.message)
      setLoading(false)
      return
    }
    const role = (me as { role: UserRole; estimator_service_type_ids?: string[] | null; primary_service_type_ids?: string[] | null } | null)?.role ?? null
    const estIds = (me as { estimator_service_type_ids?: string[] | null } | null)?.estimator_service_type_ids
    const primIds = (me as { primary_service_type_ids?: string[] | null } | null)?.primary_service_type_ids
    setMyRole(role)
    if (role === 'estimator' && estIds && estIds.length > 0) {
      setEstimatorServiceTypeIds(estIds)
    } else {
      setEstimatorServiceTypeIds(null)
    }
    if (role === 'primary' && primIds && primIds.length > 0) {
      setPrimaryServiceTypeIds(primIds)
    } else {
      setPrimaryServiceTypeIds(null)
    }
    if (role !== 'dev' && role !== 'master_technician' && role !== 'assistant' && role !== 'estimator' && role !== 'primary') {
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
      .select('id, name, address, master_user_id, contact_info')
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
    
    // For estimators/primaries with restrictions, filter to allowed types
    const visibleTypes = (estimatorServiceTypeIds && estimatorServiceTypeIds.length > 0)
      ? types.filter((st) => estimatorServiceTypeIds.includes(st.id))
      : (primaryServiceTypeIds && primaryServiceTypeIds.length > 0)
        ? types.filter((st) => primaryServiceTypeIds.includes(st.id))
        : types
    // Fallback: if filter yields no types (e.g. stale primary_service_type_ids), use all
    const typesToUse = visibleTypes.length > 0 ? visibleTypes : types
    const firstId = typesToUse[0]?.id
    if (firstId) {
      setSelectedServiceTypeId((prev) => {
        if (!prev || !typesToUse.some((st) => st.id === prev)) return firstId
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

  async function loadBids(serviceTypeId?: string | null): Promise<BidWithBuilder[]> {
    const sid = serviceTypeId === undefined ? selectedServiceTypeId : serviceTypeId
    let q = supabase
      .from('bids')
      .select('*, customers(*), bids_gc_builders(*), estimator:users!bids_estimator_id_fkey(id, name, email), account_manager:users!bids_account_manager_id_fkey(id, name, email), service_type:service_types(id, name, color)')
    if (sid) q = q.eq('service_type_id', sid)
    const { data, error } = await q.order('bid_due_date', { ascending: false, nullsFirst: true })
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
      .order('id', { ascending: true })
    if (error) {
      setError(`Failed to load count rows: ${error.message}`)
      return
    }
    if (skipNextLoadCountRowsRef.current) {
      console.log('[CountMove] loadCountRows SKIPPED (move in progress)')
      return
    }
    const loaded = (data as BidCountRow[]) ?? []
    console.log('[CountMove] loadCountRows APPLIED', { len: loaded.length, fixtures: loaded.map((r) => r?.fixture?.slice(0, 12)) })
    setCountRows(loaded)
  }

  function refreshAfterCountsChange(opts?: { skipCountRows?: boolean }) {
    const bidId = selectedBidForCounts?.id
    if (!bidId) return
    if (!opts?.skipCountRows) loadCountRows(bidId)
    if (selectedBidForTakeoff?.id === bidId) loadTakeoffCountRows(bidId)
    if (selectedBidForCostEstimate?.id === bidId) loadCostEstimateData(bidId, selectedLaborBookVersionId)
  }

  async function moveCountRowById(rowId: string, direction: 'up' | 'down') {
    const bidId = selectedBidForCounts?.id
    if (!bidId || movingCountRow) return
    skipNextLoadCountRowsRef.current = true

    const idx = countRows.findIndex((r) => r.id === rowId)
    if (idx === -1) return
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= countRows.length) return
    const row = countRows[idx]
    if (!row) return

    const newOrder = [...countRows]
    const [removed] = newOrder.splice(idx, 1)
    if (removed) newOrder.splice(targetIdx, 0, removed)
    setLastMovedId(row.id)
    setTimeout(() => setLastMovedId(null), 800)
    setMovingCountRow(true)
    setCountRows(newOrder)
    for (let seq = 0; seq < newOrder.length; seq++) {
      const r = newOrder[seq]
      if (!r) continue
      const { error } = await supabase.from('bids_count_rows').update({ sequence_order: seq }).eq('id', r.id)
      if (error) {
        setCountRows([...countRows])
        showToast('Failed to save row order', 'error')
        setMovingCountRow(false)
        skipNextLoadCountRowsRef.current = false
        return
      }
    }
    refreshAfterCountsChange({ skipCountRows: true })
    setMovingCountRow(false)
    setTimeout(() => { skipNextLoadCountRowsRef.current = false }, 300)
  }

  function parseCountsImportText(text: string): { rows: Array<{ fixture: string; count: number; group_tag: string | null; page: string | null }>; skippedCount: number } {
    const rows: Array<{ fixture: string; count: number; group_tag: string | null; page: string | null }> = []
    let skippedCount = 0
    const lines = text.split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const delimiter = trimmed.includes('\t') ? '\t' : ','
      const cells = trimmed.split(delimiter).map((c) => c.trim())
      const fixture = cells[0] ?? ''
      const countStr = cells[1] ?? ''
      const groupTag = cells.length >= 4 ? ((cells[2] ?? '').trim() || null) : null
      const page = (cells.length >= 4 ? (cells[3] ?? '') : (cells[2] ?? '')).trim() || null
      if (!fixture || !countStr) {
        skippedCount++
        continue
      }
      const count = parseFloat(countStr)
      if (isNaN(count) || count < 0) {
        skippedCount++
        continue
      }
      rows.push({ fixture, count, group_tag: groupTag, page })
    }
    return { rows, skippedCount }
  }

  async function handleCountsImport() {
    setCountsImportError(null)
    const { rows, skippedCount } = parseCountsImportText(countsImportText)
    if (rows.length === 0) {
      setCountsImportError(skippedCount > 0 ? 'No valid rows found. Check format: Fixture, Count, Plan Page' : 'Paste or enter count rows')
      return
    }
    const bidId = selectedBidForCounts?.id
    if (!bidId) return
    const { data: maxSeqData } = await supabase
      .from('bids_count_rows')
      .select('sequence_order')
      .eq('bid_id', bidId)
      .order('sequence_order', { ascending: false })
      .limit(1)
    const maxSeq = maxSeqData?.[0]?.sequence_order ?? 0
    let inserted = 0
    let failed = 0
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (!row) continue
      const { error } = await supabase.from('bids_count_rows').insert({
        bid_id: bidId,
        fixture: row.fixture,
        count: row.count,
        group_tag: row.group_tag,
        page: row.page,
        sequence_order: maxSeq + 1 + i,
      })
      if (error) {
        failed++
        setCountsImportError(`Failed to insert ${failed} row(s): ${error.message}`)
        if (inserted > 0) { refreshAfterCountsChange() }
        return
      }
      inserted++
    }
    setCountsImportText('')
    setCountsImportOpen(false)
    refreshAfterCountsChange()
    const msg = skippedCount > 0 ? `Imported ${inserted} rows. ${skippedCount} lines skipped.` : `Imported ${inserted} rows.`
    showToast(msg, 'success')
  }

  async function handleCountsImportFromTooling() {
    const bidId = selectedBidForCounts?.id
    if (!bidId) return
    try {
      const text = await navigator.clipboard.readText()
      const { rows, skippedCount } = parseCountsImportText(text)
      if (rows.length === 0) {
        showToast(skippedCount > 0 ? 'No valid rows in clipboard. Use tab-delimited: Fixture, Count, Plan Page' : 'Clipboard is empty. Copy from /Tooling first.', 'error')
        return
      }
      const { data: maxSeqData } = await supabase
        .from('bids_count_rows')
        .select('sequence_order')
        .eq('bid_id', bidId)
        .order('sequence_order', { ascending: false })
        .limit(1)
      const maxSeq = maxSeqData?.[0]?.sequence_order ?? 0
      let inserted = 0
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        if (!row) continue
        const { error } = await supabase.from('bids_count_rows').insert({
          bid_id: bidId,
          fixture: row.fixture,
          count: row.count,
          group_tag: row.group_tag,
          page: row.page,
          sequence_order: maxSeq + 1 + i,
        })
        if (error) {
          showToast(`Failed to insert: ${error.message}`, 'error')
          if (inserted > 0) refreshAfterCountsChange()
          return
        }
        inserted++
      }
      refreshAfterCountsChange()
      const msg = skippedCount > 0 ? `Imported ${inserted} rows from /Tooling. ${skippedCount} lines skipped.` : `Imported ${inserted} rows from /Tooling.`
      showToast(msg, 'success')
    } catch (err) {
      showToast('Could not read clipboard. Paste into Import instead.', 'error')
    }
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

  async function loadCustomerContacts() {
    const { data, error } = await supabase
      .from('customer_contacts')
      .select('*')
      .order('contact_date', { ascending: false })
    if (error) {
      setError(`Failed to load customer contacts: ${error.message}`)
      return
    }
    setCustomerContacts((data as CustomerContact[]) ?? [])
  }

  async function loadCustomerContactPersons() {
    const { data, error } = await supabase
      .from('customer_contact_persons')
      .select('*')
      .order('name')
    if (error) {
      setError(`Failed to load contact persons: ${error.message}`)
      return
    }
    setCustomerContactPersons((data as CustomerContactPerson[]) ?? [])
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
    // Merge parts by part_id (unique constraint: one part per template) - nested templates can repeat
    const merged: Array<{ item_type: string; part_id: string | null; nested_template_id: string | null; quantity: number }> = []
    for (const item of takeoffNewTemplateItems) {
      if (!item) continue
      if (item.item_type === 'part' && item.part_id) {
        const existing = merged.find((m) => m.item_type === 'part' && m.part_id === item.part_id)
        if (existing) {
          existing.quantity += item.quantity
        } else {
          merged.push({ ...item, quantity: item.quantity })
        }
      } else {
        merged.push({ ...item, quantity: item.quantity })
      }
    }
    for (let i = 0; i < merged.length; i++) {
      const item = merged[i]
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
    setTakeoffNewTemplateItems((prev) => {
      // For parts: merge with existing same part instead of adding duplicate row
      if (takeoffNewItemType === 'part' && takeoffNewItemPartId) {
        const idx = prev.findIndex(
          (p) => p.item_type === 'part' && p.part_id === takeoffNewItemPartId
        )
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...next[idx]!, quantity: (next[idx]!.quantity ?? 1) + qty }
          return next
        }
      }
      return [
        ...prev,
        {
          item_type: takeoffNewItemType,
          part_id: takeoffNewItemType === 'part' ? takeoffNewItemPartId : null,
          nested_template_id: takeoffNewItemType === 'template' ? takeoffNewItemTemplateId : null,
          quantity: qty,
        },
      ]
    })
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

    // For parts: if part already exists in template, add to quantity instead of inserting duplicate
    if (editTemplateNewItemType === 'part' && editTemplateNewItemPartId) {
      const existing = editTemplateItems.find(
        (i) => i.item_type === 'part' && i.part_id === editTemplateNewItemPartId
      )
      if (existing) {
        const { error: updateErr } = await supabase
          .from('material_template_items')
          .update({ quantity: (existing.quantity ?? 1) + quantity })
          .eq('id', existing.id)
        if (updateErr) {
          setError(updateErr.message)
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
        return
      }
    }

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

    // Check if part already exists in template - if so, add to quantity instead of inserting
    const { data: existingPart } = await supabase
      .from('material_template_items')
      .select('id, quantity')
      .eq('template_id', addPartsToTemplateId)
      .eq('part_id', addPartsSelectedPartId)
      .eq('item_type', 'part')
      .maybeSingle()

    if (existingPart) {
      const { error: updateErr } = await supabase
        .from('material_template_items')
        .update({ quantity: (existingPart.quantity ?? 1) + qty })
        .eq('id', existingPart.id)
      if (updateErr) {
        setError(updateErr.message)
        setSavingTemplateParts(false)
        return
      }
    } else {
      const { data: seqData } = await supabase
        .from('material_template_items')
        .select('sequence_order')
        .eq('template_id', addPartsToTemplateId)
        .order('sequence_order', { ascending: false })
        .limit(1)
      const maxOrder = seqData && seqData.length > 0 ? (seqData[0]?.sequence_order ?? 0) : 0

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

  function updateTakeoffNewTemplateItemQuantity(index: number, newQuantity: number) {
    const qty = Math.max(1, Math.floor(newQuantity))
    setTakeoffNewTemplateItems((prev) => {
      const next = [...prev]
      if (next[index]) next[index] = { ...next[index]!, quantity: qty }
      return next
    })
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

  async function loadPOTotal(poId: string, signal?: AbortSignal): Promise<number> {
    let q: ReturnType<typeof supabase.from> = supabase
      .from('purchase_order_items')
      .select('price_at_time, quantity')
      .eq('purchase_order_id', poId)
    if (signal && 'abortSignal' in q) q = (q as { abortSignal: (s: AbortSignal) => typeof q }).abortSignal(signal)
    const { data, error } = await q
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
      setEstimatorCostPerCount((est as any).estimator_cost_per_count?.toString() ?? '10')
      setEstimatorCostFlatAmount((est as any).estimator_cost_flat_amount != null ? String((est as any).estimator_cost_flat_amount) : '')
      setEstimatorCostUseFlat((est as any).estimator_cost_flat_amount != null)
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
      setEstimatorCostPerCount('10')
      setEstimatorCostFlatAmount('')
      setEstimatorCostUseFlat(false)
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
        // Duplicate key = cost estimate already exists (race or concurrent create); load and use it
        const isUniqueViolation = (insErr as { code?: string | number }).code === '23505' || (insErr as { code?: string | number }).code === 23505
        if (isUniqueViolation && insErr.message?.includes('cost_estimates_bid_id_key')) {
          est = await loadCostEstimate(bidId)
          if (est) return est
        }
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

  async function loadBidPricingAssignments(bidId: string, versionId: string | null, signal?: AbortSignal) {
    if (versionId == null) {
      setBidPricingAssignments([])
      setBidCountRowCustomPrices([])
      return
    }
    try {
      const [assignmentsData, customPricesData] = await Promise.all([
        withSupabaseRetry(
          async () => {
            let q = supabase
              .from('bid_pricing_assignments')
              .select('*')
              .eq('bid_id', bidId)
              .eq('price_book_version_id', versionId)
            if (signal && 'abortSignal' in q) q = (q as { abortSignal: (s: AbortSignal) => typeof q }).abortSignal(signal)
            return await q
          },
          'fetch bid pricing assignments'
        ),
        withSupabaseRetry(
          async () => {
            let q = supabase
              .from('bid_count_row_custom_prices')
              .select('*')
              .eq('bid_id', bidId)
              .eq('price_book_version_id', versionId)
            if (signal && 'abortSignal' in q) q = (q as { abortSignal: (s: AbortSignal) => typeof q }).abortSignal(signal)
            return await q
          },
          'fetch bid count row custom prices'
        ),
      ])
      setBidPricingAssignments((assignmentsData as BidPricingAssignment[]) ?? [])
      setBidCountRowCustomPrices((customPricesData as BidCountRowCustomPrice[]) ?? [])
    } catch (e) {
      const isAbort = (x: unknown) =>
        (x && typeof x === 'object' && 'name' in x && (x as { name: string }).name === 'AbortError') ||
        (x instanceof Error && /abort/i.test(x.message))
      if (isAbort(e)) return
      setError(`Failed to load pricing assignments: ${e instanceof Error ? e.message : String(e)}`)
      setBidPricingAssignments([])
      setBidCountRowCustomPrices([])
    }
  }

  async function loadPricingDataForBid(bidId: string, signal?: AbortSignal) {
    const clearPricingState = () => {
      setPricingCountRows([])
      setPricingCostEstimate(null)
      setPricingLaborRows([])
      setPricingMaterialTotalRoughIn(null)
      setPricingMaterialTotalTopOut(null)
      setPricingMaterialTotalTrimSet(null)
      setPricingLaborRate(null)
      setPricingFixtureMaterialsFromTakeoff({})
    }

    try {
    // Phase 1: parallel fetches (all need only bidId)
    const [countRes, estRes, mappingsRes] = await Promise.all([
      (() => {
        let q: ReturnType<typeof supabase.from> = supabase.from('bids_count_rows').select('*').eq('bid_id', bidId).order('sequence_order', { ascending: true })
        if (signal && 'abortSignal' in q) q = (q as { abortSignal: (s: AbortSignal) => typeof q }).abortSignal(signal)
        return q
      })(),
      (() => {
        let q: ReturnType<typeof supabase.from> = supabase.from('cost_estimates').select('*').eq('bid_id', bidId)
        if (signal && 'abortSignal' in q) q = (q as { abortSignal: (s: AbortSignal) => typeof q }).abortSignal(signal)
        return q.maybeSingle()
      })(),
      (() => {
        let q: ReturnType<typeof supabase.from> = supabase.from('bids_takeoff_template_mappings').select('id, count_row_id, template_id, stage, quantity').eq('bid_id', bidId)
        if (signal && 'abortSignal' in q) q = (q as { abortSignal: (s: AbortSignal) => typeof q }).abortSignal(signal)
        return q
      })(),
    ])

    if (countRes.error) {
      clearPricingState()
      return
    }
    const countRows = (countRes.data as BidCountRow[]) ?? []
    setPricingCountRows(countRows)

    if (estRes.error || !estRes.data) {
      clearPricingState()
      return
    }
    const est = estRes.data as CostEstimate
    setPricingCostEstimate(est)
    setPricingLaborRate(est.labor_rate != null ? Number(est.labor_rate) : null)

    // Phase 2: parallel fetches (all need est)
    const loadPOItems = async (poId: string | null) => {
      if (!poId) return []
      let q: ReturnType<typeof supabase.from> = supabase
        .from('purchase_order_items')
        .select('part_id, quantity, price_at_time')
        .eq('purchase_order_id', poId)
      if (signal && 'abortSignal' in q) q = (q as { abortSignal: (s: AbortSignal) => typeof q }).abortSignal(signal)
      const { data, error } = await q
      if (error) return []
      return (data as Array<{ part_id: string; quantity: number; price_at_time: number }>) ?? []
    }
    const [roughTotal, topTotal, trimTotal, laborRes, roughItems, topItems, trimItems] = await Promise.all([
      est.purchase_order_id_rough_in ? loadPOTotal(est.purchase_order_id_rough_in, signal) : Promise.resolve(0),
      est.purchase_order_id_top_out ? loadPOTotal(est.purchase_order_id_top_out, signal) : Promise.resolve(0),
      est.purchase_order_id_trim_set ? loadPOTotal(est.purchase_order_id_trim_set, signal) : Promise.resolve(0),
      (() => {
        let q: ReturnType<typeof supabase.from> = supabase.from('cost_estimate_labor_rows').select('*').eq('cost_estimate_id', est.id).order('sequence_order', { ascending: true })
        if (signal && 'abortSignal' in q) q = (q as { abortSignal: (s: AbortSignal) => typeof q }).abortSignal(signal)
        return q
      })(),
      loadPOItems(est.purchase_order_id_rough_in),
      loadPOItems(est.purchase_order_id_top_out),
      loadPOItems(est.purchase_order_id_trim_set),
    ])

    setPricingMaterialTotalRoughIn(est.purchase_order_id_rough_in ? roughTotal : null)
    setPricingMaterialTotalTopOut(est.purchase_order_id_top_out ? topTotal : null)
    setPricingMaterialTotalTrimSet(est.purchase_order_id_trim_set ? trimTotal : null)

    if (laborRes.error) {
      setPricingLaborRows([])
      setPricingFixtureMaterialsFromTakeoff({})
      return
    }
    setPricingLaborRows((laborRes.data as CostEstimateLaborRow[]) ?? [])

    // Progressive loading: show table with proportional materials immediately; compute per-fixture materials in background
    setPricingFixtureMaterialsFromTakeoff({})

    const partPriceByStage: Record<string, Record<string, number>> = {
      rough_in: Object.fromEntries(roughItems.map((i) => [i.part_id, i.price_at_time])),
      top_out: Object.fromEntries(topItems.map((i) => [i.part_id, i.price_at_time])),
      trim_set: Object.fromEntries(trimItems.map((i) => [i.part_id, i.price_at_time])),
    }
    const mappings = (mappingsRes.data as Array<{ id: string; count_row_id: string; template_id: string; stage: string; quantity: number }>) ?? []

    if (mappings.length > 0) {
      void (async () => {
        // Deduplicate and parallelize expandTemplate
        const uniqueKeys = new Set(mappings.map((m) => `${m.template_id}:${m.quantity}`))
        const cache = new Map<string, Array<{ part_id: string; quantity: number }>>()
        await Promise.all(
          [...uniqueKeys].map(async (key) => {
            const [tid, qtyStr] = key.split(':')
            const qty = Number(qtyStr ?? 0)
            const parts = await expandTemplate(supabase, tid ?? '', qty)
            cache.set(key, parts)
          })
        )

        // Compute fixtureMaterials from cache (sync)
        const fixtureMaterials: Record<string, number> = {}
        for (const countRow of countRows) {
          const rowMappings = mappings.filter((m) => m.count_row_id === countRow.id)
          if (rowMappings.length === 0) continue
          let sum = 0
          for (const m of rowMappings) {
            const parts = cache.get(`${m.template_id}:${m.quantity}`) ?? []
            const priceMap = partPriceByStage[m.stage] ?? {}
            for (const { part_id, quantity } of parts) {
              const price = priceMap[part_id] ?? 0
              sum += quantity * price
            }
          }
          fixtureMaterials[countRow.id] = sum
        }

        if (pricingBidIdRef.current === bidId) {
          setPricingFixtureMaterialsFromTakeoff(fixtureMaterials)
        }
      })()
    }
    } catch (e) {
      const isAbort = (x: unknown) =>
        (x && typeof x === 'object' && 'name' in x && (x as { name: string }).name === 'AbortError') ||
        (x instanceof Error && /abort/i.test(x.message))
      if (isAbort(e)) return
      throw e
    }
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

  async function updateUnitPriceOverride(countRowId: string, value: number | null) {
    const bidId = selectedBidForPricing?.id
    const versionId = selectedPricingVersionId
    if (!bidId || !versionId) return
    const existing = bidPricingAssignments.find((a) => a.count_row_id === countRowId && a.price_book_version_id === versionId)
    const entriesById = new Map(priceBookEntries.map((e) => [e.id, e]))
    const countRow = pricingCountRows.find((r) => r.id === countRowId)
    const entry = existing ? entriesById.get(existing.price_book_entry_id) : (countRow ? priceBookEntries.find((e) => (e.fixture_types?.name ?? '').toLowerCase() === (countRow.fixture ?? '').toLowerCase()) : null)
    const existingCustom = bidCountRowCustomPrices.find((c) => c.count_row_id === countRowId && c.price_book_version_id === versionId)

    setSavingUnitPriceOverride(countRowId)
    let err: { message: string } | null = null

    if (existing) {
      const res = await supabase.from('bid_pricing_assignments').update({ unit_price_override: value }).eq('id', existing.id)
      err = res.error
      if (!err && existingCustom) {
        await supabase.from('bid_count_row_custom_prices').delete().eq('id', existingCustom.id)
      }
    } else if (entry) {
      const res = await supabase.from('bid_pricing_assignments').insert({
        bid_id: bidId,
        count_row_id: countRowId,
        price_book_entry_id: entry.id,
        price_book_version_id: versionId,
        unit_price_override: value,
      })
      err = res.error
      if (!err && existingCustom) {
        await supabase.from('bid_count_row_custom_prices').delete().eq('id', existingCustom.id)
      }
    } else {
      if (value == null) {
        if (existingCustom) {
          const res = await supabase.from('bid_count_row_custom_prices').delete().eq('id', existingCustom.id)
          err = res.error
        }
      } else {
        const res = existingCustom
          ? await supabase.from('bid_count_row_custom_prices').update({ unit_price: value }).eq('id', existingCustom.id)
          : await supabase.from('bid_count_row_custom_prices').insert({ bid_id: bidId, count_row_id: countRowId, price_book_version_id: versionId, unit_price: value })
        err = res.error
      }
    }

    if (err) setError(err.message)
    else await loadBidPricingAssignments(bidId, versionId)
    setSavingUnitPriceOverride(null)
    setUnitPriceEditValues((prev) => {
      const next = { ...prev }
      delete next[countRowId]
      return next
    })
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
        saveBidSelectedPriceBookVersion(selectedBidForPricing!.id, null)
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
    
    // Get or auto-create fixture type (use bid's service type when on Pricing tab for robustness)
    const result = await getOrCreateFixtureTypeId(fixtureName, selectedBidForPricing?.service_type_id)
    if (!result.id) {
      const errMsg = ('error' in result ? result.error : null) ?? `Failed to create or find fixture type "${fixtureName}"`
      setError(errMsg)
      setSavingPricingEntry(false)
      return
    }
    const fixtureTypeId = result.id
    
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
          saveBidSelectedLaborBookVersion(selectedBidForCostEstimate!.id, null)
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
    const laborResult = await getOrCreateFixtureTypeId(fixtureName)
    if (!laborResult.id) {
      setError(('error' in laborResult ? laborResult.error : null) ?? `Failed to create or find fixture type "${fixtureName}"`)
      setSavingLaborEntry(false)
      return
    }
    const fixtureTypeId = laborResult.id
    
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
          saveBidSelectedTakeoffBookVersion(selectedBidForTakeoff!.id, null)
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
          const matchesAlias = (entry.alias_names ?? []).some((alias: string) => alias.trim().toLowerCase() === fixtureLower)
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
    const estimatorCostPerCountNum = estimatorCostUseFlat ? null : (parseFloat(estimatorCostPerCount) || 10)
    const estimatorCostFlatAmountNum = estimatorCostUseFlat && estimatorCostFlatAmount.trim() !== '' ? parseFloat(estimatorCostFlatAmount) : null
    if (estimatorCostUseFlat && (estimatorCostFlatAmount.trim() === '' || isNaN(estimatorCostFlatAmountNum!) || estimatorCostFlatAmountNum! < 0)) {
      setError('Estimator flat amount must be a non-negative number when using flat amount.')
      setSavingCostEstimate(false)
      return
    }
    if (!estimatorCostUseFlat && (isNaN(estimatorCostPerCountNum!) || estimatorCostPerCountNum! < 0)) {
      setError('Estimator cost per count must be a non-negative number.')
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
        estimator_cost_per_count: estimatorCostPerCountNum,
        estimator_cost_flat_amount: estimatorCostFlatAmountNum,
      })
      .eq('id', costEstimate.id)
    if (updateErr) {
      setError(`Failed to save cost estimate: ${updateErr.message}`)
      setSavingCostEstimate(false)
      return
    }
    setCostEstimate((prev) => (prev ? { ...prev, labor_rate: laborRateNum, driving_cost_rate: drivingCostRateNum, hours_per_trip: hoursPerTripNum, estimator_cost_per_count: estimatorCostPerCountNum, estimator_cost_flat_amount: estimatorCostFlatAmountNum } as any : null))
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
    
    setSavingMissingFixture(true)
    setError(null)
    
    const addResult = await getOrCreateFixtureTypeId(addMissingFixtureName.trim())
    if (!addResult.id) {
      setError(('error' in addResult ? addResult.error : null) ?? `Failed to create or find fixture type "${addMissingFixtureName.trim()}"`)
      setSavingMissingFixture(false)
      return
    }
    const fixtureTypeId = addResult.id
    
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
    const distance = parseFloat(selectedBidForCostEstimate?.distance_from_office ?? '0') || 0
    const ratePerMile = parseFloat(drivingCostRate) || 0.70
    const hrsPerTrip = parseFloat(hoursPerTrip) || 2.0
    const numTrips = totalHours / hrsPerTrip
    const drivingCost = numTrips * ratePerMile * distance
    const estimatorCost = (costEstimate as any)?.estimator_cost_flat_amount != null
      ? Number((costEstimate as any).estimator_cost_flat_amount)
      : costEstimateCountRows.length * (Number((costEstimate as any)?.estimator_cost_per_count) || 10)
    const laborCostWithDriving = laborCost + drivingCost + estimatorCost
    const grandTotal = totalMaterials + laborCostWithDriving

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
  <p style="font-weight:600; text-align:right; margin-top:0.5rem;">Manhours: $${formatCurrency(laborCost)}<br/><span style="font-weight:400; font-size:0.875rem;">(${totalHours.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} hrs × $${formatCurrency(rate)}/hr)</span></p>${distance > 0 && totalHours > 0 ? `
  <p style="font-weight:600; text-align:right; margin-top:0.5rem;">Driving: $${formatCurrency(drivingCost)}<br/><span style="font-weight:400; font-size:0.875rem;">(${numTrips.toFixed(1)} trips × $${ratePerMile.toFixed(2)}/mi × ${distance.toFixed(0)} mi)</span></p>` : ''}${estimatorCost > 0 ? `
  <p style="font-weight:600; text-align:right; margin-top:0.5rem;">Estimator: $${formatCurrency(estimatorCost)}</p>` : ''}
  <p style="font-weight:600; text-align:right; margin-top:0.5rem;">Labor total: $${formatCurrency(laborCostWithDriving)}</p>
  <h2>Summary</h2>
  <div class="summary">
    <p>Materials Total: $${formatCurrency(totalMaterials)}</p>
    <p>Manhours: $${formatCurrency(laborCost)}</p>${distance > 0 && totalHours > 0 ? `
    <p>Driving: $${formatCurrency(drivingCost)}</p>` : ''}${estimatorCost > 0 ? `
    <p>Estimator: $${formatCurrency(estimatorCost)}</p>` : ''}
    <p>Labor total: $${formatCurrency(laborCostWithDriving)}</p>
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
      const laborCost = totalLaborHours * rate
      const distance = parseFloat(selectedBidForPricing?.distance_from_office ?? '0') || 0
      const ratePerMile = (pricingCostEstimate as any).driving_cost_rate != null ? Number((pricingCostEstimate as any).driving_cost_rate) : 0.70
      const hrsPerTrip = (pricingCostEstimate as any).hours_per_trip != null ? Number((pricingCostEstimate as any).hours_per_trip) : 2.0
      const drivingCost = (totalLaborHours / hrsPerTrip) * ratePerMile * distance
      const estimatorCost = (pricingCostEstimate as any)?.estimator_cost_flat_amount != null
        ? Number((pricingCostEstimate as any).estimator_cost_flat_amount)
        : pricingCountRows.length * (Number((pricingCostEstimate as any)?.estimator_cost_per_count) || 10)
      const totalCost = totalMaterials + laborCost + drivingCost + estimatorCost
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
      const laborCost = totalLaborHours * rate
      const distance = parseFloat(selectedBidForPricing?.distance_from_office ?? '0') || 0
      const ratePerMile = (pricingCostEstimate as any).driving_cost_rate != null ? Number((pricingCostEstimate as any).driving_cost_rate) : 0.70
      const hrsPerTrip = (pricingCostEstimate as any).hours_per_trip != null ? Number((pricingCostEstimate as any).hours_per_trip) : 2.0
      const drivingCost = (totalLaborHours / hrsPerTrip) * ratePerMile * distance
      const estimatorCost = (pricingCostEstimate as any)?.estimator_cost_flat_amount != null
        ? Number((pricingCostEstimate as any).estimator_cost_flat_amount)
        : pricingCountRows.length * (Number((pricingCostEstimate as any)?.estimator_cost_per_count) || 10)
      const totalCost = totalMaterials + laborCost + drivingCost + estimatorCost
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
    pushLink('Project Folder:', b.drive_link?.trim() || null)
    y += lineHeight
    pushLink('Job Plans:', b.plans_link?.trim() || null)
    y += lineHeight
    pushLink('Count Tooling:', b.count_tooling_link?.trim() || null)
    y += lineHeight
    pushLink('Bid Submission:', b.bid_submission_link?.trim() || null)

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
    const { data: countDataReview } = await supabase.from('bids_count_rows').select('*').eq('bid_id', bidId).order('sequence_order', { ascending: true })
    const countRowsReview = (countDataReview as BidCountRow[]) ?? []
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
      const estimatorCostR = (estForReviewData as any)?.estimator_cost_flat_amount != null
        ? Number((estForReviewData as any).estimator_cost_flat_amount)
        : countRowsReview.length * (Number((estForReviewData as any)?.estimator_cost_per_count) || 10)
      reviewGroupCostEstimateAmount = totalMaterialsR + (totalHoursR * rateR) + drivingCostR + estimatorCostR
    }
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
    pushLink('Project Folder:', b.drive_link?.trim() || null)
    y += lineHeight
    pushLink('Job Plans:', b.plans_link?.trim() || null)
    y += lineHeight
    pushLink('Count Tooling:', b.count_tooling_link?.trim() || null)
    y += lineHeight
    pushLink('Bid Submission:', b.bid_submission_link?.trim() || null)

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
      const [laborRes, roughTotal, topTotal, trimTotal, countRes] = await Promise.all([
        supabase.from('cost_estimate_labor_rows').select('*').eq('cost_estimate_id', est.id).order('sequence_order', { ascending: true }),
        est.purchase_order_id_rough_in ? loadPOTotal(est.purchase_order_id_rough_in) : Promise.resolve(0),
        est.purchase_order_id_top_out ? loadPOTotal(est.purchase_order_id_top_out) : Promise.resolve(0),
        est.purchase_order_id_trim_set ? loadPOTotal(est.purchase_order_id_trim_set) : Promise.resolve(0),
        supabase.from('bids_count_rows').select('id').eq('bid_id', bidId),
      ])
      const laborRows = (laborRes.data as CostEstimateLaborRow[]) ?? []
      const countRowsForEst = (countRes.data as { id: string }[]) ?? []
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
      const estimatorCost = (est as any)?.estimator_cost_flat_amount != null
        ? Number((est as any).estimator_cost_flat_amount)
        : countRowsForEst.length * (Number((est as any)?.estimator_cost_per_count) || 10)
      const laborCostWithDriving = laborCost + drivingCost + estimatorCost
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
      if (estimatorCost > 0) {
        push(`Estimator cost: $${formatCurrency(estimatorCost)}`)
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
      if (estimatorCost > 0) {
        summaryRows.push(['Estimator', `$${formatCurrency(estimatorCost)}`])
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
      const customPrices = (await supabase.from('bid_count_row_custom_prices').select('*').eq('bid_id', bidId).eq('price_book_version_id', versionId)).data as BidCountRowCustomPrice[] ?? []
      const entriesById = new Map(entries.map((e) => [e.id, e]))
      countRows.forEach((countRow) => {
        const assignment = assignments.find((a) => a.count_row_id === countRow.id)
        const entry = assignment ? entriesById.get(assignment.price_book_entry_id) : entries.find((e) => (e.fixture_types?.name ?? '').toLowerCase() === (countRow.fixture ?? '').toLowerCase())
        const customPrice = customPrices.find((c) => c.count_row_id === countRow.id)?.unit_price
        const count = Number(countRow.count)
        const unitPrice = assignment?.unit_price_override ?? (entry ? Number(entry.total_price) : (customPrice ?? 0))
        const isFixedPrice = assignment?.is_fixed_price ?? false
        const revenue = isFixedPrice ? unitPrice : count * unitPrice
        coverLetterRevenue += revenue
        fixtureRows.push({ fixture: countRow.fixture ?? '', count: count })
      })
    }
    const useCustomAmount = coverLetterUseCustomAmountByBid[b.id] === true
    const customAmountStr = (coverLetterCustomAmountByBid[b.id] ?? '').replace(/,/g, '').trim()
    const customAmountNum = customAmountStr ? parseFloat(customAmountStr) : NaN
    const effectiveRevenue = useCustomAmount && !isNaN(customAmountNum) && customAmountNum >= 0 ? customAmountNum : coverLetterRevenue
    const revenueWords = numberToWords(effectiveRevenue).toUpperCase()
    const revenueNumber = `$${formatCurrency(effectiveRevenue)}`
    const inclusions = coverLetterInclusionsByBid[b.id] ?? DEFAULT_INCLUSIONS
    const exclusions = coverLetterExclusionsByBid[b.id] ?? DEFAULT_EXCLUSIONS
    const terms = coverLetterTermsByBid[b.id] ?? DEFAULT_TERMS_AND_WARRANTY
    const designDrawingPlanDateFormatted = (coverLetterIncludeDesignDrawingPlanDateByBid[b.id] !== false && b.design_drawing_plan_date) ? formatDesignDrawingPlanDate(b.design_drawing_plan_date) : null
    const effectiveIncludeFixtures = !designDrawingPlanDateFormatted || (coverLetterIncludeFixturesPerPlanByBid[b.id] !== false)
    const bidServiceType = serviceTypes.find((st) => st.id === b.service_type_id)
    const serviceTypeName = bidServiceType?.name ?? 'Plumbing'
    const coverLetterText = buildCoverLetterText(customerName, customerAddress, projectNameVal, projectAddressVal, revenueWords, revenueNumber, fixtureRows, inclusions, exclusions, terms, designDrawingPlanDateFormatted, serviceTypeName, coverLetterIncludeSignatureByBid[b.id] !== false, effectiveIncludeFixtures)
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

  async function printTakeoffBreakdown() {
    if (!selectedBidForTakeoff) return
    const mapped = takeoffMappings.filter((m) => m.templateId.trim())
    if (mapped.length === 0) {
      setError('No assemblies mapped. Select an assembly for at least one fixture to print.')
      return
    }
    setTakeoffPrinting(true)
    setError(null)
    try {
      const escapeHtml = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      const title = escapeHtml(bidDisplayName(selectedBidForTakeoff) || 'Bid') + ' — Takeoff Breakdown'
      const stages: TakeoffStage[] = ['rough_in', 'top_out', 'trim_set']
      const sectionHtmls: string[] = []

      for (const stage of stages) {
        const mappingsForStage = mapped.filter((m) => m.stage === stage)
        if (mappingsForStage.length === 0) continue

        const stageLabel = STAGE_LABELS[stage]
        const countRowIds = Array.from(new Set(mappingsForStage.map((m) => m.countRowId)))

        let stageHtml = `<h2 style="margin-top:1.5rem; margin-bottom:0.75rem; border-bottom:1px solid #ccc; padding-bottom:0.25rem">${stageLabel}</h2>`

        for (const countRowId of countRowIds) {
          const row = takeoffCountRows.find((r) => r.id === countRowId)
          const fixture = row?.fixture ?? '—'
          const count = row ? Number(row.count) : 0
          const mappingsForRow = mappingsForStage.filter((m) => m.countRowId === countRowId)

          // Parts for this count line item, with template association (don't merge so we keep template per part)
          const partsWithTemplate: Array<{ part_id: string; quantity: number; template_name: string }> = []
          for (const m of mappingsForRow) {
            const qty = Math.max(1, Math.round(Number(m.quantity)) || 1)
            const parts = await expandTemplate(supabase, m.templateId, qty)
            const templateName = materialTemplates.find((t) => t.id === m.templateId)?.name ?? '—'
            for (const { part_id, quantity } of parts) {
              partsWithTemplate.push({ part_id, quantity, template_name: templateName })
            }
          }

          const partIds = Array.from(new Set(partsWithTemplate.map((p) => p.part_id)))
          const { data: partsData } = await supabase.from('material_parts').select('id, name').in('id', partIds)
          const nameById = new Map<string, string>()
          for (const p of partsData ?? []) {
            if (p?.id) nameById.set(p.id, p.name ?? '')
          }

          const partRows = partsWithTemplate
            .sort((a, b) => {
              const nameCmp = (nameById.get(a.part_id) ?? '').localeCompare(nameById.get(b.part_id) ?? '')
              if (nameCmp !== 0) return nameCmp
              return a.template_name.localeCompare(b.template_name)
            })
            .map((p) => `<tr><td style="padding:0.25rem 0.5rem; border:1px solid #ccc">${escapeHtml(nameById.get(p.part_id) ?? p.part_id.slice(0, 8))}</td><td style="padding:0.25rem 0.5rem; text-align:center; border:1px solid #ccc">${p.quantity}</td><td style="padding:0.25rem 0.5rem; border:1px solid #ccc">${escapeHtml(p.template_name)}</td></tr>`)
            .join('')

          stageHtml += `
          <div style="margin-bottom:1rem">
            <h3 style="margin:0.5rem 0 0.25rem 0; font-size:1rem">${escapeHtml(fixture)} (Count: ${count})</h3>
            <table style="width:100%; border-collapse:collapse; font-size:0.875rem; margin-left:0.5rem">
              <thead style="background:#f9fafb"><tr><th style="padding:0.25rem 0.5rem; text-align:left; border:1px solid #ccc">Part</th><th style="padding:0.25rem 0.5rem; text-align:center; border:1px solid #ccc">Qty</th><th style="padding:0.25rem 0.5rem; text-align:left; border:1px solid #ccc">Assembly</th></tr></thead>
              <tbody>${partRows}</tbody>
            </table>
          </div>`
        }

        sectionHtmls.push(stageHtml)
      }

      if (sectionHtmls.length === 0) {
        setError('No mappings with assemblies to print.')
        return
      }

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
  body { font-family: sans-serif; margin: 1in; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
  th, td { border: 1px solid #ccc; padding: 0.25rem 0.5rem; }
  th { background: #f9fafb; }
  @media print { body { margin: 0.5in; } }
</style></head><body>
  <h1>${title}</h1>
  <p style="font-size:0.875rem; color:#6b7280">Breakdown of parts and assemblies per stage for audit.</p>
  ${sectionHtmls.join('')}
</body></html>`
      const win = window.open('', '_blank')
      if (!win) {
        setError('Popup blocked. Allow popups to print.')
        return
      }
      win.document.write(html)
      win.document.close()
      win.focus()
      win.print()
      win.onafterprint = () => win.close()
    } finally {
      setTakeoffPrinting(false)
    }
  }

  useEffect(() => {
    loadRole()
  }, [authUser?.id])

  const BIDS_TABS = ['bid-board', 'builder-review', 'counts', 'takeoffs', 'cost-estimate', 'pricing', 'cover-letter', 'submission-followup', 'rfi', 'change-order', 'lien-release'] as const

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('new') === 'true') {
      openNewBid()
      navigate('/bids', { replace: true })
      return
    }
    const bidId = params.get('bidId')
    const tab = params.get('tab')
    if (tab === 'builder-review') {
      setActiveTab('builder-review')
      return
    }
    if (bidId && tab === 'submission-followup') {
      const bid = bids.find((b) => b.id === bidId)
      if (bid) {
        setSelectedBidForSubmission(bid)
        setActiveTab('submission-followup')
        const sectionKey = (() => {
          if (bid.outcome === 'won') return 'won'
          if (bid.outcome === 'started_or_complete') return 'startedOrComplete'
          if (bid.outcome === 'lost') return 'lost'
          if (!bid.bid_date_sent) return 'unsent'
          return 'pending'
        })()
        setSubmissionSectionOpen((prev) => ({ ...prev, [sectionKey]: true }))
        setTimeout(() => {
          document.getElementById(`submission-row-${bid.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 150)
      } else if (serviceTypes.length > 0) {
        // Bid not in current list - may be different service type; fetch and switch
        supabase.from('bids').select('service_type_id').eq('id', bidId).single().then(({ data }) => {
          const row = data as { service_type_id: string } | null
          if (row && row.service_type_id !== selectedServiceTypeId) {
            setSelectedServiceTypeId(row.service_type_id)
          }
        })
      }
      return
    }
    const bidTabs = ['counts', 'takeoffs', 'cost-estimate', 'pricing', 'cover-letter', 'rfi', 'change-order', 'lien-release']
    if (bidId && tab && bidTabs.includes(tab)) {
      const bid = bids.find((b) => b.id === bidId)
      if (bid) {
        setSharedBid(bid)
        setActiveTab(tab as typeof activeTab)
      } else if (serviceTypes.length > 0) {
        supabase.from('bids').select('service_type_id').eq('id', bidId).single().then(({ data }) => {
          const row = data as { service_type_id: string } | null
          if (row && row.service_type_id !== selectedServiceTypeId) {
            setSelectedServiceTypeId(row.service_type_id)
          }
        })
      }
      return
    }
    if (tab && BIDS_TABS.includes(tab as typeof BIDS_TABS[number])) {
      setActiveTab(tab as typeof activeTab)
    } else if (!params.get('tab')) {
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'bid-board')
        return next
      }, { replace: true })
    }
  }, [location.search, bids, serviceTypes.length, selectedServiceTypeId, myRole])

  useEffect(() => {
    if (myRole === 'dev' || myRole === 'master_technician' || myRole === 'assistant' || myRole === 'estimator' || myRole === 'primary') {
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
  }, [myRole, estimatorServiceTypeIds, primaryServiceTypeIds])
  
  // Reload data when service type changes (skip when Builder Review is active; that tab loads all data)
  useEffect(() => {
    if (selectedServiceTypeId && activeTab !== 'builder-review' && (myRole === 'dev' || myRole === 'master_technician' || myRole === 'assistant' || myRole === 'estimator' || myRole === 'primary')) {
      const t = setTimeout(async () => {
        await Promise.all([loadCustomers(), loadBids(selectedServiceTypeId), loadCustomerContacts(), loadCustomerContactPersons(), loadEstimatorUsers(), loadFixtureTypes(), loadPartTypes(), loadSupplyHouses(), loadTakeoffBookVersions(), loadLaborBookVersions(), loadPriceBookVersions(), loadMaterialTemplates()])
      }, 80)
      return () => clearTimeout(t)
    }
  }, [selectedServiceTypeId, activeTab, myRole])

  // Load all customers and bids when Builder Review tab is active (no service type filter)
  useEffect(() => {
    if (activeTab === 'builder-review' && (myRole === 'dev' || myRole === 'master_technician' || myRole === 'assistant' || myRole === 'estimator' || myRole === 'primary')) {
      const t = setTimeout(async () => {
        await Promise.all([
          loadCustomers(),
          loadBids(null), // load all bids (no service type filter)
          loadCustomerContacts(),
          loadCustomerContactPersons(),
          loadEstimatorUsers(),
          loadFixtureTypes(),
          loadPartTypes(),
          loadSupplyHouses(),
          loadTakeoffBookVersions(),
          loadLaborBookVersions(),
          loadPriceBookVersions(),
          loadMaterialTemplates()
        ])
      }, 80)
      return () => clearTimeout(t)
    }
  }, [activeTab, myRole])

  // Builder Review PIA: load from localStorage (per user)
  useEffect(() => {
    if (!authUser?.id || typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(`bids_builder_review_pia_${authUser.id}`)
      if (raw) {
        const arr = JSON.parse(raw) as string[]
        if (Array.isArray(arr)) setBuilderReviewPiaCustomerIds(new Set(arr))
      }
    } catch {
      // ignore parse errors
    }
  }, [authUser?.id])

  // Close price book modals when service type changes
  useEffect(() => {
    setPricingVersionFormOpen(false)
    setPricingEntryFormOpen(false)
    setDeletePricingVersionModalOpen(false)
    setEditingPricingVersion(null)
    setEditingPricingEntry(null)
    setPricingVersionToDelete(null)
    setPricingVersionNameInput('')
    setPricingEntryFixtureName('')
    setPricingEntryRoughIn('')
    setPricingEntryTopOut('')
    setPricingEntryTrimSet('')
    setPricingEntryTotal('')
    setDeletePricingVersionNameInput('')
    setDeletePricingVersionError(null)
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
        .select('id, labor_rate, purchase_order_id_rough_in, purchase_order_id_top_out, purchase_order_id_trim_set, driving_cost_rate, hours_per_trip, estimator_cost_per_count, estimator_cost_flat_amount')
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
      const [laborRes, roughTotal, topTotal, trimTotal, bidRes, countRes] = await Promise.all([
        supabase.from('cost_estimate_labor_rows').select('*').eq('cost_estimate_id', est.id),
        est.purchase_order_id_rough_in ? loadPOTotal(est.purchase_order_id_rough_in) : Promise.resolve(0),
        est.purchase_order_id_top_out ? loadPOTotal(est.purchase_order_id_top_out) : Promise.resolve(0),
        est.purchase_order_id_trim_set ? loadPOTotal(est.purchase_order_id_trim_set) : Promise.resolve(0),
        supabase.from('bids').select('distance_from_office').eq('id', bidId).maybeSingle(),
        supabase.from('bids_count_rows').select('id').eq('bid_id', bidId),
      ])
      if (cancelled) return
      const laborRows = (laborRes.data as CostEstimateLaborRow[]) ?? []
      const bidData = bidRes.data as { distance_from_office: string | null } | null
      const countRowsData = (countRes.data as { id: string }[]) ?? []
      const totalMaterials = (roughTotal ?? 0) + (topTotal ?? 0) + (trimTotal ?? 0)
      const totalHours = laborRows.reduce(
        (s, r) => s + laborRowHours(r),
        0
      )
      const rate = est.labor_rate != null ? Number(est.labor_rate) : 0
      const laborCost = totalHours * rate
      const distance = parseFloat(bidData?.distance_from_office ?? '0') || 0
      const ratePerMile = (est as any).driving_cost_rate != null ? Number((est as any).driving_cost_rate) : 0.70
      const hrsPerTrip = (est as any).hours_per_trip != null ? Number((est as any).hours_per_trip) : 2.0
      const drivingCost = totalHours > 0 ? (totalHours / hrsPerTrip) * ratePerMile * distance : 0
      const estimatorCost = (est as any)?.estimator_cost_flat_amount != null
        ? Number((est as any).estimator_cost_flat_amount)
        : countRowsData.length * (Number((est as any)?.estimator_cost_per_count) || 10)
      const grandTotal = totalMaterials + laborCost + drivingCost + estimatorCost
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
    if (!partPricesModal) {
      setPartPricesModalData(null)
      setPartPricesModalEditing({})
      setPartPricesModalAddSupplyHouseId('')
      setPartPricesModalAddPrice('')
      return
    }
    setPartPricesModalData('loading')
    supabase
      .from('material_part_prices')
      .select('id, price, supply_house_id, supply_houses(name)')
      .eq('part_id', partPricesModal.partId)
      .order('price', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          setPartPricesModalData(null)
          return
        }
        const rows = (data ?? []).map((r: { id: string; price: number; supply_house_id: string; supply_houses: { name: string } | null }) => ({
          price_id: r.id,
          supply_house_name: (r.supply_houses as { name: string } | null)?.name ?? '—',
          supply_house_id: r.supply_house_id,
          price: r.price,
        }))
        setPartPricesModalData(rows)
        setPartPricesModalEditing({})
      })
  }, [partPricesModal?.partId])

  async function updatePartPriceInModal(priceId: string, newPrice: number) {
    if (!partPricesModal) return
    setPartPricesModalUpdating(priceId)
    const { error } = await supabase.from('material_part_prices').update({ price: newPrice }).eq('id', priceId)
    setPartPricesModalUpdating(null)
    if (error) {
      setError(`Failed to update price: ${error.message}`)
      return
    }
    setPartPricesModalData((prev) => {
      if (!prev || prev === 'loading') return prev
      return prev.map((row) => (row.price_id === priceId ? { ...row, price: newPrice } : row))
    })
    setPartPricesModalEditing((prev) => {
      const next = { ...prev }
      delete next[priceId]
      return next
    })
  }

  async function addPartPriceInModal(supplyHouseId: string, price: number) {
    if (!partPricesModal) return
    setPartPricesModalAdding(true)
    const { data, error } = await supabase
      .from('material_part_prices')
      .insert({ part_id: partPricesModal.partId, supply_house_id: supplyHouseId, price })
      .select('id, price, supply_house_id, supply_houses(name)')
      .single()
    setPartPricesModalAdding(false)
    if (error) {
      setError(`Failed to add price: ${error.message}`)
      return
    }
    const raw = data as { id: string; supply_houses?: { name: string } | null } | null
    const supplyHouseName = raw?.supply_houses?.name ?? supplyHouses.find((sh) => sh.id === supplyHouseId)?.name ?? '—'
    setPartPricesModalData((prev) => {
      if (!prev || prev === 'loading') return prev
      return [...prev, { price_id: raw!.id, supply_house_name: supplyHouseName, supply_house_id: supplyHouseId, price }]
    })
    setPartPricesModalAddSupplyHouseId('')
    setPartPricesModalAddPrice('')
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if (activeTab === 'takeoffs') {
        loadMaterialTemplates()
        loadDraftPOs()
        loadTakeoffBookVersions()
      }
      if (activeTab === 'pricing' || activeTab === 'cover-letter' || activeTab === 'submission-followup') {
        loadPriceBookVersions()
      }
    }, 80)
    return () => clearTimeout(t)
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
      const t = setTimeout(() => {
        loadPurchaseOrdersForCostEstimate()
        loadLaborBookVersions()
      }, 80)
      return () => clearTimeout(t)
    }
  }, [activeTab])

  // Autosave for Cost Estimate tab
  useEffect(() => {
    if (activeTab !== 'cost-estimate' || !costEstimate) return

    const timer = setTimeout(async () => {
      setCostEstimateAutosaveStatus('saving')
      
      const laborRateNum = laborRateInput.trim() === '' ? null : parseFloat(laborRateInput)
      const drivingCostRateNum = drivingCostRate.trim() === '' ? 0.70 : parseFloat(drivingCostRate)
      const hoursPerTripNum = hoursPerTrip.trim() === '' ? 2.0 : parseFloat(hoursPerTrip)
      
      // Skip autosave if validation fails
      if (laborRateInput.trim() !== '' && (isNaN(laborRateNum!) || laborRateNum! < 0)) return
      if (isNaN(drivingCostRateNum) || drivingCostRateNum < 0) return
      if (isNaN(hoursPerTripNum) || hoursPerTripNum <= 0) return
      const estimatorCostPerCountNum = estimatorCostUseFlat ? null : (parseFloat(estimatorCostPerCount) || 10)
      const estimatorCostFlatAmountNum = estimatorCostUseFlat && estimatorCostFlatAmount.trim() !== '' ? parseFloat(estimatorCostFlatAmount) : null
      if (estimatorCostUseFlat && estimatorCostFlatAmount.trim() !== '' && (isNaN(estimatorCostFlatAmountNum!) || estimatorCostFlatAmountNum! < 0)) return
      if (!estimatorCostUseFlat && (isNaN(estimatorCostPerCountNum!) || estimatorCostPerCountNum! < 0)) return
      
      // Save cost estimate fields
      await supabase
        .from('cost_estimates')
        .update({
          purchase_order_id_rough_in: costEstimate.purchase_order_id_rough_in || null,
          purchase_order_id_top_out: costEstimate.purchase_order_id_top_out || null,
          purchase_order_id_trim_set: costEstimate.purchase_order_id_trim_set || null,
          labor_rate: laborRateNum,
          driving_cost_rate: drivingCostRateNum,
          hours_per_trip: hoursPerTripNum,
          estimator_cost_per_count: estimatorCostPerCountNum,
          estimator_cost_flat_amount: estimatorCostFlatAmountNum,
        })
        .eq('id', costEstimate.id)
      
      // Save labor rows
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
      
      setCostEstimateAutosaveStatus('saved')
      setTimeout(() => setCostEstimateAutosaveStatus('idle'), 2000)
    }, 1500) // 1.5 second debounce

    return () => clearTimeout(timer)
  }, [activeTab, costEstimate, laborRateInput, drivingCostRate, hoursPerTrip, estimatorCostUseFlat, estimatorCostPerCount, estimatorCostFlatAmount, costEstimateLaborRows])

  // Auto-calculate price book entry total
  useEffect(() => {
    const rough = parseFloat(pricingEntryRoughIn) || 0
    const top = parseFloat(pricingEntryTopOut) || 0
    const trim = parseFloat(pricingEntryTrimSet) || 0
    const calculatedTotal = rough + top + trim
    
    // Only auto-update if the current total is different (allows manual override)
    if (calculatedTotal !== (parseFloat(pricingEntryTotal) || 0)) {
      setPricingEntryTotal(calculatedTotal.toFixed(2))
    }
  }, [pricingEntryRoughIn, pricingEntryTopOut, pricingEntryTrimSet])

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
      setBidCountRowCustomPrices([])
      setPricingCountRows([])
      setPricingCostEstimate(null)
      setPricingLaborRows([])
      setPricingMaterialTotalRoughIn(null)
      setPricingMaterialTotalTopOut(null)
      setPricingMaterialTotalTrimSet(null)
      setPricingLaborRate(null)
      return
    }
    const controller = new AbortController()
    const signal = controller.signal
    const bidId = selectedBidForPricing.id
    const bidJustChanged = pricingBidIdRef.current !== bidId
    let versionId: string | null
    if (bidJustChanged) {
      pricingBidIdRef.current = bidId
      const savedVersionId = selectedBidForPricing.selected_price_book_version_id
      if (savedVersionId) {
        setSelectedPricingVersionId(savedVersionId)
        versionId = savedVersionId
      } else if (priceBookVersions.length > 0) {
        // Auto-select "Default" if it exists, otherwise first version
        const defaultVersion = priceBookVersions.find((v) => v.name === 'Default')
        const versionToUse = defaultVersion ?? priceBookVersions[0]
        setSelectedPricingVersionId(versionToUse?.id ?? null)
        versionId = versionToUse?.id ?? null
      } else {
        setSelectedPricingVersionId(null)
        versionId = null
      }
    } else {
      versionId = selectedPricingVersionId
    }
    loadBidPricingAssignments(bidId, versionId, signal)
    loadPricingDataForBid(bidId, signal)
    return () => controller.abort()
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
    setCountToolingLink('')
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
    setSubmittedTo('')
    setOutcome('')
    setBidValue('')
    setAgreedValue('')
    setProfit('')
    setDistanceFromOffice('')
    setLastContact('')
    setNotes('')
    setFormServiceTypeId(selectedServiceTypeId)
    setProjectContactExpanded(true)
    setBidFormOpen(true)
    setError(null)
  }

  function openNewBidWithCustomer(customer: Customer) {
    setEditingBid(null)
    setDriveLink('')
    setPlansLink('')
    setCountToolingLink('')
    setBidSubmissionLink('')
    setDesignDrawingPlanDate('')
    setGcCustomerId(customer.id)
    setGcCustomerSearch(getCustomerDisplay(customer))
    setProjectName('')
    setAddress(customer.address ?? '')
    setGcContactName('')
    setGcContactPhone('')
    setGcContactEmail('')
    setEstimatorId('')
    setAccountManagerId(authUser?.id ?? '')
    setBidDueDate('')
    setEstimatedJobStartDate('')
    setBidDateSent('')
    setSubmittedTo('')
    setOutcome('')
    setBidValue('')
    setAgreedValue('')
    setProfit('')
    setDistanceFromOffice('')
    setLastContact('')
    setNotes('')
    setFormServiceTypeId(selectedServiceTypeId)
    setProjectContactExpanded(true)
    setBidFormOpen(true)
    setError(null)
  }

  function openEditBid(bid: BidWithBuilder) {
    setEditingBid(bid)
    setDriveLink(bid.drive_link ?? '')
    setPlansLink(bid.plans_link ?? '')
    setCountToolingLink(bid.count_tooling_link ?? '')
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
    setSubmittedTo((bid as { submitted_to?: string | null }).submitted_to ?? '')
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
    setProjectContactExpanded(true)
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
      count_tooling_link: countToolingLink.trim() || null,
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
      submitted_to: submittedTo.trim() || null,
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
      count_tooling_link: countToolingLink.trim() || null,
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
      submitted_to: submittedTo.trim() || null,
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
    if (!editingBid && formServiceTypeId && formServiceTypeId !== selectedServiceTypeId) {
      setSelectedServiceTypeId(formServiceTypeId)
    }
    const rows = await loadBids(editingBid ? undefined : formServiceTypeId)
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
    const bid = rows.find((b) => b.id === bidId)
    if (bid) {
      setSharedBid(bid)
      setActiveTab('counts')
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'counts')
        next.set('bidId', bidId)
        return next
      }, { replace: true })
    } else {
      setActiveTab('counts')
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'counts')
        return next
      }, { replace: true })
    }
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

  const bidsForBidBoardDisplay = filteredBidsForBidBoard.filter((b) => b.outcome !== 'lost')

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

  // Builder Review: customers sorted by last contact (oldest or newest first, nulls last)
  const builderReviewCustomersSorted = useMemo(() => {
    function getLastContactForCustomer(customerId: string): string | null {
      const customerBids = bids.filter((b) => b.customer_id === customerId)
      const customerContactDates = customerContacts.filter((c: CustomerContact) => c.customer_id === customerId).map((c: CustomerContact) => c.contact_date)
      const dates: string[] = [...customerContactDates]
      for (const bid of customerBids) {
        if (bid.last_contact) dates.push(bid.last_contact)
        const entryDate = lastContactFromEntries[bid.id]
        if (entryDate) dates.push(entryDate)
      }
      if (dates.length === 0) return null
      return dates.reduce((a, b) => (new Date(b) > new Date(a) ? b : a))
    }
    const asc = builderReviewSortOrder === 'oldest-first'
    return [...customers].sort((a, b) => {
      const aDate = getLastContactForCustomer(a.id)
      const bDate = getLastContactForCustomer(b.id)
      if (!aDate && !bDate) return a.name.localeCompare(b.name)
      if (!aDate) return 1
      if (!bDate) return -1
      return asc ? aDate.localeCompare(bDate) : bDate.localeCompare(aDate)
    })
  }, [customers, bids, customerContacts, lastContactFromEntries, builderReviewSortOrder])

  const builderReviewCustomersFiltered = useMemo(() => {
    let list = builderReviewCustomersSorted
    // When Oldest first: exclude PIA customers (they are ignored in the sort order)
    if (builderReviewSortOrder === 'oldest-first' && builderReviewPiaCustomerIds.size > 0) {
      list = list.filter((c) => !builderReviewPiaCustomerIds.has(c.id))
    }
    if (!builderReviewSearchQuery.trim()) return list
    const q = builderReviewSearchQuery.toLowerCase().trim()
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.address?.toLowerCase().includes(q) ?? false)
    )
  }, [builderReviewCustomersSorted, builderReviewSearchQuery, builderReviewSortOrder, builderReviewPiaCustomerIds])

  // When Oldest first: PIA customers that were excluded (for showing in "PIA (excluded)" section)
  const builderReviewPiaCustomersExcluded = useMemo(() => {
    if (builderReviewSortOrder !== 'oldest-first' || builderReviewPiaCustomerIds.size === 0) return []
    let list = builderReviewCustomersSorted.filter((c) => builderReviewPiaCustomerIds.has(c.id))
    if (builderReviewSearchQuery.trim()) {
      const q = builderReviewSearchQuery.toLowerCase().trim()
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.address?.toLowerCase().includes(q) ?? false)
      )
    }
    return list
  }, [builderReviewCustomersSorted, builderReviewSearchQuery, builderReviewSortOrder, builderReviewPiaCustomerIds])

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

  // For estimators or primaries with restrictions, only show allowed service types
  const visibleServiceTypes = (myRole === 'estimator' && estimatorServiceTypeIds && estimatorServiceTypeIds.length > 0)
    ? serviceTypes.filter((st) => estimatorServiceTypeIds.includes(st.id))
    : (myRole === 'primary' && primaryServiceTypeIds && primaryServiceTypeIds.length > 0)
      ? serviceTypes.filter((st) => primaryServiceTypeIds.includes(st.id))
      : serviceTypes

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        Loading…
      </div>
    )
  }

  if (myRole !== 'dev' && myRole !== 'master_technician' && myRole !== 'assistant' && myRole !== 'estimator' && myRole !== 'primary') {
    return (
      <div style={{ padding: '2rem' }}>
        <p>You do not have access to Bids.</p>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .pageWrap {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 0.5rem !important;
          }
        }
      `}</style>
      <div className="pageWrap" style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {error && (
          <div style={{ padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: 4, marginBottom: '1rem' }}>
            {error}
          </div>
        )}

      {/* Service Type Filter - for estimators with restrictions, only show allowed types; grayed out on Builder Review */}
      {visibleServiceTypes.length > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          opacity: activeTab === 'builder-review' ? 0.5 : 1,
          pointerEvents: activeTab === 'builder-review' ? 'none' : 'auto',
          cursor: activeTab === 'builder-review' ? 'not-allowed' : 'default'
        }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {visibleServiceTypes.map(st => (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  if (st.id !== selectedServiceTypeId) {
                    setSelectedServiceTypeId(st.id)
                    closeSharedBidAndClearUrl()
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
          <button
            type="button"
            onClick={openNewBid}
            style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            New Bid
          </button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', borderBottom: '2px solid #e5e7eb', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => {
            setActiveTab('bid-board')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'bid-board')
              return next
            })
          }}
          style={tabStyle(activeTab === 'bid-board')}
        >
          Bid Board
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('builder-review')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'builder-review')
              return next
            })
          }}
          style={tabStyle(activeTab === 'builder-review')}
        >
          Builder Review
        </button>
        <span style={{ color: '#9ca3af', padding: '0 0.1rem', position: 'relative', top: '-1px', fontSize: '0.875rem' }}>|</span>
        <button
          type="button"
          onClick={() => {
            setActiveTab('counts')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'counts')
              return next
            })
          }}
          style={bidsTabStyle(activeTab === 'counts', 'counts')}
        >
          Counts
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('takeoffs')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'takeoffs')
              return next
            })
          }}
          style={tabStyle(activeTab === 'takeoffs')}
        >
          Takeoffs
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('cost-estimate')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'cost-estimate')
              return next
            })
          }}
          style={tabStyle(activeTab === 'cost-estimate')}
        >
          Cost Estimate
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('pricing')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'pricing')
              return next
            })
          }}
          style={bidsTabStyle(activeTab === 'pricing', 'pricing')}
        >
          Pricing
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('cover-letter')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'cover-letter')
              return next
            })
          }}
          style={bidsTabStyle(activeTab === 'cover-letter', 'cover-letter')}
        >
          Cover Letter
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('submission-followup')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'submission-followup')
              return next
            })
          }}
          style={tabStyle(activeTab === 'submission-followup')}
        >
          Submission & Followup
        </button>
        <span style={{ color: '#9ca3af', padding: '0 0.1rem', position: 'relative', top: '-1px', fontSize: '0.875rem' }}>|</span>
        <button
          type="button"
          onClick={() => {
            setActiveTab('rfi')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'rfi')
              return next
            })
          }}
          style={tabStyle(activeTab === 'rfi')}
        >
          RFI
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('change-order')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'change-order')
              return next
            })
          }}
          style={tabStyle(activeTab === 'change-order')}
        >
          Change Order
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('lien-release')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'lien-release')
              return next
            })
          }}
          style={tabStyle(activeTab === 'lien-release')}
        >
          Lien Release
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
            </div>
          </div>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={{ padding: 0, textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Project<br />Folder</th>
                  <th style={{ padding: 0, textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Job<br />Plans</th>
                  <th style={{ padding: 0, textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Count<br />Tool</th>
                  <th style={{ padding: 0, textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Bid<br />Sub</th>
                  <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>GC/Builder</th>
                  <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Project Name</th>
                  <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Address</th>
                  <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Account<br />Man</th>
                  <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Bid</th>
                  <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Bid<br />Date</th>
                  <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Distance<br />to Office</th>
                  <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Last<br />Contact</th>
                  <th style={{ padding: 0, textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Counts</th>
                  <th style={{ padding: '0.0625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }} title="Edit" aria-label="Edit" />
                </tr>
              </thead>
              <tbody>
                {bidsForBidBoardDisplay.length === 0 ? (
                  <tr>
                    <td colSpan={14} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                      {filteredBidsForBidBoard.length === 0
                        ? (bids.length === 0 ? 'No bids yet. Click New Bid to add one.' : 'No bids match your search.')
                        : 'No bids to show (all matching bids are lost).'}
                    </td>
                  </tr>
                ) : (
                  bidsForBidBoardDisplay.map((bid) => (
                    <tr key={bid.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: 0, textAlign: 'center' }}>
                        {bid.drive_link ? (
                          <a href={bid.drive_link} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser(bid.drive_link!) }} style={{ color: '#3b82f6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={20} height={20} fill="currentColor">
                              <path d="M129.5 464L179.5 304L558.9 304L508.9 464L129.5 464zM320.2 512L509 512C530 512 548.6 498.4 554.8 478.3L604.8 318.3C614.5 287.4 591.4 256 559 256L179.6 256C158.6 256 140 269.6 133.8 289.7L112.2 358.4L112.2 160C112.2 151.2 119.4 144 128.2 144L266.9 144C270.4 144 273.7 145.1 276.5 147.2L314.9 176C328.7 186.4 345.6 192 362.9 192L480.2 192C489 192 496.2 199.2 496.2 208L544.2 208C544.2 172.7 515.5 144 480.2 144L362.9 144C356 144 349.2 141.8 343.7 137.6L305.3 108.8C294.2 100.5 280.8 96 266.9 96L128.2 96C92.9 96 64.2 124.7 64.2 160L64.2 448C64.2 483.3 92.9 512 128.2 512L320.2 512z"/>
                            </svg>
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td style={{ padding: 0, textAlign: 'center' }}>
                        {bid.plans_link ? (
                          <a href={bid.plans_link} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser(bid.plans_link!) }} style={{ color: '#3b82f6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={20} height={20} fill="currentColor">
                              <path d="M304 112L192 112C183.2 112 176 119.2 176 128L176 512C176 520.8 183.2 528 192 528L448 528C456.8 528 464 520.8 464 512L464 272L376 272C336.2 272 304 239.8 304 200L304 112zM444.1 224L352 131.9L352 200C352 213.3 362.7 224 376 224L444.1 224zM128 128C128 92.7 156.7 64 192 64L325.5 64C342.5 64 358.8 70.7 370.8 82.7L493.3 205.3C505.3 217.3 512 233.6 512 250.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM387.4 496L252.6 496C236.8 496 224 483.2 224 467.4C224 461 226.1 454.9 230 449.8L297.6 362.9C303 356 311.3 352 320 352C328.7 352 337 356 342.4 362.9L410 449.9C413.9 454.9 416 461.1 416 467.5C416 483.3 403.2 496.1 387.4 496.1zM240 288C257.7 288 272 302.3 272 320C272 337.7 257.7 352 240 352C222.3 352 208 337.7 208 320C208 302.3 222.3 288 240 288z"/>
                            </svg>
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td style={{ padding: 0, textAlign: 'center' }} title="Count Tool">
                        {bid.count_tooling_link ? (
                          <a href={bid.count_tooling_link} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser(bid.count_tooling_link!) }} style={{ color: '#3b82f6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={20} height={20} fill="currentColor">
                              <path d="M192 112L304 112L304 200C304 239.8 336.2 272 376 272L464 272L464 512C464 520.8 456.8 528 448 528L192 528C183.2 528 176 520.8 176 512L176 128C176 119.2 183.2 112 192 112zM352 131.9L444.1 224L376 224C362.7 224 352 213.3 352 200L352 131.9zM192 64C156.7 64 128 92.7 128 128L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 250.5C512 233.5 505.3 217.2 493.3 205.2L370.7 82.7C358.7 70.7 342.5 64 325.5 64L192 64zM298.2 359.6C306.8 349.5 305.7 334.4 295.6 325.8C285.5 317.2 270.4 318.3 261.8 328.4L213.8 384.4C206.1 393.4 206.1 406.6 213.8 415.6L261.8 471.6C270.4 481.7 285.6 482.8 295.6 474.2C305.6 465.6 306.8 450.4 298.2 440.4L263.6 400L298.2 359.6zM378.2 328.4C369.6 318.3 354.4 317.2 344.4 325.8C334.4 334.4 333.2 349.6 341.8 359.6L376.4 400L341.8 440.4C333.2 450.5 334.3 465.6 344.4 474.2C354.5 482.8 369.6 481.7 378.2 471.6L426.2 415.6C433.9 406.6 433.9 393.4 426.2 384.4L378.2 328.4z"/>
                            </svg>
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td style={{ padding: 0, textAlign: 'center' }} title="Bid Submission">
                        {bid.bid_submission_link ? (
                          <a href={bid.bid_submission_link} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser(bid.bid_submission_link!) }} style={{ color: '#3b82f6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={20} height={20} fill="currentColor">
                              <path d="M240 112L128 112C119.2 112 112 119.2 112 128L112 512C112 520.8 119.2 528 128 528L208 528L208 576L128 576C92.7 576 64 547.3 64 512L64 128C64 92.7 92.7 64 128 64L261.5 64C278.5 64 294.8 70.7 306.8 82.7L429.3 205.3C441.3 217.3 448 233.6 448 250.6L448 400.1L400 400.1L400 272.1L312 272.1C272.2 272.1 240 239.9 240 200.1L240 112.1zM380.1 224L288 131.9L288 200C288 213.3 298.7 224 312 224L380.1 224zM272 444L304 444C337.1 444 364 470.9 364 504C364 537.1 337.1 564 304 564L292 564L292 592C292 603 283 612 272 612C261 612 252 603 252 592L252 464C252 453 261 444 272 444zM304 524C315 524 324 515 324 504C324 493 315 484 304 484L292 484L292 524L304 524zM400 444L432 444C460.7 444 484 467.3 484 496L484 560C484 588.7 460.7 612 432 612L400 612C389 612 380 603 380 592L380 464C380 453 389 444 400 444zM432 572C438.6 572 444 566.6 444 560L444 496C444 489.4 438.6 484 432 484L420 484L420 572L432 572zM508 464C508 453 517 444 528 444L576 444C587 444 596 453 596 464C596 475 587 484 576 484L548 484L548 508L576 508C587 508 596 517 596 528C596 539 587 548 576 548L548 548L548 592C548 603 539 612 528 612C517 612 508 603 508 592L508 464z"/>
                            </svg>
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
                            {(() => {
                              const formatted = formatAddressWithoutZip(bid.address)
                              const lines = addressLines(formatted)
                              if (lines.length <= 1) return formatted
                              return <>{lines[0]}<br />{lines[1]}</>
                            })()}
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
                          {bid.last_contact ? (() => {
                            const s = formatShortDate(bid.last_contact)
                            const spaceIdx = s.indexOf(' ')
                            if (spaceIdx < 0) return s
                            return <>{s.slice(0, spaceIdx)}<br />{s.slice(spaceIdx + 1)}</>
                          })() : '+'}
                        </button>
                      </td>
                      <td style={{ padding: 0, textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => selectBidAndSyncUrl(bid, 'counts')}
                          title="Open in Counts"
                          style={{ padding: 0, background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#3b82f6' }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = '#6b7280' }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={20} height={20} fill="currentColor" aria-hidden>
                            <path d="M348 62.7C330.7 52.7 309.3 52.7 292 62.7L207.8 111.3C190.5 121.3 179.8 139.8 179.8 159.8L179.8 261.7L91.5 312.7C74.2 322.7 63.5 341.2 63.5 361.2L63.5 458.5C63.5 478.5 74.2 497 91.5 507L175.8 555.6C193.1 565.6 214.5 565.6 231.8 555.6L320.1 504.6L408.4 555.6C425.7 565.6 447.1 565.6 464.4 555.6L548.5 507C565.8 497 576.5 478.5 576.5 458.5L576.5 361.2C576.5 341.2 565.8 322.7 548.5 312.7L460.2 261.7L460.2 159.8C460.2 139.8 449.5 121.3 432.2 111.3L348 62.7zM296 356.6L296 463.1L207.7 514.1C206.5 514.8 205.1 515.2 203.7 515.2L203.7 409.9L296 356.6zM527.4 357.2C528.1 358.4 528.5 359.8 528.5 361.2L528.5 458.5C528.5 461.4 527 464 524.5 465.4L440.2 514C439 514.7 437.6 515.1 436.2 515.1L436.2 409.8L527.4 357.2zM412.3 159.8L412.3 261.7L320 315L320 208.5L411.2 155.9C411.9 157.1 412.3 158.5 412.3 159.9z"/>
                          </svg>
                        </button>
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

      {/* Builder Review Tab */}
      {activeTab === 'builder-review' && (
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => newCustomerModal?.openNewCustomerModal({ onCreated: loadCustomers })}
              style={{
                padding: '0.5rem 1rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                fontWeight: 500,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              New Customer
            </button>
            <input
              type="text"
              placeholder="Search builders..."
              value={builderReviewSearchQuery}
              onChange={(e) => setBuilderReviewSearchQuery(e.target.value)}
              style={{ flex: 1, minWidth: 200, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }}
            />
            <button
              type="button"
              onClick={() => setBuilderReviewSortOrder((prev) => (prev === 'oldest-first' ? 'newest-first' : 'oldest-first'))}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #d1d5db',
                background: builderReviewSortOrder === 'oldest-first' ? '#f3f4f6' : '#eff6ff',
                color: builderReviewSortOrder === 'oldest-first' ? '#374151' : '#3b82f6',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              {builderReviewSortOrder === 'oldest-first' ? 'Oldest first' : 'Newest first'}
            </button>
            <button
              type="button"
              onClick={() => setBuilderReviewCardExpanded(Object.fromEntries(builderReviewCustomersFiltered.map((c) => [c.id, false])))}
              style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: '#f3f4f6', color: '#374151', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
            >
              Collapse all
            </button>
            <button
              type="button"
              onClick={() => setBuilderReviewCardExpanded({})}
              style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: '#f3f4f6', color: '#374151', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
            >
              Expand all
            </button>
          </div>
          <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
            Sorted by last contact. Add outreach not tied to bids via General contact. PIA = ignore when Oldest first.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {builderReviewCustomersFiltered.map((customer) => {
              const customerBids = bids.filter((b) => b.customer_id === customer.id)
              const brUnsent = customerBids.filter((b) => !b.bid_date_sent && b.outcome !== 'won' && b.outcome !== 'lost' && b.outcome !== 'started_or_complete')
              const brPending = customerBids.filter((b) => b.bid_date_sent && b.outcome !== 'won' && b.outcome !== 'lost' && b.outcome !== 'started_or_complete')
              const brWon = customerBids.filter((b) => b.outcome === 'won')
              const brStartedOrComplete = customerBids.filter((b) => b.outcome === 'started_or_complete')
              const brLost = customerBids.filter((b) => b.outcome === 'lost')
              const hasBids = customerBids.length > 0
              const lastContact = (() => {
                const dates: string[] = customerContacts.filter((c: CustomerContact) => c.customer_id === customer.id).map((c: CustomerContact) => c.contact_date)
                for (const bid of customerBids) {
                  if (bid.last_contact) dates.push(bid.last_contact)
                  const ed = lastContactFromEntries[bid.id]
                  if (ed) dates.push(ed)
                }
                if (dates.length === 0) return null
                return dates.reduce((a, b) => (new Date(b) > new Date(a) ? b : a))
              })()
              const isCardExpanded = builderReviewCardExpanded[customer.id] !== false
              return (
                <div key={customer.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: 'white' }}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleBuilderReviewCard(customer.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleBuilderReviewCard(customer.id) } }}
                    style={{
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                      background: '#f9fafb',
                      borderBottom: isCardExpanded ? '1px solid #e5e7eb' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.875rem', color: '#6b7280' }} aria-hidden>{isCardExpanded ? '\u25BC' : '\u25B6'}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div>
                          <strong>{customer.name}</strong>
                          {customer.address && <span style={{ marginLeft: '0.5rem', color: '#6b7280', fontSize: '0.875rem' }}>{customer.address}</span>}
                        </div>
                        {customer.address && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{ display: 'inline-flex', alignItems: 'center', color: '#2563eb', textDecoration: 'none', cursor: 'pointer' }}
                            title={`View ${customer.address} on map`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: '16px', height: '16px', fill: 'currentColor' }}>
                              <path d="M576 112C576 103.7 571.7 96 564.7 91.6C557.7 87.2 548.8 86.8 541.4 90.5L416.5 152.1L244 93.4C230.3 88.7 215.3 89.6 202.1 95.7L77.8 154.3C69.4 158.2 64 166.7 64 176L64 528C64 536.2 68.2 543.9 75.1 548.3C82 552.7 90.7 553.2 98.2 549.7L225.5 489.8L396.2 546.7C409.9 551.3 424.7 550.4 437.8 544.2L562.2 485.7C570.6 481.7 576 473.3 576 464L576 112zM208 146.1L208 445.1L112 490.3L112 191.3L208 146.1zM256 449.4L256 148.3L384 191.8L384 492.1L256 449.4zM432 198L528 150.6L528 448.8L432 494L432 198z" />
                            </svg>
                          </a>
                        )}
                        {(() => {
                          const contactInfo = extractContactInfo(customer.contact_info ?? null)
                          const phone = contactInfo.phone?.trim()
                          const email = contactInfo.email?.trim()
                          return (
                            <>
                              {phone && (
                                <a
                                  href={`tel:${phone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ display: 'inline-flex', alignItems: 'center', color: '#2563eb', textDecoration: 'none', cursor: 'pointer' }}
                                  title={`Call ${phone}`}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: '16px', height: '16px', fill: 'currentColor' }}>
                                    <path d="M224.2 89C216.3 70.1 195.7 60.1 176.1 65.4L170.6 66.9C106 84.5 50.8 147.1 66.9 223.3C104 398.3 241.7 536 416.7 573.1C493 589.3 555.5 534 573.1 469.4L574.6 463.9C580 444.2 569.9 423.6 551.1 415.8L453.8 375.3C437.3 368.4 418.2 373.2 406.8 387.1L368.2 434.3C297.9 399.4 241.3 341 208.8 269.3L253 233.3C266.9 222 271.6 202.9 264.8 186.3L224.2 89z" />
                                  </svg>
                                </a>
                              )}
                              {email && (
                                <a
                                  href={`mailto:${email}`}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ display: 'inline-flex', alignItems: 'center', color: '#2563eb', textDecoration: 'none', cursor: 'pointer' }}
                                  title={`Email ${email}`}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: '16px', height: '16px', fill: 'currentColor' }}>
                                    <path d="M320 128C214 128 128 214 128 320C128 426 214 512 320 512C337.7 512 352 526.3 352 544C352 561.7 337.7 576 320 576C178.6 576 64 461.4 64 320C64 178.6 178.6 64 320 64C461.4 64 576 178.6 576 320L576 352C576 405 533 448 480 448C450.7 448 424.4 434.8 406.8 414.1C384 435.1 353.5 448 320 448C249.3 448 192 390.7 192 320C192 249.3 249.3 192 320 192C347.9 192 373.7 200.9 394.7 216.1C400.4 211.1 407.8 208 416 208C433.7 208 448 222.3 448 240L448 352C448 369.7 462.3 384 480 384C497.7 384 512 369.7 512 352L512 320C512 214 426 128 320 128zM384 320C384 284.7 355.3 256 320 256C284.7 256 256 284.7 256 320C256 355.3 284.7 384 320 384C355.3 384 384 355.3 384 320z" />
                                  </svg>
                                </a>
                              )}
                            </>
                          )
                        })()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap' }} title="Ignore when Oldest first is selected">
                        <input
                          type="checkbox"
                          checked={builderReviewPiaCustomerIds.has(customer.id)}
                          onChange={(e) => {
                            const checked = e.target.checked
                            setBuilderReviewPiaCustomerIds((prev) => {
                              const next = new Set(prev)
                              if (checked) next.add(customer.id)
                              else next.delete(customer.id)
                              if (authUser?.id && typeof window !== 'undefined') {
                                localStorage.setItem(`bids_builder_review_pia_${authUser.id}`, JSON.stringify([...next]))
                              }
                              return next
                            })
                          }}
                        />
                        PIA
                      </label>
                      <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        Last contact: {lastContact ? formatTimeSinceLastContact(lastContact) : '—'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setAddContactPersonModalCustomer(customer)
                          setEditingContactPerson(null)
                          setContactPersonName('')
                          setContactPersonPhones([''])
                          setContactPersonEmail('')
                          setContactPersonNote('')
                        }}
                        title="Add contact person"
                        style={{ padding: '0.375rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                          <path d="M160 64C124.7 64 96 92.7 96 128L96 512C96 547.3 124.7 576 160 576L448 576C483.3 576 512 547.3 512 512L512 128C512 92.7 483.3 64 448 64L160 64zM272 352L336 352C380.2 352 416 387.8 416 432C416 440.8 408.8 448 400 448L208 448C199.2 448 192 440.8 192 432C192 387.8 227.8 352 272 352zM248 256C248 225.1 273.1 200 304 200C334.9 200 360 225.1 360 256C360 286.9 334.9 312 304 312C273.1 312 248 286.9 248 256zM576 144C576 135.2 568.8 128 560 128C551.2 128 544 135.2 544 144L544 208C544 216.8 551.2 224 560 224C568.8 224 576 216.8 576 208L576 144zM576 272C576 263.2 568.8 256 560 256C551.2 256 544 263.2 544 272L544 336C544 344.8 551.2 352 560 352C568.8 352 576 344.8 576 336L576 272zM560 384C551.2 384 544 391.2 544 400L544 464C544 472.8 551.2 480 560 480C568.8 480 576 472.8 576 464L576 400C576 391.2 568.8 384 560 384z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddContactModalCustomer(customer)
                          setAddContactModalDate(new Date().toLocaleDateString('en-CA'))
                          setAddContactModalDetails('')
                        }}
                        title="General contact"
                        style={{ padding: '0.375rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                          <path d="M160 544C124.7 544 96 515.3 96 480L96 160C96 124.7 124.7 96 160 96L480 96C515.3 96 544 124.7 544 160L544 373.5C544 390.5 537.3 406.8 525.3 418.8L418.7 525.3C406.7 537.3 390.4 544 373.4 544L160 544zM485.5 368L392 368C378.7 368 368 378.7 368 392L368 485.5L485.5 368z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openNewBidWithCustomer(customer) }}
                        title="New Bid"
                        style={{ padding: '0.375rem 0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem', fontWeight: 500 }}
                      >
                        <span style={{ lineHeight: 1 }}>+</span>
                        New Bid
                      </button>
                    </div>
                  </div>
                  {isCardExpanded && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      <div style={{ display: 'flex', gap: '1.5rem', padding: '0.75rem 1.25rem' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {hasBids && (
                          <div>
                            {[
                              { key: 'unsent' as const, label: 'Unsent', bids: brUnsent },
                              { key: 'pending' as const, label: 'Not yet won or lost', bids: brPending },
                              { key: 'won' as const, label: 'Won', bids: brWon },
                              { key: 'startedOrComplete' as const, label: 'Started or Complete', bids: brStartedOrComplete },
                              { key: 'lost' as const, label: 'Lost', bids: brLost },
                            ].map(({ key, label, bids: sectionBids }) => (
                              <div key={key}>
                                <button
                                  type="button"
                                  onClick={() => toggleBuilderReviewSection(key)}
                                  style={{ margin: '0.5rem 0 0.25rem', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
                                >
                                  <span>{builderReviewSectionOpen[key] ? '\u25BC' : '\u25B6'}</span>
                                  {label} ({sectionBids.length})
                                </button>
                                {builderReviewSectionOpen[key] && sectionBids.length > 0 && (
                                  <ul style={{ margin: '0.25rem 0 0.5rem 1.5rem', padding: 0, listStyle: 'none' }}>
                                    {sectionBids.map((bid) => (
                                      <li key={bid.id} style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <button
                                          type="button"
                                          onClick={() => openEditBid(bid)}
                                          style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', textDecoration: 'underline', padding: 0, textAlign: 'left', fontSize: '0.875rem' }}
                                        >
                                          {formatBidNameWithValue(bid)}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedBidForSubmission(bid)
                                            setActiveTab('submission-followup')
                                            setScrollToContactFromBidBoard(true)
                                          }}
                                          title="View submissions"
                                          style={{ padding: '0.125rem', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#6b7280' }}
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                                            <path d="M480 272C480 317.9 465.1 360.3 440 394.7L566.6 521.4C579.1 533.9 579.1 554.2 566.6 566.7C554.1 579.2 533.8 579.2 521.3 566.7L394.7 440C360.3 465.1 317.9 480 272 480C157.1 480 64 386.9 64 272C64 157.1 157.1 64 272 64C386.9 64 480 157.1 480 272zM272 416C351.5 416 416 351.5 416 272C416 192.5 351.5 128 272 128C192.5 128 128 192.5 128 272C128 351.5 192.5 416 272 416z" />
                                          </svg>
                                        </button>
                                        {' — '}
                                        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                          due {formatDateYYMMDD(bid.bid_due_date)}, {getBidStatusLabel(bid)}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {(() => {
                          const contacts = customerContacts
                            .filter((c: CustomerContact) => c.customer_id === customer.id)
                            .sort((a, b) => (new Date(b.contact_date).getTime() - new Date(a.contact_date).getTime()))
                          if (contacts.length === 0) return null
                          return (
                            <div style={{ marginTop: hasBids ? '1rem' : 0, paddingTop: hasBids ? '1rem' : 0, borderTop: hasBids ? '1px solid #e5e7eb' : 'none' }}>
                              <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                General contact
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="14" height="14" fill="currentColor" aria-hidden="true">
                                  <path d="M160 544C124.7 544 96 515.3 96 480L96 160C96 124.7 124.7 96 160 96L480 96C515.3 96 544 124.7 544 160L544 373.5C544 390.5 537.3 406.8 525.3 418.8L418.7 525.3C406.7 537.3 390.4 544 373.4 544L160 544zM485.5 368L392 368C378.7 368 368 378.7 368 392L368 485.5L485.5 368z" />
                                </svg>
                              </div>
                              <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                  <thead style={{ background: '#f9fafb' }}>
                                    <tr>
                                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Contact method</th>
                                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Notes</th>
                                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Time and date</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {contacts.map((cc) => (
                                      <tr key={cc.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                        <td style={{ padding: '0.75rem' }}>—</td>
                                        <td style={{ padding: '0.75rem' }}>{cc.details ?? '—'}</td>
                                        <td style={{ padding: '0.75rem' }}>{cc.contact_date ? new Date(cc.contact_date).toLocaleString() : '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                      <div style={{ width: 220, flexShrink: 0 }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Contact persons</div>
                        {customerContactPersons
                          .filter((cp) => cp.customer_id === customer.id)
                          .map((cp) => (
                            <div key={cp.id} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '0.5rem 0.75rem', marginBottom: '0.5rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.25rem' }}>
                                <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{cp.name}</div>
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingContactPerson(cp)
                                      setAddContactPersonModalCustomer(customer)
                                      setContactPersonName(cp.name)
                                      const phones = (cp.phone ?? '').split('\n').filter(Boolean)
                                      setContactPersonPhones(phones.length > 0 ? phones : [''])
                                      setContactPersonEmail(cp.email ?? '')
                                      setContactPersonNote(cp.note ?? '')
                                    }}
                                    title="Edit"
                                    style={{ padding: '0.125rem', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: '#6b7280' }}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="12" height="12" fill="currentColor"><path d="M416 128L512 224L192 544L96 544L96 448L416 128zM444 64L544 64L576 96L576 196L544 228L444 196L444 64zM128 480L176 480L496 160L448 112L128 432L128 480z" /></svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!confirm('Delete this contact?')) return
                                      await supabase.from('customer_contact_persons').delete().eq('id', cp.id)
                                      await loadCustomerContactPersons()
                                    }}
                                    title="Delete"
                                    style={{ padding: '0.125rem', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: '#b91c1c' }}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="12" height="12" fill="currentColor"><path d="M160 128H96V96H256V64H160V128zM288 64V96H544V128H480V512C480 547.3 451.3 576 416 576H224C188.7 576 160 547.3 160 512V128H96V512C96 569.4 142.6 616 200 616H440C497.4 616 544 569.4 544 512V128H288V64zM224 128H416V512H224V128zM288 192V480H352V192H288zM416 192V480H480V192H416z" /></svg>
                                  </button>
                                </div>
                              </div>
                              {(cp.phone ?? '').split('\n').filter(Boolean).map((phone, i) => (
                                <a key={i} href={`tel:${phone}`} style={{ fontSize: '0.8125rem', color: '#2563eb', textDecoration: 'none', display: 'block' }}>{phone}</a>
                              ))}
                              {cp.email && (
                                <a href={`mailto:${cp.email}`} style={{ fontSize: '0.8125rem', color: '#2563eb', textDecoration: 'none', display: 'block' }}>{cp.email}</a>
                              )}
                              {cp.note && (
                                <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 4 }}>{cp.note}</div>
                              )}
                            </div>
                          ))}
                        {customerContactPersons.filter((cp) => cp.customer_id === customer.id).length === 0 && (
                          <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>No contacts yet</div>
                        )}
                      </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0.5rem 1.25rem', borderTop: '1px solid #e5e7eb', background: '#fafafa' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            editCustomerModal?.openEditCustomerModal(customer.id, { onSaved: loadCustomers })
                          }}
                          style={{
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.875rem',
                            background: '#f3f4f6',
                            color: '#374151',
                            border: '1px solid #d1d5db',
                            borderRadius: 4,
                            fontWeight: 500,
                            cursor: 'pointer',
                          }}
                        >
                          Edit Customer
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {builderReviewPiaCustomersExcluded.length > 0 && (
              <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.75rem' }}>PIA (excluded from Oldest first)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {builderReviewPiaCustomersExcluded.map((customer) => (
                    <label key={customer.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                      <input
                        type="checkbox"
                        checked
                        onChange={() => {
                          setBuilderReviewPiaCustomerIds((prev) => {
                            const next = new Set(prev)
                            next.delete(customer.id)
                            if (authUser?.id && typeof window !== 'undefined') {
                              localStorage.setItem(`bids_builder_review_pia_${authUser.id}`, JSON.stringify([...next]))
                            }
                            return next
                          })
                        }}
                      />
                      {customer.name}
                      {customer.address && <span style={{ color: '#6b7280' }}>{customer.address}</span>}
                    </label>
                  ))}
                </div>
              </div>
            )}
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
                    onClick={handleCountsImportFromTooling}
                    style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                    title="Copy from /Tooling first, then click to import tab-delimited rows (Fixture, Count, Plan Page)"
                  >
                    Import from /Tooling
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditBid(selectedBidForCounts)}
                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Edit Bid
                  </button>
                  <button
                    type="button"
                    onClick={closeSharedBidAndClearUrl}
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
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', width: 132 }}>Count<span style={{ color: '#FF6600' }}>*</span></th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', width: '50%' }}>Fixture or Tie-in<span style={{ color: '#FF6600' }}>*</span></th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Group/Tag</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Plan Page</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }} aria-label="Actions"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {countRows.map((row, index) => (
                      <CountRow
                        key={row.id}
                        row={row}
                        index={index}
                        totalCount={countRows.length}
                        moveDisabled={movingCountRow}
                        highlight={lastMovedId === row.id}
                        onUpdate={refreshAfterCountsChange}
                        onDelete={refreshAfterCountsChange}
                        onMoveUp={() => moveCountRowById(row.id, 'up')}
                        onMoveDown={() => moveCountRowById(row.id, 'down')}
                      />
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
                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setAddingCountRow(true)}
                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Add row
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCountsImportText(''); setCountsImportError(null); setCountsImportOpen(true) }}
                    style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Import
                  </button>
                </div>
              )}
            </div>
          )}
          {countsImportOpen && selectedBidForCounts && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, maxWidth: 500, width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
                <h2 style={{ margin: '0 0 1rem 0' }}>Import Counts</h2>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                  Paste from Excel or enter one row per line. Use tab or comma to separate columns.
                </p>
                <textarea
                  value={countsImportText}
                  onChange={(e) => { setCountsImportText(e.target.value); setCountsImportError(null) }}
                  placeholder={'Fixture or Tie-in\tCount\tPlan Page (optional)\nToilet\t5\tA-101\nLavatory Sink\t3\n4 columns: Fixture\tCount\tGroup/Tag\tPlan Page'}
                  rows={8}
                  style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem', fontFamily: 'monospace', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box', resize: 'vertical' }}
                />
                {countsImportError && (
                  <p style={{ color: '#b91c1c', fontSize: '0.875rem', marginTop: '0.5rem', marginBottom: 0 }}>{countsImportError}</p>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => { setCountsImportOpen(false); setCountsImportText(''); setCountsImportError(null) }}
                    style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCountsImport}
                    disabled={!countsImportText.trim()}
                    title={!countsImportText.trim() ? 'Paste fixture/count data to import' : undefined}
                    style={{
                      padding: '0.5rem 1rem',
                      background: countsImportText.trim() ? '#059669' : '#d1d5db',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      cursor: countsImportText.trim() ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Import
                  </button>
                  {!countsImportText.trim() && (
                    <span style={{ fontSize: '0.8rem', color: '#FF6600', marginLeft: '0.5rem' }}>Paste data to import</span>
                  )}
                </div>
              </div>
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
                      onClick={() => selectBidAndSyncUrl(bid, 'counts')}
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
                    onClick={() => { closeSharedBidAndClearUrl(); setTakeoffCreatedPOId(null) }}
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
                    <button
                      type="button"
                      onClick={printTakeoffBreakdown}
                      disabled={takeoffPrinting || takeoffMappedCount === 0}
                      style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: takeoffPrinting || takeoffMappedCount === 0 ? 'not-allowed' : 'pointer' }}
                    >
                      {takeoffPrinting ? 'Preparing…' : 'Print Breakdown'}
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
                    <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>Items (parts or assembly)</div>
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
                        <thead style={{ background: '#f9fafb' }}><tr><th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Type</th><th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Name</th><th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Qty</th><th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Prices</th><th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}></th></tr></thead>
                        <tbody>
                          {takeoffNewTemplateItems.length === 0 ? (
                            <tr><td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>No items yet. Add parts or nested assemblies above.</td></tr>
                          ) : (
                            takeoffNewTemplateItems.map((item, idx) => {
                              const name = item.item_type === 'part' && item.part_id ? (takeoffAddTemplateParts.find((p) => p.id === item.part_id)?.name ?? '—') : item.item_type === 'template' && item.nested_template_id ? (materialTemplates.find((t) => t.id === item.nested_template_id)?.name ?? '—') : '—'
                              return (
                                <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>{item.item_type === 'part' ? 'Part' : 'Assembly'}</td>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>{name}</td>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>
                                    <input
                                      type="number"
                                      min={1}
                                      value={item.quantity}
                                      onChange={(e) => updateTakeoffNewTemplateItemQuantity(idx, parseInt(e.target.value, 10) || 1)}
                                      style={{ width: 64, padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                                    />
                                  </td>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>
                                    {item.item_type === 'part' && item.part_id ? (
                                      <button type="button" onClick={() => setPartPricesModal({ partId: item.part_id!, partName: name })} style={{ padding: '0.25rem 0.5rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 4, cursor: 'pointer' }}>Prices</button>
                                    ) : '—'}
                                  </td>
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
                      onClick={() => selectBidAndSyncUrl(bid, 'takeoffs')}
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
                    onClick={() => { closeSharedBidAndClearUrl(); setTakeoffCreatedPOId(null) }}
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
                    onClick={closeSharedBidAndClearUrl}
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
                  {/* Estimator Cost Parameters */}
                  <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#fef3c7', borderRadius: 4, border: '1px solid #fde68a' }}>
                    <h4 style={{ margin: 0, marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>Estimator Cost Parameters</h4>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                        <input
                          type="checkbox"
                          checked={estimatorCostUseFlat}
                          onChange={(e) => setEstimatorCostUseFlat(e.target.checked)}
                        />
                        Use flat amount
                      </label>
                      <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>|</span>
                      {estimatorCostUseFlat ? (
                        <div>
                          <label style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>Flat amount ($)</label>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={estimatorCostFlatAmount}
                            onChange={(e) => setEstimatorCostFlatAmount(e.target.value)}
                            onWheel={(e) => e.currentTarget.blur()}
                            style={{ width: '6rem', padding: '0.375rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                          />
                        </div>
                      ) : (
                        <div>
                          <label style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>Per count row ($)</label>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={estimatorCostPerCount}
                            onChange={(e) => setEstimatorCostPerCount(e.target.value)}
                            onWheel={(e) => e.currentTarget.blur()}
                            style={{ width: '6rem', padding: '0.375rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                          />
                        </div>
                      )}
                    </div>
                    {(() => {
                      const countRows = costEstimateCountRows.length
                      const estimatorCost = estimatorCostUseFlat
                        ? (estimatorCostFlatAmount.trim() !== '' ? parseFloat(estimatorCostFlatAmount) || 0 : 0)
                        : countRows * (parseFloat(estimatorCostPerCount) || 10)
                      return (
                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem' }}>
                          Estimator cost: {estimatorCostUseFlat ? `$${formatCurrency(estimatorCost)}` : `${countRows} Count Types × $${(parseFloat(estimatorCostPerCount) || 10).toFixed(2)} = $${formatCurrency(estimatorCost)}`}
                        </p>
                      )
                    })()}
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
                      const estimatorCost = estimatorCostUseFlat
                        ? (estimatorCostFlatAmount.trim() !== '' ? parseFloat(estimatorCostFlatAmount) || 0 : 0)
                        : costEstimateCountRows.length * (parseFloat(estimatorCostPerCount) || 10)
                      const laborCostWithDriving = laborCost + drivingCost + estimatorCost
                      const materialsWithTax = totalMaterials * (1 + parseFloat(costEstimatePOModalTaxPercent || '8.25') / 100)
                      const grandTotal = materialsWithTax + laborCostWithDriving
                      return (
                        <>
                          <p style={{ margin: '0.25rem 0', textAlign: 'right', fontWeight: 600 }}>Materials with tax: ${formatCurrency(materialsWithTax)}</p>
                          <p style={{ margin: '0.25rem 0', textAlign: 'right' }}>Manhours: ${formatCurrency(laborCost)}</p>
                          <p style={{ margin: '0.25rem 0', textAlign: 'right' }}>Driving: ${formatCurrency(drivingCost)}</p>
                          <p style={{ margin: '0.25rem 0', textAlign: 'right' }}>Estimator: ${formatCurrency(estimatorCost)}</p>
                          <p style={{ margin: '0.25rem 0', textAlign: 'right', fontWeight: 600 }}>
                            Labor total: ${formatCurrency(laborCostWithDriving)}
                          </p>
                          <p style={{ margin: '0.5rem 0 0', fontWeight: 700, fontSize: '1.125rem', textAlign: 'right' }}>Grand total: ${formatCurrency(grandTotal)}</p>
                        </>
                      )
                    })()}
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {costEstimateAutosaveStatus === 'saving' && (
                        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Saving...</span>
                      )}
                      {costEstimateAutosaveStatus === 'saved' && (
                        <span style={{ fontSize: '0.875rem', color: '#059669' }}>✓ Saved</span>
                      )}
                      {costEstimateAutosaveStatus === 'idle' && (
                        <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Autosave enabled</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={saveCostEstimate}
                      disabled={savingCostEstimate || !costEstimate}
                      style={{ padding: '0.35rem 0.75rem', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, cursor: savingCostEstimate ? 'wait' : 'pointer', fontSize: '0.875rem' }}
                    >
                      {savingCostEstimate ? 'Saving…' : 'Save Now'}
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
                        onClick={() => selectBidAndSyncUrl(bid, 'cost-estimate')}
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
                    onClick={closeSharedBidAndClearUrl}
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
                const laborCost = totalLaborHours * rate
                const distance = parseFloat(selectedBidForPricing?.distance_from_office ?? '0') || 0
                const ratePerMile = (pricingCostEstimate as any).driving_cost_rate != null ? Number((pricingCostEstimate as any).driving_cost_rate) : 0.70
                const hrsPerTrip = (pricingCostEstimate as any).hours_per_trip != null ? Number((pricingCostEstimate as any).hours_per_trip) : 2.0
                const numTrips = totalLaborHours / hrsPerTrip
                const drivingCost = numTrips * ratePerMile * distance
                const estimatorCost = (pricingCostEstimate as any)?.estimator_cost_flat_amount != null
                  ? Number((pricingCostEstimate as any).estimator_cost_flat_amount)
                  : pricingCountRows.length * (Number((pricingCostEstimate as any)?.estimator_cost_per_count) || 10)
                const totalCost = totalMaterials + laborCost + drivingCost + estimatorCost
                const entriesById = new Map(priceBookEntries.map((e) => [e.id, e]))
                let totalRevenue = 0
                const rows = pricingCountRows.map((countRow) => {
                  const assignment = bidPricingAssignments.find((a) => a.count_row_id === countRow.id)
                  const entry = assignment ? entriesById.get(assignment.price_book_entry_id) : priceBookEntries.find((e) => (e.fixture_types?.name ?? '').toLowerCase() === (countRow.fixture ?? '').toLowerCase())
                  const customPrice = bidCountRowCustomPrices.find((c) => c.count_row_id === countRow.id)?.unit_price
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
                  const unitPrice = assignment?.unit_price_override ?? (entry ? Number(entry.total_price) : (customPrice ?? 0))
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
                    unitPrice,
                    revenue,
                    margin,
                    flag,
                    assignment,
                    customPrice: customPrice ?? null,
                    materialsBeforeTax,
                    materialsWithTax,
                    taxAmount,
                    laborCost,
                    materialsFromTakeoff: materialsFromTakeoff ?? null,
                  }
                })
                return (
                  <>
                  {pricingViewModel === 'cost' && (
                  <div style={{ marginBottom: '1rem', marginLeft: 'auto', padding: '0.75rem 1rem', background: '#fef3c7', borderRadius: 4, border: '1px solid #fde68a', width: 'fit-content' }}>
                    <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>Our cost breakdown</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem', fontSize: '0.875rem' }}>
                      <span>Materials: ${formatCurrency(totalMaterials)} {totalCost > 0 ? `| ${((totalMaterials / totalCost) * 100).toFixed(1)}%` : ''}</span>
                      <span>Manhours: ${formatCurrency(laborCost)} {totalCost > 0 ? `| ${((laborCost / totalCost) * 100).toFixed(1)}%` : ''}</span>
                      {distance > 0 && totalLaborHours > 0 && (
                        <span>Driving: ${formatCurrency(drivingCost)} <span style={{ color: '#6b7280', fontWeight: 400 }}>({numTrips.toFixed(1)} trips × ${ratePerMile.toFixed(2)}/mi × {distance.toFixed(0)} mi)</span> {totalCost > 0 ? `| ${((drivingCost / totalCost) * 100).toFixed(1)}%` : ''}</span>
                      )}
                      {estimatorCost > 0 && (
                        <span>Estimator: ${formatCurrency(estimatorCost)} {totalCost > 0 ? `| ${((estimatorCost / totalCost) * 100).toFixed(1)}%` : ''}</span>
                      )}
                      <span style={{ fontWeight: 600 }}>Total cost: ${formatCurrency(totalCost)}</span>
                    </div>
                  </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, marginRight: '0.25rem' }}>View:</span>
                    <button
                      type="button"
                      onClick={() => setPricingViewModel('cost')}
                      style={{
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.8125rem',
                        border: '1px solid #d1d5db',
                        borderRadius: 4,
                        background: pricingViewModel === 'cost' ? '#e5e7eb' : 'white',
                        cursor: 'pointer',
                        fontWeight: pricingViewModel === 'cost' ? 600 : 400,
                        color: pricingViewModel === 'cost' ? '#111827' : '#6b7280',
                        boxShadow: pricingViewModel === 'cost' ? '0 0 0 2px #374151' : 'none'
                      }}
                    >
                      Cost Model
                    </button>
                    <button
                      type="button"
                      onClick={() => setPricingViewModel('price')}
                      style={{
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.8125rem',
                        border: '1px solid #d1d5db',
                        borderRadius: 4,
                        background: pricingViewModel === 'price' ? '#e5e7eb' : 'white',
                        cursor: 'pointer',
                        fontWeight: pricingViewModel === 'price' ? 600 : 400,
                        color: pricingViewModel === 'price' ? '#111827' : '#6b7280',
                        boxShadow: pricingViewModel === 'price' ? '0 0 0 2px #374151' : 'none'
                      }}
                    >
                      Price Model
                    </button>
                  </div>
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'visible' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ background: '#f9fafb' }}>
                        <tr>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Fixture or Tie-in</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Count</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                              Price book entry
                              <button
                                type="button"
                                onClick={() => {
                                  setPricingAssignmentSearches((prev) => {
                                    const next = { ...prev }
                                    for (const row of rows) {
                                      const fixture = row.countRow.fixture ?? ''
                                      next[row.countRow.id] = fixture.slice(0, 3)
                                    }
                                    return next
                                  })
                                }}
                                style={{
                                  padding: '0.2rem 0.4rem',
                                  fontSize: '0.75rem',
                                  background: '#f3f4f6',
                                  border: '1px solid #d1d5db',
                                  borderRadius: 4,
                                  cursor: 'pointer'
                                }}
                                title="Pre-fill first 3 letters of each fixture into search"
                              >
                                partial-fill
                              </button>
                            </span>
                          </th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>{pricingViewModel === 'cost' ? 'Our cost' : 'Unit Cost'}</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Revenue</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>{pricingViewModel === 'cost' ? 'Margin %' : '% of Total'}</th>
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
                            <td style={{ padding: '0.75rem', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                              {pricingViewModel === 'cost' ? (
                                `$${formatCurrency(row.cost)}`
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end' }}>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={unitPriceEditValues[row.countRow.id] ?? (row.unitPrice > 0 ? formatCurrency(row.unitPrice) : '')}
                                    onFocus={() => {
                                      if (unitPriceEditValues[row.countRow.id] == null) {
                                        setUnitPriceEditValues((prev) => ({ ...prev, [row.countRow.id]: row.unitPrice > 0 ? row.unitPrice.toFixed(2) : '' }))
                                      }
                                    }}
                                    onChange={(e) => setUnitPriceEditValues((prev) => ({ ...prev, [row.countRow.id]: e.target.value }))}
                                    onBlur={() => {
                                      const raw = (unitPriceEditValues[row.countRow.id] ?? String(row.unitPrice)).replace(/,/g, '')
                                      const v = parseFloat(raw)
                                      const bookPrice = row.entry ? Number(row.entry.total_price) : 0
                                      if (raw.trim() === '' || isNaN(v)) {
                                        updateUnitPriceOverride(row.countRow.id, null)
                                      } else if (row.entry && Math.abs(v - bookPrice) <= 0.001) {
                                        updateUnitPriceOverride(row.countRow.id, null)
                                      } else {
                                        updateUnitPriceOverride(row.countRow.id, v)
                                      }
                                    }}
                                    disabled={savingUnitPriceOverride === row.countRow.id}
                                    placeholder={row.entry ? `$${formatCurrency(row.entry.total_price)}` : '—'}
                                    style={{
                                      width: '7rem',
                                      padding: '0.35rem 0.5rem',
                                      border: '1px solid #d1d5db',
                                      borderRadius: 4,
                                      textAlign: 'right',
                                      background: (row.assignment?.unit_price_override != null || row.customPrice != null) ? '#fef9c3' : 'white',
                                      fontSize: '0.875rem'
                                    }}
                                  />
                                  {(row.assignment?.unit_price_override != null || row.customPrice != null) && (
                                    <button
                                      type="button"
                                      onClick={() => updateUnitPriceOverride(row.countRow.id, null)}
                                      title={row.assignment ? 'Reset to price book' : 'Clear custom price'}
                                      aria-label={row.assignment ? 'Reset to price book' : 'Clear custom price'}
                                      disabled={savingUnitPriceOverride === row.countRow.id}
                                      style={{
                                        padding: '0.15rem',
                                        background: 'none',
                                        border: 'none',
                                        cursor: savingUnitPriceOverride === row.countRow.id ? 'not-allowed' : 'pointer',
                                        color: '#6b7280',
                                        fontSize: '0.75rem'
                                      }}
                                    >
                                      Reset
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>${formatCurrency(row.revenue)}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                              {pricingViewModel === 'cost'
                                ? (row.margin != null ? `${row.margin.toFixed(1)}%` : '—')
                                : (totalRevenue > 0 ? `${((row.revenue / totalRevenue) * 100).toFixed(1)}%` : '—')}
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                              {pricingViewModel === 'cost' && row.flag && (
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
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>{pricingViewModel === 'cost' ? `$${formatCurrency(totalCost)}` : '—'}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>${formatCurrency(totalRevenue)}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            {pricingViewModel === 'cost'
                              ? (totalRevenue > 0 ? `${(((totalRevenue - totalCost) / totalRevenue) * 100).toFixed(1)}%` : '—')
                              : '100%'}
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            {pricingViewModel === 'cost' && totalRevenue > 0 && (() => {
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
                  </>
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
                      <dt style={{ margin: 0 }}>{pricingViewModel === 'cost' ? 'Our cost' : 'Unit Cost'}</dt>
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
                      onClick={() => selectBidAndSyncUrl(bid, 'pricing')}
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
                      <input type="number" min={0} step={1} value={pricingEntryRoughIn} onChange={(e) => setPricingEntryRoughIn(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Top Out</label>
                      <input type="number" min={0} step={1} value={pricingEntryTopOut} onChange={(e) => setPricingEntryTopOut(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Trim Set</label>
                      <input type="number" min={0} step={1} value={pricingEntryTrimSet} onChange={(e) => setPricingEntryTrimSet(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Total (auto-calculated)</label>
                      <input type="number" min={0} step={1} value={pricingEntryTotal} readOnly style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box', background: '#f9fafb', cursor: 'not-allowed' }} />
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
                        onClick={() => selectBidAndSyncUrl(bid, 'cover-letter')}
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
              const customPrice = bidCountRowCustomPrices.find((c) => c.count_row_id === countRow.id)?.unit_price
              const count = Number(countRow.count)
              const unitPrice = assignment?.unit_price_override ?? (entry ? Number(entry.total_price) : (customPrice ?? 0))
              const isFixedPrice = assignment?.is_fixed_price ?? false
              const revenue = isFixedPrice ? unitPrice : count * unitPrice
              coverLetterRevenue += revenue
            })
            const useCustomAmount = coverLetterUseCustomAmountByBid[bid.id] === true
            const customAmountStr = (coverLetterCustomAmountByBid[bid.id] ?? '').replace(/,/g, '').trim()
            const customAmountNum = customAmountStr ? parseFloat(customAmountStr) : NaN
            const effectiveRevenue = useCustomAmount && !isNaN(customAmountNum) && customAmountNum >= 0 ? customAmountNum : coverLetterRevenue
            const isBidValueSynced = bid.bid_value != null && bid.bid_value === effectiveRevenue
            const revenueWords = numberToWords(effectiveRevenue).toUpperCase()
            const revenueNumber = `$${formatCurrency(effectiveRevenue)}`
            const fixtureRows = pricingCountRows.map((r) => ({ fixture: r.fixture ?? '', count: Number(r.count) }))
            const inclusions = coverLetterInclusionsByBid[bid.id] ?? DEFAULT_INCLUSIONS
            const inclusionsDisplay = coverLetterInclusionsByBid[bid.id] ?? DEFAULT_INCLUSIONS
            const exclusions = coverLetterExclusionsByBid[bid.id] ?? ''
            const exclusionsDisplay = coverLetterExclusionsByBid[bid.id] ?? DEFAULT_EXCLUSIONS
            const terms = coverLetterTermsByBid[bid.id] ?? ''
            const termsDisplay = coverLetterTermsByBid[bid.id] ?? DEFAULT_TERMS_AND_WARRANTY
            const designDrawingPlanDateFormatted = (coverLetterIncludeDesignDrawingPlanDateByBid[bid.id] !== false && bid.design_drawing_plan_date) ? formatDesignDrawingPlanDate(bid.design_drawing_plan_date) : null
            const effectiveIncludeFixtures = !designDrawingPlanDateFormatted || (coverLetterIncludeFixturesPerPlanByBid[bid.id] !== false)
            const bidServiceType = serviceTypes.find((st) => st.id === bid.service_type_id)
            const serviceTypeName = bidServiceType?.name ?? 'Plumbing'
            const combinedText = buildCoverLetterText(customerName, customerAddress, projectNameVal, projectAddressVal, revenueWords, revenueNumber, fixtureRows, inclusions, exclusions, terms, designDrawingPlanDateFormatted, serviceTypeName, coverLetterIncludeSignatureByBid[bid.id] !== false, effectiveIncludeFixtures)
            const combinedHtml = buildCoverLetterHtml(customerName, customerAddress, projectNameVal, projectAddressVal, revenueWords, revenueNumber, fixtureRows, inclusions, exclusions, terms, designDrawingPlanDateFormatted, serviceTypeName, coverLetterIncludeSignatureByBid[bid.id] !== false, effectiveIncludeFixtures)
            const now = new Date()
            const yy = now.getFullYear() % 100
            const mm = String(now.getMonth() + 1).padStart(2, '0')
            const dd = String(now.getDate()).padStart(2, '0')
            const datePart = `${yy}${mm}${dd}`
            const sanitizedProjectName = (projectNameVal ?? '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Project'
            const templateCopyTarget = `ClickProposal_${datePart}_${sanitizedProjectName}`
            
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
                      onClick={closeSharedBidAndClearUrl}
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
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                      {!isBidValueSynced && (
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
                            title="Apply proposed amount to Bid Value"
                          >
                            {applyingBidValue ? 'Applying...' : 'Apply Proposed amount to Bid Value'}
                          </button>
                          {bidValueAppliedSuccess && (
                            <span style={{ fontSize: '0.875rem', color: '#059669', fontWeight: 500 }}>
                              ✓ Applied successfully
                            </span>
                          )}
                        </div>
                      )}
                      {coverLetterUseCustomAmountByBid[bid.id] === true && !isBidValueSynced && (() => {
                        const customStr = (coverLetterCustomAmountByBid[bid.id] ?? '').replace(/,/g, '').trim()
                        const customNum = customStr ? parseFloat(customStr) : NaN
                        const isValid = !isNaN(customNum) && customNum >= 0
                        return (
                          <button
                            type="button"
                            onClick={() => isValid && applyProposedAmountToBidValue(bid.id, customNum)}
                            disabled={applyingBidValue || !isValid}
                            style={{
                              padding: '0.25rem 0.75rem',
                              background: applyingBidValue || !isValid ? '#d1d5db' : '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: 4,
                              cursor: applyingBidValue || !isValid ? 'not-allowed' : 'pointer',
                              fontSize: '0.875rem'
                            }}
                            title="Apply custom amount to Bid Value"
                          >
                            {applyingBidValue ? 'Applying...' : 'Apply custom amount to Bid Value'}
                          </button>
                        )
                      })()}
                    </div>
                  </div>
                  <div>{revenueWords} ({revenueNumber})</div>
                  <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                      <input
                        type="checkbox"
                        checked={coverLetterUseCustomAmountByBid[bid.id] === true}
                        onChange={() => setCoverLetterUseCustomAmountByBid((prev) => ({ ...prev, [bid.id]: !prev[bid.id] }))}
                      />
                      Use custom amount in document
                    </label>
                    {coverLetterUseCustomAmountByBid[bid.id] === true && (
                      <input
                        type="text"
                        value={coverLetterCustomAmountByBid[bid.id] ?? ''}
                        onChange={(e) => setCoverLetterCustomAmountByBid((prev) => ({ ...prev, [bid.id]: e.target.value }))}
                        placeholder="e.g. 1359800"
                        style={{ width: '8rem', padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
                      />
                    )}
                  </div>
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
                      checked={coverLetterIncludeDesignDrawingPlanDateByBid[bid.id] !== false}
                      onChange={() => setCoverLetterIncludeDesignDrawingPlanDateByBid((prev) => ({ ...prev, [bid.id]: prev[bid.id] === false }))}
                    />
                    {bid.design_drawing_plan_date
                      ? `Design Drawings Plan Date [${formatDesignDrawingPlanDateLabel(bid.design_drawing_plan_date)}]`
                      : 'Design Drawings Plan Date: [not set]'}
                  </label>
                </div>
                {pricingCountRows.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: (coverLetterIncludeDesignDrawingPlanDateByBid[bid.id] !== false && !!bid.design_drawing_plan_date) ? 'pointer' : 'default', opacity: (coverLetterIncludeDesignDrawingPlanDateByBid[bid.id] !== false && !!bid.design_drawing_plan_date) ? 1 : 0.7 }}>
                      <input
                        type="checkbox"
                        checked={(coverLetterIncludeDesignDrawingPlanDateByBid[bid.id] !== false && !!bid.design_drawing_plan_date) ? (coverLetterIncludeFixturesPerPlanByBid[bid.id] !== false) : true}
                        disabled={!(coverLetterIncludeDesignDrawingPlanDateByBid[bid.id] !== false && !!bid.design_drawing_plan_date)}
                        onChange={() => (coverLetterIncludeDesignDrawingPlanDateByBid[bid.id] !== false && !!bid.design_drawing_plan_date) && setCoverLetterIncludeFixturesPerPlanByBid((prev) => ({
                          ...prev,
                          [bid.id]: prev[bid.id] === false
                        }))}
                      />
                      Include Fixtures provided and installed by us per plan
                      {!(coverLetterIncludeDesignDrawingPlanDateByBid[bid.id] !== false && !!bid.design_drawing_plan_date) && (
                        <span style={{ fontSize: '0.8em', color: '#6b7280' }}>
                          {!bid.design_drawing_plan_date
                            ? '(Set Design Drawing Plan Date in Edit bid to toggle)'
                            : '(Check Design Drawings Plan Date above to toggle)'}
                        </span>
                      )}
                    </label>
                  </div>
                )}
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
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={coverLetterIncludeSignatureByBid[bid.id] !== false}
                      onChange={() => setCoverLetterIncludeSignatureByBid((prev) => ({
                        ...prev,
                        [bid.id]: prev[bid.id] === false
                      }))}
                    />
                    Include Signature block in Cover Letter and Approval PDF
                  </label>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Combined document (copy to send)</label>
                  <div
                    key={`combined-preview-${bid.id}-${coverLetterIncludeDesignDrawingPlanDateByBid[bid.id] !== false}-${coverLetterIncludeSignatureByBid[bid.id] !== false}-${coverLetterIncludeFixturesPerPlanByBid[bid.id] !== false}-${coverLetterUseCustomAmountByBid[bid.id] === true ? coverLetterCustomAmountByBid[bid.id] ?? '' : ''}`}
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
                        openInExternalBrowser(googleDocsCopyUrl)
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
                  <strong>Project Folder</strong>{' '}
                  {selectedBidForSubmission.drive_link?.trim() ? (
                    <a href={selectedBidForSubmission.drive_link} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser(selectedBidForSubmission.drive_link!.trim()) }} style={{ color: '#3b82f6' }}>{selectedBidForSubmission.drive_link}</a>
                  ) : '—'}
                </p>
                <p style={{ margin: '0.25rem 0' }}>
                  <strong>Job Plans</strong>{' '}
                  {selectedBidForSubmission.plans_link?.trim() ? (
                    <a href={selectedBidForSubmission.plans_link} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser(selectedBidForSubmission.plans_link!.trim()) }} style={{ color: '#3b82f6' }}>{selectedBidForSubmission.plans_link}</a>
                  ) : '—'}
                </p>
                <p style={{ margin: '0.25rem 0' }}>
                  <strong>Count Tooling</strong>{' '}
                  {selectedBidForSubmission.count_tooling_link?.trim() ? (
                    <a href={selectedBidForSubmission.count_tooling_link} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser(selectedBidForSubmission.count_tooling_link!.trim()) }} style={{ color: '#3b82f6' }}>{selectedBidForSubmission.count_tooling_link}</a>
                  ) : '—'}
                </p>
                <p style={{ margin: '0.25rem 0' }}>
                  <strong>Bid Submission</strong>{' '}
                  {selectedBidForSubmission.bid_submission_link?.trim() ? (
                    <a href={selectedBidForSubmission.bid_submission_link} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser(selectedBidForSubmission.bid_submission_link!.trim()) }} style={{ color: '#3b82f6' }}>{selectedBidForSubmission.bid_submission_link}</a>
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

      {/* RFI Tab */}
      {activeTab === 'rfi' && (
        <div>
          {!selectedBidForRfi && (
            <input
              type="text"
              placeholder="Search bids (project name or GC/Builder)..."
              value={rfiSearchQuery}
              onChange={(e) => setRfiSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
            />
          )}
          {!selectedBidForRfi ? (
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
                      const q = rfiSearchQuery.toLowerCase()
                      if (!q) return true
                      const name = bidDisplayName(b).toLowerCase()
                      const cust = (b.customers?.name ?? '').toLowerCase()
                      const gc = (b.bids_gc_builders?.name ?? '').toLowerCase()
                      return name.includes(q) || cust.includes(q) || gc.includes(q)
                    })
                    .map((bid) => (
                      <tr
                        key={bid.id}
                        onClick={() => selectBidAndSyncUrl(bid, 'rfi')}
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
                    const q = rfiSearchQuery.toLowerCase()
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
            const bid = selectedBidForRfi
            const customerName = bid.customers?.name ?? bid.bids_gc_builders?.name ?? '—'
            const customerAddress = bid.customers?.address ?? bid.bids_gc_builders?.address ?? '—'
            const projectNameVal = bid.project_name ?? '—'
            const projectAddressVal = bid.address ?? '—'
            const defaultResponseDate = (() => {
              const d = new Date()
              d.setDate(d.getDate() + 7)
              return d.toLocaleDateString('en-CA')
            })()
            const getRfiForm = (): RfiFormData => {
              const existing = rfiFormByBid[bid.id]
              if (existing) return existing
              const contactName = (authUser?.user_metadata as { full_name?: string } | undefined)?.full_name ?? authUser?.email ?? ''
              return {
                bidSubmittedDate: '', // Always derived from bid.bid_date_sent when building
                submittedTo: '', // Always derived from bid.submitted_to when building
                companyName: '', // Always "Click Plumbing and Electrical" when building (not editable)
                contactPerson: contactName,
                phoneEmail: '',
                responseRequestDate: defaultResponseDate,
                detailedDescription: '',
                impactStatement: '',
                checklistExactLocation: false,
                checklistWhatIssue: false,
                checklistReferenceDocs: false,
                checklistWhyUnclear: false,
                checklistProposedSolution: false,
                checklistImpactStatement: false,
              }
            }
            const form = getRfiForm()
            const updateRfiForm = (updates: Partial<RfiFormData>) => {
              setRfiFormByBid((prev) => {
                const current = prev[bid.id] ?? form
                return {
                  ...prev,
                  [bid.id]: { ...current, ...updates },
                }
              })
            }
            const bidSubmittedDateFromBid = bid.bid_date_sent ? (bid.bid_date_sent as string).slice(0, 10) : ''
            const submittedToFromBid = (bid as { submitted_to?: string | null }).submitted_to ?? ''
            const formWithBidDate = { ...form, bidSubmittedDate: bidSubmittedDateFromBid, companyName: 'Click Plumbing and Electrical', submittedTo: submittedToFromBid }
            const combinedHtml = buildRfiHtml(customerName, customerAddress, projectNameVal, projectAddressVal, formWithBidDate)
            const combinedText = buildRfiText(customerName, customerAddress, projectNameVal, projectAddressVal, formWithBidDate)
            const copyToClipboard = () => {
              if (navigator.clipboard && navigator.clipboard.write) {
                const htmlBlob = new Blob([combinedHtml], { type: 'text/html' })
                const textBlob = new Blob([combinedText], { type: 'text/plain' })
                const item = new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })
                navigator.clipboard.write([item]).then(
                  () => {
                    setRfiCopySuccess(true)
                    setTimeout(() => setRfiCopySuccess(false), 2000)
                  },
                  () => {
                    navigator.clipboard.writeText(combinedText).then(() => {
                      setRfiCopySuccess(true)
                      setTimeout(() => setRfiCopySuccess(false), 2000)
                    })
                  }
                )
              } else {
                navigator.clipboard.writeText(combinedText).then(() => {
                  setRfiCopySuccess(true)
                  setTimeout(() => setRfiCopySuccess(false), 2000)
                })
              }
            }
            const serviceTypeName = bid.service_type?.name ?? 'Plumbing'
            const now = new Date()
            const yy = String(now.getFullYear()).slice(-2)
            const mm = String(now.getMonth() + 1).padStart(2, '0')
            const dd = String(now.getDate()).padStart(2, '0')
            const datePart = `${yy}${mm}${dd}`
            const sanitizedProjectName = (projectNameVal ?? '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Project'
            const templateCopyTarget = `ClickRFI_${datePart}_${sanitizedProjectName}`
            let googleDocsTemplateId = '1Xs76a1fAZfj4GGyIQ-wH_x98rtjnfoB7RVt7cMBmPP8' // Default: Plumbing
            if (serviceTypeName === 'Electrical') {
              googleDocsTemplateId = '1WO7egdTaavsl3YABBc7cR9va-IwmF9PTdIubxDw7ips'
            } else if (serviceTypeName === 'HVAC') {
              googleDocsTemplateId = '1Xs76a1fAZfj4GGyIQ-wH_x98rtjnfoB7RVt7cMBmPP8'
            }
            const googleDocsCopyUrl = `https://docs.google.com/document/d/${googleDocsTemplateId}/copy?title=` + encodeURIComponent(templateCopyTarget)
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
                      onClick={() => setSelectedBidForRfi(null)}
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
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Project</div>
                  <div>{projectNameVal}</div>
                  {addressLines(projectAddressVal).map((line, i) => (
                    <div key={i} style={{ color: '#6b7280' }}>{line}</div>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.875rem', color: '#374151' }}>
                      Bid was submitted: {formatDateYYMMDD(bid.bid_date_sent)}
                      {bid.bid_date_sent && (
                        <span style={{ marginLeft: '0.25rem', color: '#6b7280' }}>"{(bid.bid_date_sent as string).slice(0, 10)}"</span>
                      )}
                    </span>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>The bid was submitted to</label>
                      <span style={{ flex: 1, padding: '0.5rem 0', fontSize: '0.875rem', color: '#374151' }}>
                        {(bid as { submitted_to?: string | null }).submitted_to || '—'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Edit bid to change</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.5rem' }}>Company Information: Click Plumbing and Electrical</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <label style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>Project Lead Contact</label>
                      <input
                        type="text"
                        value={form.contactPerson}
                        onChange={(e) => updateRfiForm({ contactPerson: e.target.value })}
                        placeholder="e.g. yourname@clickplumbing.com"
                        style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>Project Lead Contact Phone/Email</label>
                      <input
                        type="text"
                        value={form.phoneEmail}
                        onChange={(e) => updateRfiForm({ phoneEmail: e.target.value })}
                        placeholder="e.g. 512 360 0599"
                        style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>Response request date (1 week by default)</label>
                      <input
                        type="date"
                        value={form.responseRequestDate}
                        onChange={(e) => updateRfiForm({ responseRequestDate: e.target.value })}
                        style={{ flex: 1, maxWidth: 180, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Detailed Description of the Question/Issue</label>
                    <textarea
                      value={form.detailedDescription}
                      onChange={(e) => updateRfiForm({ detailedDescription: e.target.value })}
                      placeholder="Be specific and concise. Include: Exact location (e.g. 2nd floor mechanical room, grid line B-4 to C-5); What the issue is; Reference contract documents; Why it's unclear/conflicting/missing; Your proposed solution or options (optional)."
                      rows={6}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }}
                    />
                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: '0.8125rem', color: '#4b5563' }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.checklistExactLocation ?? false} onChange={(e) => updateRfiForm({ checklistExactLocation: e.target.checked })} style={{ marginTop: 2 }} />
                        <span>Exact location (e.g., &quot;2nd floor mechanical room, grid line B-4 to C-5&quot;)</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.checklistWhatIssue ?? false} onChange={(e) => updateRfiForm({ checklistWhatIssue: e.target.checked })} style={{ marginTop: 2 }} />
                        <span>What the issue is (e.g., &quot;The plumbing drawings show a 4&quot; sanitary drain routing through structural beam at elevation 12&apos;-6&quot;, but beam depth conflicts with required slope and clearance.&quot;)</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.checklistReferenceDocs ?? false} onChange={(e) => updateRfiForm({ checklistReferenceDocs: e.target.checked })} style={{ marginTop: 2 }} />
                        <span>Reference contract documents (e.g., &quot;See Sheet P-102, detail 5/ plumbing riser diagram; Spec Section 22 05 16 – Expansion Fittings; Structural drawing S-301&quot;)</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.checklistWhyUnclear ?? false} onChange={(e) => updateRfiForm({ checklistWhyUnclear: e.target.checked })} style={{ marginTop: 2 }} />
                        <span>Why it&apos;s unclear/conflicting/missing (e.g., &quot;Drawing shows 1/4&quot; per foot slope, but vertical clearance is insufficient per IPC code requirements for cleanouts.&quot;)</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.checklistProposedSolution ?? false} onChange={(e) => updateRfiForm({ checklistProposedSolution: e.target.checked })} style={{ marginTop: 2 }} />
                        <span>Your proposed solution or options (optional but helpful—e.g., &quot;Can we reroute via alternative path shown in red markup?&quot;)</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Impact Statement</label>
                    <textarea
                      value={form.impactStatement}
                      onChange={(e) => updateRfiForm({ impactStatement: e.target.value })}
                      placeholder="Note any potential delay, cost implication, or safety concern if not resolved quickly. Keep factual."
                      rows={3}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }}
                    />
                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: '0.8125rem', color: '#4b5563' }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.checklistImpactStatement ?? false} onChange={(e) => updateRfiForm({ checklistImpactStatement: e.target.checked })} style={{ marginTop: 2 }} />
                        <span>Note any potential delay, cost implication, or safety concern if not resolved quickly (e.g., &quot;This issue is holding rough-in on floors 2–4; potential 5-day delay if not clarified by [date]&quot;). Avoid sounding like you&apos;re demanding a change—keep it factual.</span>
                      </label>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Combined document (copy to send)</label>
                  <div
                    key={`combined-preview-rfi-${bid.id}-${bid.bid_date_sent ?? ''}-${(bid as { submitted_to?: string | null }).submitted_to ?? ''}-${form.contactPerson}-${form.phoneEmail}-${form.responseRequestDate}-${form.detailedDescription}-${form.impactStatement}`}
                    style={{ width: '100%', minHeight: 360, padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: 4, fontFamily: 'inherit', fontSize: '0.875rem', boxSizing: 'border-box', whiteSpace: 'pre-wrap' }}
                    dangerouslySetInnerHTML={{ __html: combinedHtml }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={copyToClipboard}
                      style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                    >
                      {rfiCopySuccess ? 'Copied!' : 'Copy to clipboard'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        copyToClipboard()
                        openInExternalBrowser(googleDocsCopyUrl)
                      }}
                      style={{ padding: '0.5rem 1rem', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: 'inherit' }}
                    >
                      Open in Google Docs
                    </button>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Change Order Tab */}
      {activeTab === 'change-order' && (
        <div>
          {!selectedBidForChangeOrder && (
            <input
              type="text"
              placeholder="Search bids (project name or GC/Builder)..."
              value={changeOrderSearchQuery}
              onChange={(e) => setChangeOrderSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
            />
          )}
          {!selectedBidForChangeOrder ? (
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
                      const q = changeOrderSearchQuery.toLowerCase()
                      if (!q) return true
                      const name = bidDisplayName(b).toLowerCase()
                      const cust = (b.customers?.name ?? '').toLowerCase()
                      const gc = (b.bids_gc_builders?.name ?? '').toLowerCase()
                      return name.includes(q) || cust.includes(q) || gc.includes(q)
                    })
                    .map((bid) => (
                      <tr
                        key={bid.id}
                        onClick={() => selectBidAndSyncUrl(bid, 'change-order')}
                        style={{ cursor: 'pointer', borderBottom: '1px solid #e5e7eb' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'white' }}
                      >
                        <td style={{ padding: '0.75rem' }}>{bidDisplayName(bid) || '—'}</td>
                        <td style={{ padding: '0.75rem' }}>{formatDateYYMMDD(bid.bid_due_date)}</td>
                      </tr>
                    ))}
                  {bids.filter((b) => {
                    const q = changeOrderSearchQuery.toLowerCase()
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
            const bid = selectedBidForChangeOrder
            const customerName = bid.customers?.name ?? bid.bids_gc_builders?.name ?? '—'
            const customerAddress = bid.customers?.address ?? bid.bids_gc_builders?.address ?? '—'
            const projectNameVal = bid.project_name ?? '—'
            const projectAddressVal = bid.address ?? '—'
            const defaultResponseDate = (() => {
              const d = new Date()
              d.setDate(d.getDate() + 7)
              return d.toLocaleDateString('en-CA')
            })()
            const getChangeOrderForm = (): ChangeOrderFormData => {
              const existing = changeOrderFormByBid[bid.id]
              if (existing) return existing
              const contactName = (authUser?.user_metadata as { full_name?: string } | undefined)?.full_name ?? authUser?.email ?? ''
              return {
                bidSubmittedDate: '',
                submittedTo: '',
                companyName: '',
                contactPerson: contactName,
                phoneEmail: '',
                responseRequestDate: defaultResponseDate,
                detailedDescriptionOfChange: '',
                reasonForChange: '',
                impactOnCost: '',
                impactOnSchedule: '',
                checklistDetailedDesc: false,
                checklistExactWork: false,
                checklistReferences: false,
                checklistSupportingDetails: false,
                checklistReasonForChange: false,
                checklistCostBreakdown: false,
                checklistNetChange: false,
                checklistUpdatedTotal: false,
                checklistScheduleDuration: false,
                checklistRevisedDate: false,
                checklistScheduleJustification: false,
              }
            }
            const form = getChangeOrderForm()
            const updateChangeOrderForm = (updates: Partial<ChangeOrderFormData>) => {
              setChangeOrderFormByBid((prev) => {
                const current = prev[bid.id] ?? form
                return { ...prev, [bid.id]: { ...current, ...updates } }
              })
            }
            const bidSubmittedDateFromBid = bid.bid_date_sent ? (bid.bid_date_sent as string).slice(0, 10) : ''
            const submittedToFromBid = (bid as { submitted_to?: string | null }).submitted_to ?? ''
            const formWithBidData = { ...form, bidSubmittedDate: bidSubmittedDateFromBid, companyName: 'Click Plumbing and Electrical', submittedTo: submittedToFromBid }
            const combinedHtml = buildChangeOrderHtml(customerName, customerAddress, projectNameVal, projectAddressVal, formWithBidData)
            const combinedText = buildChangeOrderText(customerName, customerAddress, projectNameVal, projectAddressVal, formWithBidData)
            const copyToClipboard = () => {
              if (navigator.clipboard?.write) {
                const htmlBlob = new Blob([combinedHtml], { type: 'text/html' })
                const textBlob = new Blob([combinedText], { type: 'text/plain' })
                const item = new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })
                navigator.clipboard.write([item]).then(
                  () => { setChangeOrderCopySuccess(true); setTimeout(() => setChangeOrderCopySuccess(false), 2000) },
                  () => { navigator.clipboard.writeText(combinedText).then(() => { setChangeOrderCopySuccess(true); setTimeout(() => setChangeOrderCopySuccess(false), 2000) }) }
                )
              } else {
                navigator.clipboard.writeText(combinedText).then(() => { setChangeOrderCopySuccess(true); setTimeout(() => setChangeOrderCopySuccess(false), 2000) })
              }
            }
            const serviceTypeName = bid.service_type?.name ?? 'Plumbing'
            const now = new Date()
            const yy = String(now.getFullYear()).slice(-2)
            const mm = String(now.getMonth() + 1).padStart(2, '0')
            const dd = String(now.getDate()).padStart(2, '0')
            const datePart = `${yy}${mm}${dd}`
            const sanitizedProjectName = (projectNameVal ?? '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Project'
            const templateCopyTarget = `ClickChangeOrder_${datePart}_${sanitizedProjectName}`
            let googleDocsTemplateId = '1Xs76a1fAZfj4GGyIQ-wH_x98rtjnfoB7RVt7cMBmPP8'
            if (serviceTypeName === 'Electrical') googleDocsTemplateId = '1WO7egdTaavsl3YABBc7cR9va-IwmF9PTdIubxDw7ips'
            else if (serviceTypeName === 'HVAC') googleDocsTemplateId = '1Xs76a1fAZfj4GGyIQ-wH_x98rtjnfoB7RVt7cMBmPP8'
            const googleDocsCopyUrl = `https://docs.google.com/document/d/${googleDocsTemplateId}/copy?title=` + encodeURIComponent(templateCopyTarget)
            return (
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1.5rem 2rem', background: 'white', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h2 style={{ margin: 0 }}>{bidDisplayName(bid) || 'Bid'}</h2>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" onClick={() => openEditBid(bid)} title="Edit bid" style={{ padding: '0.5rem 1rem', background: '#eff6ff', border: '1px solid #3b82f6', borderRadius: 4, color: '#1d4ed8', cursor: 'pointer' }}>Edit bid</button>
                    <button type="button" onClick={closeSharedBidAndClearUrl} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Close</button>
                  </div>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Customer</div>
                  <div>{customerName}</div>
                  {addressLines(customerAddress).map((line, i) => <div key={i} style={{ color: '#6b7280' }}>{line}</div>)}
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Project</div>
                  <div>{projectNameVal}</div>
                  {addressLines(projectAddressVal).map((line, i) => <div key={i} style={{ color: '#6b7280' }}>{line}</div>)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.875rem', color: '#374151' }}>Bid was submitted: {formatDateYYMMDD(bid.bid_date_sent)}{bid.bid_date_sent && <span style={{ marginLeft: '0.25rem', color: '#6b7280' }}>{'"' + ((bid.bid_date_sent as string).slice(0, 10)) + '"'}</span>}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>The bid was submitted to</label>
                    <span style={{ flex: 1, padding: '0.5rem 0', fontSize: '0.875rem', color: '#374151' }}>{(bid as { submitted_to?: string | null }).submitted_to || '—'}</span>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Edit bid to change</span>
                  </div>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.5rem' }}>Company Information: Click Plumbing and Electrical</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <label style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>Project Lead Contact</label>
                      <input type="text" value={form.contactPerson} onChange={(e) => updateChangeOrderForm({ contactPerson: e.target.value })} placeholder="e.g. yourname@clickplumbing.com" style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>Project Lead Contact Phone/Email</label>
                      <input type="text" value={form.phoneEmail} onChange={(e) => updateChangeOrderForm({ phoneEmail: e.target.value })} placeholder="e.g. 512 360 0599" style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>Response request date (1 week by default)</label>
                    <input type="date" value={form.responseRequestDate} onChange={(e) => updateChangeOrderForm({ responseRequestDate: e.target.value })} style={{ flex: 1, maxWidth: 180, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Detailed Description of the Change</label>
                    <textarea value={form.detailedDescriptionOfChange} onChange={(e) => updateChangeOrderForm({ detailedDescriptionOfChange: e.target.value })} rows={6} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }} />
                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: '0.8125rem', color: '#4b5563' }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}><input type="checkbox" checked={form.checklistDetailedDesc ?? false} onChange={(e) => updateChangeOrderForm({ checklistDetailedDesc: e.target.checked })} style={{ marginTop: 2 }} /><span>A clear, specific explanation of what is being added, deleted, or modified</span></label>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}><input type="checkbox" checked={form.checklistExactWork ?? false} onChange={(e) => updateChangeOrderForm({ checklistExactWork: e.target.checked })} style={{ marginTop: 2 }} /><span>The exact work involved (e.g., &quot;Replace standard drywall with fire-rated drywall in corridor walls&quot;)</span></label>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}><input type="checkbox" checked={form.checklistReferences ?? false} onChange={(e) => updateChangeOrderForm({ checklistReferences: e.target.checked })} style={{ marginTop: 2 }} /><span>References to relevant drawings, specifications, or sections of the original contract</span></label>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}><input type="checkbox" checked={form.checklistSupportingDetails ?? false} onChange={(e) => updateChangeOrderForm({ checklistSupportingDetails: e.target.checked })} style={{ marginTop: 2 }} /><span>Any supporting details like photos, sketches, or revised plans</span></label>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Reason for the Change</label>
                    <textarea value={form.reasonForChange} onChange={(e) => updateChangeOrderForm({ reasonForChange: e.target.value })} rows={3} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }} />
                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: '0.8125rem', color: '#4b5563' }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}><input type="checkbox" checked={form.checklistReasonForChange ?? false} onChange={(e) => updateChangeOrderForm({ checklistReasonForChange: e.target.checked })} style={{ marginTop: 2 }} /><span>Why the change is needed (e.g., unforeseen site conditions, owner-requested upgrade, design error correction, code compliance update, material substitution, or weather delay impact)</span></label>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Impact on Cost (Contract Sum Adjustment)</label>
                    <textarea value={form.impactOnCost} onChange={(e) => updateChangeOrderForm({ impactOnCost: e.target.value })} rows={4} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }} />
                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: '0.8125rem', color: '#4b5563' }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}><input type="checkbox" checked={form.checklistCostBreakdown ?? false} onChange={(e) => updateChangeOrderForm({ checklistCostBreakdown: e.target.checked })} style={{ marginTop: 2 }} /><span>Breakdown of costs (labor, materials, equipment, subcontractors, overhead, profit, taxes, insurance, bonds, etc.)</span></label>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}><input type="checkbox" checked={form.checklistNetChange ?? false} onChange={(e) => updateChangeOrderForm({ checklistNetChange: e.target.checked })} style={{ marginTop: 2 }} /><span>Net change amount (increase, decrease, or no change)</span></label>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}><input type="checkbox" checked={form.checklistUpdatedTotal ?? false} onChange={(e) => updateChangeOrderForm({ checklistUpdatedTotal: e.target.checked })} style={{ marginTop: 2 }} /><span>Updated total contract price after the change</span></label>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Impact on Schedule (Contract Time Adjustment)</label>
                    <textarea value={form.impactOnSchedule} onChange={(e) => updateChangeOrderForm({ impactOnSchedule: e.target.value })} rows={4} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }} />
                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: '0.8125rem', color: '#4b5563' }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}><input type="checkbox" checked={form.checklistScheduleDuration ?? false} onChange={(e) => updateChangeOrderForm({ checklistScheduleDuration: e.target.checked })} style={{ marginTop: 2 }} /><span>Number of additional (or reduced) days</span></label>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}><input type="checkbox" checked={form.checklistRevisedDate ?? false} onChange={(e) => updateChangeOrderForm({ checklistRevisedDate: e.target.checked })} style={{ marginTop: 2 }} /><span>Revised substantial completion date or milestones</span></label>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}><input type="checkbox" checked={form.checklistScheduleJustification ?? false} onChange={(e) => updateChangeOrderForm({ checklistScheduleJustification: e.target.checked })} style={{ marginTop: 2 }} /><span>Justification for the time impact (often supported by schedule analysis)</span></label>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Combined document (copy to send)</label>
                  <div key={`combined-preview-co-${bid.id}-${bid.bid_date_sent ?? ''}-${(bid as { submitted_to?: string | null }).submitted_to ?? ''}-${form.contactPerson}-${form.phoneEmail}-${form.responseRequestDate}-${form.detailedDescriptionOfChange}-${form.reasonForChange}-${form.impactOnCost}-${form.impactOnSchedule}`} style={{ width: '100%', minHeight: 360, padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: 4, fontFamily: 'inherit', fontSize: '0.875rem', boxSizing: 'border-box', whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: combinedHtml }} />
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button type="button" onClick={copyToClipboard} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{changeOrderCopySuccess ? 'Copied!' : 'Copy to clipboard'}</button>
                    <button type="button" onClick={() => { copyToClipboard(); openInExternalBrowser(googleDocsCopyUrl) }} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: 'inherit' }}>Open in Google Docs</button>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Lien Release Tab */}
      {activeTab === 'lien-release' && (
        <div>
          {!selectedBidForLienRelease && (
            <input
              type="text"
              placeholder="Search bids (project name or GC/Builder)..."
              value={lienReleaseSearchQuery}
              onChange={(e) => setLienReleaseSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
            />
          )}
          {!selectedBidForLienRelease ? (
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
                      const q = lienReleaseSearchQuery.toLowerCase()
                      if (!q) return true
                      const name = bidDisplayName(b).toLowerCase()
                      const cust = (b.customers?.name ?? '').toLowerCase()
                      const gc = (b.bids_gc_builders?.name ?? '').toLowerCase()
                      return name.includes(q) || cust.includes(q) || gc.includes(q)
                    })
                    .map((bid) => (
                      <tr
                        key={bid.id}
                        onClick={() => selectBidAndSyncUrl(bid, 'lien-release')}
                        style={{ cursor: 'pointer', borderBottom: '1px solid #e5e7eb' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'white' }}
                      >
                        <td style={{ padding: '0.75rem' }}>{bidDisplayName(bid) || '—'}</td>
                        <td style={{ padding: '0.75rem' }}>{formatDateYYMMDD(bid.bid_due_date)}</td>
                      </tr>
                    ))}
                  {bids.filter((b) => {
                    const q = lienReleaseSearchQuery.toLowerCase()
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
            const bid = selectedBidForLienRelease
            const customerName = bid.customers?.name ?? bid.bids_gc_builders?.name ?? '—'
            const customerAddress = bid.customers?.address ?? bid.bids_gc_builders?.address ?? '—'
            const projectNameVal = bid.project_name ?? '—'
            const projectAddressVal = bid.address ?? '—'
            const defaultBidAmount = bid.agreed_value != null ? String(bid.agreed_value) : bid.bid_value != null ? String(bid.bid_value) : ''
            const todayStr = new Date().toLocaleDateString('en-CA')
            const getLienReleaseForm = (): LienReleaseFormData => {
              const existing = lienReleaseFormByBid[bid.id]
              if (existing) {
                const legacy = existing as { finalInvoice?: string; amountOfApplication?: string }
                const invoiceAmount = existing.invoiceAmount ?? legacy.amountOfApplication ?? legacy.finalInvoice ?? ''
                return { ...existing, invoiceAmount }
              }
              return {
                invoiceAmount: '',
                bidAmount: defaultBidAmount,
                invoicesToDate: '',
                cc: '',
                companyName: 'Click Plumbing and Electrical',
                companyAddress: LIEN_RELEASE_DEFAULT_COMPANY_ADDRESS,
                companyPhone: LIEN_RELEASE_DEFAULT_COMPANY_PHONE,
                companyEmail: LIEN_RELEASE_DEFAULT_COMPANY_EMAIL,
                invoiceDate: todayStr,
                invoiceNumber: '',
                descriptionOfWork: '',
                conditionalWaiver: LIEN_RELEASE_DEFAULT_CONDITIONAL_WAIVER,
                paymentTerms: LIEN_RELEASE_DEFAULT_PAYMENT_TERMS,
                lienStatusPhone: LIEN_RELEASE_DEFAULT_LIEN_PHONE,
              }
            }
            const form = getLienReleaseForm()
            const updateLienReleaseForm = (updates: Partial<LienReleaseFormData>) => {
              setLienReleaseFormByBid((prev) => {
                const current = prev[bid.id] ?? form
                return { ...prev, [bid.id]: { ...current, ...updates } }
              })
            }
            const formWithBidDefaults = { ...form, bidAmount: form.bidAmount || defaultBidAmount }
            const combinedHtml = buildLienReleaseHtml(customerName, customerAddress, projectNameVal, projectAddressVal, formWithBidDefaults, customerName)
            const combinedText = buildLienReleaseText(customerName, customerAddress, projectNameVal, projectAddressVal, formWithBidDefaults, customerName)
            const copyToClipboard = () => {
              if (navigator.clipboard?.write) {
                const htmlBlob = new Blob([combinedHtml], { type: 'text/html' })
                const textBlob = new Blob([combinedText], { type: 'text/plain' })
                const item = new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })
                navigator.clipboard.write([item]).then(() => {
                  setLienReleaseCopySuccess(true)
                  setTimeout(() => setLienReleaseCopySuccess(false), 2000)
                }).catch(() => {
                  navigator.clipboard?.writeText(combinedText).then(() => {
                    setLienReleaseCopySuccess(true)
                    setTimeout(() => setLienReleaseCopySuccess(false), 2000)
                  })
                })
              } else {
                navigator.clipboard?.writeText(combinedText).then(() => {
                  setLienReleaseCopySuccess(true)
                  setTimeout(() => setLienReleaseCopySuccess(false), 2000)
                })
              }
            }
            const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '')
            const sanitizedProjectName = (projectNameVal ?? '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Project'
            const templateCopyTarget = `ClickLienRelease_${datePart}_${sanitizedProjectName}`
            const serviceTypeName = bid.service_type?.name ?? 'Plumbing'
            let googleDocsTemplateId = '1Xs76a1fAZfj4GGyIQ-wH_x98rtjnfoB7RVt7cMBmPP8'
            if (serviceTypeName === 'Electrical') googleDocsTemplateId = '1WO7egdTaavsl3YABBc7cR9va-IwmF9PTdIubxDw7ips'
            else if (serviceTypeName === 'HVAC') googleDocsTemplateId = '1Xs76a1fAZfj4GGyIQ-wH_x98rtjnfoB7RVt7cMBmPP8'
            const googleDocsCopyUrl = `https://docs.google.com/document/d/${googleDocsTemplateId}/copy?title=` + encodeURIComponent(templateCopyTarget)
            return (
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1.5rem 2rem', background: 'white', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h2 style={{ margin: 0 }}>{bidDisplayName(bid) || 'Bid'}</h2>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" onClick={() => { setBidFormOpen(true); setEditingBid(bid) }} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Edit bid</button>
                    <button type="button" onClick={closeSharedBidAndClearUrl} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Close</button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Invoice Amount</label>
                    <input type="text" value={form.invoiceAmount} onChange={(e) => updateLienReleaseForm({ invoiceAmount: e.target.value })} placeholder="e.g. 10,000.00" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Bid amount</label>
                    <input type="text" value={form.bidAmount} onChange={(e) => updateLienReleaseForm({ bidAmount: e.target.value })} placeholder="e.g. 100,000.00" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Invoices to date</label>
                    <input type="text" value={form.invoicesToDate} onChange={(e) => updateLienReleaseForm({ invoicesToDate: e.target.value })} placeholder="e.g. 90,000.00" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Invoice Date</label>
                    <input type="date" value={form.invoiceDate} onChange={(e) => updateLienReleaseForm({ invoiceDate: e.target.value })} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Invoice Number</label>
                    <input type="text" value={form.invoiceNumber} onChange={(e) => updateLienReleaseForm({ invoiceNumber: e.target.value })} placeholder="e.g. 250 (Billed Dec 22nd 2025)" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                  <div style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.25rem' }}>Project:</div>
                  <div style={{ fontSize: '0.875rem', color: '#374151' }}>{projectNameVal}</div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', whiteSpace: 'pre-wrap' }}>{projectAddressVal || '—'}</div>
                </div>
                <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                  <div style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.25rem' }}>Owner / Contracting Party:</div>
                  <div style={{ fontSize: '0.875rem', color: '#374151' }}>{customerName}</div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', whiteSpace: 'pre-wrap' }}>{customerAddress || '—'}</div>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>CC</label>
                  <input type="text" value={form.cc} onChange={(e) => updateLienReleaseForm({ cc: e.target.value })} placeholder="Person, phone, email (optional)" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }} />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setLienReleaseCompanyInfoCollapsed((c) => !c)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem' }}
                  >
                    {lienReleaseCompanyInfoCollapsed ? '\u25B6' : '\u25BC'} Company Information: Click Plumbing and Electrical
                  </button>
                  {!lienReleaseCompanyInfoCollapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: 4, fontSize: '0.8125rem' }}>Company Address</label>
                        <textarea value={form.companyAddress} onChange={(e) => updateLienReleaseForm({ companyAddress: e.target.value })} rows={2} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }} />
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 140 }}>
                          <label style={{ display: 'block', marginBottom: 4, fontSize: '0.8125rem' }}>Phone</label>
                          <input type="text" value={form.companyPhone} onChange={(e) => updateLienReleaseForm({ companyPhone: e.target.value })} placeholder={LIEN_RELEASE_DEFAULT_COMPANY_PHONE} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <label style={{ display: 'block', marginBottom: 4, fontSize: '0.8125rem' }}>Email</label>
                          <input type="text" value={form.companyEmail} onChange={(e) => updateLienReleaseForm({ companyEmail: e.target.value })} placeholder={LIEN_RELEASE_DEFAULT_COMPANY_EMAIL} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 4 }}>
                    <label style={{ fontWeight: 500, fontSize: '0.875rem' }}>Description of Work / Period Covered (Optional)</label>
                    <button
                      type="button"
                      onClick={() => {
                        const bidAmtFmt = formatAmountFromString(form.bidAmount || defaultBidAmount) || '—'
                        updateLienReleaseForm({
                          descriptionOfWork: `Plumbing services performed through approximately __% completion of the original base contract amount of $${bidAmtFmt}.`
                        })
                      }}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Pre-fill
                    </button>
                  </div>
                  <textarea value={form.descriptionOfWork} onChange={(e) => updateLienReleaseForm({ descriptionOfWork: e.target.value })} rows={4} placeholder="e.g. Plumbing services performed through approximately 95% completion of the original base contract amount of $121,000.00." style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }} />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <button type="button" onClick={() => setLienReleaseConditionalWaiverCollapsed((c) => !c)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem' }}>
                    {lienReleaseConditionalWaiverCollapsed ? '\u25B6' : '\u25BC'} Conditional Waiver and Release
                  </button>
                  {!lienReleaseConditionalWaiverCollapsed && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <textarea value={form.conditionalWaiver} onChange={(e) => updateLienReleaseForm({ conditionalWaiver: e.target.value })} rows={5} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }} />
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 4 }}>Use {`{{finalInvoice}}`} and {`{{invoicesToDate}}`} as placeholders for amounts.</div>
                    </div>
                  )}
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <button type="button" onClick={() => setLienReleasePaymentTermsCollapsed((c) => !c)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem' }}>
                    {lienReleasePaymentTermsCollapsed ? '\u25B6' : '\u25BC'} Payment Terms & Late Payment Consequences
                  </button>
                  {!lienReleasePaymentTermsCollapsed && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <textarea value={form.paymentTerms} onChange={(e) => updateLienReleaseForm({ paymentTerms: e.target.value })} rows={4} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }} />
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 4 }}>Use {`{{finalInvoice}}`} and {`{{ownerName}}`} as placeholders.</div>
                    </div>
                  )}
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <button type="button" onClick={() => setLienReleaseLienStatusCollapsed((c) => !c)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem' }}>
                    {lienReleaseLienStatusCollapsed ? '\u25B6' : '\u25BC'} Lien Status Verification phone
                  </button>
                  {!lienReleaseLienStatusCollapsed && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <input type="text" value={form.lienStatusPhone} onChange={(e) => updateLienReleaseForm({ lienStatusPhone: e.target.value })} placeholder={LIEN_RELEASE_DEFAULT_LIEN_PHONE} style={{ width: '100%', maxWidth: 220, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }} />
                    </div>
                  )}
                </div>
                <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Combined document (copy to send)</label>
                  <div key={`combined-preview-lr-${bid.id}-${form.invoiceAmount}-${form.bidAmount}-${form.invoicesToDate}-${form.cc}-${form.companyAddress}-${form.companyPhone}-${form.companyEmail}-${form.invoiceDate}-${form.invoiceNumber}-${form.descriptionOfWork}-${form.conditionalWaiver}-${form.paymentTerms}-${form.lienStatusPhone}`} style={{ width: '100%', minHeight: 360, padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: 4, fontFamily: 'inherit', fontSize: '0.875rem', boxSizing: 'border-box', whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: combinedHtml }} />
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button type="button" onClick={copyToClipboard} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{lienReleaseCopySuccess ? 'Copied!' : 'Copy to clipboard'}</button>
                    <button type="button" onClick={() => { copyToClipboard(); openInExternalBrowser(googleDocsCopyUrl) }} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: 'inherit' }}>Open in Google Docs</button>
                  </div>
                </div>
              </div>
            )
          })()}
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
              <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
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
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Win/Loss</label>
                  <select value={outcome} onChange={(e) => setOutcome(e.target.value as OutcomeOption)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}>
                    <option value="">—</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                    <option value="started_or_complete">Started or Complete</option>
                  </select>
                </div>
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
              <div className="bid-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Project Address<br />[street, town, state zip]</label>
                  <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 12925 FM 20, Kingsbury, Texas 78638" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <label style={{ fontWeight: 500, margin: 0 }}>Distance to Office<br />(miles)</label>
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
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Project Folder{'\u00A0'.repeat(10)}
                  bid folders:{' '}
                  <a href="https://drive.google.com/drive/folders/1HRAnLDgQ-0__1o4umf59w6zpfW3rFvtB?usp=sharing" target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser('https://drive.google.com/drive/folders/1HRAnLDgQ-0__1o4umf59w6zpfW3rFvtB?usp=sharing') }} style={{ color: '#3b82f6' }}>
                    [plumbing]
                  </a>
                  {' '}
                  <a href="https://drive.google.com/drive/folders/10gkh2r2xtyy2vlT3p_HnqgJI28vNN1q2?usp=sharing" target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser('https://drive.google.com/drive/folders/10gkh2r2xtyy2vlT3p_HnqgJI28vNN1q2?usp=sharing') }} style={{ color: '#3b82f6' }}>
                    [electrical]
                  </a>
                  {' '}
                  <a href="https://drive.google.com/drive/folders/1PU1lRZOxSwm--bCQ1LcQ7eXYu5GTDKOL?usp=drive_link" target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openInExternalBrowser('https://drive.google.com/drive/folders/1PU1lRZOxSwm--bCQ1LcQ7eXYu5GTDKOL?usp=drive_link') }} style={{ color: '#3b82f6' }}>
                    [HVAC]
                  </a>
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input type="url" value={driveLink} onChange={(e) => setDriveLink(e.target.value)} placeholder="https://drive.google.com/drive/... " style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText()
                        setDriveLink(text)
                      } catch (err) {
                        console.error('Failed to read clipboard:', err)
                      }
                    }}
                    style={{ padding: '0.5rem 0.75rem', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Paste from clipboard"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 20, height: 20 }}><path d="M360 160L280 160C266.7 160 256 149.3 256 136C256 122.7 266.7 112 280 112L360 112C373.3 112 384 122.7 384 136C384 149.3 373.3 160 360 160zM360 208C397.1 208 427.6 180 431.6 144L448 144C456.8 144 464 151.2 464 160L464 512C464 520.8 456.8 528 448 528L192 528C183.2 528 176 520.8 176 512L176 160C176 151.2 183.2 144 192 144L208.4 144C212.4 180 242.9 208 280 208L360 208zM419.9 96C407 76.7 385 64 360 64L280 64C255 64 233 76.7 220.1 96L192 96C156.7 96 128 124.7 128 160L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 160C512 124.7 483.3 96 448 96L419.9 96z"/></svg>
                  </button>
                </div>
              </div>
              <div className="bid-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Job Plans</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input type="url" value={plansLink} onChange={(e) => setPlansLink(e.target.value)} placeholder="https://drive.google.com/drive/... " style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText()
                          setPlansLink(text)
                        } catch (err) {
                          console.error('Failed to read clipboard:', err)
                        }
                      }}
                      style={{ padding: '0.5rem 0.75rem', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Paste from clipboard"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 20, height: 20 }}><path d="M360 160L280 160C266.7 160 256 149.3 256 136C256 122.7 266.7 112 280 112L360 112C373.3 112 384 122.7 384 136C384 149.3 373.3 160 360 160zM360 208C397.1 208 427.6 180 431.6 144L448 144C456.8 144 464 151.2 464 160L464 512C464 520.8 456.8 528 448 528L192 528C183.2 528 176 520.8 176 512L176 160C176 151.2 183.2 144 192 144L208.4 144C212.4 180 242.9 208 280 208L360 208zM419.9 96C407 76.7 385 64 360 64L280 64C255 64 233 76.7 220.1 96L192 96C156.7 96 128 124.7 128 160L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 160C512 124.7 483.3 96 448 96L419.9 96z"/></svg>
                    </button>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Design Drawing Plan Date</label>
                  <input type="date" value={designDrawingPlanDate} onChange={(e) => setDesignDrawingPlanDate(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                </div>
              </div>
              <div className="bid-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Count Tooling</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input type="url" value={countToolingLink} onChange={(e) => setCountToolingLink(e.target.value)} placeholder="https://counttooling.com/... " style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText()
                          setCountToolingLink(text)
                        } catch (err) {
                          console.error('Failed to read clipboard:', err)
                        }
                      }}
                      style={{ padding: '0.5rem 0.75rem', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Paste from clipboard"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 20, height: 20 }}><path d="M360 160L280 160C266.7 160 256 149.3 256 136C256 122.7 266.7 112 280 112L360 112C373.3 112 384 122.7 384 136C384 149.3 373.3 160 360 160zM360 208C397.1 208 427.6 180 431.6 144L448 144C456.8 144 464 151.2 464 160L464 512C464 520.8 456.8 528 448 528L192 528C183.2 528 176 520.8 176 512L176 160C176 151.2 183.2 144 192 144L208.4 144C212.4 180 242.9 208 280 208L360 208zM419.9 96C407 76.7 385 64 360 64L280 64C255 64 233 76.7 220.1 96L192 96C156.7 96 128 124.7 128 160L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 160C512 124.7 483.3 96 448 96L419.9 96z"/></svg>
                    </button>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Bid Submission</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input type="url" value={bidSubmissionLink} onChange={(e) => setBidSubmissionLink(e.target.value)} placeholder="https://drive.google.com/drive/... " style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText()
                          setBidSubmissionLink(text)
                        } catch (err) {
                          console.error('Failed to read clipboard:', err)
                        }
                      }}
                      style={{ padding: '0.5rem 0.75rem', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Paste from clipboard"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 20, height: 20 }}><path d="M360 160L280 160C266.7 160 256 149.3 256 136C256 122.7 266.7 112 280 112L360 112C373.3 112 384 122.7 384 136C384 149.3 373.3 160 360 160zM360 208C397.1 208 427.6 180 431.6 144L448 144C456.8 144 464 151.2 464 160L464 512C464 520.8 456.8 528 448 528L192 528C183.2 528 176 520.8 176 512L176 160C176 151.2 183.2 144 192 144L208.4 144C212.4 180 242.9 208 280 208L360 208zM419.9 96C407 76.7 385 64 360 64L280 64C255 64 233 76.7 220.1 96L192 96C156.7 96 128 124.7 128 160L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 160C512 124.7 483.3 96 448 96L419.9 96z"/></svg>
                    </button>
                  </div>
                </div>
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
                          newCustomerModal?.openNewCustomerModal({
                            onCreated: (c) => {
                              loadCustomers()
                              setGcCustomerId(c.id)
                              setGcCustomerSearch(getCustomerDisplay(c))
                            },
                          })
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
                <button
                  type="button"
                  aria-expanded={projectContactExpanded}
                  onClick={() => setProjectContactExpanded((p) => !p)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: 0,
                    marginBottom: projectContactExpanded ? '0.5rem' : 0,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontWeight: 500,
                    fontSize: 'inherit',
                    color: 'inherit',
                    width: '100%',
                    textAlign: 'left',
                  }}
                >
                  <span aria-hidden>{projectContactExpanded ? '\u25BC' : '\u25B6'}</span>
                  Project Contact: {gcContactName.trim() || gcContactPhone.trim() || gcContactEmail.trim() ? (gcContactName.trim() || '—') : '—'}
                </button>
                {projectContactExpanded && (
                  <div style={{ paddingLeft: '1.25rem', borderLeft: '2px solid #e5e7eb' }}>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Project Contact Name</label>
                      <input type="text" value={gcContactName} onChange={(e) => setGcContactName(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                    </div>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Project Contact Phone</label>
                      <input type="tel" value={gcContactPhone} onChange={(e) => setGcContactPhone(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                    </div>
                    <div style={{ marginBottom: 0 }}>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Project Contact Email</label>
                      <input type="email" value={gcContactEmail} onChange={(e) => setGcContactEmail(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                    </div>
                  </div>
                )}
              </div>
              <div className="bid-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Estimator</label>
                  <select value={estimatorId} onChange={(e) => setEstimatorId(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}>
                    <option value="">—</option>
                    {estimatorUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.name || u.email}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Account Man</label>
                  <select value={accountManagerId} onChange={(e) => setAccountManagerId(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}>
                    <option value="">—</option>
                    {estimatorUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.name || u.email}</option>
                    ))}
                  </select>
                </div>
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
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Submitted to (name, phone, email):</label>
                <input type="text" value={submittedTo} onChange={(e) => setSubmittedTo(e.target.value)} placeholder="e.g. Architect name, 555-123-4567, architect@example.com" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
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
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Last Contact</label>
                <input type="datetime-local" value={lastContact} onChange={(e) => setLastContact(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={saveBidAndOpenCounts}
                  disabled={!bidFormCanSubmit || savingBid}
                  title={!bidFormCanSubmit ? `Required: ${bidFormMissingFields.join(', ')}` : undefined}
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
                <button type="submit" disabled={!bidFormCanSubmit || savingBid} title={!bidFormCanSubmit ? `Required: ${bidFormMissingFields.join(', ')}` : undefined} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                  {savingBid ? 'Saving…' : 'Save'}
                </button>
                {!bidFormCanSubmit && !savingBid && bidFormMissingFields.length > 0 && (
                  <span style={{ fontSize: '0.8rem', color: '#FF6600', marginLeft: '0.5rem', display: 'inline-block' }}>
                  <span style={{ display: 'block' }}>Required:</span>
                  {bidFormMissingFields.map((f) => (
                    <span key={f} style={{ display: 'block', marginLeft: '0.25em' }}>{f}</span>
                  ))}
                </span>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Contact modal (Builder Review) */}
      {addContactModalCustomer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
          <div style={{ background: 'white', padding: '1.5rem 2rem', borderRadius: 8, maxWidth: '500px', width: '90%' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>General contact – {addContactModalCustomer.name}</h2>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="add-contact-date" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Date</label>
              <input
                id="add-contact-date"
                type="date"
                value={addContactModalDate}
                onChange={(e) => setAddContactModalDate(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="add-contact-details" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Details</label>
              <textarea
                id="add-contact-details"
                value={addContactModalDetails}
                onChange={(e) => setAddContactModalDetails(e.target.value)}
                placeholder="Notes about this outreach…"
                rows={4}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => { setAddContactModalCustomer(null); setAddContactModalDetails('') }}
                style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingContact}
                onClick={async () => {
                  if (!addContactModalCustomer || !authUser?.id) return
                  setSavingContact(true)
                  const contactDate = addContactModalDate ? `${addContactModalDate}T12:00:00Z` : new Date().toISOString()
                  const { error: err } = await supabase
                    .from('customer_contacts')
                    .insert({
                      customer_id: addContactModalCustomer.id,
                      contact_date: contactDate,
                      details: addContactModalDetails.trim() || null,
                      created_by: authUser.id,
                    })
                  setSavingContact(false)
                  if (err) {
                    setError(`Failed to save contact: ${err.message}`)
                    return
                  }
                  await loadCustomerContacts()
                  await loadBids()
                  setAddContactModalCustomer(null)
                  setAddContactModalDetails('')
                }}
                style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: savingContact ? 'not-allowed' : 'pointer' }}
              >
                {savingContact ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Contact Person modal (Builder Review) */}
      {addContactPersonModalCustomer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
          <div style={{ background: 'white', padding: '1.5rem 2rem', borderRadius: 8, maxWidth: '500px', width: '90%' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>
              {editingContactPerson ? 'Edit contact person' : 'Add contact person'} – {addContactPersonModalCustomer.name}
            </h2>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="contact-person-name" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Name</label>
              <input
                id="contact-person-name"
                type="text"
                value={contactPersonName}
                onChange={(e) => setContactPersonName(e.target.value)}
                placeholder="Name"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Phone{contactPersonPhones.length > 1 ? 's' : ''}</label>
              {contactPersonPhones.map((p, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.35rem', marginBottom: i < contactPersonPhones.length - 1 ? '0.35rem' : 0 }}>
                  <input
                    type="text"
                    value={p}
                    onChange={(e) => setContactPersonPhones((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                    placeholder="Phone"
                    style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  />
                  <button
                    type="button"
                    onClick={() => setContactPersonPhones((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : prev))}
                    title="Remove phone"
                    style={{ padding: '0.5rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer', color: '#991b1b', flexShrink: 0 }}
                  >
                    −
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setContactPersonPhones((prev) => [...prev, ''])}
                style={{ marginTop: '0.35rem', padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}
              >
                + Add phone
              </button>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="contact-person-email" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Email</label>
              <input
                id="contact-person-email"
                type="email"
                value={contactPersonEmail}
                onChange={(e) => setContactPersonEmail(e.target.value)}
                placeholder="Email"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="contact-person-note" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Note</label>
              <textarea
                id="contact-person-note"
                value={contactPersonNote}
                onChange={(e) => setContactPersonNote(e.target.value)}
                placeholder="Note"
                rows={3}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setAddContactPersonModalCustomer(null)
                  setEditingContactPerson(null)
                  setContactPersonName('')
                  setContactPersonPhones([''])
                  setContactPersonEmail('')
                  setContactPersonNote('')
                }}
                style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingContactPerson || !contactPersonName.trim()}
                onClick={async () => {
                  if (!addContactPersonModalCustomer || !contactPersonName.trim()) return
                  setSavingContactPerson(true)
                  const phoneVal = contactPersonPhones.map((p) => p.trim()).filter(Boolean).join('\n') || null
                  if (editingContactPerson) {
                    const { error: err } = await supabase
                      .from('customer_contact_persons')
                      .update({
                        name: contactPersonName.trim(),
                        phone: phoneVal,
                        email: contactPersonEmail.trim() || null,
                        note: contactPersonNote.trim() || null,
                      })
                      .eq('id', editingContactPerson.id)
                    setSavingContactPerson(false)
                    if (err) {
                      setError(`Failed to update contact: ${err.message}`)
                      return
                    }
                  } else {
                    const { error: err } = await supabase
                      .from('customer_contact_persons')
                      .insert({
                        customer_id: addContactPersonModalCustomer.id,
                        name: contactPersonName.trim(),
                        phone: phoneVal,
                        email: contactPersonEmail.trim() || null,
                        note: contactPersonNote.trim() || null,
                      })
                    setSavingContactPerson(false)
                    if (err) {
                      setError(`Failed to save contact: ${err.message}`)
                      return
                    }
                  }
                  await loadCustomerContactPersons()
                  setAddContactPersonModalCustomer(null)
                  setEditingContactPerson(null)
                  setContactPersonName('')
                  setContactPersonPhones([''])
                  setContactPersonEmail('')
                  setContactPersonNote('')
                }}
                style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: savingContactPerson ? 'not-allowed' : 'pointer' }}
              >
                {savingContactPerson ? 'Saving…' : 'Save'}
              </button>
            </div>
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
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Prices</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {editTemplateItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>No items yet. Add parts or nested templates below.</td>
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
                              {item.item_type === 'part' && item.part_id ? (
                                <button
                                  type="button"
                                  onClick={() => setPartPricesModal({ partId: item.part_id!, partName: name })}
                                  style={{ padding: '0.25rem 0.5rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 4, cursor: 'pointer' }}
                                >
                                  Prices
                                </button>
                              ) : '—'}
                            </td>
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

      {/* Part Prices modal - check/modify prices for a part from Add/Edit Assembly */}
      {partPricesModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }} onClick={() => setPartPricesModal(null)}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, maxWidth: 440, width: '90%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Prices: {partPricesModal.partName}</h3>
              <button type="button" onClick={() => setPartPricesModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
            </div>
            {partPricesModalData === 'loading' ? (
              <p style={{ margin: 0, color: '#6b7280' }}>Loading prices…</p>
            ) : (
              <>
                {partPricesModalData && partPricesModalData.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead style={{ background: '#f9fafb' }}>
                      <tr>
                        <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Supply House</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Price</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {partPricesModalData.map((row) => {
                        const editVal = partPricesModalEditing[row.price_id] ?? row.price.toString()
                        const numVal = parseFloat(editVal)
                        const isValid = !isNaN(numVal) && numVal >= 0
                        return (
                          <tr key={row.price_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '0.5rem' }}>{row.supply_house_name}</td>
                            <td style={{ padding: '0.5rem' }}>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editVal}
                                onChange={(e) => setPartPricesModalEditing((p) => ({ ...p, [row.price_id]: e.target.value }))}
                                style={{ width: '6rem', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                              />
                            </td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => isValid && updatePartPriceInModal(row.price_id, numVal)}
                                disabled={!isValid || partPricesModalUpdating === row.price_id}
                                style={{ padding: '0.25rem 0.5rem', background: isValid ? '#059669' : '#d1d5db', color: 'white', border: 'none', borderRadius: 4, cursor: isValid ? 'pointer' : 'not-allowed', fontSize: '0.8125rem' }}
                              >
                                {partPricesModalUpdating === row.price_id ? 'Updating…' : 'Update'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ margin: 0, marginBottom: '1rem', color: '#6b7280' }}>No prices yet. Add one below.</p>
                )}
                {(() => {
                  const existingSupplyHouseIds = new Set((partPricesModalData ?? []).map((r) => r.supply_house_id))
                  const supplyHousesWithoutPrice = supplyHouses.filter((sh) => !existingSupplyHouseIds.has(sh.id))
                  const addPriceNum = parseFloat(partPricesModalAddPrice)
                  const canAdd = partPricesModalAddSupplyHouseId && !isNaN(addPriceNum) && addPriceNum > 0 && !partPricesModalAdding && supplyHousesWithoutPrice.length > 0
                  return supplyHousesWithoutPrice.length > 0 ? (
                    <div style={{ paddingTop: '1rem', borderTop: '1px solid #e5e7eb', marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>Add price:</span>
                      <select
                        value={partPricesModalAddSupplyHouseId}
                        onChange={(e) => setPartPricesModalAddSupplyHouseId(e.target.value)}
                        style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, minWidth: '140px' }}
                      >
                        <option value="">Select supply house</option>
                        {supplyHousesWithoutPrice.map((sh) => (
                          <option key={sh.id} value={sh.id}>{sh.name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={partPricesModalAddPrice}
                        onChange={(e) => setPartPricesModalAddPrice(e.target.value)}
                        placeholder="Price"
                        style={{ width: '6rem', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                      />
                      <button
                        type="button"
                        onClick={() => canAdd && addPartPriceInModal(partPricesModalAddSupplyHouseId, addPriceNum)}
                        disabled={!canAdd}
                        style={{ padding: '0.25rem 0.5rem', background: canAdd ? '#3b82f6' : '#d1d5db', color: 'white', border: 'none', borderRadius: 4, cursor: canAdd ? 'pointer' : 'not-allowed', fontSize: '0.8125rem' }}
                      >
                        {partPricesModalAdding ? 'Adding…' : 'Add'}
                      </button>
                    </div>
                  ) : null
                })()}
              </>
            )}
          </div>
        </div>
      )}
      </div>
    </>
  )
}

function CountRow({ row, index, totalCount, moveDisabled, highlight, onUpdate, onDelete, onMoveUp, onMoveDown }: {
  row: BidCountRow
  index: number
  totalCount: number
  moveDisabled?: boolean
  highlight?: boolean
  onUpdate: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const [fixture, setFixture] = useState(row.fixture ?? '')
  const [count, setCount] = useState(String(row.count))
  const [groupTag, setGroupTag] = useState(row.group_tag ?? '')
  const [page, setPage] = useState(row.page ?? '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const num = parseFloat(count)
    if (isNaN(num)) { setSaving(false); return }
    const { error } = await supabase.from('bids_count_rows').update({ fixture: fixture.trim(), count: num, group_tag: groupTag.trim() || null, page: page.trim() || null }).eq('id', row.id)
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

  const rowStyle = highlight ? { borderBottom: '1px solid #e5e7eb', background: '#dcfce7' } : { borderBottom: '1px solid #e5e7eb' }
  if (editing) {
    return (
      <tr style={rowStyle}>
        <td style={{ padding: '0.75rem', width: 132, textAlign: 'center' }}>
          <input type="number" step="any" value={count} onChange={(e) => setCount(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'center' }} />
        </td>
        <td style={{ padding: '0.75rem', width: '50%' }}>
          <input type="text" value={fixture} onChange={(e) => setFixture(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
        </td>
        <td style={{ padding: '0.75rem' }}>
          <input type="text" value={groupTag} onChange={(e) => setGroupTag(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
        </td>
        <td style={{ padding: '0.75rem' }}>
          <input type="text" value={page} onChange={(e) => setPage(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
        </td>
        <td style={{ padding: '0.75rem' }}>
          <button type="button" onClick={save} disabled={saving} style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Save</button>
          <button type="button" onClick={() => setEditing(false)} style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
        </td>
      </tr>
    )
  }
  return (
    <tr style={rowStyle}>
      <td style={{ padding: '0.75rem', textAlign: 'center' }}>{row.count}</td>
      <td style={{ padding: '0.75rem' }}>{row.fixture ?? ''}</td>
      <td style={{ padding: '0.75rem' }}>{row.group_tag ?? '—'}</td>
      <td style={{ padding: '0.75rem' }}>{row.page ?? '—'}</td>
      <td style={{ padding: '0.75rem' }}>
        <span style={{ display: 'inline-flex', flexDirection: 'row', gap: 0, marginRight: '0.5rem' }}>
          <button type="button" onClick={onMoveUp} disabled={index === 0 || moveDisabled} title="Move row up one position" style={{ padding: '2px 1px', border: 'none', background: 'none', cursor: index === 0 || moveDisabled ? 'not-allowed' : 'pointer', color: index === 0 || moveDisabled ? '#d1d5db' : '#6b7280', lineHeight: 1 }}>▲</button>
          <button type="button" onClick={onMoveDown} disabled={index === totalCount - 1 || moveDisabled} title="Move row down one position" style={{ padding: '2px 1px', border: 'none', background: 'none', cursor: index === totalCount - 1 || moveDisabled ? 'not-allowed' : 'pointer', color: index === totalCount - 1 || moveDisabled ? '#d1d5db' : '#6b7280', lineHeight: 1 }}>▼</button>
        </span>
        <button type="button" onClick={() => setEditing(true)} title="Edit" aria-label="Edit" style={{ marginRight: '0.25rem', padding: '0.25rem', cursor: 'pointer', background: 'none', border: 'none', color: '#6b7280', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden="true">
            <path d="M535.6 85.7C513.7 63.8 478.3 63.8 456.4 85.7L432 110.1L529.9 208L554.3 183.6C576.2 161.7 576.2 126.3 554.3 104.4L535.6 85.7zM236.4 305.7C230.3 311.8 225.6 319.3 222.9 327.6L193.3 416.4C190.4 425 192.7 434.5 199.1 441C205.5 447.5 215 449.7 223.7 446.8L312.5 417.2C320.7 414.5 328.2 409.8 334.4 403.7L496 241.9L398.1 144L236.4 305.7zM160 128C107 128 64 171 64 224L64 480C64 533 107 576 160 576L416 576C469 576 512 533 512 480L512 384C512 366.3 497.7 352 480 352C462.3 352 448 366.3 448 384L448 480C448 497.7 433.7 512 416 512L160 512C142.3 512 128 497.7 128 480L128 224C128 206.3 142.3 192 160 192L256 192C273.7 192 288 177.7 288 160C288 142.3 273.7 128 256 128L160 128z" />
          </svg>
        </button>
        <button type="button" onClick={remove} title="Delete" aria-label="Delete" style={{ padding: '0.25rem', cursor: 'pointer', background: 'none', border: 'none', color: '#991b1b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden="true">
            <path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z" />
          </svg>
        </button>
      </td>
    </tr>
  )
}

function NewCountRow({ bidId, serviceTypeId, onSaved, onCancel, onSavedAndAddAnother }: { bidId: string; serviceTypeId?: string; onSaved: () => void; onCancel: () => void; onSavedAndAddAnother?: () => void }) {
  const { showToast } = useToastContext()
  const [fixture, setFixture] = useState('')
  const [count, setCount] = useState('')
  const [groupTag, setGroupTag] = useState('')
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
    const { data: maxSeqData } = await supabase.from('bids_count_rows').select('sequence_order').eq('bid_id', bidId).order('sequence_order', { ascending: false }).limit(1)
    const maxSeq = maxSeqData?.[0]?.sequence_order ?? 0
    const { error } = await supabase.from('bids_count_rows').insert({ bid_id: bidId, fixture: fixture.trim(), count: num, group_tag: groupTag.trim() || null, page: page.trim() || null, sequence_order: maxSeq + 1 })
    if (error) { setSaving(false); showToast(error.message, 'error'); return }
    onSaved()
  }

  async function submitAndAdd() {
    const num = parseFloat(count)
    if (isNaN(num) || !fixture.trim()) return
    setSaving(true)
    const { data: maxSeqData } = await supabase.from('bids_count_rows').select('sequence_order').eq('bid_id', bidId).order('sequence_order', { ascending: false }).limit(1)
    const maxSeq = maxSeqData?.[0]?.sequence_order ?? 0
    const { error } = await supabase.from('bids_count_rows').insert({ bid_id: bidId, fixture: fixture.trim(), count: num, group_tag: groupTag.trim() || null, page: page.trim() || null, sequence_order: maxSeq + 1 })
    if (error) { setSaving(false); showToast(error.message, 'error'); return }
    setFixture('')
    setCount('')
    setGroupTag('')
    setPage('')
    setSaving(false)
    onSavedAndAddAnother?.()
  }

  const calcWidth = 132
  const hasFixtureGroups = countsFixtureGroups.length > 0
  const missingFields: string[] = []
  if (!fixture.trim()) missingFields.push('Fixture')
  if (isNaN(parseFloat(count))) missingFields.push('Count')
  const canSubmit = missingFields.length === 0

  return (
    <>
      <tr style={{ borderBottom: hasFixtureGroups ? 'none' : '1px solid #e5e7eb' }}>
        <td rowSpan={hasFixtureGroups ? 2 : 1} style={{ padding: '0.75rem', width: calcWidth, verticalAlign: 'top', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: calcWidth }}>
            <input type="number" step="any" value={count} onChange={(e) => setCount(e.target.value)} placeholder="Count*" style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.25rem', width: calcWidth, marginTop: hasFixtureGroups ? '1.75rem' : undefined }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                <button key={d} type="button" onClick={() => setCount((c) => c + String(d))} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>{d}</button>
              ))}
              <button type="button" onClick={() => setCount('')} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }} title="All clear">C</button>
              <button type="button" onClick={() => setCount((c) => c + '0')} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>0</button>
              <button type="button" onClick={() => setCount((c) => c.slice(0, -1))} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }} title="Delete">⌫</button>
            </div>
          </div>
        </td>
        <td style={{ padding: '0.75rem', width: '50%', verticalAlign: 'top', borderBottom: '1px solid #e5e7eb' }}>
          <input type="text" value={fixture} onChange={(e) => setFixture(e.target.value)} placeholder="Fixture or Tie-in*" style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
        </td>
        <td style={{ padding: '0.75rem', verticalAlign: 'top', borderBottom: '1px solid #e5e7eb' }}>
          <input type="text" value={groupTag} onChange={(e) => setGroupTag(e.target.value)} placeholder="Group/Tag" style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
        </td>
        <td style={{ padding: '0.75rem', verticalAlign: 'top', borderBottom: '1px solid #e5e7eb' }}>
          <input type="text" value={page} onChange={(e) => setPage(e.target.value)} placeholder="Plan Page" style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
        </td>
        <td rowSpan={hasFixtureGroups ? 2 : 1} style={{ padding: '0.75rem', verticalAlign: 'top', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
              <button type="button" onClick={submit} disabled={!canSubmit || saving} title={!canSubmit ? `Required: ${missingFields.join(', ')}` : undefined} style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Save</button>
              <button type="button" onClick={onCancel} style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
              <button type="button" onClick={submitAndAdd} disabled={!canSubmit || saving} title={!canSubmit ? `Required: ${missingFields.join(', ')}` : undefined} style={{ padding: '0.25rem 0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', alignSelf: 'center' }}>Save and Add</button>
              {!canSubmit && !saving && missingFields.length > 0 && (
                <span style={{ fontSize: '0.8rem', color: '#FF6600', display: 'inline-block' }}>
                <span style={{ display: 'block' }}>Required:</span>
                {missingFields.map((f) => (
                  <span key={f} style={{ display: 'block', marginLeft: '0.25em' }}>{f}</span>
                ))}
              </span>
              )}
            </div>
          </div>
        </td>
      </tr>
      {hasFixtureGroups && (
        <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
          <td colSpan={3} style={{ padding: '0.75rem', verticalAlign: 'top' }}>
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
          </td>
        </tr>
      )}
    </>
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
