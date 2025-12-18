/**
 * IP Access Control
 *
 * Provides IP-based access control for sensitive endpoints.
 * Supports IP allowlisting with CIDR notation and handles proxied requests.
 *
 * Usage:
 * ```ts
 * import { checkIPAccess, IPAccessConfig } from '@/lib/ipAccessControl';
 *
 * // In API route:
 * const config: IPAccessConfig = {
 *   allowedIPs: ['192.168.1.0/24', '10.0.0.1'],
 *   allowedRanges: [{ start: '172.16.0.0', end: '172.16.255.255' }],
 * };
 *
 * const { allowed, clientIP } = checkIPAccess(request, config);
 * if (!allowed) {
 *   return NextResponse.json({ error: 'Access denied' }, { status: 403 });
 * }
 * ```
 */

import { auditSecurity } from './auditLog';

// IP access configuration
export interface IPAccessConfig {
  // List of allowed IPs or CIDR ranges (e.g., '192.168.1.0/24', '10.0.0.1')
  allowedIPs?: string[];
  // List of IP ranges with start and end
  allowedRanges?: Array<{ start: string; end: string }>;
  // If true, block access when no IP can be determined (default: true)
  blockUnknownIP?: boolean;
  // If true, allow all private/internal IPs (default: false)
  allowPrivateIPs?: boolean;
  // Custom error message
  errorMessage?: string;
}

export interface IPAccessResult {
  allowed: boolean;
  clientIP: string | null;
  reason?: string;
}

/**
 * Extract client IP from request headers
 * Handles various proxy headers in order of trust
 */
export function extractClientIP(request: Request): string | null {
  const headers = request.headers;

  // Check various headers in order of preference
  // Priority: Cloudflare > Vercel > Standard forwarded headers
  const ipHeaders = [
    'cf-connecting-ip',      // Cloudflare
    'x-real-ip',             // Nginx
    'x-vercel-forwarded-for', // Vercel
    'x-forwarded-for',       // Standard proxy header
  ];

  for (const header of ipHeaders) {
    const value = headers.get(header);
    if (value) {
      // x-forwarded-for can contain multiple IPs, take the first (client)
      const ip = value.split(',')[0].trim();
      // Basic validation: must look like an IP
      if (isValidIP(ip)) {
        return ip;
      }
    }
  }

  return null;
}

/**
 * Basic IP validation (IPv4 only)
 * Note: IPv6 is not currently supported for CIDR/range matching
 */
function isValidIP(ip: string): boolean {
  // IPv4 pattern
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;

  if (ipv4Pattern.test(ip)) {
    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }

  // IPv6 is currently not supported for CIDR/range matching
  // Return false to avoid passing unsupported addresses downstream
  return false;
}

/**
 * Convert IP to numeric for comparison
 */
function ipToNumber(ip: string): number {
  const parts = ip.split('.');
  return parts.reduce((acc, part) => (acc << 8) + parseInt(part, 10), 0) >>> 0;
}

/**
 * Check if IP is in CIDR range
 */
function isIPInCIDR(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split('/');
  if (!bits) {
    // No CIDR notation, exact match
    return ip === range;
  }

  const bitCount = parseInt(bits, 10);

  // Handle edge case: /0 matches all IPs
  // JavaScript bit shifts are limited to 32 bits, so 1 << 32 returns 1 instead of 0
  if (bitCount === 0) {
    return true;
  }

  const mask = ~((1 << (32 - bitCount)) - 1) >>> 0;
  const ipNum = ipToNumber(ip);
  const rangeNum = ipToNumber(range);

  return (ipNum & mask) === (rangeNum & mask);
}

/**
 * Check if IP is in range (start to end)
 */
function isIPInRange(ip: string, start: string, end: string): boolean {
  const ipNum = ipToNumber(ip);
  const startNum = ipToNumber(start);
  const endNum = ipToNumber(end);

  return ipNum >= startNum && ipNum <= endNum;
}

/**
 * Check if IP is a private/internal IP address
 */
export function isPrivateIP(ip: string): boolean {
  // Private IPv4 ranges:
  // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
  // Loopback: 127.0.0.0/8
  // Link-local: 169.254.0.0/16

  const privateRanges = [
    { start: '10.0.0.0', end: '10.255.255.255' },
    { start: '172.16.0.0', end: '172.31.255.255' },
    { start: '192.168.0.0', end: '192.168.255.255' },
    { start: '127.0.0.0', end: '127.255.255.255' },
    { start: '169.254.0.0', end: '169.254.255.255' },
  ];

  return privateRanges.some(range => isIPInRange(ip, range.start, range.end));
}

/**
 * Check if client IP is allowed based on configuration
 */
export function checkIPAccess(
  request: Request,
  config: IPAccessConfig
): IPAccessResult {
  const clientIP = extractClientIP(request);
  const blockUnknown = config.blockUnknownIP !== false;

  // If no IP can be determined
  if (!clientIP) {
    return {
      allowed: !blockUnknown,
      clientIP: null,
      reason: blockUnknown ? 'Unable to determine client IP' : undefined,
    };
  }

  // If allowing private IPs and this is one
  if (config.allowPrivateIPs && isPrivateIP(clientIP)) {
    return {
      allowed: true,
      clientIP,
      reason: 'Private IP allowed',
    };
  }

  // Check against allowed IPs/CIDRs
  if (config.allowedIPs && config.allowedIPs.length > 0) {
    for (const allowed of config.allowedIPs) {
      if (isIPInCIDR(clientIP, allowed)) {
        return {
          allowed: true,
          clientIP,
        };
      }
    }
  }

  // Check against allowed ranges
  if (config.allowedRanges && config.allowedRanges.length > 0) {
    for (const range of config.allowedRanges) {
      if (isIPInRange(clientIP, range.start, range.end)) {
        return {
          allowed: true,
          clientIP,
        };
      }
    }
  }

  // If no allowlist configured, allow all
  if (
    (!config.allowedIPs || config.allowedIPs.length === 0) &&
    (!config.allowedRanges || config.allowedRanges.length === 0) &&
    !config.allowPrivateIPs
  ) {
    return {
      allowed: true,
      clientIP,
      reason: 'No IP restrictions configured',
    };
  }

  // IP not in allowlist
  return {
    allowed: false,
    clientIP,
    reason: 'IP not in allowlist',
  };
}

/**
 * Middleware helper to check IP access and log blocked attempts
 */
export async function enforceIPAccess(
  request: Request,
  config: IPAccessConfig,
  options?: {
    userId?: string;
    endpoint?: string;
  }
): Promise<IPAccessResult & { response?: Response }> {
  const result = checkIPAccess(request, config);

  if (!result.allowed) {
    // Log the blocked access attempt
    await auditSecurity.unauthorizedAccess(
      options?.endpoint || new URL(request.url).pathname,
      `IP access denied: ${result.reason}`,
      {
        headers: request.headers,
        ip: result.clientIP || undefined,
      }
    );

    return {
      ...result,
      response: new Response(
        JSON.stringify({
          error: 'Access denied',
          message: config.errorMessage || 'Your IP address is not authorized',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      ),
    };
  }

  return result;
}

// Environment-based configuration
// Set these in .env to restrict access:
// IP_ALLOWLIST_ADMIN=192.168.1.0/24,10.0.0.1
// IP_ALLOWLIST_INTERNAL=10.0.0.0/8

/**
 * Get IP allowlist from environment variable
 */
export function getIPAllowlistFromEnv(envVar: string): string[] {
  const value = process.env[envVar];
  if (!value) return [];

  return value
    .split(',')
    .map(ip => ip.trim())
    .filter(ip => ip.length > 0);
}

/**
 * Pre-configured access control for admin endpoints
 * Uses IP_ALLOWLIST_ADMIN environment variable
 */
export function getAdminIPConfig(): IPAccessConfig {
  const allowedIPs = getIPAllowlistFromEnv('IP_ALLOWLIST_ADMIN');

  return {
    allowedIPs,
    allowPrivateIPs: process.env.NODE_ENV === 'development',
    blockUnknownIP: true,
    errorMessage: 'Admin access is restricted by IP address',
  };
}

/**
 * Pre-configured access control for internal APIs
 * Uses IP_ALLOWLIST_INTERNAL environment variable
 */
export function getInternalIPConfig(): IPAccessConfig {
  const allowedIPs = getIPAllowlistFromEnv('IP_ALLOWLIST_INTERNAL');

  return {
    allowedIPs,
    allowPrivateIPs: true, // Internal APIs typically allow private IPs
    blockUnknownIP: true,
    errorMessage: 'Internal API access is restricted',
  };
}

/**
 * Example usage in an admin API route:
 *
 * ```ts
 * import { enforceIPAccess, getAdminIPConfig } from '@/lib/ipAccessControl';
 *
 * export async function POST(request: Request) {
 *   // Check IP access
 *   const ipCheck = await enforceIPAccess(request, getAdminIPConfig(), {
 *     endpoint: '/api/admin/action',
 *   });
 *
 *   if (ipCheck.response) {
 *     return ipCheck.response;
 *   }
 *
 *   // Proceed with admin action...
 * }
 * ```
 */
