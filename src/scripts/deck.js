import {
  PresentationDeckElement,
  registerElements,
  setStyleRoot,
} from "p-slides";
import deckShadowCss from "../styles/deck-shadow.css?raw";

const SWIPE_THRESHOLD = 50;
const TAP_SLOP = 10; // px a finger may drift and still be a tap
const TAP_TIME = 300; // ms; longer presses are not taps (text selection)
const TAP_BACK_ZONE = 0.25; // left share of the screen where a tap goes back
// Taps on these keep their own behaviour
const INTERACTIVE =
  "pre, a, button, input, select, textarea, label, summary, iframe, video, [contenteditable]";
const IDLE_DELAY = 2500;

const deck = document.querySelector("p-deck");
const { body } = document;

/* Dev: ?coming-soon previews the page before the release date. Only the
   first slide stays: the event cover, outside the canRender gate by
   convention */
if (
  import.meta.env.DEV &&
  new URLSearchParams(location.search).has("coming-soon")
) {
  body.setAttribute("coming-soon", "");
  body.querySelector(":scope > [release]").hidden = false;
  for (const slide of deck.querySelectorAll(
    ":scope > p-slide:not(:first-of-type)",
  )) {
    slide.remove();
  }
}

/* --- URL hash <-> deck state: #<id|index>[&mode=<mode>] --- */

function parseHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  const [ref = ""] = params.keys();
  const slide = /^\d+$/.test(ref)
    ? deck.querySelectorAll("p-slide")[Number(ref)]
    : ref
      ? deck.querySelector(`p-slide#${CSS.escape(ref)}`)
      : null;
  return { slide, mode: params.get("mode") };
}

// Preselect through attributes before the elements are defined,
// so the deck doesn't animate from the first slide on load
{
  const { slide, mode } = parseHash();
  // p-slides reads the current slide from aria-current, not [active]
  slide?.setAttribute("aria-current", "page");
  if (mode) deck.setAttribute("mode", mode);
}

setStyleRoot("/css/");
// A string with newlines is parsed as CSS, a plain path is fetched
PresentationDeckElement.styles = ["/css/deck.css", deckShadowCss];
await registerElements();

const progress = body.querySelector(':scope > [role="progressbar"]');
const counter = body.querySelector(":scope > nav output");
const navButton = (command) =>
  body.querySelector(`:scope > nav button[command="${command}"]`);
const previousButton = navButton("--previous");
const nextButton = navButton("--next");

function readHash() {
  const { slide, mode } = parseHash();
  deck.mode = mode ?? "presentation";
  if (slide) deck.currentSlide = slide;
}

function writeHash() {
  const ref = deck.currentSlide?.id || deck.currentIndex;
  const mode = deck.mode === "presentation" ? "" : `&mode=${deck.mode}`;
  location.hash = `${ref}${mode}`;
}

addEventListener("hashchange", readHash);

/* --- Chrome: progress, counter, nav buttons, slide background --- */

function syncChrome() {
  const last = Math.max(deck.slides.length - 1, 1);
  const value = Math.round((deck.currentIndex * 10000) / last) / 100;
  progress?.setAttribute("aria-valuenow", value);
  progress?.style.setProperty("--progress", `${value}%`);
  if (counter)
    counter.value = `${deck.currentIndex + 1} / ${deck.slides.length}`;
  if (previousButton) previousButton.disabled = deck.atStart;
  if (nextButton) nextButton.disabled = deck.atEnd;
}

deck.addEventListener("p-slides.slidechange", ({ slide }) => {
  writeHash();
  syncChrome();
  clearReplay();
  autoplay(slide);
  // Wait for the slide's own styles to apply before sampling its colour
  requestAnimationFrame(() =>
    deck.style.setProperty(
      "--current-slide-bg",
      getComputedStyle(slide).backgroundColor,
    ),
  );
});

deck.addEventListener(
  "p-slides.fragmenttoggle",
  ({ target, fragments, areActivated }) => {
    syncChrome();
    followFragments(target, areActivated ? fragments : []);
    if (areActivated) pressIframeKeys(target, fragments);
    replayFragments(fragments, areActivated);
  },
);

/* --- Speaker replay: the speaker preview keeps unrevealed fragments as
   ghosts in their final place. A fragment revealed there gets [replay], so
   the CSS plays the same entrance the audience sees. Only live reveals get
   it: a slide reached with fragments already shown doesn't replay them --- */

function replayFragments(fragments, areActivated) {
  for (const fragment of fragments) {
    fragment.removeAttribute("replay");
    if (!areActivated || deck.mode !== "speaker") continue;
    // Reflow, so stepping back and forth restarts the animation
    void fragment.offsetWidth;
    fragment.toggleAttribute("replay", true);
  }
}

function clearReplay() {
  for (const fragment of deck.querySelectorAll("[replay]"))
    fragment.removeAttribute("replay");
}

/* --- Iframe key: revealing <p-fragment iframe-key="2"> presses that key
   inside the slide's iframe, so a live demo advances with the deck --- */

function pressIframeKeys(slide, revealed) {
  // The demo runs where the audience looks: in the speaker view a main-thread
  // demo would freeze the notes and the timer
  if (deck.mode === "speaker") return;
  const iframe = slide.querySelector("iframe");
  for (const fragment of revealed) {
    const key = fragment.getAttribute("iframe-key");
    if (!key) continue;
    iframe?.contentDocument?.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true }),
    );
  }
}

/* --- Follow fragments: a scrolling box ([follow-fragments] on the slide, or
   a <CodeWindow lines="N">) centres the last revealed fragment, and scrolls
   back to the last one still visible (or the top) when stepping backwards --- */

function followFragments(slide, revealed) {
  const boxes = slide.querySelectorAll("[follow-fragments]");
  const scrollers = slide.hasAttribute("follow-fragments")
    ? [slide, ...boxes]
    : boxes;
  const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "instant"
    : "smooth";

  for (const box of scrollers) {
    const visible = box.querySelectorAll(
      ':is(p-fragment, [p-fragment])[aria-hidden="false"]',
    );
    const target =
      revealed.findLast((fragment) => box.contains(fragment)) ??
      [...visible].at(-1);
    let top = 0;
    if (target) {
      const boxRect = box.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      top =
        box.scrollTop +
        rect.top -
        boxRect.top -
        (box.clientHeight - rect.height) / 2;
    }
    box.scrollTo({ top, behavior });
  }
}

/* --- Sync between windows: p-slides applies the state broadcast by another
   window (e.g. the speaker view) without firing fragmenttoggle, so the
   fragment side effects above would run only where the speaker pressed the
   key. Listen to the same channel and replay them for what changed: newly
   revealed fragments scroll into view, press their iframe keys and replay;
   a different slide (or hidden fragments) only realigns the scroll --- */

const activeFragments = (slide) =>
  slide
    ? [...slide.fragments].filter(
        (fragment) => fragment.getAttribute("aria-hidden") === "false",
      )
    : [];

let synced = {
  slide: deck.currentSlide,
  shown: activeFragments(deck.currentSlide),
};
const rememberShown = () =>
  (synced = {
    slide: deck.currentSlide,
    shown: activeFragments(deck.currentSlide),
  });

// A remote state fires slidechange before applying the fragments: snapshot
// after it, so landing on a slide with fragments already shown replays nothing
deck.addEventListener("p-slides.slidechange", () => setTimeout(rememberShown));
deck.addEventListener("p-slides.fragmenttoggle", rememberShown);

new BroadcastChannel("p-slides").addEventListener("message", ({ data }) => {
  if (!data || data.deckId !== deck.id) return;
  // The deck applies the state in its own listener: run after it
  setTimeout(() => {
    const slide = deck.currentSlide;
    const shown = activeFragments(slide);
    const sameSlide = slide === synced.slide;
    const added = sameSlide
      ? shown.filter((fragment) => !synced.shown.includes(fragment))
      : [];
    // Our own broadcast echoes here too: nothing changed, nothing to do
    if (sameSlide && !added.length && shown.length === synced.shown.length)
      return;
    if (added.length) {
      followFragments(slide, added);
      pressIframeKeys(slide, added);
      replayFragments(added, true);
    } else {
      followFragments(slide, []);
    }
    syncChrome();
    rememberShown();
  });
});

syncChrome();

/* --- Pace: <p-deck talk-minutes="40"> adds a traffic light under the speaker
   toolbar. Every slide is worth the same share of the slot: the drift between
   the p-slides timer and the planned time for the current slide says whether
   the speaker is too fast, too slow or on track --- */

const PACE_ON_TRACK = 0.05;
const PACE_WARNING = 0.12;

const PACE_VERDICTS = {
  idle: "Press ▶ to start",
  "on-track": "✓ On track",
  "ahead-warn": "▲ Slow down a bit",
  "ahead-bad": "▲ Slow down!",
  "behind-warn": "▼ Speed up a bit",
  "behind-bad": "▼ Speed up!",
  over: "✕ Over time",
};

function formatPace(ms) {
  const seconds = Math.round(Math.abs(ms) / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function setupPace() {
  const duration = Number(deck.getAttribute("talk-minutes")) * 60_000;
  const toolbar = deck.shadowRoot?.querySelector('[part~="toolbar"]');
  if (!duration || !toolbar) return;

  const box = document.createElement("section");
  box.setAttribute("part", "pace");
  box.setAttribute("aria-label", "Pace");
  // No <span> or <header>: p-slides styles both inside its shadow root
  box.innerHTML = `<div part="pace-verdict">
      <div part="pace-light" aria-hidden="true"><i></i><i></i><i></i></div>
      <strong role="status"></strong>
    </div>
    <div part="pace-tracks" aria-hidden="true">
      <div track="slides"><b>Slides</b><div><i></i></div><small></small></div>
      <div track="time"><b>Time</b><div><i></i></div><small></small></div>
    </div>
    <dl>
      <div><dt>vs plan</dt><dd stat="drift"></dd></div>
      <div><dt>Left</dt><dd stat="left"></dd></div>
      <div><dt>Per slide</dt><dd stat="per-slide"></dd></div>
      <div><dt>Finish ≈</dt><dd stat="finish"></dd></div>
    </dl>`;
  toolbar.after(box);
  const verdict = box.querySelector("strong");
  const track = (name) => box.querySelector(`[track="${name}"]`);
  const stat = (name) => box.querySelector(`[stat="${name}"]`);

  function setTrack(name, ratio) {
    const percent = Math.round(Math.min(Math.max(ratio, 0), 1) * 100);
    track(name).style.setProperty("--value", `${percent}%`);
    track(name).querySelector("small").textContent = `${percent}%`;
  }

  function update() {
    const elapsed = deck.clock;
    const last = Math.max(deck.slides.length - 1, 1);
    const planned = (deck.currentIndex / last) * duration;
    const drift = elapsed - planned;
    const ratio = Math.abs(drift) / duration;
    const level =
      ratio <= PACE_ON_TRACK ? "ok" : ratio <= PACE_WARNING ? "warn" : "bad";

    let state = drift < 0 ? `ahead-${level}` : `behind-${level}`;
    if (level === "ok") state = "on-track";
    if (elapsed > duration) state = "over";
    if (!elapsed && !deck.isClockRunning) state = "idle";

    box.setAttribute("pace", state);
    // Only the verdict is live: it changes on state change, not every second
    if (verdict.textContent !== PACE_VERDICTS[state])
      verdict.textContent = PACE_VERDICTS[state];

    const left = duration - elapsed;
    const slidesLeft = Math.max(last - deck.currentIndex, 1);
    const signed = (ms) => `${ms < 0 ? "−" : "+"}${formatPace(ms)}`;
    setTrack("slides", deck.currentIndex / last);
    setTrack("time", elapsed / duration);
    stat("drift").textContent = state === "idle" ? "0:00" : signed(drift);
    stat("left").textContent = left < 0 ? signed(left) : formatPace(left);
    stat("per-slide").textContent = formatPace(Math.max(left, 0) / slidesLeft);
    // Total talk length if the current pace holds
    const finish =
      deck.currentIndex && elapsed ? (elapsed / deck.currentIndex) * last : 0;
    stat("finish").textContent = finish ? formatPace(finish) : "–";
    stat("finish").toggleAttribute("late", finish > duration);
  }

  for (const type of [
    "slidechange",
    "fragmenttoggle",
    "clockstart",
    "clockstop",
    "clockset",
  ]) {
    deck.addEventListener(`p-slides.${type}`, update);
  }
  setInterval(() => {
    if (deck.mode === "speaker" && deck.isClockRunning) update();
  }, 1000);
  update();
}

setupPace();

/* --- Buttons: Invoker Commands (commandfor="deck" command="--…") ---
   p-deck runs its own commands natively (--next, --previous, --gridmode…);
   these are the project's extra ones */

const commands = {
  "--fullscreen": () =>
    document.fullscreenElement
      ? document.exitFullscreen()
      : body.requestFullscreen(),
  // <button command="--mode" value="grid">: toggles back to presentation
  "--mode": ({ value }) => {
    deck.mode = deck.mode === value ? "presentation" : value;
  },
};

/* --- Coming soon: count down to <Layout releaseDate> ---
   The page is static: at zero it says the slides are on their way, they
   show up with the next build */
const countdown = body.querySelector(":scope > [release] > [countdown]");
const releaseTime = body.querySelector(":scope > [release] time");
if (countdown && releaseTime) {
  const release = new Date(releaseTime.dateTime).getTime();
  const units = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
  ];

  const tick = () => {
    let left = Math.max(0, Math.floor((release - Date.now()) / 1000));
    if (!left) {
      clearInterval(timer);
      countdown.textContent = "Unlocking any minute now";
      return;
    }
    countdown.replaceChildren(
      ...units.map(([unit, seconds], index) => {
        const amount = Math.floor(left / seconds);
        left -= amount * seconds;
        const cell = document.createElement("span");
        const value = document.createElement("b");
        value.textContent = String(amount).padStart(index ? 2 : 1, "0");
        cell.append(value, ` ${unit}${amount === 1 ? "" : "s"}`);
        return cell;
      }),
    );
  };

  const timer = setInterval(tick, 1000);
  tick();
  countdown.hidden = false;
}

/* --- Theme picker (dev only, tree-shaken from the build) ---
   <ThemeSwitch>: Alt+T or its button opens the menu. ↑/↓ try a theme live,
   Enter or click keeps it (sessionStorage), Esc or a click outside goes
   back. Event colours are checked against every theme tried */
if (import.meta.env.DEV) {
  const root = document.documentElement;
  const menu = body.querySelector("#theme-menu");
  const items = [...(menu?.querySelectorAll('[command="--theme"]') ?? [])];
  const themes = items.map((item) => item.value);
  // Keyed on the page's own theme: changing the prop starts over
  const storageKey = `deck-theme:${location.pathname}:${root.dataset.theme}`;
  let kept = root.dataset.theme;

  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    for (const item of items) item.ariaPressed = String(item.value === theme);
    // The deck's backdrop samples the slide colour: sample it again
    requestAnimationFrame(() => {
      deck.style.setProperty(
        "--current-slide-bg",
        getComputedStyle(deck.currentSlide).backgroundColor,
      );
      checkContrast(theme);
    });
  };
  const keepTheme = (theme) => {
    kept = theme;
    applyTheme(theme);
    try {
      sessionStorage.setItem(storageKey, theme);
    } catch {}
  };

  if (menu) {
    let saved = null;
    try {
      saved = sessionStorage.getItem(storageKey);
    } catch {}
    keepTheme(themes.includes(saved) ? saved : kept);

    commands["--theme"] = ({ value }) => {
      keepTheme(value);
      menu.hidePopover();
    };

    menu.addEventListener("toggle", ({ newState }) => {
      if (newState === "open") {
        items.find((item) => item.value === kept)?.focus();
      } else if (root.dataset.theme !== kept) {
        applyTheme(kept);
      }
    });

    // Keys stay in the menu: arrows try themes instead of changing slide
    menu.addEventListener("keydown", (event) => {
      event.stopPropagation();
      const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const focused = items.indexOf(document.activeElement);
      const index =
        focused === -1 ? themes.indexOf(root.dataset.theme) : focused;
      const next = items.at((index + step) % items.length);
      next.focus();
      applyTheme(next.value);
    });

    addEventListener("keydown", (event) => {
      if (event.altKey && event.code === "KeyT") {
        event.preventDefault();
        menu.togglePopover();
      }
    });
  }

  // Event colours (Layout accent/tokens) can be unreadable on some themes
  function checkContrast(theme) {
    const style = getComputedStyle(root);
    const surface = style.getPropertyValue("--surface");
    const checks = [
      ["--brand-color", 4.5, "links and emphasis"],
      ["--gradient-sub-from", 3, "gradient headings"],
      ["--gradient-sub-to", 3, "gradient headings"],
    ];
    for (const [token, min, usage] of checks) {
      const ratio = contrast(style.getPropertyValue(token), surface);
      if (ratio < min) {
        console.warn(
          `[theme ${theme}] ${token} on --surface is ${ratio.toFixed(2)}:1, ` +
            `below ${min}:1 for ${usage}. Lighten or darken it for this ` +
            `theme (Layout accent / tokens).`,
        );
      }
    }
  }

  function contrast(a, b) {
    const [la, lb] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (la + 0.05) / (lb + 0.05);
  }

  // Any CSS colour → relative luminance, through a 1px canvas
  const pixel = document.createElement("canvas").getContext("2d", {
    willReadFrequently: true,
  });
  function luminance(color) {
    pixel.clearRect(0, 0, 1, 1);
    pixel.fillStyle = "#000";
    pixel.fillStyle = color.trim();
    pixel.fillRect(0, 0, 1, 1);
    const rgb = pixel.getImageData(0, 0, 1, 1).data;
    const [r, g, b] = [...rgb.slice(0, 3)].map((value) => {
      const channel = value / 255;
      return channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
}

deck.addEventListener("command", ({ command, source }) =>
  commands[command]?.(source),
);

// The mode toggles show (and announce) which mode is on
function syncModeButtons() {
  for (const button of body.querySelectorAll('[command="--mode"]')) {
    button.ariaPressed = String(deck.mode === button.value);
  }
}

// Opening the grid lands on the current slide, not on the first row
function scrollGridToCurrent() {
  if (deck.mode !== "grid") return;
  requestAnimationFrame(() =>
    deck.currentSlide?.scrollIntoView({ block: "center" }),
  );
}

syncModeButtons();
// Loading straight into the grid: the board lays out only when p-slides'
// stylesheet (fetched asynchronously) applies, so wait until it scrolls
if (deck.mode === "grid") {
  const start = performance.now();
  requestAnimationFrame(function settle() {
    if (deck.scrollHeight > deck.clientHeight) scrollGridToCurrent();
    else if (performance.now() - start < 2000) requestAnimationFrame(settle);
  });
}

// Buttons and native shortcuts (Alt+M/S/G) both keep the URL in sync
new MutationObserver(() => {
  writeHash();
  syncModeButtons();
  scrollGridToCurrent();
  placeControls();
}).observe(deck, {
  attributes: true,
  attributeFilter: ["mode"],
});

if (!document.fullscreenEnabled) {
  for (const button of body.querySelectorAll('[command="--fullscreen"]')) {
    button.hidden = true;
  }
}

/* --- Autoplay: <p-slide autoplay timing="ms" timing-fragment="ms"> --- */

let autoplayRun = new AbortController();

function autoplay(slide) {
  autoplayRun.abort();
  autoplayRun = new AbortController();
  if (!slide?.hasAttribute("autoplay")) return;

  const { signal } = autoplayRun;
  const delay = Number(slide.getAttribute("timing") ?? 1000);
  const step = Number(slide.getAttribute("timing-fragment") ?? 100);
  const fragments = slide.querySelectorAll(
    ":is(p-fragment, [p-fragment]):not([no-autoplay])",
  );

  fragments.forEach((fragment, index) => {
    if (fragment.getAttribute("aria-hidden") !== "true") return;
    const start = Number(fragment.getAttribute("timing-start")) || delay;
    const timer = setTimeout(
      () => {
        fragment.setAttribute("aria-hidden", "false");
        replayFragments([fragment], true);
      },
      start + step * index,
    );
    signal.addEventListener("abort", () => clearTimeout(timer));
  });
}

autoplay(deck.currentSlide);

/* --- Electron (kiosk) hides the chrome unless a mode is requested --- */

if (/electron/i.test(navigator.userAgent) && !location.hash.includes("mode=")) {
  body.toggleAttribute("electron", true);
}

/* --- Touch: horizontal swipe or tap navigates (tap on the left edge goes
   back), nav fades out when idle --- */

let touchStart = null;
let idleTimer;

function markActive() {
  body.toggleAttribute("idle", false);
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => body.toggleAttribute("idle", true), IDLE_DELAY);
}

deck.addEventListener(
  "touchstart",
  ({ touches, changedTouches: [touch], target, timeStamp }) => {
    markActive();
    const ignored = target.closest(INTERACTIVE);
    // A second finger means pinch-zoom: neither a swipe nor a tap
    touchStart =
      deck.mode === "presentation" && !ignored && touches.length === 1
        ? { x: touch.clientX, y: touch.clientY, time: timeStamp }
        : null;
  },
  { passive: true },
);

deck.addEventListener("touchend", (event) => {
  if (!touchStart) return;
  const [touch] = event.changedTouches;
  const dx = touch.clientX - touchStart.x;
  const dy = touch.clientY - touchStart.y;
  const isTap =
    Math.hypot(dx, dy) < TAP_SLOP &&
    event.timeStamp - touchStart.time < TAP_TIME;
  touchStart = null;
  if (isTap) {
    // Handled here: no synthetic click, no double-tap zoom
    event.preventDefault();
    touch.clientX < innerWidth * TAP_BACK_ZONE ? deck.previous() : deck.next();
    return;
  }
  if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
  dx < 0 ? deck.next() : deck.previous();
});

body
  .querySelector(":scope > nav")
  ?.addEventListener("touchstart", markActive, { passive: true });
// Mouse users too: collapsed controls come back while the pointer moves
addEventListener("pointermove", markActive, { passive: true });
markActive();

/* --- Controls never cover a slide: body[controls] says where they go.
   Speaker and grid have their own spots; in presentation they sit in the
   letterbox band around the slide when it is wide enough, otherwise they
   collapse and show only on pointer activity or keyboard focus --- */

const CONTROLS_ROOM = 80; // a 60px pill plus its gap from the edge

function placeControls() {
  if (deck.mode !== "presentation") {
    body.setAttribute("controls", deck.mode);
    return;
  }
  const ratio =
    Number(getComputedStyle(deck).getPropertyValue("--slide-aspect-ratio")) ||
    16 / 9;
  const width = Math.min(innerWidth, innerHeight * ratio);
  const sides = (innerWidth - width) / 2;
  const bottom = (innerHeight - width / ratio) / 2;
  body.setAttribute(
    "controls",
    sides >= CONTROLS_ROOM
      ? "sides"
      : bottom >= CONTROLS_ROOM
        ? "bottom"
        : "collapsed",
  );
}

addEventListener("resize", placeControls);
placeControls();

/* --- CSS Houdini paint worklet, loaded only when a slide uses it --- */

if ("paintWorklet" in CSS && document.querySelector("[sketchy-arrow]")) {
  CSS.paintWorklet.addModule("/js/sketchy-arrow.js");
}
