<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class SaveProjectRequest extends FormRequest
{
    /**
     * Authentication is handled by the auth middleware.
     * Project ownership is checked in the controller.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Validate the project and common element properties.
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],

            // Allow an empty drawing, but limit its size.
            'elements' => ['required', 'array', 'list', 'max:1000'],

            // Every element must be an object.
            'elements.*' => ['required', 'array'],

            // Every element has a unique ID and valid type.
            'elements.*.id' => ['required', 'uuid', 'distinct'],
            'elements.*.type' => ['required', 'in:wall,column'],
        ];
    }

    /**
     * Apply geometry-specific validation after the basic rules.
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                $elements = $this->input('elements', []);

                // Avoid iterating over invalid input.
                if (!is_array($elements)) {
                    return;
                }

                foreach ($elements as $index => $element) {
                    if (!is_array($element)) {
                        continue;
                    }

                    $path = "elements.$index";
                    $type = $element['type'] ?? null;

                    if ($type === 'wall') {
                        $this->validateWall(
                            $element,
                            $path,
                            $validator
                        );
                    } elseif ($type === 'column') {
                        $this->validateColumn(
                            $element,
                            $path,
                            $validator
                        );
                    }
                }
            },
        ];
    }

    /**
     * Validate a wall's coordinates and dimensions.
     */
    private function validateWall(
        array $wall,
        string $path,
        Validator $validator
    ): void {
        $this->checkAllowedKeys(
            $wall,
            ['id', 'type', 'start', 'end', 'thickness', 'height'],
            $path,
            $validator
        );

        // Validate both endpoints.
        $this->validatePoint(
            $wall['start'] ?? null,
            "$path.start",
            $validator
        );

        $this->validatePoint(
            $wall['end'] ?? null,
            "$path.end",
            $validator
        );

        // Dimensions must be positive.
        $this->validatePositiveNumber(
            $wall['thickness'] ?? null,
            "$path.thickness",
            $validator
        );

        $this->validatePositiveNumber(
            $wall['height'] ?? null,
            "$path.height",
            $validator
        );

        // Start and end must not be identical.
        $start = $wall['start'] ?? null;
        $end = $wall['end'] ?? null;

        if ($this->isValidPoint($start) &&
            $this->isValidPoint($end) &&
            $start['x'] == $end['x'] &&
            $start['y'] == $end['y']) {

            $validator->errors()->add(
                "$path.end",
                'Wall start and end points must be different.'
            );
        }
    }

    /**
     * Validate a column's position and dimensions.
     */
    private function validateColumn(
        array $column,
        string $path,
        Validator $validator
    ): void {
        $this->checkAllowedKeys(
            $column,
            ['id', 'type', 'position', 'width', 'depth', 'height'],
            $path,
            $validator
        );

        $this->validatePoint(
            $column['position'] ?? null,
            "$path.position",
            $validator
        );

        foreach (['width', 'depth', 'height'] as $field) {
            $this->validatePositiveNumber(
                $column[$field] ?? null,
                "$path.$field",
                $validator
            );
        }
    }

    /**
     * Validate a 2D point: { x: number, y: number }.
     */
    private function validatePoint(
        mixed $point,
        string $path,
        Validator $validator
    ): void {
        if (!is_array($point)) {
            $validator->errors()->add(
                $path,
                'The point must contain x and y coordinates.'
            );

            return;
        }

        $this->checkAllowedKeys(
            $point,
            ['x', 'y'],
            $path,
            $validator
        );

        foreach (['x', 'y'] as $axis) {
            if (!$this->isFiniteNumber($point[$axis] ?? null)) {
                $validator->errors()->add(
                    "$path.$axis",
                    'The coordinate must be a finite number.'
                );
            }
        }
    }

    /**
     * Validate a positive dimension.
     */
    private function validatePositiveNumber(
        mixed $value,
        string $path,
        Validator $validator
    ): void {
        if (!$this->isFiniteNumber($value) || $value <= 0) {
            $validator->errors()->add(
                $path,
                'The dimension must be a positive finite number.'
            );
        }
    }

    /**
     * Accept only actual numeric values, not numeric strings,
     * booleans, null, or infinite values.
     */
    private function isFiniteNumber(mixed $value): bool
    {
        return (is_int($value) || is_float($value))
            && is_finite((float) $value);
    }

    /**
     * Check whether a point has valid coordinates.
     */
    private function isValidPoint(mixed $point): bool
    {
        return is_array($point)
            && $this->isFiniteNumber($point['x'] ?? null)
            && $this->isFiniteNumber($point['y'] ?? null);
    }

    /**
     * Reject unexpected properties.
     */
    private function checkAllowedKeys(
        array $data,
        array $allowed,
        string $path,
        Validator $validator
    ): void {
        $unexpected = array_diff(array_keys($data), $allowed);

        if (!empty($unexpected)) {
            $validator->errors()->add(
                $path,
                'Unexpected properties: ' . implode(', ', $unexpected)
            );
        }
    }
}
