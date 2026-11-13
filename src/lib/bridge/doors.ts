/**
 * The Bridge's doors (v2.6840, punch list #303, PR 2): the page is the first screen, and
 * everything else it had sits behind one of four doors under it. One door is open at a time,
 * and it rides in the address (`?door=money`) so a link can open it.
 *
 * Where the old scroll went:
 * - The flow: the rule, the five steps and their desks, the dial and the usual fixes, the three
 *   resources, the link's desk, the weekly email's switch.
 * - Money: cash for eight weeks with the bank's accounts, bills and receipts, net position with
 *   the truth check inside it, money owed, the eight week chart.
 * - People: who moved the number, the day grid, crew hours.
 * - Soft numbers: the one list of what makes the reading unsure.
 */

export type DoorId = 'flow' | 'money' | 'people' | 'soft'

export const DOOR_PARAM = 'door'

export type Door = { id: DoorId; name: string; holds: string; holdsShort: string }

export const BRIDGE_DOORS: ReadonlyArray<Door> = [
  { id: 'flow', name: 'The flow', holds: 'five steps and their desks', holdsShort: 'five steps' },
  { id: 'money', name: 'Money', holds: 'cash, net position, what is owed', holdsShort: 'cash, owed' },
  { id: 'people', name: 'People', holds: 'who moved the number', holdsShort: 'who moved it' },
  { id: 'soft', name: 'Soft numbers', holds: 'what makes the reading unsure', holdsShort: 'what is unsure' },
]

const IDS = new Set<string>(BRIDGE_DOORS.map((d) => d.id))

/** The door the address names; null for none, for a word that is no door, and for Soft numbers when nothing is soft. */
export function doorFromSearch(value: string | null | undefined, softCount: number): DoorId | null {
  if (!value || !IDS.has(value)) return null
  if (value === 'soft' && softCount <= 0) return null
  return value as DoorId
}

/** The address after a door is pressed: the pressed door opens, and pressing the open one closes it unless `keepOpen`. */
export function searchAfterDoor(search: string, pressed: DoorId, open: DoorId | null, keepOpen = false): string {
  const p = new URLSearchParams(search)
  // The Monday sheet's old address retired with the view.
  p.delete('view')
  if (pressed === open && !keepOpen) p.delete(DOOR_PARAM)
  else p.set(DOOR_PARAM, pressed)
  return p.toString()
}

/** The doors to draw: Soft numbers only when something is soft, with its count as the name. */
export function doorsToDraw(softCount: number): Door[] {
  return BRIDGE_DOORS.flatMap((d) => (d.id !== 'soft' ? [d] : softCount > 0 ? [{ ...d, name: `${softCount} soft ${softCount === 1 ? 'number' : 'numbers'}` }] : []))
}
