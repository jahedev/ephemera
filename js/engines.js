// Search targets. Every engine is just a URL with %s where the query goes,
// which is also all a custom engine needs - so built-ins and user-added ones
// travel through exactly the same code path.
//
// `hint` is the placeholder text. It names what this engine actually searches
// rather than repeating the engine's name back at you.
//
// `bang` is the shorthand you can type into the search field: "!gh rust" jumps
// to GitHub. Bangs reach every engine, including ones hidden from the strip.

export const BUILTIN = [
  { id: "google", name: "Google", short: "Google", bang: "g", hint: "Search the web", url: "https://www.google.com/search?q=%s" },
  { id: "duckduckgo", name: "DuckDuckGo", short: "DDG", bang: "ddg", hint: "Search privately", url: "https://duckduckgo.com/?q=%s" },
  { id: "bing", name: "Bing", short: "Bing", bang: "b", hint: "Search the web", url: "https://www.bing.com/search?q=%s" },
  { id: "youtube", name: "YouTube", short: "YouTube", bang: "yt", hint: "Search videos", url: "https://www.youtube.com/results?search_query=%s" },
  { id: "gmail", name: "Gmail", short: "Gmail", bang: "gm", hint: "Search your mail", url: "https://mail.google.com/mail/u/0/#search/%s" },
  { id: "maps", name: "Google Maps", short: "Maps", bang: "map", hint: "Find a place", url: "https://www.google.com/maps/search/%s" },
  { id: "amazon", name: "Amazon", short: "Amazon", bang: "az", hint: "Shop Amazon", url: "https://www.amazon.com/s?k=%s" },
  { id: "wayback", name: "Wayback Machine", short: "Wayback", bang: "wb", hint: "Enter a URL to see its past", url: "https://web.archive.org/web/*/%s", raw: true },
  { id: "github", name: "GitHub", short: "GitHub", bang: "gh", hint: "Search code and repos", url: "https://github.com/search?q=%s" },
  { id: "wikipedia", name: "Wikipedia", short: "Wiki", bang: "w", hint: "Look up an article", url: "https://en.wikipedia.org/w/index.php?search=%s" },
  { id: "reddit", name: "Reddit", short: "Reddit", bang: "r", hint: "Search Reddit", url: "https://www.reddit.com/search/?q=%s" },
  { id: "chatgpt", name: "ChatGPT", short: "ChatGPT", bang: "gpt", hint: "Ask ChatGPT", url: "https://chatgpt.com/?q=%s" },
  { id: "claude", name: "Claude", short: "Claude", bang: "c", hint: "Ask Claude", url: "https://claude.ai/new?q=%s" }
];

// Built-ins plus the user's own, in one lookup.
export function all(search) {
  return [...BUILTIN, ...(search.custom || [])];
}

export function byId(search, id) {
  return all(search).find((e) => e.id === id) || null;
}

// Engines the user chose to show, in the order they chose. Anything added to
// BUILTIN in a later version lands at the end and stays hidden until asked for.
export function visible(search) {
  const known = all(search);
  const seen = new Set();
  const out = [];
  for (const id of search.order || []) {
    const e = known.find((k) => k.id === id);
    if (e && !seen.has(id) && !(search.hidden || []).includes(id)) {
      seen.add(id);
      out.push(e);
    }
  }
  return out;
}

// Full ordered list for the settings checklist: chosen ones first in their
// order, then everything else.
export function ordered(search) {
  const known = all(search);
  const rank = new Map((search.order || []).map((id, i) => [id, i]));
  return known.slice().sort((a, b) => {
    const ra = rank.has(a.id) ? rank.get(a.id) : Infinity;
    const rb = rank.has(b.id) ? rank.get(b.id) : Infinity;
    return ra - rb;
  });
}

export function buildUrl(engine, query) {
  const q = engine.raw ? encodeURI(query) : encodeURIComponent(query);
  return engine.url.replace("%s", q);
}

// "!gh rust" -> { engine: GitHub, rest: "rust" }. Returns null if the text
// doesn't start with a bang that matches a known engine, so ordinary queries
// beginning with "!" still search normally.
export function resolveBang(search, text) {
  const m = /^!([^\s!]+)(?:\s+([\s\S]*))?$/.exec(text);
  if (!m) return null;
  const tag = m[1].toLowerCase();
  const engine = all(search).find((e) => (e.bang || "").toLowerCase() === tag);
  if (!engine) return null;
  return { engine, rest: m[2] || "", complete: m[2] !== undefined };
}

export function suggestBang(search, name) {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 4) || "x";
  const taken = new Set(all(search).map((e) => (e.bang || "").toLowerCase()));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 99; i++) if (!taken.has(base + i)) return base + i;
  return base + Date.now().toString(36).slice(-3);
}

export function customId(name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `x-${slug || "engine"}-${Date.now().toString(36).slice(-4)}`;
}
