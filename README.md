# Ephemera

*Ephemera: printed matter never meant to be kept.*

A Chrome extension that pulls **a freshly generated print on every new tab** —
procedurally, on-device, never the same one twice. Keep the one you like at 4K;
the rest are gone the moment you close the tab.

On top of the print sits as much or as little as you want: a clock, a search bar
that knows more than one destination, pinned sites, and sticky notes you can drag
anywhere.

## The print

- **9 generative styles**, each with randomized parameters:
  Silk (flow-field threads) · Bloom (mesh gradients) · Highlands (layered ridges) ·
  Aurora (northern-lights curtains) · Facets (low-poly meshes) · Nebula (domain-warped
  gas clouds) · Conduit (truchet arcs) · Mosaic (bauhaus grids) · Topo (contour rings)
- **18 curated palettes**, picked at random per print
- **Fully seeded** — every pixel, down to the film grain, derives from one 32-bit
  seed, so the download button re-renders exactly the image on your screen at
  3840×2160 or larger
- **Change it when you want**: every tab, hourly, daily, or only when you shuffle
- **Keep the ones you like** — press the star and a print is saved as a seed, not
  an image. Kept prints appear as live thumbnails in settings and can be re-pulled
  at any size, forever.
- **Step back** through the last 20 prints you've seen, across every tab
- Each print is captioned like a gallery print — `№ 3F9A2C · SILK ON EMBER · 1/1`.
  Click the annotation to copy the seed; `?seed=3F9A2C` brings it back.

## On top of it

| | |
|---|---|
| **Clock** | 12- or 24-hour, optional seconds and date |
| **Search** | 13 built-in engines — Google, DuckDuckGo, Bing, YouTube, Gmail, Google Maps, Amazon, Wayback Machine, GitHub, Wikipedia, Reddit, ChatGPT, Claude — plus your own. Choose which appear and in what order. |
| **Bangs** | `!gh rust` searches GitHub for one query, then hands the bar back. Works for every engine, including ones hidden from the strip. |
| **Pinned sites** | Tiles with real favicons or generated monograms, drag to reorder, open with `1`–`9` |
| **Sticky notes** | Drag, resize, six colors, saved as you type |
| **Dimmer** | Scrim over the print, for when a bright one fights the text |
| **Backup** | Export settings, kept prints and notes to a JSON file, and restore them |

Everything is optional. Turn it all off and you have a wallpaper.

The UI takes its accent colour from the print it's sitting on, so it re-tints
itself every time the wallpaper changes.

## Install

1. Open `chrome://extensions` (or `brave://extensions` in Brave)
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select this folder
4. Open a new tab

## Shortcuts

| Action | Key |
|---|---|
| Pull another print | `N` |
| Step through recent prints | `←` `→` |
| Keep this print | `F` |
| New note | `Shift` `N` |
| Save the print in 4K | `D` |
| Open a pinned site | `1`–`9` |
| Jump to search | `/` or `⌘K` |
| Next engine, while searching | `Tab` |
| Settings | `,` |
| Close settings | `Esc` |

A focused note takes arrow keys to move, `Enter` to edit, `Esc` to step back out,
and `Delete` to remove.

## Privacy

No network requests, no analytics, no accounts. Prints are generated on your
machine. Settings and pins live in `chrome.storage.sync`; notes and the current
print stay in `chrome.storage.local` and never leave the device.

The `favicon` permission is only used to read icons the browser has already
cached for sites you pinned — it fetches nothing.

## Development

Plain HTML/CSS/JS (ES modules), no build step.

```
css/    base.css (tokens, wallpaper stack) · widgets.css · panel.css
js/     newtab.js (orchestration) · store.js · engines.js · wallpaper.js
js/art/         the generators — palettes, noise, post-processing, draw routines
js/widgets/     clock · search · pins · notes
js/ui/          panel · dialog · sortable · toast
tools/          package.sh (build the zip) · screenshots.mjs (store assets)
store/          listing.md — Web Store copy and permission justifications
```

To iterate on generators, serve the folder (`python3 -m http.server`) and open
`newtab.html?style=silk&seed=3F9A2C`. The `style` and `seed` query params force a
specific render; outside the extension, storage falls back to `localStorage`.

Every generator must draw only from the `rng` it is handed — that determinism is
what makes the 4K download match the screen.
