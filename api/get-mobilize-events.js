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
    if (!response.ok) return res.status(200).json({ count: 0, data: [] });

    const csvText = await response.text();
    const records = parse(csvText, { columns: true, skip_empty_lines: true });

    const events = [];

    for (const record of records) {
      const org = (record['What organization do you represent?'] || '').trim();
      const zip = (record['Zipcode'] || '').trim();
      let date = (record['Date'] || '').trim();
      const activityName = (record['Event/activity name'] || '').trim();
      let time = (record['\nStart time / End time '] || '').trim();
      const location = (record['Location of the event (please include State/County)'] || '').trim();
      const isPublic = (record['Is this event open to the public? '] || '').trim();
      let description = (record['Details'] || '').trim();
      const canShare = (record['Can we share your event publicly as part of Vote Early Day?'] || '').trim();

      if (!activityName || !location) continue;
      if
