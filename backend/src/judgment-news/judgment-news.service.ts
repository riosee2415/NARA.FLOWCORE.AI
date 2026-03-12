import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { PrismaService } from '../prisma/prisma.service';

export interface JudgmentNewsArticle {
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
export class JudgmentNewsService {
  private readonly logger = new Logger(JudgmentNewsService.name);

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
    let title = raw;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const next = title.replace(/^\s*\[[^\]]*\]\s*/u, '');
      if (next === title) break;
      title = next;
    }
    return title.trim();
  }

  private async fetchDetailMeta(url: string): Promise<{
    description: string;
    source: string;
    content: string;
    section: string | null;
    subSection: string | null;
    publishedAt: Date | null;
  }> {
    try {
      const response = await axios.get(url, {
        headers: this.DEFAULT_HEADERS,
        timeout: 10000,
      });

      const html: string = response.data;
      const $ = cheerio.load(html);

      // description
      let rawDescription = $('meta[name="description"]').attr('content') || '';
      rawDescription =
        rawDescription ||
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
            // ignore
          }
        }
      }

      const description = (rawDescription || '').replace(/\s+/g, ' ').trim();

      // 본문
      const paragraphs: string[] = [];
      $('#article-view-content-div p').each((_, elem) => {
        const text = $(elem).text().replace(/\s+/g, ' ').trim();
        if (text) {
          paragraphs.push(text);
        }
      });
      const content = paragraphs.join('\n\n');

      // 출처
      const siteNameMeta =
        $('meta[property="og:site_name"]').attr('content') ||
        $('meta[name="title"]').attr('content') ||
        '';

      let hostname = '';
      try {
        const parsedUrl = new URL(url);
        hostname = parsedUrl.hostname.replace(/^www\./, '');
      } catch {
        // ignore
      }

      const siteName = siteNameMeta || '법률신문';
      const source = hostname
        ? `${siteName} (${hostname})`
        : siteName || '법률신문';

      // 섹션 정보 (판결큐레이션 / 판결기사 / 대법원 등)
      const section =
        $('meta[property="article:section"]').attr('content') || null;
      const subSection =
        $('meta[property="article:section2"]').attr('content') ||
        $('meta[property="article:section1"]').attr('content') ||
        null;

      // 게시 시각
      const publishedTime =
        $('meta[property="article:published_time"]').attr('content') || '';
      const publishedAt = publishedTime ? new Date(publishedTime) : null;

      const finalDescription = description || content;

      return {
        description: finalDescription,
        source,
        content,
        section,
        subSection,
        publishedAt,
      };
    } catch (error) {
      this.logger.error(
        `[LawTimes-판결][메타] 상세 페이지 분석 중 오류 발생: ${url}`,
        (error as Error).stack,
      );
      return {
        description: '',
        source: '법률신문',
        content: '',
        section: null,
        subSection: null,
        publishedAt: null,
      };
    }
  }

  /**
   * 판결기사 리스트 1페이지 크롤링
   * (요청과 달리 이 섹션은 항상 1페이지만 처리)
   */
  async crawlPage(): Promise<JudgmentNewsArticle[]> {
    const page = 1;
    this.logger.log(
      `[LawTimes-판결][페이지] AI가 판결기사 리스트 페이지(${page})를 스캔합니다...`,
    );

    const params = {
      page,
      sc_sub_section_code: 'S2N46',
      view_type: 'sm',
    };

    try {
      const response = await axios.get(this.LIST_URL, {
        headers: this.DEFAULT_HEADERS,
        params,
        timeout: 10000,
      });

      const html: string = response.data;
      const $ = cheerio.load(html);

      const items: JudgmentNewsArticle[] = [];

      $('ul.altlist-webzine > li.altlist-webzine-item').each((_, el) => {
        const $item = $(el);

        const $titleLink = $item.find('h2.altlist-subject a').first();
        const rawTitle = $titleLink.text() || '';
        const title = this.cleanTitle(rawTitle.replace(/\s+/g, ' ').trim());

        const href = $titleLink.attr('href') || '';
        const url = href.startsWith('http') ? href : `${this.BASE_URL}${href}`;

        const summary = ($item.find('p.altlist-summary').text() || '')
          .replace(/\s+/g, ' ')
          .trim();

        const reporter = $item
          .find('.altlist-info .altlist-info-item')
          .first()
          .text()
          .replace(/\s+/g, ' ')
          .trim();

        const date = $item
          .find('.altlist-info .altlist-info-item')
          .eq(1)
          .text()
          .replace(/\s+/g, ' ')
          .trim();

        const $img = $item.find('a.altlist-image img').first();
        const imageUrl = $img.attr('src')
          ? $img.attr('src')!.startsWith('http')
            ? $img.attr('src')!
            : `${this.BASE_URL}${$img.attr('src')}`
          : null;

        items.push({
          title,
          url,
          summary,
          description: '',
          source: '',
          content: '',
          reporter,
          date,
          imageUrl,
          section: '판결기사',
        });
      });

      this.logger.log(
        `[LawTimes-판결][페이지] 1차 스캔 완료 — 후보 ${items.length}건. 이제 AI가 상세 페이지를 정밀 분석합니다...`,
      );

      const enriched: JudgmentNewsArticle[] = [];

      for (const item of items) {
        const meta = await this.fetchDetailMeta(item.url);
        enriched.push({
          ...item,
          description: meta.description || item.summary,
          source: meta.source,
          content: meta.content || item.summary,
          section: meta.subSection || item.section,
        });
      }

      this.logger.log(
        `[LawTimes-판결][페이지] 정밀 분석 완료 — ${enriched.length}건의 판결 기사를 확보했습니다.`,
      );

      return enriched;
    } catch (error) {
      this.logger.error(
        `[LawTimes-판결][페이지] 페이지 크롤링 중 오류 발생`,
        (error as Error).stack,
      );
      return [];
    }
  }

  /**
   * 판결기사는 항상 1페이지만 처리
   */
  async crawlRecent(): Promise<JudgmentNewsArticle[]> {
    this.logger.log(
      `[LawTimes-판결][전체] AI가 최신 판결기사 1페이지를 정밀 수집합니다...`,
    );
    const articles = await this.crawlPage();

    this.logger.log(
      `[LawTimes-판결][전체] 전체 분석 완료 — 총 ${articles.length}건의 판결 기사를 확보했습니다.`,
    );

    return articles;
  }

  private extractArticleId(url: string): string | null {
    try {
      const u = new URL(url);
      const idxno = u.searchParams.get('idxno');
      return idxno;
    } catch {
      return null;
    }
  }

  private parsePublishedDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    // 예: "2026-03-11"
    const trimmed = dateStr.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  async saveArticlesToDb(articles: JudgmentNewsArticle[]): Promise<{
    total: number;
    created: number;
    skipped: number;
    newTitles: string[];
  }> {
    if (!articles.length) {
      this.logger.log(
        '[LawTimes-판결][DB] 동기화할 판결 기사가 없습니다. (0건)',
      );
      return { total: 0, created: 0, skipped: 0, newTitles: [] };
    }

    this.logger.log(
      `[LawTimes-판결][DB] AI가 DB 동기화 시퀀스를 시작했습니다. 총 후보: ${articles.length}건`,
    );

    const urls = articles.map((a) => a.url);

    const existing = await this.prisma.judgmentNews.findMany({
      where: { sourceUrl: { in: urls } },
      select: { sourceUrl: true },
    });

    const existingUrlSet = new Set(existing.map((e) => e.sourceUrl));

    this.logger.log(
      `[LawTimes-판결][DB] 기존 DB 분석 완료 — 이미 저장된 URL ${existingUrlSet.size}건.`,
    );

    const newArticles = articles.filter((a) => !existingUrlSet.has(a.url));

    this.logger.log(
      `[LawTimes-판결][DB] AI가 신규 후보를 선별했습니다 — 새로 추가할 기사 ${newArticles.length}건.`,
    );

    if (!newArticles.length) {
      this.logger.log(
        '[LawTimes-판결][DB] 모든 판결 기사가 이미 DB에 존재합니다. 추가 작업 없이 종료합니다.',
      );
      return {
        total: articles.length,
        created: 0,
        skipped: articles.length,
        newTitles: [],
      };
    }

    const now = new Date();

    const data = newArticles.map((a) => {
      const articleId = this.extractArticleId(a.url);
      const parsedDate = this.parsePublishedDate(a.date);

      return {
        sourceSite: a.source || '법률신문',
        sourceUrl: a.url,
        sourceArticleId: articleId ?? null,
        section: '판결큐레이션',
        subSection: a.section ?? '판결기사',
        title: a.title,
        summary: a.summary || null,
        description: a.description || null,
        content: a.content || a.summary || '',
        reporter: a.reporter || null,
        publishedAt: parsedDate,
        crawledAt: now,
      };
    });

    const titlesPreview = newArticles
      .slice(0, 5)
      .map((a) => `- ${a.title}`)
      .join('\n');

    this.logger.log(
      `[LawTimes-판결][DB] AI가 다음 판결 기사들을 새로 추가합니다 (최대 5개 미리보기):\n${titlesPreview}`,
    );

    const result = await this.prisma.judgmentNews.createMany({
      data,
      skipDuplicates: true,
    });

    const created = result.count;
    const skipped = articles.length - created;
    const newTitles = newArticles.map((a) => a.title);

    this.logger.log(
      `[LawTimes-판결][DB] 동기화 완료 — 새로 추가: ${created}건, 건너뜀(중복 포함): ${skipped}건.`,
    );

    return {
      total: articles.length,
      created,
      skipped,
      newTitles,
    };
  }

  async crawlAndSaveRecent(): Promise<{
    total: number;
    created: number;
    skipped: number;
    newTitles: string[];
  }> {
    this.logger.log(
      '[LawTimes-판결][JOB] 최신 판결기사 수집 및 DB 동기화를 시작합니다.',
    );

    const articles = await this.crawlRecent();
    const stats = await this.saveArticlesToDb(articles);

    this.logger.log(
      `[LawTimes-판결][JOB] 작업 완료 — 총 ${stats.total}건 중 ${stats.created}건 신규 저장, ${stats.skipped}건 스킵.`,
    );

    return stats;
  }
}
