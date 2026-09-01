# labmed-web — The Core Stack

Product-placement website for the **dAIgnostics Core Stack** — an interactive,
responsive single page presenting the four platform layers:

| Layer | Role |
|---|---|
| dAI Clarity | Objašnjivo izvještavanje prema kliničarima (audit-ready output) |
| dAI Inference Engine | Verzionirani analitički tijekovi rada (CWL) s Model-Agnostic učitačem |
| dAI DataHub | Upravljana baza podataka s punom sljedivošću (provenance) |
| dAI Edge | Sigurna ingestija i lokalna harmonizacija (sovereignty layer) |

## Stack

Vanilla HTML + CSS + JS — no frameworks, no build step.

- `index.html` — single page, Croatian content (`lang="hr"`)
- `css/style.css` — brand tokens from daignostics.info (red `#E21E3A` / `#BB1930`,
  ink `#302D2D`, Inter + self-hosted Adarsh Sans), isometric 3D scene, responsive
  breakpoints (360 px → wide desktop), `prefers-reduced-motion` support
- `js/main.js` — interaction state machine (hover / click / touch / keyboard),
  SVG leader lines, entrance choreography, hover self-reconciliation
- `assets/` — official dAIgnostics SVG logos, favicon, Adarsh Sans font

## The isometric stack

The centerpiece is a real CSS-3D scene: `rotateX(55deg) rotateZ(45deg)` with
`preserve-3d` and **no** perspective (parallel projection, like the reference
diagram). Each layer is a native `<button>` with three faces (top / south /
east). Hovering (desktop) previews a layer; click / tap / Enter pins it and
opens its feature panel. Dotted SVG leader lines connect each layer's right
vertex to its card on ≥1024 px viewports.

⚠️ Do not set `opacity`, `filter`, `clip-path`, `mask`, `contain` or
non-visible `overflow` on `.scene`, the slab wrappers, or any of their
ancestors — each silently flattens the 3D stack (see the FLATTENING RULES
comment block in `style.css`).

## Run

Static files — any web server works:

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## Notes

- CTA links (`mailto:info@daignostics.info`) are placeholders — point them at
  the real demo-request channel.
- The Inference Engine caption uses **„verzioniranih"** (versioned); the source
  diagram said „verziranih", which means *well-versed* in Croatian.
