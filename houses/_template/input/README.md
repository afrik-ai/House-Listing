# House intake folder

Copy `houses/_template/` to `houses/<new-id>/`, then put the client material here:

| Folder | What goes in | Notes |
|---|---|---|
| `plans/` | Floor plans, one image or PDF per level, plus the site/plot plan | Dimensioned plans are best. Name files `ground.png`, `first.png`, `site.png`, ... |
| `photos/exterior/` | Photos or renders of the house from outside | Name by side: `street-east.jpg`, `garden-west.jpg`, `aerial.jpg` |
| `photos/environment/` | Surroundings: garden, street, neighbours, sky, climate, vegetation | Sets the landscape, horizon and sky |
| `photos/interior/` | Interior photos or mood images, if any | Sets finishes and furniture style |
| `brief.md` | Anything the client said: must-haves, style words, budget, what to leave out | Free text |

Keep images under about 4 MB each (resize larger ones). These files are committed to git, because they are the
client's own material and the critics compare the game against them.

Then follow `docs/NEW_HOUSE.md` from step 1 ("Intake").
