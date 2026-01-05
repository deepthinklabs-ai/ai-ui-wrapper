/**
 * Canvas File Utilities
 *
 * Functions for exporting and importing .canvas files.
 * Handles serialization, validation, and file operations.
 * CRITICAL: Always sanitizes OAuth tokens and credentials before export.
 */

import type { Canvas, CanvasNode, CanvasEdge, CanvasNodeType } from '@/app/canvas/types';
import type {
  CanvasFile,
  CanvasFileMetadata,
  CanvasFileNode,
  CanvasFileEdge,
  CanvasFileOAuthRequirements,
  CanvasFileValidationResult,
  CanvasExportOptions,
  CanvasFileUserInfo,
} from '@/types/canvasFile';
import {
  CANVAS_FILE_VERSION,
  CANVAS_FILE_EXTENSION,
  SENSITIVE_CONFIG_FIELDS,
  OAUTH_REQUIREMENT_FIELDS,
} from '@/types/canvasFile';
import {
  validateImportFileExtension,
  validateImportFileSize,
  preParseJsonCheck,
  sanitizeImportData,
} from '@/lib/importFileSecurity';

/**
 * Default export options
 */
const DEFAULT_EXPORT_OPTIONS: CanvasExportOptions = {};

/**
 * Deep clone an object while removing sensitive fields
 */
function sanitizeConfig(config: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(config)) {
    // Skip sensitive fields entirely
    if (SENSITIVE_CONFIG_FIELDS.includes(key.toLowerCase())) {
      continue;
    }

    // If it's an object, recursively sanitize
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const sanitizedValue = sanitizeConfig(value);
      // Only include if there's anything left after sanitization
      if (Object.keys(sanitizedValue).length > 0) {
        sanitized[key] = sanitizedValue;
      }
    } else if (Array.isArray(value)) {
      // For arrays, sanitize each object element
      sanitized[key] = value.map((item) => {
        if (item && typeof item === 'object') {
          return sanitizeConfig(item);
        }
        return item;
      });
    } else {
      // Keep primitive values
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Extract OAuth requirements from node configs
 */
function extractOAuthRequirements(nodes: CanvasNode[]): CanvasFileOAuthRequirements {
  const requirements: CanvasFileOAuthRequirements = {};

  for (const node of nodes) {
    const config = node.config;

    // Check for OAuth requirement fields
    for (const [field, provider] of Object.entries(OAUTH_REQUIREMENT_FIELDS)) {
      if (config[field] === true) {
        requirements[provider] = true;
      }
    }

    // Also check for presence of OAuth config objects (even if they're being sanitized)
    if (config.gmail || config.gmail_config || config.gmail_enabled) {
      requirements.gmail = true;
    }
    if (config.calendar || config.calendar_config || config.calendar_enabled) {
      requirements.calendar = true;
    }
    if (config.sheets || config.sheets_config || config.sheets_enabled) {
      requirements.sheets = true;
    }
    if (config.docs || config.docs_config || config.docs_enabled) {
      requirements.docs = true;
    }
    if (config.slack || config.slack_config || config.slack_enabled) {
      requirements.slack = true;
    }
  }

  return requirements;
}

/**
 * Convert a database CanvasNode to a CanvasFileNode
 */
export function nodeToCanvasFileNode(node: CanvasNode): CanvasFileNode {
  return {
    type: node.type,
    position: { x: node.position.x, y: node.position.y },
    label: node.label,
    config: sanitizeConfig(node.config),
    original_id: node.id,
  };
}

/**
 * Convert a database CanvasEdge to a CanvasFileEdge
 */
export function edgeToCanvasFileEdge(edge: CanvasEdge): CanvasFileEdge {
  const fileEdge: CanvasFileEdge = {
    from_node_ref: edge.from_node_id,
    to_node_ref: edge.to_node_id,
  };

  // Add optional fields if present
  if (edge.from_port) fileEdge.from_port = edge.from_port;
  if (edge.to_port) fileEdge.to_port = edge.to_port;
  if (edge.label) fileEdge.label = edge.label;
  if (edge.animated !== undefined) fileEdge.animated = edge.animated;
  if (edge.condition) fileEdge.condition = edge.condition;
  if (edge.transform) fileEdge.transform = edge.transform;

  return fileEdge;
}

/**
 * Create a CanvasFile from canvas data, nodes, and edges
 */
export function createCanvasFile(
  canvas: Canvas,
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  options: CanvasExportOptions = DEFAULT_EXPORT_OPTIONS
): CanvasFile {
  const metadata: CanvasFileMetadata = {
    name: canvas.name,
    description: canvas.description,
    mode: canvas.mode,
    created_at: canvas.created_at,
    exported_at: new Date().toISOString(),
    node_count: nodes.length,
    edge_count: edges.length,
  };

  // Add user info if provided
  if (options.createdBy) {
    metadata.created_by = options.createdBy;
  }

  // Convert nodes (with sanitization)
  const fileNodes = nodes.map(nodeToCanvasFileNode);

  // Convert edges
  const fileEdges = edges.map(edgeToCanvasFileEdge);

  // Extract OAuth requirements
  const oauthRequirements = extractOAuthRequirements(nodes);

  const canvasFile: CanvasFile = {
    version: CANVAS_FILE_VERSION,
    type: 'canvas',
    metadata,
    nodes: fileNodes,
    edges: fileEdges,
  };

  // Only add oauth_requirements if there are any
  if (Object.keys(oauthRequirements).length > 0) {
    canvasFile.oauth_requirements = oauthRequirements;
  }

  return canvasFile;
}

/**
 * Serialize a CanvasFile to JSON string
 */
export function serializeCanvasFile(canvasFile: CanvasFile): string {
  return JSON.stringify(canvasFile, null, 2);
}

/**
 * Generate a filename for the canvas export
 */
export function generateCanvasFilename(name: string): string {
  // Sanitize the name for use as a filename
  const sanitized = name
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename characters
    .replace(/\s+/g, '_')         // Replace spaces with underscores
    .substring(0, 50);             // Limit length

  // Add timestamp for uniqueness
  const timestamp = new Date().toISOString().split('T')[0];

  return `${sanitized}_${timestamp}${CANVAS_FILE_EXTENSION}`;
}

/**
 * Trigger a file download in the browser
 */
export function downloadCanvasFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  URL.revokeObjectURL(url);
}

/**
 * Valid canvas node types for validation
 */
const VALID_NODE_TYPES: CanvasNodeType[] = [
  'GENESIS_BOT',
  'TRAINING_SESSION',
  'BOARDROOM',
  'CABLE_CHANNEL',
  'TRIGGER',
  'MASTER_TRIGGER',
  'SMART_ROUTER',
  'RESPONSE_COMPILER',
  'TOOL',
  'TERMINAL_COMMAND',
  'CUSTOM',
];

/**
 * Validate a parsed canvas file
 */
export function validateCanvasFile(data: unknown): CanvasFileValidationResult {
  // Check if data is an object
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid file format: not a valid JSON object' };
  }

  const file = data as Record<string, unknown>;

  // Check required fields
  if (file.type !== 'canvas') {
    return { valid: false, error: 'Invalid file type: expected "canvas"' };
  }

  if (typeof file.version !== 'string') {
    return { valid: false, error: 'Missing or invalid version field' };
  }

  // Check version compatibility
  const [major] = file.version.split('.');
  const [currentMajor] = CANVAS_FILE_VERSION.split('.');
  if (major !== currentMajor) {
    return {
      valid: false,
      error: `Incompatible file version: ${file.version}. Expected major version ${currentMajor}`
    };
  }

  // Check metadata
  if (!file.metadata || typeof file.metadata !== 'object') {
    return { valid: false, error: 'Missing or invalid metadata' };
  }

  const metadata = file.metadata as Record<string, unknown>;
  if (typeof metadata.name !== 'string') {
    return { valid: false, error: 'Missing or invalid metadata.name' };
  }

  if (typeof metadata.mode !== 'string' || !['workflow', 'boardroom', 'hybrid'].includes(metadata.mode)) {
    return { valid: false, error: 'Missing or invalid metadata.mode' };
  }

  // Check nodes array
  if (!Array.isArray(file.nodes)) {
    return { valid: false, error: 'Missing or invalid nodes array' };
  }

  // Validate each node
  for (let i = 0; i < file.nodes.length; i++) {
    const node = file.nodes[i] as Record<string, unknown>;

    if (!node.type || !VALID_NODE_TYPES.includes(node.type as CanvasNodeType)) {
      return { valid: false, error: `Invalid node type at index ${i}: ${node.type}` };
    }

    if (!node.position || typeof node.position !== 'object') {
      return { valid: false, error: `Invalid node position at index ${i}` };
    }

    const position = node.position as Record<string, unknown>;
    if (typeof position.x !== 'number' || typeof position.y !== 'number') {
      return { valid: false, error: `Invalid node position coordinates at index ${i}` };
    }

    if (typeof node.label !== 'string') {
      return { valid: false, error: `Invalid node label at index ${i}` };
    }

    if (typeof node.original_id !== 'string') {
      return { valid: false, error: `Invalid node original_id at index ${i}` };
    }
  }

  // Check edges array
  if (!Array.isArray(file.edges)) {
    return { valid: false, error: 'Missing or invalid edges array' };
  }

  // Validate each edge
  for (let i = 0; i < file.edges.length; i++) {
    const edge = file.edges[i] as Record<string, unknown>;

    if (typeof edge.from_node_ref !== 'string') {
      return { valid: false, error: `Invalid edge from_node_ref at index ${i}` };
    }

    if (typeof edge.to_node_ref !== 'string') {
      return { valid: false, error: `Invalid edge to_node_ref at index ${i}` };
    }
  }

  return { valid: true, data: file as unknown as CanvasFile };
}

/**
 * Parse and validate a canvas file from a string
 * Includes pre-parse security checks and content sanitization
 */
export function parseCanvasFile(content: string): CanvasFileValidationResult {
  try {
    // Pre-parse security check
    const preParseResult = preParseJsonCheck(content);
    if (!preParseResult.valid) {
      return { valid: false, error: preParseResult.error };
    }

    // Parse JSON
    const data = JSON.parse(content);

    // Validate structure first
    const validationResult = validateCanvasFile(data);
    if (!validationResult.valid) {
      return validationResult;
    }

    // Sanitize content to remove potential XSS
    const { sanitized } = sanitizeImportData(data);

    return { valid: true, data: sanitized as unknown as CanvasFile };
  } catch (err) {
    return { valid: false, error: 'Invalid JSON format' };
  }
}

/**
 * Read a File object and parse it as a canvas file
 */
export async function readCanvasFile(file: File): Promise<CanvasFileValidationResult> {
  // Security validation: Check file extension
  const extCheck = validateImportFileExtension(file.name, 'canvas');
  if (!extCheck.valid) {
    return { valid: false, error: extCheck.error };
  }

  // Security validation: Check file size
  const sizeCheck = validateImportFileSize(file);
  if (!sizeCheck.valid) {
    return { valid: false, error: sizeCheck.error };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content !== 'string') {
        resolve({ valid: false, error: 'Failed to read file content' });
        return;
      }
      resolve(parseCanvasFile(content));
    };

    reader.onerror = () => {
      resolve({ valid: false, error: 'Failed to read file' });
    };

    reader.readAsText(file);
  });
}

/**
 * Extract OAuth requirements from a canvas file
 */
export function getOAuthRequirements(canvasFile: CanvasFile): string[] {
  const requirements: string[] = [];
  const oauthReqs = canvasFile.oauth_requirements;

  if (oauthReqs) {
    if (oauthReqs.gmail) requirements.push('gmail');
    if (oauthReqs.calendar) requirements.push('calendar');
    if (oauthReqs.sheets) requirements.push('sheets');
    if (oauthReqs.docs) requirements.push('docs');
    if (oauthReqs.slack) requirements.push('slack');
  }

  return requirements;
}

/**
 * Create a node ID mapping from original IDs to new IDs
 * Used during import to remap edge references
 */
export function createNodeIdMapping(
  fileNodes: CanvasFileNode[],
  newNodeIds: string[]
): Map<string, string> {
  const mapping = new Map<string, string>();

  fileNodes.forEach((node, index) => {
    mapping.set(node.original_id, newNodeIds[index]);
  });

  return mapping;
}

/**
 * Remap edge references using the node ID mapping
 */
export function remapEdgeReferences(
  edge: CanvasFileEdge,
  nodeIdMapping: Map<string, string>
): { from_node_id: string; to_node_id: string } | null {
  const newFromId = nodeIdMapping.get(edge.from_node_ref);
  const newToId = nodeIdMapping.get(edge.to_node_ref);

  if (!newFromId || !newToId) {
    return null; // Edge references a node that wasn't imported
  }

  return {
    from_node_id: newFromId,
    to_node_id: newToId,
  };
}
