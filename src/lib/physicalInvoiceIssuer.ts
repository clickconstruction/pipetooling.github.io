/** Company identity on customer-facing physical invoices (PDF/preview/email). Dev-editable in Settings. */

export type PhysicalInvoiceIssuer = {
  companyName: string
  /** Multiline mailing / service office address */
  addressText: string
  phone: string
  email: string
  tagline: string
  licenseLine: string
}

const LS_KEY = 'physical_invoice_issuer_v1'

const EMPTY: PhysicalInvoiceIssuer = {
  companyName: '',
  addressText: '',
  phone: '',
  email: '',
  tagline: '',
  licenseLine: '',
}

function parseStored(raw: string | null): PhysicalInvoiceIssuer {
  if (!raw) return { ...EMPTY }
  try {
    const o = JSON.parse(raw) as Record<string, unknown>
    return {
      companyName: typeof o.companyName === 'string' ? o.companyName : '',
      addressText: typeof o.addressText === 'string' ? o.addressText : '',
      phone: typeof o.phone === 'string' ? o.phone : '',
      email: typeof o.email === 'string' ? o.email : '',
      tagline: typeof o.tagline === 'string' ? o.tagline : '',
      licenseLine: typeof o.licenseLine === 'string' ? o.licenseLine : '',
    }
  } catch {
    return { ...EMPTY }
  }
}

export function getPhysicalInvoiceIssuerDraft(): PhysicalInvoiceIssuer {
  if (typeof localStorage === 'undefined') return { ...EMPTY }
  return parseStored(localStorage.getItem(LS_KEY))
}

export function savePhysicalInvoiceIssuerDraft(issuer: PhysicalInvoiceIssuer): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(LS_KEY, JSON.stringify(issuer))
}

/** Values passed into the invoice document; omit empty optional blocks in PDF/preview. */
export function getPhysicalInvoiceIssuerForDocument(): PhysicalInvoiceIssuer {
  return getPhysicalInvoiceIssuerDraft()
}
