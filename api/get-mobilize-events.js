const fetch = require('node-fetch');
const { parse } = require('csv-parse/sync');

const SHEET_ID = '1dO027VAM1PwKrv07DkU1tIPMKTbfRMtmr9gU9jppl4s';
const SHEET_GID = '619059883';
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
      bom: true
    });

    const events = [];

    for (const [index, record] of records.entries()) {
      // The sheet's current columns are C=host, J=date, K=event name,
      // L=time, M=location, and O=registration URL.
      const title = String(record.K || '').trim();
      const hostOrganization = String(record.C || '').trim();
      const date = String(record.J || '').trim();
      const time = String(record.L || '').trim();
      const address = String(record.M || '').trim();
      const browserUrl = String(record.O || '').trim();

      if (!title || !address) continue;

      try {
        const geoResponse = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(address)}`,
          { headers: { 'User-Agent': 'VedMapIntegration/1.0 contact: admin@vedmapintegration.vercel.app' } }
        );
        const geoData = await geoResponse.json();
        const geo = geoData && geoData[0];

        if (!geo) {
          console.warn(`Could not geocode row ${index + 2}: ${address}`);
          continue;
        }

        events.push({
          id: `${title}-${index}`,
          title,
          hostOrganization,
          date,
          time,
          description: `${hostOrganization}${date || time ? ` - ${date} ${time}` : ''}`.trim(),
          address,
          city: '',
          state: '',
          zip: '',
          lat: Number(geo.lat),
          lon: Number(geo.lon),
          browserUrl
        });
      } catch (error) {
        console.error(`Geocoding error for ${address}:`, error.message);
      }
    }

    res.status(200).json({
      source: SHEET_CSV_URL,
      count: events.length,
      data: events
    });
  } catch (error) {
    console.error('Error loading Google Sheet events:', error);
    res.status(500).json({ error: error.message });
  }
};
