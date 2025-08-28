import { ExecUtils } from '../utils/exec.js';
import type { GitRemote } from '../types/index.js';
import { GitError } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class GitRemoteManager {
  constructor(private readonly cwd: string = process.cwd()) {}

  /**
   * Get all git remotes
   */
  async getRemotes(): Promise<GitRemote[]> {
    try {
      const output = await ExecUtils.runOrThrow('git', ['remote', '-v'], { cwd: this.cwd });

      const remotes: GitRemote[] = [];
      const lines = output
        .trim()
        .split('\n')
        .filter(line => line.trim());

      for (const line of lines) {
        const match = line.match(/^(\S+)\s+(\S+)\s+\((\w+)\)$/);
        if (match?.[1] && match[2] && match[3]) {
          const [, name, url, type] = match;
          remotes.push({
            name,
            url,
            type: type as 'fetch' | 'push',
          });
        }
      }

      return remotes;
    } catch (error) {
      throw new GitError(
        `Failed to get git remotes: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get the origin remote URL
   */
  async getOriginUrl(): Promise<string> {
    const remotes = await this.getRemotes();
    const origin = remotes.find(remote => remote.name === 'origin' && remote.type === 'fetch');

    if (!origin) {
      throw new GitError('No origin remote found');
    }

    return origin.url;
  }

  /**
   * Extract repository name from a git remote URL
   */
  extractRepoName(url: string): string {
    logger.debug(`Extracting repo name from URL: ${url}`);

    // Handle different URL formats:
    // - git@github.com:user/repo.git
    // - https://github.com/user/repo.git
    // - https://gitlab.com/user/repo

    let repoName: string;

    if (url.startsWith('git@')) {
      // SSH format: git@github.com:user/repo.git
      const match = url.match(/git@[^:]+:([^/]+\/)?(.+?)(?:\.git)?$/);
      if (match?.[2]) {
        repoName = match[2];
      } else {
        throw new GitError(`Unable to parse SSH git URL: ${url}`);
      }
    } else if (url.startsWith('http')) {
      // HTTPS format: https://github.com/user/repo.git
      const match = url.match(/https?:\/\/[^/]+\/([^/]+\/)?(.+?)(?:\.git)?(?:\/)?$/);
      if (match?.[2]) {
        repoName = match[2];
      } else {
        throw new GitError(`Unable to parse HTTPS git URL: ${url}`);
      }
    } else {
      throw new GitError(`Unsupported git URL format: ${url}`);
    }

    logger.debug(`Extracted repo name: ${repoName}`);
    return repoName;
  }

  /**
   * Generate a prefix from the origin remote
   */
  async generatePrefix(): Promise<string> {
    const originUrl = await this.getOriginUrl();
    const repoName = this.extractRepoName(originUrl);
    return `${repoName}-`;
  }

  /**
   * Check if we're in a git repository
   */
  async isGitRepo(): Promise<boolean> {
    try {
      await ExecUtils.runOrThrow('git', ['rev-parse', '--git-dir'], { cwd: this.cwd });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the current branch name
   */
  async getCurrentBranch(): Promise<string> {
    try {
      const output = await ExecUtils.runOrThrow('git', ['branch', '--show-current'], {
        cwd: this.cwd,
      });
      return output.trim();
    } catch (error) {
      throw new GitError(
        `Failed to get current branch: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Check if a branch exists locally
   */
  async branchExists(branchName: string): Promise<boolean> {
    try {
      await ExecUtils.runOrThrow(
        'git',
        ['show-ref', '--verify', '--quiet', `refs/heads/${branchName}`],
        { cwd: this.cwd }
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a branch exists on remote
   */
  async remoteBranchExists(branchName: string, remote = 'origin'): Promise<boolean> {
    try {
      await ExecUtils.runOrThrow(
        'git',
        ['show-ref', '--verify', '--quiet', `refs/remotes/${remote}/${branchName}`],
        { cwd: this.cwd }
      );
      return true;
    } catch {
      return false;
    }
  }
}
