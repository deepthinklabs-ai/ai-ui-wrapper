/**
 * MCP Command Validator
 *
 * SECURITY: Validates and sanitizes MCP server commands to prevent command injection.
 * Only allows whitelisted commands and packages.
 */

// Whitelist of allowed commands
const ALLOWED_COMMANDS = ['npx'] as const;

// Whitelist of allowed MCP packages
const ALLOWED_PACKAGES = [
  '@modelcontextprotocol/server-github',
  '@modelcontextprotocol/server-slack',
  '@modelcontextprotocol/server-memory',
  '@modelcontextprotocol/server-brave-search',
  // Note: Filesystem and PostgreSQL deliberately excluded for security
] as const;

// Allowed flags for npx
const ALLOWED_NPX_FLAGS = ['-y', '--yes'] as const;

export type ValidationResult = {
  valid: boolean;
  error?: string;
  sanitized?: {
    command: string;
    args: string[];
  };
};

/**
 * Validate and sanitize an MCP command
 */
export function validateMCPCommand(
  command: string,
  args: string[]
): ValidationResult {
  // 1. Validate command is in whitelist
  if (!ALLOWED_COMMANDS.includes(command as any)) {
    return {
      valid: false,
      error: `Command not allowed: "${command}". Only these commands are permitted: ${ALLOWED_COMMANDS.join(', ')}`,
    };
  }

  // 2. Check for shell metacharacters in command
  if (/[;&|`$()<>]/.test(command)) {
    return {
      valid: false,
      error: 'Command contains invalid characters',
    };
  }

  // 3. Validate arguments
  if (!args || args.length === 0) {
    return {
      valid: false,
      error: 'Arguments required',
    };
  }

  // 4. Check for path traversal attempts
  for (const arg of args) {
    if (arg.includes('..') || arg.includes('~') || arg.startsWith('/etc') || arg.startsWith('/root')) {
      return {
        valid: false,
        error: `Path traversal attempt detected in argument: "${arg}"`,
      };
    }
  }

  // 5. Validate based on command type
  if (command === 'npx') {
    return validateNpxCommand(args);
  }

  return {
    valid: false,
    error: 'Unknown command validation logic',
  };
}

/**
 * Validate npx-specific command
 */
function validateNpxCommand(args: string[]): ValidationResult {
  // Find flags and package name
  const flags = args.filter(arg => arg.startsWith('-'));
  const nonFlags = args.filter(arg => !arg.startsWith('-'));

  // 1. Validate all flags are allowed
  for (const flag of flags) {
    if (!ALLOWED_NPX_FLAGS.includes(flag as any)) {
      return {
        valid: false,
        error: `Flag not allowed: "${flag}". Allowed flags: ${ALLOWED_NPX_FLAGS.join(', ')}`,
      };
    }
  }

  // 2. Must have exactly one package name
  if (nonFlags.length !== 1) {
    return {
      valid: false,
      error: 'Must specify exactly one package name',
    };
  }

  const packageName = nonFlags[0];

  // 3. Validate package is in whitelist
  if (!ALLOWED_PACKAGES.includes(packageName as any)) {
    return {
      valid: false,
      error: `Package not allowed: "${packageName}". Allowed packages: ${ALLOWED_PACKAGES.join(', ')}`,
    };
  }

  // 4. Sanitize arguments (remove any shell metacharacters)
  const sanitizedArgs = args.map(arg => {
    // Remove dangerous characters
    return arg.replace(/[;&|`$()<>]/g, '');
  });

  return {
    valid: true,
    sanitized: {
      command: 'npx',
      args: sanitizedArgs,
    },
  };
}

/**
 * Sanitize environment variables
 * Only allows specific env vars per server type
 */
export function sanitizeEnvironment(
  serverName: string,
  userEnv: Record<string, string>
): Record<string, string> {
  const allowedEnvVars: Record<string, string[]> = {
    github: ['GITHUB_PERSONAL_ACCESS_TOKEN', 'GITHUB_USERNAME'],
    slack: ['SLACK_BOT_TOKEN', 'SLACK_TEAM_ID'],
    memory: [],
    'brave-search': ['BRAVE_API_KEY'],
  };

  // Determine server type from name
  const serverType = serverName.toLowerCase().replace(/[^a-z-]/g, '-');

  // Find matching allowed env vars
  const allowed = Object.entries(allowedEnvVars).find(([key]) =>
    serverType.includes(key)
  )?.[1] || [];

  // Only include allowed vars
  const sanitized: Record<string, string> = {};

  for (const key of allowed) {
    if (userEnv[key]) {
      // Sanitize value (remove null bytes, control characters)
      sanitized[key] = userEnv[key].replace(/[\x00-\x1F\x7F]/g, '');
    }
  }

  // Add safe system vars
  // Windows requires different PATH handling to locate npm/npx
  let systemPath: string;
  if (process.platform === 'win32') {
    // On Windows, include npm global bin directories
    const appData = process.env.APPDATA || '';
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const nodeJsPath = `${programFiles}\\nodejs`;
    const npmPath = `${appData}\\npm`;

    // Include both npm global directories and system PATH
    systemPath = `${nodeJsPath};${npmPath};${process.env.PATH || ''}`;
  } else {
    // Unix-like systems
    systemPath = '/usr/local/bin:/usr/bin:/bin';
  }

  const safeEnv = {
    ...sanitized,
    NODE_ENV: 'production',
    PATH: systemPath,
    // DO NOT include full process.env - prevents env var poisoning
  };

  return safeEnv;
}

/**
 * Log security events (for audit trail)
 */
export function logSecurityEvent(event: {
  type: 'COMMAND_VALIDATION_FAILED' | 'COMMAND_VALIDATED';
  userId: string;
  command: string;
  args: string[];
  error?: string;
}) {
  // In production, send to logging service (Sentry, DataDog, etc.)
  console.log('[SECURITY]', JSON.stringify({
    timestamp: new Date().toISOString(),
    ...event,
  }));
}
