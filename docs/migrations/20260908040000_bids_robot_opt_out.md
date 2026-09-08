# 20260908040000 — bids.robot_opt_out

v2.3142. `bids.robot_opt_out boolean NOT NULL DEFAULT false` — the bid form's "Don't let robots shadow this bid". Read by twin-mcp (queue, dispatcher, `open_shadow` refusal), the Scoreboard coverage kernel, and the Bid Board icon. Additive, idempotent; default keeps every existing bid shadow-eligible.
