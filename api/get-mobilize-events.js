const fetch = require('node-fetch');
const { parse } = require('csv-parse/sync');

const SHEET_ID = '1dO027VAM1PwKrv07DkU1tIPMKTbfRMtmr9gU9jppl4s';
const SHEET_GID = '1581051441';
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const response = await fetch(SHEET_CSV_URL);
    if (!response.ok) {
      return res.json({ count: 0, data: [] });
    }

    const csvText = await response.text();
    let rows = [];

    try {
      rows = parse(csvText, { skip_empty_lines: true, relax_column_count: true, trim: true });
    } catch (parseErr) {
      return res.json({ count: 0, data: [], parseError: parseErr.message });
    }

    const events = [];

    for (let i = 1; i < rows.length; i++) {
      try {
        const row = rows[i];
        if (!row) continue;
        if (!row[12]) continue;

        const showIt = (row[15] || '').toLowerCase();
        if (showIt !== 'yes') continue;

        events.push({
          id: `event-${i}`,
          title: (row[12] || '').trim(),
          hostOrganization: (row[2] || '').trim(),
          date: (row[11] || '').trim(),
          time: (row[13] || '').trim(),
          description: (row[19] || '').trim(),
          address: (row[3] || '').trim(),
          zip: (row[7] || '').trim(),
          lat: 39.8283,
          lon: -98.5795
        });
      } catch (rowErr) {
        continue;
      }
    }

    res.json({ count: events.length, data: events });

  } catch (error) {
    res.json({ count: 0, data: [], error: error.message });
  }
};
