/**
 * File System Types
 *
 * Types for file system operations between agent and client.
 * The client mediates all file system access.
 *
 * @see Section 5.2.2 and 5.2.3 of the ACP specification
 */

import { z } from "zod";

// =============================================================================
// Read Text File
// =============================================================================

/**
 * Parameters for the `fs/read_text_file` method.
 * Reads a text file from the client's file system.
 *
 * @example Full file:
 * ```json
 * {
 *   "path": "/home/user/project/src/auth.ts"
 * }
 * ```
 *
 * @example Partial read:
 * ```json
 * {
 *   "path": "/home/user/project/src/auth.ts",
 *   "startLine": 10,
 *   "endLine": 50
 * }
 * ```
 */
export interface ReadTextFileRequest {
  /** Absolute path to the file to read */
  path: string;
  /** Text encoding (default: "utf-8") */
  encoding?: string;
  /** First line to read (1-indexed, inclusive) */
  startLine?: number;
  /** Last line to read (1-indexed, inclusive) */
  endLine?: number;
}

export const ReadTextFileRequestSchema = z.object({
  path: z.string(),
  encoding: z.string().optional(),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
});

/**
 * Result of the `fs/read_text_file` method.
 *
 * @example
 * ```json
 * {
 *   "content": "export function login(username: string, password: string) {...}",
 *   "encoding": "utf-8",
 *   "totalLines": 50,
 *   "truncated": false
 * }
 * ```
 */
export interface ReadTextFileResponse {
  /** File content */
  content: string;
  /** Actual encoding used */
  encoding: string;
  /** Total number of lines in the file */
  totalLines?: number;
  /** Whether content was truncated */
  truncated?: boolean;
}

export const ReadTextFileResponseSchema = z.object({
  content: z.string(),
  encoding: z.string(),
  totalLines: z.number().int().nonnegative().optional(),
  truncated: z.boolean().optional(),
});

// =============================================================================
// Write Text File
// =============================================================================

/**
 * Parameters for the `fs/write_text_file` method.
 * Writes content to a text file.
 *
 * @example
 * ```json
 * {
 *   "path": "/home/user/project/src/auth.ts",
 *   "content": "export function login(username: string, password: string) {...}",
 *   "createDirectories": true,
 *   "overwrite": true
 * }
 * ```
 */
export interface WriteTextFileRequest {
  /** Absolute path to the file to write */
  path: string;
  /** Content to write */
  content: string;
  /** Text encoding (default: "utf-8") */
  encoding?: string;
  /** Create parent directories if they don't exist */
  createDirectories?: boolean;
  /** Overwrite existing file (default: true) */
  overwrite?: boolean;
}

export const WriteTextFileRequestSchema = z.object({
  path: z.string(),
  content: z.string(),
  encoding: z.string().optional(),
  createDirectories: z.boolean().optional(),
  overwrite: z.boolean().optional(),
});

/**
 * Result of the `fs/write_text_file` method.
 *
 * @example
 * ```json
 * {
 *   "bytesWritten": 456,
 *   "created": false
 * }
 * ```
 */
export interface WriteTextFileResponse {
  /** Number of bytes written */
  bytesWritten: number;
  /** Whether the file was newly created */
  created: boolean;
}

export const WriteTextFileResponseSchema = z.object({
  bytesWritten: z.number().int().nonnegative(),
  created: z.boolean(),
});

// =============================================================================
// Additional File Operations (Future/Extended)
// =============================================================================

/**
 * Parameters for listing a directory (future extension).
 */
export interface ListDirectoryRequest {
  /** Absolute path to the directory */
  path: string;
  /** Include hidden files */
  includeHidden?: boolean;
  /** Maximum depth for recursive listing */
  maxDepth?: number;
}

export const ListDirectoryRequestSchema = z.object({
  path: z.string(),
  includeHidden: z.boolean().optional(),
  maxDepth: z.number().int().positive().optional(),
});

/**
 * A directory entry.
 */
export interface DirectoryEntry {
  /** Entry name (not full path) */
  name: string;
  /** Entry type */
  type: "file" | "directory" | "symlink" | "other";
  /** File size in bytes (for files) */
  size?: number;
  /** Last modification time (ISO 8601) */
  modifiedAt?: string;
}

export const DirectoryEntrySchema = z.object({
  name: z.string(),
  type: z.enum(["file", "directory", "symlink", "other"]),
  size: z.number().int().nonnegative().optional(),
  modifiedAt: z.string().datetime().optional(),
});

/**
 * Result of listing a directory (future extension).
 */
export interface ListDirectoryResponse {
  /** Path that was listed */
  path: string;
  /** Directory entries */
  entries: DirectoryEntry[];
  /** Whether the listing was truncated */
  truncated?: boolean;
}

export const ListDirectoryResponseSchema = z.object({
  path: z.string(),
  entries: z.array(DirectoryEntrySchema),
  truncated: z.boolean().optional(),
});

/**
 * Parameters for deleting a file (future extension).
 */
export interface DeleteFileRequest {
  /** Absolute path to the file to delete */
  path: string;
  /** Delete recursively if directory */
  recursive?: boolean;
}

export const DeleteFileRequestSchema = z.object({
  path: z.string(),
  recursive: z.boolean().optional(),
});

/**
 * Result of deleting a file (future extension).
 */
export interface DeleteFileResponse {
  /** Whether the file was deleted */
  deleted: boolean;
}

export const DeleteFileResponseSchema = z.object({
  deleted: z.boolean(),
});

/**
 * Parameters for moving/renaming a file (future extension).
 */
export interface MoveFileRequest {
  /** Source path */
  sourcePath: string;
  /** Destination path */
  destinationPath: string;
  /** Overwrite if destination exists */
  overwrite?: boolean;
}

export const MoveFileRequestSchema = z.object({
  sourcePath: z.string(),
  destinationPath: z.string(),
  overwrite: z.boolean().optional(),
});

/**
 * Result of moving a file (future extension).
 */
export interface MoveFileResponse {
  /** Whether the move succeeded */
  moved: boolean;
}

export const MoveFileResponseSchema = z.object({
  moved: z.boolean(),
});

/**
 * File stat information.
 */
export interface FileStat {
  /** File type */
  type: "file" | "directory" | "symlink" | "other";
  /** File size in bytes */
  size: number;
  /** Creation time (ISO 8601) */
  createdAt?: string;
  /** Last modification time (ISO 8601) */
  modifiedAt?: string;
  /** Last access time (ISO 8601) */
  accessedAt?: string;
  /** Whether the file is read-only */
  readonly?: boolean;
}

export const FileStatSchema = z.object({
  type: z.enum(["file", "directory", "symlink", "other"]),
  size: z.number().int().nonnegative(),
  createdAt: z.string().datetime().optional(),
  modifiedAt: z.string().datetime().optional(),
  accessedAt: z.string().datetime().optional(),
  readonly: z.boolean().optional(),
});

/**
 * Parameters for getting file stats (future extension).
 */
export interface StatFileRequest {
  /** Absolute path to the file */
  path: string;
}

export const StatFileRequestSchema = z.object({
  path: z.string(),
});

/**
 * Result of getting file stats (future extension).
 */
export interface StatFileResponse {
  /** File path */
  path: string;
  /** File statistics */
  stat: FileStat;
}

export const StatFileResponseSchema = z.object({
  path: z.string(),
  stat: FileStatSchema,
});
