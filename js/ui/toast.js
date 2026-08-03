const el = document.getElementById("toast");
let timer;

export function toast(message) {
  el.textContent = message;
  el.classList.add("on");
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove("on"), 2000);
}
