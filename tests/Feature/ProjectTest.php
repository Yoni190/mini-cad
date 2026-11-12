<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;

class ProjectTest extends TestCase
{
    use RefreshDatabase;
    
    /**
     * Verify that a user cannot view another user's project.
     */
    public function test_user_cannot_view_another_users_project(): void
    {
        // Create two different users
        $userA = User::factory()->create();
        $userB = User::factory()->create();

        // Create a project belonging to User A
        $project = $userA->projects()->create([
            'name' => 'Private Project',
            'elements' => []
        ]);

        // Authenticate as User B
        $this->actingAs($userB);

        // Try to access User A's project
        $response = $this->getJson("/projects/{$project->id}");

        // The API should reject access
        $response->assertNotFound();
    }

    /**
     * Verify that a user cannot update another user's project.
     */
    public function test_user_cannot_update_another_users_project(): void
    {
        // Create two different users
        $userA = User::factory()->create();
        $userB = User::factory()->create();

        // Create a project belonging to User A
        $project = $userA->projects()->create([
            'name' => 'Private Project',
            'elements' => []
        ]);

        // Authenticate as User B
        $this->actingAs($userB);

        // Try to update User A's project
        $response = $this->putJson("/projects/{$project->id}", [
            'name' => 'Modified Project',
            'elements' => []
        ]);

        // The API should reject access
        $response->assertNotFound();

        // Project name should remain unchanged
        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'name' => 'Private Project',
        ]);
    }

    /**
     * Verify that a user can save a project with no elements
     */
    public function test_user_can_create_an_empty_project(): void
    {
        // Create a user
        $user = User::factory()->create();

        // Create an empty project as the user
        $response = $this->actingAs($user)
            ->postJson('/projects', [
                'name' => 'Empty Project',
                'elements' => [],
            ]);

        // The Project should be created
        $response->assertCreated();

        $this->assertDatabaseHas('projects', [
            'user_id' => $user->id,
            'name' => 'Empty Project',
        ]);
    }
}
