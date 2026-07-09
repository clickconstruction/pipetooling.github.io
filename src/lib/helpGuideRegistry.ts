/**
 * The only module that touches import.meta.glob (Vite-only API), so the
 * helpGuides kernels stay node-testable. Eager is intentional: guide text is
 * tens of KB and ships inside the lazy /help page chunk, which the service
 * worker precaches — guides work offline in the field.
 */
import { buildHelpGuideRegistry, type HelpGuide } from './helpGuides'

const raw = import.meta.glob('../content/help/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export const HELP_GUIDES: HelpGuide[] = buildHelpGuideRegistry(raw)
