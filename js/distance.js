/**
 * Distance calculation utilities using Haversine formula
 */

const EARTH_RADIUS_NM = 3440.065; // Earth's radius in nautical miles

/**
 * Convert degrees to radians
 * @param {number} degrees
 * @returns {number}
 */
function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

/**
 * Calculate the great-circle distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of point 1 (degrees)
 * @param {number} lon1 - Longitude of point 1 (degrees)
 * @param {number} lat2 - Latitude of point 2 (degrees)
 * @param {number} lon2 - Longitude of point 2 (degrees)
 * @returns {number} Distance in nautical miles
 */
export function haversine(lat1, lon1, lat2, lon2) {
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_NM * c;
}

/**
 * Format distance for display
 * @param {number} distanceNm - Distance in nautical miles
 * @returns {string} Formatted distance string
 */
export function formatDistance(distanceNm) {
    if (distanceNm < 1) {
        return '< 1 nm';
    } else if (distanceNm < 10) {
        return `${distanceNm.toFixed(1)} nm`;
    } else {
        return `${Math.round(distanceNm)} nm`;
    }
}
