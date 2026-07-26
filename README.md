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
| **Floors** | Up to 7 independent floors, each with own image, nodes, edges, origin (0,0) top-left |
| **Project** | `.mapeditor` format · open / save / save as · auto-save |
| **Export** | Graph JSON for pathfinding backends |
| **UX** | Dark mode, dock panels, undo/redo, keyboard shortcuts |
| **Performance** | Designed for ~5 000 nodes / 10 000 edges |

When a node moves, **all connected edge distances update automatically**.

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
│   ├── components/     # UI (layout, canvas, panels)
│   ├── hooks/          # Shortcuts, autosave, menu bridge
│   ├── models/         # Domain types
│   ├── pages/          # Editor page
│   ├── services/       # Graph, project, export, history, files
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
2. **Load floor plan image** (PNG/JPG) for Floor 1
3. **Add Node** tool — click on corridors / rooms
4. Set node **type** and **label** in the properties panel
5. **Add Edge** tool — click node A, then node B
6. Distances are calculated automatically (pixel Euclidean)
7. Switch floors (1–7), repeat
8. **Save** project · **Export JSON** for the pathfinding backend

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
  "version": 1,
  "name": "Hospital A",
  "createdAt": "...",
  "updatedAt": "...",
  "activeFloorId": 1,
  "floors": [
    {
      "id": 1,
      "name": "Floor 1",
      "imageName": "floor1.png",
      "imageDataUrl": "data:image/png;base64,...",
      "imageWidth": 2400,
      "imageHeight": 1800,
      "nodes": [
        {
          "id": "n_abc123",
          "floor": 1,
          "x": 120.5,
          "y": 340.0,
          "label": "ER Waiting",
          "type": "ROOM"
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
```

Coordinates are **image pixels**, origin **(0,0) top-left**, independent per floor.

---

## Export graph JSON

```json
{
  "floors": [
    {
      "id": 1,
      "image": "floor1.png",
      "nodes": [
        {
          "id": "n_abc123",
          "floor": 1,
          "x": 120.5,
          "y": 340.0,
          "label": "ER Waiting",
          "type": "ROOM"
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
```

Feed this into your backend pathfinding service (Dijkstra / A\*).

---

## Architecture notes

- **Clean separation**: graph mutations live in `services/graphService.ts`; the Zustand store orchestrates UI state + history.
- **History**: snapshots of floors + selection for undo/redo (limit 100).
- **Auto-save**: every 30s to disk (when path known) + `localStorage` recovery snapshot.
- **Canvas**: Konva Layer transform for pan/zoom; hit-testing in world (pixel) space.

---

## License

MIT
