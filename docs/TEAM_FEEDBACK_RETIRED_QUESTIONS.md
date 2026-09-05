# Team Feedback — the retired questions

---
file: docs/TEAM_FEEDBACK_RETIRED_QUESTIONS.md
type: Reference / Archive
purpose: The scripted questions the Team Feedback wizard asked before v2.2824 replaced it with the three-bar crew deck. Kept so the wording is never lost.
audience: Owner, Developers
last_updated: 2026-09-05
---

Retired 2026-09-05 (v2.2824). The clock-out prompt now deals the **Ability / Drive / Integrity** sliders per teammate (see `docs/recent-features/v2.2824.md`). The columns that held these prompts on `team_feedback_settings` (`manager_likert_prompts`, `peer_likert_prompts`, `manager_overall_prompt`, `manager_step_heading`, `peer_step_heading`, the `inclusion_*` copy) are **kept, not written**; `questions_retired_at` records the date. The dev Feedback tab shows the saved wording read-only under **Retired questions**. The three open questions survive as headings on the deck's last card.

## About your lead / manager (1–5 agree/disagree, then 1–10 overall)

1. My manager clearly explains the job scope, parts needed, and customer expectations before I leave the shop.
2. My manager is quick and helpful when I call with problems on the job (parts, technical, or customer issues).
3. My manager assigns jobs, overtime, and tough calls fairly.
4. I feel safe bringing up safety concerns or improvement ideas with my manager.
5. My manager gives clear, useful feedback that actually helps me do my job better.

Overall: *Overall, how satisfied are you with leadership support? (1–10)*

## About your teammates (1–5 agree/disagree, up to three peers)

1. This person shows up prepared and on time.
2. This person does quality work with good attention to detail.
3. This person is willing to help teammates when a job gets tough.
4. This person communicates clearly and professionally on the job site.
5. I would trust this person as my partner on a complex or high-pressure job. *(also stored as `peer_trust`)*

## Open questions (kept on the new deck as headings)

- Something we should fix or improve
- Safety or tools
- Training you want

## Wizard copy that is no longer shown

- Inclusion step: *What would you like to include?* / *Pick at least one. You can use only written feedback, only ratings, or both.* with chips **Manager ratings**, **Peer ratings**, **Open comments**.
- Intro (still used by the deck): *100% Anonymous — No names or employee IDs are attached. Your feedback helps us run better, safer jobs.*

## Where the old answers live

`team_feedback_submissions` (`manager_likert_1..5`, `manager_overall_1_10`) and `team_feedback_peer_ratings` (`peer_likert_1..5`, `peer_trust`). Three test submissions from March 2026 exist; the columns are never written again. The `team_feedback_aggregates_by_manager` view still reads them and is unused.
