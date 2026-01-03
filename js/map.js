/**
 * Flight Map - Leaflet.js integration for VATSIM flight visualization
 */

import { getAirlineInfo } from './airlines.js';

let map = null;
let airportMarker = null;
let flightMarkers = [];
let routeLines = [];

// Stage colors matching CSS variables
const stageColors = {
    departing: '#eab308',  // yellow
    cruising: '#3b82f6',   // blue
    arriving: '#22c55e',   // green
    ground: '#606070'      // muted
};

/**
 * Create a custom aircraft icon as SVG
 * @param {number} heading - Aircraft heading in degrees
 * @param {string} stage - Flight stage for color
 * @returns {L.DivIcon} Leaflet div icon
 */
function createAircraftIcon(heading, stage) {
    const color = stageColors[stage] || stageColors.cruising;
    const rotation = heading || 0;

    const svgHtml = `
        <div style="transform: rotate(${rotation}deg); transform-origin: center;">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="${color}">
                <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
            </svg>
        </div>
    `;

    return L.divIcon({
        html: svgHtml,
        className: 'aircraft-icon',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
}

/**
 * Create airport marker icon
 * @returns {L.DivIcon} Leaflet div icon
 */
function createAirportIcon() {
    const svgHtml = `
        <div class="airport-marker">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="#3b82f6">
                <circle cx="12" cy="12" r="10" fill="#3b82f6" stroke="#fff" stroke-width="2"/>
                <circle cx="12" cy="12" r="4" fill="#fff"/>
            </svg>
        </div>
    `;

    return L.divIcon({
        html: svgHtml,
        className: 'airport-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });
}

/**
 * Initialize the Leaflet map
 * @param {Object} airport - Airport data with lat/lon
 */
export function initMap(airport) {
    // Clean up existing map
    if (map) {
        map.remove();
        map = null;
    }

    flightMarkers = [];
    routeLines = [];

    // Create map centered on airport
    map = L.map('flightMap', {
        center: [airport.lat, airport.lon],
        zoom: 7,
        zoomControl: true,
        attributionControl: true
    });

    // Add dark tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    // Add airport marker
    airportMarker = L.marker([airport.lat, airport.lon], {
        icon: createAirportIcon()
    }).addTo(map);

    airportMarker.bindPopup(`<strong>${airport.icao}</strong><br>${airport.name}`);

    return map;
}

/**
 * Update flight markers on the map
 * @param {Array} flights - Array of flight data
 * @param {Object} airport - Airport data
 * @param {string} mode - 'dep' or 'arr'
 */
export function updateFlights(flights, airport, mode) {
    if (!map) return;

    // Clear existing markers and lines
    flightMarkers.forEach(marker => map.removeLayer(marker));
    routeLines.forEach(line => map.removeLayer(line));
    flightMarkers = [];
    routeLines = [];

    // Add flight markers
    flights.forEach(flight => {
        // Skip if no valid position
        if (!flight.latitude || !flight.longitude) return;

        // Get airline info for popup
        const airlineInfo = getAirlineInfo(flight.callsign);
        const airlineName = airlineInfo.name || 'Unknown Airline';

        // Create marker
        const marker = L.marker([flight.latitude, flight.longitude], {
            icon: createAircraftIcon(flight.heading, flight.stage)
        }).addTo(map);

        // Create popup content
        const routeLabel = mode === 'dep' ? 'To' : 'From';
        const popupContent = `
            <div class="flight-popup">
                <strong>${flight.callsign}</strong><br>
                ${airlineName}<br>
                <span class="popup-detail">${routeLabel}: ${flight.routeName} (${flight.routeIcao})</span><br>
                <span class="popup-detail">Aircraft: ${flight.aircraft}</span><br>
                <span class="popup-detail">Alt: ${flight.altitude.toLocaleString()} ft</span><br>
                <span class="popup-detail">GS: ${flight.groundspeed} kts</span>
            </div>
        `;

        marker.bindPopup(popupContent);
        flightMarkers.push(marker);

        // Draw route line from aircraft to airport
        const lineColor = stageColors[flight.stage] || stageColors.cruising;
        const routeLine = L.polyline(
            [[flight.latitude, flight.longitude], [airport.lat, airport.lon]],
            {
                color: lineColor,
                weight: 2,
                opacity: 0.5,
                dashArray: '5, 10'
            }
        ).addTo(map);

        routeLines.push(routeLine);
    });

    // Fit bounds to show all flights plus airport
    if (flights.length > 0) {
        const bounds = L.latLngBounds([[airport.lat, airport.lon]]);
        flights.forEach(flight => {
            if (flight.latitude && flight.longitude) {
                bounds.extend([flight.latitude, flight.longitude]);
            }
        });
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}

/**
 * Destroy the map instance
 */
export function destroyMap() {
    if (map) {
        map.remove();
        map = null;
    }
    flightMarkers = [];
    routeLines = [];
    airportMarker = null;
}

/**
 * Check if map is initialized
 * @returns {boolean}
 */
export function isMapInitialized() {
    return map !== null;
}

/**
 * Invalidate map size (call after container becomes visible)
 */
export function invalidateSize() {
    if (map) {
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }
}
