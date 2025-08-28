import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigManager } from './manager.js';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ConfigManager', () => {
  let tempDir: string;
  let configManager: ConfigManager;

  beforeEach(() => {
    tempDir = join(tmpdir(), `kwt-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    configManager = new ConfigManager(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('loadConfig', () => {
    it('should load default config when no files exist', async () => {
      const config = await configManager.loadConfig();

      expect(config).toEqual({
        prefixType: 'none',
        worktreeDir: '../worktrees',
        postCommands: [],
      });
    });

    it('should load local config when it exists', async () => {
      const localConfig = {
        prefixType: 'detect' as const,
        worktreeDir: './custom-worktrees',
        postCommands: [
          {
            label: 'Test command',
            commands: ['echo "test"'],
          },
        ],
      };

      writeFileSync(join(tempDir, '.kwt'), JSON.stringify(localConfig));

      const config = await configManager.loadConfig();
      expect(config).toEqual(localConfig);
    });
  });

  describe('saveLocalConfig', () => {
    it('should save and load local config', async () => {
      const testConfig = {
        prefixType: 'manual' as const,
        manualPrefix: 'test-',
        worktreeDir: './test-worktrees',
        postCommands: [],
      };

      await configManager.saveLocalConfig(testConfig);
      const loadedConfig = await configManager.loadConfig();

      expect(loadedConfig).toEqual(testConfig);
    });
  });

  describe('hasLocalConfig', () => {
    it('should return false when no local config exists', () => {
      expect(configManager.hasLocalConfig()).toBe(false);
    });

    it('should return true when local config exists', async () => {
      await configManager.initLocalConfig();
      expect(configManager.hasLocalConfig()).toBe(true);
    });
  });
});
