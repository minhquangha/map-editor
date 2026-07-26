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
| **Edges** | First-class objects: editable id, endpoints, type, weight, direction, metadata · same-floor **or cross-floor** · 8 types (Normal, Elevator, Stairs, Escalator, Bridge, Tunnel, Outdoor, Custom) |
| **Navigation** | Node **Connections** list and edge **Go to source / destination** jump across floors and buildings, IDE-style |
| **Connection Manager** | Central table of every cross-floor connection · view, edit, delete, go to either end |
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
│   │   ├── Floor 1   (image · nodes · metadata)
│   │   └── Floor 2
│   └── Building B
│       └── Floor 1
├── Edges            ← the graph layer, spans all floors and buildings
└── Metadata
```

**Floors own nodes; the project owns edges.** An edge may connect nodes on the
same floor, on different floors, or in different buildings — so it belongs to
no single floor. Floor ids are unique project-wide and node ids are unique
project-wide, which is what lets an edge address its endpoints by id alone.

### Cross-floor edges

Each floor has its own coordinate space, so a line between floors would be
meaningless. Cross-floor edges are therefore **never drawn**. Instead:

- both endpoint nodes show a compact `⇅n` badge on the canvas
- the node's **Connections** panel lists each one with its destination
  building, floor, node and edge type
- clicking a connection switches building and floor, selects the target node
  and centres the viewport on it
- `distance` is `0` for a cross-floor edge — use `weight` for routing cost

To draw one: pick the Add Edge tool, click the source node, switch floor or
building, then click the destination. The half-drawn edge survives the switch.

### Connection Manager

The toolbar's hub button opens a table of **every cross-floor connection** in
the project — name, type, source and destination (building · floor · node),
and weight. Same-floor edges are deliberately excluded; they are already
visible on the canvas.

Per row: **go to source**, **go to destination**, **delete**. Selecting a row
opens the edge in the same `EdgeProperties` editor the right-hand dock uses,
so there is one editing implementation rather than two. Selection is shared
with the canvas, and both the table and the canvas read the same store — a
change made in either place shows up in the other immediately.

The "Name" column shows `metadata.name` when the edge has one, otherwise the
edge id. Edges have no dedicated name field; the free-form metadata bag serves
that purpose without a schema change.

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
│   ├── services/       # Graph, navigation, building, project, export, history, files
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
6. **Add Edge** tool — click node A, then node B (switch floor in between for a
   cross-floor link); set type, weight and direction in the dialog
7. Same-floor distances are calculated automatically (pixel Euclidean)
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
  "version": 3,
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
          ]
        }
      ]
    }
  ],
  "edges": [
    {
      "id": "e_def456",
      "from": "n_abc123",
      "to": "n_xyz789",
      "distance": 85.42,
      "weight": 1,
      "edgeType": "NORMAL",
      "bidirectional": true,
      "metadata": {}
    }
  ],
  "metadata": {}
}
```

Coordinates are **image pixels**, origin **(0,0) top-left**, independent per floor.

`distance` is the auto-maintained pixel length (0 across floors); `weight` is
the routing cost and is only ever what you set it to.

**Version 1 and 2 files still open.** A v1 document stores floors directly on
the project; on load every floor is moved into a default building named
`Main Building`. A v1 or v2 document stores edges inside each floor; on load
they are hoisted to the project-level `edges` array and given `weight: 1`. Ids
are left untouched and nothing is dropped.

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
unique, floor ids unique across all buildings, **node ids unique project-wide**,
edge ids unique, every edge endpoint resolving to a real node, and every
building holding at least one floor. Violations are reported and the edit is
kept open.

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
          "edges": [ "…same-floor edges only, see note below…" ]
        }
      ]
    }
  ],
  "floors": [ "…every floor across every building, same objects as above…" ],
  "edges": [
    {
      "id": "e_def456",
      "from": "n_abc123",
      "to": "n_xyz789",
      "fromBuilding": 1,
      "fromFloor": 1,
      "toBuilding": 1,
      "toFloor": 2,
      "distance": 0,
      "weight": 5,
      "edgeType": "ELEVATOR",
      "bidirectional": true,
      "crossFloor": true,
      "metadata": {}
    }
  ]
}
```

Feed this into your backend pathfinding service (Dijkstra / A\*).

Three views of the same data, for compatibility:

| Key | Contents |
|-----|----------|
| `buildings` | The hierarchy. Preferred for new consumers. |
| `floors` | Flat mirror of every floor. Kept for pre-buildings consumers. |
| `edges` | **Authoritative edge list** — every edge, same-floor and cross-floor, with both endpoints resolved to a building and floor. |

> **Important for pathfinding backends:** the per-floor `edges` arrays contain
> only **same-floor** edges, because a cross-floor edge belongs to no single
> floor. Read the top-level `edges` array to get the complete graph. A backend
> that only reads `floors[].edges` will silently miss every elevator, stair and
> bridge connection between floors.

---

## Architecture notes

- **Visual layer vs graph layer.** The canvas renders exactly one floor and only ever receives edges whose endpoints both live on it (`getFloorEdges`). It cannot draw a cross-floor line because it is never handed one. The graph layer (`project.edges` + `services/navigationService.ts`) holds the complete navigation graph across every building and floor, and answers the cross-floor questions the canvas surfaces as badges.
- **Clean separation**: node mutations on a floor and edge mutations on an edge list live in `services/graphService.ts`; building and floor structure lives in `services/buildingService.ts`; cross-floor queries live in `services/navigationService.ts`; document concerns (create / clone / serialize / parse / migrate) live in `services/projectService.ts`. The Zustand store orchestrates UI state + history.
- **Layering**: `buildingService` knows nothing about the project document, and `graphService` knows nothing about buildings or the project — edge operations take an `EdgeEndpointLocator` callback so they stay project-agnostic. `projectService` is the only module that wires them together.
- **History**: snapshots of buildings + edges + active building/floor + selection for undo/redo (limit 100).
- **Cascade integrity**: deleting a node, floor or building removes every edge that reached into it, from anywhere in the project — one filter over the project edge list rather than a scan of every floor.
- **Auto-save**: every 30s to disk (when path known) + `localStorage` recovery snapshot.
- **Canvas**: Konva Layer transform for pan/zoom; hit-testing in world (pixel) space.

---

## License

MIT
