<?php

namespace Tests\Feature;

use App\Providers\TelescopeServiceProvider;
use Tests\TestCase;

class TelescopeProviderTest extends TestCase
{
    public function test_provider_is_registered_only_when_telescope_is_enabled(): void
    {
        config(['telescope.enabled' => true]);
        $this->assertContains(TelescopeServiceProvider::class, require base_path('bootstrap/providers.php'));

        config(['telescope.enabled' => false]);
        $this->assertNotContains(TelescopeServiceProvider::class, require base_path('bootstrap/providers.php'));
    }
}
