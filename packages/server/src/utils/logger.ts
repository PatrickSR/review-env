function timestamp(): string {
  return new Date().toISOString();
}

function format(level: string, module: string, message: string): string {
  return `[${timestamp()}] [${level}] [${module}] ${message}`;
}

export function createLogger(module: string) {
  return {
    info(message: string) {
      console.log(format("INFO", module, message));
    },
    warn(message: string) {
      console.warn(format("WARN", module, message));
    },
    error(message: string, err?: unknown) {
      const errMsg = err instanceof Error ? `: ${err.message}` : "";
      console.error(format("ERROR", module, `${message}${errMsg}`));
      if (err instanceof Error && err.stack) {
        console.error(err.stack);
      }
    },
  };
}
