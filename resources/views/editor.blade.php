<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mini CAD Editor</title>
    <meta name="csrf-token" content="{{ csrf_token() }}">
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="cad-editor" data-authenticated="{{ auth()->check() ? 'true' : 'false' }}">
    <header class="editor-header">
        <a href="{{ route('projects.index') }}" class="editor-brand" aria-label="Back to projects" title="Back to projects">
            <span class="brand-mark" aria-hidden="true">⌑</span>
        </a>
        <div class="project-controls" role="group" aria-label="Project controls">
            <div class="field project-name">
                <label for="projectName" class="visually-hidden">Project name</label>
                <input type="text" id="projectName" value="{{ isset($project) ? $project->name : 'Untitled Project' }}" placeholder="Untitled Project" maxlength="255" title="Click to rename project">
            </div>
            <div class="save-controls">
                <p id="changesStatus" data-unsaved="false" role="status" aria-live="polite">Saved.</p>
                <button type="button" id="saveProject" class="button-primary" title="Save project">Save</button>
            </div>
        </div>
        <div class="view-toggle" role="group" aria-label="Drawing view">
            <button type="button" id="show2D" aria-pressed="true" title="Switch to 2D">2D</button>
            <button type="button" id="show3D" aria-pressed="false" title="Switch to 3D">3D</button>
            <button type="button" id="showSplit" aria-pressed="false" title="Show 2D and 3D side by side">Split</button>
        </div>
        <div class="account-controls">
            @auth
                <span class="user-name"
                    title="{{ auth()->user()->name }}">
                    {{ auth()->user()->name }}
                </span>

                <form method="POST" action="{{ route('logout') }}">
                    @csrf
                    <button type="submit" class="button-quiet">
                        Logout
                    </button>
                </form>
            @else
                <a href="{{ route('login') }}" class="button-quiet landing-link">
                    Login
                </a>

                <a href="{{ route('register') }}" class="button-primary project-create">
                    Sign Up
                </a>
            @endauth
        </div>
    </header>

    <nav class="editor-tabs" aria-label="Editor navigation">
        <details class="file-menu">
            <summary>
                File 
                <svg class="pi" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
                    <path d="m6 9 6 6 6-6"></path>
                </svg>
            </summary>
            <div class="file-menu-items">
                <button type="button" id="newProject">New Project</button>
            </div>
        </details>
        <a href="#drawing-workspace" aria-current="page">Home</a>
    </nav>

    <div class="project-status">
        <p id="saveStatus" role="status"
        aria-live="polite" aria-atomic="true">
            Ready. Open a project or start drawing.
        </p>

    </div>

    <div class="editor-layout">
        <aside class="tool-panel" aria-label="Drawing tools">
            <h2 class="panel-label">Tools</h2>
            <!-- Retain the original selector as the source of tool changes and editing locks. -->
            <label for="drawingTool" class="visually-hidden">Drawing tool</label>
            <select id="drawingTool" hidden>
                <option value="wall">Wall</option>
                <option value="door">Door</option>
                <option value="window">Window</option>
                <option value="column">Column</option>
                <option value="select">Select</option>
                <option value="measure">Measure</option>
            </select>
            <div class="tool-group" role="group" aria-label="Draw">
                <p class="group-label">Draw</p>
                <button type="button" class="tool-button" data-tool="wall" aria-pressed="true" aria-keyshortcuts="W">
                    <x-icons.wall />
                    <span>Wall</span>
                    <span class="tool-tooltip" aria-hidden="true">Draw wall <kbd>W</kbd></span>
                </button>
                <button type="button" class="tool-button" data-tool="door" aria-pressed="false" aria-keyshortcuts="D">
                    <x-icons.door />
                    <span>Door</span>
                    <span class="tool-tooltip" aria-hidden="true">Place door <kbd>D</kbd></span>
                </button>
                <button type="button" class="tool-button" data-tool="window" aria-pressed="false">
                    <x-icons.window />
                    <span>Window</span>
                    <span class="tool-tooltip" aria-hidden="true">Place window</span>
                </button>
                <button type="button" class="tool-button" data-tool="column" aria-pressed="false" aria-keyshortcuts="C">
                    <x-icons.column />
                    <span>Column</span>
                    <span class="tool-tooltip" aria-hidden="true">Place column <kbd>C</kbd></span>
                </button>
            </div>
            <div class="tool-group" role="group" aria-label="Edit">
                <p class="group-label">Edit</p>
                <button type="button" class="tool-button" data-tool="select" aria-pressed="false" aria-keyshortcuts="S">
                    <x-icons.select />
                    <span>Select</span>
                    <span class="tool-tooltip" aria-hidden="true">Select / move <kbd>S</kbd></span>
                </button>
            </div>
            <button type="button"
                    class="tool-button"
                    data-tool="measure"
                    aria-pressed="false"
                    aria-keyshortcuts="M">

                <x-icons.measure />

                <span>Measure</span>
                <span class="tool-tooltip" aria-hidden="true">
                    Measure distance <kbd>M</kbd>
                </span>
            </button>
            <p class="tool-note">Dimensions in mm</p>
        </aside>

        <main id="drawing-workspace" class="drawing-workspace" aria-label="Drawing workspace">
            <div class="workspace-heading">
                <h2 id="viewHeading">2D drawing</h2>
                <span>Units: mm <span aria-hidden="true">·</span> Grid: 1000 mm</span>
            </div>
            <div class="canvas-viewport" tabindex="0" role="region" aria-label="Drawing viewport. Scroll to access the full drawing area on smaller screens.">
                <!-- Keep both drawing surfaces at their original dimensions; scroll instead of scaling. -->
                <div id="twoContainer">
                    <canvas id="cadCanvas" width="1000" height="600" aria-label="2D drawing canvas" aria-describedby="activeToolHelp">Your browser must support HTML Canvas to use the drawing editor.</canvas>
                    <canvas id="previewCanvas" width="1000" height="600"
                        aria-hidden="true"></canvas>
                </div>
                <div id="threeContainer" style="display: none;" aria-label="3D model viewer"></div>
            </div>
            <footer class="workspace-help">
                <p id="activeToolHelp" role="status" aria-live="polite">Wall: Click a start point, then an end point.</p>
                <p id="navigationHelp">Scroll to zoom · Middle-drag to pan · Esc to cancel</p>
            </footer>
        </main>

        <aside class="properties-panel" aria-label="Tool properties">
            <h2 class="panel-label">Properties</h2>
            <section class="property-section" id="doorProperties" hidden>
                <h3>New door</h3>

                <label for="doorWidth">Width (mm)</label>
                <input type="number" id="doorWidth" min="1" value="900" required>

                <label for="doorHeight">Height (mm)</label>
                <input type="number" id="doorHeight" min="1" value="2100" required>

                <p class="field-help">Click a wall to place the door.</p>
            </section>
            <section class="property-section" id="windowProperties" hidden>
                <h3>New window</h3>

                <label for="windowWidth">Width (mm)</label>
                <input type="number" id="windowWidth" min="1" value="1200" required>

                <label for="windowHeight">Height (mm)</label>
                <input type="number" id="windowHeight" min="1" value="1200" required>

                <label for="windowSillHeight">Sill height (mm)</label>
                <input type="number" id="windowSillHeight" min="0" value="900" required>

                <p class="field-help">Click a wall to place the window.</p>
            </section>
            <section class="property-section" id="wallProperties">
                <h3>New wall</h3>
                <label for="newWallThickness">Thickness (mm)</label>
                <input type="number" id="newWallThickness" min="0.001" step="any" value="200" required>
                <p class="field-help" id="wallLengthHelp">Click a start point and move the mouse to set a direction. Enter a length to create the wall.</p>
                <button
                    type="button"
                    id="toggleOrtho"
                    aria-pressed="false"
                    title="Toggle horizontal/vertical walls (O)"
                >
                    Ortho: Off
                </button>
                <label for="wallLength">Length (mm)</label>
                <input type="number" id="wallLength" min="1" placeholder="e.g. 4000" aria-describedby="wallLengthHelp">
                <button id="applyWallLength" type="button">Create Wall</button>
            </section>
            <section class="property-section" id="wallThicknessProperties" hidden>
                <h3>Wall dimensions</h3>
                <label for="wallDoors">Openings on this wall</label>
                <select id="wallDoors"></select>
                <button type="button" id="removeWallDoor">Remove selected opening</button>
                <p class="field-help">Choose Select and click a wall to edit it.</p>

                <label for="wallThickness">Thickness (mm)</label>
                <input type="number" id="wallThickness" min="0" step="any">

                <button type="button" id="updateWallThickness">
                    Update Thickness
                </button>
                <label for="wallHeight">Height (mm)</label>
                <input type="number" id="wallHeight" min="0.001" step="any">
                <button type="button" id="updateWallHeight">Update Height</button>
            </section>
            <section class="property-section" id="columnProperties" hidden>
                <h3>Column dimensions</h3>
                <p class="field-help" id="columnDimensionsHelp">Select a column in the drawing to edit its dimensions.</p>
                <label for="columnWidth">Width (mm)</label>
                <input type="number" id="columnWidth" min="1" aria-describedby="columnDimensionsHelp">
                <label for="columnDepth">Depth (mm)</label>
                <input type="number" id="columnDepth" min="1" aria-describedby="columnDimensionsHelp">
                <label for="columnHeight">Height (mm)</label>
                <input type="number" id="columnHeight" min="0.001" step="any" aria-describedby="columnDimensionsHelp">
                <button type="button" id="updateColumn">Update Dimensions</button>
            </section>
            <section class="property-section" id="columnPlacementHelp" hidden>
                <h3>Place columns</h3>
                <p class="field-help">Click in the drawing to place a column with default dimensions. Use Select to move it or change its width and depth.</p>
            </section>
            <div class="properties-tip"><strong>Drawing tips</strong><p>Wall endpoints snap automatically. Choose Select to inspect an element; press Delete or Backspace to remove it.</p></div>
        </aside>
    </div>
    @isset($project)
        @php($initialProject = $project->only(['id', 'name', 'elements', 'version']))
        <script id="initialProject" type="application/json">@json($initialProject)</script>
    @endisset
</body>
</html>
