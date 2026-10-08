import { formatCurrency } from '../../../lib/format'

/**
 * Sign-aware cents-precision money: -$244.16 instead of $-244.16 (fmtMoney's
 * sign idiom, formatCurrency's decimals). For the Jobs Worked cells that can
 * legitimately go negative.
 */
export function signedCurrency(n: number): string {
  return `${n < 0 ? '-$' : '$'}${formatCurrency(Math.abs(n))}`
}

/** "105 Dover Rd San Antonio, TX 78209" → "105 Dover Rd San Antonio": Jobs Worked drops the state and ZIP for its own layout. */
export function stripAddressZipState(addr: string): string {
  return (addr ?? '').replace(/\s*,\s*[A-Z]{2}\s+\d{5}(-\d{4})?\s*$/i, '').trim()
}
