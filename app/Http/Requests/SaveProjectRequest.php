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
            'version' => [$this->isMethod('put') ? 'required' : 'prohibited', 'integer', 'min:1'],

            // A project may contain no elements.
            'elements' => ['present', 'array', 'list', 'max:1000'],

            'elements.*' => ['required', 'array'],
            'elements.*.id' => ['required', 'uuid', 'distinct'],
            'elements.*.type' => ['required', 'in:wall,column'],

            'elements.*.start' => ['sometimes', 'array'],
            'elements.*.start.x' => ['sometimes', 'numeric'],
            'elements.*.start.y' => ['sometimes', 'numeric'],

            'elements.*.end' => ['sometimes', 'array'],
            'elements.*.end.x' => ['sometimes', 'numeric'],
            'elements.*.end.y' => ['sometimes', 'numeric'],

            'elements.*.thickness' => ['sometimes', 'numeric'],
            'elements.*.thicknessSide' => ['sometimes', 'integer:strict', 'in:-1,1'],
            'elements.*.height' => ['sometimes', 'numeric'],

            'elements.*.openings' => ['sometimes', 'array', 'list'],
            'elements.*.openings.*' => ['required', 'array'],
            'elements.*.openings.*.offset' => ['required', 'numeric'],
            'elements.*.openings.*.width' => ['required', 'numeric'],
            'elements.*.openings.*.height' => ['required', 'numeric'],
            'elements.*.openings.*.type' => ['sometimes', 'in:window'],
            'elements.*.openings.*.sillHeight' => ['sometimes', 'numeric'],
            'elements.*.openings.*.swingSide' => ['sometimes', 'integer:strict', 'in:-1,1'],

            'elements.*.position' => ['sometimes', 'array'],
            'elements.*.position.x' => ['sometimes', 'numeric'],
            'elements.*.position.y' => ['sometimes', 'numeric'],

            'elements.*.width' => ['sometimes', 'numeric'],
            'elements.*.depth' => ['sometimes', 'numeric'],
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
            ['id', 'type', 'start', 'end', 'thickness', 'height', 'thicknessSide', 'openings'],
            $path,
            $validator
        );

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

        $start = $wall['start'] ?? null;
        $end = $wall['end'] ?? null;

        $openings = $wall['openings'] ?? [];

        if (!is_array($openings) || !array_is_list($openings)) {
            $validator->errors()->add(
                "$path.openings",
                'Wall openings must be a list.'
            );
        } else {
            $wallLength = null;

            if ($this->isValidPoint($start) && $this->isValidPoint($end)) {
                $wallLength = hypot(
                    $end['x'] - $start['x'],
                    $end['y'] - $start['y']
                );
            }

            $previousEnd = 0;
            $validOpenings = [];

            foreach ($openings as $index => $opening) {
                $openingPath = "$path.openings.$index";

                if (!is_array($opening)) {
                    $validator->errors()->add(
                        $openingPath,
                        'The opening must be an object.'
                    );
                    continue;
                }

                $this->checkAllowedKeys(
                    $opening,
                    ['offset', 'width', 'height', 'type', 'sillHeight', 'swingSide'],
                    $openingPath,
                    $validator
                );

                $offset = $opening['offset'] ?? null;
                $width = $opening['width'] ?? null;
                $height = $opening['height'] ?? null;
                $isWindow = ($opening['type'] ?? null) === 'window';
                $sillHeight = $isWindow ? ($opening['sillHeight'] ?? null) : 0;

                if (
                    !$this->isFiniteNumber($offset) ||
                    !$this->isFiniteNumber($width) ||
                    !$this->isFiniteNumber($height) ||
                    !$this->isFiniteNumber($sillHeight) ||
                    $sillHeight < 0 ||
                    $offset < 0 ||
                    $width <= 0 ||
                    $height <= 0
                ) {
                    $validator->errors()->add(
                        $openingPath,
                        'The opening must have a non-negative offset and positive dimensions.'
                    );
                    continue;
                }

                if (
                    $wallLength !== null &&
                    $offset + $width > $wallLength
                ) {
                    $validator->errors()->add(
                        $openingPath,
                        'The opening must fit within the wall.'
                    );
                }

                if (
                    $this->isFiniteNumber($wall['height'] ?? null) &&
                    $sillHeight + $height > $wall['height']
                ) {
                    $validator->errors()->add(
                        "$openingPath.height",
                        'The opening cannot be taller than the wall.'
                    );
                }

                $validOpenings[] = [
                    'offset' => $offset,
                    'end' => $offset + $width,
                ];
            }

            usort(
                $validOpenings,
                fn ($a, $b) => $a['offset'] <=> $b['offset']
            );

            foreach ($validOpenings as $index => $opening) {
                if ($index > 0 && $opening['offset'] < $previousEnd) {
                    $validator->errors()->add(
                        "$path.openings",
                        'Wall openings cannot overlap.'
                    );
                }

                $previousEnd = max($previousEnd, $opening['end']);
            }
        }
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
