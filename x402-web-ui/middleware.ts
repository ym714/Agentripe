import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Allow wallet extensions to inject scripts
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.basescan.org https://*.walletconnect.com;
    child-src 'self';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https://*.basescan.org https://*.walletconnect.com;
    font-src 'self';
    connect-src 'self' http://localhost:3001 https://*.basescan.org https://sepolia.base.org https://*.walletconnect.com;
  `;

  response.headers.set('Content-Security-Policy', cspHeader.replace(/\s{2,}/g, ' ').trim());

  return response;
}
