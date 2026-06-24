#!/usr/bin/env node
/**
 * Verify AI service health and optional dashboard endpoint.
 * Usage: npm run ai:verify
 */
import { loadProjectEnv } from './load-env.mjs';

loadProjectEnv(import.meta.url);

const base = process.env.VITE_AI_API_URL || process.env.AI_API_URL || 'http://localhost:8000';

async function main() {
  console.log(`AI Health Check → ${base}/health\n`);
  try {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(8000) });
    const body = await res.json();
    if (!res.ok) {
      console.error('✗ Health check failed', res.status, body);
      process.exitCode = 1;
      return;
    }
    console.log('✓ Health OK', JSON.stringify(body));

    const dash = await fetch(
      `${base}/api/intelligence/farmer/dashboard?user_id=00000000-0000-0000-0000-000000000001`,
      { signal: AbortSignal.timeout(15000) },
    );
    if (dash.ok) {
      const data = await dash.json();
      console.log('✓ Farmer dashboard endpoint', `recommendations=${data.recommendations?.length ?? 0}`);
    } else {
      console.warn('⚠ Dashboard endpoint returned', dash.status);
    }
  } catch (e) {
    console.error('✗ AI service unreachable:', e.message);
    console.error('\nLocal: cd ai-service && pip install -r requirements.txt && uvicorn app.main:app --port 8000');
    console.error('Production: deploy via ai-service/render.yaml and set VITE_AI_API_URL');
    process.exitCode = 1;
  }
}

main();
