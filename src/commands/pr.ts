import { BaseCommand } from './base.js';
import type { PRCommandOptions } from '../types/index.js';
import { logger } from '../utils/index.js';

export class PRCommand extends BaseCommand {
  async execute(prNumber: string, options: PRCommandOptions): Promise<void> {
    await this.initialize(options);

    const config = this.getConfig();
    const number = parseInt(prNumber, 10);

    if (isNaN(number) || number <= 0) {
      throw new Error(`Invalid pull request number: ${prNumber}`);
    }

    // Check if we're in a GitHub project
    if (!(await this.gitHubManager.isGitHubProject())) {
      throw new Error('Not in a GitHub project or gh CLI not available');
    }

    // Verify the pull request exists
    logger.startSpinner(`Checking pull request ${number}...`);

    let pr;
    try {
      pr = await this.gitHubManager.getPullRequest(number);
      logger.succeedSpinner(`Found PR ${number}: ${pr.title}`);
    } catch (error) {
      logger.failSpinner(`Pull request ${number} not found`);
      throw error;
    }

    // Generate worktree name from PR
    const baseName = await this.gitHubManager.generateWorktreeName(number);
    const worktreeName = await this.generateWorktreeName(baseName);
    logger.debug(`Generated worktree name: ${worktreeName}`);

    // Resolve the worktree path
    const worktreePath = this.gitWorktreeManager.resolveWorktreePath(
      config.worktreeDir,
      worktreeName
    );
    logger.debug(`Worktree path: ${worktreePath}`);

    // Check if worktree already exists
    if (await this.gitWorktreeManager.worktreeExists(worktreePath)) {
      if (options.checkout) {
        logger.info(`Worktree already exists at: ${worktreePath}`);
        logger.info(`Switching to existing worktree...`);
        // TODO: Add logic to switch to existing worktree
        return;
      } else {
        throw new Error(`Worktree already exists at: ${worktreePath}`);
      }
    }

    // Show what we're about to do
    logger.info(`Creating worktree for PR ${number}:`);
    logger.info(`  Title: ${pr.title}`);
    logger.info(`  Branch: ${pr.headRefName}`);
    logger.info(`  Target: ${pr.baseRefName}`);
    logger.info(`  State: ${pr.state}`);
    logger.info(`  URL: ${pr.url}`);
    logger.info(`  Worktree: ${worktreePath}`);

    if (options.dryRun) {
      logger.info('Dry run mode - no changes made');
      return;
    }

    try {
      // Fetch the pull request branch
      logger.startSpinner(`Fetching branch '${pr.headRefName}'...`);
      await this.gitHubManager.fetchPullRequestBranch(number);
      logger.succeedSpinner(`Branch '${pr.headRefName}' fetched`);

      // Create the worktree
      logger.startSpinner(`Creating worktree '${worktreeName}'...`);

      await this.gitWorktreeManager.createWorktree(worktreePath, pr.headRefName, {
        createBranch: false, // Use existing branch
        force: false,
        checkout: true,
      });

      logger.succeedSpinner(`Worktree '${worktreeName}' created successfully`);

      // Execute post-creation commands
      if (config.postCommands.length > 0) {
        await this.executePostCommands(worktreePath);
      }

      logger.success(`Worktree created at: ${worktreePath}`);
    } catch (error) {
      logger.error(`Failed to create worktree: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
}
