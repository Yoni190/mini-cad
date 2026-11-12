<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Http\Requests\SaveProjectRequest;

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

    public function show(Request $request, int $project)
    {
        $project = $request->user()
            ->projects()
            ->findOrFail($project);

        return response()->json($project);
    }

    public function update(SaveProjectRequest $request, int $project)
    {
        $project = $request->user()
            ->projects()
            ->findOrFail($project);

        $validated = $request->validated();

        $project->update($validated);

        return response()->json($project);
    }
}
