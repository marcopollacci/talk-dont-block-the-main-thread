# AGENTS.md

Guidelines for AI agents working on a talk deck built with **Astro + p-slides**.
Generic on purpose: they apply to every talk created from this skeleton.

---

## 1. Project shape

- One talk = one page in `src/pages/<event-slug>.astro` (layout + ordered slide sections + metadata).
- Slide sections live in `src/slides/*.astro`, shared components in `src/components/`, images in `src/img/`.
- Styles: native CSS in `src/styles/` (no Sass), entry `index.css`, cascade layers `vendor, tokens, reset, deck, chrome, content, components`. Third-party CSS (p-slides) is imported into `vendor`. Component-only styles go in the component's scoped `<style>`.
- Scripts: a single module, `src/scripts/deck.js` (hash sync, chrome, autoplay, touch, extra Invoker Commands). Don't add loose scripts: extend that module.
- Slide text and speaker notes (`<PNotes>`) are written in **English**.
- Package manager: **pnpm**. `pnpm build` **and `pnpm lint`** must pass before you say you're done.
- **Lint and format (non-negotiable).** Every file you save goes through Prettier (`prettier-plugin-astro`): Claude Code does it automatically via the `PostToolUse` hook in `.claude/settings.json`; any other agent runs `pnpm exec prettier --write <file>` right after each edit. After a round of changes run `pnpm lint` (`astro check` + `prettier --check`) and fix every error and warning, never leave them for the user. A new bare attribute hook (§6) is also declared in `src/deck-attributes.d.ts`, otherwise `astro check` fails.
- Never commit unless explicitly asked.

### 1.1 Themes

- Pick the theme on the page: `<Layout theme="dark">`. Available: `light` (default), `dark`, `paper`, `neon`, `retro70`, `blueprint`, `terminal`, `win311`, `angularday` (this talk only: angularday.it's look), one file each in `src/styles/themes/`.
- **Only the chosen theme ships**: `Layout.astro` inlines that file alone in the build, and a theme's own font (`public/fonts/`) is downloaded only when that theme is on.
- **Dev picker**: the toolbar's ◐ button or **Alt+T** opens a menu with a live tile per theme. ↑/↓ try a theme on the current slide, Enter or click keeps it (per page, in sessionStorage), Esc goes back. It never reaches the build (JS tree-shaken, inline styles).
- **Event colours** go on the event's page, `src/pages/<event>.astro`: `<Layout theme="dark" accent={{ primary: "#e4007c", secondary: "#00a3e0" }}>`. `primary` drives `--brand-color` and the sub gradient start, `secondary` (defaults to `primary`) `--brand-color-ant` and the gradient end; `--on-brand` (text on brand fills) adapts by itself. In dev the console warns when an event colour lacks contrast on the theme you are trying: fix the colour, or pick it per theme with `tokens`.
- **Any other tweak**: `tokens={{ "--slide-pattern": "none" }}`, custom props on `<html>` that win over the theme and over `accent`.
- A theme is just custom props on `[data-theme="<name>"]` (any element: that's how the picker tiles preview it), unlayered on purpose.
  - **Palette**: `--surface`, `--ink`, `--text-color`, `--brand-color`, `--brand-color-ant`, `--alert-color`, `--info-color`, the `--gradient-*` pairs, `color-scheme`. The derived tokens in `tokens.css` (`--muted-color`, `--line-color`, `--soft-color`, `--on-brand`…) follow by themselves; a theme overrides one only to fix contrast.
  - **Shape and texture** (defaults = the light look; here `light` keeps this talk's blue → magenta gradient): `--font-body`, `--font-heading`, `--font-code`, `--font-caption` (title bars only: keep display/pixel fonts there, never on body text), `--backdrop` (outside the slides), `--slide-pattern`, `--slide-frame`, `--slide-titlebar` (+ `-size`, `-inset`, `-bg`, `-color`; `var(--talk-title)` prints the talk title), `--window-*` for `<CodeWindow>` (radius, border, shadow, title bar, `--window-controls` / `--window-controls-end` glyphs), `--pill-*` and `--control-radius` for the toolbar and nav.
- New theme: add `src/styles/themes/<name>.css`, then its name to `THEMES` in `Layout.astro` (the build fails if they disagree). Fonts go in `public/fonts/` as subset WOFF with their licence file next to them. Check the contrast of every token against `--surface` (§7).
- Code windows follow the theme's `color-scheme`: Shiki ships `one-light` and `one-dark-pro` as custom props, `light-dark()` picks one.
- **No hardcoded colours** in slides, components or styles: use the tokens. The exceptions are colours that sit on media (banner, meme captions), the dark speaker view and grid board, and fixed brand colours like the `js` badge.

---

## 2. MCP servers

### 2.1 p-slides docs - personal MCP ("MCP Mio", `pslide-mcp_*` tools)

The source of truth for p-slides markup. **Query the relevant tool before writing or changing slide markup** - never invent attributes or classes.

| Need                                                         | Tool                                                                       |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Page wiring, `canRender`, `metaData`, `Thanks`/`Cover` props | `pslide-mcp_talk-page`                                                     |
| Slide container and its attributes                           | `pslide-mcp_p-slide`, `pslide-mcp_entryslide`                              |
| Fragments, reveal order, timing                              | `pslide-mcp_p-fragment`                                                    |
| Entry/reveal animations                                      | `pslide-mcp_effects`                                                       |
| Layout helpers, text styles                                  | `pslide-mcp_layout-classes`, `pslide-mcp_text-styles`                      |
| Code blocks, images, graphics                                | `pslide-mcp_code-blocks`, `pslide-mcp_images`, `pslide-mcp_p-new-graphics` |
| Speaker notes                                                | `pslide-mcp_speaker-notes`, `pslide-mcp_p-note`                            |

If the MCP and the code disagree, trust the code in the repo and point out the mismatch.

### 2.2 Visual checks - `chrome-devtools` (project `.mcp.json`)

**Every visual change is checked in the browser through the chrome-devtools MCP.** No hand-made headless Chrome / CDP scripts, no "it builds, so it looks fine".

Workflow:

1. Reuse the dev server the user already has running (look for the listening port, usually `4321`). Start one only if none is running, as a tracked background task.
2. `resize_page` to **1600×900**, `navigate_page` to `http://localhost:<port>/<event-slug>/`.
3. Jump to a slide with `evaluate_script`:
   `document.querySelector('p-deck').currentIndex = N`
4. Reveal every fragment of that slide before shooting:
   `slide.querySelectorAll('p-fragment, [p-fragment]').forEach(f => f.setAttribute('aria-hidden', 'false'))`
5. `take_screenshot` and actually look at it. For text, also measure: height of headings/labels (one line?) and bounding boxes against the slide (any overflow?).
6. Keyboard pass on touched slides (§7): `press_key` arrows / Tab, check the focus ring and the order. After a round of changes, run `lighthouse_audit` (accessibility).
7. Hot reload resets the page: after an edit, wait, then navigate again.

---

## 3. Mood of the slides

Feedback that shaped these rules: _"a list of new things, it gets flat and repetitive in the long run - add some fun moments"_. The content can be cutting-edge. The **rhythm** must not be monotonous.

### 3.1 Break the rhythm

- Avoid running the same sequence (title → pain bullets → code → browser support) section after section without a twist.
- Merge repeated slides: several "About support" slides become **one table** at the end of the section.

### 3.2 Memes - one per section, on the pain point

- Put the meme **on the problem slide (or right after it)**, never on a neutral title slide. Pattern: pain → laugh → code as the payoff.
- **At most one per section**, otherwise it becomes noise.
- **Don't recycle the same templates across talks.** Prefer gags born from the talk's own subject (e.g. a deck that fakes a frozen page, a fake Task Manager) and recognizable but less worn templates (Gru's plan, Expanding brain…). The overused ones (This is fine, Drake, Two buttons, Distracted boyfriend) only if nothing better fits and no other talk uses them. The agent sources the image itself (e.g. imgflip templates → `src/img/memes/`), checks it, and never asks the user to go find images.
- **Captions are HTML/CSS overlaid on the image**, not baked into it: editable, themeable, accessible (`alt` on the image). Captions with code use a monospace font; break lines explicitly, never inside a token.
- Short captions, in English. Speaker note: "don't explain the meme, pause, move on".
- If the user dislikes a meme, remove it completely (slide, import, asset). Don't argue for it.

### 3.3 Recurring game - "Who wins?"

- A/B snippets side by side, show of hands, then a fragment reveals the winner (winner highlighted, loser dimmed, driven by `:has()` on the revealed fragment).
- Same title and layout every time, numbered rounds, so the audience learns the format. 2-3 rounds per talk, not more.
- Every round must be a **real trap built on what the audience just learned**, and technically correct (double-check against the spec/MDN). Speaker notes explain the trap and the answer.

### 3.4 Running gag (optional)

- A recurring character (e.g. the CSS mascot) shows up at checkpoints with a one-liner and a counter that grows, with a final payoff at the end.
- Never cover the slide title or the live demo. On closing slides, it shows up only on a manual click (`no-autoplay`), after the key line has landed.

### 3.5 Archived decks stay untouched

Slides shared with talks that already happened get a `playful` prop (default `true`). Pages of past events pass `playful={false}`, so their deck stays identical.

---

## 4. Code in the slides

- **Classless**: examples use real selectors - elements, attributes, ARIA, `data-*` (`nav > a[aria-current="page"]`, `[data-theme="dark"]`). **Never** `.class` or `#id` hooks. The only exception is a "before" slide that deliberately shows naming conventions/BEM as the anti-pattern.
- Modern CSS by default: `oklch()`, logical properties, `@layer`, `@scope`, container queries, `:has()`.
- Code blocks need inner padding: code never touches the edges of its window.
- Code blocks are always `<CodeWindow>` (`src/components/CodeWindow.astro`): Shiki highlights at build time (theme `one-light`, zero JS, any Shiki language). Write the code in the slot with `is:raw` so `{`, `}` and backticks need no escaping; indentation is stripped automatically. Line-level reveals use `fragments="3-5, 8"` (1-based line ranges, one fragment per range), never hand-made `<p-fragment>` inside the block. Code longer than the slide gets `lines={N}`: the window shows N lines and scrolls by itself to each revealed fragment (and back when stepping backwards). No raw `<pre><code>` and no client-side highlighter.

---

## 5. Layout rules (non-negotiable)

- **Titles, labels, questions and verdicts never wrap onto two lines.** Use `white-space: nowrap` and **shorten the text** until it fits. Don't shrink the font to unreadable sizes.
- Nothing overflows the slide at 1600×900.
- **Nothing is ever glued together**: emoji and text, text and `<code>`, `❌` and its label always have a space between them. `compressHTML` stays `false` in `astro.config.mjs` (compression drops the whitespace between inline elements written on separate lines); in the markup write the space explicitly (`❌ <span>`, `{" "}` at line ends next to an element).
- **Lists all look the same**: `<ul density="spaced" text="mid">`, one line per item (shorten the text, details go in the notes), no inline `line-height`/`row-gap`/`font-weight` overrides.
- In side-by-side layouts (A vs B), both sides line up (same rows, same heights), and separators like "VS" are centred on the content.
- Overlaid captions are centred on their target (button, panel, person) unless they're indented code.

---

## 6. Classless deck - attribute reference

The deck itself is classless too: **no `class=` in slides, components or layout.** Styling hooks are semantic elements, ARIA and bare attributes, in the same style as p-slides (`effect=`, `p-effect~=`, `autoplay`). No exceptions: even code highlighting (`<CodeWindow>`) outputs classless HTML. Inline `style` only sets custom properties or a one-off value.

A new hook goes into `src/styles/components.css` as an attribute, gets a row here and a line in `src/deck-attributes.d.ts`. The skeleton has few slides: "unused here" does not mean dead. Migrate a style, never drop it.

| Need                                    | Markup                                                                                                                                                                                                    |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two columns (`top` aligns to the top)   | `<p-slide layout="two-columns">`, `layout="two-columns top"`                                                                                                                                              |
| Auto-fit columns / explicit grid        | `layout="columns"`, `layout="grid" style="--rows: 2; --columns: 3"`                                                                                                                                       |
| Quote layout / centred text             | `layout="quote"`, `layout="center"`                                                                                                                                                                       |
| Flex alignment                          | `justify="start\|center\|end\|around"`, `align="center"`, `self="start\|center\|end"`                                                                                                                     |
| Cover slides                            | `<p-slide cover>`, `cover="internal"`, `cover="internal-sub"`, `cover="sub-section"`; speaker/date in `<footer>`                                                                                          |
| Gradient text (+ per-slide override)    | `gradient`, `gradient="sub"`, `gradient="cover"`; `style="--gradient-from: …; --gradient-to: …"`                                                                                                          |
| Heading with emoji outside the gradient | `<h2 with-emoji><span aria-hidden="true">🎤</span> <span>Title</span></h2>`                                                                                                                               |
| Tone / weight / case                    | `tone="muted\|invert"`, `weight="medium"`, `uppercase`, `<b>`/`<strong>`                                                                                                                                  |
| Text size and lists                     | `text="small\|mid"`, `ul density="long\|loose\|spaced"`, `list="compact"`, `ul links`, `spacing="more"`                                                                                                   |
| Centred card (heading + content)        | `<p-note card>`                                                                                                                                                                                           |
| Speaker card                            | `<Speaker heading="…" />` component                                                                                                                                                                       |
| Image size                              | `style="--size: 6em"` (height), `--width`; inline logo: `<img inline>`                                                                                                                                    |
| Slide header with brand accent          | `<header>` as a direct child of `<p-slide>`                                                                                                                                                               |
| Quote                                   | `<figure><blockquote>…</blockquote><figcaption><cite>…</cite></figcaption></figure>`                                                                                                                      |
| Code window / size / dense / fragments  | `<CodeWindow is:raw file="file.css" lang="css">…</CodeWindow>`, `size="small\|big\|full"` (`full`: one line as big as the text), `dense`, `fragments="3-5, 8"`, `lines={12}` (scrolls, follows fragments) |
| Support matrix                          | `<table support>`                                                                                                                                                                                         |
| Background media                        | `full-media`, `full-media="x\|y\|bleed"`                                                                                                                                                                  |
| Effects                                 | `shadow`, `sepia`, `banner`, `fade-borders="x\|y\|both"`, `mark js`, `file-badge`, `attention`, `sketch-circle`                                                                                           |
| Hand-drawn diagram                      | `hand-drawing` (column) or `hand-drawing="row"`; children `<span box>`, `<span arrow down>` (`left\|right\|up\|down\|up-down`)                                                                            |
| Animated marks                          | `big-x`, `sketchy-arrow` (Houdini worklet, loaded only when used), `blink`                                                                                                                                |
| Fragments                               | `p-fragment landing`, `invert`, `none`, sibling `group-fragment` (only the last revealed stays)                                                                                                           |
| Entrances                               | slide in: native `p-effect="from above\|below\|left\|right"` (`--from-x/--from-y` for short distances); scale: `enter="above\|below"`                                                                     |
| Theme / event colours / tokens          | `<Layout theme="dark" accent={{ primary: "…", secondary: "…" }} tokens={{ "--…": "…" }}>` → `<html data-theme>` (§1.1); dev-only picker: toolbar ◐ or Alt+T                                               |
| Speaker pace traffic light              | slot length per event: `<Layout talkMinutes={40}>` → `<p-deck talk-minutes="40">`; box under the speaker toolbar, driven by the ▶ timer                                                                   |
| Authoring placeholder                   | `todo`                                                                                                                                                                                                    |
| Autoplay                                | `<p-slide autoplay timing="1000" timing-fragment="100">`, per fragment `timing-start`, opt out `no-autoplay`                                                                                              |
| Debug outline                           | `<p-slide debug>`                                                                                                                                                                                         |
| Live demo key press                     | `<p-fragment iframe-key="2">`: revealing it presses that key inside the slide's `<iframe>`                                                                                                                |
| Scroll to revealed fragments (non-code) | `<p-slide follow-fragments>`                                                                                                                                                                              |
| Misc blocks                             | `unpadded` (no padding), `info` (narrow centred note with inline icons), `final-link` (closing link + big image)                                                                                          |
| "Who wins?" round                       | `<WhoWins round={1} question="…" winner="a\|b\|none" verdict="…">` with `slot="a"`/`slot="b"` code windows and `slot="notes"`; hooks `who-wins`, `duel`, `contender`, `vs`, `verdict`, `winner`           |
| Meme with HTML captions                 | `<Meme src alt size captionSize captionBg>` + children `<span caption style="--x: 50%; --y: 20%">` (centred on x/y of the image)                                                                          |
| Running-gag mascot                      | `<MainThread mood="🥶" line="…" frozen="3,000 ms" no-autoplay />` (fragment, bottom-right, `main-thread` + `bubble`)                                                                                      |
| Fake frozen page                        | `<p-fragment frozen-page>` (direct child of the slide): greys the slide out under a fake dialog; `dialog-buttons`                                                                                         |
| Fake task manager                       | `<table task-manager>` with `<caption>`, rows as `<tr p-fragment>`                                                                                                                                        |

---

## 7. Accessibility (non-negotiable)

Every slide of every talk is built with accessibility in mind, both visual and motor.

**Visual**

- Text contrast ≥ 4.5:1, ≥ 3:1 for large text and UI controls. Check gradient text at its lightest point.
- Colour is never the only carrier of meaning (A/B winner, `todo`, highlights): add text, an icon or a shape.
- Every image has a meaningful `alt`. Decorative ones get `alt=""` and decorative pseudo-content gets empty alt text (`content: "→" / ""`).
- Meme captions and labels are real text, never baked into images. Readable font sizes: shorten the text instead of shrinking it.
- Every control shows a visible `:focus-visible` outline.

**Motor / keyboard**

- The whole deck works from the keyboard alone: arrows, PageUp/PageDown, Home/End, Alt+M/S/G (Alt+T in dev), and Tab to every control in a logical order.
- Controls are real `<button>`/`<a>`, never a clickable `div`/`span`. Deck buttons use Invoker Commands (`commandfor="deck" command="--next"`).
- Touch targets are ≥ 44×44 px. No hover-only or time-limited interactions. Autoplay never blocks manual navigation. Live demos and iframes never trap keyboard focus.

**Motion**

- Every animation (blink, sketchy arrow, big X, entrances, effects) runs only under `prefers-reduced-motion: no-preference`. Nothing flashes more than 3 times per second.

**Verification**: the keyboard pass and Lighthouse audit from §2.2, with a11y issues listed in the final report.

---

## 8. Working style

- Edit file by file with targeted edits. No bulk scripted rewrites across many files.
- Before deleting an asset, check who imports it. Remove the import and the usage in the same change.
- After a round of changes: build + chrome-devtools check of **every** touched slide, then a short report (what changed, what was verified, what's still open).
- When the user gives visual feedback, apply exactly that, verify it in the browser, and report. No extra redesigns nobody asked for.
