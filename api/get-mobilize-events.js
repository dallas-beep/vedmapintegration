const fetch = require('node-fetch');
const { parse } = require('csv-parse/sync');

const SHEET_ID = '1dO027VAM1PwKrv07DkU1tIPMKTbfRMtmr9gU9jppl4s';
const SHEET_GID = '1581051441';
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function geocodeZip(zip) {
  if (!zip || zip.length < 4) return null;
  
  try {
    await sleep(500);
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${zip}+USA`;
    const response = await fetch(url, { headers: { 'User-Agent': 'VedMap' } });
    
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
    const csvText = await response.text();
    const rows = parse(csvText, { skip_empty_lines: true, relax_column_count: true, trim: true });

    const events = [];
    const geoCache = new Map();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[12]) continue;

      const title = row[12].trim();
