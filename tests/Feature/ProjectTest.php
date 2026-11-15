<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
            'version' => 1,
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
                'version' => 1,
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

    public function test_user_can_save_and_retrieve_project_with_elements(): void
    {
        // Create and authenticate the owner
        $user = User::factory()->create();

        // CAD elements to save
        $elements = [
            [
                'id' => '550e8400-e29b-41d4-a716-446655440001',
                'type' => 'wall',
                'start' => ['x' => 0, 'y' => 0],
                'end' => ['x' => 4000, 'y' => 0],
                'thickness' => 200,
                'height' => 3000,
            ],
            [
                'id' => '550e8400-e29b-41d4-a716-446655440002',
                'type' => 'column',
                'position' => ['x' => 1000, 'y' => 1000],
                'width' => 400,
                'depth' => 600,
                'height' => 3000,
            ],
        ];

        // Save the project
        $saveResponse = $this->actingAs($user)
            ->postJson('/projects', [
                'name' => 'CAD Test Project',
                'elements' => $elements,
            ]);

        $saveResponse->assertCreated();

        // Obtain the newly created project ID
        $projectId = $saveResponse->json('project.id');

        $this->assertNotNull($projectId);

        // Retrieve the project through the API
        $loadResponse = $this->getJson("/projects/{$projectId}");

        $loadResponse->assertOk();

        // Verify project metadata
        $loadResponse->assertJsonPath(
            'name',
            'CAD Test Project'
        );

        $loadResponse->assertJsonPath(
            'user_id',
            $user->id
        );

        // Verify every element was preserved
        $this->assertEquals(
            $elements,
            $loadResponse->json('elements')
        );
    }
    
    public function test_user_can_update_and_retrieve_project_with_elements(): void
    {
        // 1. Create and authenticate a user
        $user = User::factory()->create();

        // 2. Create a project containing a wall of length 4000 mm
        $elements = [
            [
                'id' => '550e8400-e29b-41d4-a716-446655440001',
                'type' => 'wall',
                'start' => ['x' => 0, 'y' => 0],
                'end' => ['x' => 4000, 'y' => 0],
                'thickness' => 200,
                'height' => 3000,
            ],
        ];

        $saveResponse = $this->actingAs($user)
            ->postJson('/projects', [
                'name' => 'Original Project',
                'elements' => $elements,
            ]);

        $saveResponse->assertCreated();

        // Store the original project ID
        $projectId = $saveResponse->json('project.id');

        // 3. Change the wall length from 4000 to 5000 mm
        $elements[0]['end']['x'] = 5000;

        // 4. Update the existing project
        $updateResponse = $this->putJson(
            "/projects/{$projectId}",
            [
                'name' => 'Updated Project',
                'version' => 1,
                'elements' => $elements,
            ]
        );

        $updateResponse->assertOk();

        // 5. Retrieve the project again
        $loadResponse = $this->getJson("/projects/{$projectId}");

        $loadResponse->assertOk();

        // 6. Verify the project ID remains unchanged
        $loadResponse->assertJsonPath('id', $projectId);

        // 7. Verify the project name was updated
        $loadResponse->assertJsonPath(
            'name',
            'Updated Project'
        );

        // 8. Verify the wall endpoint was updated
        $loadResponse->assertJsonPath(
            'elements.0.end.x',
            5000
        );

        // 9. Verify all element properties are preserved
        $this->assertEquals(
            $elements,
            $loadResponse->json('elements')
        );

        // 10. Verify no duplicate project was created
        $this->assertDatabaseCount('projects', 1);
    }

    public function test_stale_save_does_not_overwrite_newer_work(): void
    {
        $user = User::factory()->create();
        $project = $user->projects()->create(['name' => 'Original', 'elements' => []]);
        $this->actingAs($user);

        $this->putJson("/projects/{$project->id}", ['name' => 'Newer', 'elements' => [], 'version' => 1])
            ->assertOk()->assertJsonPath('version', 2);
        $this->putJson("/projects/{$project->id}", ['name' => 'Stale', 'elements' => [], 'version' => 1])
            ->assertStatus(409);
        $this->putJson("/projects/{$project->id}", ['name' => 'No version', 'elements' => []])
            ->assertUnprocessable()->assertJsonValidationErrors('version');
        $this->assertDatabaseHas('projects', ['id' => $project->id, 'name' => 'Newer', 'version' => 2]);
    }

    public function test_thickness_side_must_be_an_integer_on_create_and_update(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);
        $wall = [
            'id' => '550e8400-e29b-41d4-a716-446655440001',
            'type' => 'wall',
            'start' => ['x' => 0, 'y' => 0],
            'end' => ['x' => 1000, 'y' => 0],
            'thickness' => 200,
            'height' => 3000,
            'thicknessSide' => '1',
        ];
        $this->postJson('/projects', ['name' => 'Plan', 'elements' => [$wall]])
            ->assertUnprocessable()->assertJsonValidationErrors('elements.0.thicknessSide');

        $wall['thicknessSide'] = -1;
        $created = $this->postJson('/projects', ['name' => 'Plan', 'elements' => [$wall]])
            ->assertCreated()->assertJsonPath('project.elements.0.thicknessSide', -1);
        $id = $created->json('project.id');
        $this->getJson("/projects/{$id}")->assertOk()->assertJsonPath('elements.0.thicknessSide', -1);

        $wall['thicknessSide'] = '-1';
        $this->putJson("/projects/{$id}", ['name' => 'Plan', 'elements' => [$wall], 'version' => 1])
            ->assertUnprocessable()->assertJsonValidationErrors('elements.0.thicknessSide');
        $this->getJson("/projects/{$id}")->assertOk()->assertJsonPath('elements.0.thicknessSide', -1);
    }

}
