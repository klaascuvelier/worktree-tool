import { execa, type ExecaError, type Options } from 'execa';
import { logger } from './logger.js';
import { KWTError } from '../types/index.js';

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class ExecUtils {
  static async run(
    command: string,
    args: string[] = [],
    options: Options = {}
  ): Promise<ExecResult> {
    const fullCommand = `${command} ${args.join(' ')}`;
    logger.debug(`Executing: ${fullCommand}`);

    try {
      const result = await execa(command, args, {
        stdio: 'pipe',
        ...options,
      });

      logger.debug(`Command succeeded: ${fullCommand}`);
      return {
        stdout: String(result.stdout || ''),
        stderr: String(result.stderr || ''),
        exitCode: result.exitCode ?? 0,
      };
    } catch (error) {
      const execError = error as ExecaError;
      logger.debug(`Command failed: ${fullCommand} (exit code: ${execError.exitCode})`);

      return {
        stdout: String(execError.stdout || ''),
        stderr: String(execError.stderr || ''),
        exitCode: execError.exitCode ?? 1,
      };
    }
  }

  static async runOrThrow(
    command: string,
    args: string[] = [],
    options: Options = {}
  ): Promise<string> {
    const result = await this.run(command, args, options);

    if (result.exitCode !== 0) {
      throw new KWTError(
        `Command failed: ${command} ${args.join(' ')}\n${result.stderr}`,
        'EXEC_ERROR'
      );
    }

    return result.stdout;
  }

  static async exists(command: string): Promise<boolean> {
    try {
      await this.run('which', [command]);
      return true;
    } catch {
      return false;
    }
  }
}
