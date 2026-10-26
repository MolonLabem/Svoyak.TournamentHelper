# Static workbook analysis

Source: privately supplied `Табличка СИ DG.xlsm` (184762 bytes), credited in the task to Denis Galiakberov. Inspected as ZIP/OOXML using openpyxl and static decompression/extraction of `xl/vbaProject.bin` with oletools. **No VBA or embedded control was executed.** Source extraction is kept outside the repository. This document describes behavior and dependencies; it does not redistribute original VBA or explanatory prose.

## Inventory

All nine worksheets are `visible`; there are no hidden or very-hidden sheets. Some helper columns, rather than whole sheets, are hidden. There are no defined names, data-validation rules, merged ranges, or configured print areas. Two printer-setting binary parts are present. No userform or ActiveX part was found. There are three VML form-control buttons. The workbook contains dynamic-array/modern function references (`RANK.AVG`, `MINIFS`, `MAXIFS` and array INDEX/MATCH), an existing calculation chain and `xl/metadata.xml`.

| Sheet | Size | Formulas | Responsibility |
|---|---:|---:|---|
| Инструкция | 28 × 2 | 0 | Explains three rounds plus grand/small finals and organizer workflow. |
| Регистрация | 41 × 16 | 243 | Forty participant slots; count, partition into games, frozen random values/ranks and round-1 name lookup. Hidden H and O:P. |
| Сетка | 64 × 37 | 1028 | Current standings, three groups of ten possible 3/4-player games, and two manually populated four-seat finals. Hidden Q, X, AE (game labels) and AK (final position). 32 conditional-format ranges on raw-score cells, used for visual score comparison. |
| Служебные вкладки >> | 1 × 1 | 0 | Empty visual separator; no business data. |
| Сортировка | 41 × 15 | 600 | Per-player round points, registration perturbation, allocation flags, cumulative sums and final display ordering. |
| Бои_круг_2 | 5 × 3 | 6 | Formula-driven next group selection for round 2. |
| Распределение_круг_2 | 41 × 176 | 2280 | Pair-distance matrix and successive selected-group membership masks. |
| Бои_круг_3 | 5 × 3 | 6 | Formula-driven next group selection for round 3. |
| Распределение_круг_3 | 41 × 176 | 2280 | Cumulative-distance matrix and masks including two historical round penalties. |

The file is an empty tournament template: there is no participant dataset to migrate. Registration B2:B41 is the input. Names are lookup keys in the original and must be unique. Blank rows amid registrations can break the row-number-based random mapping and group assignment. The app replaces name keys with stable participant IDs and a separate registration seed.

## VBA and controls

Static extraction finds two standard modules, ThisWorkbook and five worksheet class modules. All workbook/worksheet class modules contain only attributes, with no event handlers or functions. There are no worksheet-change hooks, hidden setup procedures, custom scoring functions, forms, or outbound operations in the inspected VBA.

| Procedure | Button | Actual responsibility |
|---|---|---|
| Module1: Жеребьёвка | Круг 1 | Populates RAND formulas for nonempty registrations in H2:H41, copies calculated values over the formulas to freeze them, sets registration P1 to Да, returns to Сетка. Round-1 names are formula lookups from those ranks. |
| Module2: Круг2 | Круг 2 | Repeatedly copies the next-group formula output C2:C5 from Бои_круг_2, pastes values into T7:T10, T13:T16, …, T61:T64. Recalculation after each paste excludes already allocated players and selects the next group. |
| Module2: Круг3 | Круг 3 | Performs the same sequential value-copy operation for Бои_круг_3 into AA7:AA10, AA13:AA16, …, AA61:AA64. |

The macros are recorded selection/copy/paste workflows. The actual later-round algorithm lives in sheet formulas. The buttons do not validate round completion and may overwrite existing group names. Re-running round 1 can change names under existing scores. These are dangerous spreadsheet behaviors, explicitly blocked in the app.

## Partition and lifecycle

The workbook supports exactly three Swiss rounds followed by a grand final and small final. It has forty registration slots and ten game blocks per round. Registration E1 counts names. If N mod 4 is 0, 1, 2 or 3, E3 selects respectively 0, 3, 2 or 1 games of three. E2 is `(N − 3×E3)/4`. Games of four are placed before games of three. This partitions every N from 6 to 40 and also N=3,4. N=1,2,5 produces negative four-player game counts: a verified invalid partition, rejected by the app.

There is no bye allocation or bye scoring. Odd counts such as 7,9,11 are handled by three-player games. There is no defined withdrawal, disqualification, substitute, late registration, additional Swiss round, bracket playoff or automatic finalist-selection mechanism. Registration and group name cells can be edited in Excel, but this does not provide a consistent withdrawal rule.

## Scoring and standings

Raw scores are entered in Сетка N, U and AB. For each four-row game block, O/V/AC uses descending `RANK.AVG` over the score range, only if that individual score cell is not blank. P/W/AD is `4 − rank + rawScore/100`. Blank unused fourth seats are not ranked in three-player games. Thus a three-player winner receives the same baseline 3 points as a four-player winner. Zero and negative raw scores are valid numerical inputs.

Examples independently translated from these formulas:

- Scores [1200,800,800,−100] → places [1,2.5,2.5,4] → points [15,9.5,9.5,−1].
- Three scores [1000,1000,0] → places [1.5,1.5,3] → points [12.5,12.5,1].
- Four zero scores → each place 2.5 and 1.5 points.

Сортировка C/G/K uses name-based SUMIFS over each round’s computed points; L sums all three. There is no Buchholz, strength of schedule, head-to-head tie-breaker or win/loss count. Сетка G sums round totals. H displays a shared rank/range for equal cumulative points: e.g. `2–3`. App ties retain that shared Swiss rank.

**Incomplete games:** Excel can assign provisional ranks to just the nonblank scores, and SUMIFS then propagates these. A later entered score can change earlier players’ computed places. The app instead commits each game atomically only after all scores are valid. Provisional input never affects standings or the next draw. This is an intentional correctness safeguard.

Persisted raw scores use integer hundredths. At the default divisor 100, points use integer ten-thousandths. Average ranks for groups of 3/4 are exact halves. Pairing distances use integer millionths: `pointsUnits × 100 − registrationSeed`. Inputs have at most two decimal places, bounded to ±999999.99. This is a documented finite precision improvement over unconstrained Excel floating-point cells.

## Exact later-round group assignment

Let `A_i = cumulativePoints_i − registrationNumber_i/1000000`. For round 2, cumulative points are round 1 only (Сортировка D). For round 3 they include rounds 1+2 (H). A candidate pair distance is:

`abs(A_i − A_j) + 1000×sameGameInRound1 + 2000×sameGameInRound2`.

The round-2 matrix omits the last term. The source cells are Распределение_круг_2 B2:AO41 and Распределение_круг_3 B2:AO41. Same-player matrix cells contain a nonnumeric marker. Group masks AQ:CD, CJ:DW and EC:FP track the first 1, 2 and 3 selections. CH, EA and FT sum the candidate’s distances to selected group members. Allocation flags exclude already selected or previously allocated players; million-point helper sentinels exist as additional protection. The independent app uses explicit exclusion sets, preserving valid-input behavior.

For each game, in order:

1. Select the strongest available leader (minimum rank from Сортировка E/I).
2. For every remaining player, sum distances to all players already selected for this game.
3. Select the candidate with the smallest sum. On exact equality, source MATCH returns the first registration row, so the app uses the smallest registration seed.
4. Repeat until the game has its required 3/4 players; remove them from the available pool and continue.

The workbook’s short prose suggests selecting strongest players without prior encounters. The actual formulas are more specific: **sum of distances with finite weighted penalties**. The implementation follows the formulas. It is neither a hard no-repeat algorithm nor a global optimizer. Later greedy choices and the final residual game can contain repeat meetings. Very large raw scores can outweigh penalties; the app preserves this mathematical behavior and flags repeats in the UI.

First-round RAND values are frozen by VBA. The app uses a uniform Fisher–Yates draw with a stored 32-bit seed. It is random for new draws and reproducible for the same seed; it does not attempt to reproduce Excel’s unspecified RAND sequence. Subsequent rounds are deterministic.

## Finals and final ordering

Сетка AH7:AH10 and AH13:AH16 are manually entered participant names; AI raw scores and AJ places are manual inputs. Neither finalist qualification nor final places are calculated from raw scores. AK copies grand-final AJ and adds 4 for small-final AJ.

Сортировка M looks up final position. N sorts by:

`SwissTotal − registrationNumber/1000000 + (9 − finalPosition)×1000`,

with no final bonus when final position is absent. The app reproduces this numeric priority key and retains Swiss totals/ranks separately. The final place is shown in its own column. Equal final places are allowed, as in manual source cells; the Swiss score and registration seed still affect their display order. The finite final bonus is not replaced by an unconditional finals-first comparator, so extreme scores can outweigh it. App final places are validated as integers 1–4 within each final; the source cells themselves are unconstrained.

## Corrections, reports and export mapping

| Excel workflow | Web equivalent / decision |
|---|---|
| Yellow registration cells | Individual or bulk unique-name entry, one-column text/CSV import, name search and pre-start removal. |
| Round 1 button | Explicit confirmed draw and stored randomness seed. Later roster amendments are explicit user-requested extensions, described below. |
| Round 2/3 buttons | Atomic deterministic draw only after all preceding scores are recorded. |
| Raw score cells | Inline per-game keyboard entry, validation, confirmation to replace a recorded result. |
| Formula places/points | Independent exact-arithmetic domain functions with no editable derived fields. |
| Current standings | Shared Swiss ranks, per-round points, cumulative score and manual final place; display sorting. |
| Manual editing group names | Explicit pairwise swap in any round; resets affected game scores and dependent rounds/finals after showing impact. Unaffected same-round scores remain. |
| Editing old score with later groups already present | Correction dialog shows dependent rounds/finals, then atomically discards them with the confirmed score correction. Audit snapshots retain discarded data. No silent re-pairing. |
| Manual finalist cells | Manual participant selection and manual final places/scores. |
| Workbook save/resume | Hosted D1 with atomic revision checks, local SQLite development adapter, archive/reopen workflows and validated JSON backup/restore as a separate tournament. |
| General Excel printing | Print styles for games or standings, CSV export and JSON backup. No source-specific report/export macro or configured print area exists to replicate. |

## Ambiguities and limits

- The original workbook is a template, so cached outputs cannot validate nonempty scenarios. Fixtures are independently calculated translations of identified formulas using rational arithmetic, not a claim that Excel was executed.
- Source formulas assume contiguous unique registrations and completed earlier rounds. Names are fragile primary keys; the app uses IDs and rejects duplicates case-insensitively and after whitespace/Unicode normalization.
- N=1,2,5 invalid partitions, incomplete progression and overwrites are blocked. There is no automatic bye or compensation rule; the user-requested withdrawal extension is explicit below.
- Original RAND duplicate ranks are theoretically possible; the app’s permutation guarantees one occurrence per player.
- Empty/invalid final values in Excel can produce ambiguous ordering. The app accepts selected existing IDs and validated manually assigned places only.
- The original contains no archive, audit log, backup or optimistic concurrency system; these are persistence/integrity additions within the requested workflow.
- The .NET preference is superseded by the Sites Worker runtime constraint. No generic Swiss library is substituted.
- The Sites helper executables and Vinext starter source are absent from this workspace. A small dependency-free Worker and ordinary authenticated Git are used, with D1 migration declarations. This is an environment accommodation, not a claim of Vinext usage.

## Copyright

The source was provided for behavioral analysis; no redistribution permission for its contents or VBA was established. Neither the workbook nor extracted macros are committed, served, or included in the deployment archive. Attribution is preserved. The independent code’s Required Notice uses the supplied repository owner handle `MolonLabem`; legal identity and chain of title remain unverified. The official PolyForm license text is included unmodified, with notices outside it.

## User-approved organizer extensions (2026-10-26)

Denis feedback explicitly authorized editing players, groups and scores after start and any custom divisor. The default divisor remains 100; positive integer settings 1–10000 scale only the raw-score term, preserving average place points. Arbitrary-divisor comparisons and pairing use a common integer numerator: per-game `(4-place)*d*200 + rawHundredths*2`, seed-adjusted pairing key `sumNumerators*5000 - seed*d`, and weighted repeat penalties multiplied by d. This is the same distance scaled by a common factor, avoiding rounding-induced ties. Display points may be fractional ten-thousandths; they are never fed back into comparison keys. Sheet Data exports remain raw scores.

Each round stores its own roster. Late additions/withdrawals/returns can affect only future draws or regenerate only current unplayed games, using the existing pairing algorithm on the remaining pool. Completed games are immutable in this roster operation; withdrawn players retain historical points and IDs. Missed games have no score/compensation. Invalid residual sizes are rejected atomically. At most 40 players per round and 120 identities overall are accepted. Finals must first be cancelled and finished/archived tournaments reopened for roster edits.

Saved-game swaps explicitly clear only affected games. Historical score/group corrections atomically remove dependent rounds/finals, keeping other scores in the edited round. Changing divisor when later rounds exist requires confirmation and retains first-round raw scores only. Prior snapshots are owner-only audit data. These are application extensions, not behavior inferred from Excel.

## Requested redraw for all preliminary rounds

An explicit confirmed reroll randomizes the existing first-round roster, retains each game size/ID and guarantees a changed opponent partition for multiple games (not only reordered seats or swapped game labels). A single game changes seat order only. It clears every first-round score and discards dependent rounds/finals atomically, retaining prior snapshots in the owner-only audit. Future-only roster additions/withdrawals do not silently change the historical round cohort. For rounds two/three, redraw reuses the exact same allocation function as the ordinary Swiss draw with only earlier results/encounters and the selected round roster/sizes. Current/later scores cannot influence it. Identical opponent partitions are a no-op preserving scores, following rounds/finals, history and revision. A changed partition (e.g. undoing a manual group change) explicitly resets that round and downstream data while preserving earlier rounds. No random relaxation, new tie-breaker or Swiss-rule change is introduced.

## Requested flexible finals (2026-10-26)

The four-seat final cap is explicitly removed at the user's request. A newly formed final has1–40 players, at most40 unique active participants across grand/optional small final. Manual places range1…its player count, with equal manual places still allowed. Each new game stores positionOffset equal to the cumulative sizes of preceding finals. Legacy finals without this field retain the original offset i×4 and place range1…4, including prior short finals and backups; there is no automatic renumbering of saved events.

For new finals, final priority uses base=max(9, all final offsets+sizes+1), preserving the exact original9-based key for standard4+4 and giving positive priority bonuses through position40. The finite numeric priority behavior and unchanged Swiss totals remain. Group final offsets/limits are included in the safe spectator projection; owner metadata remains private. Backup validation rejects inconsistent offsets or oversized unmarked legacy finals.

The source Google Sheet has exactly four player slots in each six-row Data block. Played finals above four seats are explicitly omitted from that fixed export, with an explanatory UI notice. A separate full all-games CSV retains every finalist/raw score/manual place and can be imported into an ordinary separate Sheet. It does not change the existing rating formulas or silently split/truncate large finals.

## Requested automatic final places

A later user instruction replaces manual final-place entry with score-derived places. Finals use descending RANK.AVG semantics from raw scores, matching preliminary tie handling:1000/700/700/0 gives1/2.5/2.5/4; all zero ties average all occupied positions. Full valid scores are required; previews are unsaved and never contribute to standings. finalResults no longer requires/trusts client places; the server derives and audits the places and marks the game placesMode=auto.

Existing manual final data is not recalculated on load, publication or backup restore. An explicit confirmed score correction converts only that game to automatic places, recording its former scores, places and mode. Legacy position offsets remain. Auto-mode backups must exactly match score-derived ranks; legacy unmarked manual integer places retain previous validation. Final position priority accepts exact half ranks, and Swiss totals are unaffected. CSV and public results use the saved derived places. This is an explicit deviation from the original workbook's manually entered final places, authorized by the user's request.

## Requested pending-group control and forced skips

The user explicitly requested splitting five waiting players after a late arrival and marking forced missed games. Standard groupSizes and default Swiss fixtures retain the original3/4 rule; explicit custom sizes2–40 may be chosen for a draw or current pending regroup, with exact cohort-sum validation. The original scoring baseline4-place is retained at every custom size. One-player byes are not generated. Completed games are preserved exactly; pending groups use the same random-first/Swiss-later allocator with the chosen sizes. Backup validation requires customGroups for nonstandard games.

A per-round missed ID list is disjoint from actual games and represents forced absence without a raw score, place, points or encounter penalty. It does not withdraw a participant from later rounds. Round roster coverage is exactly games plus misses. All-missed rounds can progress with no fake games/points. Marking a player with an existing played score is blocked. Only the current round is amended; rollback removes its statuses with the rest of that round. Compensation is not automatic.

Public result projection includes attendance status but no private history; full CSV adds a Status column and blank-score forced-skip rows. Data rating export contains only real played games up to four seats, with larger games explicitly excluded and fully retained in CSV. Drafts are bound to player-ID order and discarded when a concurrent regroup changes their lineup, including interrupted reload.
