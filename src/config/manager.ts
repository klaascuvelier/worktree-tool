import { cosmiconfigSync } from 'cosmiconfig';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import type { Config } from '../types/index.js';
import { ConfigSchema, ConfigError } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class ConfigManager {
  private static readonly CONFIG_NAME = 'kwt';
  private static readonly GLOBAL_CONFIG_FILE = '.kwt';

  private localConfig: Config | null = null;
  private globalConfig: Config | null = null;
  private mergedConfig: Config | null = null;

  constructor(private readonly cwd: string = process.cwd()) {}

  /**
   * Load and merge local and global configurations
   */
  async loadConfig(): Promise<Config> {
    if (this.mergedConfig) {
      return this.mergedConfig;
    }

    // Load global config
    this.globalConfig = await this.loadGlobalConfig();
    logger.debug(`Global config loaded: ${JSON.stringify(this.globalConfig)}`);

    // Load local config
    this.localConfig = await this.loadLocalConfig();
    logger.debug(`Local config loaded: ${JSON.stringify(this.localConfig)}`);

    // Merge configs (local overrides global)
    this.mergedConfig = this.mergeConfigs(this.globalConfig, this.localConfig);
    logger.debug(`Merged config: ${JSON.stringify(this.mergedConfig)}`);

    return this.mergedConfig;
  }

  /**
   * Get the current merged configuration
   */
  getConfig(): Config {
    if (!this.mergedConfig) {
      throw new ConfigError('Configuration not loaded. Call loadConfig() first.');
    }
    return this.mergedConfig;
  }

  /**
   * Save configuration to local file
   */
  async saveLocalConfig(config: Partial<Config>): Promise<void> {
    const configPath = join(this.cwd, `.${ConfigManager.CONFIG_NAME}`);

    try {
      // Validate the config
      const validatedConfig = ConfigSchema.parse(config);

      // Write to file
      writeFileSync(configPath, JSON.stringify(validatedConfig, null, 2));
      logger.debug(`Local config saved to: ${configPath}`);

      // Update cached config
      this.localConfig = validatedConfig;
      this.mergedConfig = this.mergeConfigs(this.globalConfig, this.localConfig);
    } catch (error) {
      throw new ConfigError(
        `Failed to save local config: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Save configuration to global file
   */
  async saveGlobalConfig(config: Partial<Config>): Promise<void> {
    const globalConfigPath = join(homedir(), ConfigManager.GLOBAL_CONFIG_FILE);

    try {
      // Ensure directory exists
      const dir = dirname(globalConfigPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Validate the config
      const validatedConfig = ConfigSchema.parse(config);

      // Write to file
      writeFileSync(globalConfigPath, JSON.stringify(validatedConfig, null, 2));
      logger.debug(`Global config saved to: ${globalConfigPath}`);

      // Update cached config
      this.globalConfig = validatedConfig;
      this.mergedConfig = this.mergeConfigs(this.globalConfig, this.localConfig);
    } catch (error) {
      throw new ConfigError(
        `Failed to save global config: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Initialize a new local configuration file with defaults
   */
  async initLocalConfig(config?: Partial<Config>): Promise<Config> {
    const defaultConfig: Config = {
      prefixType: 'none',
      worktreeDir: '../worktrees',
      postCommands: [],
      ...config,
    };

    await this.saveLocalConfig(defaultConfig);
    return defaultConfig;
  }

  /**
   * Check if local config exists
   */
  hasLocalConfig(): boolean {
    const configPath = join(this.cwd, `.${ConfigManager.CONFIG_NAME}`);
    return existsSync(configPath);
  }

  /**
   * Check if global config exists
   */
  hasGlobalConfig(): boolean {
    const globalConfigPath = join(homedir(), ConfigManager.GLOBAL_CONFIG_FILE);
    return existsSync(globalConfigPath);
  }

  private async loadLocalConfig(): Promise<Config | null> {
    try {
      const configPath = join(this.cwd, `.${ConfigManager.CONFIG_NAME}`);

      if (!existsSync(configPath)) {
        return null;
      }

      const explorer = cosmiconfigSync(ConfigManager.CONFIG_NAME);
      const result = explorer.load(configPath);

      if (!result) {
        return null;
      }

      return ConfigSchema.parse(result.config);
    } catch (error) {
      logger.debug(
        `Failed to load local config: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return null;
    }
  }

  private async loadGlobalConfig(): Promise<Config | null> {
    try {
      const globalConfigPath = join(homedir(), ConfigManager.GLOBAL_CONFIG_FILE);

      if (!existsSync(globalConfigPath)) {
        return null;
      }

      const explorer = cosmiconfigSync(ConfigManager.CONFIG_NAME);
      const result = explorer.load(globalConfigPath);

      if (!result) {
        return null;
      }

      return ConfigSchema.parse(result.config);
    } catch (error) {
      logger.debug(
        `Failed to load global config: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return null;
    }
  }

  private mergeConfigs(global: Config | null, local: Config | null): Config {
    const defaultConfig: Config = {
      prefixType: 'none',
      worktreeDir: '../worktrees',
      postCommands: [],
    };

    // Start with defaults, then apply global, then local
    let merged = { ...defaultConfig };

    if (global) {
      merged = { ...merged, ...global };
    }

    if (local) {
      merged = { ...merged, ...local };
      // For arrays, local completely replaces global
      if (local.postCommands) {
        merged.postCommands = local.postCommands;
      }
    }

    return merged;
  }
}
