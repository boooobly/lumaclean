# LumaClean — Design System

## Direction

**Quiet Architecture**: an interior editorial system combined with the precision of a professional service bureau.

The apartment journey supplies emotion. Everything after it must behave like a calm service dossier: material, light, evidence, scope and price. The system deliberately avoids SaaS cues such as decorative 3D spheres, blue gradients, universal pill shapes and card grids without hierarchy.

## Brand idea

The new mark is called **Roomline**. Two nested L-shaped paths represent:

- the outline of a room;
- movement from an outer state to an ordered inner state;
- alignment, precision and a clean finishing pass;
- the letters `L` and a subtle open `C` through negative space.

It is flat, scalable and works in one color. Teal is functional, not decorative.

## Palette

| Token | Value | Use |
| --- | --- | --- |
| Paper | `#F3F0E9` | Primary page background |
| Bright paper | `#FBFAF6` | Forms and editorial sheets |
| Ink | `#10252B` | Type, navigation, strong surfaces |
| Soft ink | `#506168` | Secondary copy |
| Stone | `#B8AA98` | Material accent, rules, photography grading |
| Chrome | `#D5D9D6` | Dividers and technical UI |
| Luma teal | `#2BA7B2` | Active state, progress and confirmed actions |

No section-sized cyan fills. No decorative blue gradients. Teal should occupy less than 5% of a typical screen.

## Typography

- Display and interface: **Onest** (300, 450, 620).
- Reading text and tables: **Golos Text** (400, 500, 600).
- Optional editorial accent after the system is stable: **Prata**, used only for selected prices or short statements.

Desktop scale:

- Hero: 112–144 px / 0.86–0.92.
- Section title: 64–88 px / 0.94.
- Chapter title: 38–52 px / 1.0.
- Card title: 20–24 px / 1.15.
- Body: 17–18 px / 1.55.
- Metadata: 11–12 px / 1.3, uppercase only for true metadata.

## Grid and rhythm

- 12 columns, maximum content width 1360 px.
- Minimum desktop gutter 40 px; mobile gutter 18 px.
- Base spacing unit 8 px.
- Section rhythm: 160–220 px desktop, 96–128 px mobile.
- Prefer asymmetric compositions: 5/7, 4/8 or 7/5 columns.
- Avoid repeating the same `heading + equal cards` structure.

## Shape rules

- Radius 0: tables, lists, editorial images and structural surfaces.
- Radius 12: controls and compact fields.
- Radius 24: one major interactive sheet or image card.
- Pills: filters, language switches and status chips only.
- Do not place every text group inside a container.

## Photography

All photography must share:

- natural side daylight;
- warm neutral white balance;
- real material texture;
- restrained contrast;
- no visible brands, text or staged cleaning-model smiles;
- no turquoise props added merely to match the brand.

Generated imagery may illustrate materials and atmosphere. It must never impersonate real customer work, reviews or employees.

## Motion

- The final kitchen frame becomes an editorial photograph on paper.
- A continuous floor-plan line connects the commercial chapters.
- Reveals use clipping and crop changes, not generic fade-up animation.
- Price changes use numeric interpolation.
- Hover motion is limited to 2–4 px shifts or underline expansion.
- No floating blobs, orbiting particles or decorative waves.

## Page chapter plan

1. Apartment journey.
2. Kitchen frame collapses into a paper dossier.
3. Cleaning type presented as one editorial comparison, not two product cards.
4. Price ledger with a sticky service/area selector.
5. Service index combining typographic rows and material photography.
6. Four-step route with one image per chapter.
7. Evidence wall using real facts and real photography.
8. Minimal FAQ.
9. Full-height contact scene with an integrated estimate sheet.

## Calculator direction

The calculator becomes an **Estimate Sheet**:

- left: service, area and extras;
- right: persistent receipt with line items and explanation;
- no decorative sphere;
- no dashboard-style tile grid;
- clear distinction between estimate and confirmed price;
- rectangular controls with a visible baseline and generous type.

## Asset plan

Project raster assets belong in `public/media/`.

Planned set:

- `material-mirror.webp`
- `material-grout.webp`
- `material-chrome.webp`
- `material-worktop.webp`
- `material-cabinet.webp`
- `material-textile.webp`
- `transition-kitchen.jpg`
- `paper-texture.webp`

Brand vectors belong in `public/brand/`.
