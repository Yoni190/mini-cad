<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Project extends Model
{
    protected $fillable = [
        'name',
        'elements',
    ];

    protected function casts(): array
    {
        return [
            'elements' => 'array',
        ];
    }

    public function user() {
        return $this->belongsTo(User::class);
    }
}
