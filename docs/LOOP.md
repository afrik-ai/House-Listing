# The build / critic loop

How every piece of every house gets built and judged. The orchestrator (the main session) follows this page.
Builders and critics are sub-agents. Paste the prompt templates at the bottom, filling the `<...>` fields.

## One round
```
builder ──> npm run check (must PASS) ──> fresh critic ──> VERDICT.md ──┬─ WINNER: OURS  -> piece done
   ▲                                                                     └─ WINNER: HF2   -> builder again with
   └─────────────────────────────────── BIGGEST_GAP + NEXT_FIXES ───────────────────────────  BIGGEST_GAP + NEXT_FIXES
```
1. **Builder** works on one piece, owning a fixed set of files (docs/WAVE2.md style ownership).
2. **Gates.** The builder runs `npm run check -- --id <id>` and fixes every FAIL before reporting done.
   A builder report without a passing check is sent straight back.
3. **Critic.** A NEW agent every round, which never sees the builder's notes. It follows
   reviews/CRITIC_PROTOCOL.md: check, play test, blind pairs against HF2 and against the client's photos,
   then a verdict.
4. **Decision.** The orchestrator reads only the verdict's last three lines and relays BIGGEST_GAP and NEXT_FIXES
   to the builder, resuming it with SendMessage. Resuming keeps its context and costs less than a new builder.
   A new builder is better when the old one's context is huge or the piece changes hands.
5. **Record.** `node scripts/progress.mjs ...` updates the progress page, then commit (see "Commits").

There is no fixed number of rounds. A piece is done only when a fresh critic declares WINNER: OURS.

## Pieces for a new house
The engine pieces (P01 engine, P05 lighting, P08 player, P09 interactions, P10 HUD/menus, P11 audio, P12 performance)
are shared by all houses. A new house mostly needs:

| Piece | Critic judges against |
|---|---|
| F1 plan fidelity | the plan images: room layout, doors, dimensions (plan-view render vs plans) |
| F2 photo fidelity | the exterior and environment photos: massing, facade, landscape |
| P02 shell | HF2 architecture shots + walkability |
| P03 exterior finish | HF2 exteriors + the client photos |
| P04 landscape | HF2 exteriors + environment photos |
| P06 interior surfaces | HF2 interiors |
| P07 furniture | HF2 interiors (density, placement) + walkability |

F1 and F2 run first: polishing a house that doesn't match the client's plans wastes every later round.

## Between waves: integration pass
After each wave of pieces, one fresh agent plays the whole house end to end, like a player would. It enters, walks
every room, both floors, the terrace, balcony and garden, at day and night. It fixes seams between pieces: lighting
vs materials, furniture vs doors, landscape vs terrace heights. It reports what still feels off. Then run the check.

## Rules learned the hard way
- **Walkability is a gate, not a critic opinion.** A potted plant blocked the front door and the stair; a car
  blocked the boiler room. Both went unnoticed until a person played. The walk gate now catches both kinds.
- **Assets are not in git.** A fresh clone missed two generated textures, and the whole garden silently vanished.
  The boot gate fails on any 404. Anything generated must also be reproducible by a script listed in NEW_HOUSE.md.
- **Critics need the references on disk.** Without images, critics fell back to written descriptions and could
  not judge well. Keep the client's material in `houses/<id>/input/` (committed) and the HF2 pack in `reviews/hf2/`.
  The HF2 pack is not committed (third-party images): recreate it per reviews/HF2_REFERENCE.md.
- **Concurrency costs.** Seven agents at once used up a session's usage limit in about 30-40 minutes, five
  times. Run at most 3-4 agents at once, and use a cheaper model for asset or mechanical work. After a limit,
  resume each agent with SendMessage and a one-line "resume from <last step>" note. Files on disk are the memory.
- **One dev server, many agents.** Never start a second server. Harness scripts block Vite's HMR socket and put
  a hard timeout on every wait. Another project may hold port 5173: the tools auto-detect ports 5173-5176.
- **Own your files.** Each builder edits only the files it owns. Cross-piece requests go into docs/CONTRACTS.md
  ("Requests to P0x").

## Commits
- Commit after a check PASS plus a recorded critic verdict, and before stopping for a usage limit.
- Work on `main`, or on a branch cut from `main` that is merged back as soon as the session ends. A cloud session
  that works on its own branch must fast-forward `main` before anyone continues locally.
- Never commit `public/assets/`, `tools/`, review screenshots or `reviews/hf2/`.

## Prompt templates

### Builder
```
You are the builder for <piece id> "<piece name>" of house <id> in the HouseListing repo (<repo path>).
Read SPEC.md, docs/LOOP.md, docs/NEW_HOUSE.md, docs/CONTRACTS.md, houses/<id>/input/REFERENCE.md and the images in
houses/<id>/input/. Look at the relevant reviews/hf2/*.png.
You own: <files>. Do not edit anything else. Put requests for other pieces in docs/CONTRACTS.md.
Goal: <what the piece must achieve, in player terms>.
<Round N only> The last critic said: BIGGEST_GAP: <...> NEXT_FIXES: <...>. Fix these first.
Verify in the real game: open every screenshot you take with Read. Before reporting done, run
`npm run check -- --id <id>` and fix every FAIL. Put hard timeouts on Playwright waits.
Log milestones with node scripts/progress.mjs log "<piece>: ...". When done:
node scripts/progress.mjs set <piece> status=critic round=<N>. Report in under 300 words, with the check's result line.
```

### Critic
```
You are the critic for <piece id> "<piece name>", round <N>, house <id>, in the HouseListing repo (<repo path>).
You are a fresh critic: do not read builder notes or earlier verdicts. Follow reviews/CRITIC_PROTOCOL.md exactly.
Output folder: reviews/critic/<piece>-r<N>/.
Scope (judge only this): <scope>. Other pieces may be unfinished; do not fault them.
Client references: houses/<id>/input/ (images) and houses/<id>/input/REFERENCE.md.
Be harsh; a tie is a loss. End with the WINNER / BIGGEST_GAP / NEXT_FIXES lines.
```

### Integration pass
```
You are the integration agent for house <id> after wave <W>. Play the whole house end to end in the real game, like a
player: enter from the street, walk every room on every floor, the terrace, balcony and garden, at day, golden hour
and night. Use scripts/shot.mjs, window.__game.move and teleport. Fix the seams between pieces (lighting vs materials,
furniture vs doors and stairs, landscape vs terrace and entrance heights), keeping each change small. Where a fix
belongs to a piece's own design, write it in docs/CONTRACTS.md instead. Finish with `npm run check -- --id <id>` PASS
and a report listing what still feels off, worst first.
```

### Intake
```
You are the intake agent for new house <id> in the HouseListing repo (<repo path>). Follow docs/NEW_HOUSE.md step 1.
Read every file in houses/<id>/input/ with the Read tool. Write input/REFERENCE.md first (precise, concrete, with an
"Assumptions" list), then house.json, site.json, furniture.json and budget.json, starting from Villa Nova's files.
Then run node pipeline/build.mjs <id> --render and npm run check -- --id <id>, and iterate until the build validates,
the plan-view render matches the plans, and the check passes.
```
