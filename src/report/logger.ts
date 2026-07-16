import path from "node:path";
import pino from "pino";

/** Structured logs: pretty-printed to stdout for the live demo, plain JSON lines persisted to crawl.log. */
export function createLogger(outputDir: string) {
  const logFile = path.join(outputDir, "crawl.log");
  const transport = pino.transport({
    targets: [
      { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss" }, level: "info" },
      { target: "pino/file", options: { destination: logFile, mkdir: true }, level: "debug" },
    ],
  });
  return pino({ level: "debug" }, transport);
}
