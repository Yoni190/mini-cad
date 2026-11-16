<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mini CAD - Draw in 2D, see it in 3D</title>
    <meta name="description" content="A browser-based CAD system for building plans: precise 2D drafting in millimetres, a 3D model built from the same drawing, and all your projects in one place.">
    @vite(['resources/css/app.css'])
</head>
@php
    $loginUrl = Route::has('login') ? route('login') : null;
    $registerUrl = Route::has('register') ? route('register') : $loginUrl;
    $startUrl = auth()->check() ? route('editor') : ($registerUrl ?? route('editor'));
@endphp
<body class="cad-editor landing-page">
    <header class="editor-header landing-header">
        <a href="{{ url('/') }}" class="editor-brand" aria-label="Mini CAD home">
            <span class="brand-mark" aria-hidden="true">⌑</span>
        </a>
        <nav class="landing-nav" aria-label="Page sections">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
        </nav>
        <div class="account-controls">
            @auth
                <a href="{{ route('projects.index') }}" class="landing-link">Your projects</a>
            @else
                @if ($loginUrl)
                    <a href="{{ $loginUrl }}" class="landing-link">Log in</a>
                @endif
                <a href="{{ $startUrl }}" class="project-create">Sign up</a>
            @endauth
        </div>
    </header>

    <main class="landing-main">
        <section class="landing-hero" aria-labelledby="landingTitle">
            <div class="landing-copy">
                <h1 id="landingTitle">Draw in 2D. See it in 3D.</h1>
                <p class="landing-lead">A CAD system that runs in your browser. Draft building plans precisely in millimetres, get a 3D model built from the same drawing, and keep every project in one place.</p>
                <div class="landing-actions">
                    <a href="{{ $startUrl }}" class="project-create">{{ auth()->check() ? 'Open the editor' : 'Start drawing' }}</a>
                    @guest
                        @if ($loginUrl)
                            <a href="{{ $loginUrl }}" class="landing-secondary">I have an account</a>
                        @endif
                    @endguest
                </div>
                <p class="landing-note">Nothing to install. Works in a desktop browser.</p>
            </div>

            <figure class="landing-plan">
                <svg viewBox="0 0 520 340" role="img" aria-label="The same small building shown as a 2D plan with dimensions, or as a 3D model">
                    <defs>
                        <g id="isoWalls" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="square">
                            <path d="M60 60H460V300H60ZM270 60V300M270 180H460"/>
                        </g>
                    </defs>
                    <g data-view="2d">
                        <path class="wall" pathLength="1" style="--d:.1s" d="M60 60H460"/>
                        <path class="wall" pathLength="1" style="--d:.4s" d="M460 60V300"/>
                        <path class="wall" pathLength="1" style="--d:.7s" d="M460 300H60"/>
                        <path class="wall" pathLength="1" style="--d:1s"  d="M60 300V60"/>
                        <path class="wall" pathLength="1" style="--d:1.3s" d="M270 60V300"/>
                        <path class="wall" pathLength="1" style="--d:1.5s" d="M270 180H460"/>
                        <rect class="col" x="143" y="173" width="14" height="14"/>
                        <rect class="col" x="143" y="233" width="14" height="14"/>
                        <g class="dim-group">
                            <path class="dim" d="M60 34H270M60 28V40M270 28V40"/>
                            <path class="dim" d="M270 34H460M460 28V40"/>
                            <path class="dim" d="M34 60V300M28 60H40M28 300H40"/>
                            <text class="dim-text" x="165" y="26" text-anchor="middle">3150</text>
                            <text class="dim-text" x="365" y="26" text-anchor="middle">2850</text>
                            <text class="dim-text" x="22" y="180" text-anchor="middle" transform="rotate(-90 22 180)">3600</text>
                        </g>
                    </g>
                    <g data-view="3d" hidden>
                        @for ($k = 8; $k >= 0; $k--)
                            <use href="#isoWalls" style="color: {{ $k === 8 ? '#243247' : '#8da0ba' }}" transform="translate(0 {{ 40 - $k * 4 }}) translate(260 190) scale(1 .5) rotate(45) translate(-260 -180)"/>
                        @endfor
                    </g>
                </svg>
                <figcaption id="planCaption">2D plan: walls, columns and dimensions in millimetres.</figcaption>
            </figure>
        </section>

        <section class="landing-section" id="features" aria-labelledby="featuresTitle">
            <h2 id="featuresTitle">One drawing, from plan to model</h2>
            <div class="landing-features">
                <div>
                    <h3>Precise 2D drafting <span class="status status-live">Available</span></h3>
                    <p>Draw walls with real thickness in millimetres, by clicking points or typing exact lengths.</p>
                </div>
                <div>
                    <h3>3D model <span class="status status-live">Available</span></h3>
                    <p>Switch to 3D at any time. The model comes from the plan, so there is no second drawing.</p>
                </div>
                <div>
                    <h3>Snapping and ortho <span class="status status-live">Available</span></h3>
                    <p>Endpoints snap automatically, and Ortho keeps lines horizontal or vertical.</p>
                </div>
                <div>
                    <h3>Structural elements <span class="status status-live">Available</span></h3>
                    <p>Place columns, then select them to move them or change their dimensions.</p>
                </div>
                <div>
                    <h3>Projects in your account <span class="status status-live">Available</span></h3>
                    <p>Save, rename and reopen projects from any browser, and zoom and pan across a 1000 mm grid.</p>
                </div>
                <div>
                    <h3>Doors and windows <span class="status">Coming soon</span></h3>
                    <p>Place openings in walls, with sizes you control.</p>
                </div>
                <div>
                    <h3>Rooms and areas <span class="status">Coming soon</span></h3>
                    <p>Define rooms and read their areas straight from the drawing.</p>
                </div>
                <div>
                    <h3>Dimensions and annotations <span class="status">Coming soon</span></h3>
                    <p>Add dimension lines and notes so a plan is ready to share.</p>
                </div>
                <div>
                    <h3>Export <span class="status">Coming soon</span></h3>
                    <p>Take your drawing and model into other tools.</p>
                </div>
            </div>
        </section>

        <section class="landing-section" id="how" aria-labelledby="howTitle">
            <h2 id="howTitle">How it works</h2>
            <ol class="landing-steps">
                <li>
                    <h3>Draw the plan</h3>
                    <p>Pick a tool, click your points or enter exact sizes, and let snapping keep everything aligned.</p>
                </li>
                <li>
                    <h3>Review it in 3D</h3>
                    <p>Switch views to check the shape of the building as a model.</p>
                </li>
                <li>
                    <h3>Save and keep going</h3>
                    <p>Save the project to your account and pick it up again whenever you need.</p>
                </li>
            </ol>
        </section>

        <section class="landing-cta" aria-labelledby="ctaTitle">
            <div>
                <h2 id="ctaTitle">Your first drawing starts here</h2>
                <p>Create a project, draw your plan, and save it to find it again later.</p>
            </div>
            <a href="{{ $startUrl }}" class="project-create">{{ auth()->check() ? 'Open the editor' : 'Create a project' }}</a>
        </section>
    </main>

    <footer class="landing-footer">
        <p>Mini CAD. All dimensions in millimetres.</p>
    </footer>
</body>
</html>