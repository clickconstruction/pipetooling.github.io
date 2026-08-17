SET lock_timeout = '3s';

-- Customer addresses (addresses train PR 1, 2026-08-17): a customer can have
-- multiple addresses, each with a free-text note ("rental on Oak St", "shop —
-- deliveries in back"). customers.address stays the PRIMARY address so every
-- existing consumer (map links, pickers, supply-house prefill) is untouched;
-- rows here are additive extras. Access mirrors customer_contact_persons
-- (office roles + estimator, gated through the parent customer's access).

CREATE TABLE IF NOT EXISTS "public"."customer_addresses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "address" "text" NOT NULL,
    "note" "text",
    "sequence_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "customer_addresses_customer_id_fkey" FOREIGN KEY ("customer_id")
        REFERENCES "public"."customers"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "customer_addresses_customer_id_idx"
    ON "public"."customer_addresses" ("customer_id", "sequence_order");

COMMENT ON TABLE "public"."customer_addresses" IS
  'Additional addresses per customer with a note each; customers.address remains the primary.';

ALTER TABLE "public"."customer_addresses" ENABLE ROW LEVEL SECURITY;

-- Same access predicate as customer_contact_persons: office roles +
-- estimator, AND access to the parent customer (owner / dev / master /
-- adoption / share / estimator).
DO $$
DECLARE
  verb text;
  policy_name text;
  clause text := $c$(
    (EXISTS ( SELECT 1 FROM "public"."users"
      WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid"))
        AND ("users"."role" = ANY (ARRAY['dev'::"public"."user_role", 'master_technician'::"public"."user_role", 'assistant'::"public"."user_role", 'estimator'::"public"."user_role"])))))
    AND (EXISTS ( SELECT 1 FROM "public"."customers" "c"
      WHERE (("c"."id" = "customer_addresses"."customer_id")
        AND (("c"."master_user_id" = ( SELECT "auth"."uid"() AS "uid"))
          OR (EXISTS ( SELECT 1 FROM "public"."users"
                WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid"))
                  AND ("users"."role" = ANY (ARRAY['dev'::"public"."user_role", 'master_technician'::"public"."user_role"])))))
          OR (EXISTS ( SELECT 1 FROM "public"."master_assistants"
                WHERE (("master_assistants"."master_id" = "c"."master_user_id")
                  AND ("master_assistants"."assistant_id" = ( SELECT "auth"."uid"() AS "uid")))))
          OR (EXISTS ( SELECT 1 FROM "public"."master_shares"
                WHERE (("master_shares"."sharing_master_id" = "c"."master_user_id")
                  AND ("master_shares"."viewing_master_id" = ( SELECT "auth"."uid"() AS "uid")))))
          OR (EXISTS ( SELECT 1 FROM "public"."users"
                WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid"))
                  AND ("users"."role" = 'estimator'::"public"."user_role"))))))))
  )$c$;
BEGIN
  FOREACH verb IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'] LOOP
    policy_name := 'Office roles and estimators can ' || lower(verb) || ' customer addresses';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'customer_addresses' AND policyname = policy_name
    ) THEN
      IF verb = 'INSERT' THEN
        EXECUTE format('CREATE POLICY %I ON "public"."customer_addresses" FOR INSERT WITH CHECK %s', policy_name, clause);
      ELSIF verb = 'UPDATE' THEN
        EXECUTE format('CREATE POLICY %I ON "public"."customer_addresses" FOR UPDATE USING %s WITH CHECK %s', policy_name, clause, clause);
      ELSE
        EXECUTE format('CREATE POLICY %I ON "public"."customer_addresses" FOR %s USING %s', policy_name, verb, clause);
      END IF;
    END IF;
  END LOOP;
END;
$$;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
