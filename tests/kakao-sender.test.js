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
});
