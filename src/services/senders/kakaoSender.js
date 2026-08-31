const trimToCodePoints = (value, limit) => Array.from(String(value)).slice(0, limit).join('');
const DEFAULT_LINK_URL = 'https://developers.kakao.com';

export function createKakaoSender(options = {}) {
  const accessToken = options.accessToken || process.env.KAKAO_ACCESS_TOKEN;
  const configuredLinkUrl = options.linkUrl || process.env.KAKAO_LINK_URL;
  const dryRun = Boolean(options.dryRun);
  const fetchImpl = options.fetchImpl || fetch;

  return {
    async sendMessage(message, sendOptions = {}) {
      const text = trimToCodePoints(message.replace(/<[^>]+>/g, ''), 200);
      const articleLinkUrl = sendOptions.linkUrl;
      const linkUrl = articleLinkUrl || configuredLinkUrl || DEFAULT_LINK_URL;
      const buttonTitle = sendOptions.buttonTitle || (articleLinkUrl ? '기사 원문 보기' : configuredLinkUrl ? '대시보드 보기' : '알림 안내');
      if (dryRun) {
        console.log(`[DRY RUN][KAKAO]\n${text}\n`);
        return { ok: true, dryRun: true };
      }
      if (!accessToken) throw new Error('KAKAO_ACCESS_TOKEN is required');
      const template = {
        object_type: 'text',
        text,
        link: { web_url: linkUrl, mobile_web_url: linkUrl },
        button_title: buttonTitle
      };
      const body = new URLSearchParams({ template_object: JSON.stringify(template) });
      const response = await fetchImpl('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/x-www-form-urlencoded;charset=utf-8'
        },
        body
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.result_code !== 0) {
        throw new Error(`Kakao send failed (${response.status}): ${payload.msg || payload.code || 'Unknown error'}`);
      }
      return { ok: true, ...payload };
    }
  };
}

export async function sendMessage(message, options) {
  return createKakaoSender(options).sendMessage(message);
}
