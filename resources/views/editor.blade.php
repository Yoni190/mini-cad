<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mini CAD Editor</title>
    <meta name="csrf-token" content="{{ csrf_token() }}">
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="cad-editor">
    <header class="editor-header">
        <div class="editor-brand">
            <span class="brand-mark" aria-hidden="true">⌑</span>
            <div><h1>Mini CAD Editor</h1><p>Engineering workspace</p></div>
        </div>
        <div class="project-controls" role="group" aria-label="Project controls">
            <div class="field project-name">
                <label for="projectName">Project name</label>
                <input type="text" id="projectName" placeholder="e.g. Ground Floor" maxlength="255">
            </div>
            <button type="button" id="saveProject" class="button-primary" title="Save project">Save</button>
            <button type="button" id="newProject" title="Create a new project">New Project</button>
            <div class="field project-list">
                <label for="projectList">Saved projects</label>
                <select id="projectList"><option value="">Select a project</option></select>
            </div>
            <button type="button" id="loadProject" title="Load selected project">Load</button>
        </div>
        <div class="view-toggle" role="group" aria-label="Drawing view">
            <button type="button" id="show2D" aria-pressed="true" title="Switch to 2D">2D</button>
            <button type="button" id="show3D" aria-pressed="false" title="Switch to 3D">3D</button>
        </div>
        <div class="account-controls">
            <span class="user-name" title="{{ auth()->user()->name }}"><span class="visually-hidden">Logged in as </span>{{ auth()->user()->name }}</span>
            <form method="POST" action="{{ route('logout') }}">
                @csrf
                <button type="submit" class="button-quiet">Logout</button>
            </form>
        </div>
    </header>

    <div class="project-status"><p id="saveStatus" role="status" aria-live="polite" aria-atomic="true">Ready. Open a project or start drawing.</p></div>

    <div class="editor-layout">
        <aside class="tool-panel" aria-label="Drawing tools">
            <h2 class="panel-label">Tools</h2>
            <!-- Retain the original selector as the source of tool changes and editing locks. -->
            <label for="drawingTool" class="visually-hidden">Drawing tool</label>
            <select id="drawingTool" hidden>
                <option value="wall">Wall</option>
                <option value="column">Column</option>
                <option value="select">Select</option>
            </select>
            <div class="tool-group" role="group" aria-label="Draw">
                <p class="group-label">Draw</p>
                <button type="button" class="tool-button" data-tool="wall" aria-pressed="true" title="Wall">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM4 12h16M12 5v7M8 12v7M16 12v7"/></svg>
                    <span>Wall</span>
                </button>
                <button type="button" class="tool-button" data-tool="column" aria-pressed="false" title="Column">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v3H6zM8 7v10M16 7v10M6 17h12v3H6z"/></svg>
                    <span>Column</span>
                </button>
            </div>
            <div class="tool-group" role="group" aria-label="Edit">
                <p class="group-label">Edit</p>
                <button type="button" class="tool-button" data-tool="select" aria-pressed="false" title="Select">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 3 14 10-7 1-3 7z"/></svg>
                    <span>Select</span>
                </button>
            </div>
            <p class="tool-note">Dimensions in mm</p>
        </aside>

        <main class="drawing-workspace" aria-label="Drawing workspace">
            <div class="workspace-heading">
                <h2 id="viewHeading">2D drawing</h2>
                <span>Units: mm <span aria-hidden="true">·</span> Grid: 1000 mm</span>
            </div>
            <div class="canvas-viewport" tabindex="0" role="region" aria-label="Drawing viewport. Scroll to access the full drawing area on smaller screens.">
                <!-- Keep both drawing surfaces at their original dimensions; scroll instead of scaling. -->
                <div id="twoContainer">
                    <canvas id="cadCanvas" width="1000" height="600" aria-label="2D drawing canvas" aria-describedby="activeToolHelp">Your browser must support HTML Canvas to use the drawing editor.</canvas>
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
            <section class="property-section" id="wallProperties">
                <h3>Wall length</h3>
                <p class="field-help" id="wallLengthHelp">Click a start point and move the mouse to set a direction. Enter a length to create the wall.</p>
                <label for="wallLength">Length (mm)</label>
                <input type="number" id="wallLength" min="1" placeholder="e.g. 4000" aria-describedby="wallLengthHelp">
                <button id="applyWallLength" type="button">Create Wall</button>
            </section>
            <section class="property-section" id="columnProperties" hidden>
                <h3>Column dimensions</h3>
                <p class="field-help" id="columnDimensionsHelp">Select a column in the drawing to edit its dimensions.</p>
                <label for="columnWidth">Width (mm)</label>
                <input type="number" id="columnWidth" min="1" aria-describedby="columnDimensionsHelp">
                <label for="columnDepth">Depth (mm)</label>
                <input type="number" id="columnDepth" min="1" aria-describedby="columnDimensionsHelp">
                <button type="button" id="updateColumn">Update Dimensions</button>
            </section>
            <section class="property-section" id="columnPlacementHelp" hidden>
                <h3>Place columns</h3>
                <p class="field-help">Click in the drawing to place a column with default dimensions. Use Select to move it or change its width and depth.</p>
            </section>
            <div class="properties-tip"><strong>Drawing tips</strong><p>Wall endpoints snap automatically. Choose Select to inspect an element; press Delete or Backspace to remove it.</p></div>
        </aside>
    </div>
</body>
</html>
