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
      return res.status(200).json({ error: 'Failed to fetch sheet', data: [] });
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

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      const title = (row[12] || '').trim();
      const org = (row[2] || '').trim();
      const city = (row[3] || '').trim();
      const zip = (row[7] || '').trim();
      const date = (row[11] || '').trim();
      const time = (row[13] || '').trim();
      const desc = (row[19] || '').trim();
      const showIt = (row[15] || '').trim().toLowerCase();

      if (!title || showIt !== 'yes') continue;

      events.push({
        id: title,
        title,
        hostOrganization: org,
        date,
        time,
        description: desc,
        address: city,
        zip,
        lat: 0,
        lon: 0
      });
    }

    return res.status(200).json({ 
      count: events.length,
      data: events 
    });

  } catch (error) {
    return res.status(200).json({ 
      error: error.message,
      data: [] 
    });
  }
};
