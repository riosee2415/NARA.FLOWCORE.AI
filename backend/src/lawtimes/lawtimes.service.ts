import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { PrismaService } from '../prisma/prisma.service';

export interface LawTimesArticle {
  title: string;
  url: string;
  summary: string;
  description: string;
  source: string;
  content: string;
  reporter: string;
  date: string;
  imageUrl: string | null;
  section: string;
}

@Injectable()
export class LawTimesService {
  private readonly logger = new Logger(LawTimesService.name);

  private readonly BASE_URL = 'https://www.lawtimes.co.kr';
  private readonly LIST_URL = `${this.BASE_URL}/news/articleList.html`;

  private readonly DEFAULT_HEADERS = {
    'User-Agent':
      'Mozilla/5.0 (compatible; NaraFlowcoreCrawler/1.0; +https://example.com/bot-info)',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * "[속보]", "[단독]" 등 제목 맨 앞의 대괄호 태그를 제거
   */
  private cleanTitle(raw: string): string {
    if (!raw) return '';
    // 맨 앞에 연속해서 붙은 [XXX] 패턴들 제거
    let title = raw;
    // 예: "[속보] [단독] 제목" 형태까지 처리
    // 반복적으로 제거하면서 앞 공백도 정리
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const next = title.replace(/^\s*\[[^\]]*\]\s*/u, '');
      if (next === title) break;
      title = next;
    }
    return title.trim();
  }

  /**
   * 개별 기사 상세 페이지에서 meta 정보 추출
   * - description: meta[name="description"] 또는 NewsArticle.description
   * - content: 화면에 실제로 보이는 전체 본문 텍스트
   * - source: meta[name="Copyright"] 또는 og:site_name, 기본값 '법률신문'
   */
  private async fetchDetailMeta(url: string): Promise<{
    description: string;
    source: string;
    content: string;
  }> {
    try {
      const response = await axios.get(url, {
        headers: this.DEFAULT_HEADERS,
        timeout: 10000,
      });

      const html: string = response.data;
      const $ = cheerio.load(html);

      // 1순위: meta[name="description"]
      let rawDescription = $('meta[name="description"]').attr('content') || '';
      rawDescription =
        rawDescription ||
        $('meta[property="og:description"]').attr('content') ||
        '';

      // 보조로 JSON-LD NewsArticle.description 사용 시도
      if (!rawDescription) {
        const ldJson = $('script[type="application/ld+json"]').first().html();
        if (ldJson) {
          try {
            const parsed = JSON.parse(ldJson);
            if (typeof parsed.description === 'string') {
              rawDescription = parsed.description;
            }
          } catch {
            // 무시
          }
        }
      }

      const description = (rawDescription || '').replace(/\s+/g, ' ').trim();

      // 기사 본문 전체 텍스트 추출
      const paragraphs: string[] = [];
      $('#article-view-content-div p').each((_, elem) => {
        const text = $(elem).text().replace(/\s+/g, ' ').trim();
        if (text) {
          paragraphs.push(text);
        }
      });
      const content = paragraphs.join('\n\n');

      // 사이트명과 도메인을 기준으로 출처 생성
      const siteNameMeta =
        $('meta[property="og:site_name"]').attr('content') ||
        $('meta[name="title"]').attr('content') ||
        '';

      let hostname = '';
      try {
        const parsedUrl = new URL(url);
        hostname = parsedUrl.hostname.replace(/^www\./, '');
      } catch {
        // URL 파싱 실패 시 그대로 둠
      }

      const baseName = (siteNameMeta || hostname || '법률신문').trim();
      const source = hostname ? `${baseName} (${hostname})` : baseName;

      return { description, source, content };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.warn(
        `[LawTimes] 상세 메타 크롤 실패 - url=${url} / ${message}`,
      );
      return { description: '', source: '법률신문', content: '' };
    }
  }

  /**
   * 실제 목록 페이지 크롤링 핵심 로직
   */
  async crawlPage(page: number = 1): Promise<LawTimesArticle[]> {
    this.logger.log(`[LawTimes] 크롤링 시작 - page=${page}`);
    console.log(`\n[LawTimes-AI] >>> 페이지 스캔 준비 중... (page=${page})`);

    try {
      const response = await axios.get(this.LIST_URL, {
        params: {
          sc_sub_section_code: 'S2N1', // 법원 섹션
          view_type: 'sm', // 요약형 리스트
          page,
        },
        headers: this.DEFAULT_HEADERS,
        timeout: 10000,
      });

      const html: string = response.data;
      const $ = cheerio.load(html);

      const baseArticles: Omit<
        LawTimesArticle,
        'description' | 'source' | 'content'
      >[] = [];

      $('ul.altlist-webzine > li.altlist-webzine-item').each((_, elem) => {
        const $item = $(elem);

        const $titleLink = $item.find('h2.altlist-subject a').first();
        const rawTitle = $titleLink.text() || '';
        const title = this.cleanTitle(rawTitle.replace(/\s+/g, ' ').trim());
        const href = ($titleLink.attr('href') || '').trim();

        if (!title || !href) {
          return;
        }

        const url = href.startsWith('http') ? href : `${this.BASE_URL}${href}`;

        const rawSummary = $item.find('p.altlist-summary').text() || '';
        const summary = rawSummary.replace(/\s+/g, ' ').trim();

        const $infoItems = $item.find('div.altlist-info .altlist-info-item');
        const reporter = ($infoItems.eq(0).text() || '')
          .replace(/\s+/g, ' ')
          .trim();
        const date = ($infoItems.eq(1).text() || '').trim();

        const $img = $item.find('a.altlist-image img').first();
        const src = ($img.attr('src') || '').trim();
        const imageUrl = src || null;

        baseArticles.push({
          title,
          url,
          summary,
          reporter,
          date,
          imageUrl,
          section: '법원',
        });
      });

      console.log(
        `[LawTimes-AI] [page=${page}] 1차 스캔 완료: ${baseArticles.length}건, 샘플 타이틀:`,
        baseArticles.slice(0, 3).map((a) => a.title),
      );

      // 각 기사 상세 페이지에서 description / source / content 보강
      const articles: LawTimesArticle[] = await Promise.all(
        baseArticles.map(async (item) => {
          const meta = await this.fetchDetailMeta(item.url);
          return {
            ...item,
            description: meta.description || meta.content,
            source: meta.source,
            content: meta.content,
          };
        }),
      );

      this.logger.log(
        `[LawTimes] page=${page} 크롤링 완료 - ${articles.length}건`,
      );
      console.log(
        `[LawTimes-AI] [page=${page}] 정밀 분석 완료: 총 ${articles.length}건`,
      );

      return articles;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.error(`[LawTimes] 크롤링 실패 - page=${page} / ${message}`);
      console.error('[LawTimes] 크롤링 에러:', error);
      return [];
    }
  }

  /**
   * 여러 페이지를 순차적으로 크롤링 (테스트 기본값: 1페이지)
   */
  async crawlRecent(pages: number = 3): Promise<LawTimesArticle[]> {
    // 최소 3페이지까지는 항상 수집
    const maxPages = Math.max(3, pages);

    this.logger.log(
      `[LawTimes] 최근 기사 크롤링 시작 - 요청 pages=${pages}, 실제 pages=${maxPages}`,
    );
    console.log('[LawTimes] crawlRecent 호출:', {
      requestedPages: pages,
      actualPages: maxPages,
    });

    const all: LawTimesArticle[] = [];

    for (let page = 1; page <= maxPages; page += 1) {
      this.logger.log(`[LawTimes] 페이지 크롤링 순서 - page=${page}`);
      console.log(
        `[LawTimes-AI] >>> (${page}/${maxPages}) 페이지 분석 시작...`,
      );
      const pageArticles = await this.crawlPage(page);
      all.push(...pageArticles);

      if (page < maxPages) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    const unique = new Map<string, LawTimesArticle>();
    for (const article of all) {
      if (!unique.has(article.url)) {
        unique.set(article.url, article);
      }
    }

    const result = Array.from(unique.values());
    this.logger.log(`[LawTimes] 최근 기사 크롤링 종료 - 총 ${result.length}건`);
    console.log(
      '[LawTimes-AI] ✓ 전체 페이지 분석 완료. 최종 기사 수:',
      result.length,
    );

    return result;
  }

  /**
   * 크롤링한 기사들을 DB에 저장
   * 1) 전체 크롤링 결과 중 URL 기준으로 중복 제거
   * 2) DB에 이미 존재하는 sourceUrl은 제외
   * 3) 나머지 새 기사만 bulk insert
   */
  async saveArticlesToDb(articles: LawTimesArticle[]): Promise<{
    total: number;
    created: number;
    skipped: number;
    newTitles: string[];
  }> {
    if (articles.length === 0) {
      this.logger.log('[LawTimes] 저장할 기사 없음');
      return { total: 0, created: 0, skipped: 0, newTitles: [] };
    }

    console.log(
      '\n[LawTimes-AI] ### DB 동기화 시퀀스 시작 ### (크롤링 결과:',
      articles.length,
      '건)',
    );
    console.log(
      '[LawTimes-AI] · AI가 분석을 시작했습니다. 기존 DB를 스캔하고, 새로 수집된 기사와 매칭 중입니다...',
    );

    const sourceUrls = articles.map((a) => a.url);

    const existing = await this.prisma.legalNews.findMany({
      where: { sourceUrl: { in: sourceUrls } },
      select: { sourceUrl: true },
    });
    const existingSet = new Set(existing.map((e) => e.sourceUrl));

    const newArticles = articles.filter((a) => !existingSet.has(a.url));

    console.log(
      '[LawTimes-AI] · 기존 DB 분석 완료. 중복으로 감지된 기사 수:',
      existingSet.size,
      '건',
    );
    console.log(
      '[LawTimes-AI] · 신규 후보:',
      newArticles.length,
      '건 / 샘플 타이틀:',
      newArticles.slice(0, 5).map((a) => a.title),
    );

    if (newArticles.length === 0) {
      this.logger.log(
        `[LawTimes] 새로 저장할 기사 없음 (이미 ${articles.length}건 존재)`,
      );
      return {
        total: articles.length,
        created: 0,
        skipped: articles.length,
        newTitles: [],
      };
    }

    const data = newArticles.map((a) => ({
      sourceSite: a.source,
      sourceUrl: a.url,
      sourceArticleId: this.extractArticleId(a.url),
      section: a.section,
      subSection: null,
      title: a.title,
      summary: a.summary || null,
      description: a.description || null,
      content: a.content,
      reporter: a.reporter || null,
      publishedAt: this.parsePublishedDate(a.date),
    }));

    await this.prisma.legalNews.createMany({
      data,
      skipDuplicates: true,
    });

    this.logger.log(
      `[LawTimes] DB 저장 완료 - 새로 추가: ${newArticles.length}건 / 전체: ${articles.length}건`,
    );
    console.log(
      '[LawTimes-AI] ✓ AI 분석 완료. 데이터베이스에 없던 새로운 뉴스를 추가했습니다.',
    );
    console.log(
      '[LawTimes-AI] ✓ DB 반영 요약 - 새로 추가:',
      newArticles.length,
      '건, 무시된 기존 데이터:',
      articles.length - newArticles.length,
      '건',
    );
    console.log('[LawTimes-AI] ### DB 동기화 시퀀스 종료 ###\n');

    return {
      total: articles.length,
      created: newArticles.length,
      skipped: articles.length - newArticles.length,
      newTitles: newArticles.map((a) => a.title),
    };
  }

  /**
   * url 쿼리의 idxno에서 원본 기사 ID 추출
   * 예: https://.../articleView.html?idxno=217575 → "217575"
   */
  private extractArticleId(url: string): string | null {
    try {
      const u = new URL(url);
      const idx = u.searchParams.get('idxno');
      return idx || null;
    } catch {
      return null;
    }
  }

  /**
   * "2026-03-12" 같은 문자열을 Date로 변환 (로컬 날짜 기준)
   */
  private parsePublishedDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    const trimmed = dateStr.trim();
    if (!trimmed) return null;
    try {
      return new Date(trimmed);
    } catch {
      return null;
    }
  }

  /**
   * 3페이지까지 크롤링 + DB 저장까지 한 번에 수행
   */
  async crawlAndSaveRecent(pages: number = 3): Promise<{
    total: number;
    created: number;
    skipped: number;
    newTitles: string[];
  }> {
    const articles = await this.crawlRecent(pages);
    return this.saveArticlesToDb(articles);
  }
}
