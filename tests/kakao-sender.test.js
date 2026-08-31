import { describe, expect, it, vi } from 'vitest';
import { createKakaoSender } from '../src/services/senders/kakaoSender.js';

describe('Kakao sender', () => {
  it('uses a safe fallback link when no deployed dashboard URL exists', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ result_code: 0 })
    }));
    const sender = createKakaoSender({ accessToken: 'test-token', fetchImpl });

    await sender.sendMessage('Metals alert');

    const [, request] = fetchImpl.mock.calls[0];
    const template = JSON.parse(request.body.get('template_object'));
    expect(template.link.web_url).toBe('https://developers.kakao.com');
    expect(template.button_title).toBe('알림 안내');
  });

  it('uses the article URL and readable button title for an article alert', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ result_code: 0 })
    }));
    const sender = createKakaoSender({ accessToken: 'test-token', fetchImpl });

    await sender.sendMessage('Readable alert', { linkUrl: 'https://news.google.com/article', buttonTitle: '기사 원문 보기' });

    const [, request] = fetchImpl.mock.calls[0];
    const template = JSON.parse(request.body.get('template_object'));
    expect(template.link.web_url).toBe('https://news.google.com/article');
    expect(template.button_title).toBe('기사 원문 보기');
  });

  it('obtains an access token with refresh credentials when no access token exists', async () => {
    const fetchImpl = vi.fn(async (url) => url.includes('/oauth/token') ? ({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'refreshed-access', expires_in: 21_600, refresh_token: 'rotated-refresh' })
    }) : ({
      ok: true,
      status: 200,
      json: async () => ({ result_code: 0 })
    }));
    const sender = createKakaoSender({
      restApiKey: 'rest-key', clientSecret: 'client-secret', refreshToken: 'refresh-token',
      fetchImpl, persistTokenState: false
    });

    await sender.sendMessage('Refresh test');

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [, tokenRequest] = fetchImpl.mock.calls[0];
    expect(tokenRequest.body.get('grant_type')).toBe('refresh_token');
    expect(tokenRequest.body.get('client_id')).toBe('rest-key');
    const [, messageRequest] = fetchImpl.mock.calls[1];
    expect(messageRequest.headers.authorization).toBe('Bearer refreshed-access');
  });

  it('refreshes and retries once when Kakao rejects an expired access token', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ code: -401 }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: 'new-access', expires_in: 21_600 }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ result_code: 0 }) });
    const sender = createKakaoSender({
      accessToken: 'expired-access', restApiKey: 'rest-key', clientSecret: 'client-secret', refreshToken: 'refresh-token',
      fetchImpl, persistTokenState: false
    });

    await sender.sendMessage('Retry test');

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl.mock.calls[1][0]).toBe('https://kauth.kakao.com/oauth/token');
    expect(fetchImpl.mock.calls[2][1].headers.authorization).toBe('Bearer new-access');
  });
});
