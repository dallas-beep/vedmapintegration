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

    console.log(`Total records: ${records.length}`);
    const events = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      const zip = (record['Zipcode'] || '').trim();
      const isPublic = (record['Is this event open to the public? '] || '').trim();
      const canShare = (record['Can we share your event publicly as part of Vote Early Day?'] || '').trim();
      const activityName = (record['Event/activity name'] || '').trim();
      const location = (record['Location of the event (please include State/County)'] || '').trim();

      console.log(`Record ${i}: zip="${zip}", isPublic="${isPublic}", canShare="${canShare}", activity="${activityName}", location="${location}"`);

      if (!zip) {
        console.log(`  SKIP: no zip`);
        continue;
      }
      if (isPublic.toLowerCase() !== 'yes') {
        console.log(`  SKIP: isPublic="${isPublic}" not yes`);
        continue;
      }
      if (canShare.toLowerCase() !== 'yes') {
        console.log(`  SKIP: canShare="${canShare}" not yes`);
        continue;
      }
      if (!activityName || !location) {
        console.log(`  SKIP: missing activity or location`);
        continue;
      }

      console.log(`  PASSED FILTERS`);

      const org = (record['What organization do you represent?'] || '').trim();
      let date = (record['Date'] ||
