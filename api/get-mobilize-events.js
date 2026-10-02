function geocodeSheet() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    const zip = data[i][7]; // Column H
    const address = data[i][6]; // Column G
    const isPublic = data[i][15]; // Column P
    
    if (isPublic && isPublic.toString().toLowerCase() === 'yes') {
      if (!data[i][20] && !data[i][21]) { // If lat/lng empty
        try {
          let query = (zip || address) + ", USA"; // Force USA
          if (!query) continue;
          
          const geocode = Maps.newGeocoder().geocode(query);
          if (geocode.results && geocode.results.length > 0) {
            const result = geocode.results[0].geometry.location;
            const lat = result.lat;
            const lon = result.lng;
            
            // Reject non-US coordinates
            if (lat >= 24 && lat <= 49 && lon >= -125 && lon <= -66) {
              sheet.getRange(i + 1, 21).setValue(lat);
              sheet.getRange(i + 1, 22).setValue(lon);
              Utilities.sleep(100);
            }
          }
        } catch (e) {
          Logger.log("Error row " + i + ": " + e);
        }
      }
    }
  }
}
