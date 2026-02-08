export function listenGroupFragment(el, nameFragment) {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(() => {
      const elements = document.querySelectorAll(
        `[group-fragment="${nameFragment}"]`
      );
      elements.forEach((el, index, nodeList) => {
        const ariaHidden = el.getAttribute("aria-hidden");
        if (index > 0) {
          nodeList[index - 1].style.display =
            ariaHidden === "false" ? "none" : "inherit";
        }
      });
    });
  });
  observer.observe(el, {
    attributes: true,
    attributeFilter: ["aria-hidden"],
  });
}

export function listenSlideAutoplay(el) {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      const isVisibile =
        mutation.target.getAttribute("aria-hidden") === "false";
      const defaultTiming = mutation.target.getAttribute("timing") || 1000;
      const timing = mutation.target.getAttribute("timing-fragment") || 100;
      if (!isVisibile) return;
      const elements = el.querySelectorAll(
        `p-fragment:not([no-autoplay]), [p-fragment]:not([no-autoplay])`
      );
      elements.forEach((el, index) => {
        const ariaHidden = el.getAttribute("aria-hidden");
        const timingStart = el.getAttribute("timing-start");
        if (ariaHidden === "true") {
          setTimeout(() => {
            el.setAttribute("aria-hidden", "false");
          }, (+timingStart || +defaultTiming) + timing * index);
        }
      });
    });
  });
  observer.observe(el, {
    attributes: true,
    attributeFilter: ["aria-hidden"],
  });
}

export function listenSlideFollowFragment(el) {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      const isVisibile =
        mutation.target.getAttribute("aria-hidden") === "false";
      if (!isVisibile) return;
      el.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    });
  });
  observer.observe(el, {
    attributes: true,
    attributeFilter: ["aria-hidden"],
  });
}

document.querySelectorAll(`p-slide[autoplay]`).forEach((el) => {
  listenSlideAutoplay(el);
});

document.querySelectorAll(`p-fragment[group-fragment]`).forEach((el) => {
  listenGroupFragment(el, el.getAttribute("group-fragment"));
});

document
  .querySelectorAll(`p-slide[follow-fragments] p-fragment`)
  .forEach((el) => {
    listenSlideFollowFragment(el);
  });
