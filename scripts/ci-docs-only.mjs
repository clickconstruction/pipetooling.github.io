#!/usr/bin/env node
/**
 * ci.yml's "Which files changed" step: reads the compare API's JSON on stdin and writes
 *   docs_only=true|false   doc_tests=<the doc-reading tests>
 * to $GITHUB_OUTPUT (stdout when unset). Anything unreadable is a code change, so the whole suite runs.
 * The rule is scripts/lib/docsOnlyChange.mjs.
 */
import { appendFileSync } from 'node:fs'
import { docsOnlyOutputs, docsOnlyVerdict, filesOfCompare } from './lib/docsOnlyChange.mjs'

let raw = ''
for await (const chunk of process.stdin) raw += chunk
let body = null
try {
  body = raw.trim() ? JSON.parse(raw) : null
} catch {
  body = null
}
const files = filesOfCompare(body)
const verdict = body ? docsOnlyVerdict(files) : { docsOnly: false, reason: 'the compare did not read, so everything runs', outside: [] }
const lines = docsOnlyOutputs(verdict)
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, lines.join('\n') + '\n')
else console.log(lines.join('\n'))
console.log(`${verdict.docsOnly ? 'docs-only' : 'full suite'} — ${verdict.reason}`)
