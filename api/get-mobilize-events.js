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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  try {
    const url = `https://docs.google.com/spreadsheets/d/1dO027VAM1PwKrv07DkU1tIPMKTbfRMtmr9gU9jppl4s/export?format=csv&gid=1581051441`;
    const resp = await fetch(url);
    const csv = await resp.text();
    const rows = parse(csv, { skip_empty_lines: true, relax_column_count: true });
    const events = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[12]) continue;
      if (row[15]?.toLowerCase() !== 'yes') continue;

      const zip = String(row[7] || '').trim();
      const addr = String(row[6] || '').trim();
      
      let lat = null, lon = null;

      if (zip && ZIP_COORDINATES[zip]) {
        lat = ZIP_COORDINATES[zip].lat;
        lon = ZIP_COORDINATES[zip].lon;
      } else if (addr) {
        try {
          const m = addr.match(/([A-Za-z\s]+)\s+([A-Z]{2})/);
          if (m) {
            const gr = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(m[1].trim() + ', ' + m[2])}`);
            const gd = await gr.json();
            if (gd.length > 0) {
              lat = parseFloat(gd[0].lat);
              lon = parseFloat(gd[0].lon);
            }
          }
        } catch (e) {}
      }

      if (lat && lon) {
        events.push({
          title: String(row[12] || '').trim(),
          hostOrganization: String(row[2] || '').trim(),
          date: String(row[11] || '').trim(),
          time: String(row[13] || '').trim(),
          address: String(row[14] || '').trim(),
          description: String(row[19] || '').trim(),
          registrationLink: String(row[16] || '').trim() || null,
          lat,
          lon
        });
      }
    }

    res.json({ count: events.length, data: events });
  } catch (e) {
    res.json({ count: 0, data: [] });
  }
};
