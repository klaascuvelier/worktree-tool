import { BaseCommand } from './base.js';
import type { NewCommandOptions } from '../types/index.js';
import { logger } from '../utils/index.js';

export class NewCommand extends BaseCommand {
  async execute(name: string, options: NewCommandOptions): Promise<void> {
    await this.initialize(options);

    const config = this.getConfig();

    // Generate the full worktree name with prefix
    const worktreeName = await this.generateWorktreeName(name);
    logger.debug(`Generated worktree name: ${worktreeName}`);

    // Resolve the worktree path
    const worktreePath = this.gitWorktreeManager.resolveWorktreePath(
      config.worktreeDir,
      worktreeName
    );
    logger.debug(`Worktree path: ${worktreePath}`);

    // Check if worktree already exists
    if (await this.gitWorktreeManager.worktreeExists(worktreePath)) {
      throw new Error(`Worktree already exists at: ${worktreePath}`);
    }

    // Determine branch name
    const branchName = options.branch || worktreeName;
    logger.debug(`Branch name: ${branchName}`);

    // Check if branch already exists
    if (await this.gitRemoteManager.branchExists(branchName)) {
      throw new Error(`Branch '${branchName}' already exists`);
    }

    if (options.dryRun) {
      logger.info('Dry run mode - would create:');
      logger.info(`  Worktree: ${worktreePath}`);
      logger.info(`  Branch: ${branchName}`);
      if (config.postCommands.length > 0) {
        logger.info('  Post-creation commands:');
        config.postCommands.forEach(cmd => {
          logger.info(`    - ${cmd.label}`);
        });
      }
      return;
    }

    try {
      // Create the worktree
      logger.startSpinner(`Creating worktree '${worktreeName}'...`);

      await this.gitWorktreeManager.createWorktree(worktreePath, branchName, {
        createBranch: true,
        force: false,
        checkout: true,
      });

      logger.succeedSpinner(`Worktree '${worktreeName}' created successfully`);

      // Execute post-creation commands
      if (config.postCommands.length > 0) {
        await this.executePostCommands(worktreePath);
      }

      // Push the new branch if not disabled
      if (!options.noPush) {
        try {
          logger.startSpinner(`Pushing branch '${branchName}' to origin...`);

          // Set upstream and push
          const { ExecUtils } = await import('../utils/index.js');
          await ExecUtils.runOrThrow('git', ['push', '-u', 'origin', branchName], {
            cwd: worktreePath,
          });

          logger.succeedSpinner(`Branch '${branchName}' pushed to origin`);
        } catch (error) {
          logger.failSpinner(
            `Failed to push branch: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
          logger.warn('You may need to push the branch manually later');
        }
      }

      logger.success(`Worktree '${worktreeName}' is ready at: ${worktreePath}`);
    } catch (error) {
      logger.failSpinner();
      throw error;
    }
  }
}
