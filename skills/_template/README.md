# Skill template

Copy this folder to `skills/<kebab-name>/` and fill in `SKILL.md`. The folder name must equal the `name` in the frontmatter.

Distilled from the teardown in `research/real-estate-ai-teardown/` (skill-maker authoring rules, cre-agent-skills Status/Confidence template, agency-os handoff card, realtor-claude-skills output contract, Prosperity compliance overlay). See `04-media-voice-skill-authoring.md` §4.3 and `01-agent-skill-packs.md` §5 for the reasoning.

## Companion files per skill
- `README.md`: purpose, 3 usage examples, inputs, outputs. Ten lines.
- `contract.json`: `reads`, `writes`, `sends_externally`, `costs`.
- `examples/before-after.md` and `examples/failure-modes.md` for any skill that writes client-facing copy.
- Optional `checklists/`, `templates/`, `scripts/validate.sh`.

## Before a skill is "done"
1. Structural check: folder name equals frontmatter name, description present, no `~/` paths, sentinel present when `client_facing: true`.
2. Run one real task with and without the skill. Record the observed difference in the team catalog.
3. Manager spot-checks one client-facing output for Fair Housing language.

A skill is not done because it was written. It is done when it was validated and observed to help.
