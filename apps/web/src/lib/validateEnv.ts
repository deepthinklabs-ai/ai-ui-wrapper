/**
 * Environment Variable Validation
 *
 * Validates that required environment variables are present and properly formatted.
 * Call validateEnvironment() at application startup to catch misconfigurations early.
 *
 * Usage:
 * ```ts
 * import { validateEnvironment, validateForFeature } from '@/lib/validateEnv';
 *
 * // Full validation at startup
 * validateEnvironment();
 *
 * // Feature-specific validation
 * validateForFeature('stripe');
 * validateForFeature('mcp');
 * ```
 */

// Environment variable categories and their requirements
type EnvVarConfig = {
  name: string;
  required: boolean;
  description: string;
  validator?: (value: string) => boolean;
  sensitive?: boolean; // If true, don't log the value
};

type FeatureConfig = {
  name: string;
  description: string;
  vars: EnvVarConfig[];
};

// Core variables required for the app to function
const CORE_VARS: EnvVarConfig[] = [
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    required: true,
    description: "Supabase project URL",
    // SECURITY: Strict URL validation to prevent substring bypass attacks
    validator: (v) => /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(v),
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    required: true,
    description: "Supabase anonymous key (public)",
    validator: (v) => v.startsWith("eyJ") && v.length > 100,
    sensitive: true,
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    required: true,
    description: "Supabase service role key (server-only)",
    validator: (v) => v.startsWith("eyJ") && v.length > 100,
    sensitive: true,
  },
];

// Feature-specific configurations
const FEATURE_CONFIGS: Record<string, FeatureConfig> = {
  stripe: {
    name: "Stripe Payments",
    description: "Payment processing and subscriptions",
    vars: [
      {
        name: "STRIPE_SECRET_KEY",
        required: true,
        description: "Stripe secret API key",
        validator: (v) => v.startsWith("sk_"),
        sensitive: true,
      },
      {
        name: "STRIPE_WEBHOOK_SECRET",
        required: true,
        description: "Stripe webhook signing secret",
        validator: (v) => v.startsWith("whsec_"),
        sensitive: true,
      },
      {
        name: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
        required: true,
        description: "Stripe publishable key (public)",
        validator: (v) => v.startsWith("pk_"),
      },
      {
        name: "STRIPE_PRO_PRICE_ID",
        required: false,
        description: "Stripe price ID for Pro subscription",
        validator: (v) => v.startsWith("price_"),
      },
    ],
  },
  mcp: {
    name: "MCP (Model Context Protocol)",
    description: "External tool integrations via MCP",
    vars: [
      {
        name: "MCP_ENCRYPTION_KEY",
        required: true,
        description: "256-bit hex key for MCP credential encryption",
        validator: (v) => /^[a-fA-F0-9]{64}$/.test(v),
        sensitive: true,
      },
    ],
  },
  oauth: {
    name: "OAuth Integrations",
    description: "Google and Slack OAuth",
    vars: [
      {
        name: "OAUTH_ENCRYPTION_KEY",
        required: true,
        description: "256-bit hex key for OAuth token encryption",
        validator: (v) => /^[a-fA-F0-9]{64}$/.test(v),
        sensitive: true,
      },
      {
        name: "GOOGLE_OAUTH_CLIENT_ID",
        required: false,
        description: "Google OAuth client ID",
        // SECURITY: Ensure it ends with the correct domain to prevent substring bypass
        validator: (v) => /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(v),
      },
      {
        name: "GOOGLE_OAUTH_CLIENT_SECRET",
        required: false,
        description: "Google OAuth client secret",
        sensitive: true,
      },
      {
        name: "SLACK_CLIENT_ID",
        required: false,
        description: "Slack OAuth client ID",
      },
      {
        name: "SLACK_CLIENT_SECRET",
        required: false,
        description: "Slack OAuth client secret",
        sensitive: true,
      },
    ],
  },
  email: {
    name: "Email (Resend)",
    description: "Transactional email for 2FA and notifications",
    vars: [
      {
        name: "RESEND_API_KEY",
        required: false,
        description: "Resend API key for sending emails",
        validator: (v) => v.startsWith("re_"),
        sensitive: true,
      },
      {
        name: "RESEND_FROM_EMAIL",
        required: false,
        description: "From email address for outgoing emails",
        validator: (v) => v.includes("@"),
      },
    ],
  },
  secretManager: {
    name: "Google Secret Manager",
    description: "Production API key storage",
    vars: [
      {
        name: "GCP_PROJECT_ID",
        required: false,
        description: "Google Cloud project ID",
      },
      {
        name: "GCP_SERVICE_ACCOUNT_KEY",
        required: false,
        description: "Service account key JSON (base64 encoded)",
        sensitive: true,
      },
    ],
  },
  redis: {
    name: "Upstash Redis",
    description: "Distributed rate limiting and caching",
    vars: [
      {
        name: "UPSTASH_REDIS_REST_URL",
        required: false,
        description: "Upstash Redis REST API URL",
        // SECURITY: Strict URL validation to prevent bypass attacks
        validator: (v) => {
          try {
            const url = new URL(v);
            return url.protocol === "https:" &&
              (url.hostname === "upstash.io" || url.hostname.endsWith(".upstash.io"));
          } catch {
            return false;
          }
        },
      },
      {
        name: "UPSTASH_REDIS_REST_TOKEN",
        required: false,
        description: "Upstash Redis REST API token",
        sensitive: true,
      },
    ],
  },
  staging: {
    name: "Staging Protection",
    description: "Password protection for staging environments",
    vars: [
      {
        name: "STAGING_PASSWORD",
        required: false,
        description: "Password for staging environment access",
        sensitive: true,
      },
    ],
  },
  ipAccessControl: {
    name: "IP Access Control",
    description: "IP-based access restrictions for sensitive endpoints",
    vars: [
      {
        name: "IP_ALLOWLIST_ADMIN",
        required: false,
        description: "Comma-separated list of allowed IPs/CIDRs for admin endpoints",
        // Validate format: comma-separated IPs or CIDRs
        validator: (v) => {
          const ips = v.split(",").map((ip) => ip.trim());
          const ipOrCIDR = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
          return ips.every((ip) => ipOrCIDR.test(ip));
        },
      },
      {
        name: "IP_ALLOWLIST_INTERNAL",
        required: false,
        description: "Comma-separated list of allowed IPs/CIDRs for internal APIs",
        validator: (v) => {
          const ips = v.split(",").map((ip) => ip.trim());
          const ipOrCIDR = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
          return ips.every((ip) => ipOrCIDR.test(ip));
        },
      },
    ],
  },
};

type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missing: string[];
};

/**
 * Validate a single environment variable
 */
function validateVar(config: EnvVarConfig): {
  valid: boolean;
  error?: string;
  warning?: string;
} {
  const value = process.env[config.name];

  // Check if present
  if (!value || value.trim() === "") {
    if (config.required) {
      return {
        valid: false,
        error: `Missing required env var: ${config.name} (${config.description})`,
      };
    }
    return {
      valid: true,
      warning: `Optional env var not set: ${config.name} (${config.description})`,
    };
  }

  // Run custom validator if provided
  if (config.validator && !config.validator(value)) {
    return {
      valid: false,
      error: `Invalid format for ${config.name}: ${config.description}`,
    };
  }

  return { valid: true };
}

/**
 * Validate all core environment variables
 */
export function validateCoreEnvironment(): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    missing: [],
  };

  for (const config of CORE_VARS) {
    const validation = validateVar(config);
    if (!validation.valid && validation.error) {
      result.valid = false;
      result.errors.push(validation.error);
      result.missing.push(config.name);
    }
    if (validation.warning) {
      result.warnings.push(validation.warning);
    }
  }

  return result;
}

/**
 * Validate environment variables for a specific feature
 */
export function validateForFeature(
  feature: keyof typeof FEATURE_CONFIGS
): ValidationResult {
  const config = FEATURE_CONFIGS[feature];
  if (!config) {
    return {
      valid: false,
      errors: [`Unknown feature: ${feature}`],
      warnings: [],
      missing: [],
    };
  }

  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    missing: [],
  };

  for (const varConfig of config.vars) {
    const validation = validateVar(varConfig);
    if (!validation.valid && validation.error) {
      result.valid = false;
      result.errors.push(validation.error);
      result.missing.push(varConfig.name);
    }
    if (validation.warning) {
      result.warnings.push(validation.warning);
    }
  }

  return result;
}

/**
 * Validate all environment variables
 * Call this at application startup
 */
export function validateEnvironment(options?: {
  throwOnError?: boolean;
  logWarnings?: boolean;
}): ValidationResult {
  const { throwOnError = false, logWarnings = true } = options || {};

  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    missing: [],
  };

  // Validate core vars
  const coreResult = validateCoreEnvironment();
  result.errors.push(...coreResult.errors);
  result.warnings.push(...coreResult.warnings);
  result.missing.push(...coreResult.missing);
  if (!coreResult.valid) {
    result.valid = false;
  }

  // Validate feature-specific vars
  for (const [feature, config] of Object.entries(FEATURE_CONFIGS)) {
    const featureResult = validateForFeature(
      feature as keyof typeof FEATURE_CONFIGS
    );

    // Only add errors for required vars in each feature
    for (const error of featureResult.errors) {
      // Check if this is a required var error
      const varConfig = config.vars.find((v) => error.includes(v.name));
      if (varConfig?.required) {
        result.errors.push(error);
        result.valid = false;
      }
    }

    result.warnings.push(...featureResult.warnings);
  }

  // Log results
  if (result.errors.length > 0) {
    console.error(
      "[ENV] Environment validation failed:",
      result.errors.join("\n  - ")
    );
  }

  if (logWarnings && result.warnings.length > 0) {
    console.warn(
      "[ENV] Environment warnings:",
      result.warnings.slice(0, 5).join("\n  - "),
      result.warnings.length > 5
        ? `\n  ... and ${result.warnings.length - 5} more`
        : ""
    );
  }

  if (throwOnError && !result.valid) {
    throw new Error(
      `Environment validation failed:\n  - ${result.errors.join("\n  - ")}`
    );
  }

  return result;
}

/**
 * Check if a specific feature is properly configured
 */
export function isFeatureConfigured(
  feature: keyof typeof FEATURE_CONFIGS
): boolean {
  const result = validateForFeature(feature);
  return result.valid;
}

/**
 * Get a summary of environment configuration status
 */
export function getEnvironmentStatus(): Record<
  string,
  { configured: boolean; missing: string[] }
> {
  const status: Record<string, { configured: boolean; missing: string[] }> = {};

  // Core
  const coreResult = validateCoreEnvironment();
  status.core = {
    configured: coreResult.valid,
    missing: coreResult.missing,
  };

  // Features
  for (const feature of Object.keys(FEATURE_CONFIGS)) {
    const result = validateForFeature(feature as keyof typeof FEATURE_CONFIGS);
    status[feature] = {
      configured: result.valid,
      missing: result.missing,
    };
  }

  return status;
}

// Export feature names for type safety
export const FEATURES = Object.keys(FEATURE_CONFIGS) as Array<
  keyof typeof FEATURE_CONFIGS
>;
