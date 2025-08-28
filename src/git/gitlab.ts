import { ExecUtils } from '../utils/exec.js';
import type { GitLabMR } from '../types/index.js';
import { GitLabError } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class GitLabManager {
  constructor(private readonly cwd: string = process.cwd()) {}

  /**
   * Check if glab CLI is available
   */
  async isGlabAvailable(): Promise<boolean> {
    return await ExecUtils.exists('glab');
  }

  /**
   * Get merge request information by IID
   */
  async getMergeRequest(iid: number): Promise<GitLabMR> {
    if (!(await this.isGlabAvailable())) {
      throw new GitLabError('glab CLI is not available. Please install it first.');
    }

    try {
      const output = await ExecUtils.runOrThrow(
        'glab',
        ['mr', 'view', iid.toString(), '--output', 'json'],
        { cwd: this.cwd }
      );

      const mrData = JSON.parse(output) as GitLabMR;
      logger.debug(`Retrieved MR data: ${JSON.stringify(mrData)}`);

      return mrData;
    } catch (error) {
      throw new GitLabError(
        `Failed to get merge request ${iid}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Check if a merge request exists
   */
  async mergeRequestExists(iid: number): Promise<boolean> {
    try {
      await this.getMergeRequest(iid);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the source branch name from a merge request
   */
  async getMergeRequestBranch(iid: number): Promise<string> {
    const mr = await this.getMergeRequest(iid);
    return mr.source_branch;
  }

  /**
   * Generate a worktree name from merge request
   */
  async generateWorktreeName(iid: number): Promise<string> {
    const mr = await this.getMergeRequest(iid);

    // Use the source branch name, but sanitize it for filesystem
    let name = mr.source_branch;

    // Replace problematic characters
    name = name.replace(/[^a-zA-Z0-9\-_]/g, '-');

    // Remove consecutive dashes
    name = name.replace(/-+/g, '-');

    // Remove leading/trailing dashes
    name = name.replace(/^-+|-+$/g, '');

    // If the name is empty or too short, use MR number
    if (name.length < 2) {
      name = `mr-${iid}`;
    }

    logger.debug(`Generated worktree name for MR ${iid}: ${name}`);
    return name;
  }

  /**
   * Fetch the merge request branch from remote
   */
  async fetchMergeRequestBranch(iid: number, remote = 'origin'): Promise<void> {
    const branchName = await this.getMergeRequestBranch(iid);

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
        throw new GitLabError(
          `Failed to fetch branch ${branchName}: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`,
          fetchError instanceof Error ? fetchError : undefined
        );
      }
    }
  }

  /**
   * Check if we're in a GitLab project
   */
  async isGitLabProject(): Promise<boolean> {
    if (!(await this.isGlabAvailable())) {
      return false;
    }

    try {
      await ExecUtils.runOrThrow('glab', ['repo', 'view'], { cwd: this.cwd });
      return true;
    } catch {
      return false;
    }
  }
}
