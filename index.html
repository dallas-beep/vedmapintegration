<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Community Events Map</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 16px;
            background-color: #f9f9f9;
            color: #333;
        }
        .community-map-wrapper {
            display: grid;
            grid-template-columns: 380px 1fr;
            gap: 20px;
            height: 88vh;
            min-height: 550px;
            max-width: 1400px;
            margin: 0 auto;
            box-sizing: border-box;
        }
        @media (max-width: 900px) {
            .community-map-wrapper {
                grid-template-columns: 1fr;
                height: auto;
            }
            #interactiveMapContainer { height: 450px; }
        }
        
        .map-sidebar-panel {
            display: flex;
            flex-direction: column;
            gap: 14px;
            height: 100%;
            box-sizing: border-box;
        }

        .search-controls-wrapper {
            display: flex;
            flex-direction: column;
            gap: 10px;
            background: #ffffff;
            padding: 16px;
            border-radius: 12px;
            border: 1px solid #e0e0e0;
            box-shadow: 0 2px 5px rgba(0,0,0,0.03);
        }

        .search-bar-container {
            position: relative;
            display: flex;
            align-items: center;
        }
        .search-bar-container input {
            width: 100%;
            padding: 12px 48px 12px 16px;
            border: 1px solid #ddd;
            border-radius: 30px;
            font-size: 14px;
            outline: none;
            background: #ffffff;
            transition: border-color 0.2s;
        }
        .search-bar-container input:focus {
            border-color: #551b7a;
        }
        .search-icon-btn {
            position: absolute;
            right: 6px;
            background-color: #551b7a;
            color: #ffffff;
            border: none;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: background 0.2s;
        }
        .search-icon-btn:hover {
            background-color: #6cb090;
        }
        .search-icon-btn svg {
            width: 16px;
            height: 16px;
            fill: currentColor;
        }

        .radius-select-group {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .radius-select-group label {
            font-size: 13px;
            font-weight: 600;
            color: #551b7a;
            white-space: nowrap;
        }
        .radius-select-group select {
            flex: 1;
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 8px;
            font-size: 13px;
            background: #fff;
            outline: none;
            cursor: pointer;
        }

        .events-list-title {
            margin: 0;
            font-size: 18px;
            font-weight: 700;
            color: #111;
        }
        
        .event-sidebar-list {
            background: transparent;
            overflow-y: auto;
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 12px;
            padding-right: 4px;
        }
        
        .sidebar-event-card {
            padding: 16px;
            border: 1px solid #e0e0e0;
            cursor: pointer;
            border-radius: 12px;
            background: #ffffff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.02);
            transition: all 0.2s ease;
        }
        .sidebar-event-card:hover {
            border-color: #6cb090;
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.05);
        }
        .sidebar-event-card h4 {
            margin: 0 0 4px 0;
            color: #551b7a;
            font-size: 16px;
            font-weight: 700;
            line-height: 1.2;
        }
        .sidebar-event-card p {
            margin: 0;
            font-size: 13px;
            color: #6cb090;
            font-weight: 500;
        }
        .event-card-placeholder {
            padding: 24px;
            text-align: center;
            color: #777;
            font-size: 14px;
            background: #ffffff;
            border-radius: 12px;
            border: 1px solid #e0e0e0;
        }

        .map-status-bar {
            font-size: 12px;
            color: #ffffff;
            background: #551b7a;
            padding: 10px 16px;
            border-radius: 8px;
            font-weight: 600;
            text-align: center;
            box-shadow: 0 2px 4px rgba(85,27,122,0.2);
        }

        #interactiveMapContainer {
            width: 100%;
            height: 100%;
            min-height: 500px;
            border-radius: 12px;
            border: 1px solid #e0e0e0;
            box-shadow: 0 2px 6px rgba(0,0,0,0.04);
            z-index: 1;
        }

        .map-popup-box h3 { 
            color: #551b7a; 
            margin: 0 0 8px 0; 
            font-size: 16px; 
        }
        .map-popup-box p { 
            margin: 4px 0; 
            font-size: 13px; 
            color: #444; 
        }
        .rsvp-btn-popup {
            display: inline-block;
            margin-top: 10px;
            background-color: #551b7a;
            color: #ffffff !important;
            padding: 8px 14px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            font-size: 13px;
            transition: background 0.2s;
        }
        .rsvp-btn-popup:hover { 
            background-color: #6cb090; 
        }
    </style>
</head>
<body>

<div class="community-map-wrapper">
    <div class="map-sidebar-panel">
        <div class="search-controls-wrapper">
            <div class="search-bar-container">
                <input type="text" id="zipSearchInput" placeholder="Filter by city, state, or zip..." />
                <button id="searchBtn" class="search-icon-btn" type="button" aria-label="Search">
                    <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                </button>
            </div>
            <div class="radius-select-group">
                <label for="radiusSelect">Radius:</label>
                <select id="radiusSelect">
                    <option value="all">Any distance</option>
                    <option value="1">&lt; 1 mile</option>
                    <option value="5">5 miles</option>
                    <option value="10">10 miles</option>
                    <option value="15">15 miles</option>
                    <option value="20">20 miles</option>
                    <option value="25">25 miles</option>
                </select>
            </div>
        </div>

        <h3 class="events-list-title">Events List</h3>

        <div class="event-sidebar-list" id="eventSidebarList">
            <div class="event-card-placeholder">Loading events...</div>
        </div>
        <div class="map-status-bar" id="mapStatus">Connecting...</div>
    </div>

    <div id="interactiveMapContainer"></div>
</div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>

<script>
    let map;
    let markersLayer;
    let resolvedEvents = [];
    let filteredEvents = [];

    document.addEventListener("DOMContentLoaded", function () {
        map = L.map('interactiveMapContainer').setView([39.8283, -98.5795], 4);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
            maxZoom: 18,
            attribution: '&copy; OpenStreetMap contributors' 
        }).addTo(map);
        
        markersLayer = L.layerGroup().addTo(map);
        loadEvents();
    });

    async function loadEvents() {
        document.getElementById('mapStatus').innerText = "Loading events...";
        try {
            const response = await fetch('/api/get-mobilize-events');

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            resolvedEvents = [];

            if (data.data && Array.isArray(data.data)) {
                for (const event of data.data) {
                    if (event.lat && event.lon) {
                        resolvedEvents.push({
                            id: event.id,
                            title: event.title,
                            hostOrganization: event.hostOrganization || '',
                            date: event.date || '',
                            time: event.time || '',
                            description: event.description || '',
                            address: event.address || '',
                            city: event.city || '',
                            state: event.state || '',
                            zip: event.zip || '',
                            lat: parseFloat(event.lat),
                            lon: parseFloat(event.lon),
                            browserUrl: event.browserUrl || ''
                        });
                    }
                }
            }

            document.getElementById('mapStatus').innerText = `${resolvedEvents.length} events live`;
            filterEvents();

        } catch (error) {
            console.error('Error:', error);
            document.getElementById('mapStatus').innerText = "Error loading events";
        }
    }

    function renderMap() {
        markersLayer.clearLayers();

        filteredEvents.forEach(event => {
            const marker = L.marker([event.lat, event.lon]).addTo(markersLayer);
            
            const popupContent = `
                <div class="map-popup-box">
                    <h3>${event.title}</h3>
                    ${event.hostOrganization ? `<p><strong>Host Organization:</strong> ${event.hostOrganization}</p>` : ''}
                    ${event.date ? `<p><strong>Date:</strong> ${event.date}</p>` : ''}
                    ${event.time ? `<p><strong>Time:</strong> ${event.time}</p>` : ''}
                    ${event.address ? `<p><strong>Location:</strong> ${event.address}</p>` : ''}
                    ${event.browserUrl ? `<a href="${event.browserUrl}" target="_blank" class="rsvp-btn-popup">Registration Form</a>` : ''}
                </div>
            `;
            
            marker.bindPopup(popupContent);
        });

        updateSidebar();
    }

    function updateSidebar() {
        const sidebar = document.getElementById('eventSidebarList');
        sidebar.innerHTML = '';

        if (filteredEvents.length === 0) {
            sidebar.innerHTML = '<div class="event-card-placeholder">No events found</div>';
            return;
        }

        filteredEvents.forEach(event => {
            const card = document.createElement('div');
            card.className = 'sidebar-event-card';
            card.innerHTML = `
                <h4>${event.title}</h4>
                <p>${event.address}</p>
            `;
            card.addEventListener('click', () => {
                map.setView([event.lat, event.lon], 13);
            });
            sidebar.appendChild(card);
        });
    }

    function filterEvents() {
        const searchQuery = document.getElementById('zipSearchInput').value.toLowerCase();

        filteredEvents = resolvedEvents.filter(event => {
            return !searchQuery || 
                event.title.toLowerCase().includes(searchQuery) ||
                event.address.toLowerCase().includes(searchQuery) ||
                event.city.toLowerCase().includes(searchQuery) ||
                event.state.toLowerCase().includes(searchQuery) ||
                event.zip.includes(searchQuery);
        });

        renderMap();
    }

    document.getElementById('searchBtn').addEventListener('click', filterEvents);
    document.getElementById('zipSearchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') filterEvents();
    });
    document.getElementById('zipSearchInput').addEventListener('input', filterEvents);
</script>

</body>
</html>
