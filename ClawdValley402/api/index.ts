// Vercel serverless function
export default async function handler(req: any, res: any) {
  // Simple test response
  res.status(200).json({
    message: 'Handler works!',
    timestamp: new Date().toISOString(),
    method: req.method
  });
}
