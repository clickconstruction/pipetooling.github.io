/**
 * People → Feedback → Retired questions (dev, v2.2824): the ten agree/disagree prompts and the
 * overall question the old wizard asked, exactly as last saved, read-only. The columns stay on
 * team_feedback_settings; docs/TEAM_FEEDBACK_RETIRED_QUESTIONS.md is the copy in the repo.
 */
import { useMemo } from 'react'
import { retiredQuestionGroups } from '../../lib/people/crewReview'
import type { TeamFeedbackSettingsRow } from '../../lib/teamFeedback'
import {
  DEFAULT_MANAGER_LIKERT_PROMPTS,
  DEFAULT_MANAGER_OVERALL_PROMPT,
  DEFAULT_MANAGER_STEP_HEADING,
  DEFAULT_PEER_LIKERT_PROMPTS,
  DEFAULT_PEER_STEP_HEADING,
} from '../../lib/teamFeedbackCopy'

export default function RetiredQuestionsPanel({ settings }: { settings: TeamFeedbackSettingsRow | null }) {
  const groups = useMemo(
    () =>
      retiredQuestionGroups(
        settings ?? {
          manager_step_heading: null,
          manager_likert_prompts: null,
          manager_overall_prompt: null,
          peer_step_heading: null,
          peer_likert_prompts: null,
        },
        {
          managerHeading: DEFAULT_MANAGER_STEP_HEADING,
          managerPrompts: DEFAULT_MANAGER_LIKERT_PROMPTS,
          managerOverall: DEFAULT_MANAGER_OVERALL_PROMPT,
          peerHeading: DEFAULT_PEER_STEP_HEADING,
          peerPrompts: DEFAULT_PEER_LIKERT_PROMPTS,
        },
      ),
    [settings],
  )
  const retiredAt = settings?.questions_retired_at ? new Date(settings.questions_retired_at) : null

  return (
    <div style={{ marginTop: '0.75rem', maxWidth: 720 }}>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        Retired {retiredAt ? retiredAt.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : ''}. These were asked as 1–5 agree/disagree (plus a 1–10 overall) before
        the deck moved to the three bars. Saved here and in the repo; nothing asks them any more.
      </p>
      {groups.map((g) => (
        <div key={g.heading} style={{ marginBottom: '0.9rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-700)', marginBottom: '0.3rem' }}>{g.heading}</div>
          <ol style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: 'var(--text-700)', display: 'grid', gap: '0.2rem' }}>
            {g.items.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  )
}
