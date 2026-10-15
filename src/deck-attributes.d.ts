// Bare attributes used as styling hooks by the classless deck (AGENTS.md §6).
// Declared here so `astro check` accepts them on native HTML elements.
// A new hook in src/styles/components.css gets a line here too.

type DeckHook = string | number | boolean | undefined | null;

declare namespace astroHTML.JSX {
  interface HTMLAttributes {
    // layout
    layout?: DeckHook;
    justify?: DeckHook;
    align?: DeckHook;
    self?: DeckHook;
    cover?: DeckHook;
    // text
    gradient?: DeckHook;
    "with-emoji"?: DeckHook;
    tone?: DeckHook;
    weight?: DeckHook;
    uppercase?: DeckHook;
    text?: DeckHook;
    density?: DeckHook;
    list?: DeckHook;
    links?: DeckHook;
    spacing?: DeckHook;
    card?: DeckHook;
    unpadded?: DeckHook;
    info?: DeckHook;
    "final-link"?: DeckHook;
    // media, code, tables
    inline?: DeckHook;
    size?: DeckHook;
    dense?: DeckHook;
    support?: DeckHook;
    "full-media"?: DeckHook;
    // effects
    shadow?: DeckHook;
    sepia?: DeckHook;
    banner?: DeckHook;
    "fade-borders"?: DeckHook;
    mark?: DeckHook;
    js?: DeckHook;
    "file-badge"?: DeckHook;
    attention?: DeckHook;
    "sketch-circle"?: DeckHook;
    "hand-drawing"?: DeckHook;
    box?: DeckHook;
    arrow?: DeckHook;
    up?: DeckHook;
    down?: DeckHook;
    left?: DeckHook;
    right?: DeckHook;
    "up-down"?: DeckHook;
    "big-x"?: DeckHook;
    "sketchy-arrow"?: DeckHook;
    blink?: DeckHook;
    // fragments, entrances, autoplay
    "p-fragment"?: DeckHook;
    "p-effect"?: DeckHook;
    effect?: DeckHook;
    landing?: DeckHook;
    invert?: DeckHook;
    none?: DeckHook;
    "group-fragment"?: DeckHook;
    enter?: DeckHook;
    autoplay?: DeckHook;
    timing?: DeckHook;
    "timing-fragment"?: DeckHook;
    "timing-start"?: DeckHook;
    "no-autoplay"?: DeckHook;
    "follow-fragments"?: DeckHook;
    "iframe-key"?: DeckHook;
    // authoring
    todo?: DeckHook;
    debug?: DeckHook;
  }
}
