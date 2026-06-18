/**
 * The default price-book TEMPLATE for a bid that has not set up its own pricing.
 *
 * Resolution order:
 *  1. The user's remembered "last selected" template — if it still exists in the list.
 *  2. The service type's template literally named "Default".
 *  3. The first template (any), else null.
 *
 * Replaces the old hard-coded `find(name === 'Default') ?? [0]` lookup so each user's last
 * choice becomes their personal default, while preserving the historical "Default" fallback.
 */
export function pickDefaultPriceBookTemplateId(input: {
  userLastTemplateId: string | null
  templates: { id: string; name: string }[]
}): string | null {
  const { userLastTemplateId, templates } = input
  if (userLastTemplateId && templates.some((t) => t.id === userLastTemplateId)) {
    return userLastTemplateId
  }
  return templates.find((t) => t.name === 'Default')?.id ?? templates[0]?.id ?? null
}
