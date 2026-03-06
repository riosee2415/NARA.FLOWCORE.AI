/**
 * 키워드/품명 띄어쓰기 정규화.
 * 조달청 API·DB와 우리 키워드 간 공백 차이에 대응.
 */

/** 연속 공백을 한 칸으로, 앞뒤 trim (API 요청·저장용) */
export function normalizeKeyword(keyword: string): string {
  if (typeof keyword !== 'string') return '';
  return keyword.replace(/\s+/g, ' ').trim();
}

/** 공백 제거한 문자열 (포함 여부 비교용: "차세대 송무" vs "차세대  송무" 매칭) */
export function normalizeForMatch(text: string): string {
  if (typeof text !== 'string') return '';
  return text.replace(/\s+/g, '');
}

/** 품명이 키워드를 포함하는지 띄어쓰기 무관하게 판단 */
export function titleMatchesKeyword(title: string, keyword: string): boolean {
  const t = normalizeForMatch(title);
  const k = normalizeForMatch(normalizeKeyword(keyword));
  if (!k) return false;
  return t.includes(k);
}
