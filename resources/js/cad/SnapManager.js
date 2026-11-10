export default class SnapManager {
    constructor(tolerance = 150) {
        this.tolerance = tolerance;
    }

    snap (point, elements) {
        let closestPoint = point;
        let closestDistance = this.tolerance;

        for (const element of elements) {
            if(element.type !== 'wall') {
                continue;
            }

            const endpoints = [element.start, element.end];

            for (const endpoint of endpoints) {
                //Calculate distance from point to endpoint
                const distance = Math.hypot(
                    point.x - endpoint.x,
                    point.y - endpoint.y
                );

                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestPoint = endpoint;
                }
            }
        }

        return closestPoint;
    }
}