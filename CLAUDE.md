# Claude

Rules for Claude Code sessions on the Monette repository.

## Working directory
Always operate from C:/Users/kyle/Agriculture/Monette/ (the git working copy).
Never write to G:/My Drive/Agriculture/Monette/ (raw data mirror, non-git).

## Key conventions
- Unix-style paths inside the repo (forward slashes).
- git mv for tracked file renames; shell mv for untracked.
- .claude/settings.local.json and .claude/launch.json are intentionally gitignored — do not commit them.
- docs/ is intentionally gitignored except for docs/journal/ — do not commit other docs/ content to this repo.
- End-of-session: run git status -s to confirm no untracked production files exist before finalizing.
- Read PROJECT_STATE.md at session start to see active task, blockers, and next action.

## Model
Default model: claude-opus-4-7

## Skills
- .claude/skills/farmland-legal-descriptions/ — DLS/PLSS prairie quarter-section parsing (Monette-specific, local only).
