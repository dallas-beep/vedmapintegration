const fetch = require('node-fetch');
const { parse } = require('csv-parse/sync');

const SHEET_ID = '1DJgMiQT6oMxBvdKFK6bha2EEFkJrNrXYU8U0dEMDhhs';
const SHEET_GID = '0';
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    const response = await fetch(SHEET_CSV_URL, {
      headers: { 'User-Agent': 'VedMapIntegration/1.0' }
    });

    if (!response.ok) {
      throw new Error(`Google Sheets returned ${response.status}`);
    }

    const records = parse(await response.text(), {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      bom: true,
      trim: true
    });

    const events = [];

    for (const [index, record] of records.entries()) {
      const value = (...names) => {
        const key = Object.keys(record).find((column) => names.some((name) => column.trim().toLowerCase() === name.toLowerCase()));
        return key ? String(record[key] || '').trim() : '';
      };

      const title = value('title', 'event title', 'event name', 'name');
      const hostOrganization = value('host', 'host organization', 'organization', 'organizer');
      const date = value('date', 'event date');
      const time = value('time', 'event time');
      const address = value('address', 'location', 'event address', 'street address');
      const city = value('city');
      const state = value('state');
      const zip = value('zip', 'zipcode', 'postal code');
      const browserUrl = value('url', 'link', 'registration', 'registration url', 'event url');
      const suppliedLat = value('lat', 'latitude');
      const suppliedLon = value('lon', 'lng', 'longitude');
      const fullAddress = [address, city, state, zip].filter(Boolean).join(', ');

      if (!title || (!fullAddress && (!suppliedLat || !suppliedLon))) continue;

      let lat = Number(suppliedLat);
      let lon = Number(suppliedLon);

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        const geoResponse = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(fullAddress)}`,
          { headers: { 'User-Agent': 'VedMapIntegration/1.0 contact: admin@vedmapintegration.vercel.app' } }
        );
        const geoData = await geoResponse.json();
        const geo = geoData && geoData[0];
        if (!geo) {
          console.warn(`Could not geocode row ${index + 2}: ${fullAddress}`);
          continue;
        }
        lat = Number(geo.lat);
        lon = Number(geo.lon);
      }

      events.push({
        id: `${title}-${index}`,
        title,
        hostOrganization,
        date,
        time,
        description: value('description', 'details'),
        address: fullAddress,
        city,
        state,
        zip,
        lat,
        lon,
        browserUrl
      });
    }

    res.status(200).json({ source: SHEET_CSV_URL, count: events.length, data: events });
  } catch (error) {
    console.error('Error loading Google Sheet events:', error);
    res.status(500).json({ error: error.message });
  }
};
