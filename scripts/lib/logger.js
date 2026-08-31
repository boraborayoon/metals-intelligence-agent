const log = (level, message, details) => {
  const suffix = details === undefined ? '' : ` ${typeof details === 'string' ? details : JSON.stringify(details)}`;
  console.log(`[${level}] ${message}${suffix}`);
};

export const logger = {
  info: (message, details) => log('INFO', message, details),
  warn: (message, details) => log('WARN', message, details),
  error: (message, details) => log('ERROR', message, details)
};
