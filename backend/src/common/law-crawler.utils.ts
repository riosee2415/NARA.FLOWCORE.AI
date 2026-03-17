/**
 * 법률신문 크롤러(법원 뉴스·판결기사) 공통 유틸
 * - 제목 정규화, URL에서 기사 ID 추출, 날짜 파싱
 */

/**
 * 제목 맨 앞의 [속보], [단독] 등 대괄호 태그 제거
 */
export function cleanTitle(raw: string): string {
  if (!raw) return '';
  let title = raw;
  for (;;) {
    const next = title.replace(/^\s*\[[^\]]*\]\s*/u, '');
    if (next === title) break;
    title = next;
  }
  return title.trim();
}

/**
 * 기사 URL에서 idxno 쿼리 값 추출
 * 예: .../articleView.html?idxno=217575 → "217575"
 */
export function extractArticleId(url: string): string | null {
  try {
    const u = new URL(url);
    const idx = u.searchParams.get('idxno');
    return idx || null;
  } catch {
    return null;
  }
}

/**
 * 날짜 문자열을 Date로 변환 (YYYY-MM-DD 등)
 * 잘못된 형식이면 null
 */
export function parsePublishedDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * 법률방송뉴스 본문/요약에서 "[법률방송뉴스]" 문자열 제거
 */
export function stripLtnPrefix(text: string): string {
  if (!text) return '';
  return text.replace(/\[법률방송뉴스\]/g, '').trim();
}
