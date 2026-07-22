-- Dispatch swim lanes: named, ordered, office-wide person groups ("crews")
-- rendered as sections on Dispatch -> People and editable from Dispatch
-- Settings. Strict lanes: a person belongs to at most ONE lane (unique index).
-- Read: any authenticated user. Write: the schedule-dispatch edit cohort
-- (dev / master_technician / assistant / controller / superintendent),
-- mirroring job_schedule_blocks' role gate plus controller (client parity
-- with CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES).

CREATE TABLE IF NOT EXISTS "public"."dispatch_swim_lanes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_by" uuid REFERENCES "public"."users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "public"."dispatch_swim_lane_members" (
  "lane_id" uuid NOT NULL REFERENCES "public"."dispatch_swim_lanes"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("lane_id", "user_id")
);

-- Strict swim lanes: one lane per person, enforced by the database.
CREATE UNIQUE INDEX IF NOT EXISTS "dispatch_swim_lane_members_user_unique"
  ON "public"."dispatch_swim_lane_members" ("user_id");

ALTER TABLE "public"."dispatch_swim_lanes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."dispatch_swim_lane_members" ENABLE ROW LEVEL SECURITY;

-- Everyone signed in can SEE the lanes (universal share).
DROP POLICY IF EXISTS "dispatch_swim_lanes_select" ON "public"."dispatch_swim_lanes";
CREATE POLICY "dispatch_swim_lanes_select" ON "public"."dispatch_swim_lanes"
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "dispatch_swim_lane_members_select" ON "public"."dispatch_swim_lane_members";
CREATE POLICY "dispatch_swim_lane_members_select" ON "public"."dispatch_swim_lane_members"
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

-- Writes: the schedule-dispatch edit cohort.
DROP POLICY IF EXISTS "dispatch_swim_lanes_write" ON "public"."dispatch_swim_lanes";
CREATE POLICY "dispatch_swim_lanes_write" ON "public"."dispatch_swim_lanes"
  FOR ALL USING (EXISTS (
    SELECT 1 FROM "public"."users" "u"
    WHERE "u"."id" = (SELECT auth.uid())
      AND "u"."role" = ANY (ARRAY['dev'::"public"."user_role", 'master_technician'::"public"."user_role", 'assistant'::"public"."user_role", 'controller'::"public"."user_role", 'superintendent'::"public"."user_role"])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "public"."users" "u"
    WHERE "u"."id" = (SELECT auth.uid())
      AND "u"."role" = ANY (ARRAY['dev'::"public"."user_role", 'master_technician'::"public"."user_role", 'assistant'::"public"."user_role", 'controller'::"public"."user_role", 'superintendent'::"public"."user_role"])
  ));

DROP POLICY IF EXISTS "dispatch_swim_lane_members_write" ON "public"."dispatch_swim_lane_members";
CREATE POLICY "dispatch_swim_lane_members_write" ON "public"."dispatch_swim_lane_members"
  FOR ALL USING (EXISTS (
    SELECT 1 FROM "public"."users" "u"
    WHERE "u"."id" = (SELECT auth.uid())
      AND "u"."role" = ANY (ARRAY['dev'::"public"."user_role", 'master_technician'::"public"."user_role", 'assistant'::"public"."user_role", 'controller'::"public"."user_role", 'superintendent'::"public"."user_role"])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "public"."users" "u"
    WHERE "u"."id" = (SELECT auth.uid())
      AND "u"."role" = ANY (ARRAY['dev'::"public"."user_role", 'master_technician'::"public"."user_role", 'assistant'::"public"."user_role", 'controller'::"public"."user_role", 'superintendent'::"public"."user_role"])
  ));

-- Training-mode (users.read_only) protection: restrictive write policies +
-- the statement trigger that also stops SECURITY DEFINER RPCs (repo rule for
-- every CREATE TABLE migration).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
