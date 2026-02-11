// ESM export for Vercel
export const config = {
  runtime: 'nodejs20'
};

// Simple test handler
export default async function handler(req: any, res: any) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  res.status(200).json({
    message: 'Handler is working!',
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });
}
