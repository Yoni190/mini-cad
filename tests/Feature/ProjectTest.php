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

    public function test_user_cannot_save_wall_with_negative_thickness(): void
    {
        // Create and authenticate a user
        $user = User::factory()->create();

        // Attempt to save invalid wall geometry
        $response = $this->actingAs($user)
            ->postJson('/projects', [
                'name' => 'Invalid Project',
                'elements' => [
                    [
                        'id' => '550e8400-e29b-41d4-a716-446655440000',
                        'type' => 'wall',
                        'start' => ['x' => 0, 'y' => 0],
                        'end' => ['x' => 4000, 'y' => 0],
                        'thickness' => -200,
                        'height' => 3000
                    ]
                ]
            ]);

        // Laravel must reject the invalid thickness
        $response->assertUnprocessable();

        // Verify the specific validation error
        $response->assertJsonValidationErrors([
            'elements.0.thickness'
        ]);

        // Verify the invalid project was not created
        $this->assertDatabaseMissing('projects', [
            'user_id' => $user->id,
            'name' => 'Invalid Project',
        ]);
    }

    public function test_user_cannot_save_wall_with_identical_start_and_end_coordinates(): void
    {
        // Create and authenticate a user
        $user = User::factory()->create();

        // Attempt to save invalid wall geometry
        $response = $this->actingAs($user)
            ->postJson('/projects', [
                'name' => 'Invalid Project',
                'elements' => [
                    [
                        'id' => '550e8400-e29b-41d4-a716-446655440000',
                        'type' => 'wall',
                        'start' => ['x' => 4000, 'y' => 0],
                        'end' => ['x' => 4000, 'y' => 0],
                        'thickness' => 200,
                        'height' => 3000
                    ]
                ]
            ]);

        // Laravel must reject the identical start and end coordinates
        $response->assertUnprocessable();

        // Verify the specific validation error
        $response->assertJsonValidationErrors([
            'elements.0.end'
        ]);

        // Verify the invalid project was not created
        $this->assertDatabaseMissing('projects', [
            'user_id' => $user->id,
            'name' => 'Invalid Project',
        ]);
    }


    public function test_user_can_update_own_project(): void
    {
        // Create a user
        $user = User::factory()->create();

        // Create a project belonging to this user
        $project = $user->projects()->create([
            'name' => 'Original Project',
            'elements' => [],
        ]);

        // Update the project using its existing ID
        $response = $this->actingAs($user)
            ->putJson("/projects/{$project->id}", [
                'name' => 'Updated Project',
                'elements' => [],
            ]);

        // Verify the request succeeded
        $response->assertOk();

        // Verify the existing database record was updated
        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'user_id' => $user->id,
            'name' => 'Updated Project',
        ]);

        // Verify Laravel didn't create a duplicate project
        $this->assertDatabaseCount('projects', 1);
    }

}
