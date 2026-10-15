import {
  PresentationDeckElement,
  registerElements,
  setStyleRoot,
} from "p-slides";
import deckShadowCss from "../styles/deck-shadow.css?raw";

const SWIPE_THRESHOLD = 50;
const IDLE_DELAY = 2500;

const deck = document.querySelector("p-deck");
const { body } = document;

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
  },
);

/* --- Iframe key: revealing <p-fragment iframe-key="2"> presses that key
   inside the slide's iframe, so a live demo advances with the deck --- */

function pressIframeKeys(slide, revealed) {
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

syncChrome();

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

deck.addEventListener("command", ({ command, source }) =>
  commands[command]?.(source),
);

// Buttons and native shortcuts (Alt+M/S/G) both keep the URL in sync
new MutationObserver(writeHash).observe(deck, {
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
      () => fragment.setAttribute("aria-hidden", "false"),
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

/* --- Touch: horizontal swipe navigates, nav fades out when idle --- */

let touchStart = null;
let idleTimer;

function markActive() {
  body.toggleAttribute("idle", false);
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => body.toggleAttribute("idle", true), IDLE_DELAY);
}

deck.addEventListener(
  "touchstart",
  ({ changedTouches: [touch], target }) => {
    markActive();
    const ignored = target.closest("pre, a, button");
    touchStart =
      deck.mode === "presentation" && !ignored
        ? { x: touch.clientX, y: touch.clientY }
        : null;
  },
  { passive: true },
);

deck.addEventListener(
  "touchend",
  ({ changedTouches: [touch] }) => {
    if (!touchStart) return;
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
    dx < 0 ? deck.next() : deck.previous();
  },
  { passive: true },
);

body
  .querySelector(":scope > nav")
  ?.addEventListener("touchstart", markActive, { passive: true });
markActive();

/* --- CSS Houdini paint worklet, loaded only when a slide uses it --- */

if ("paintWorklet" in CSS && document.querySelector("[sketchy-arrow]")) {
  CSS.paintWorklet.addModule("/js/sketchy-arrow.js");
}
