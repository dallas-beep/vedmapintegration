<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ved Map Integration</title>

  <!-- Leaflet CSS -->
  <link
    rel="stylesheet"
    href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    crossorigin=""
  />

  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      height: 100%;
      width: 100%;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    #map {
      height: 100vh;
      width: 100vw;
      z-index: 1;
    }

    /* Small dark title badge from screenshot */
    .title-badge {
      position: absolute;
      top: 12px;
      left: 12px;
      z-index: 1001;
      background: rgba(30, 41, 59, 0.85);
      color: #ffffff;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.3px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
      pointer-events: none;
    }

    /* Floating Search Bar container positioned clear of Leaflet zoom controls */
    .search-wrapper {
      position: absolute;
      top: 10px;
      left: 62px; /* Clears standard Leaflet +/- control buttons */
      z-index: 1000;
      width: calc(100% - 80px);
      max-width: 460px;
    }

    .search-input {
      width: 100%;
      padding: 10px 16px;
      font-size: 14px;
      color: #1e293b;
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.15);
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      outline: none;
      transition: all 0.2s ease;
    }

    .search-input:focus {
      border-color: #2563eb;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.25);
    }

    /* Popup Styling */
    .leaflet-popup-content-wrapper {
      border-radius: 8px;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
      padding: 6px;
    }
    .popup-container {
      font-size: 13px;
      line-height: 1.45;
      color: #334155;
      min-width: 200px;
      max-width: 280px;
    }
    .popup-title {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 6px;
    }
    .popup-row {
      margin-bottom: 4px;
    }
    .popup-row strong {
      color: #1e293b;
    }
    .popup-link-btn {
      display: inline-block;
      margin-top: 8px;
      padding: 7px 14px;
      background-color: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 600;
      font-size: 13px;
      border-radius: 6px;
      text-align: center;
      transition: background 0.15s ease;
    }
    .popup-link-btn:hover {
      background-color: #1d4ed8;
    }
  </style>
</head>
<body>

  <!-- Small Title Badge -->
  <div class="title-badge">Ved Map Integration</div>

  <!-- Search Bar -->
  <div class="search-wrapper">
    <input 
      type="text" 
      id="mapSearch" 
      class="search-input" 
      placeholder="Search events, organizations, cities..." 
      autocomplete="off"
    />
  </div>

  <!-- Leaflet Map Container -->
  <div id="map"></div>

  <!-- Leaflet JavaScript -->
  <script
    src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    crossorigin=""
  ></script>

  <script>
    // 1. Initialize Leaflet Map
    const map = L.map('map', {
      zoomControl: true
    }).setView([39.8283, -98.5795], 4);

    // Reposition zoom controls slightly lower so badge doesn't overlap
    map.zoomControl.setPosition('topleft');

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    let allEvents = [];
    const markerLayer = L.featureGroup().addTo(map);

    // 2. Render Markers & Linked Popups
    function renderMarkers(events) {
      markerLayer.clearLayers();

      if (!events || events.length === 0) return;

      events.forEach((item) => {
        const marker = L.marker([item.lat, item.lon]);

        const popupHtml = `
          <div class="popup-container">
            <div class="popup-title">${item.title || 'Untitled Event'}</div>
            ${item.hostOrganization ? `<div class="popup-row"><strong>Host:</strong> ${item.hostOrganization}</div>` : ''}
            ${item.date || item.time ? `<div class="popup-row"><strong>When:</strong> ${item.date} ${item.time}</div>` : ''}
            ${item.address ? `<div class="popup-row"><strong>Where:</strong> ${item.address}</div>` : ''}
            ${item.browserUrl ? `<a class="popup-link-btn" href="${item.browserUrl}" target="_blank" rel="noopener noreferrer">RSVP / Details</a>` : ''}
          </div>
        `;

        marker.bindPopup(popupHtml);
        markerLayer.addLayer(marker);
      });

      // Fit map around available pins
      map.fitBounds(markerLayer.getBounds(), { padding: [50, 50], maxZoom: 12 });
    }

    // 3. Search Bar Listener
    document.getElementById('mapSearch').addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();

      if (!q) {
        renderMarkers(allEvents);
        return;
      }

      const filtered = allEvents.filter((item) => {
        return (
          (item.title && item.title.toLowerCase().includes(q)) ||
          (item.hostOrganization && item.hostOrganization.toLowerCase().includes(q)) ||
          (item.address && item.address.toLowerCase().includes(q)) ||
          (item.date && item.date.toLowerCase().includes(q))
        );
      });

      renderMarkers(filtered);
    });

    // 4. Load from backend API
    fetch('/api/get-mobilize-events')
      .then((res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then((payload) => {
        allEvents = payload.data || [];
        renderMarkers(allEvents);
      })
      .catch((err) => {
        console.error('Error fetching event data:', err);
      });
  </script>
</body>
</html>
