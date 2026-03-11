import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DAILY_TASKS } from '../daily/daily.constants';
import type { DailyTask } from '../daily/daily-task.interface';
import { PRE_SPEC_KEYWORDS } from '../config/pre-spec-keywords.config';
import {
  PROCUREMENT_PRE_SPEC_API_BASE,
  PROCUREMENT_BID_API_BASES,
} from './procurement.constants';
import { KeywordExpanderService } from './keyword-expander.service';
import { normalizeKeyword, titleMatchesKeyword } from './keyword-normalizer';
import { ReportMailerService } from './report-mailer.service';
import {
  printReportStart,
  printReportEnd,
  printSection,
  printStep,
  printAiPhase,
  printCount,
  printReportTable,
  preSpecToReportRow,
  bidToReportRow,
  printAiBusy,
  printProgressBar,
  printSuccess,
  printLiveSection,
} from './procurement-report.helper';

const LOG_PRE = '*사전규격*';
const LOG_BID = '*본공고*';

/** 용역 전용: 사전규격 용역 목록 조회 (no 7, 등록일시범위) — API문서 기준 */
const PRE_SPEC_SERVC_LIST = {
  name: '사전규격 용역 목록 조회',
  path: '/getPublicPrcureThngInfoServc',
} as const;

/** 본공고(입찰공고) 용역 목록 조회 - 등록일시 기준 */
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

/** 페이지당 건수, 전체 조회 시 최대 페이지 (안전 상한) */
const ROWS_PER_PAGE = 100;
const MAX_PAGES_LAST_MONTH_ALL = 100;

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
    private readonly reportMailer: ReportMailerService,
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

    printReportStart();

    // 0단계: 등록 키워드 로드 → OpenAI로 매칭용 검색어 배열 확장
    printSection('1. 키워드 로드 & AI 확장', '◆');
    const keywords = PRE_SPEC_KEYWORDS.map((k) => normalizeKeyword(k)).filter(
      (k) => k.length > 0,
    );
    if (keywords.length === 0) {
      this.logger.warn(
        `${LOG_PRE} 등록 키워드 없음. config/pre-spec-keywords.config.ts 에 키워드를 추가하세요.`,
      );
      printReportEnd();
      return;
    }
    printStep('등록 키워드 로드', `${keywords.length}개`);
    printAiPhase('OpenAI로 관련/동의어·축약어 분석 중...');
    const expandedTerms =
      await this.keywordExpander.expandAllForMatching(keywords);
    if (expandedTerms.length === 0) {
      this.logger.warn(`${LOG_PRE} 확장된 매칭어 없음. 조회 스킵.`);
      printReportEnd();
      return;
    }
    printStep('매칭용 검색어 확장 완료', `${expandedTerms.length}개`);
    printSuccess(`AI 확장 키워드 ${expandedTerms.length}개 준비 완료`);

    let preSpecRows: Record<string, string>[] = [];
    let bidRows: Record<string, string>[] = [];

    // 1단계: 사전규격 수집 → 확장 키워드로 매칭
    if (runPreSpec && hasPreSpec && apiKey) {
      printSection('2. 사전규격 수집 & 키워드 매칭', '◆');
      printStep('사전규격 API 조회', '최근 2일');
      const preSpecRaw = await this.fetchPreSpecLastMonthAll(apiKey);
      printCount('수집 건수', preSpecRaw.length);
      const preSpecMatched = this.filterByExpandedTerms(
        preSpecRaw,
        expandedTerms,
        (item) =>
          [item.prdctNm, item.bsnsNm, item.prdctClsfcNm]
            .filter(Boolean)
            .map(String)
            .join(' '),
      );
      printCount('키워드 매칭 건수', preSpecMatched.length, preSpecRaw.length);
      const preSpecCleaned = this.cleanPreSpecData(preSpecMatched);
      preSpecRows = preSpecCleaned.map(preSpecToReportRow);
      printReportTable('사전규격 매칭 결과 (보고용)', preSpecRows);
      if (preSpecCleaned.length > 0) {
        printSuccess(`사전규격 데이터 정리 완료: ${preSpecCleaned.length}건`);
      }
      printSuccess('사전규격 단계 완료');
    }

    // 2단계: 본공고 수집 → 확장 키워드로 매칭
    if (runBid && hasBid && bidApiKey) {
      printSection('3. 본공고 수집 & 키워드 매칭', '◆');
      printLiveSection(
        '본공고 실시간 수집 대시보드',
        'AI가 입찰 공고를 수집·검증 중입니다',
      );
      printStep('본공고 API 조회', '최근 2일');
      const progressInterval = setInterval(() => {
        printAiBusy();
      }, 5000);
      let bidRaw: Array<Record<string, unknown>> = [];
      try {
        bidRaw = await this.fetchBidAnnouncementsLastMonthAll(bidApiKey);
      } finally {
        clearInterval(progressInterval);
      }
      printSuccess(`본공고 수집 완료: 총 ${bidRaw.length}건`);
      printCount('수집 건수', bidRaw.length);
      const bidMatched = this.filterByExpandedTerms(
        bidRaw,
        expandedTerms,
        (item) =>
          [item.bidNtceNm, item.prdctNm, item.bsnsNm]
            .filter(Boolean)
            .map(String)
            .join(' '),
      );
      printCount('키워드 매칭 건수', bidMatched.length, bidRaw.length);
      bidRows = bidMatched.map(bidToReportRow);
      printReportTable('본공고 매칭 결과 (보고용)', bidRows);
      if (bidMatched.length === 0) {
        printSuccess('본공고 키워드 매칭: 0건 (수집 완료)');
      } else {
        printSuccess(`본공고 매칭 완료: ${bidMatched.length}건`);
      }
      printSuccess('본공고 단계 완료');
    }

    printReportEnd();

    // 수집 결과 이메일 자동 전송 (수신자: config/email-recipients.config.ts)
    const runAt = new Date().toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
    });
    await this.reportMailer.sendProcurementReport({
      preSpecRows,
      bidRows,
      runAt,
      baseKeywords: keywords,
      expandedTerms,
    });
  }

  /**
   * 수집된 항목을 확장 키워드 배열로 필터: 제목/품명이 어떤 확장어와라도 매칭되면 포함.
   */
  private filterByExpandedTerms(
    items: Array<Record<string, unknown>>,
    expandedTerms: string[],
    getSearchableText: (item: Record<string, unknown>) => string,
  ): Array<Record<string, unknown>> {
    return items.filter((item) => {
      const text = getSearchableText(item);
      if (!text) return false;
      return expandedTerms.some((term) => titleMatchesKeyword(text, term));
    });
  }

  /**
   * 사전규격(용역) 최근 2일 전체 조회 (키워드/필터 없음, 모든 페이지)
   */
  private async fetchPreSpecLastMonthAll(
    apiKey: string,
  ): Promise<Array<Record<string, unknown>>> {
    const { inqryBgnDt, inqryEndDt } = this.getPreSpecLastMonthRange();
    const seenIds = new Set<string>();
    const allItems: Array<Record<string, unknown>> = [];
    let pageNo = 1;

    for (;;) {
      printAiBusy({
        message: `사전규격 페이지 ${pageNo} 조회 중`,
        page: pageNo,
        count: allItems.length,
      });
      try {
        const url = new URL(
          `${PROCUREMENT_PRE_SPEC_API_BASE}${PRE_SPEC_SERVC_LIST.path}`,
        );
        url.searchParams.set('serviceKey', encodeURIComponent(apiKey));
        url.searchParams.set('inqryDiv', '1'); // 1: 등록일시 기준 (문서 필수)
        url.searchParams.set('pageNo', String(pageNo));
        url.searchParams.set('numOfRows', String(ROWS_PER_PAGE));
        url.searchParams.set('type', 'json');
        url.searchParams.set('inqryBgnDt', inqryBgnDt);
        url.searchParams.set('inqryEndDt', inqryEndDt);

        const res = await fetch(url.toString());
        await sleep(REQUEST_DELAY_MS);

        if (!res.ok) {
          this.logger.warn(
            `${LOG_PRE} 최근 2일 전체 p.${pageNo} API HTTP ${res.status}`,
          );
          break;
        }

        const data = (await res.json()) as DataGoKrResponse;
        const header = data?.response?.header;
        if (header?.resultCode && header.resultCode !== '00') {
          this.logger.warn(
            `${LOG_PRE} 최근 2일 전체 p.${pageNo} resultCode=${header.resultCode} ${header.resultMsg ?? ''}`,
          );
          break;
        }

        const list = extractItemsFromBody(data?.response?.body);
        for (const item of list) {
          const id =
            (item.bfSpecRgstNo as string) ??
            (item.specRgstNo as string) ??
            (item.pblancId as string) ??
            '';
          const key = id || JSON.stringify(item);
          if (seenIds.has(key)) continue;
          seenIds.add(key);
          allItems.push(item);
        }

        if (list.length < ROWS_PER_PAGE) break;
        pageNo++;
        if (pageNo > MAX_PAGES_LAST_MONTH_ALL) {
          this.logger.log(
            `${LOG_PRE} 최근 2일 전체 ${MAX_PAGES_LAST_MONTH_ALL}페이지까지 조회 완료 (${allItems.length}건)`,
          );
          break;
        }
      } catch (err) {
        this.logger.error(
          `${LOG_PRE} 최근 2일 전체 p.${pageNo} 조회 실패: ${err instanceof Error ? err.message : String(err)}`,
        );
        break;
      }
    }

    return allItems;
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

  /**
   * 본공고(입찰공고) 최근 2일 전체 조회 (키워드/필터 없음, 모든 페이지)
   */
  private async fetchBidAnnouncementsLastMonthAll(
    apiKey: string,
  ): Promise<Array<Record<string, unknown>>> {
    const { inqryBgnDt, inqryEndDt } = this.getBidLastMonthRange();
    const seenIds = new Set<string>();
    const allItems: Array<Record<string, unknown>> = [];
    let resolvedBase: string | null = null;
    let pageNo = 1;

    for (;;) {
      printAiBusy({
        message: `페이지 ${pageNo} 입찰 데이터 수집 중`,
        page: pageNo,
        count: allItems.length,
      });
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
                `${LOG_BID} 최근 2일 전체 p.${pageNo} resultCode=${header.resultCode} ${header.resultMsg ?? ''}`,
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
              seenIds.add(key);
              allItems.push(item);
            }
            if (list.length < ROWS_PER_PAGE) return allItems;
            pageNo++;
            if (pageNo > MAX_PAGES_LAST_MONTH_ALL) {
              this.logger.log(
                `${LOG_BID} 최근 2일 전체 ${MAX_PAGES_LAST_MONTH_ALL}페이지까지 조회 완료 (${allItems.length}건)`,
              );
              return allItems;
            }
            break;
          }

          if (res.status === 500 && responseText) {
            try {
              const errBody = JSON.parse(responseText) as Record<
                string,
                unknown
              >;
              this.logger.warn(
                `${LOG_BID} 최근 2일 전체 p.${pageNo} Base ${base} → 500: ${JSON.stringify(errBody)}`,
              );
            } catch {
              this.logger.warn(
                `${LOG_BID} 최근 2일 전체 p.${pageNo} Base ${base} → 500 본문: ${responseText.slice(0, 300)}`,
              );
            }
          } else {
            this.logger.warn(
              `${LOG_BID} 최근 2일 전체 p.${pageNo} Base ${base} HTTP ${res.status}`,
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
            `${LOG_BID} 최근 2일 전체 p.${pageNo} Base ${base} 예외: ${msg}`,
          );
        }
      }

      if (lastStatus !== 200) break;
    }

    return allItems;
  }

  /** 사전규격 전용: 최근 2일 조회 범위 */
  private getPreSpecLastMonthRange(): {
    inqryBgnDt: string;
    inqryEndDt: string;
  } {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 2);
    const fmt = (d: Date) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
    return { inqryBgnDt: fmt(start), inqryEndDt: fmt(end) };
  }

  /** 본공고 전용: 최근 2일 조회 범위 */
  private getBidLastMonthRange(): { inqryBgnDt: string; inqryEndDt: string } {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 2);
    const fmt = (d: Date) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
    return { inqryBgnDt: fmt(start), inqryEndDt: fmt(end) };
  }
}
