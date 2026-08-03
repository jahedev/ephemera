// Light, dark, or whatever the OS says. In light mode the scrim over the
// wallpaper flips from black to white, so the print washes out like paper
// instead of the chrome fighting a dark image for contrast.

const mq = matchMedia("(prefers-color-scheme: dark)");
let mode = "system";
let onChange = () => {};

function apply() {
  const dark = mode === "system" ? mq.matches : mode === "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  onChange(dark);
}

export function initTheme(initial, handler) {
  onChange = handler;
  mode = initial;
  mq.addEventListener("change", () => {
    if (mode === "system") apply();
  });
  apply();
}

export function setTheme(next) {
  mode = next;
  apply();
}

export function isDark() {
  return document.documentElement.dataset.theme === "dark";
}
