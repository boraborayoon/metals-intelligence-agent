import { describe, expect, it } from 'vitest';
import { formatKakaoArticle } from '../scripts/formatKakao.js';

describe('Kakao article formatting', () => {
  it('keeps the alert readable and within the Kakao 200-character limit', () => {
    const message = formatKakaoArticle({
      commodity: 'COPPER',
      importance: 'HIGH',
      titleKo: 'Weekly Recap: DRC flooding may cut copper output and HK$52.20 average target',
      marketImpact: 'Bullish',
      procurementImpact: 'NEGATIVE',
      primaryCategory: 'Operational Accident',
      regions: ['DRC'],
      source: 'TradingView',
      summaryKo: 'Weekly Recap: DRC flooding may cut copper output and HK$52.20 average target TradingView',
      impactReasonKo: '기사에 가격 방향을 판단할 충분하고 명확한 사건 근거가 없어 Unclear로 처리했습니다.'
    });

    expect(Array.from(message).length).toBeLessThanOrEqual(200);
    expect(message).toContain('🔴 구리 · 중요');
    expect(message).toContain('📊 시장 강세 ↑ | 구매 불리');
    expect(message).toContain('🏷 운영 사고 · DRC');
    expect(message).toContain('📰 TradingView');
    expect(message).not.toContain('충분하고 명확한');
    expect(message.split('\n')).toHaveLength(6);
    expect(message).not.toContain('<b>');
  });

  it('shows a useful summary when it adds information beyond the title', () => {
    const message = formatKakaoArticle({
      commodity: 'ALUMINUM', importance: 'MEDIUM', titleKo: 'Aluminium output update',
      marketImpact: 'Neutral', procurementImpact: 'NEUTRAL', primaryCategory: 'Supply', regions: ['EU'],
      source: 'Example News', summaryKo: 'European smelters reported a larger-than-expected monthly production increase.'
    });

    expect(message).toContain('📝 European smelters reported');
    expect(message).not.toContain('📰 Example News');
  });
});
