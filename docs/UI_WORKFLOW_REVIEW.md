# Organizer workflow and usability correction

Scope: no accounts, retained browser ownership plus a separately saved private management link, public read-only results, and export for the existing rating spreadsheet. No invitations, public directory, live Google sync or extra rating engine.

| Observed friction | Implemented correction |
|---|---|
| Sidebar, mobile navigation, stage strip, progress/help and banners pushed the first game below the screen | One three-item navigation row: Игроки, Бои, Результаты. Rounds/finals sit inside Бои. The first mobile game begins around 378px down instead of roughly 780px. |
| «Турниры этого браузера» and demo entry confused organizers | Neutral create/continue list, archive collapsed, no demo in the normal UI. |
| Very dark forest-green surfaces and tiny low-contrast labels | Lighter neutral slate surfaces, readable white text, green reserved for actions/status, stronger input boundaries and focus/error/disabled states. |
| Every action visible at once | The two link controls sit together near the title, and swapping appears beside eligible games. Corrections, imports, history and settings remain under «Ещё». Saved games hide their save footer until edited. |
| Repeated manual name entry | Searchable names-only directory of 58 canonical Rating names, multiselect, duplicate prevention and manual newcomers. Suggestions are closed initially and bounded while searching. |
| Blank date caused extra work | New tournament defaults to browser-local today; explicit edits are preserved. Tested on both sides of the UTC date boundary. |
| Standings alone cannot feed the existing rating workbook | One «Скопировать для рейтинга» action exports played games as six-row A:D blocks, preserving names and original scores. Separate readable standings CSV. |

Desktop/mobile dark screenshots were visually inspected. Measured dark contrast ratios: title 14.51:1, secondary text 9.52:1, player/input text 12.30:1, numeric cells 8.07:1, saved status 7.40:1. Both light/dark tables and dialogs also pass 4.5:1 checks. No page overflow at 390px. Tests exercise Cancel/Back, repeated submit, interrupted/reloaded scores, finals, rollback, backup/restore and ownership recovery.

Pairing/scoring rules and production migrations remain unchanged. Public results now include the tournament date needed by the export; venue, history, seeds, revisions, backups and capabilities remain private. Server authorization does not depend on visible controls. Management keys never enter public JSON, backups, logs, query strings or screenshots.

## Buzzer mark and group preview

The user-provided buzzer reference was visually inspected. `public/logo.svg` is a flat, text-free green-and-white mark with a large circular front face, a short angled white base and a cable, matching the example's silhouette. Its transparent background and outlined white base work in both themes. The same SVG serves the header and favicon; the original reference is unchanged.

The registration heading shows the exact number of games of each size directly beside the first-draw action. It calls the same `groupSizes` function as pairing. Invalid counts disable the action and explain what to fix. The remaining short confirmation only protects lineup locking.

## Open native controls correction

The native theme popup defect was reproduced visually: a dark select inherited light popup backgrounds while its option text remained near-white. Explicit option/optgroup foreground/background and disabled/selected tokens now cover every native select; resolved root color-scheme also applies to selects/date inputs. Actual open popup screenshots cover desktop/mobile, light/dark/system, changes while open, date picker, game filter, rollback, final assignment with disabled choices, final places and player swap. The browser's native highlight remains platform-controlled and readable. No custom control stack was added.

The two link controls are visible together at the tournament heading, with exact labels «Ссылка для организатора» and «Ссылка для просмотра». The organizer button is never rendered for viewers. «Поменять игроков в боях» is visible beside eligible current games, remains available after scoring, with explicit reset impact; finished/archived states require reopening. Their overflow-menu duplicates were removed. Escape dismisses action menus and restores summary focus.

## Denis organizer feedback

The initial draw no longer claims the roster is permanently locked. Player amendments stay on the player screen with a small current/future scope dialog and exact pending-group validation. Game swap and historical score correction dialogs show the scores/rounds they reset; Cancel leaves saved data untouched. A custom integer raw-score divisor lives in creation/settings, with default 100 and an explicit dependent-round reset when changed later. Export uses a collapsed six-row A:D preview plus a fictitious TSV download, leaving the main screen uncluttered.
