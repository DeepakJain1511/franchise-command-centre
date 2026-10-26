/** Vercel serverless function: /api/gemini. Set OPENROUTER_API_KEY (and optionally OPENROUTER_MODEL) in the Vercel project. */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleGemini } from '../server/gemini.js';

async function readBody(req: IncomingMessage & { body?: unknown }): Promise<string> {
  if (typeof req.body === 'string') return req.body;
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  const out = await handleGemini(req.method ?? 'GET', req.method === 'POST' ? await readBody(req) : '', {
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
  });
  res.statusCode = out.status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(out.json));
}
