<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Http\Requests\SaveProjectRequest;
use App\Models\Project;
use Illuminate\Support\Facades\Gate;

class ProjectController extends Controller
{
    public function store(SaveProjectRequest $request)
    {
        $validated = $request->validated();

        $project = $request->user()
            ->projects()
            ->create($validated);

        return response()->json([
            'message' => 'Project created',
            'project' => $project->refresh()
        ], 201);
    }

    public function index(Request $request)
    {
        $query = $request->user()
            ->projects()
            ->orderByDesc('updated_at')
            ->orderByDesc('id');

        if ($request->expectsJson()) {
            return response()->json($query->get(['id', 'name', 'created_at', 'updated_at']));
        }

        return view('projects.index', [
            'projects' => $query->paginate(24, ['id', 'name', 'created_at', 'updated_at']),
        ]);
    }

    public function edit(Project $project)
    {
        Gate::authorize('view', $project);

        return view('editor', ['project' => $project]);
    }

    public function show(Request $request, Project $project)
    {
        Gate::authorize('view', $project);

        return response()->json($project);
    }

    public function update(SaveProjectRequest $request, Project $project)
    {
        Gate::authorize('update', $project);

        $data = $request->validated();
        $updated = Project::whereKey($project->id)->where('version', $data['version'])->update([
            'name' => $data['name'],
            'elements' => json_encode($data['elements'], JSON_THROW_ON_ERROR),
            'version' => $data['version'] + 1,
        ]);

        if (!$updated) {
            return response()->json(['message' => 'This project was changed in another tab. Your changes remain here but were not saved. Open the latest project in another tab to reconcile them.'], 409);
        }

        $project->fill($data);
        $project->version = $data['version'] + 1;

        return response()->json($project);
    }
}
