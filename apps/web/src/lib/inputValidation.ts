/**
 * @security-audit-requested
 * AUDIT FOCUS: Input Validation Security
 * - Are the regex patterns correct and complete for each token type?
 * - Can validation be bypassed with Unicode or encoding tricks?
 * - Is the sanitization removing all dangerous characters?
 * - Are there any ReDoS (regex denial of service) vulnerabilities?
 * - Should validation be stricter (length limits, character sets)?
 */

/**
 * Input Validation for API Keys and Credentials
 *
 * Validates format of API keys before storing/using them
 * Helps catch typos and potentially malicious input
 */

export type ValidationResult = {
  valid: boolean;
  error?: string;
};

/**
 * Validate GitHub Personal Access Token format
 * Format: ghp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX (40 chars after prefix)
 */
export function validateGitHubToken(token: string): ValidationResult {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token is required' };
  }

  // GitHub classic tokens: ghp_...
  const classicPattern = /^ghp_[a-zA-Z0-9]{36}$/;
  // GitHub fine-grained tokens: github_pat_...
  const fineGrainedPattern = /^github_pat_[a-zA-Z0-9_]{82}$/;

  if (!classicPattern.test(token) && !fineGrainedPattern.test(token)) {
    return {
      valid: false,
      error: 'Invalid GitHub token format. Expected ghp_... (classic) or github_pat_... (fine-grained)'
    };
  }

  return { valid: true };
}

/**
 * Validate Slack Bot Token format
 * Format: xoxb-XXXX-XXXX-XXXX-XXXX
 */
export function validateSlackBotToken(token: string): ValidationResult {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token is required' };
  }

  const pattern = /^xoxb-[0-9]+-[0-9]+-[a-zA-Z0-9]+$/;

  if (!pattern.test(token)) {
    return {
      valid: false,
      error: 'Invalid Slack bot token format. Expected xoxb-...'
    };
  }

  return { valid: true };
}

/**
 * Validate Slack Team ID format
 * Format: TXXXXXXXX (T followed by 8 alphanumeric)
 */
export function validateSlackTeamId(teamId: string): ValidationResult {
  if (!teamId || typeof teamId !== 'string') {
    return { valid: false, error: 'Team ID is required' };
  }

  const pattern = /^T[A-Z0-9]{8,}$/;

  if (!pattern.test(teamId)) {
    return {
      valid: false,
      error: 'Invalid Slack team ID format. Expected T followed by alphanumeric characters'
    };
  }

  return { valid: true };
}

/**
 * Validate Brave Search API Key
 * Format: BSA... (typically 32+ alphanumeric characters)
 */
export function validateBraveApiKey(apiKey: string): ValidationResult {
  if (!apiKey || typeof apiKey !== 'string') {
    return { valid: false, error: 'API key is required' };
  }

  // Brave keys start with BSA and are typically 32+ characters
  const pattern = /^BSA[a-zA-Z0-9_-]{29,}$/;

  if (!pattern.test(apiKey)) {
    return {
      valid: false,
      error: 'Invalid Brave API key format. Expected BSA followed by alphanumeric characters'
    };
  }

  return { valid: true };
}

/**
 * Validate PostgreSQL connection string
 * Format: postgresql://user:password@host:port/database
 */
export function validatePostgresConnectionString(connString: string): ValidationResult {
  if (!connString || typeof connString !== 'string') {
    return { valid: false, error: 'Connection string is required' };
  }

  try {
    const url = new URL(connString);

    // Must be postgresql protocol
    if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
      return {
        valid: false,
        error: 'Connection string must use postgresql:// or postgres:// protocol'
      };
    }

    // Must have hostname
    if (!url.hostname) {
      return {
        valid: false,
        error: 'Connection string must include hostname'
      };
    }

    // Must have pathname (database name)
    if (!url.pathname || url.pathname === '/') {
      return {
        valid: false,
        error: 'Connection string must include database name'
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid connection string format'
    };
  }
}

/**
 * Sanitize string input (remove dangerous characters)
 */
export function sanitizeString(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove control characters and null bytes
  return input.replace(/[\x00-\x1F\x7F]/g, '');
}

/**
 * Validate environment variable name
 */
export function validateEnvVarName(name: string): ValidationResult {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Environment variable name is required' };
  }

  // Only alphanumeric and underscore, must start with letter
  const pattern = /^[A-Z][A-Z0-9_]*$/;

  if (!pattern.test(name)) {
    return {
      valid: false,
      error: 'Invalid environment variable name. Must start with letter and contain only uppercase letters, numbers, and underscores'
    };
  }

  return { valid: true };
}

/**
 * Validate server name (used for display and logging)
 */
export function validateServerName(name: string): ValidationResult {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Server name is required' };
  }

  if (name.length < 2 || name.length > 100) {
    return {
      valid: false,
      error: 'Server name must be between 2 and 100 characters'
    };
  }

  // Alphanumeric, spaces, hyphens, underscores only
  const pattern = /^[a-zA-Z0-9 _-]+$/;

  if (!pattern.test(name)) {
    return {
      valid: false,
      error: 'Server name can only contain letters, numbers, spaces, hyphens, and underscores'
    };
  }

  return { valid: true };
}

/**
 * Validate MCP server configuration based on server type
 */
export function validateMCPServerConfig(
  serverType: string,
  config: Record<string, any>
): ValidationResult {
  switch (serverType.toLowerCase()) {
    case 'github':
      if (config.GITHUB_PERSONAL_ACCESS_TOKEN) {
        const tokenResult = validateGitHubToken(config.GITHUB_PERSONAL_ACCESS_TOKEN);
        if (!tokenResult.valid) {
          return tokenResult;
        }
      }
      break;

    case 'slack':
      if (config.SLACK_BOT_TOKEN) {
        const tokenResult = validateSlackBotToken(config.SLACK_BOT_TOKEN);
        if (!tokenResult.valid) {
          return tokenResult;
        }
      }
      if (config.SLACK_TEAM_ID) {
        const teamResult = validateSlackTeamId(config.SLACK_TEAM_ID);
        if (!teamResult.valid) {
          return teamResult;
        }
      }
      break;

    case 'brave-search':
      if (config.BRAVE_API_KEY) {
        const apiKeyResult = validateBraveApiKey(config.BRAVE_API_KEY);
        if (!apiKeyResult.valid) {
          return apiKeyResult;
        }
      }
      break;

    case 'postgres':
    case 'postgresql':
      if (config.POSTGRES_CONNECTION_STRING) {
        const connResult = validatePostgresConnectionString(config.POSTGRES_CONNECTION_STRING);
        if (!connResult.valid) {
          return connResult;
        }
      }
      break;
  }

  return { valid: true };
}
