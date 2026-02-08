import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../helpers/app.js';

describe('GET /api/v1/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });

  it('has valid ISO timestamp', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(() => new Date(res.body.timestamp).toISOString()).not.toThrow();
    const parsedDate = new Date(res.body.timestamp);
    expect(parsedDate.toISOString()).toBe(res.body.timestamp);
  });
});
