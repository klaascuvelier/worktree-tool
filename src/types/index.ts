import { z } from 'zod';

// Configuration schemas
export const PrefixTypeSchema = z.enum(['none', 'manual', 'detect']);
export type PrefixType = z.infer<typeof PrefixTypeSchema>;

export const PostCommandSchema = z.object({
  label: z.string(),
  commands: z.array(z.string()),
});
export type PostCommand = z.infer<typeof PostCommandSchema>;

export const ConfigSchema = z.object({
  prefixType: PrefixTypeSchema.default('none'),
  manualPrefix: z.string().optional(),
  worktreeDir: z.string().default('../worktrees'),
  postCommands: z.array(PostCommandSchema).default([]),
});
export type Config = z.infer<typeof ConfigSchema>;

// Git related types
export interface GitRemote {
  name: string;
  url: string;
  type: 'fetch' | 'push';
}

export interface GitWorktree {
  path: string;
  branch: string;
  commit: string;
  bare?: boolean;
  detached?: boolean;
}

export interface GitLabMR {
  iid: number;
  title: string;
  source_branch: string;
  target_branch: string;
  state: string;
  web_url: string;
}

// CLI related types
export interface CLIOptions {
  config?: string;
  verbose?: boolean;
  dryRun?: boolean;
}

export interface NewCommandOptions extends CLIOptions {
  branch?: string;
  noPush?: boolean;
}

export interface MRCommandOptions extends CLIOptions {
  checkout?: boolean;
}

export interface RemoveCommandOptions extends CLIOptions {
  force?: boolean;
}

// Error types
export class KWTError extends Error {
  public readonly code: string;
  public override readonly cause?: Error;

  constructor(message: string, code: string, cause?: Error) {
    super(message);
    this.name = 'KWTError';
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export class ConfigError extends KWTError {
  constructor(message: string, cause?: Error) {
    super(message, 'CONFIG_ERROR', cause);
  }
}

export class GitError extends KWTError {
  constructor(message: string, cause?: Error) {
    super(message, 'GIT_ERROR', cause);
  }
}

export class GitLabError extends KWTError {
  constructor(message: string, cause?: Error) {
    super(message, 'GITLAB_ERROR', cause);
  }
}
