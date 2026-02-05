/**
 * Content Block Types
 *
 * Content blocks are the building blocks of messages between client and agent.
 * These types align with MCP content block patterns.
 *
 * @see Section 9 of the ACP specification
 */

import { z } from "zod";

// =============================================================================
// Text Content
// =============================================================================

/**
 * A text content block.
 *
 * @example
 * ```json
 * {
 *   "type": "text",
 *   "text": "Please refactor this function to use async/await"
 * }
 * ```
 */
export interface TextContent {
  /** Block type identifier */
  type: "text";
  /** Text content */
  text: string;
  /** Optional annotations for the content */
  annotations?: ContentAnnotations;
}

export const TextContentSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
  annotations: z
    .object({
      audience: z.array(z.enum(["user", "assistant"])).optional(),
      priority: z.number().optional(),
    })
    .optional(),
});

// =============================================================================
// Image Content
// =============================================================================

/**
 * Source for base64-encoded image data.
 */
export interface Base64ImageSource {
  /** Source type identifier */
  type: "base64";
  /** MIME type (e.g., "image/png", "image/jpeg") */
  mediaType: string;
  /** Base64-encoded image data */
  data: string;
}

/**
 * Source for URL-referenced image.
 */
export interface UrlImageSource {
  /** Source type identifier */
  type: "url";
  /** MIME type (e.g., "image/png", "image/jpeg") */
  mediaType: string;
  /** URL pointing to the image */
  url: string;
}

/**
 * Union type for image sources.
 */
export type ImageSource = Base64ImageSource | UrlImageSource;

/**
 * An image content block.
 *
 * @example Base64 encoded:
 * ```json
 * {
 *   "type": "image",
 *   "source": {
 *     "type": "base64",
 *     "mediaType": "image/png",
 *     "data": "iVBORw0KGgo..."
 *   }
 * }
 * ```
 *
 * @example URL reference:
 * ```json
 * {
 *   "type": "image",
 *   "source": {
 *     "type": "url",
 *     "mediaType": "image/png",
 *     "url": "https://example.com/image.png"
 *   }
 * }
 * ```
 */
export interface ImageContent {
  /** Block type identifier */
  type: "image";
  /** Image source (base64 or URL) */
  source: ImageSource;
  /** Optional annotations */
  annotations?: ContentAnnotations;
}

export const ImageSourceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("base64"),
    mediaType: z.string(),
    data: z.string(),
  }),
  z.object({
    type: z.literal("url"),
    mediaType: z.string(),
    url: z.string().url(),
  }),
]);

export const ImageContentSchema = z.object({
  type: z.literal("image"),
  source: ImageSourceSchema,
  annotations: z
    .object({
      audience: z.array(z.enum(["user", "assistant"])).optional(),
      priority: z.number().optional(),
    })
    .optional(),
});

// =============================================================================
// Audio Content
// =============================================================================

/**
 * Source for base64-encoded audio data.
 */
export interface Base64AudioSource {
  /** Source type identifier */
  type: "base64";
  /** MIME type (e.g., "audio/wav", "audio/mp3") */
  mediaType: string;
  /** Base64-encoded audio data */
  data: string;
}

/**
 * Source for URL-referenced audio.
 */
export interface UrlAudioSource {
  /** Source type identifier */
  type: "url";
  /** MIME type (e.g., "audio/wav", "audio/mp3") */
  mediaType: string;
  /** URL pointing to the audio */
  url: string;
}

/**
 * Union type for audio sources.
 */
export type AudioSource = Base64AudioSource | UrlAudioSource;

/**
 * An audio content block.
 *
 * @example
 * ```json
 * {
 *   "type": "audio",
 *   "source": {
 *     "type": "base64",
 *     "mediaType": "audio/wav",
 *     "data": "UklGRi..."
 *   }
 * }
 * ```
 */
export interface AudioContent {
  /** Block type identifier */
  type: "audio";
  /** Audio source (base64 or URL) */
  source: AudioSource;
  /** Optional annotations */
  annotations?: ContentAnnotations;
}

export const AudioSourceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("base64"),
    mediaType: z.string(),
    data: z.string(),
  }),
  z.object({
    type: z.literal("url"),
    mediaType: z.string(),
    url: z.string().url(),
  }),
]);

export const AudioContentSchema = z.object({
  type: z.literal("audio"),
  source: AudioSourceSchema,
  annotations: z
    .object({
      audience: z.array(z.enum(["user", "assistant"])).optional(),
      priority: z.number().optional(),
    })
    .optional(),
});

// =============================================================================
// Resource Link
// =============================================================================

/**
 * A resource link content block.
 * References an external resource without embedding content.
 *
 * @example
 * ```json
 * {
 *   "type": "resource_link",
 *   "uri": "file:///home/user/project/src/auth.ts",
 *   "mimeType": "text/typescript",
 *   "title": "auth.ts"
 * }
 * ```
 */
export interface ResourceLink {
  /** Block type identifier */
  type: "resource_link";
  /** Resource URI (e.g., file://, https://) */
  uri: string;
  /** MIME type hint (optional) */
  mimeType?: string;
  /** Display title (optional) */
  title?: string;
  /** Optional annotations */
  annotations?: ContentAnnotations;
}

export const ResourceLinkSchema = z.object({
  type: z.literal("resource_link"),
  uri: z.string(),
  mimeType: z.string().optional(),
  title: z.string().optional(),
  annotations: z
    .object({
      audience: z.array(z.enum(["user", "assistant"])).optional(),
      priority: z.number().optional(),
    })
    .optional(),
});

// =============================================================================
// Embedded Resource
// =============================================================================

/**
 * An embedded resource content block.
 * Includes resource content inline.
 *
 * @example
 * ```json
 * {
 *   "type": "resource",
 *   "uri": "file:///home/user/project/src/auth.ts",
 *   "mimeType": "text/typescript",
 *   "title": "auth.ts",
 *   "content": "export function authenticate(user: User): Promise<Token> {\n  // ...\n}"
 * }
 * ```
 */
export interface EmbeddedResource {
  /** Block type identifier */
  type: "resource";
  /** Resource URI */
  uri: string;
  /** MIME type (optional) */
  mimeType?: string;
  /** Display title (optional) */
  title?: string;
  /** Resource content (required for embedded resources) */
  content: string;
  /** Optional annotations */
  annotations?: ContentAnnotations;
}

export const EmbeddedResourceSchema = z.object({
  type: z.literal("resource"),
  uri: z.string(),
  mimeType: z.string().optional(),
  title: z.string().optional(),
  content: z.string(),
  annotations: z
    .object({
      audience: z.array(z.enum(["user", "assistant"])).optional(),
      priority: z.number().optional(),
    })
    .optional(),
});

// =============================================================================
// Content Annotations
// =============================================================================

/**
 * Annotations that can be attached to content blocks.
 */
export interface ContentAnnotations {
  /**
   * Intended audience for this content.
   * - "user": Meant for the human user
   * - "assistant": Meant for the AI assistant
   */
  audience?: Array<"user" | "assistant">;
  /**
   * Priority level for display ordering.
   * Higher values indicate higher priority.
   */
  priority?: number;
}

export const ContentAnnotationsSchema = z.object({
  audience: z.array(z.enum(["user", "assistant"])).optional(),
  priority: z.number().optional(),
});

// =============================================================================
// Content Block Union
// =============================================================================

/**
 * Union type for all content block types.
 */
export type ContentBlock =
  | TextContent
  | ImageContent
  | AudioContent
  | ResourceLink
  | EmbeddedResource;

export const ContentBlockSchema = z.discriminatedUnion("type", [
  TextContentSchema,
  ImageContentSchema,
  AudioContentSchema,
  ResourceLinkSchema,
  EmbeddedResourceSchema,
]);

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if content is text.
 */
export function isTextContent(content: ContentBlock): content is TextContent {
  return content.type === "text";
}

/**
 * Type guard to check if content is an image.
 */
export function isImageContent(content: ContentBlock): content is ImageContent {
  return content.type === "image";
}

/**
 * Type guard to check if content is audio.
 */
export function isAudioContent(content: ContentBlock): content is AudioContent {
  return content.type === "audio";
}

/**
 * Type guard to check if content is a resource link.
 */
export function isResourceLink(content: ContentBlock): content is ResourceLink {
  return content.type === "resource_link";
}

/**
 * Type guard to check if content is an embedded resource.
 */
export function isEmbeddedResource(
  content: ContentBlock
): content is EmbeddedResource {
  return content.type === "resource";
}
