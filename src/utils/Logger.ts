/**
 * Development-aware logger. `debug`/`info` are silent in production builds;
 * warnings and errors are always reported so problems never fail silently.
 */
const isDev = import.meta.env.DEV;

export const Logger = {
  debug(scope: string, ...args: unknown[]): void {
    if (isDev) console.debug(`[${scope}]`, ...args);
  },
  info(scope: string, ...args: unknown[]): void {
    if (isDev) console.info(`[${scope}]`, ...args);
  },
  warn(scope: string, ...args: unknown[]): void {
    console.warn(`[${scope}]`, ...args);
  },
  error(scope: string, ...args: unknown[]): void {
    console.error(`[${scope}]`, ...args);
  },
};
