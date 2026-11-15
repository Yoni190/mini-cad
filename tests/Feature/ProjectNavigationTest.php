<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProjectNavigationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
    }

    public function test_project_pages_require_authentication(): void
    {
        $this->get('/projects')->assertRedirect(route('login'));
        $this->get('/editor/123')->assertRedirect(route('login'));
    }

    public function test_login_lands_on_projects_even_with_an_intended_editor_url(): void
    {
        $user = User::factory()->create();

        $this->withSession(['url.intended' => '/editor'])
            ->post('/login', ['email' => $user->email, 'password' => 'password'])
            ->assertRedirect(route('projects.index'));

        $this->assertAuthenticatedAs($user);
    }

    public function test_registration_lands_on_projects(): void
    {
        $this->post('/register', [
            'name' => 'Designer',
            'email' => 'designer@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertRedirect(route('projects.index'));

        $this->assertAuthenticated();
    }

    public function test_authenticated_homepage_redirects_to_projects(): void
    {
        $this->actingAs(User::factory()->create())
            ->get('/')->assertRedirect(route('projects.index'));
    }

    public function test_projects_page_only_lists_owned_projects_with_editor_links(): void
    {
        $owner = User::factory()->create();
        $own = $owner->projects()->create(['name' => 'My floor plan', 'elements' => []]);
        $other = User::factory()->create()->projects()->create(['name' => 'Private floor plan', 'elements' => []]);

        $this->actingAs($owner)->get('/projects')
            ->assertOk()
            ->assertSee('My floor plan')
            ->assertSee(route('editor.project', $own))
            ->assertDontSee($other->name)
            ->assertSee(route('editor'));
    }

    public function test_empty_projects_page_offers_project_creation(): void
    {
        $this->actingAs(User::factory()->create())->get('/projects')
            ->assertOk()->assertSee('Your first drawing starts here')
            ->assertSee(route('editor'));
    }

    public function test_project_list_is_paginated_and_does_not_fetch_drawing_elements(): void
    {
        $owner = User::factory()->create();
        for ($i = 0; $i < 25; $i++) {
            $owner->projects()->create(['name' => "Plan {$i}", 'elements' => []]);
        }

        $response = $this->actingAs($owner)->get('/projects')->assertOk();
        $projects = $response->viewData('projects');
        $this->assertCount(24, $projects);
        $this->assertSame(25, $projects->total());
        $this->assertSame('Plan 24', $projects->first()->name);
        $this->assertArrayNotHasKey('elements', $projects->first()->getAttributes());
        $this->get('/projects?page=2')->assertOk()->assertSee('Plan 0');
    }

    public function test_json_project_listing_remains_available(): void
    {
        $owner = User::factory()->create();
        $project = $owner->projects()->create(['name' => 'API project', 'elements' => []]);

        $this->actingAs($owner)->getJson('/projects')->assertOk()
            ->assertJsonCount(1)->assertJsonPath('0.id', $project->id)
            ->assertJsonMissingPath('0.elements');
    }

    public function test_project_editor_receives_saved_elements_and_a_link_back_to_projects(): void
    {
        $owner = User::factory()->create();
        $elements = [[
            'id' => '550e8400-e29b-41d4-a716-446655440001',
            'type' => 'wall',
            'start' => ['x' => 0, 'y' => 0],
            'end' => ['x' => 4000, 'y' => 0],
            'thickness' => 200,
            'height' => 3000,
        ]];
        $project = $owner->projects()->create(['name' => 'Saved plan', 'elements' => $elements]);

        $response = $this->actingAs($owner)->get(route('editor.project', $project))
            ->assertOk()->assertSee('Saved plan')->assertSee('Back to projects')
            ->assertSee(route('projects.index'));

        preg_match('/<script id="initialProject" type="application\/json">(.*?)<\/script>/s', $response->getContent(), $matches);
        $data = json_decode($matches[1], true, flags: JSON_THROW_ON_ERROR);
        $this->assertSame($project->id, $data['id']);
        $this->assertSame($elements, $data['elements']);
        $this->assertSame($project->fresh()->version, $data['version']);
    }

    public function test_another_users_project_editor_is_not_accessible(): void
    {
        $project = User::factory()->create()->projects()->create(['name' => 'Private', 'elements' => []]);
        $this->actingAs(User::factory()->create())->get(route('editor.project', $project))->assertNotFound();
    }

    public function test_new_editor_has_default_name_and_no_saved_project_payload(): void
    {
        $this->actingAs(User::factory()->create())->get('/editor')
            ->assertOk()->assertSee('Untitled Project')->assertDontSee('id="initialProject"', false);
    }

    public function test_project_names_are_escaped_in_the_list_and_embedded_payload(): void
    {
        $owner = User::factory()->create();
        $name = '</script><script>alert(1)</script>';
        $project = $owner->projects()->create(['name' => $name, 'elements' => []]);

        $this->actingAs($owner)->get('/projects')->assertOk()->assertSee($name)->assertDontSee($name, false);
        $this->get(route('editor.project', $project))->assertOk()->assertDontSee($name, false);
    }
}
