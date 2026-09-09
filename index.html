const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  const MOBILIZE_API_KEY = '978b6a20852fb9ba866ece245c176e12f331c298';
  const MOBILIZE_ORG_ID = '54046';
  const MOBILIZE_API_BASE = 'https://api.mobilize.us/v1';

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
    
    return {
      statusCode: 200,
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
