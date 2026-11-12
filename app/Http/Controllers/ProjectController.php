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
            'project' => $project
        ], 201);
    }

    public function index(Request $request)
    {
        $projects = $request->user()
            ->projects()
            ->latest()
            ->get(['id', 'name', 'created_at', 'updated_at']);

        return response()->json($projects);
    }

    public function show(Request $request, Project $project)
    {
        Gate::authorize('view', $project);

        return response()->json($project);
    }

    public function update(SaveProjectRequest $request, Project $project)
    {
        Gate::authorize('view', $project);

        $project->update($request->validated());

        return response()->json($project);
    }
}
