import { ExecUtils } from '../utils/exec.js';
import type { GitHubPR } from '../types/index.js';
import { GitHubError } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class GitHubManager {
  constructor(private readonly cwd: string = process.cwd()) {}

  /**
   * Check if gh CLI is available
   */
  async isGhAvailable(): Promise<boolean> {
    return await ExecUtils.exists('gh');
  }

  /**
   * Get pull request information by number
   */
  async getPullRequest(number: number): Promise<GitHubPR> {
    if (!(await this.isGhAvailable())) {
      throw new GitHubError('gh CLI is not available. Please install it first.');
    }

    try {
      const output = await ExecUtils.runOrThrow(
        'gh',
        ['pr', 'view', number.toString(), '--json', 'number,title,headRefName,baseRefName,state,url'],
        { cwd: this.cwd }
      );

      const prData = JSON.parse(output) as GitHubPR;
      logger.debug(`Retrieved PR data: ${JSON.stringify(prData)}`);

      return prData;
    } catch (error) {
      throw new GitHubError(
        `Failed to get pull request ${number}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Check if a pull request exists
   */
  async pullRequestExists(number: number): Promise<boolean> {
    try {
      await this.getPullRequest(number);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the head branch name from a pull request
   */
  async getPullRequestBranch(number: number): Promise<string> {
    const pr = await this.getPullRequest(number);
    return pr.headRefName;
  }

  /**
   * Generate a worktree name from pull request
   */
  async generateWorktreeName(number: number): Promise<string> {
    const pr = await this.getPullRequest(number);

    // Use the head branch name, but sanitize it for filesystem
    let name = pr.headRefName;

    // Replace problematic characters
    name = name.replace(/[^a-zA-Z0-9\-_]/g, '-');

    // Remove consecutive dashes
    name = name.replace(/-+/g, '-');

    // Remove leading/trailing dashes
    name = name.replace(/^-+|-+$/g, '');

    // If the name is empty or too short, use PR number
    if (name.length < 2) {
      name = `pr-${number}`;
    }

    logger.debug(`Generated worktree name for PR ${number}: ${name}`);
    return name;
  }

  /**
   * Fetch the pull request branch from remote
   */
  async fetchPullRequestBranch(number: number, remote = 'origin'): Promise<void> {
    const branchName = await this.getPullRequestBranch(number);

    try {
      await ExecUtils.runOrThrow('git', ['fetch', remote, `${branchName}:${branchName}`], {
        cwd: this.cwd,
      });

      logger.debug(`Fetched branch ${branchName} from ${remote}`);
    } catch (error) {
      // If the branch already exists locally, just fetch updates
      try {
        await ExecUtils.runOrThrow('git', ['fetch', remote, branchName], { cwd: this.cwd });

        logger.debug(`Updated existing branch ${branchName} from ${remote}`);
      } catch (fetchError) {
        throw new GitHubError(
          `Failed to fetch branch ${branchName}: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`,
          fetchError instanceof Error ? fetchError : undefined
        );
      }
    }
  }

  /**
   * Check if we're in a GitHub project
   */
  async isGitHubProject(): Promise<boolean> {
    if (!(await this.isGhAvailable())) {
      return false;
    }

    try {
      await ExecUtils.runOrThrow('gh', ['repo', 'view'], { cwd: this.cwd });
      return true;
    } catch {
      return false;
    }
  }
}
