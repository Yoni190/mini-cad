<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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
