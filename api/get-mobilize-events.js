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
    const csvText = await response.text();
    const rows = parse(csvText, { skip_empty_lines: true, relax_column_count: true, trim: true });

    const events = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[12]) continue;

      const title = row[12].trim();
      const showIt = (row[15] || '').trim().toLowerCase();

      if (showIt !== 'yes') continue;

      events.push({
        id: title,
        title: title,
        hostOrganization: (row[2] || '').trim(),
        date: (row[11] || '').trim(),
        time: (row[13] || '').trim(),
        description: (row[19] || '').trim(),
        address: (row[3] || '').trim(),
        zip: (row[7] || '').trim(),
        lat: 40,
        lon: -95
      });
    }

    return res.status(200).json({ count: events.length, data: events });

  } catch (error) {
    return res.status(200).json({ error: error.toString(), count: 0, data: [] });
  }
};
