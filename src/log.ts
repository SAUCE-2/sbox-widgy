const PREFIX = "[steam-value]";

export function steamValueLog(message: string, data?: Record<string, unknown>): void {
  if (data === undefined) {
    console.log(PREFIX, message);
  } else {
    console.log(PREFIX, message, data);
  }
}

export function nowMs(): number {
  return Date.now();
}

export function elapsed(start: number): number {
  return Date.now() - start;
}
