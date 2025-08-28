import { BaseCommand } from './base.js';
import type { RemoveCommandOptions } from '../types/index.js';
import { logger } from '../utils/index.js';
import inquirer from 'inquirer';

export class RemoveCommand extends BaseCommand {
  async execute(name: string, options: RemoveCommandOptions): Promise<void> {
    await this.initialize(options);

    // Generate the full worktree name with prefix
    const worktreeName = await this.generateWorktreeName(name);
    logger.debug(`Looking for worktree: ${worktreeName}`);

    // Try to find the worktree by name
    let worktree = await this.gitWorktreeManager.findWorktreeByName(worktreeName);

    // If not found with prefix, try without prefix
    if (!worktree) {
      worktree = await this.gitWorktreeManager.findWorktreeByName(name);
    }

    if (!worktree) {
      // List available worktrees for reference
      const worktrees = await this.gitWorktreeManager.listWorktrees();
      const nonMainWorktrees = worktrees.filter(
        wt => !wt.bare && wt.branch !== 'main' && wt.branch !== 'master'
      );

      if (nonMainWorktrees.length > 0) {
        logger.error(`Worktree '${name}' not found. Available worktrees:`);
        nonMainWorktrees.forEach(wt => {
          const wtName = wt.path.split('/').pop() || wt.path;
          logger.info(`  - ${wtName} (${wt.branch})`);
        });
      } else {
        logger.error(`Worktree '${name}' not found and no other worktrees available.`);
      }

      throw new Error(`Worktree '${name}' not found`);
    }

    const worktreePath = worktree.path;
    const branchName = worktree.branch;

    logger.info(`Found worktree: ${worktreePath}`);
    logger.info(`Branch: ${branchName}`);

    if (options.dryRun) {
      logger.info('Dry run mode - would remove:');
      logger.info(`  Worktree: ${worktreePath}`);
      logger.info(`  Branch: ${branchName}`);
      return;
    }

    // Confirm deletion unless force is used
    if (!options.force) {
      const { confirmed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: `Are you sure you want to remove worktree '${name}' and branch '${branchName}'?`,
          default: false,
        },
      ]);

      if (!confirmed) {
        logger.info('Operation cancelled');
        return;
      }
    }

    try {
      // Remove the worktree
      logger.startSpinner(`Removing worktree '${name}'...`);

      await this.gitWorktreeManager.removeWorktree(worktreePath, options.force);

      logger.succeedSpinner(`Worktree '${name}' removed successfully`);

      // Ask if user wants to delete the branch as well
      if (!options.force && branchName) {
        const { deleteBranch } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'deleteBranch',
            message: `Do you also want to delete the branch '${branchName}'?`,
            default: false,
          },
        ]);

        if (deleteBranch) {
          try {
            logger.startSpinner(`Deleting branch '${branchName}'...`);

            const { ExecUtils } = await import('../utils/index.js');

            // Delete local branch
            await ExecUtils.runOrThrow('git', ['branch', '-D', branchName], { cwd: this.cwd });

            // Try to delete remote branch
            try {
              await ExecUtils.runOrThrow('git', ['push', 'origin', '--delete', branchName], {
                cwd: this.cwd,
              });
              logger.succeedSpinner(`Branch '${branchName}' deleted locally and remotely`);
            } catch {
              logger.succeedSpinner(
                `Branch '${branchName}' deleted locally (remote deletion failed)`
              );
              logger.warn('You may need to delete the remote branch manually');
            }
          } catch (error) {
            logger.failSpinner(
              `Failed to delete branch: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        }
      }

      logger.success(`Cleanup completed for '${name}'`);
    } catch (error) {
      logger.failSpinner();
      throw error;
    }
  }
}
