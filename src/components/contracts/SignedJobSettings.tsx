/**
 * The settings a job's paper was signed with (punch list #389, step 3), on the office's signed record. A paper built
 * from settings keeps the job's picks on the signed copy, said in the settings list's own plain words as they read
 * that day, with a seal of the words. This draws them one fact a line, and says whether the words still match the
 * seal. The picks are worked out, never changed here: a signed copy keeps what was signed.
 */
import { SEAL_WORDS, type KeptJobSettings } from '../../lib/contracts/jobPaperSettings'
import { SUMMARY_NOTE } from '../../lib/contracts/paperSummary'
import { ValueLine, ValueLines, WorkedOutValue } from '../valuesInPlace/ValuesInPlace'

export function SignedJobSettings({ kept, sealHolds, lang }: { kept: KeptJobSettings; sealHolds: boolean | null; lang: 'en' | 'es' }) {
  return (
    <section data-signed-settings aria-label="The job’s settings when this was signed" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.85rem 1rem', background: 'var(--surface)', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>The job’s settings when this was signed</h3>
      <ValueLines>
        {kept.said.map((line) => (
          <ValueLine key={line.key} label={line.label}>
            <WorkedOutValue>{line.choice}</WorkedOutValue>
            {line.says ? <span style={{ color: 'var(--text-muted)' }}> {line.says}</span> : null}
          </ValueLine>
        ))}
        <ValueLine label="Settings">
          <WorkedOutValue>{`Revision ${kept.settingsRevision}`}</WorkedOutValue>
        </ValueLine>
      </ValueLines>
      <p style={{ margin: '0.6rem 0 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>{SUMMARY_NOTE[lang]}</p>
      {sealHolds == null ? null : (
        <p data-seal={sealHolds ? 'holds' : 'broken'} role={sealHolds ? undefined : 'alert'} style={{ margin: '0.35rem 0 0', color: sealHolds ? 'var(--text-muted)' : 'var(--text-red-700)', fontSize: '0.82rem' }}>
          {sealHolds ? SEAL_WORDS.holds : SEAL_WORDS.broken}
        </p>
      )}
    </section>
  )
}
