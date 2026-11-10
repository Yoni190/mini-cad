<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ProjectController;

Route::middleware('auth')->group(function () {
    Route::view('/editor', 'editor');
    
    Route::post('/projects', [ProjectController::class, 'store']);
});