export function createTelegramSender(options = {}) {
  const token = options.token || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = options.chatId || process.env.TELEGRAM_CHAT_ID;
  const dryRun = Boolean(options.dryRun);
  const fetchImpl = options.fetchImpl || fetch;

  return {
    async sendMessage(message) {
      if (dryRun) {
        console.log(`[DRY RUN][TELEGRAM]\n${message}\n`);
        return { ok: true, dryRun: true };
      }
      if (!token || !chatId) throw new Error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required');
      const response = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true }
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(`Telegram send failed (${response.status}): ${payload.description || 'Unknown error'}`);
      }
      return payload;
    }
  };
}

export async function sendMessage(message, options) {
  return createTelegramSender(options).sendMessage(message);
}
