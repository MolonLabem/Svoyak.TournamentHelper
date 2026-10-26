# Verification record

## Current implementation

- Workbook defaults preserved: three Swiss rounds, 3/4-player groups, average ranks on ties, exact comparisons, weighted 1000/2000 repeat penalties and manual finals. User-approved late roster/correction and custom-divisor extensions are documented below.
- Account-free ownership: browser session plus per-tournament private management key; only hashes in D1. Public result links never grant edits. Recovery is explicit, fragment-based and cleans its URL. Owner cookies are Secure/HttpOnly/SameSite=Strict in production.
- No public tournament directory, audit/private notes, seeds, internal revision fields, full backups or management secrets in spectator responses. Backups, restore, rollback and key replacement require the matching tournament session.
- Existing rows are preserved without automatic ownership assignment. Only three archived synthetic QA records existed when the live database was inspected; these remain hidden and unclaimable.
- Light/dark/system UI, focus/validation states, stable routes, tab-local draft recovery, keyboard entry, live tie preview, concise core navigation and Sheets-friendly CSV/TSV export.

## Automated and local browser checks

Previous release baseline: 31 passing tests covering source formula fixtures (12/16/24 players), every supported participant partition, tied/negative/decimal scores, deterministic later rounds, incomplete progression, corrections/rollback/finals, SQLite restart recovery and revision conflicts. Security tests cover hashed storage, production cookie flags, distinct owners, anonymous denials, private backup/restore, CSRF, session fixation, forged identity/owner fields, recovery binding, replacement/revocation, legacy non-claiming and the emitted Worker artifact.

The 15-scenario real Chromium workflow regression passes: theme persistence/system changes, modal focus, repeated submit, duplicate registration, tie preview versus saved data, Cancel/Back, interrupted-reload drafts, missing-game focus, downstream rollback, read-only refresh, failed-save retry, final capacity/keyboard entry, both-theme text contrast, CSV/JSON recovery, archive separation and mobile overflow. No uncaught browser errors.

Eight dedicated browser ownership scenarios passed with zero uncaught errors, exercising separate public/private links, HttpOnly cookies, anonymous viewers, owner of another tournament, cookie loss, explicit recovery/URL cleanup, another browser, owner-only backups, replacement of a management key, CSV/TSV safety and mobile spectator layout. No private link, key or cookie value is printed, saved to source or captured in screenshots.

## Current usability and spreadsheet correction

The 15 workflow scenarios pass after simplifying the UI. Seven additional real-Chromium scenarios pass: browser-local date across Los Angeles/Auckland UTC boundaries, canonical directory search/multiselect/manual newcomers, no automatic roster dump/duplicate selection, measured contrast, reduced mobile layout, actual Data A:D clipboard content, spectator export with rejected writes, and reload persistence. The standalone nine-player, three-round/finals/CSV/JSON/reload smoke also passes. No browser errors.

Five new export fixtures verify exactly 6 rows × 4 columns per played game, three/four players, ties, genuine zero/negative/decimal values, blank unused slots, repeated round labels followed by ГФ/МФ, omitted incomplete scores, exact roster names, date validation and formula-injection protection without turning numeric negatives into text. Only names from Rating!A3:A60 are copied; no private metadata/history or rating formulas.

Dark-mode screenshots were visually inspected at desktop and 390px mobile widths. Measured text contrast ranges 7.40:1–14.51:1. The first mobile game starts around 378px, with no horizontal page overflow or simultaneous sidebar/stage/banner panels. The coordinator visually inspected the Library reference and directed a new native SVG green-and-white quiz buzzer. The implementing executor did not view the original pixels; the new SVG and its header/favicon rendering were inspected locally in both themes.

## Verified public deployment

The same Site is live at https://svoyak.fittoast513.chatgpt.site. Native Sites access metadata returned `access_mode: public` after the protected Worker and ownership migration were deployed. No Site service/bypass credential was used for these tests.

Nine real hosted Chromium checks passed, with zero uncaught browser errors:

1. No-account tournament creation and production Secure/HttpOnly/SameSite=Strict cookie delivery.
2. Score saving and owner reload from the hosted D1 database.
3. Anonymous shared-link results, average-rank ties and CSV export; direct writes, private backup and administrative-document reads were denied.
4. A browser owning another tournament still could not edit or back up the shared tournament.
5. A management-link preview did not exchange its capability; explicit recovery worked in another browser and cleaned its fragment.
6. Clearing cookies removed editing rights; the saved private link restored them.
7. Owner-only backup/restore, forged-owner rejection and cross-origin request rejection.
8. Replacing the app management key invalidated the old key and other sessions for that tournament, preserving access to unrelated tournaments.
9. The deployed dark mobile spectator layout had no page overflow or JavaScript errors.

The three new synthetic QA records were archived and then returned 404 to anonymous viewers. No real records were changed. The three pre-ownership archived QA records were preserved, kept unowned and stayed private. Native database inspection confirmed the new ownership-session table and nullable hash column. That release retained the original scoring/pairing file; the later organizer extensions below now extend it while preserving default workbook fixtures.

Private management links, keys and cookie values were neither printed nor included in screenshots, source, reports or backups. Source publication used the separately approved short-lived repository credential; the Sites bypass token was not rotated again.

## Limits

Excel/VBA was inspected statically, never executed. Reference outputs are exact-arithmetic translations of identified formulas. The original first-round random generator differs; score precision is two decimal places; incomplete games and unsafe progression are deliberately blocked. There are no automatic byes or compensation points; explicit late roster amendments are a requested extension. Original workbook/VBA redistribution rights and the repository owner's legal identity remain unverified; originals are excluded, and PolyForm/attribution notices are retained.

Without both the browser cookie and its private management link, editing access cannot be automatically recovered. Restoring a JSON backup requires ownership of its existing source record; backups do not carry management credentials.

## Group-size preview and buzzer mark

Setup now previews exact game counts/sizes beside the start action using the existing `groupSizes` domain function; invalid counts disable it and explain the required adjustment. The short confirmation starts the draw; it now explains the lineup can be corrected later. Browser checks cover 0/1/2/5 invalid counts; 3/4/6/7/9/14/37/40 valid counts; preview equals the generated first-round groups; roster removal refreshes the preview, and pending uncommitted selections disable start. A new transparent, text-free SVG buzzer is used in the header and favicon and was rendered at small mobile sizes in both themes. The user-approved Sites slug change completed once, from svoyak-tournament-dg to svoyak, preserving the exact Site ID, public access and database. Owner cookies are hostname-bound; saved management keys are tournament-bound and can restore ownership on the new hostname.

## Native popup and visible-action correction

The reported white-popup/near-white-text defect was reproduced in an actually opened native appearance menu. Explicit option/optgroup foreground and background colors now cover every select, with checked/disabled tokens and resolved color-scheme. Seven new Chromium scenarios open actual popups for appearance, game filtering, rollback, final assignments (including disabled capacity choices), final places, swapping and date selection, in light/dark/system on desktop/mobile; theme changes while open and Escape/focus behavior pass. Native calendar and selection highlights can retain operating-system styling; rendered screenshots were inspected for readable text. The disabled light-theme foreground was darkened to pass 4.5:1 in option-style checks.

The logo follows the user's buzzer example: a large circular green front face, short angled white base and cable, with no lettering or background. The shared header/favicon SVG was visually checked at 24/32/64/160px in both themes and in the mobile header. Both exact link labels are visible near the title; swapping is visible beside eligible games. Their menu duplicates are removed. Owner-only organizer-link visibility, no viewer controls, keyboard opening/Cancel and both clipboard link flows were tested without logging secrets. Workbook/domain, database, Site ID and public audience are unchanged.

## Permanent organizer deletion

Owner-only red × controls on dashboard cards and in settings open a short generic confirmation, without a name field, with Cancel focused. POST /api/tournaments/:id/delete requires the matching owner session, same-origin JSON, explicit confirmation and a current revision. Conditional session cleanup and tournament removal run in one D1 transaction; no schema migration is needed. All device grants and the management key disappear with the record. Other tournaments remain untouched. Archived/completed tournaments can also be deleted. Deletion is permanent and prevents restoration from a backup of that source, which the dialog states explicitly.

35 automated tests pass, including four deletion cases: denied unauthorized/forged/stale requests, complete archived-tournament removal across devices, a concurrent edit preserving every binding, and rollback after a transaction failure. Ten local browser scenarios pass: owner-only visibility, dashboard controls without opening a tournament, settings confirmation without name entry and Cancel/Escape focus, stale confirmation, failed request and repeated-submit retry, list/reload cleanup, invalidated links with unrelated access preserved, Back/reload without resurrection, stale dashboard refresh without an active tournament, and keyboard deletion from an archived card. Mobile confirmation screenshots were visually inspected in both themes. Test fixtures are synthetic and removed after the run.

## Denis feedback implementation — 2026-10-26

48 automated tests pass, including 13 new custom-divisor/organizer cases. Default100 workbook fixtures for12/16/24 players still pass. Arbitrary-divisor tests cover1/200/300/333/9999/10000, exact cumulative ties, matching100/200 equivalent games, zeros, decimal negatives, dependent-round resets and raw-score export parity. Roster tests cover late current/future registration, withdrawal/return using stable IDs, preservation of played games, invalid residual group sizes, round-specific backup validation and server-side owner isolation.

39 local Chromium scenarios pass across the organizer-feedback(10), workflow regression(15), Sheets-flow(7) and open-control(7) suites, with no uncaught browser errors. The feedback journey creates a200-divisor tournament, edits the roster after partial play, corrects historical scores, swaps scored groups, saves333/reloads, cancels/confirms a later divisor reset, downloads the fictitious example and checks actual raw-score clipboard output, restores a copy, rejects viewer/other-owner mutations and recovers ownership in another browser. All3 synthetic records from that feedback run were permanently removed by their creator; no real record was touched.

Dark desktop export and mobile correction screens, plus light mobile export, were visually inspected. Mobile toolbar spacing was reduced to retain both swap and next-round actions without excessive space; the first game begins at469.69px for the tested organizer page. Measured text contrast remains7.40:1–14.51:1 and no horizontal page overflow occurs. Original raw score export does not depend on the selected divisor.

Hosted verification uses the same synthetic-only script with APP_URL and RUN_HOSTED_QA=1; deployment/live results are reported separately in the task after publication. No capability, cookie or Sites service credential is emitted by the suite.

## First-round reshuffle

53 automated tests pass. Five new reshuffle cases include720 seeded/count combinations (3/4/6/7/8/9/14/37/40 players ×80 seeds), verifying actual changed opponent partitions, every player exactly once, fixed game sizes/IDs, seed reproducibility and atomic confirmation. Other cases cover score/dependent-round/finals resets with audit snapshots, current-round versus future roster preservation, Swiss-round/finished/archive rejection, backup compatibility, server ownership/origin checks and revision conflicts.

Six local Chromium scenarios passed with zero browser errors: keyboard/focus/Cancel; one mutation for repeated submit; reload persistence; dirty-entry blocking; exact scored-round reset warning; dark/light desktop and320/390px mobile; score/standings cleanup; private backup retention; public/other-owner denials; stale-confirmation rejection and fresh retry. Both synthetic records from the successful run were deleted, and no real records were touched. Mobile confirmation and toolbar screenshots were visually inspected. Hosted verification runs the same synthetic-only script after deployment and is reported in the task.

## Swiss redraw in rounds two and three

The user clarified that every round should support redraw while applying Swiss rules.58 automated tests pass, including all original workbook fixtures. Five additional cases verify exact ordinary-draw parity for round2/3, independence from current-round scores/random seed, preserved earlier rounds and per-round roster boundaries, retained noncanonical valid3/4 group sizes, unchanged-group no-op preservation (scores/dependencies/finals/history/revision), backup compatibility, and owner-only direct API calls.

The expanded8-scenario local Chromium suite passes without browser errors. It confirms later-round controls, no-op explanation without a destructive submit, Cancel before a changed Swiss redraw, exact expected groups, earlier-score retention, downstream/finals reset, reload, viewer/other-owner rejection, stale revisions, and light/dark320/390px layout. The changed/no-op Swiss dialogs were visually inspected. Both synthetic records were removed; no real record was modified. The same suite is used for live verification after publication; the task reports the result.

## Flexible final sizes

The user explicitly requested more/fewer than four participants in finals.66 automated tests pass, including8 new cases for1/2/3/5/8/40-player finals, matching place limits, grand/small offsets for5+3 and3+5, manual ties/zero/negative scores, unchanged Swiss totals, invalid/duplicate participants, legacy short-final offsets and exact priority parity, strict backup restore validation, full CSV/formula protection, fixed Data exclusion without truncation, and owner-only persisted API behavior.

29 local Chromium scenarios pass: flexible-finals7, workflow regression15, and opened controls7. New UI checks cover five/three participants and Cancel, dynamic place choices/ranges, keyboard scoring, saved reload, dark/light1150/390/320px layouts and actual open place menus, all-player raw CSV, explicit Data exclusion and correct clipboard blocks, public readonly results/API denials, finish/backup/restore, and eleven-player draft fields after interrupted reload with a one-player small final. No browser errors. All4 synthetic records from the new finals run were deleted; no real records were modified. Dark mobile final cards and light mobile export warning were visually inspected.

Legacy finals retain their saved four-seat ranking semantics. New final positionOffset makes rank ranges follow actual group size, with a priority base at least9 and above the greatest possible final position. The original4+4 final fixture still passes. Three preliminary Swiss rounds and their3/4-player rules remain unchanged. Large finals are excluded from fixed Data A:D blocks with a visible notice; complete raw results remain in the new all-games CSV and JSON backup. Hosted verification uses the same7-scenario synthetic suite after publication and is reported in the task.

## Automatic final places

The user requested automatic final places instead of manual entry.73 automated tests pass, including7 new cases for descending average ranks across1/2/3/4/5/11/40 players, leading/middle/all-player ties, zero/negative scores, incomplete rejection, score-only server saves with forged places ignored, correct small-final offsets, invariant Swiss totals, atomic correction confirmation and prior-value audit, preservation/conversion of old manual results, strict fractional-place backup validation, CSV/Data export consistency, and owner-only direct API persistence/recovery.

31 local Chromium scenarios pass: automatic/flexible finals9, workflow regression15 and controls7, with no browser errors. The new flow confirms read-only live places (including2.5 ties), score-only keyboard entry, saved reload, full CSV, readonly public results, score correction Cancel/failed-save retry, finish/backup/restore, explicit conversion of a restored legacy manual fixture with original places retained in history, and eleven-player score drafts with automatically recovered ranks. Light/dark desktop and320/390px layouts remain usable; the dark mobile automatic-place screen was visually inspected. All5 new synthetic records were deleted; no real tournaments were modified.

Existing manual places are never recalculated merely by reading/restoring/deploying. An explicitly confirmed score edit calculates new average ranks and records former values. New-mode places must equal score-derived ranks on restore. Final numeric priority accepts exact half ranks; default preliminary workbook fixtures remain unchanged. This replaces the original workbook manual final-place input by explicit user request. The same9-scenario synthetic suite is used after publication for hosted verification, reported separately in the task.
