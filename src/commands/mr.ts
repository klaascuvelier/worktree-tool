import { BaseCommand } from './base.js';
import type { MRCommandOptions } from '../types/index.js';
import { logger } from '../utils/index.js';

export class MRCommand extends BaseCommand {
  async execute(mrNumber: string, options: MRCommandOptions): Promise<void> {
    await this.initialize(options);

    const config = this.getConfig();
    const iid = parseInt(mrNumber, 10);

    if (isNaN(iid) || iid <= 0) {
      throw new Error(`Invalid merge request number: ${mrNumber}`);
    }

    // Check if we're in a GitLab project
    if (!(await this.gitLabManager.isGitLabProject())) {
      throw new Error('Not in a GitLab project or glab CLI not available');
    }

    // Verify the merge request exists
    logger.startSpinner(`Checking merge request ${iid}...`);

    let mr;
    try {
      mr = await this.gitLabManager.getMergeRequest(iid);
      logger.succeedSpinner(`Found MR ${iid}: ${mr.title}`);
    } catch (error) {
      logger.failSpinner(`Merge request ${iid} not found`);
      throw error;
    }

    // Generate worktree name from MR
    const baseName = await this.gitLabManager.generateWorktreeName(iid);
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

    if (options.dryRun) {
      logger.info('Dry run mode - would create:');
      logger.info(`  Worktree: ${worktreePath}`);
      logger.info(`  Branch: ${mr.source_branch}`);
      logger.info(`  MR: ${mr.title}`);
      if (config.postCommands.length > 0) {
        logger.info('  Post-creation commands:');
        config.postCommands.forEach(cmd => {
          logger.info(`    - ${cmd.label}`);
        });
      }
      return;
    }

    try {
      // Fetch the merge request branch
      logger.startSpinner(`Fetching branch '${mr.source_branch}'...`);
      await this.gitLabManager.fetchMergeRequestBranch(iid);
      logger.succeedSpinner(`Branch '${mr.source_branch}' fetched`);

      // Create the worktree
      logger.startSpinner(`Creating worktree '${worktreeName}'...`);

      await this.gitWorktreeManager.createWorktree(worktreePath, mr.source_branch, {
        createBranch: false, // Use existing branch
        force: false,
        checkout: true,
      });

      logger.succeedSpinner(`Worktree '${worktreeName}' created successfully`);

      // Execute post-creation commands
      if (config.postCommands.length > 0) {
        await this.executePostCommands(worktreePath);
      }

      logger.success(`Worktree for MR ${iid} is ready at: ${worktreePath}`);
      logger.info(`MR: ${mr.title}`);
      logger.info(`Branch: ${mr.source_branch}`);
      logger.info(`URL: ${mr.web_url}`);
    } catch (error) {
      logger.failSpinner();
      throw error;
    }
  }
}
