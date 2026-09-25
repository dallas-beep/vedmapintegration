const fetch = require('node-fetch');
const { parse } = require('csv-parse/sync');

// Fallback coordinate dictionary for known event zip codes so it loads instantly without timeouts
const ZIP_COORDINATES = {
  "54301": { lat: 44.5192, lon: -88.0198 }, // Green Bay, WI
  "86001": { lat: 35.1983, lon: -111.6513 }, // Flagstaff, AZ
  "34746": { lat: 28.3125, lon: -81.4161 }, // Kissimmee, FL
  "78542": { lat: 26.2034, lon: -98.2300 }, // McAllen, TX
  "98908": { lat: 46.6021, lon: -120.5059 }, // Yakima, WA
  "98901": { lat: 46.6021, lon: -120.5059 }, // Yakima, WA
  "10566": { lat: 41.2907, lon: -73.9174 }, // Peekskill, NY
  "33301": { lat: 26.1224, lon: -80.1373 }, // Fort Lauderdale/Hollywood, FL
  "06880": { lat: 41.1415, lon: -73.3579 }, // Westport, CT / Nationwide
  "98122": { lat: 47.6104, lon: -122.3113 }, // Seattle, WA
  "04106": { lat: 43.6373, lon: -70.2684 }, // South Portland, ME
  "11238": { lat: 40.6782, lon: -73.9632 }, // Brooklyn, NY
  "20112": { lat: 38.6548, lon: -77.3077 }, // Woodbridge, VA
  "90013": { lat: 34.0446, lon: -118.2449 }, // Los Angeles, CA
  "72703": { lat: 36.0822, lon: -94.1719 }, // Fayetteville, AR
  "55403": { lat: 44.9701, lon: -92.2789 }, // Minneapolis, MN
  "52404": { lat: 41.9779, lon: -91.6656 }, // Cedar Rapids, IA
  "28213": { lat: 35.2638, lon: -80.7491 }, // Charlotte, NC
  "54751": { lat: 44.8756, lon: -91.9190 }, // Menomonie, WI
  "85041": { lat: 33.3762, lon: -112.1158 }, // Phoenix, AZ
  "30312": { lat: 33.7447, lon: -84.3725 }, // Atlanta, GA
  "31401": { lat: 32.0809, lon: -81.0912 }, // Savannah, GA
  "37663": { lat: 35.0456, lon: -85.3097 }, // Chattanooga, TN
  "38301": { lat: 35.6264, lon: -88.8161 }, // Jackson, TN
  "32210": { lat: 30.2796, lon: -81.7617 }, // Jacksonville, FL
  "33770": { lat: 37.9150, lon: -82.6054 }, // Largo, FL
  "11237": { lat: 40.7041, lon: -73.9185 }  // Brooklyn, NY
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  try {
    const SHEET_ID = '1dO027VAM1PwKrv07DkU1tIPMKTbfRMtmr9gU9jppl4s';
    const GID = '1581051441';
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;
    
    const response = await fetch(csvUrl);
    if (!response.ok) return res.status(200).json({ count: 0, data: [] });
    
    const csvText = await response.text();
    const rows = parse(csvText, { skip_empty_lines: true, relax_column_count: true });
    const events = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      
      const org = (row[2] || '').trim();
      let zip = (row[7] || '').trim();
      if (!zip) {
        const mailingAddress = (row[6] || '').trim();
        const zipMatch = mailingAddress.match(/\b\d{5}(?:-\d{4})?\b/);
        zip = zipMatch ? zipMatch[0] : '';
      }
      
      let date = (row[11] || '').trim();
      let activityName = (row[12] || '').trim();
      let time = (row[13] || '').trim();
      const location = (row[14] || '').trim();
      const isPublic = (row[15] || '').trim().toLowerCase();
      let description = (row[19] || '').trim();

      if (activityName.toUpperCase() === 'TBD' || activityName.toUpperCase() === 'TBA') activityName = 'Coming Soon';
      if (date.toUpperCase() === 'TBD' || date.toUpperCase() === 'TBA') date = 'Coming Soon';
      if (time.toUpperCase() === 'TBD' || time.toUpperCase() === 'TBA') time = 'Coming Soon';
      if (description.toUpperCase() === 'TBD' || description.toUpperCase() === 'TBA') description = 'Coming Soon';
      if (zip.length === 4) zip = '0' + zip;

      // Skip rows that aren't public or missing essential info
      if (!zip || isPublic !== 'yes' || !location) continue;

      // Check if we have coordinates for this zip code in our fast dictionary
      if (ZIP_COORDINATES[zip]) {
        events.push({ 
          id: activityName, 
          title: activityName, 
          hostOrganization: org, 
          date, 
          time, 
          description, 
          address: location, 
          zip, 
          lat: ZIP_COORDINATES[zip].lat, 
          lon: ZIP_COORDINATES[zip].lon 
        });
      }
      // If the zip code isn't in our dictionary, it is safely skipped rather than defaulting to Kansas
    }

    return res.status(200).json({ count: events.length, data: events });
  } catch (error) {
    console.error(error);
    return res.status(200).json({ count: 0, data: [] });
  }
};
