# Another New Tab

A Chrome extension that paints a **freshly generated wallpaper on every new tab** — procedurally, on-device, never the same one twice. Any wallpaper you like can be downloaded in 4K.

## Features

- **9 generative art styles**, each with randomized parameters:
  - **Silk** — glowing flow-field threads
  - **Bloom** — soft mesh-gradient color fields
  - **Highlands** — layered mountain ridges at dusk or under a starry night
  - **Aurora** — northern-lights curtains over a dark landscape
  - **Facets** — low-poly triangle meshes
  - **Nebula** — domain-warped gas clouds and starfields
  - **Conduit** — truchet arc tile patterns
  - **Mosaic** — bold bauhaus-style shape grids
  - **Topo** — concentric contour-line rings
- **18 curated color palettes**, picked at random per wallpaper
- **4K download** — every wallpaper is seeded, so the download button re-renders the exact image you're looking at at 3840×2160+
- **Optional search bar** (off by default) with Google, YouTube, or DuckDuckGo
- Style picker: keep it on "Surprise me" or lock to a favorite style
- No network requests, no tracking — everything renders locally

## Install

1. Open `chrome://extensions` (or `brave://extensions` in Brave)
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select this folder
4. Open a new tab

## Usage

| Action | How |
|---|---|
| New wallpaper | shuffle button (bottom right) or press `N` |
| Download in 4K | download button or press `D` |
| Toggle search bar / engine / style | gear button |
| Focus the search bar | press `/` |

## Development

Plain HTML/CSS/JS (ES modules), no build step. To preview outside the
extension, serve the folder (`python3 -m http.server`) and open
`newtab.html?style=silk&seed=42` — the `style`, `seed`, and `search` query
params force a specific render, which is handy for iterating on generators
in `js/art/generators.js`.
