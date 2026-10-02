const fetch = require('node-fetch');
const { parse } = require('csv-parse/sync');

const ZIP_COORDINATES = {
  "54301": { lat: 44.5192, lon: -88.0198 },
  "86001": { lat: 35.1983, lon: -111.6513 },
  "34746": { lat: 28.3125, lon: -81.4161 },
  "78542": { lat: 26.2034, lon: -98.2300 },
  "98908": { lat: 46.6021, lon: -120.5059 },
  "98901": { lat: 46.6021, lon: -120.5059 },
  "10566": { lat: 41.2907, lon: -73.9174 },
  "33301": { lat: 26.1224, lon: -80.1373 },
  "06880": { lat: 41.1415, lon: -73.3579 },
  "98122": { lat: 47.6104, lon: -122.3113 },
  "04106": { lat: 43.6373, lon: -70.2684 },
  "11238": { lat: 40.6782, lon: -73.9632 },
  "20112": { lat: 38.6548, lon: -77.3077 },
  "90013": { lat: 34.0446, lon: -118.2449 },
  "72703": { lat: 36.0822, lon: -94.1719 },
  "55403": { lat: 44.9701, lon: -92.2789 },
  "52404": { lat: 41.9779, lon: -91.6656 },
  "28213": { lat: 35.2638, lon: -80.7491 },
  "54751": { lat: 44.8756, lon: -91.9190 },
  "85041": { lat: 33.3762, lon: -112.1158 },
  "30312": { lat: 33.7447, lon: -84.3725 },
  "31401": { lat: 32.0809, lon: -81.0912 },
  "37663": { lat: 35.0456, lon: -85.3097 },
  "38301": { lat: 35.6264, lon: -88.8161 },
  "32210": { lat: 30.2796, lon: -81.7617 },
  "32224": { lat: 30.2796, lon: -81.7617 },
  "33770": { lat: 37.9150, lon: -82.6054 },
  "11237": { lat: 40.7041, lon: -73.9185 },
  "53144": { lat: 42.5848, lon: -87.8237 },
  "28398": { lat: 36.3857, lon: -80.1125 },
  "43606": { lat: 41.6639, lon: -83.5814 },
  "76542": { lat: 31.1090, lon: -97.2272 },
  "72601": { lat: 36.2427, lon: -92.6390 },
  "93274": { lat: 36.2471, lon: -119.7674 },
  "46803": { lat: 41.1344, lon: -85.1333 },
  "30088": { lat: 33.9876, lon: -84.0948 },
  "44114": { lat: 41.4976, lon: -81.6957 },
  "30071": { lat: 33.9498, lon: -84.2111 },
  "30161": { lat: 34.2597, lon: -85.2439 },
  "19119": { lat: 39.9526, lon: -75.2521 },
  "08028": { lat: 39.8036, lon: -75.1937 },
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
    let requestCount = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      
      const org = (row[2] || '').trim();
      let zip = (row[7] || '').trim();
      const mailingAddress = (row[6] || '').trim();
      
      let date = (row[11] || '').trim();
      let activityName = (row[12] || '').trim();
      let time = (row[13] || '').trim();
      const location = (row[14] || '').trim();
      const isPublic = (row[15] || '').trim().toLowerCase();
      const registrationLink = (row[16] || '').trim();
      let description = (row[19] || '').trim();

      if (activityName.toUpperCase() === 'TBD' || activityName.toUpperCase() === 'TBA') activityName = 'Coming Soon';
      if (date.toUpperCase() === 'TBD' || date.toUpperCase() === 'TBA') date = 'Coming Soon';
      if (time.toUpperCase() === 'TBD' || time.toUpperCase() === 'TBA') time = 'Coming Soon';
      if (description.toUpperCase() === 'TBD' || description.toUpperCase() === 'TBA') description = 'Coming Soon';
      if (zip.length === 4) zip = '0' + zip;

      if (isPublic !== 'yes') continue;

      let lat = null, lon = null;

      // Strategy 1: Check if zip is in fast dictionary
      if (zip && ZIP_COORDINATES[zip]) {
        lat = ZIP_COORDINATES[zip].lat;
        lon = ZIP_COORDINATES[zip].lon;
        console.log(`✓ ${activityName}: Found in ZIP_COORDINATES`);
      } 
      // Strategy 2: Try to geocode the zip from Column H
      else if (zip) {
        if (requestCount > 0) await sleep(1500);
        requestCount++;
        const query = `${zip} USA`;
        try {
          const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`, {
            headers: { 'User-Agent': 'VoteEarlyDayMap/1.0 (voteearlyday.org)' }
          });
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            if (geoData && geoData[0]) {
              const resultLat = parseFloat(geoData[0].lat);
              const resultLon = parseFloat(geoData[0].lon);
              if (resultLat >= 24 && resultLat <= 49 && resultLon >= -125 && resultLon <= -66) {
                lat = resultLat;
                lon = resultLon;
                console.log(`✓ ${activityName}: Geocoded via Column H zip`);
              }
            }
          }
        } catch (e) {
          console.warn(`Geocode error for Column H zip: ${e.message}`);
        }
      }

      // Strategy 3: If Column H is empty or failed, extract city/state from Column G and geocode
      if ((!lat || !lon) && mailingAddress) {
        let cityStateMatch = mailingAddress.match(/([A-Za-z\s]+),\s*([A-Z]{2})/);
        if (!cityStateMatch) {
          cityStateMatch = mailingAddress.match(/([A-Za-z\s]+)\s+([A-Z]{2})(?:\s|\d|$)/);
        }
        
        if (cityStateMatch) {
          const cityState = `${cityStateMatch[1].trim()}, ${cityStateMatch[2]}`;
          if (requestCount > 0) await sleep(1500);
          requestCount++;

          try {
            const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityState)}`, {
              headers: { 'User-Agent': 'VoteEarlyDayMap/1.0 (voteearlyday.org)' }
            });

            if (geoRes.ok) {
              const geoData = await geoRes.json();
              if (geoData && geoData[0]) {
                const resultLat = parseFloat(geoData[0].lat);
                const resultLon = parseFloat(geoData[0].lon);
                if (resultLat >= 24 && resultLat <= 49 && resultLon >= -125 && resultLon <= -66) {
                  lat = resultLat;
                  lon = resultLon;
                  console.log(`✓ ${activityName}: Geocoded via city/state from Column G: ${cityState}`);
                }
              }
            }
          } catch (e) {
            console.warn(`Geocode error for city/state: ${e.message}`);
          }
        }
      }

      // Strategy 4: Extract zip from Column G mailing address as last resort
      if (!lat || !lon) {
        const zipMatch = mailingAddress.match(/\b\d{5}(?:-\d{4})?\b/);
        if (zipMatch) {
          const extractedZip = zipMatch[0];
          if (ZIP_COORDINATES[extractedZip]) {
            lat = ZIP_COORDINATES[extractedZip].lat;
            lon = ZIP_COORDINATES[extractedZip].lon;
            console.log(`✓ ${activityName}: Found zip in Column G via ZIP_COORDINATES`);
