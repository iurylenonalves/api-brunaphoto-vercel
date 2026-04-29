import request from 'supertest';
import app from './app';

describe('app health endpoints', () => {
  it('returns 200 from /api/health', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok' });
  });
});