import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DAILY_TASKS } from '../daily/daily.constants';
import type { DailyTask } from '../daily/daily-task.interface';
import {
  PROCUREMENT_PRE_SPEC_API_BASE,
  PROCUREMENT_BID_API_BASES,
} from './procurement.constants';
import { PRE_SPEC_KEYWORDS } from '../config/pre-spec-keywords.config';
import { normalizeKeyword, titleMatchesKeyword } from './keyword-normalizer';
import { KeywordExpanderService } from './keyword-expander.service';

const LOG_PRE = '*사전규격*';
const LOG_BID = '*본공고*';

/** 용역 전용: 나라장터 검색조건에 의한 사전규격 용역 목록 조회 (no 15) */
const SERVC_PPSSRCH = {
  name: '나라장터 검색조건에 의한 사전규격 용역 목록 조회',
  path: '/getPublicPrcureThngInfoServcPPSSrch',
} as const;

/** 본공고(입찰공고) 용역 목록 조회 - 등록일시 기준 (PPSSrch는 500 다발로 목록 API 사용 후 클라이언트 키워드 필터) */
const BID_SERVC_LIST = {
  name: '입찰공고목록 정보에 대한 용역조회',
  path: '/getBidPblancListInfoServc',
} as const;

/**
 * 공공데이터 인증키가 이미 URL 인코딩된 상태로 발급되는 경우가 있어,
 * 그대로 set하면 이중 인코딩 → 500 Unexpected errors.
 * 한 번 디코딩 후 쿼리에 넣어 단일 인코딩으로 전달.
 */
function bidServiceKeyForQuery(apiKey: string): string {
  try {
    return decodeURIComponent(apiKey.trim());
  } catch {
    return apiKey.trim();
  }
}

/** 검색 기간(일), 페이지당 건수, 최대 페이지 */
const SEARCH_DAYS = 30;
const ROWS_PER_PAGE = 100;
const MAX_PAGES = 3;

/** 공공데이터 429 방지: 요청 간 대기(ms) */
const REQUEST_DELAY_MS = 300;
/** 본공고 API 요청 타임아웃(ms) - 무한 대기 방지 */
const BID_FETCH_TIMEOUT_MS = 30_000;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 타임아웃 적용 fetch (본공고 API 무응답 시 다음 단계로 진행) */
async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
): Promise<Response> {
  const ac = new AbortController();
  const timeoutId = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ac.signal });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** 공공데이터 응답 타입 (한 건일 때 item, 여러 건일 때 items 사용하는 API 대응) */
interface DataGoKrResponse {
  response?: {
    body?: {
      items?: Array<Record<string, unknown>> | Record<string, unknown>;
      item?: Record<string, unknown>;
      totalCount?: number;
      numOfRows?: number;
      pageNo?: number;
    };
    header?: { resultCode: string; resultMsg: string };
  };
}

/** response.body에서 목록 배열 추출 (item 단수/items 복수 모두 처리) */
function extractItemsFromBody(
  body:
    | {
        items?: unknown;
        item?: unknown;
      }
    | null
    | undefined,
): Array<Record<string, unknown>> {
  if (!body) return [];
  const raw = body.items ?? body.item;
  if (raw == null) return [];
  return Array.isArray(raw) ? raw : [raw as Record<string, unknown>];
}

@Injectable()
export class ProcurementPreSpecService implements DailyTask {
  readonly name = 'ProcurementPreSpec';

  private readonly logger = new Logger(ProcurementPreSpecService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly keywordExpander: KeywordExpanderService,
  ) {}

  async run(): Promise<void> {
    const runMode =
      this.config.get<string>('PROCUREMENT_RUN')?.toLowerCase() || 'both';
    const runPreSpec =
      (runMode === 'both' || runMode === 'pre_spec') &&
      !!this.config.get<string>('DATA_GO_KR_SERVICE_KEY')?.trim();
    const runBid =
      (runMode === 'both' || runMode === 'bid') &&
      !!(
        this.config.get<string>('DATA_GO_KR_BID_SERVICE_KEY') ||
        this.config.get<string>('DATA_GO_KR_SERVICE_KEY')
      )?.trim();

    const apiKey = this.config.get<string>('DATA_GO_KR_SERVICE_KEY');
    const bidApiKey =
      this.config.get<string>('DATA_GO_KR_BID_SERVICE_KEY') || apiKey;
    const hasPreSpec = !!apiKey?.trim();
    const hasBid = !!bidApiKey?.trim();

    if (!hasPreSpec && !hasBid) {
      this.logger.warn(
        `${LOG_PRE} DATA_GO_KR_SERVICE_KEY / DATA_GO_KR_BID_SERVICE_KEY 둘 다 미설정, 조회 스킵`,
      );
      return;
    }
    if (runMode !== 'both') {
      this.logger.log(
        `PROCUREMENT_RUN=${runMode} → ${runPreSpec ? '사전규격' : ''} ${runBid ? '본공고' : ''} 만 실행`,
      );
    }

    const keywords = PRE_SPEC_KEYWORDS.map((k) => normalizeKeyword(k)).filter(
      (k) => k.length > 0,
    );
    if (keywords.length === 0) {
      this.logger.warn(
        `${LOG_PRE} 조회 키워드 없음. config/pre-spec-keywords.config.ts 에 키워드를 추가하세요.`,
      );
      return;
    }

    const useAiExpand =
      this.config.get<string>('PRE_SPEC_USE_AI_EXPAND') !== 'false';

    // 키워드별 검색어 미리 확장 (두 단계에서 공통 사용)
    const keywordSearchTerms = new Map<string, string[]>();
    for (const keyword of keywords) {
      const searchTerms = useAiExpand
        ? await this.keywordExpander.expandForSearch(keyword)
        : [keyword];
      keywordSearchTerms.set(keyword, searchTerms);
      if (searchTerms.length > 1) {
        this.logger.log(
          `[${keyword}] AI 확장 검색어 ${searchTerms.length}개: ${searchTerms.slice(0, 4).join(', ')}${searchTerms.length > 4 ? '...' : ''}`,
        );
      }
    }

    // 1단계: 사전규격 (모든 키워드 조회 + 데이터 정리) 완료 후
    if (runPreSpec && hasPreSpec && apiKey) {
      this.logger.log(`${LOG_PRE} 사전규격 단계 시작`);
      for (const keyword of keywords) {
        const searchTerms = keywordSearchTerms.get(keyword) ?? [keyword];
        const preSpecItems = await this.fetchPreSpec(
          apiKey,
          keyword,
          searchTerms,
        );
        if (preSpecItems.length > 0) {
          this.logger.log(
            `${LOG_PRE} [${keyword}] 사전규격(용역) 조회: 키워드 매칭 ${preSpecItems.length}건`,
          );
          console.log(
            `\n${LOG_PRE} [사전규격 조회 결과] 키워드: "${keyword}" (${preSpecItems.length}건)\n`,
          );
          console.log(JSON.stringify(preSpecItems, null, 2));
        }
        const preSpecCleaned = this.cleanPreSpecData(preSpecItems);
        if (preSpecCleaned.length > 0) {
          this.logger.log(
            `${LOG_PRE} [${keyword}] 데이터 정리 완료: ${preSpecCleaned.length}건`,
          );
        }
      }
      this.logger.log(`${LOG_PRE} 사전규격 단계 완료`);
    }

    // 2단계: 본공고 (사전규격 단계 완료 후 순차 실행)
    if (runBid && hasBid && bidApiKey) {
      this.logger.log(`${LOG_BID} 본공고 단계 시작`);
      for (const keyword of keywords) {
        this.logger.log(`${LOG_BID} [${keyword}] 조회 시작`);
        const searchTerms = keywordSearchTerms.get(keyword) ?? [keyword];
        const bidItems = await this.fetchBidAnnouncements(
          bidApiKey,
          keyword,
          searchTerms,
        );
        if (bidItems.length > 0) {
          this.logger.log(
            `${LOG_BID} [${keyword}] 조회 완료: 있음 ${bidItems.length}건`,
          );
          console.log(
            `\n${LOG_BID} [본공고 조회 결과] 키워드: "${keyword}" (${bidItems.length}건)\n`,
          );
          console.log(JSON.stringify(bidItems, null, 2));
        } else {
          this.logger.log(`${LOG_BID} [${keyword}] 조회 완료: 없음`);
        }
      }
      this.logger.log(`${LOG_BID} 본공고 단계 완료`);

      // 키워드 없이 최근 N건만 조회하여 출력
      const latestCount = 10;
      this.logger.log(
        `${LOG_BID} 최근 ${latestCount}건 조회(키워드 없음) 시작`,
      );
      const latestBids = await this.fetchBidAnnouncementsLatest(
        bidApiKey,
        latestCount,
      );
      if (latestBids.length > 0) {
        this.logger.log(
          `${LOG_BID} 최근 ${latestCount}건 조회 완료: ${latestBids.length}건`,
        );
        console.log(`\n${LOG_BID} [최근 본공고 ${latestCount}건]\n`);
        console.log(JSON.stringify(latestBids, null, 2));
      } else {
        this.logger.log(`${LOG_BID} 최근 ${latestCount}건 조회 완료: 없음`);
      }
    }
  }

  /**
   * 사전규격 최근 N건 조회 (최근 1달 기준, 키워드 없음)
   * - "심플 테스트" 용도로 사용 (콘솔 출력/수동 검증)
   */
  async fetchPreSpecLatest(
    limit = 10,
  ): Promise<Array<Record<string, unknown>>> {
    const apiKey = this.config.get<string>('DATA_GO_KR_SERVICE_KEY');
    if (!apiKey?.trim()) {
      this.logger.warn(
        `${LOG_PRE} 최근 ${limit}건 조회 스킵: DATA_GO_KR_SERVICE_KEY 미설정`,
      );
      return [];
    }

    const raw = await this.fetchPreSpecLatestRaw(apiKey, limit);
    const cleaned = this.cleanPreSpecData(raw);
    return cleaned.slice(0, limit);
  }

  /**
   * 사전규격(용역) 조회
   */
  private async fetchPreSpec(
    apiKey: string,
    originalKeyword: string,
    searchTerms: string[],
  ): Promise<Array<Record<string, unknown>>> {
    const { inqryBgnDt, inqryEndDt } = this.getDefaultDateRange();
    const seenIds = new Set<string>();
    const allItems: Array<Record<string, unknown>> = [];

    for (const term of searchTerms) {
      for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo++) {
        try {
          const url = new URL(
            `${PROCUREMENT_PRE_SPEC_API_BASE}${SERVC_PPSSRCH.path}`,
          );
          url.searchParams.set('serviceKey', encodeURIComponent(apiKey));
          url.searchParams.set('pageNo', String(pageNo));
          url.searchParams.set('numOfRows', String(ROWS_PER_PAGE));
          url.searchParams.set('type', 'json');
          url.searchParams.set('inqryBgnDt', inqryBgnDt);
          url.searchParams.set('inqryEndDt', inqryEndDt);
          url.searchParams.set('prdctNm', term);

          const res = await fetch(url.toString());
          await sleep(REQUEST_DELAY_MS);
          if (!res.ok) {
            this.logger.warn(
              `${LOG_PRE} [${originalKeyword}] "${term}" p.${pageNo} API HTTP ${res.status}`,
            );
            break;
          }
          const data = (await res.json()) as DataGoKrResponse;
          const header = data?.response?.header;
          if (header?.resultCode && header.resultCode !== '00') {
            this.logger.warn(
              `${LOG_PRE} [${originalKeyword}] "${term}" resultCode=${header.resultCode} ${header.resultMsg ?? ''}`,
            );
            break;
          }
          const list = extractItemsFromBody(data?.response?.body);
          if (list.length === 0) break;

          for (const item of list) {
            const id =
              (item.bfSpecRgstNo as string) ??
              (item.specRgstNo as string) ??
              (item.pblancId as string) ??
              '';
            const key = id || JSON.stringify(item);
            if (seenIds.has(key)) continue;
            const title =
              (item.prdctNm as string) ??
              (item.bsnsNm as string) ??
              (item.prdctClsfcNm as string) ??
              '';
            const matchesAny = searchTerms.some((t) =>
              titleMatchesKeyword(String(title), t),
            );
            if (matchesAny) {
              seenIds.add(key);
              allItems.push(item);
            }
          }
          if (list.length < ROWS_PER_PAGE) break;
        } catch (err) {
          this.logger.error(
            `${LOG_PRE} [${originalKeyword}] "${term}" p.${pageNo} 조회 실패: ${err instanceof Error ? err.message : err}`,
          );
          break;
        }
      }
    }
    return allItems;
  }

  /**
   * 사전규격(용역) 최근 N건 조회 (키워드 없음)
   * - 1페이지로만 가져오되, regDt 기준으로 정렬 후 limit 만큼 반환
   */
  private async fetchPreSpecLatestRaw(
    apiKey: string,
    limit: number,
  ): Promise<Array<Record<string, unknown>>> {
    const { inqryBgnDt, inqryEndDt } = this.getPreSpecLastMonthRange();
    const rows = Math.min(100, Math.max(limit, 30));

    try {
      const url = new URL(
        `${PROCUREMENT_PRE_SPEC_API_BASE}${SERVC_PPSSRCH.path}`,
      );
      url.searchParams.set('serviceKey', encodeURIComponent(apiKey));
      url.searchParams.set('pageNo', '1');
      url.searchParams.set('numOfRows', String(rows));
      url.searchParams.set('type', 'json');
      url.searchParams.set('inqryBgnDt', inqryBgnDt);
      url.searchParams.set('inqryEndDt', inqryEndDt);

      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const res = await fetch(url.toString());
        await sleep(REQUEST_DELAY_MS);

        if (res.status === 429 && attempt < maxAttempts) {
          const backoffMs = 1000 * attempt;
          this.logger.warn(
            `${LOG_PRE} 최근 ${limit}건 HTTP 429 → ${backoffMs}ms 대기 후 재시도 (${attempt}/${maxAttempts})`,
          );
          await sleep(backoffMs);
          continue;
        }

        if (!res.ok) {
          this.logger.warn(
            `${LOG_PRE} 최근 ${limit}건 API HTTP ${res.status} (호출 실패)`,
          );
          return [];
        }

        const data = (await res.json()) as DataGoKrResponse;
        const header = data?.response?.header;
        if (header?.resultCode && header.resultCode !== '00') {
          this.logger.warn(
            `${LOG_PRE} 최근 ${limit}건 resultCode=${header.resultCode} ${header.resultMsg ?? ''} (API 오류)`,
          );
          return [];
        }

        const list = extractItemsFromBody(data?.response?.body);
        list.sort((a, b) => this.regDtScore(b) - this.regDtScore(a));
        return list.slice(0, limit);
      }
      return [];
    } catch (err) {
      this.logger.error(
        `${LOG_PRE} 최근 ${limit}건 조회 실패: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  }

  /**
   * 사전규격 결과 데이터 정리 (필드 정규화, 중복 제거, 필요 필드만 유지)
   */
  private cleanPreSpecData(
    items: Array<Record<string, unknown>>,
  ): Array<Record<string, unknown>> {
    const seen = new Set<string>();
    return items
      .map((item) => {
        const id =
          String(item.bfSpecRgstNo ?? item.specRgstNo ?? item.pblancId ?? '') ||
          null;
        const title =
          String(
            item.prdctNm ?? item.bsnsNm ?? item.prdctClsfcNm ?? '',
          ).trim() || null;
        if (id && seen.has(id)) return null;
        if (id) seen.add(id);
        return {
          bfSpecRgstNo: item.bfSpecRgstNo ?? id,
          prdctNm: item.prdctNm ?? title,
          bsnsNm: item.bsnsNm,
          ordncNm: item.ordncNm,
          dmandInsttNm: item.dmandInsttNm,
          rltdSpecDocFile: item.rltdSpecDocFile,
          regDt: item.regDt,
          ...item,
        } as Record<string, unknown>;
      })
      .filter((x): x is Record<string, unknown> => x != null);
  }

  /** regDt 기반 정렬용 점수 (파싱 실패 시 0) */
  private regDtScore(item: Record<string, unknown>): number {
    const raw = item.regDt;
    if (typeof raw !== 'string') return 0;
    const s = raw.replace(/[^\d]/g, '');
    // 기대 형식: YYYYMMDDhhmm (혹은 YYYYMMDD)
    if (s.length >= 12) {
      const y = Number(s.slice(0, 4));
      const mo = Number(s.slice(4, 6));
      const d = Number(s.slice(6, 8));
      const h = Number(s.slice(8, 10));
      const mi = Number(s.slice(10, 12));
      const t = new Date(y, mo - 1, d, h, mi).getTime();
      return Number.isFinite(t) ? t : 0;
    }
    if (s.length >= 8) {
      const y = Number(s.slice(0, 4));
      const mo = Number(s.slice(4, 6));
      const d = Number(s.slice(6, 8));
      const t = new Date(y, mo - 1, d).getTime();
      return Number.isFinite(t) ? t : 0;
    }
    return 0;
  }

  /**
   * 본공고(입찰공고) 용역 조회
   * - 활용명세/테스트 스크립트와 동일 패턴: ad/BidPublicInfoService + getBidPblancListInfoServc
   * - 필수: ServiceKey·inqryDiv·inqryBgnDt·inqryEndDt·pageNo·numOfRows·type=json
   * - 날짜: YYYYMMDDhhmm(12자), 서버에서는 전체 목록, 클라이언트에서 키워드 필터
   */
  private async fetchBidAnnouncements(
    apiKey: string,
    originalKeyword: string,
    searchTerms: string[],
  ): Promise<Array<Record<string, unknown>>> {
    // 심플 테스트 스크립트와 동일하게 "최근 1개월" 기준
    const { inqryBgnDt, inqryEndDt } = this.getBidLastMonthRange();
    const seenIds = new Set<string>();
    const allItems: Array<Record<string, unknown>> = [];
    let resolvedBase: string | null = null;

    for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo++) {
      const basesToTry = resolvedBase
        ? [resolvedBase]
        : [...PROCUREMENT_BID_API_BASES];
      let lastStatus = 0;
      let responseText = '';

      for (const base of basesToTry) {
        try {
          const url = new URL(`${base}${BID_SERVC_LIST.path}`);
          url.searchParams.set('ServiceKey', bidServiceKeyForQuery(apiKey));
          url.searchParams.set('inqryDiv', '1');
          url.searchParams.set('inqryBgnDt', inqryBgnDt);
          url.searchParams.set('inqryEndDt', inqryEndDt);
          url.searchParams.set('pageNo', String(pageNo));
          url.searchParams.set('numOfRows', String(ROWS_PER_PAGE));
          url.searchParams.set('type', 'json');

          const res = await fetchWithTimeout(
            url.toString(),
            BID_FETCH_TIMEOUT_MS,
          );
          await sleep(REQUEST_DELAY_MS);
          responseText = await res.text();
          lastStatus = res.status;

          if (res.ok) {
            if (!resolvedBase) resolvedBase = base;
            const data = JSON.parse(responseText) as DataGoKrResponse;
            const header = data?.response?.header;
            if (header?.resultCode && header.resultCode !== '00') {
              this.logger.warn(
                `${LOG_BID} [${originalKeyword}] p.${pageNo} resultCode=${header.resultCode} ${header.resultMsg ?? ''}`,
              );
              return allItems;
            }
            const list = extractItemsFromBody(data?.response?.body);
            for (const item of list) {
              const id =
                (item.bidNtceNo as string) ??
                (item.pblancId as string) ??
                (item.ntceNo as string) ??
                '';
              const key = id || JSON.stringify(item);
              if (seenIds.has(key)) continue;
              const title =
                (item.bidNtceNm as string) ??
                (item.prdctNm as string) ??
                (item.bsnsNm as string) ??
                '';
              const matchesAny = searchTerms.some((t) =>
                titleMatchesKeyword(String(title), t),
              );
              if (matchesAny) {
                seenIds.add(key);
                allItems.push(item);
              }
            }
            if (list.length < ROWS_PER_PAGE) break;
            break; /* 이 Base로 성공했으므로 다음 페이지로 */
          }

          if (res.status === 500 && responseText) {
            try {
              const errBody = JSON.parse(responseText) as Record<
                string,
                unknown
              >;
              this.logger.warn(
                `${LOG_BID} [${originalKeyword}] p.${pageNo} Base ${base} → 500: ${JSON.stringify(errBody)}`,
              );
            } catch {
              this.logger.warn(
                `${LOG_BID} [${originalKeyword}] p.${pageNo} Base ${base} → 500 본문: ${responseText.slice(0, 300)}`,
              );
            }
          } else {
            this.logger.warn(
              `${LOG_BID} [${originalKeyword}] p.${pageNo} Base ${base} HTTP ${res.status}`,
            );
          }
        } catch (err) {
          const msg =
            err instanceof Error && err.name === 'AbortError'
              ? `요청 타임아웃(${BID_FETCH_TIMEOUT_MS / 1000}초)`
              : err instanceof Error
                ? err.message
                : String(err);
          this.logger.warn(
            `${LOG_BID} [${originalKeyword}] p.${pageNo} Base ${base} 예외: ${msg}`,
          );
        }
      }

      if (lastStatus !== 200) break;
    }
    return allItems;
  }

  /**
   * 본공고 최근 N건 조회 (키워드 없음, 날짜 기준 1페이지만)
   */
  private async fetchBidAnnouncementsLatest(
    apiKey: string,
    limit: number,
  ): Promise<Array<Record<string, unknown>>> {
    // 심플 테스트 스크립트와 동일하게 "최근 1개월" 기준
    const { inqryBgnDt, inqryEndDt } = this.getBidLastMonthRange();

    for (const base of PROCUREMENT_BID_API_BASES) {
      try {
        const url = new URL(`${base}${BID_SERVC_LIST.path}`);
        url.searchParams.set('ServiceKey', bidServiceKeyForQuery(apiKey));
        url.searchParams.set('inqryDiv', '1');
        url.searchParams.set('inqryBgnDt', inqryBgnDt);
        url.searchParams.set('inqryEndDt', inqryEndDt);
        url.searchParams.set('pageNo', '1');
        url.searchParams.set('numOfRows', String(limit));
        url.searchParams.set('type', 'json');

        const res = await fetchWithTimeout(
          url.toString(),
          BID_FETCH_TIMEOUT_MS,
        );
        await sleep(REQUEST_DELAY_MS);
        const responseText = await res.text();

        if (!res.ok) {
          this.logger.warn(
            `${LOG_BID} 최근 ${limit}건 Base ${base} HTTP ${res.status} (API 실패)`,
          );
          if (res.status === 500 && responseText) {
            try {
              const errBody = JSON.parse(responseText) as Record<
                string,
                unknown
              >;
              this.logger.warn(
                `${LOG_BID} 최근 ${limit}건 500 응답: ${JSON.stringify(errBody).slice(0, 400)}`,
              );
            } catch {
              this.logger.warn(
                `${LOG_BID} 최근 ${limit}건 500 본문: ${responseText.slice(0, 300)}`,
              );
            }
          }
          continue;
        }

        const data = JSON.parse(responseText) as DataGoKrResponse;
        const header = data?.response?.header;
        const body = data?.response?.body;

        if (header?.resultCode && header.resultCode !== '00') {
          this.logger.warn(
            `${LOG_BID} 최근 ${limit}건 resultCode=${header.resultCode} ${header.resultMsg ?? ''} (API 오류)`,
          );
          continue;
        }

        const list = extractItemsFromBody(body);
        if (list.length === 0 && body) {
          this.logger.warn(
            `${LOG_BID} 최근 ${limit}건 응답 200 but 데이터 0건 — body keys: ${Object.keys(body).join(', ')} totalCount=${(body as { totalCount?: number }).totalCount ?? 'n/a'}`,
          );
        }
        return list;
      } catch (err) {
        const msg =
          err instanceof Error && err.name === 'AbortError'
            ? `요청 타임아웃(${BID_FETCH_TIMEOUT_MS / 1000}초)`
            : err instanceof Error
              ? err.message
              : String(err);
        this.logger.warn(
          `${LOG_BID} 최근 ${limit}건 Base ${base} 예외: ${msg} (API 실패)`,
        );
      }
    }
    this.logger.warn(
      `${LOG_BID} 최근 ${limit}건 — 모든 Base 호출 실패. 인증키·활용신청·URL 확인 필요.`,
    );
    return [];
  }

  private getDefaultDateRange(): { inqryBgnDt: string; inqryEndDt: string } {
    const now = new Date();
    const end = new Date(now);
    const start = new Date(now);
    start.setDate(start.getDate() - SEARCH_DAYS);
    const fmt = (d: Date) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
    return { inqryBgnDt: fmt(start), inqryEndDt: fmt(end) };
  }

  /** 사전규격 전용: 최근 1달 조회 범위 */
  private getPreSpecLastMonthRange(): {
    inqryBgnDt: string;
    inqryEndDt: string;
  } {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    const fmt = (d: Date) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
    return { inqryBgnDt: fmt(start), inqryEndDt: fmt(end) };
  }

  /** 본공고 전용: 최근 1개월 조회 범위 (심플 테스트와 동일) */
  private getBidLastMonthRange(): { inqryBgnDt: string; inqryEndDt: string } {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    const fmt = (d: Date) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
    return { inqryBgnDt: fmt(start), inqryEndDt: fmt(end) };
  }
}
