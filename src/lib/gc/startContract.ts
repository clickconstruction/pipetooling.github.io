/**
 * GC mode, the real build: Get started's guard on our contract (the owner, 2026-10-10, after the live walk signed the test
 * project at $0). **Mark it signed** keeps the contract's price by line as `ownerContractWorthNow` reads it today. When
 * that adds up to nothing (no trade carries a price and Our number adds nothing), the window asks before it signs. The
 * write itself is unchanged.
 */
import { ownerContractWorthNow } from './ownerBilling'
import type { GcProject } from './types'

/** What our contract would be signed at today: each trade's carried price, then general conditions, contingency and fee. */
export function ownerContractTotalNow(project: GcProject): number {
  return Object.values(ownerContractWorthNow(project)).reduce((sum, n) => sum + n, 0)
}

/** Signing now would sign our contract at $0 (or less): the window asks first. */
export function contractSignsAtZero(project: GcProject): boolean {
  return ownerContractTotalNow(project) <= 0
}
