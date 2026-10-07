/**
 * GC mode design spike: schedule templates, the Gantt's G-44 (the mock-up and plan are
 * `to-dos/gc-mode/mockups/G-44.md`). A job being built can be saved as a template: its shape with no
 * dates. Each line of each trade, and the two inspections the first draft draws, keeps its days, the
 * lines it waits on and its offset, how many days after the last of them it started.
 *
 * The next job like it starts from one: the rough while bidding (G-45) and the first draft both draw
 * through the first draft's own kernel, `scheduleDraft`, with the template's lines as its `like`
 * argument. So there is one path. A line of the same trade and name runs as it ran there, and every
 * other line is the first draft's own. Days alone would not do: the first draft runs every stage one
 * after another, and Fair Oaks D ran its work side by side, so its days alone draw a twin job at 42
 * weeks, not the 23 it took.
 *
 * A draw takes a copy and records the template it came from, by the name it had that day. Renaming a
 * template or setting it aside never touches a job. Nothing here reaches the trades or the customer.
 * Its own file, out of the barrel.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export { DRAFT_INSPECTIONS, TEMPLATE_NAME_MAX, cleanTemplateName, drawnFromWords, roughTemplateWords, stagesCovered, templateAsideWords, templateCovers, templateFitWords, templateNameProblem, templateSavedWords, templateShape, templateSizeWords, templateUsedLines, templateUses, templateWeeks, templatesOffered } from '../gc/schedule/templates'

