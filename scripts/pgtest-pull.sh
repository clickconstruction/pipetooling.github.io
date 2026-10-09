# Pulls for the SQL beds (scripts/sql-beds.txt, .github/workflows/sql-beds.yml). A bed sources this
# from the repo root and calls one of the two pulls below before its `docker run`.
#
# 2026-10-09: the beds start at once and each pulls its image anonymously, so the registries refuse a
# burst ("toomanyrequests": Docker Hub's pull limit on postgres:15, ECR Public's rate on the Supabase
# image), and a refused pull failed the required check. Each image is pinned by digest, the same
# digest on every registry below (checked 2026-10-09), and comes from the first source that answers,
# a mirror first. A round with every source refused waits and tries them all again. The image is
# tagged with the name the bed runs, so its `docker run` finds it locally and never pulls.

PGTEST_PG15_DIGEST="sha256:c961aa287d8698297cb26cdfadfbe9fd2cbaf77e53cfffe9636e8d8a1e4d842c"
PGTEST_SUPABASE_TAG="public.ecr.aws/supabase/postgres:17.6.1.071"
PGTEST_SUPABASE_DIGEST="sha256:4255b662ba3d774105cb34f623e410a3d7a860b68408ac6810f7e7e4b9781d5a"

# pgtest_pull NAME SOURCE... — NAME ready locally from the first SOURCE that pulls; five rounds, a wait between.
pgtest_pull() {
  local name="$1" round src out
  shift
  if docker image inspect "$name" >/dev/null 2>&1; then
    echo "pulled $name: already here"
    return 0
  fi
  for round in 1 2 3 4 5; do
    for src in "$@"; do
      if out=$(docker pull -q "$src" 2>&1); then
        [ "$src" = "$name" ] || docker tag "$src" "$name"
        echo "pulled $name from $src"
        return 0
      fi
      echo "  round $round: $src refused: ${out##*$'\n'}"
    done
    [ "$round" = 5 ] || sleep $((round * 15 + RANDOM % 10))
  done
  echo "could not pull $name from: $*" >&2
  return 1
}

# postgres:15 (the AR beds): Google's Docker Hub mirror, ECR Public's copy of it, then Docker Hub.
pgtest_pull_postgres15() {
  pgtest_pull postgres:15 \
    "mirror.gcr.io/library/postgres@$PGTEST_PG15_DIGEST" \
    "public.ecr.aws/docker/library/postgres@$PGTEST_PG15_DIGEST" \
    "postgres@$PGTEST_PG15_DIGEST"
}

# pgtest_pull_supabase IMAGE — the bed's Supabase image: ECR Public then Docker Hub, by digest, for the
# default tag (mirror.gcr.io does not carry it); a PGTEST_SUPABASE_IMAGE override is pulled as given.
pgtest_pull_supabase() {
  if [ "$1" = "$PGTEST_SUPABASE_TAG" ]; then
    pgtest_pull "$1" "public.ecr.aws/supabase/postgres@$PGTEST_SUPABASE_DIGEST" "supabase/postgres@$PGTEST_SUPABASE_DIGEST"
  else
    pgtest_pull "$1" "$1"
  fi
}
