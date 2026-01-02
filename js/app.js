/**
 * VATSIM Flight Board - Main Application
 */

import { fetchAirports, getAirport } from './airports.js';
import { fetchAirlines, getAirlineInfo } from './airlines.js';
import { fetchVatsimData, getFlightsForAirport, getUpdateTime } from './vatsim.js';

// Configuration
const CONFIG = {
    REFRESH_INTERVAL: 30000,    // Data refresh every 30 seconds
    PRE_CYCLE_INTERVAL: 15000,  // Pre mode cycle every 15 seconds
};

// Application state
const state = {
    icao: null,
    mode: 'dep',          // 'dep', 'arr', or 'pre'
    displayMode: 'dep',   // Current display mode (for pre cycling)
    airport: null,
    flights: [],
    vatsimData: null,
    isLoading: true,
    error: null,
    refreshTimer: null,
    cycleTimer: null,
    preCountdown: 15,
    // Pagination for pre mode
    currentPage: 0,
    totalPages: 1,
    flightsPerPage: 10,   // Will be calculated based on viewport
};

// DOM Elements
const elements = {
    container: null,
    landingPage: null,
    airportCode: null,
    airportName: null,
    routeHeader: null,
    flightList: null,
    updateTime: null,
    flightCount: null,
    tabDep: null,
    tabArr: null,
    tabPre: null,
    airportForm: null,
    airportInput: null,
};

/**
 * Parse URL to extract ICAO and mode
 * @returns {Object} { icao, mode }
 */
function parseUrl() {
    // Check for redirect path from 404.html
    const redirectPath = sessionStorage.getItem('redirectPath');
    if (redirectPath) {
        sessionStorage.removeItem('redirectPath');
        // Use the stored path
        const parts = redirectPath.split('/').filter(Boolean);
        if (parts.length >= 2) {
            const icao = parts[0].toUpperCase();
            const mode = parts[1].toLowerCase().split('?')[0].split('#')[0];
            if (/^[A-Z]{4}$/.test(icao) && ['dep', 'arr', 'pre'].includes(mode)) {
                // Update URL to match
                history.replaceState({ icao, mode }, '', `/${icao}/${mode}`);
                return { icao, mode };
            }
        }
    }

    const path = window.location.pathname;
    const parts = path.split('/').filter(Boolean);

    if (parts.length >= 2) {
        const icao = parts[0].toUpperCase();
        const mode = parts[1].toLowerCase();

        if (/^[A-Z]{4}$/.test(icao) && ['dep', 'arr', 'pre'].includes(mode)) {
            return { icao, mode };
        }
    }

    return { icao: null, mode: null };
}

/**
 * Update URL without page reload
 */
function updateUrl(icao, mode) {
    const newPath = `/${icao}/${mode}`;
    if (window.location.pathname !== newPath) {
        history.pushState({ icao, mode }, '', newPath);
    }
}

/**
 * Initialize DOM element references
 */
function initElements() {
    elements.container = document.querySelector('.container');
    elements.landingPage = document.getElementById('landingPage');
    elements.airportCode = document.getElementById('airportCode');
    elements.airportName = document.getElementById('airportName');
    elements.routeHeader = document.getElementById('routeHeader');
    elements.flightList = document.getElementById('flightList');
    elements.updateTime = document.getElementById('updateTime');
    elements.flightCount = document.getElementById('flightCount');
    elements.tabDep = document.getElementById('tabDep');
    elements.tabArr = document.getElementById('tabArr');
    elements.tabPre = document.getElementById('tabPre');
    elements.airportForm = document.getElementById('airportForm');
    elements.airportInput = document.getElementById('airportInput');
}

/**
 * Show the landing page
 */
function showLandingPage() {
    elements.landingPage.classList.remove('hidden');
    elements.container.style.display = 'none';
}

/**
 * Hide the landing page and show the board
 */
function showBoard() {
    elements.landingPage.classList.add('hidden');
    elements.container.style.display = 'flex';
}

/**
 * Update tab states
 */
function updateTabs() {
    elements.tabDep.classList.toggle('active', state.mode === 'dep' || (state.mode === 'pre' && state.displayMode === 'dep'));
    elements.tabArr.classList.toggle('active', state.mode === 'arr' || (state.mode === 'pre' && state.displayMode === 'arr'));
    elements.tabPre.classList.toggle('active', state.mode === 'pre');

    // Update route header
    elements.routeHeader.textContent = state.displayMode === 'dep' ? 'Destination' : 'Origin';
}

/**
 * Format flight stage for display
 */
function formatStage(stage) {
    const stageLabels = {
        ground: 'On Ground',
        departing: 'Departing',
        cruising: 'Cruising',
        arriving: 'Arriving'
    };
    return stageLabels[stage] || stage;
}

/**
 * Format ETE (Estimated Time Enroute) for display
 */
function formatEte(eteMinutes) {
    if (eteMinutes === null || eteMinutes === undefined) {
        return '--:--';
    }
    const hours = Math.floor(eteMinutes / 60);
    const minutes = Math.round(eteMinutes % 60);
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Get airline logo URL from Logokit
 */
function getAirlineLogoUrl(website) {
    if (!website) return null;

    // Extract domain from website URL
    try {
        const url = new URL(website);
        const domain = url.hostname.replace('www.', '');
        return `https://img.logokit.com/${domain}?token=pk_fr4c5e5fc1caaa89b3cef3`;
    } catch {
        return null;
    }
}

/**
 * Create a flight row element
 */
function createFlightRow(flight) {
    const row = document.createElement('div');
    row.className = 'flight-row';

    const airlineInfo = getAirlineInfo(flight.callsign);
    const airlineName = airlineInfo.name || 'Unknown Airline';
    const airlineIcao = airlineInfo.prefix || flight.callsign.substring(0, 3).toUpperCase();
    const logoUrl = getAirlineLogoUrl(airlineInfo.website);

    let logoHtml;
    if (logoUrl) {
        logoHtml = `<img class="airline-logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(airlineName)}" onerror="this.outerHTML='<div class=\\'airline-logo unknown\\'>?</div>'">`;
    } else {
        logoHtml = `<div class="airline-logo unknown">?</div>`;
    }

    row.innerHTML = `
        <div class="airline" title="${escapeHtml(airlineName)}">
            ${logoHtml}
            <div class="airline-info">
                <span class="airline-name">${escapeHtml(airlineName)}</span>
                <span class="airline-icao">${escapeHtml(airlineIcao)}</span>
            </div>
        </div>
        <div class="route">
            <span class="route-name">${escapeHtml(flight.routeName)}</span>
            <span class="route-icao">${escapeHtml(flight.routeIcao)}</span>
        </div>
        <div class="status status-${flight.stage}">
            <span class="status-dot"></span>
            ${formatStage(flight.stage)}
        </div>
        <div class="aircraft">${escapeHtml(flight.aircraft)}</div>
        <div class="ete">${formatEte(flight.ete)}</div>
    `;

    return row;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Calculate how many flights fit on the screen
 */
function calculateFlightsPerPage() {
    const boardBody = elements.flightList;
    if (!boardBody) return 8;

    // Approximate row height (including padding and border)
    const rowHeight = 65;
    // Get available height (viewport height minus header, board header, footer, page dots, etc.)
    const viewportHeight = window.innerHeight;
    const availableHeight = viewportHeight - 300; // Reserve extra space for safety

    // Subtract 1 for safety margin
    return Math.max(4, Math.floor(availableHeight / rowHeight) - 1);
}

/**
 * Render page dots for pagination
 */
function renderPageDots() {
    // Remove existing page dots
    const existingDots = document.querySelector('.page-dots');
    if (existingDots) {
        existingDots.remove();
    }

    // Only show dots in pre mode with multiple pages
    if (state.mode !== 'pre' || state.totalPages <= 1) {
        return;
    }

    const dotsContainer = document.createElement('div');
    dotsContainer.className = 'page-dots';

    for (let i = 0; i < state.totalPages; i++) {
        const dot = document.createElement('div');
        dot.className = `page-dot${i === state.currentPage ? ' active' : ''}`;
        dotsContainer.appendChild(dot);
    }

    // Insert after board-body
    elements.flightList.parentNode.appendChild(dotsContainer);
}

/**
 * Render the flight list
 */
function renderFlights() {
    if (state.isLoading) {
        elements.flightList.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Loading flight data...</p>
            </div>
        `;
        return;
    }

    if (state.error) {
        elements.flightList.innerHTML = `
            <div class="error-state">
                <h3>Error</h3>
                <p>${escapeHtml(state.error)}</p>
            </div>
        `;
        return;
    }

    if (state.flights.length === 0) {
        const modeText = state.displayMode === 'dep' ? 'departures from' : 'arrivals to';
        elements.flightList.innerHTML = `
            <div class="empty-state">
                <h3>No Flights</h3>
                <p>No ${modeText} ${state.icao} at this time.</p>
            </div>
        `;
        return;
    }

    // Calculate pagination
    state.flightsPerPage = calculateFlightsPerPage();
    state.totalPages = Math.ceil(state.flights.length / state.flightsPerPage);

    // Ensure current page is valid
    if (state.currentPage >= state.totalPages) {
        state.currentPage = 0;
    }

    // Get flights for current page (in pre mode) or all flights (in normal mode)
    let flightsToShow;
    if (state.mode === 'pre') {
        const startIndex = state.currentPage * state.flightsPerPage;
        const endIndex = startIndex + state.flightsPerPage;
        flightsToShow = state.flights.slice(startIndex, endIndex);
    } else {
        flightsToShow = state.flights;
    }

    elements.flightList.innerHTML = '';
    for (const flight of flightsToShow) {
        elements.flightList.appendChild(createFlightRow(flight));
    }

    // Render page dots
    renderPageDots();
}

/**
 * Update the display with current data
 */
function updateDisplay() {
    // Update airport info
    if (state.airport) {
        elements.airportCode.textContent = state.airport.icao;
        elements.airportName.textContent = state.airport.name;
    } else {
        elements.airportCode.textContent = state.icao || '----';
        elements.airportName.textContent = 'Unknown Airport';
    }

    // Update tabs
    updateTabs();

    // Update flight count
    elements.flightCount.textContent = `${state.flights.length} flight${state.flights.length !== 1 ? 's' : ''}`;

    // Update time (Zulu/UTC)
    if (state.vatsimData) {
        const updateTime = getUpdateTime(state.vatsimData);
        if (updateTime) {
            const hours = updateTime.getUTCHours().toString().padStart(2, '0');
            const minutes = updateTime.getUTCMinutes().toString().padStart(2, '0');
            const seconds = updateTime.getUTCSeconds().toString().padStart(2, '0');
            elements.updateTime.textContent = `${hours}:${minutes}:${seconds}Z`;
        }
    }

    // Render flights
    renderFlights();
}

/**
 * Fetch and process flight data
 */
async function refreshData() {
    if (!state.icao || !state.airport) {
        return;
    }

    try {
        state.vatsimData = await fetchVatsimData();
        state.flights = getFlightsForAirport(
            state.vatsimData,
            state.icao,
            state.displayMode,
            state.airport
        );
        state.error = null;
    } catch (error) {
        console.error('Error refreshing data:', error);
        state.error = 'Failed to fetch flight data. Will retry...';
    }

    state.isLoading = false;
    updateDisplay();
}

/**
 * Start the data refresh timer
 */
function startRefreshTimer() {
    if (state.refreshTimer) {
        clearInterval(state.refreshTimer);
    }

    state.refreshTimer = setInterval(refreshData, CONFIG.REFRESH_INTERVAL);
}

/**
 * Handle pre mode cycling - cycles through pages first, then switches mode
 */
function cyclePre() {
    state.preCountdown = 15;

    // Check if we have more pages to show in current mode
    if (state.currentPage < state.totalPages - 1) {
        // Move to next page
        state.currentPage++;
    } else {
        // No more pages, switch mode and reset to first page
        state.displayMode = state.displayMode === 'dep' ? 'arr' : 'dep';
        state.currentPage = 0;

        // Re-process flights for new mode
        if (state.vatsimData && state.airport) {
            state.flights = getFlightsForAirport(
                state.vatsimData,
                state.icao,
                state.displayMode,
                state.airport
            );
        }
    }

    updateDisplay();
    updatePreIndicator();
}

/**
 * Start pre mode cycling
 */
function startPreCycle() {
    if (state.cycleTimer) {
        clearInterval(state.cycleTimer);
    }

    // Add pre indicator to page
    let indicator = document.querySelector('.pre-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'pre-indicator';
        document.body.appendChild(indicator);
    }

    updatePreIndicator();

    // Countdown timer
    const countdownTimer = setInterval(() => {
        state.preCountdown--;
        if (state.preCountdown <= 0) {
            state.preCountdown = 15;
        }
        updatePreIndicator();
    }, 1000);

    // Cycle timer
    state.cycleTimer = setInterval(cyclePre, CONFIG.PRE_CYCLE_INTERVAL);

    // Store countdown timer for cleanup
    state.countdownTimer = countdownTimer;
}

/**
 * Update pre mode indicator
 */
function updatePreIndicator() {
    const indicator = document.querySelector('.pre-indicator');
    if (indicator) {
        const currentModeLabel = state.displayMode === 'dep' ? 'Departures' : 'Arrivals';
        const hasMorePages = state.currentPage < state.totalPages - 1;

        let nextLabel;
        if (hasMorePages) {
            nextLabel = `Page ${state.currentPage + 2}`;
        } else {
            nextLabel = state.displayMode === 'dep' ? 'Arrivals' : 'Departures';
        }

        let pageInfo = '';
        if (state.totalPages > 1) {
            pageInfo = `<span class="page-info">${currentModeLabel} ${state.currentPage + 1}/${state.totalPages}</span>`;
        }

        indicator.innerHTML = `${pageInfo}<span>Next: ${nextLabel} in <span class="countdown">${state.preCountdown}s</span></span>`;
    }
}

/**
 * Stop pre mode cycling
 */
function stopPreCycle() {
    if (state.cycleTimer) {
        clearInterval(state.cycleTimer);
        state.cycleTimer = null;
    }

    if (state.countdownTimer) {
        clearInterval(state.countdownTimer);
        state.countdownTimer = null;
    }

    const indicator = document.querySelector('.pre-indicator');
    if (indicator) {
        indicator.remove();
    }
}

/**
 * Navigate to a specific airport/mode
 */
async function navigateTo(icao, mode) {
    // Stop existing timers
    stopPreCycle();
    if (state.refreshTimer) {
        clearInterval(state.refreshTimer);
    }

    // Update state
    state.icao = icao.toUpperCase();
    state.mode = mode;
    state.displayMode = mode === 'pre' ? 'dep' : mode;
    state.isLoading = true;
    state.flights = [];
    state.error = null;
    state.currentPage = 0;
    state.totalPages = 1;

    // Update URL
    updateUrl(state.icao, state.mode);

    // Get airport info
    state.airport = getAirport(state.icao);

    // Show board
    showBoard();
    updateDisplay();

    // Start data fetching
    await refreshData();
    startRefreshTimer();

    // Start pre mode cycling if needed
    if (mode === 'pre') {
        startPreCycle();
    }
}

/**
 * Handle tab clicks
 */
function handleTabClick(e) {
    e.preventDefault();
    const mode = e.target.dataset.mode;
    if (mode && state.icao) {
        navigateTo(state.icao, mode);
    }
}

/**
 * Handle form submission
 */
function handleFormSubmit(e) {
    e.preventDefault();

    const icao = elements.airportInput.value.trim().toUpperCase();
    const mode = document.querySelector('input[name="mode"]:checked').value;

    if (/^[A-Z]{4}$/.test(icao)) {
        navigateTo(icao, mode);
    }
}

/**
 * Handle browser back/forward
 */
function handlePopState(e) {
    const { icao, mode } = parseUrl();
    if (icao && mode) {
        navigateTo(icao, mode);
    } else {
        showLandingPage();
    }
}

/**
 * Initialize the application
 */
async function init() {
    console.log('VATSIM Flight Board initializing...');

    // Initialize DOM elements
    initElements();

    // Load data sources
    try {
        await Promise.all([
            fetchAirports(),
            fetchAirlines()
        ]);
    } catch (error) {
        console.error('Failed to load initial data:', error);
    }

    // Set up event listeners
    elements.tabDep.addEventListener('click', handleTabClick);
    elements.tabArr.addEventListener('click', handleTabClick);
    elements.tabPre.addEventListener('click', handleTabClick);
    elements.airportForm.addEventListener('submit', handleFormSubmit);
    window.addEventListener('popstate', handlePopState);

    // Recalculate pagination on resize
    window.addEventListener('resize', () => {
        if (state.mode === 'pre' && state.flights.length > 0) {
            renderFlights();
            updatePreIndicator();
        }
    });

    // Auto-uppercase input
    elements.airportInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
    });

    // Parse URL and initialize
    const { icao, mode } = parseUrl();

    if (icao && mode) {
        await navigateTo(icao, mode);
    } else {
        showLandingPage();
    }

    console.log('VATSIM Flight Board initialized');
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
