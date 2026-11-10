<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mini CAD Editor</title>
    <meta name="csrf-token" content="{{ csrf_token() }}">
    @vite(['resources/js/app.js'])
</head>
<body>
    <h2>Mini CAD Editor</h2>
    <div>
        <p>
            Logged in as:
            <strong>{{ auth()->user()->name }}</strong>
        </p>

        <form method="POST" action="{{ route('logout') }}">
            @csrf

            <button type="submit">Logout</button>
        </form>
    </div>

    <hr>

    <div>
        <label for="wallLength">Wall Length (mm)</label>

        <input
            type="number"
            id="wallLength"
            min="1"
            placeholder="e.g. 4000"
        >

        <button id="applyWallLength" type="button">
            Create Wall
        </button>
    </div>

    <div>
        <label for="drawingTool">Drawing Tool: </label>

        <select id="drawingTool">
            <option value="wall">Wall</option>
            <option value="column">Column</option>
            <option value="select">Select</option>
        </select>
    </div>

    <div id="columnProperties">
        <label for="columnWidth">Width (mm)</label>
        <input type="number" id="columnWidth" min="1">

        <label for="columnDepth">Depth (mm)</label>
        <input type="number" id="columnDepth" min="1">

        <button type="button" id="updateColumn">
            Update Dimensions
        </button>
    </div>

    <div>
        <label for="projectName">Project Name</label>

        <input
            type="text"
            id="projectName"
            placeholder="e.g. Ground Floor"
            maxlength="255"
        >

        <button type="button" id="saveProject">
            Save Project
        </button>

        <p id="saveStatus"></p>
    </div>

    <div>
        <label for="projectList">Saved Projects</label>

        <select id="projectList">
            <option value="">Select a project</option>
        </select>

        <button type="button" id="loadProject">
            Load Project
        </button>
    </div>

    <button type="button" id="newProject">
        New Project
    </button>

    <div>
        <button type="button" id="show2D">2D View</button>
        <button type="button" id="show3D">3D View</button>
    </div>

    <div id="twoContainer">
        <canvas
            id="cadCanvas"
            width="1000"
            height="600"
            style="border: 1px solid #ccc;"
        ></canvas>
    </div>

    <div
        id="threeContainer"
        style="width: 1000px; height: 600px; display: none;"
    ></div>
</body>
</html>