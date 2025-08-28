import { Command } from 'commander';
import { NewCommand, MRCommand, RemoveCommand } from './commands/index.js';
import { ConfigManager } from './config/index.js';
import { logger } from './utils/index.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get package.json for version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

const program = new Command();

program
  .name('kwt')
  .description('k11r Worktree Tool - A TypeScript wrapper around git worktrees')
  .version(packageJson.version);

// Global options
program
  .option('-v, --verbose', 'enable verbose logging')
  .option('-c, --config <path>', 'path to config file')
  .option('--dry-run', 'show what would be done without executing');

// New command
program
  .command('new')
  .description('create a new worktree')
  .argument('<name>', 'name for the worktree')
  .option('-b, --branch <name>', 'custom branch name (defaults to worktree name)')
  .option('--no-push', 'do not push the new branch to origin')
  .action(async (name: string, options) => {
    try {
      const globalOptions = program.opts();
      const command = new NewCommand();
      await command.execute(name, { ...globalOptions, ...options });
    } catch (error) {
      logger.error(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// MR command
program
  .command('mr')
  .description('create a worktree from a GitLab merge request')
  .argument('<number>', 'merge request number')
  .option('--checkout', 'checkout existing worktree if it exists')
  .action(async (number: string, options) => {
    try {
      const globalOptions = program.opts();
      const command = new MRCommand();
      await command.execute(number, { ...globalOptions, ...options });
    } catch (error) {
      logger.error(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// Remove command
program
  .command('rm')
  .alias('remove')
  .description('remove a worktree')
  .argument('<name>', 'name of the worktree to remove')
  .option('-f, --force', 'force removal without confirmation')
  .action(async (name: string, options) => {
    try {
      const globalOptions = program.opts();
      const command = new RemoveCommand();
      await command.execute(name, { ...globalOptions, ...options });
    } catch (error) {
      logger.error(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// Config command
program
  .command('config')
  .description('manage configuration')
  .option('--init', 'initialize local configuration')
  .option('--global', 'use global configuration')
  .option('--set <key=value>', 'set a configuration value')
  .option('--get <key>', 'get a configuration value')
  .option('--list', 'list all configuration values')
  .action(async options => {
    try {
      const globalOptions = program.opts();
      logger.setVerbose(globalOptions['verbose'] || false);

      const configManager = new ConfigManager();

      if (options.init) {
        if (!configManager.hasLocalConfig()) {
          await configManager.initLocalConfig();
          logger.success('Local configuration initialized');
        } else {
          logger.info('Local configuration already exists');
        }
        return;
      }

      if (options.list) {
        const config = await configManager.loadConfig();
        logger.info('Current configuration:');
        console.log(JSON.stringify(config, null, 2));
        return;
      }

      if (options.get) {
        const config = await configManager.loadConfig();
        const value = (config as any)[options.get];
        if (value !== undefined) {
          console.log(JSON.stringify(value, null, 2));
        } else {
          logger.error(`Configuration key '${options.get}' not found`);
          process.exit(1);
        }
        return;
      }

      if (options.set) {
        const [key, ...valueParts] = options.set.split('=');
        const value = valueParts.join('=');

        if (!key || !value) {
          logger.error('Invalid format. Use: --set key=value');
          process.exit(1);
        }

        // Parse value as JSON if possible, otherwise treat as string
        let parsedValue: any = value;
        try {
          parsedValue = JSON.parse(value);
        } catch {
          // Keep as string
        }

        const partialConfig = { [key]: parsedValue };

        if (options.global) {
          await configManager.saveGlobalConfig(partialConfig);
          logger.success(`Global configuration updated: ${key} = ${JSON.stringify(parsedValue)}`);
        } else {
          await configManager.saveLocalConfig(partialConfig);
          logger.success(`Local configuration updated: ${key} = ${JSON.stringify(parsedValue)}`);
        }
        return;
      }

      // Default: show help
      program.help();
    } catch (error) {
      logger.error(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// List command
program
  .command('list')
  .alias('ls')
  .description('list all worktrees')
  .action(async () => {
    try {
      const globalOptions = program.opts();
      logger.setVerbose(globalOptions['verbose'] || false);

      const { GitWorktreeManager } = await import('./git/index.js');
      const worktreeManager = new GitWorktreeManager();

      const worktrees = await worktreeManager.listWorktrees();

      if (worktrees.length === 0) {
        logger.info('No worktrees found');
        return;
      }

      logger.info('Worktrees:');
      worktrees.forEach(wt => {
        const name = wt.path.split('/').pop() || wt.path;
        const status = wt.bare ? '(bare)' : wt.detached ? '(detached)' : '';
        logger.info(`  ${name} -> ${wt.branch || wt.commit} ${status}`);
      });
    } catch (error) {
      logger.error(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();
