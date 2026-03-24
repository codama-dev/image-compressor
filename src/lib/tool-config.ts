/**
 * TOOL CONFIGURATION
 *
 * Update these values for each new tool.
 * This is the single source of truth for tool-specific settings.
 */

export const TOOL_CONFIG = {
  /** Display name of the tool (e.g. "JSON Formatter") */
  name: 'Image Compressor',

  /** Short tagline (e.g. "Format and validate JSON instantly") */
  tagline: 'Compress images instantly in your browser',

  /** Full URL of the deployed tool */
  url: 'https://free-image-compressor.codama.dev/',

  /** localStorage key prefix to avoid collisions between tools */
  storagePrefix: 'codama-image-compressor',
} as const
