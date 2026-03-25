import type { IncomingMessage } from "node:http";

/** Objeto com `.status().json()` como em Express/Next (Fastify usa adaptador). */
export interface ImportPptxResponse {
  status(code: number): ImportPptxResponse;
  json(body: unknown): void;
}

export function runImportPptxEngine(
  req: IncomingMessage,
  res: ImportPptxResponse,
): Promise<void>;
