# Map Editor

Professional Windows desktop application for digitizing **hospital floor plan images** into **graph data** (nodes + edges) for backend Dijkstra / A\* pathfinding.

This is **not** an indoor navigation client. Its only job is to produce clean graph JSON from floor plan images.

---

## Features

| Area | Capabilities |
|------|----------------|
| **Image** | Open PNG/JPG floor plans as canvas background |
| **Canvas** | Infinite canvas, zoom (wheel / Ctrl+wheel), pan (middle mouse, Space, Pan tool), fit to screen |
| **Nodes** | Create, move, delete, rename, multi-select · types: NORMAL, ROOM, ELEVATOR, STAIR, ENTRANCE, EXIT |
| **Edges** | Connect two nodes · Euclidean distance · NORMAL / STAIR / ELEVATOR · bi-directional or one-way |
| **Buildings** | Unlimited buildings — add, rename, describe, duplicate, delete, reorder |
| **Floors** | Unlimited floors per building — add, rename, delete, reorder · each with own image, nodes, edges, origin (0,0) top-left |
| **Project** | `.mapeditor` format · open / save / save as · auto-save |
| **JSON editor** | Edit the whole project document in-app · syntax validation, error jump, format, apply / cancel |
| **Export** | Graph JSON for pathfinding backends |
| **UX** | Dark mode, dock panels, undo/redo, keyboard shortcuts |
| **Performance** | Designed for ~5 000 nodes / 10 000 edges |

When a node moves, **all connected edge distances update automatically**.

Project hierarchy:

```
Project
├── Buildings
│   ├── Building A
│   │   ├── Floor 1   (image · nodes · edges · metadata)
│   │   └── Floor 2
│   └── Building B
│       └── Floor 1
└── Metadata
```

Nodes and edges are scoped to a floor. Floor ids are unique across the whole
project, so a floor is addressable on its own regardless of which building
owns it.

---

## Tech stack

- **Electron** — desktop shell
- **React 18 + TypeScript** — UI
- **Vite** — bundler / HMR
- **React Konva** — canvas editor
- **Material UI** — chrome / panels
- **Zustand** — state
- **Electron Builder** — Windows NSIS installer

---

## Project structure

```
map_editor/
├── electron/           # Main process + preload (IPC)
├── src/
│   ├── components/     # UI (layout, canvas, panels, JSON editor)
│   ├── hooks/          # Shortcuts, autosave, menu bridge
│   ├── models/         # Domain types
│   ├── pages/          # Editor page
│   ├── services/       # Graph, building, project, export, history, files
│   ├── store/          # Zustand store
│   ├── theme/          # MUI dark theme
│   └── utils/          # Geometry, ids, constants
├── package.json
├── vite.config.ts
└── README.md
```

Business logic lives in `services/` and `store/`. UI components stay presentation-focused.

---

## Prerequisites

- **Node.js** 18+ (recommended 20+)
- **Windows** 10/11 (for EXE packaging)
- npm 9+

---

## Install

```bash
npm install
```

---

## Development

```bash
npm run dev
```

Starts Vite + Electron with hot reload. The app window opens automatically.

---

## Production build (Windows EXE)

```bash
npm run electron:build
```

Outputs an NSIS installer under:

```
release/Map Editor-Setup-1.0.0.exe
```

Unpackaged app directory only:

```bash
npm run electron:build:dir
```

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Dev mode (Vite + Electron) |
| `npm run build` | Typecheck + build renderer & electron |
| `npm run electron:build` | Full Windows installer |
| `npm run electron:build:dir` | Unpackaged win build |
| `npm run typecheck` | TypeScript only |

---

## Workflow

1. **New project** (or open `.mapeditor`)
2. Add **buildings** in the left panel; each starts with one floor
3. **Load floor plan image** (PNG/JPG) for the selected floor
4. **Add Node** tool — click on corridors / rooms
5. Set node **type** and **label** in the properties panel
6. **Add Edge** tool — click node A, then node B
7. Distances are calculated automatically (pixel Euclidean)
8. Add / switch floors and buildings in the left panel, repeat
9. **Save** project · **Export JSON** for the pathfinding backend

---

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `V` | Pointer tool |
| `H` | Pan tool |
| `N` | Add node |
| `E` | Add edge |
| `D` | Delete tool |
| `Space` (hold) | Temporary pan |
| `Delete` | Delete selection |
| `Ctrl+S` | Save |
| `Ctrl+Shift+S` | Save as |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo |
| `Ctrl+O` | Open project |
| `Ctrl+N` | New project |
| `Ctrl+I` | Open floor image |
| `Ctrl+E` | Export JSON |
| `Ctrl+A` | Select all |
| `Ctrl+0` | Fit to screen |
| `Ctrl+=` / `Ctrl+-` | Zoom in / out |
| `Esc` | Clear selection / cancel edge |

---

## Project file format (`.mapeditor`)

Custom JSON document embedding floor images as data URLs:

```json
{
  "version": 2,
  "name": "Hospital A",
  "createdAt": "...",
  "updatedAt": "...",
  "activeBuildingId": 1,
  "activeFloorId": 1,
  "buildings": [
    {
      "id": 1,
      "name": "Main Building",
      "description": "Outpatient wing",
      "metadata": {},
      "floors": [
        {
          "id": 1,
          "name": "Floor 1",
          "imageName": "floor1.png",
          "imageDataUrl": "data:image/png;base64,...",
          "imageWidth": 2400,
          "imageHeight": 1800,
          "metadata": {},
          "nodes": [
            {
              "id": "n_abc123",
              "floor": 1,
              "x": 120.5,
              "y": 340.0,
              "label": "ER Waiting",
              "type": "ROOM",
              "room_type": "Emergency",
              "properties": { "capacity": 12 },
              "propertySchema": { "capacity": { "type": "number" } }
            }
          ],
          "edges": [
            {
              "id": "e_def456",
              "from": "n_abc123",
              "to": "n_xyz789",
              "distance": 85.42,
              "edgeType": "NORMAL",
              "bidirectional": true
            }
          ]
        }
      ]
    }
  ],
  "metadata": {}
}
```

Coordinates are **image pixels**, origin **(0,0) top-left**, independent per floor.

**Version 1 files still open.** A v1 document stores floors directly on the
project; on load every floor is moved into a default building named
`Main Building`, ids are left untouched, and nothing is dropped.

**Unknown fields are preserved.** Any key the editor does not recognise — on
the project, a building, a floor, a node or an edge — round-trips through
save / load and through the JSON editor untouched.

---

## Project JSON editor

The toolbar's `{ }` button opens the whole project document for editing.

- Live syntax validation with line/column reporting and **Jump to error**
- **Format** re-indents the document
- **Apply Changes** replaces the project; **Cancel** discards
- Invalid JSON can never be applied, so the open project is never corrupted
- Applying pushes an undo entry — `Ctrl+Z` steps back out of a JSON edit

Beyond syntax, the document must satisfy the project invariants: building ids
unique, floor ids unique across all buildings, and every building holding at
least one floor. Violations are reported and the edit is kept open.

---

## Export graph JSON

```json
{
  "buildings": [
    {
      "id": 1,
      "name": "Main Building",
      "description": "Outpatient wing",
      "floors": [
        {
          "id": 1,
          "building": 1,
          "image": "floor1.png",
          "nodes": [
            {
              "id": "n_abc123",
              "building": 1,
              "floor": 1,
              "x": 120.5,
              "y": 340.0,
              "label": "ER Waiting",
              "type": "ROOM",
              "room_type": "Emergency",
              "properties": { "capacity": 12 }
            }
          ],
          "edges": [
            {
              "from": "n_abc123",
              "to": "n_xyz789",
              "distance": 85.42,
              "edgeType": "NORMAL",
              "bidirectional": true
            }
          ]
        }
      ]
    }
  ],
  "floors": [ "…every floor across every building, same objects as above…" ]
}
```

Feed this into your backend pathfinding service (Dijkstra / A\*).

The top-level `floors` array is a **flat mirror** of every floor in the
project, kept so consumers written against the previous single-building export
keep working unchanged. Floor ids are unique project-wide, so the flat view is
never ambiguous. New consumers should read `buildings` and can ignore `floors`.

---

## Architecture notes

- **Clean separation**: graph mutations (nodes/edges on a floor) live in `services/graphService.ts`; building and floor structure lives in `services/buildingService.ts`; document concerns (create / clone / serialize / parse / migrate) live in `services/projectService.ts`. The Zustand store orchestrates UI state + history.
- **Layering**: `buildingService` knows nothing about the project document, and `graphService` knows nothing about buildings — so a floor's graph logic is untouched by the hierarchy above it.
- **History**: snapshots of buildings + active building/floor + selection for undo/redo (limit 100).
- **Auto-save**: every 30s to disk (when path known) + `localStorage` recovery snapshot.
- **Canvas**: Konva Layer transform for pan/zoom; hit-testing in world (pixel) space.

---

## License

MIT
