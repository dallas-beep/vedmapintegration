const fetch = require('node-fetch');
const { parse } = require('csv-parse/sync');

const SHEET_ID = '1dO027VAM1PwKrv07DkU1tIPMKTbfRMtmr9gU9jppl4s';
const SHEET_GID = '1581051441';
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`;

async function geocode(location) {
  if (!location || location.length < 2) return null;
  
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(location)}`;
    const response = await fetch(url);
    
    if (!response.ok) return null;
    const results = await response.json();
    if (!results[0]) return null;

    const lat = parseFloat(results[0].lat);
    const lon = parseFloat(results[0].lon);
    if (isNaN(lat) || isNaN(lon)) return null;
    return { lat, lon };
  } catch (e) {
    return null;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const response = await fetch(SHEET_CSV_URL);
    if (!response.ok) {
      return res.status(200).json({ count: 0, data: [] });
    }

    const csvText = await response.text();
    const rows = parse(csvText, {
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true
    });

    if (!rows.length) {
      return res.status(200).json({ count: 0, data: [] });
    }

    const events = [];
    const geocodeCache = new Map();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      const title = (row[12] || '').trim();
      const org = (row[2] || '').trim();
      const city = (row[3] || '').trim();
      const zip = (row[7] || '').trim();
