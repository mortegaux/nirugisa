import request from 'supertest';
import { createApp } from '../../app';

const app = createApp();

describe('Session cookie auth (issue #41)', () => {
  // Regression coverage: login must set the signed session cookie, and
  // cookie-only requests (no Authorization header, e.g. direct browser
  // navigation) must authenticate. Previously the login response set no
  // cookie at all, so cookie-only requests got 401 "No session provided".
  //
  // This lives in its own file with a single lifecycle test on purpose:
  // the test DB is wiped after each test (see setup.ts), so each test would
  // need its own setup+login, and /api/auth/* is rate-limited to 10 req/min
  // per IP — four separate setup+login tests would blow that budget.
  // One lifecycle test stays at 8 auth-route requests.
  it('login sets the cookie, cookie-only requests authenticate, logout clears it', async () => {
    const setupRes = await request(app)
      .post('/api/setup/complete')
      .send({
        admin: { username: 'cookieuser', password: 'cookiepassword123' },
        smtp: { skipped: true },
        library: { mode: 'shared' },
        ai: { enabled: false },
      });
    expect(setupRes.status).toBe(201);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'cookieuser', password: 'cookiepassword123' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeTruthy();

    const setCookie = loginRes.headers['set-cookie'] as unknown as string[] | undefined;
    expect(setCookie).toBeDefined();
    const sessionCookie = (setCookie ?? []).find((c) => c.startsWith('nommable.session_token='));
    expect(sessionCookie).toBeDefined();
    // Only the `name=value` pair goes on the request Cookie header.
    const cookie = sessionCookie!.split(';')[0];
    expect(cookie.length).toBeGreaterThan('nommable.session_token='.length);
    const token = loginRes.body.token as string;

    // Shared middleware: /api/auth/me with cookie only, no Bearer.
    const meRes = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(meRes.status).toBe(200);
    expect(meRes.body.username).toBe('cookieuser');

    // The originally reported symptom: HA endpoint with cookie only.
    const haRes = await request(app).get('/api/home-assistant/expiring').set('Cookie', cookie);
    expect(haRes.status).toBe(200);
    expect(haRes.body).toHaveProperty('items');
    expect(haRes.body).toHaveProperty('count');

    // The cookie value is HMAC-signed by Better Auth; a bare token is not
    // a valid cookie and must not authenticate.
    const rawRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `nommable.session_token=${token}`);
    expect(rawRes.status).toBe(401);

    // No session at all.
    const noAuthRes = await request(app).get('/api/auth/me');
    expect(noAuthRes.status).toBe(401);

    // Logout expires the session cookie and the cookie stops working.
    const logoutRes = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(logoutRes.status).toBe(200);
    const logoutSetCookie = logoutRes.headers['set-cookie'] as unknown as string[] | undefined;
    const expired = (logoutSetCookie ?? []).find((c) => c.startsWith('nommable.session_token='));
    expect(expired).toBeDefined();
    expect(expired).toMatch(/Max-Age=0/);

    const afterRes = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(afterRes.status).toBe(401);
  });
});
