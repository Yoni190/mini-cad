<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\AuthController;

// Redirect homepage to editor or login
Route::get('/', function () {
    return redirect()->route(
        auth()->check() ? 'editor' : 'login'
    );
});

Route::middleware('guest')->group(function () {
    Route::view('/register', 'auth.register')->name('register');
    Route::post('/register', [AuthController::class, 'register']);

    Route::view('/login', 'auth.login')->name('login');
    Route::post('/login', [AuthController::class, 'login'])
        ->middleware('throttle:5,1');
});

// Routes accessible only to authenticated users
Route::middleware('auth')->group(function () {
    Route::view('/editor', 'editor')->name('editor');

    Route::post('/logout', [AuthController::class, 'logout'])
        ->name('logout');

    // CAD project routes
    Route::post('/projects', [ProjectController::class, 'store']);
});