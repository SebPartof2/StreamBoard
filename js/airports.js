/**
 * VATSpy airport data parser and manager
 */

const VATSPY_URL = 'https://raw.githubusercontent.com/vatsimnetwork/vatspy-data-project/master/VATSpy.dat';

let airportsCache = null;

/**
 * Parse VATSpy.dat file content
 * @param {string} content - Raw file content
 * @returns {Map<string, Object>} Map of ICAO codes to airport data
 */
function parseVATSpyData(content) {
    const airports = new Map();
    const lines = content.split('\n');
    let inAirportsSection = false;

    for (const line of lines) {
        const trimmed = line.trim();

        // Check for section headers
        if (trimmed.startsWith('[')) {
            inAirportsSection = trimmed === '[Airports]';
            continue;
        }

        // Skip comments and empty lines
        if (!trimmed || trimmed.startsWith(';')) {
            continue;
        }

        // Parse airport line if in airports section
        if (inAirportsSection) {
            const parts = trimmed.split('|');
            if (parts.length >= 6) {
                const icao = parts[0].trim().toUpperCase();
                const name = parts[1].trim();
                const lat = parseFloat(parts[2]);
                const lon = parseFloat(parts[3]);
                const iata = parts[4].trim() || null;
                const fir = parts[5].trim();
                const isPseudo = parts[6] === '1';

                // Skip pseudo airports and invalid coordinates
                if (!isPseudo && !isNaN(lat) && !isNaN(lon)) {
                    airports.set(icao, {
                        icao,
                        name,
                        lat,
                        lon,
                        iata,
                        fir
                    });
                }
            }
        }
    }

    return airports;
}

/**
 * Fetch and parse VATSpy airport data
 * @returns {Promise<Map<string, Object>>} Map of airports by ICAO
 */
export async function fetchAirports() {
    // Return cached data if available
    if (airportsCache) {
        return airportsCache;
    }

    try {
        const response = await fetch(VATSPY_URL);
        if (!response.ok) {
            throw new Error(`Failed to fetch VATSpy data: ${response.status}`);
        }

        const content = await response.text();
        airportsCache = parseVATSpyData(content);

        console.log(`Loaded ${airportsCache.size} airports from VATSpy`);
        return airportsCache;
    } catch (error) {
        console.error('Error fetching airport data:', error);
        throw error;
    }
}

/**
 * Get airport by ICAO code
 * @param {string} icao - ICAO code
 * @returns {Object|null} Airport data or null if not found
 */
export function getAirport(icao) {
    if (!airportsCache) {
        return null;
    }
    return airportsCache.get(icao.toUpperCase()) || null;
}

/**
 * Search airports by partial ICAO or name
 * @param {string} query - Search query
 * @param {number} limit - Max results
 * @returns {Array<Object>} Matching airports
 */
export function searchAirports(query, limit = 10) {
    if (!airportsCache || !query) {
        return [];
    }

    const upperQuery = query.toUpperCase();
    const results = [];

    for (const airport of airportsCache.values()) {
        if (airport.icao.includes(upperQuery) ||
            airport.name.toUpperCase().includes(upperQuery) ||
            (airport.iata && airport.iata.toUpperCase().includes(upperQuery))) {
            results.push(airport);
            if (results.length >= limit) {
                break;
            }
        }
    }

    return results;
}
