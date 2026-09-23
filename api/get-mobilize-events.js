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
      return res.status(200).json({ error: 'Failed to fetch', data: [] });
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

    const debug = [];
    for (let i = 1; i <= 3 && i < rows.length; i++) {
      const row = rows[i];
      debug.push({
        rowNum: i,
        col2_org: row[2],
        col3_city: row[3],
        col7_zip: row[7],
        col11_date: row[11],
        col12_title: row[12],
        col13_time: row[13],
        col15_show: row[15],
        col19_desc: row[19]
      });
    }

    return res.status(200).json({ 
      debug,
      totalRows: rows.length,
      data: [] 
    });

  } catch (error) {
    return res.status(200).json({ 
      error: error.message,
      data: [] 
    });
  }
};
