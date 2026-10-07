/**
 * Who may open People → Spending (punch list #52, the owner 2026-09-28): the office roles —
 * dev, master technician, assistant, controller — the roles that read the company's card
 * charges. `list_card_charges_window` enforces the same set (`is_office_staff()`); this only
 * shapes the tab strip.
 */
export function canOpenSpending(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'controller'
}
