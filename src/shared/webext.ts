type ChromeApi = typeof chrome;

// Firefox exposes the callback-compatible `chrome` namespace as well as its
// Promise-only `browser` namespace. Prefer the former so one adapter works in
// both target browsers without shipping a runtime polyfill.
export const ext: ChromeApi = (globalThis as typeof globalThis & { chrome?: ChromeApi; browser?: ChromeApi }).chrome
  ?? (globalThis as typeof globalThis & { browser?: ChromeApi }).browser!;

function lastErrorMessage(): string | undefined {
  return ext.runtime.lastError?.message;
}

export function storageGet<T>(keys: string[] | string | null): Promise<T> {
  return new Promise((resolve, reject) => {
    ext.storage.local.get(keys, (items) => {
      const error = lastErrorMessage();
      if (error) reject(new Error(error));
      else resolve(items as T);
    });
  });
}

export function storageSet(items: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    ext.storage.local.set(items, () => {
      const error = lastErrorMessage();
      if (error) reject(new Error(error));
      else resolve();
    });
  });
}

export function sendRuntimeMessage<T>(message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    ext.runtime.sendMessage(message, (response) => {
      const error = lastErrorMessage();
      if (error) reject(new Error(error));
      else resolve(response as T);
    });
  });
}

export function sendTabMessage<T>(tabId: number, message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    ext.tabs.sendMessage(tabId, message, (response) => {
      const error = lastErrorMessage();
      if (error) reject(new Error(error));
      else resolve(response as T);
    });
  });
}

export function queryActiveTab(): Promise<chrome.tabs.Tab> {
  return new Promise((resolve, reject) => {
    ext.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const error = lastErrorMessage();
      const tab = tabs[0];
      if (error) reject(new Error(error));
      else if (!tab) reject(new Error("No active tab was found."));
      else resolve(tab);
    });
  });
}

export function injectContent(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    ext.scripting.executeScript({ target: { tabId }, files: ["content.js"] }, () => {
      const error = lastErrorMessage();
      if (error) reject(new Error(error));
      else resolve();
    });
  });
}
