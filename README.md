# Mini CAD Editor

A browser-based architectural CAD prototype built with **Laravel 12**, **JavaScript (ES6+)**, the **HTML Canvas API**, and **Three.js**. Users can create and edit simple wall and column layouts in 2D, inspect the same elements in 3D, and save or reopen projects associated with their accounts.

## Features

- **2D drafting:** Draw walls using two points or a specified numeric length; create columns with editable width and depth.
- **Interaction:** Select and delete walls and columns, move columns, and use wall-endpoint snapping. A measurement grid, mouse-wheel zoom, and viewport panning support navigation.
- **Wall geometry:** Calculates wall lengths, thickness-based footprints, and a limited L-shaped endpoint junction. The original wall reference endpoints and measured lengths remain unchanged.
- **3D visualization:** Switch between 2D and 3D. Three.js uses a perspective camera and OrbitControls; columns are rendered as boxes, while wall footprints are extruded to preserve the supported 2D junction geometry.
- **User accounts:** Register, log in, and log out using Laravel session authentication.
- **Project persistence:** Create, list, save, update, and load projects. Projects are stored as validated JSON and scoped to their authenticated owners.
- **Automated tests:** Laravel feature tests and JavaScript geometry tests.

## Tech stack

| Area | Technology |
| --- | --- |
| Backend | PHP 8.2+, Laravel 12 |
| Database | MySQL (configured in `.env.example`) |
| Frontend | JavaScript ES6+, Blade, HTML Canvas API |
| 3D | Three.js (`ExtrudeGeometry`, `BoxGeometry`, `OrbitControls`) |
| Build | Vite 7 |
| Tests | PHPUnit, Vitest |

## Getting started

### Prerequisites

- PHP 8.2+ and Composer
- Node.js and npm compatible with Vite 7
- MySQL server

### Installation

1. Clone the repository and enter its directory:

   ```bash
   git clone <repository-url>
   cd mini-cad
   ```

2. Install PHP and JavaScript dependencies:

   ```bash
   composer install
   npm install
   ```

3. Create and configure your environment file:

   ```bash
   cp .env.example .env
   php artisan key:generate
   ```

4. Create a MySQL database (for example, `mini_cad`). Update the corresponding values in `.env`:

   ```dotenv
   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=mini_cad
   DB_USERNAME=root
   DB_PASSWORD=
   ```

   Use credentials appropriate for your local MySQL installation. Because the project uses database-backed sessions and cache, run all migrations before starting the application.

5. Run migrations:

   ```bash
   php artisan migrate
   ```

6. Start the Laravel server and Vite development server in separate terminals:

   ```bash
   php artisan serve
   ```

   ```bash
   npm run dev
   ```

7. Open `http://127.0.0.1:8000`, register an account, and open the editor.

For a frontend production build, run:

```bash
npm run build
```

## Using the editor

1. **Draw walls:** Choose the Wall tool and click two points on the 2D canvas. Alternatively, choose a starting point and direction, enter a wall length in millimeters, and create the wall using the numeric control.
2. **Add columns:** Choose the Column tool and click a position. Select a column to edit its width and depth, or move it by dragging.
3. **Select and delete:** Choose Select, click an element, and use Delete/Backspace to remove it.
4. **Navigate:** Use the grid as a visual reference, the mouse wheel to zoom, and middle-mouse dragging to pan.
5. **Switch views:** Use the 2D and 3D buttons. In 3D, OrbitControls supports camera rotation, zoom, and pan.
6. **Save and load:** Enter a project name and select Save Project. Use the saved-project selector to load existing work. Subsequent saves update the currently opened project; New Project resets the current working drawing.

All CAD dimensions are stored in **millimeters**. The 2D canvas uses a configurable pixel scale, and the 3D viewer converts **1,000 mm to 1 Three.js unit (1 meter)**.

## Architecture

The editor maintains one collection of `Wall` and `Column` model instances in `DrawingEngine.elements`. The 2D and 3D views render from that collection rather than maintaining separate copies of the CAD model.

| File / component | Responsibility |
| --- | --- |
| `resources/js/cad/models/Wall.js` | Wall data, measured length, and footprint access |
| `resources/js/cad/models/Column.js` | Column position and dimensions |
| `resources/js/cad/models/DrawingElement.js` | Common element identity and type |
| `GeometryService.js` | Wall/column corners, numeric endpoints, connections, and limited junction geometry |
| `DrawingEngine.js` | Element collection, element mutations, and resolved wall display geometry |
| `CanvasRenderer.js` | 2D polygons, measurements, grid, and world/screen transforms |
| `EditorController.js` | Mouse/keyboard drawing, selection, zoom, pan, and edit interactions |
| `SelectionManager.js` | Element hit testing and selection state |
| `SnapManager.js` | Nearby wall-endpoint snapping |
| `ThreeViewer.js` | Three.js scene, camera, controls, and 3D meshes |
| `ProjectService.js` | Frontend HTTP requests for project persistence |
| `app/Http/Controllers/ProjectController.php` | Authenticated project listing, creation, retrieval, and updates |
| `app/Http/Requests/SaveProjectRequest.php` | Server-side project and geometry validation |
| `app/Http/Controllers/AuthController.php` | Registration, login, and logout |

### Project data and security

A project belongs to one user and contains a name and JSON array of drawing elements. The backend validates supported element types, UUIDs, numeric geometry, positive dimensions, and wall endpoint constraints. Project queries are scoped through the authenticated user's `projects()` relationship so another user's project cannot be retrieved or updated through these endpoints.

Saved JSON is reconstructed into actual `Wall` and `Column` class instances when loaded, preserving element IDs and methods such as `getGeometry()`.

## Testing

Run backend tests:

```bash
php artisan test
```

Run JavaScript tests:

```bash
npm test
```

The most recently reported results during development were **6 passing Laravel feature tests** and **14 passing JavaScript tests**. The backend tests cover ownership, empty projects, invalid wall dimensions/endpoints, and updates. The JavaScript tests cover lengths, corners, connection tolerances, L-junction calculations, snapping, and column validation.

For a final handoff, rerun the tests and `npm run build` after any code changes. Automated tests do not replace a browser-based check of the full editing and save/load workflow.

## Current limitations

- Wall joining is a **limited prototype** supporting specific endpoint configurations; it is not a general-purpose solver for T-junctions, complex multi-wall intersections, or every drawing direction.
- The 3D viewer extrudes the currently resolved 2D wall footprints; unsupported junction configurations remain unsupported in both views.
- The application focuses on simple walls and columns and does not implement a full CAD/BIM feature set, such as doors, windows, parametric building components, or collaborative editing.
- The current frontend does not offer a full revision history or conflict resolution for concurrent edits.