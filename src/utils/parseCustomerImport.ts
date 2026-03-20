const ADDRESS_STREET_INDICATORS = /\b(Dr|St|Ave|Rd|Blvd|Ln|Ct|Way|Pl|Cir|Pkwy)\b/i

function isAddressPart(part: string): boolean {
  const trimmed = part.trim()
  if (!trimmed) return false
  if (ADDRESS_STREET_INDICATORS.test(trimmed)) return true
  if (trimmed.length >= 15 && /\d/.test(trimmed)) return true
  return false
}

/**
 * Parse clipboard text into name, address, email, phone for Edit Job customer import.
 * Delimiters (order of preference): tabs, 2+ spaces, single spaces.
 * Identifies parts by pattern: email (@), phone (10+ digits), address (street indicators or long+digits), name (remainder).
 */
export function parseCustomerImport(input: string): { name: string; address: string; email: string; phone: string } {
  const trimmed = input.trim()
  if (!trimmed) return { name: '', address: '', email: '', phone: '' }

  let parts = trimmed.split(/\t+/).map((p) => p.trim()).filter((p) => p.length > 0)
  if (parts.length < 2) {
    parts = trimmed.split(/\s{2,}/).map((p) => p.trim()).filter((p) => p.length > 0)
  }
  if (parts.length < 2) {
    parts = trimmed.split(/\s+/).map((p) => p.trim()).filter((p) => p.length > 0)
  }

  let name = ''
  let address = ''
  let email = ''
  let phone = ''

  const emailIndex = parts.findIndex((p) => p.includes('@'))
  if (emailIndex !== -1 && parts[emailIndex]) {
    email = parts[emailIndex]!
    parts.splice(emailIndex, 1)
  }

  const phoneIndex = parts.findIndex(
    (p) => /[\d\-\(\)\.\s]{10,}/.test(p) && p.replace(/\D/g, '').length >= 10
  )
  if (phoneIndex !== -1 && parts[phoneIndex]) {
    phone = parts[phoneIndex]!
    parts.splice(phoneIndex, 1)
  }

  const addressIndex = parts.findIndex((p) => isAddressPart(p))
  if (addressIndex !== -1 && parts[addressIndex]) {
    address = parts[addressIndex]!
    parts.splice(addressIndex, 1)
  }

  if (parts.length > 0) {
    name = parts.filter(Boolean).join(' ')
  }

  return { name, address, email, phone }
}
