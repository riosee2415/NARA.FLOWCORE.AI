import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { PrismaService } from '../prisma/prisma.service';
import {
  cleanTitle,
  extractArticleId,
  parsePublishedDate,
  stripLtnPrefix,
} from '../common/law-crawler.utils';
import {
  printSection,
  printStep,
  printAiBusy,
  printCount,
  printSuccess,
  printLiveSection,
} from '../common/law-crawler-console.helper';

export interface LtnArticle {
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
export class LtnService {
  private readonly logger = new Logger(LtnService.name);

  private readonly BASE_URL = 'https://www.ltn.kr';
  private readonly LIST_URL = `${this.BASE_URL}/news/articleList.html`;

  private readonly DEFAULT_HEADERS = {
    'User-Agent':
      'Mozilla/5.0 (compatible; NaraFlowcoreCrawler/1.0; +https://example.com/bot-info)',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 상세 페이지에서 description, content, source 추출
   * - 본문/요약에서 "[법률방송뉴스]" 제거
   */
  private async fetchDetailMeta(url: string): Promise<{
    description: string;
    source: string;
    content: string;
    reporter: string;
    date: string;
  }> {
    try {
      const response = await axios.get(url, {
        headers: this.DEFAULT_HEADERS,
        timeout: 10000,
      });

      const html: string = response.data;
      const $ = cheerio.load(html);

      let rawDescription =
        $('meta[name="description"]').attr('content') ||
        $('meta[property="og:description"]').attr('content') ||
        '';

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

      const description = stripLtnPrefix(
        (rawDescription || '').replace(/\s+/g, ' ').trim(),
      );

      // 본문: #article-view-content-div 또는 .article-view-content 등
      const $content =
        $('#article-view-content-div').length > 0
          ? $('#article-view-content-div')
          : $('[id*="article-view"], .article-body, .view-content').first();

      const paragraphs: string[] = [];
      $content.find('p').each((_, elem) => {
        const text = $(elem).text().replace(/\s+/g, ' ').trim();
        if (text) {
          paragraphs.push(stripLtnPrefix(text));
        }
      });
      const content = stripLtnPrefix(paragraphs.join('\n\n') || description);

      const siteName =
        $('meta[property="og:site_name"]').attr('content') ||
        $('meta[name="title"]').attr('content') ||
        '';

      let hostname = '';
      try {
        const u = new URL(url);
        hostname = u.hostname.replace(/^www\./, '');
      } catch {
        // ignore
      }
      const source = hostname
        ? `${(siteName || '법률방송뉴스').trim()} (${hostname})`
        : (siteName || '법률방송뉴스').trim();

      // 기자/날짜: byline 등
      const byline = $('.byline, .article-byline, .writer').first().text();
      const dateEl =
        $('meta[property="article:published_time"]').attr('content') ||
        $('.byline em, .date').first().text();
      const reporter = (byline || '')
        .replace(/\s+/g, ' ')
        .replace(/\d{4}\.\d{2}\.\d{2}.*$/, '')
        .trim();
      const date =
        typeof dateEl === 'string' && dateEl.includes('.')
          ? dateEl
          : $('.byline em').first().text() || '';

      return {
        description,
        source,
        content: content || description,
        reporter: reporter || '',
        date: date.trim(),
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.warn(`[LTN] 상세 크롤 실패 - url=${url} / ${message}`);
      return {
        description: '',
        source: '법률방송뉴스 (ltn.kr)',
        content: '',
        reporter: '',
        date: '',
      };
    }
  }

  /**
   * 목록 페이지 1페이지 크롤링 (중요뉴스 SRN2, 요약형 sm)
   */
  async crawlPage(page: number = 1): Promise<LtnArticle[]> {
    this.logger.log(`[LTN] 크롤링 시작 - page=${page}`);

    try {
      const response = await axios.get(this.LIST_URL, {
        params: {
          page,
          sc_serial_code: 'SRN2',
          view_type: 'sm',
          box_idxno: 0,
        },
        headers: this.DEFAULT_HEADERS,
        timeout: 10000,
      });

      const html: string = response.data;
      const $ = cheerio.load(html);

      const baseArticles: Omit<
        LtnArticle,
        'description' | 'source' | 'content'
      >[] = [];

      $('#section-list .type-sm li').each((_, elem) => {
        const $item = $(elem);

        const $titleLink = $item.find('.view-cont H2.titles a').first();
        const rawTitle = $titleLink.text() || '';
        const title = cleanTitle(rawTitle.replace(/\s+/g, ' ').trim());
        const href = ($titleLink.attr('href') || '').trim();

        if (!title || !href) return;

        const url = href.startsWith('http') ? href : `${this.BASE_URL}${href}`;

        const rawLead = $item.find('.view-cont p.lead a').text() || '';
        const summary = stripLtnPrefix(rawLead.replace(/\s+/g, ' ').trim());

        const dateStr = $item.find('.view-cont span.byline em').text() || '';

        const $img = $item.find('a.thumb img').first();
        const src = ($img.attr('src') || '').trim();
        const imageUrl = src || null;

        baseArticles.push({
          title,
          url,
          summary,
          reporter: '',
          date: dateStr.trim(),
          imageUrl,
          section: '중요뉴스',
        });
      });

      const articles: LtnArticle[] = await Promise.all(
        baseArticles.map(async (item) => {
          const meta = await this.fetchDetailMeta(item.url);
          return {
            ...item,
            description: meta.description || meta.content || item.summary,
            source: meta.source,
            content: meta.content || meta.description || item.summary,
            reporter: meta.reporter || item.reporter,
            date: meta.date || item.date,
          };
        }),
      );

      this.logger.log(`[LTN] page=${page} 크롤링 완료 - ${articles.length}건`);

      return articles;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.error(`[LTN] 크롤링 실패 - page=${page} / ${message}`);
      return [];
    }
  }

  /**
   * 여러 페이지 순차 크롤링 (기본 3페이지)
   */
  async crawlRecent(pages: number = 3): Promise<LtnArticle[]> {
    const maxPages = Math.max(1, pages);

    this.logger.log(`[LTN] 최근 기사 크롤링 시작 - pages=${maxPages}`);

    printLiveSection(
      '법률방송뉴스(중요뉴스) 실시간 수집 대시보드',
      'AI가 법률방송뉴스를 수집·검증 중입니다',
    );
    printSection('1. 법률방송뉴스 수집 (ltn.kr 중요뉴스)', '◆');
    printStep('법률방송뉴스 API', `최근 ${maxPages}페이지 크롤링`);

    const all: LtnArticle[] = [];

    for (let page = 1; page <= maxPages; page += 1) {
      this.logger.log(`[LTN] 페이지 - page=${page}`);
      const pageArticles = await this.crawlPage(page);
      all.push(...pageArticles);
      printAiBusy({
        message: '법률방송뉴스 페이지 조회 중',
        page,
        count: all.length,
      });

      if (page < maxPages) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    const unique = new Map<string, LtnArticle>();
    for (const article of all) {
      if (!unique.has(article.url)) {
        unique.set(article.url, article);
      }
    }

    const result = Array.from(unique.values());
    this.logger.log(`[LTN] 최근 기사 크롤링 종료 - 총 ${result.length}건`);

    printCount('수집 건수', result.length);
    printSuccess('법률방송뉴스 수집 완료');

    return result;
  }

  /**
   * 크롤링 결과를 LegalNews 테이블에 저장 (sourceUrl 기준 중복 제외)
   */
  async saveArticlesToDb(articles: LtnArticle[]): Promise<{
    total: number;
    created: number;
    skipped: number;
    newTitles: string[];
  }> {
    if (articles.length === 0) {
      this.logger.log('[LTN] 저장할 기사 없음');
      return { total: 0, created: 0, skipped: 0, newTitles: [] };
    }

    printSection('2. DB 동기화 (법률방송뉴스)', '◆');
    printStep('기존 DB 분석', '중복 URL 제거');

    const sourceUrls = articles.map((a) => a.url);

    const existing = await this.prisma.legalNews.findMany({
      where: { sourceUrl: { in: sourceUrls } },
      select: { sourceUrl: true },
    });
    const existingSet = new Set(existing.map((e) => e.sourceUrl));

    const newArticles = articles.filter((a) => !existingSet.has(a.url));

    printCount('가져온 데이터', articles.length);
    printCount('나라아이넷 보유', existingSet.size, articles.length);
    printCount('신규 추가', newArticles.length, articles.length);

    if (newArticles.length === 0) {
      this.logger.log(
        `[LTN] 새로 저장할 기사 없음 (이미 ${articles.length}건 존재)`,
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
      sourceArticleId: extractArticleId(a.url),
      section: a.section,
      subSection: null,
      title: a.title,
      summary: a.summary || null,
      description: a.description || null,
      content: a.content,
      reporter: a.reporter || null,
      publishedAt: parseLtnDate(a.date),
    }));

    await this.prisma.legalNews.createMany({
      data,
      skipDuplicates: true,
    });

    this.logger.log(
      `[LTN] DB 저장 완료 - 새로 추가: ${newArticles.length}건 / 전체: ${articles.length}건`,
    );

    printSuccess('법률방송뉴스 DB 동기화 완료');

    return {
      total: articles.length,
      created: newArticles.length,
      skipped: articles.length - newArticles.length,
      newTitles: newArticles.map((a) => a.title),
    };
  }

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

/** ltn 날짜 형식 "2026.03.17 09:04" → Date */
function parseLtnDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const normalized = dateStr.replace(
    /^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})/,
    '$1-$2-$3 $4:$5',
  );
  return parsePublishedDate(normalized);
}
