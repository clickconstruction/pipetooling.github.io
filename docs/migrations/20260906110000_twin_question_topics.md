# 20260906110000 — twin_questions.topic (standing-rulings key)

LEARNING_PLAN.md lever 1 groundwork (v2.2939). Robots ask variants of the same doctrine question on different bids; `topic` is a kebab slug naming the doctrine issue (`travel-bands`, `small-ti-absorption`) so the standing-rulings surface can group open questions and one answer settles the pile. Nullable, no default — bid-specific questions stay ungrouped; old rows backfill lazily. Partial index on non-null topics. Additive + idempotent; old clients ignore it.

Written by `ask_question(topic)` (twin-mcp v1.3.8); read back through `get_answers` and the upcoming standing-rulings panel.
