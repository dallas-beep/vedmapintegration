const fetch = require('node-fetch');
const { parse } = require('csv-parse/sync');

const SHEET_ID = '1dO027VAM1PwKrv07DkU1tIPMKTbfRMtmr9gU9jppl4s';
const SHEET_GID = '1581051441';
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`;
const USER_AGENT = 'VedMapIntegration/1.0 (event map)';

const clean = (value) => String(value ?? '')
  .replace(/^\uFEFF/, '')
  .replace(/\r/g, '')
  .trim();

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const response = await fetch(SHEET_CSV_URL, { headers: { 'User-Agent': USER_AGENT } });
    const csvText = await response.text();

    const rows = parse(csvText, {
      skip_empty_lines: true,
      relax_column_count: true,
      bom: true,
      trim: true
    });

    const headerIndex = rows.findIndex((row) => {
      const rowText = row.join('|').toLowerCase();
      return rowText.includes('event') && (rowText.includes('organization') || rowText.includes('location'));
    });
    
    const headers = rows[headerIndex];

    return res.status(200).json({ 
      debug: {
        headerIndex,
        headers: headers,
        firstDataRow: rows[headerIndex + 1],
        secondDataRow: rows[headerIndex + 2]
      },
      data: []
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
