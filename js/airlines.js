/**
 * Airline configuration loader and utilities
 */

let airlinesCache = null;

/**
 * Fetch and parse airlines configuration
 * @returns {Promise<Object>} Airlines configuration object
 */
export async function fetchAirlines() {
    if (airlinesCache) {
        return airlinesCache;
    }

    try {
        const response = await fetch('/config/airlines.json');
        if (!response.ok) {
            throw new Error(`Failed to fetch airlines config: ${response.status}`);
        }

        airlinesCache = await response.json();
        console.log(`Loaded ${Object.keys(airlinesCache).length} airlines`);
        return airlinesCache;
    } catch (error) {
        console.error('Error fetching airlines config:', error);
        // Return empty object on error - we can still work without airline names
        airlinesCache = {};
        return airlinesCache;
    }
}

/**
 * Check if callsign is an N-number (US aircraft registration)
 * @param {string} callsign - Flight callsign
 * @returns {boolean} True if callsign is an N-number
 */
export function isNNumber(callsign) {
    if (!callsign) return false;
    // N-numbers: N followed by 1-5 alphanumeric chars (digits, with up to 2 letters at end)
    return /^N[0-9]{1,5}[A-Z]{0,2}$/.test(callsign.toUpperCase());
}

/**
 * Extract airline prefix from callsign (first 3 letters)
 * @param {string} callsign - Flight callsign
 * @returns {string|null} 3-letter prefix or null
 */
export function extractAirlinePrefix(callsign) {
    if (!callsign || callsign.length < 3) {
        return null;
    }

    // Check if first 3 chars are letters (airline callsign)
    const prefix = callsign.substring(0, 3).toUpperCase();
    if (/^[A-Z]{3}$/.test(prefix)) {
        return prefix;
    }

    return null;
}

/**
 * Get airline information from callsign
 * @param {string} callsign - Flight callsign
 * @returns {Object} Airline info with name and website
 */
export function getAirlineInfo(callsign) {
    // Check for N-numbers (US private aircraft)
    if (isNNumber(callsign)) {
        return {
            prefix: callsign.toUpperCase(),
            name: 'Private (United States)',
            website: null
        };
    }

    const prefix = extractAirlinePrefix(callsign);

    if (!prefix || !airlinesCache) {
        return {
            prefix: prefix || callsign.substring(0, 3).toUpperCase(),
            name: null,
            website: null
        };
    }

    const airline = airlinesCache[prefix];

    if (airline) {
        return {
            prefix,
            name: airline.name,
            website: airline.website
        };
    }

    return {
        prefix,
        name: null,
        website: null
    };
}

/**
 * Format airline display name
 * @param {string} callsign - Flight callsign
 * @returns {string} Display name (airline name or "Unknown Airline")
 */
export function formatAirlineName(callsign) {
    const info = getAirlineInfo(callsign);
    return info.name || 'Unknown Airline';
}
