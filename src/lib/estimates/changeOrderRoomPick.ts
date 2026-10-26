/**
 * Which open bid room a change order publishes into (Estimates detail,
 * `publishCoToBidRoom`): the room whose customer matches the CO's customer,
 * else the only open room, else the customer-less room — and null when several
 * rooms exist and none matches (the page refuses with a toast; the GC must be
 * set first). A CO with no customer matches a customer-less room directly.
 */
export function pickBidRoomForChangeOrder<T extends { customer_id: string | null }>(
  rooms: T[],
  customerId: string | null,
): T | null {
  return (
    rooms.find((r) => r.customer_id === customerId) ??
    (rooms.length === 1 ? rooms[0] : rooms.find((r) => r.customer_id === null)) ??
    null
  )
}
