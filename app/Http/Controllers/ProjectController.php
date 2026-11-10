<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class ProjectController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'elements'  => ['required', 'array']
        ]);

        $project = $request->user()
            ->projects()
            ->create($validated);

        return response()->json([
            'message' => 'Project created',
            'project' => $project
        ], 201);
    }
}
