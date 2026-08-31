import { config as loadEnvironment } from 'dotenv';
import { paths } from './paths.js';
import { readJson } from './jsonStore.js';

loadEnvironment({ quiet: true });

const booleanFromEnv = (value, fallback) => value === undefined ? fallback : value.toLowerCase() === 'true';

const RULE_FILES = {
  COPPER: 'copper.json',
  ALUMINUM: 'aluminum.json',
  TIN: 'tin.json',
  FERRO_ALLOY: 'ferro-alloy.json',
  MOLYBDENUM: 'molybdenum.json'
};

export async function loadConfig() {
  const [commodities, sourceConfig, rawSettings, commonRules] = await Promise.all([
    readJson(paths.commodities),
    readJson(paths.sources),
    readJson(paths.settings),
    readJson(paths.commonRules)
  ]);
  const commodityRuleEntries = await Promise.all(Object.entries(RULE_FILES).map(async ([commodity, fileName]) => [
    commodity,
    await readJson(`${paths.rulesDirectory}/${fileName}`, {})
  ]));
  return {
    commodities,
    rules: { common: commonRules, commodities: Object.fromEntries(commodityRuleEntries) },
    sources: sourceConfig.sources.filter((source) => source.enabled),
    settings: {
      ...rawSettings,
      enableTelegram: booleanFromEnv(process.env.ENABLE_TELEGRAM, rawSettings.enableTelegram),
      enableKakao: booleanFromEnv(process.env.ENABLE_KAKAO, rawSettings.enableKakao)
    }
  };
}
