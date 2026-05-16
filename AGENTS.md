<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Playwright Verification Rule

For every Next.js development task, add or update detailed Playwright E2E tests under `tests/e2e/**` and run `pnpm test:e2e` before treating the task as complete. If a task truly has no browser-observable behavior, record the reason in the completion notes and still run the existing Playwright suite unless it is technically blocked.

## Git Completion Rule

At the end of every completed development task, stage the relevant changes, create a commit, and push it to the repository default branch before reporting completion. The current default branch is `master`; if the repository is renamed to use `main`, push `main` instead. Do not open a pull request unless the user explicitly asks for one. If commit or push is blocked, report the exact blocker and leave the worktree state clear.
