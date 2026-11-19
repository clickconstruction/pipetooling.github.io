/**
 * The Contract library's role rules, one copy for every page that opens it (People → Contracts, and Documents →
 * Agreements since punch list #376's second train). The window opens to whoever the page lets in; these two say what
 * it lets that person do. The database's own policies still decide every write. Pure.
 */

/** Who may delete a paper, a packet or a Book entry in the library: the owner and a dev. */
export function canDeleteFromContractLibrary(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'master_technician'
}

/** Who sees the library's Forms tab, the Form Studio: the controller with a dev (punch list #188 row 60). */
export function canUseContractFormStudio(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'controller'
}
