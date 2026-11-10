<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mini CAD Editor</title>
    @vite(['resources/js/app.js'])
</head>
<body>
    <h2>Mini CAD Editor</h2>

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

    <canvas
        id="cadCanvas"
        width="1000"
        height="600"
        style="border: 1px solid #ccc;"
        ></canvas>
</body>
</html>