// CSS and the Canvas 2D renderer consume the same project-level style.
function defineProfile(profile) {
  for (const values of Object.values(profile)) Object.freeze(values);
  return Object.freeze(profile);
}

export const PROFILES = Object.freeze({
  restrained: defineProfile({
    colors: {
      paper: "#f8f2e7", ink: "#242722", card: "#fff9ec", shadow: "#89a296",
      accent: "#c84d30", plate: "#d7dfcd", rule: "#aaad9c",
    },
    shape: { stroke: 2, corner: 4, effectStroke: 1.45 },
    press: { heldScale: .86, hitScale: .78, overshoot: .11, flashMs: 53, settleMs: 290 },
    drag: { stiffness: 295, damping: 33, stretch: .14, threshold: .62, fullSpeed: 2.1, releaseThreshold: 1.38, trailRate: 6 },
    reveal: { titleTravel: 12, plateTravel: 19, overshoot: .06, totalMs: 346 },
    effects: { cap: 12, range: .72, duration: .75, density: .5, lettering: "off" },
  }),
  expressive: defineProfile({
    colors: {
      paper: "#fbefdc", ink: "#382723", card: "#fff5df", shadow: "#e5a479",
      accent: "#9c382b", plate: "#edbd95", rule: "#b48a72",
    },
    shape: { stroke: 3, corner: 2, effectStroke: 1.85 },
    press: { heldScale: .63, hitScale: .58, overshoot: .23, flashMs: 78, settleMs: 440 },
    drag: { stiffness: 255, damping: 23, stretch: .36, threshold: .42, fullSpeed: 1.85, releaseThreshold: 1.10, trailRate: 14 },
    reveal: { titleTravel: 23, plateTravel: 43, overshoot: .13, totalMs: 500 },
    effects: { cap: 28, range: 1, duration: 1, density: 1, lettering: "vector-thump" },
  }),
});

export function applyCssProfile(element, profile) {
  for (const [name, value] of Object.entries(profile.colors)) {
    element.style.setProperty(`--${name}`, value);
  }
  const { stroke, corner } = profile.shape;
  element.style.setProperty("--stroke", `${stroke}px`);
  element.style.setProperty("--corner", `${corner}px`);
}
