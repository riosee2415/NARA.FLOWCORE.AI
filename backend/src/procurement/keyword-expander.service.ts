import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * OpenAI를 사용해 조달 검색 키워드를 확장.
 * 원본 + 유사·축약·동의어 등 다양한 검색어로 넓게 탐색할 수 있게 함.
 */
@Injectable()
export class KeywordExpanderService {
  private readonly logger = new Logger(KeywordExpanderService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * 키워드 1개를 받아, 조달청 사전규격 검색에 쓸 수 있는 검색어 목록을 반환.
   * 원본 + AI가 생성한 변형(축약, 핵심어, 유사 표현)으로 최대 6개.
   */
  async expandForSearch(keyword: string): Promise<string[]> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey?.trim()) {
      return [keyword];
    }

    const normalized = keyword.replace(/\s+/g, ' ').trim();
    if (!normalized) return [keyword];

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `당신은 한국 공공 조달(나라장터) 검색에 맞는 키워드 변형을 만드는 도우미입니다.
주어진 사업명/키워드에 대해, 실제 공고에 나올 수 있는 다양한 검색어를 생성하세요.
- 원문 그대로 1개 포함
- 띄어쓰기·표기 차이 (예: "시스템 구축" vs "시스템구축")
- 축약어·핵심어만 (예: "CMS", "AI", "통합플랫폼")
- 유사 표현 (예: "유지관리" ↔ "운영")
- 숫자/연도 제거한 버전
중복 없이, JSON 배열 하나만 답하세요. 예: ["키워드1", "키워드2", ...]
최소 2개, 최대 6개. 반드시 유효한 JSON 배열만 출력.`,
            },
            {
              role: 'user',
              content: `다음 조달 사업명에 대한 검색용 키워드 변형을 만들어주세요:\n\n"${normalized}"`,
            },
          ],
          max_tokens: 300,
          temperature: 0.3,
        }),
      });

      if (!res.ok) {
        this.logger.warn(`OpenAI 키워드 확장 실패: HTTP ${res.status}`);
        return [normalized];
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data?.choices?.[0]?.message?.content?.trim();
      if (!content) return [normalized];

      const parsed = this.parseJsonArray(content);
      if (parsed.length === 0) return [normalized];

      const unique = Array.from(
        new Set(
          [normalized, ...parsed]
            .map((s) => s.replace(/\s+/g, ' ').trim())
            .filter(Boolean),
        ),
      );
      return unique.slice(0, 8);
    } catch (err) {
      this.logger.warn(
        `OpenAI 키워드 확장 오류: ${err instanceof Error ? err.message : err}`,
      );
      return [normalized];
    }
  }

  private parseJsonArray(raw: string): string[] {
    try {
      const trimmed = raw.replace(/^```\w*\n?|\n?```$/g, '').trim();
      const arr = JSON.parse(trimmed) as unknown;
      if (!Array.isArray(arr)) return [];
      return arr
        .filter((x): x is string => typeof x === 'string')
        .map((s) => String(s).trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }
}
