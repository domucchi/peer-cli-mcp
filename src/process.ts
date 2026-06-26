import { spawn } from "node:child_process";

export type ProcessResult = {
  command: string;
  args: string[];
  cwd: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

export type ProcessOptions = {
  cwd: string;
  input?: string;
  timeoutMs?: number;
  allowExitCodes?: number[];
  env?: NodeJS.ProcessEnv;
  rejectOnFailure?: boolean;
};

export type ProcessRunner = (command: string, args: string[], options: ProcessOptions) => Promise<ProcessResult>;

export async function runProcess(command: string, args: string[], options: ProcessOptions): Promise<ProcessResult> {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const allowExitCodes = new Set(options.allowExitCodes ?? [0]);
  const rejectOnFailure = options.rejectOnFailure ?? true;

  return await new Promise<ProcessResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
      }, 2_000).unref();
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (exitCode, signal) => {
      clearTimeout(timeout);
      const result = {
        command,
        args,
        cwd: options.cwd,
        exitCode,
        signal,
        stdout,
        stderr,
        timedOut
      };
      if (rejectOnFailure && (timedOut || exitCode === null || !allowExitCodes.has(exitCode))) {
        reject(new ProcessError(result));
        return;
      }
      resolve(result);
    });

    if (options.input !== undefined) {
      child.stdin.end(options.input);
    } else {
      child.stdin.end();
    }
  });
}

export class ProcessError extends Error {
  readonly result: ProcessResult;

  constructor(result: ProcessResult) {
    const rendered = `${result.command} ${result.args.join(" ")} exited with ${result.exitCode ?? result.signal}`;
    super(result.timedOut ? `${rendered} after timeout` : rendered);
    this.name = "ProcessError";
    this.result = result;
  }
}
