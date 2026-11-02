#!/usr/bin/env bash
echo "attempt ${GITHUB_RUN_ATTEMPT:-1}"
[ "${GITHUB_RUN_ATTEMPT:-1}" -gt 1 ]
