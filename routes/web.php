<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\AuthController;

Route::get('/', function () {
    return redirect()->route(
        auth()->check() ? 'home' : 'login'
    );
});

Route::view('/', 'landing')->name('home');

Route::middleware('guest')->group(function () {
    Route::view('/register', 'auth.register')->name('register');
    Route::post('/register', [AuthController::class, 'register']);

    Route::view('/login', 'auth.login')->name('login');
    Route::post('/login', [AuthController::class, 'login'])
        ->middleware('throttle:5,1');
});

Route::middleware('auth')->group(function () {
    Route::view('/editor', 'editor')->name('editor');
    Route::get('/editor/{project}', [ProjectController::class, 'edit'])->name('editor.project');

    Route::post('/logout', [AuthController::class, 'logout'])
        ->name('logout');

    Route::get('/projects', [ProjectController::class, 'index'])->name('projects.index');
    Route::post('/projects', [ProjectController::class, 'store']);
    Route::get('/projects/{project}', [ProjectController::class, 'show']);
    Route::put('/projects/{project}', [ProjectController::class, 'update']);
});
