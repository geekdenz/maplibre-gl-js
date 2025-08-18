// TypeScript: Minimal standalone "circle" function (Turf-like) with only required helpers.
// Creates a GeoJSON Feature<Polygon> approximating a geodesic circle.

type Position = [number, number];
type Polygon = { type: 'Polygon'; coordinates: Position[][] };
type Feature<G = Polygon, P = Record<string, any>> = { type: 'Feature'; geometry: G; properties: P };

const WGS84_EARTH_RADIUS_M = 6371008.8; // meters

type Units = 'meters' | 'kilometers' | 'miles';

function toMeters(distance: number, units: Units): number {
    switch (units) {
        case 'meters':
            return distance;
        case 'kilometers':
            return distance * 1000;
        case 'miles':
            return distance * 1609.344;
    }
}

/**
 * Geodesic destination from origin by bearing (degrees) and distance (in meters).
 * Longitudes are wrapped into (-180, 180], latitude clamped to [-90, 90].
 */
function destination(origin: Position, bearingDeg: number, distanceMeters: number, earthRadius = WGS84_EARTH_RADIUS_M): Position {
    const [lng, lat] = origin;
    const φ1 = lat * Math.PI / 180;
    const λ1 = lng * Math.PI / 180;
    const θ = ((bearingDeg % 360) + 360) % 360 * Math.PI / 180;
    const δ = distanceMeters / earthRadius;

    const sinφ1 = Math.sin(φ1), cosφ1 = Math.cos(φ1);
    const sinδ = Math.sin(δ), cosδ = Math.cos(δ);

    const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ);
    const φ2 = Math.asin(Math.max(-1, Math.min(1, sinφ2)));
    const y = Math.sin(θ) * sinδ * cosφ1;
    const x = cosδ - sinφ1 * Math.sin(φ2);
    const λ2 = λ1 + Math.atan2(y, x);

    let lon = λ2 * 180 / Math.PI;
    if (lon > 180) lon = ((lon + 180) % 360) - 180;
    if (lon <= -180) lon = ((lon - 180) % 360) + 180;
    const lat2 = Math.max(-90, Math.min(90, φ2 * 180 / Math.PI));
    return [lon, lat2];
}

/**
 * circle(center, radius, {steps=64, units='kilometers', properties={}})
 * Returns a GeoJSON Feature Polygon approximating a geodesic circle.
 */
export function circle(
    center: Position,
    radius: number,
    options?: {
        steps?: number;
        units?: Units;
        properties?: Record<string, any>;
    }
): Feature {
    if (!Array.isArray(center) || center.length !== 2 || !isFinite(center[0]) || !isFinite(center[1])) {
        throw new Error('Invalid center');
    }
    if (!isFinite(radius) || radius < 0) {
        throw new Error('Invalid radius');
    }

    const steps = Math.max(4, Math.floor(options?.steps ?? 64));
    const units: Units = options?.units ?? 'meters';
    const props = options?.properties ?? {};
    const distanceMeters = toMeters(radius, units);

    const ring: Position[] = [];
    for (let i = 0; i < steps; i++) {
        const bearing = (i / steps) * 360;
        ring.push(destination(center, bearing, distanceMeters));
    }
    // close the ring
    ring.push(ring[0].slice() as Position);

    const geometry: Polygon = {type: 'Polygon', coordinates: [ring]};
    return {type: 'Feature', geometry, properties: props};
}
