<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your projects - Mini CAD</title>
    @vite(['resources/css/app.css'])
</head>
<body class="cad-editor projects-page">
    <header class="editor-header projects-header">
        <a href="{{ route('projects.index') }}" class="editor-brand" aria-label="Projects">
            <span class="brand-mark" aria-hidden="true">⌑</span>
        </a>
        <span class="projects-header-title">Your workspace</span>
        <div class="account-controls">
            <span class="user-name">{{ auth()->user()->name }}</span>
            <form method="POST" action="{{ route('logout') }}">
                @csrf
                <button type="submit" class="button-quiet">Logout</button>
            </form>
        </div>
    </header>

    <main class="projects-main">
        <div class="projects-heading">
            <div>
                <h1>Projects</h1>
                <p>Pick up where you left off, or start a new drawing.</p>
            </div>
            <a href="{{ route('editor') }}" class="project-create">+ New Project</a>
        </div>

        @if ($projects->isEmpty())
            <section class="projects-empty">
                <span class="projects-empty-icon" aria-hidden="true">⌑</span>
                <h2>Your first drawing starts here</h2>
                <p>Create a project, draw your plan, and save it to find it here.</p>
                <a href="{{ route('editor') }}" class="project-create">Create a project</a>
            </section>
        @else
            <div class="project-grid">
                @foreach ($projects as $project)
                    <a href="{{ route('editor.project', $project) }}" class="project-card">
                        <span class="project-card-icon" aria-hidden="true">⌑</span>
                        <h2>{{ $project->name }}</h2>
                        <p>Updated <time datetime="{{ $project->updated_at->toIso8601String() }}">{{ $project->updated_at->diffForHumans() }}</time></p>
                        <span class="project-card-open">Open project <span aria-hidden="true">→</span></span>
                    </a>
                @endforeach
            </div>
            <div class="projects-pagination">{{ $projects->links() }}</div>
        @endif
    </main>
</body>
</html>
