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
 * Check if callsign is a Concorde flight
 * @param {string} callsign - Flight callsign
 * @returns {boolean} True if callsign starts with CONC
 */
export function isConcorde(callsign) {
    if (!callsign) return false;
    return callsign.toUpperCase().startsWith('CONC');
}

/**
 * Check if callsign uses IATA code (2 letters followed by numbers)
 * @param {string} callsign - Flight callsign
 * @returns {boolean} True if callsign uses IATA format
 */
export function isIataCode(callsign) {
    if (!callsign || callsign.length < 3) return false;
    // 2 letters followed by at least one digit
    return /^[A-Z]{2}[0-9]/.test(callsign.toUpperCase());
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
 * Extract flight number from callsign (everything after the 3-letter prefix)
 * @param {string} callsign - Flight callsign
 * @returns {string|null} Flight number or null
 */
export function extractFlightNumber(callsign) {
    if (!callsign || callsign.length <= 3) {
        return null;
    }

    const prefix = extractAirlinePrefix(callsign);
    if (!prefix) {
        return null;
    }

    const flightNumber = callsign.substring(3).toUpperCase();
    return flightNumber || null;
}

/**
 * Get airline information from callsign
 * @param {string} callsign - Flight callsign
 * @returns {Object} Airline info with name, website, and flight number
 */
export function getAirlineInfo(callsign) {
    // Check for N-numbers (US private aircraft)
    if (isNNumber(callsign)) {
        return {
            prefix: callsign.toUpperCase(),
            name: 'Private (United States)',
            website: null,
            flightNumber: null
        };
    }

    // Check for Concorde flights
    if (isConcorde(callsign)) {
        return {
            prefix: 'CONC',
            name: 'Concorde',
            website: null,
            flightNumber: callsign.substring(4).toUpperCase() || null
        };
    }

    // Check for IATA codes (2 letters + numbers) - these are invalid on VATSIM
    if (isIataCode(callsign)) {
        return {
            prefix: callsign.substring(0, 2).toUpperCase(),
            name: 'Unknown Airline (IATA Code)',
            website: null,
            flightNumber: null
        };
    }

    const prefix = extractAirlinePrefix(callsign);
    const flightNumber = extractFlightNumber(callsign);

    if (!prefix || !airlinesCache) {
        return {
            prefix: prefix || callsign.substring(0, 3).toUpperCase(),
            name: null,
            website: null,
            flightNumber
        };
    }

    const airline = airlinesCache[prefix];

    if (airline) {
        return {
            prefix,
            name: airline.name,
            website: airline.website,
            flightNumber
        };
    }

    return {
        prefix,
        name: null,
        website: null,
        flightNumber
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
