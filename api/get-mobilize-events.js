const fetch = require('node-fetch');
const { parse } = require('csv-parse/sync');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    const SHEET_ID = '1dO027VAM1PwKrv07DkU1tIPMKTbfRMtmr9gU9jppl4s';
    const GID = '1581051441';
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

    const response = await fetch(csvUrl);
    if (!response.ok) {
      return res.status(200).json({ count: 0, data: [] });
    }

    const csvText = await response.text();
    const rows = parse(csvText, { skip_empty_lines: true, relax_column_count: true });

    const events = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      const org = (row[2] || '').trim();
      const zip = (row[7] || '').trim();
      let date = (row[11] || '').trim();
      const activityName = (row[12] || '').trim();
      let time = (row[13] || '').trim();
      const location = (row[14] || '').trim();
      const isPublic = (row[15] || '').trim().toLowerCase();
      let description = (row[18] || '').trim();
      const canPromote = (row[21] || '').trim().toLowerCase();
      const canShare = (row[22] || '').trim().toLowerCase();
      const lat = row[35] ? parseFloat(row[35]) : null;
      const lon = row[36] ? parseFloat(row[36]) : null;

      // Filter: must be "Yes"
