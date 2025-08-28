import { ConfigManager } from '../config/index.js';
import { GitRemoteManager, GitWorktreeManager, GitLabManager } from '../git/index.js';
import type { Config, CLIOptions, PostCommand } from '../types/index.js';
import { logger, ExecUtils } from '../utils/index.js';

export abstract class BaseCommand {
  protected configManager: ConfigManager;
  protected gitRemoteManager: GitRemoteManager;
  protected gitWorktreeManager: GitWorktreeManager;
  protected gitLabManager: GitLabManager;
  protected config: Config | null = null;

  constructor(protected readonly cwd: string = process.cwd()) {
    this.configManager = new ConfigManager(cwd);
    this.gitRemoteManager = new GitRemoteManager(cwd);
    this.gitWorktreeManager = new GitWorktreeManager(cwd);
    this.gitLabManager = new GitLabManager(cwd);
  }

  /**
   * Initialize the command by loading configuration
   */
  protected async initialize(options: CLIOptions): Promise<void> {
    // Set logger verbosity
    if (options.verbose) {
      logger.setVerbose(true);
    }

    // Load configuration
    this.config = await this.configManager.loadConfig();

    // Verify we're in a git repository
    if (!(await this.gitRemoteManager.isGitRepo())) {
      throw new Error('Not in a git repository');
    }
  }

  /**
   * Get the configuration, throwing if not initialized
   */
  protected getConfig(): Config {
    if (!this.config) {
      throw new Error('Command not initialized. Call initialize() first.');
    }
    return this.config;
  }

  /**
   * Generate prefix based on configuration
   */
  protected async generatePrefix(): Promise<string> {
    const config = this.getConfig();

    switch (config.prefixType) {
      case 'none':
        return '';

      case 'manual':
        return config.manualPrefix || '';

      case 'detect':
        return await this.gitRemoteManager.generatePrefix();

      default:
        throw new Error(`Unknown prefix type: ${config.prefixType}`);
    }
  }

  /**
   * Generate full worktree name with prefix
   */
  protected async generateWorktreeName(baseName: string): Promise<string> {
    const prefix = await this.generatePrefix();
    return `${prefix}${baseName}`;
  }

  /**
   * Execute post-creation commands
   */
  protected async executePostCommands(worktreePath: string): Promise<void> {
    const config = this.getConfig();

    if (config.postCommands.length === 0) {
      return;
    }

    logger.info('Executing post-creation commands...');

    for (const postCommand of config.postCommands) {
      await this.executePostCommand(postCommand, worktreePath);
    }
  }

  /**
   * Execute a single post-creation command
   */
  private async executePostCommand(postCommand: PostCommand, worktreePath: string): Promise<void> {
    logger.info(`Running: ${postCommand.label}`);

    for (const command of postCommand.commands) {
      logger.debug(`Executing: ${command}`);

      try {
        // Split command into program and args
        const parts = command.trim().split(/\s+/);
        const program = parts[0];
        const args = parts.slice(1);

        if (!program) {
          logger.warn(`Empty command in ${postCommand.label}, skipping`);
          continue;
        }

        await ExecUtils.runOrThrow(program, args, { cwd: worktreePath });
        logger.debug(`Command completed successfully: ${command}`);
      } catch (error) {
        logger.error(`Command failed: ${command}`);
        logger.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      }
    }

    logger.success(`Completed: ${postCommand.label}`);
  }

  /**
   * Abstract method that subclasses must implement
   */
  abstract execute(...args: unknown[]): Promise<void>;
}
