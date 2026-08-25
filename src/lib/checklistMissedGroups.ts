/**
 * Missed-view collapse (owner-reported: a daily task missed for months showed
 * as ~180 separate rows and made "505 outstanding" counts): a missed task is
 * ONE task, incomplete for X days — not one row per missed day.
 *
 * Groups a person's missed instances by checklist item. The representative is
 * the FIRST instance in display order (the person's list sorts by
 * display_order then date, so that's the oldest — it drives the age chip);
 * `instanceIds` carries every missed copy so ✓ can resolve and 🗑 can delete
 * the whole backlog at once; `newestScheduledDate` feeds the
 * days_after_completion math so the next occurrence computes off the latest
 * miss, not the ancient one. Pure; the Review tab renders the result.
 */

export type MissedGroup<T> = {
  representative: T
  /** Every missed instance id in the group, oldest first (includes the representative). */
  instanceIds: string[]
  count: number
  newestScheduledDate: string
}

export function collapseMissedInstances<
  T extends { id: string; checklist_item_id: string; scheduled_date: string },
>(instances: readonly T[]): MissedGroup<T>[] {
  const byItem = new Map<string, MissedGroup<T>>()
  const order: string[] = []
  for (const inst of instances) {
    const existing = byItem.get(inst.checklist_item_id)
    if (!existing) {
      byItem.set(inst.checklist_item_id, {
        representative: inst,
        instanceIds: [inst.id],
        count: 1,
        newestScheduledDate: inst.scheduled_date,
      })
      order.push(inst.checklist_item_id)
    } else {
      existing.instanceIds.push(inst.id)
      existing.count += 1
      if (inst.scheduled_date > existing.newestScheduledDate) existing.newestScheduledDate = inst.scheduled_date
      // Oldest stays the representative: list order is display_order then
      // date, but be safe against out-of-order input.
      if (inst.scheduled_date < existing.representative.scheduled_date) existing.representative = inst
    }
  }
  return order.map((itemId) => byItem.get(itemId)!)
}
