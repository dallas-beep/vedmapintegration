const fetch = require('node-fetch');

export default async (req, res) => {
  const MOBILIZE_API_KEY = '978b6a20852fb9ba866ece245c176e12f331c298';
  const MOBILIZE_ORG_ID = '54046';
  const MOBILIZE_API_BASE = 'https://api.mobilize.us/v1';

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const url = `${MOBILIZE_API_BASE}/organizations/${MOBILIZE_ORG_ID}/events?approval_status=APPROVED&per_page=100`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${MOBILIZE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Mobilize API error: ${response.status}`);
    }

    const data = await response.json();
    
    res.status(200).json(data);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
};
