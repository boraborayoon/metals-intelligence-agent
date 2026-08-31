import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const trimToCodePoints = (value, limit) => Array.from(String(value)).slice(0, limit).join('');
const DEFAULT_LINK_URL = 'https://developers.kakao.com';
const TOKEN_URL = 'https://kauth.kakao.com/oauth/token';
const MESSAGE_URL = 'https://kapi.kakao.com/v2/api/talk/memo/default/send';
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60_000;

const tokenFingerprint = (value) => createHash('sha256').update(String(value)).digest('hex');
const defaultStatePath = () => process.env.KAKAO_TOKEN_STATE_FILE || path.resolve(process.cwd(), '.kakao-token-state.json');

export function hasKakaoCredentials(environment = process.env) {
  return Boolean(
    environment.KAKAO_ACCESS_TOKEN
    || (environment.KAKAO_REST_API_KEY && environment.KAKAO_CLIENT_SECRET && environment.KAKAO_REFRESH_TOKEN)
  );
}

export function createKakaoSender(options = {}) {
  let accessToken = options.accessToken || process.env.KAKAO_ACCESS_TOKEN;
  const restApiKey = options.restApiKey || process.env.KAKAO_REST_API_KEY;
  const clientSecret = options.clientSecret || process.env.KAKAO_CLIENT_SECRET;
  const environmentRefreshToken = options.refreshToken || process.env.KAKAO_REFRESH_TOKEN;
  let refreshToken = environmentRefreshToken;
  let accessTokenExpiresAt = 0;
  const configuredLinkUrl = options.linkUrl || process.env.KAKAO_LINK_URL;
  const dryRun = Boolean(options.dryRun);
  const fetchImpl = options.fetchImpl || fetch;
  const persistTokenState = options.persistTokenState !== false;
  const tokenStatePath = options.tokenStatePath || defaultStatePath();
  const hasRefreshCredentials = Boolean(restApiKey && clientSecret && environmentRefreshToken);
  const seedRefreshTokenFingerprint = environmentRefreshToken ? tokenFingerprint(environmentRefreshToken) : null;
  let stateLoaded = false;
  let refreshPromise;

  const loadTokenState = async () => {
    if (stateLoaded || !persistTokenState || !hasRefreshCredentials) return;
    stateLoaded = true;
    try {
      const stored = JSON.parse(await readFile(tokenStatePath, 'utf8'));
      if (stored.seedRefreshTokenFingerprint !== seedRefreshTokenFingerprint) return;
      if (typeof stored.accessToken === 'string' && stored.accessToken) accessToken = stored.accessToken;
      if (typeof stored.refreshToken === 'string' && stored.refreshToken) refreshToken = stored.refreshToken;
      if (Number.isFinite(stored.accessTokenExpiresAt)) accessTokenExpiresAt = stored.accessTokenExpiresAt;
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error(`Kakao token state could not be read: ${error.message}`);
    }
  };

  const saveTokenState = async () => {
    if (!persistTokenState || !hasRefreshCredentials) return;
    await mkdir(path.dirname(tokenStatePath), { recursive: true });
    await writeFile(tokenStatePath, `${JSON.stringify({
      version: 1,
      seedRefreshTokenFingerprint,
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
      updatedAt: new Date().toISOString()
    }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  };

  const refreshAccessToken = async () => {
    if (!hasRefreshCredentials) throw new Error('Kakao token refresh requires KAKAO_REST_API_KEY, KAKAO_CLIENT_SECRET, and KAKAO_REFRESH_TOKEN');
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: restApiKey,
      client_secret: clientSecret,
      refresh_token: refreshToken
    });
    const response = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) {
      throw new Error(`Kakao token refresh failed (${response.status}): ${payload.error_description || payload.error || 'Unknown error'}`);
    }
    accessToken = payload.access_token;
    if (payload.refresh_token) refreshToken = payload.refresh_token;
    accessTokenExpiresAt = Date.now() + Math.max(0, Number(payload.expires_in) || 0) * 1000;
    process.env.KAKAO_ACCESS_TOKEN = accessToken;
    await saveTokenState();
    return accessToken;
  };

  const getAccessToken = async (forceRefresh = false) => {
    await loadTokenState();
    const hasUsableStoredToken = accessToken && (!accessTokenExpiresAt || accessTokenExpiresAt - Date.now() > TOKEN_EXPIRY_BUFFER_MS);
    if (!forceRefresh && hasUsableStoredToken) return accessToken;
    if (!hasRefreshCredentials) {
      if (accessToken) return accessToken;
      throw new Error('KAKAO_ACCESS_TOKEN is required, or configure Kakao refresh credentials');
    }
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => { refreshPromise = undefined; });
    }
    return refreshPromise;
  };

  const postMessage = async (token, template) => {
    const body = new URLSearchParams({ template_object: JSON.stringify(template) });
    const response = await fetchImpl(MESSAGE_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/x-www-form-urlencoded;charset=utf-8'
      },
      body
    });
    return { response, payload: await response.json().catch(() => ({})) };
  };

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
      const template = {
        object_type: 'text',
        text,
        link: { web_url: linkUrl, mobile_web_url: linkUrl },
        button_title: buttonTitle
      };
      let token = await getAccessToken();
      let { response, payload } = await postMessage(token, template);
      if (response.status === 401 && hasRefreshCredentials) {
        token = await getAccessToken(true);
        ({ response, payload } = await postMessage(token, template));
      }
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
