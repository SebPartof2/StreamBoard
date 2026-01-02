/**
 * VATSIM data fetching and processing
 */

import { haversine } from './distance.js';
import { getAirport } from './airports.js';

const VATSIM_DATA_URL = 'https://data.vatsim.net/v3/vatsim-data.json';

/**
 * Fetch current VATSIM data
 * @returns {Promise<Object>} VATSIM data object
 */
export async function fetchVatsimData() {
    try {
        const response = await fetch(VATSIM_DATA_URL);
        if (!response.ok) {
            throw new Error(`Failed to fetch VATSIM data: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching VATSIM data:', error);
        throw error;
    }
}

/**
 * Detect flight stage based on altitude and distance
 * @param {Object} pilot - Pilot data
 * @param {Object} depAirport - Departure airport data
 * @param {Object} arrAirport - Arrival airport data
 * @returns {string} Flight stage: 'ground', 'departing', 'cruising', 'arriving'
 */
export function detectFlightStage(pilot, depAirport, arrAirport) {
    const altitude = pilot.altitude;
    const groundspeed = pilot.groundspeed;

    // On ground check
    if (groundspeed < 50 && altitude < 500) {
        return 'ground';
    }

    // Calculate distances if we have airport data
    let distFromDep = Infinity;
    let distFromArr = Infinity;

    if (depAirport) {
        distFromDep = haversine(
            pilot.latitude, pilot.longitude,
            depAirport.lat, depAirport.lon
        );
    }

    if (arrAirport) {
        distFromArr = haversine(
            pilot.latitude, pilot.longitude,
            arrAirport.lat, arrAirport.lon
        );
    }

    // Low altitude near departure = departing
    if (altitude < 10000 && distFromDep < 50) {
        return 'departing';
    }

    // Low altitude near arrival = arriving
    if (altitude < 10000 && distFromArr < 100) {
        return 'arriving';
    }

    // High altitude = cruising
    if (altitude > 25000) {
        return 'cruising';
    }

    // Mid-altitude - determine by distance ratio
    if (distFromDep < distFromArr) {
        return 'departing';
    }

    return 'arriving';
}

/**
 * Process pilot data and add computed fields
 * @param {Object} pilot - Raw pilot data from VATSIM
 * @param {Object} selectedAirport - The airport being viewed
 * @param {string} mode - 'dep' or 'arr'
 * @returns {Object} Processed pilot data
 */
export function processPilot(pilot, selectedAirport, mode) {
    const flightPlan = pilot.flight_plan || {};

    // Get departure and arrival airports
    const depIcao = flightPlan.departure || null;
    const arrIcao = flightPlan.arrival || null;

    const depAirport = depIcao ? getAirport(depIcao) : null;
    const arrAirport = arrIcao ? getAirport(arrIcao) : null;

    // Calculate distance from selected airport
    const distanceFromAirport = haversine(
        pilot.latitude, pilot.longitude,
        selectedAirport.lat, selectedAirport.lon
    );

    // Detect flight stage
    const stage = detectFlightStage(pilot, depAirport, arrAirport);

    // Get route info (destination for departures, origin for arrivals)
    const routeIcao = mode === 'dep' ? (arrIcao || 'Unknown') : (depIcao || 'Unknown');
    const routeAirport = mode === 'dep' ? arrAirport : depAirport;
    const routeName = routeAirport ? routeAirport.name : 'Unknown';

    // Calculate ETE (Estimated Time Enroute) based on distance and groundspeed
    let ete = null;
    if (pilot.groundspeed > 50 && distanceFromAirport > 0) {
        const hoursRemaining = distanceFromAirport / pilot.groundspeed;
        ete = hoursRemaining * 60; // Convert to minutes
    }

    return {
        cid: pilot.cid,
        callsign: pilot.callsign,
        name: pilot.name,
        latitude: pilot.latitude,
        longitude: pilot.longitude,
        altitude: pilot.altitude,
        groundspeed: pilot.groundspeed,
        heading: pilot.heading,
        aircraft: flightPlan.aircraft_short || 'Unknown',
        departure: depIcao || 'Unknown',
        arrival: arrIcao || 'Unknown',
        routeIcao,
        routeName,
        stage,
        distanceFromAirport,
        ete,
        depAirport,
        arrAirport,
        logonTime: pilot.logon_time,
        lastUpdated: pilot.last_updated
    };
}

/**
 * Filter and process flights for a specific airport
 * @param {Object} vatsimData - Raw VATSIM data
 * @param {string} icao - Airport ICAO code
 * @param {string} mode - 'dep' or 'arr'
 * @param {Object} selectedAirport - Airport data object
 * @returns {Array<Object>} Processed and filtered flights
 */
export function getFlightsForAirport(vatsimData, icao, mode, selectedAirport) {
    if (!vatsimData || !vatsimData.pilots) {
        return [];
    }

    const upperIcao = icao.toUpperCase();
    const flights = [];

    for (const pilot of vatsimData.pilots) {
        const flightPlan = pilot.flight_plan;

        let include = false;

        if (mode === 'dep') {
            // Include if departing from this airport
            if (flightPlan && flightPlan.departure === upperIcao) {
                include = true;
            }
            // Also include nearby aircraft without flight plan
            else if (!flightPlan || !flightPlan.departure) {
                const dist = haversine(
                    pilot.latitude, pilot.longitude,
                    selectedAirport.lat, selectedAirport.lon
                );
                // Include if within 10nm and on ground or low altitude
                if (dist < 10 && pilot.altitude < 3000) {
                    include = true;
                }
            }
        } else if (mode === 'arr') {
            // Include if arriving at this airport
            if (flightPlan && flightPlan.arrival === upperIcao) {
                include = true;
            }
        }

        if (include) {
            flights.push(processPilot(pilot, selectedAirport, mode));
        }
    }

    // Sort flights alphabetically by route name (origin for arrivals, destination for departures)
    flights.sort((a, b) => a.routeName.localeCompare(b.routeName));

    return flights;
}

/**
 * Get VATSIM data update timestamp
 * @param {Object} vatsimData - VATSIM data object
 * @returns {Date|null} Update timestamp
 */
export function getUpdateTime(vatsimData) {
    if (vatsimData && vatsimData.general && vatsimData.general.update_timestamp) {
        return new Date(vatsimData.general.update_timestamp);
    }
    return null;
}
