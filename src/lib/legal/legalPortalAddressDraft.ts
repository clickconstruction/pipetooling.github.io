/**
 * The office's address editor for a firm's link (v2.4756): the name part the office types and a
 * three-character tail it rolls — my.clickplumbing.com/snell-law-f6a. The server checks the same
 * shape (`legal_portal_address_problem`) and that no customer or sub holds the address.
 */
import { normalizeSlugInput } from '../portal/portalSlug'

export const LEGAL_TAIL_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'
export const LEGAL_TAIL_LENGTH = 3
const BASE_MAX = 36

/** The name part the office starts from: the first two words of the firm's name, as a slug. */
export function legalAddressBase(firmName: string): string {
  const words = normalizeSlugInput(firmName).replace(/-+$/, '').split('-').filter(Boolean).slice(0, 2)
  return cleanBase(words.join('-')) || 'firm'
}

/** What the office typed, as a name part: lowercase, dashes for spaces, nothing else, at most 36 long. */
export function cleanBase(raw: string): string {
  return normalizeSlugInput(raw).slice(0, BASE_MAX).replace(/^-+|-+$/g, '')
}

export function rollLegalTail(rng: () => number = Math.random): string {
  let tail = ''
  for (let i = 0; i < LEGAL_TAIL_LENGTH; i++) tail += LEGAL_TAIL_ALPHABET[Math.min(LEGAL_TAIL_ALPHABET.length - 1, Math.floor(rng() * LEGAL_TAIL_ALPHABET.length))]
  return tail
}

export function composeLegalAddress(base: string, tail: string): string {
  return `${cleanBase(base)}-${tail}`
}

/** An existing address back into the editor: everything before the last dash, and the tail. */
export function splitLegalAddress(address: string): { base: string; tail: string } {
  const m = /^(.*)-([a-z0-9]{3})$/.exec(address)
  return m ? { base: m[1] ?? '', tail: m[2] ?? '' } : { base: address, tail: '' }
}

/** Why an address cannot be saved, in the window's words; null when it can. Mirrors the server's check. */
export function legalAddressProblem(address: string): string | null {
  if (!/^[a-z0-9][a-z0-9-]{3,38}[a-z0-9]$/.test(address)) return 'An address is 5 to 40 characters: lowercase letters, numbers and dashes.'
  if (!/-[a-z0-9]{3}$/.test(address)) return 'An address ends in a dash and three characters.'
  return null
}
