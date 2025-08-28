import { join, resolve, isAbsolute } from 'path';
import { existsSync, rmSync } from 'fs';
import { ExecUtils } from '../utils/exec.js';
import type { GitWorktree } from '../types/index.js';
import { GitError } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class GitWorktreeManager {
  constructor(private readonly cwd: string = process.cwd()) {}

  /**
   * List all existing worktrees
   */
  async listWorktrees(): Promise<GitWorktree[]> {
    try {
      const output = await ExecUtils.runOrThrow('git', ['worktree', 'list', '--porcelain'], {
        cwd: this.cwd,
      });

      const worktrees: GitWorktree[] = [];
      const lines = output.trim().split('\n');

      let currentWorktree: Partial<GitWorktree> = {};

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          if (currentWorktree.path) {
            worktrees.push(currentWorktree as GitWorktree);
          }
          currentWorktree = { path: line.substring(9) };
        } else if (line.startsWith('HEAD ')) {
          currentWorktree.commit = line.substring(5);
        } else if (line.startsWith('branch ')) {
          currentWorktree.branch = line.substring(7);
        } else if (line === 'bare') {
          currentWorktree.bare = true;
        } else if (line === 'detached') {
          currentWorktree.detached = true;
        }
      }

      if (currentWorktree.path) {
        worktrees.push(currentWorktree as GitWorktree);
      }

      return worktrees;
    } catch (error) {
      throw new GitError(
        `Failed to list worktrees: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Create a new worktree
   */
  async createWorktree(
    path: string,
    branchName: string,
    options: {
      createBranch?: boolean;
      force?: boolean;
      checkout?: boolean;
    } = {}
  ): Promise<void> {
    const { createBranch = true, force = false, checkout = true } = options;

    try {
      const args = ['worktree', 'add'];

      if (force) {
        args.push('--force');
      }

      if (createBranch) {
        args.push('-b', branchName);
      } else if (!checkout) {
        args.push('--detach');
      }

      args.push(path);

      if (!createBranch && checkout) {
        args.push(branchName);
      }

      logger.debug(`Creating worktree with command: git ${args.join(' ')}`);
      await ExecUtils.runOrThrow('git', args, { cwd: this.cwd });

      logger.debug(`Worktree created successfully at: ${path}`);
    } catch (error) {
      throw new GitError(
        `Failed to create worktree: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Remove a worktree
   */
  async removeWorktree(path: string, force = false): Promise<void> {
    try {
      const args = ['worktree', 'remove'];

      if (force) {
        args.push('--force');
      }

      args.push(path);

      logger.debug(`Removing worktree with command: git ${args.join(' ')}`);
      await ExecUtils.runOrThrow('git', args, { cwd: this.cwd });

      logger.debug(`Worktree removed successfully: ${path}`);
    } catch (error) {
      // If git worktree remove fails, try to remove the directory manually
      if (force && existsSync(path)) {
        logger.debug(`Git worktree remove failed, attempting manual cleanup: ${path}`);
        try {
          rmSync(path, { recursive: true, force: true });
          // Also try to prune the worktree from git's tracking
          await ExecUtils.run('git', ['worktree', 'prune'], { cwd: this.cwd });
        } catch (cleanupError) {
          logger.warn(
            `Manual cleanup also failed: ${cleanupError instanceof Error ? cleanupError.message : 'Unknown error'}`
          );
        }
      }

      throw new GitError(
        `Failed to remove worktree: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Check if a worktree exists at the given path
   */
  async worktreeExists(path: string): Promise<boolean> {
    const worktrees = await this.listWorktrees();
    const absolutePath = isAbsolute(path) ? path : resolve(this.cwd, path);
    return worktrees.some(wt => resolve(wt.path) === absolutePath);
  }

  /**
   * Find worktree by name (last part of path)
   */
  async findWorktreeByName(name: string): Promise<GitWorktree | null> {
    const worktrees = await this.listWorktrees();
    return (
      worktrees.find(wt => wt.path.endsWith(`/${name}`) || wt.path.endsWith(`\\${name}`)) || null
    );
  }

  /**
   * Resolve worktree path based on config
   */
  resolveWorktreePath(worktreeDir: string, name: string): string {
    const baseDir = isAbsolute(worktreeDir) ? worktreeDir : join(this.cwd, worktreeDir);
    return join(baseDir, name);
  }

  /**
   * Prune stale worktree entries
   */
  async pruneWorktrees(): Promise<void> {
    try {
      await ExecUtils.runOrThrow('git', ['worktree', 'prune'], { cwd: this.cwd });
      logger.debug('Worktrees pruned successfully');
    } catch (error) {
      throw new GitError(
        `Failed to prune worktrees: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }
}
