declare module "./scripts/directory-config.mjs" {
  export const directoryConfigPaths: Readonly<{
    config: string;
    data: string;
    target: string;
  }>;

  export function syncDirectoryConfig(options?: { log?: boolean }): Promise<boolean>;

  export function watchDirectoryConfig(
    callback: () => Promise<void> | void
  ): Promise<{ close: () => void }>;
}
