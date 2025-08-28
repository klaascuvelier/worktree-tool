import { describe, it, expect } from 'vitest';
import { GitRemoteManager } from './remotes.js';

describe('GitRemoteManager', () => {
  describe('extractRepoName', () => {
    const manager = new GitRemoteManager();

    it('should extract repo name from SSH URLs', () => {
      expect(manager.extractRepoName('git@github.com:user/repo.git')).toBe('repo');
      expect(manager.extractRepoName('git@gitlab.com:user/my-project.git')).toBe('my-project');
      expect(manager.extractRepoName('git@github.com:org/awesome-tool.git')).toBe('awesome-tool');
    });

    it('should extract repo name from HTTPS URLs', () => {
      expect(manager.extractRepoName('https://github.com/user/repo.git')).toBe('repo');
      expect(manager.extractRepoName('https://gitlab.com/user/my-project.git')).toBe('my-project');
      expect(manager.extractRepoName('https://github.com/org/awesome-tool')).toBe('awesome-tool');
    });

    it('should handle URLs without .git extension', () => {
      expect(manager.extractRepoName('git@github.com:user/repo')).toBe('repo');
      expect(manager.extractRepoName('https://github.com/user/repo')).toBe('repo');
    });

    it('should throw error for invalid URLs', () => {
      expect(() => manager.extractRepoName('invalid-url')).toThrow();
      expect(() => manager.extractRepoName('ftp://example.com/repo')).toThrow();
    });
  });
});
