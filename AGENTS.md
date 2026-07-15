# Agents

Project-level agent configuration for the Monette repository.

## Scope
This repo is the working copy for the Monette farmland atlas (https://github.com/Bushels/monette).
All agents operating on this repo must limit file writes to C:/Users/kyle/Agriculture/Monette/.
Do NOT write to G:/My Drive/Agriculture/Monette/.

## Project-level agents
Agent definition files live under .claude/agents/. No dedicated project agent is
defined because the existing `.claude/skills/farmland-legal-descriptions/` skill
already owns DLS/PLSS parsing and Montana portfolio mapping. Extend that skill
instead of creating a second Montana agent.

For the next Montana session, read `PROJECT_STATE.md`, `README.md`, and the local
farmland skill before editing. Keep Premier's marketing acreage separate from
DNRC/DOR deeded-title geometry and prevent parent/child acreage double-counting.

## Model
Default agent model: claude-opus-4-7
