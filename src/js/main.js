const deck = document.querySelector("p-deck");

function handleHash() {
  const hash = location.hash.slice(1);
  const params = new URLSearchParams(hash);
  const [slideRef] = [...params.keys()];

  const slide = getSlide(slideRef);
  const current = document.querySelector("p-slide[active]");

  const mode = params.get("mode");
  if (mode) {
    deck.setAttribute("mode", mode);
  } else {
    deck.removeAttribute("mode");
  }
  if (slide && slide !== current) {
    if (current) {
      current.removeAttribute("active");
      current.removeAttribute("aria-current");
    }
    slide.setAttribute("active", "");
    slide.setAttribute("aria-current", "page");
  }
}
addEventListener("hashchange", handleHash);
handleHash();

if (navigator.userAgent.toLowerCase().includes("electron")) {
  const params = new URLSearchParams(location.hash.slice(1));
  if (!params.get("mode")) {
    document.body.setAttribute("electron", "electron");
  }
}

function getSlide(slideRef) {
  if (/^\d+$/.test(`${slideRef}`.trim())) {
    return deck.querySelectorAll("p-slide")[+slideRef] || null;
  }
  return document.querySelector(`#${slideRef}`);
}

const progressBar = document.querySelector(".presentation-progress");
const navButtons = [
  ...document.querySelectorAll(".presentation-nav button"),
].reduce((map, button) => {
  map[button.className] = button;
  return map;
}, {});

if (Object.keys(navButtons).length > 0) {
  navButtons.previous.addEventListener("click", () => deck.previous());
  navButtons.next.addEventListener("click", () => deck.next());
}
function toggleNavButtons(event) {
  if (event) {
    const hasTargetAttribute = event.target.hasAttribute("follow-fragments");
    /* This code snippet is checking if the event target has an attribute called 'follow-fragments'. If the
    target element does have this attribute, it then accesses the `fragment` property from the event
    detail and calls the `scrollIntoView` method on it. This method is used to scroll the element into
    view with a smooth animation, ensuring that the element is centered within its container and is as
    close to the viewport as possible. */
    if (hasTargetAttribute) {
      event.detail.fragment.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    }
  }
  navButtons.previous.disabled = deck.atStart;
  navButtons.next.disabled = deck.atEnd;
}

function changeHash(slide) {
  const slideRef = slide.id || deck.currentIndex;
  const { mode } = deck;
  location.hash =
    "#" + slideRef + (mode === "presentation" ? "" : `&mode=${mode}`);
}
deck.addEventListener("p-slides.slidechange", ({ detail: { slide } }) => {
  changeHash(slide);

  const progress = +(
    (deck.currentIndex * 100) /
    (deck.slides.length - 1)
  ).toFixed(2);
  progressBar.setAttribute("aria-valuenow", progress);
  progressBar.style.setProperty("--progress", progress + "%");

  toggleNavButtons();
  setTimeout(() => {
    deck.style.setProperty(
      "--current-slide-bg",
      getComputedStyle(slide).backgroundColor
    );
  });
});
deck.addEventListener("p-slides.fragmenttoggle", toggleNavButtons);
const fullscreenButton = document.querySelector(".fullscreen");
fullscreenButton.addEventListener("click", () => {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document.body.requestFullscreen();
  }
});

const deckMode = {
  presentation: "presentation",
  speaker: "speaker",
  grid: "grid",
};

function toggleDeckMode(modeRequested) {
  const { mode } = deck;
  deck.mode = mode !== modeRequested ? modeRequested : deckMode.presentation;
  changeHash(deck.currentSlide);
}

document.querySelectorAll(".toggle-mode").forEach((el) => {
  el.addEventListener("click", toggleDeckMode.bind(null, el.dataset.mode));
});

document.addEventListener("keydown", (keyEvent) => {
  if (keyEvent.key.toLowerCase() === "m" && keyEvent.ctrlKey) {
    toggleDeckMode();
  }
});
