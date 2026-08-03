// Clock. Hours and minutes are set in the display face; seconds and the
// meridiem drop into the mono face, which keeps them tabular so the big
// numerals never shift as they tick.

const section = document.getElementById("clock");
const timeEl = document.getElementById("clock-time");
const dateEl = document.getElementById("clock-date");

let cfg = { enabled: true, hour12: true, seconds: false, date: true };
let timer = null;

const pad = (n) => String(n).padStart(2, "0");

function paint() {
  const now = new Date();
  let hours = now.getHours();
  const meridiem = hours < 12 ? "AM" : "PM";
  if (cfg.hour12) hours = hours % 12 || 12;

  const parts = [];
  const hm = document.createElement("span");
  hm.className = "hm";
  hm.textContent = `${cfg.hour12 ? hours : pad(hours)}:${pad(now.getMinutes())}`;
  parts.push(hm);

  if (cfg.seconds) {
    const s = document.createElement("span");
    s.className = "sec";
    s.textContent = pad(now.getSeconds());
    parts.push(s);
  }
  if (cfg.hour12) {
    const m = document.createElement("span");
    m.className = "mer";
    m.textContent = meridiem;
    parts.push(m);
  }

  timeEl.replaceChildren(...parts);
  timeEl.dateTime = now.toISOString();

  dateEl.hidden = !cfg.date;
  if (cfg.date) {
    dateEl.textContent = now.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric"
    });
  }
}

// Align to the next boundary rather than ticking every second, so the display
// changes when the clock does and not up to a second late.
function schedule() {
  clearTimeout(timer);
  const now = Date.now();
  const period = cfg.seconds ? 1000 : 60000;
  timer = setTimeout(() => {
    paint();
    schedule();
  }, period - (now % period) + 20);
}

export function updateClock(next) {
  cfg = next;
  section.hidden = !cfg.enabled;
  if (!cfg.enabled) {
    clearTimeout(timer);
    return;
  }
  paint();
  schedule();
}
