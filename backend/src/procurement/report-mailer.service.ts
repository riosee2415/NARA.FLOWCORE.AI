import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { REPORT_EMAIL_RECIPIENTS } from '../config/email-recipients.config';

/** 조달 수집 결과 메일 발송 (Google SMTP, EMAIL_KEY 사용) */
@Injectable()
export class ReportMailerService {
  private readonly logger = new Logger(ReportMailerService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * 사전규격·본공고 매칭 결과를 수신자 목록에 이메일로 전송.
   * .env: EMAIL_USER=발신 Gmail 주소, EMAIL_KEY=Google SMTP 앱 비밀번호
   */
  async sendProcurementReport(payload: {
    preSpecRows: Record<string, string>[];
    bidRows: Record<string, string>[];
    runAt: string;
    baseKeywords: string[];
    expandedTerms: string[];
  }): Promise<boolean> {
    const user = this.config.get<string>('EMAIL_USER')?.trim();
    const pass = this.config.get<string>('EMAIL_KEY')?.trim();
    if (!user || !pass) {
      this.logger.warn(
        'EMAIL_USER 또는 EMAIL_KEY 미설정 — 보고 메일 발송 스킵',
      );
      return false;
    }
    const toList = REPORT_EMAIL_RECIPIENTS.filter((e) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),
    );
    if (toList.length === 0) {
      this.logger.warn('유효한 수신자 없음 — 보고 메일 발송 스킵');
      return false;
    }

    const { preSpecRows, bidRows, runAt, baseKeywords, expandedTerms } =
      payload;
    const subject = `[AI 조달 자동화] 수집 보고 ${runAt} — 사전규격 ${preSpecRows.length}건, 본공고 ${bidRows.length}건`;
    const html = this.buildReportHtml({
      preSpecRows,
      bidRows,
      runAt,
      baseKeywords,
      expandedTerms,
    });

    try {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: { user, pass },
      });
      await transporter.sendMail({
        from: `"AI 조달 자동화" <${user}>`,
        to: toList.join(', '),
        subject,
        html,
        text:
          subject +
          '\n\n사전규격: ' +
          preSpecRows.length +
          '건\n본공고: ' +
          bidRows.length +
          '건\n\n원본 키워드:\n- ' +
          baseKeywords.join('\n- ') +
          '\n\nAI 확장·분석 키워드 (일부):\n- ' +
          expandedTerms.slice(0, 20).join('\n- '),
      });
      this.logger.log(
        `보고 메일 발송 완료: ${toList.length}명 (${toList.join(', ')})`,
      );
      return true;
    } catch (err) {
      this.logger.error(
        `보고 메일 발송 실패: ${err instanceof Error ? err.message : err}`,
      );
      return false;
    }
  }

  /**
   * 법률신문 크롤링 결과 보고 메일 (아이로 → 나라아이넷 DB 동기화 요약)
   * 수신자: config/email-recipients.config.ts
   */
  async sendLawNewsReport(payload: {
    runAt: string;
    legal: {
      total: number;
      created: number;
      skipped: number;
      newTitles: string[];
    };
    judgment: {
      total: number;
      created: number;
      skipped: number;
      newTitles: string[];
    };
  }): Promise<boolean> {
    const user = this.config.get<string>('EMAIL_USER')?.trim();
    const pass = this.config.get<string>('EMAIL_KEY')?.trim();
    if (!user || !pass) {
      this.logger.warn(
        'EMAIL_USER 또는 EMAIL_KEY 미설정 — 법률 뉴스 보고 메일 발송 스킵',
      );
      return false;
    }
    const toList = REPORT_EMAIL_RECIPIENTS.filter((e) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),
    );
    if (toList.length === 0) {
      this.logger.warn('유효한 수신자 없음 — 법률 뉴스 보고 메일 발송 스킵');
      return false;
    }

    const subject = `[AI 아이로] 법률신문 크롤링·DB 동기화 보고 ${payload.runAt}`;
    const html = this.buildLawNewsReportHtml(payload);

    try {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: { user, pass },
      });
      await transporter.sendMail({
        from: `"AI 아이로 · 나라아이넷" <${user}>`,
        to: toList.join(', '),
        subject,
        html,
        text: `${subject}\n\n법원 뉴스: 가져온 ${payload.legal.total}건, 기존 보유 ${payload.legal.skipped}건, 신규 ${payload.legal.created}건\n판결기사: 가져온 ${payload.judgment.total}건, 기존 보유 ${payload.judgment.skipped}건, 신규 ${payload.judgment.created}건`,
      });
      this.logger.log(`법률 뉴스 보고 메일 발송 완료: ${toList.length}명`);
      return true;
    } catch (err) {
      this.logger.error(
        `법률 뉴스 보고 메일 발송 실패: ${err instanceof Error ? err.message : err}`,
      );
      return false;
    }
  }

  private buildLawNewsReportHtml(payload: {
    runAt: string;
    legal: {
      total: number;
      created: number;
      skipped: number;
      newTitles: string[];
    };
    judgment: {
      total: number;
      created: number;
      skipped: number;
      newTitles: string[];
    };
  }): string {
    const { runAt, legal, judgment } = payload;
    const titleList = (titles: string[]) =>
      titles.length === 0
        ? '<p style="margin:0;font-size:13px;color:#888;">없음</p>'
        : titles
            .map(
              (t, i) =>
                `<li style="margin:4px 0;line-height:1.45;">${escapeHtml(t)}</li>`,
            )
            .join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>법률신문 크롤링 보고</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Malgun Gothic', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:24px 20px;">
    <!-- 헤더 -->
    <div style="background:linear-gradient(135deg, #1e5193 0%, #2d6bb5 100%);border-radius:16px;padding:28px 24px;color:#fff;box-shadow:0 8px 24px rgba(30,81,147,0.25);margin-bottom:24px;">
      <div style="font-size:20px;font-weight:700;margin-bottom:6px;">🤖 AI 아이로 · 법률신문 크롤링 보고</div>
      <div style="font-size:14px;opacity:0.95;line-height:1.6;">
        인공지능 <strong>AI 아이로</strong>가 법률신문을 크롤링하여 얻은 데이터입니다.<br/>
        나라아이넷(주)이 보유한 데이터베이스와 비교하여 <strong>없는 내용만 추가</strong>했습니다.
      </div>
      <div style="font-size:12px;opacity:0.9;margin-top:12px;">실행 시각: ${escapeHtml(runAt)}</div>
    </div>

    <!-- 요약 카드 -->
    <div style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:24px;">
      <div style="flex:1 1 280px;min-width:0;background:#fff;border-radius:12px;padding:20px;border:1px solid #e2e8f0;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
        <div style="font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">법원 뉴스</div>
        <div style="font-size:28px;font-weight:700;color:#1e5193;">가져온 데이터 <span style="color:#334155;">${legal.total}</span>건</div>
        <div style="font-size:13px;color:#64748b;margin-top:6px;">나라아이넷 보유 <strong>${legal.skipped}</strong>건 · DB 신규 추가 <strong style="color:#0ea5e9;">${legal.created}</strong>건</div>
      </div>
      <div style="flex:1 1 280px;min-width:0;background:#fff;border-radius:12px;padding:20px;border:1px solid #e2e8f0;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
        <div style="font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">판결기사</div>
        <div style="font-size:28px;font-weight:700;color:#1e5193;">가져온 데이터 <span style="color:#334155;">${judgment.total}</span>건</div>
        <div style="font-size:13px;color:#64748b;margin-top:6px;">나라아이넷 보유 <strong>${judgment.skipped}</strong>건 · DB 신규 추가 <strong style="color:#0ea5e9;">${judgment.created}</strong>건</div>
      </div>
    </div>

    <!-- 법원 뉴스 신규 타이틀 -->
    <div style="background:#fff;border-radius:12px;padding:20px;border:1px solid #e2e8f0;box-shadow:0 2px 8px rgba(0,0,0,0.04);margin-bottom:20px;">
      <div style="font-size:15px;font-weight:700;color:#1e5193;margin-bottom:12px;">📰 법원 뉴스 — DB에 새로 들어간 기사 (${legal.newTitles.length}건)</div>
      <ul style="margin:0;padding-left:20px;font-size:13px;color:#334155;">
        ${titleList(legal.newTitles)}
      </ul>
    </div>

    <!-- 판결기사 신규 타이틀 -->
    <div style="background:#fff;border-radius:12px;padding:20px;border:1px solid #e2e8f0;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
      <div style="font-size:15px;font-weight:700;color:#1e5193;margin-bottom:12px;">⚖️ 판결기사 — DB에 새로 들어간 기사 (${judgment.newTitles.length}건)</div>
      <ul style="margin:0;padding-left:20px;font-size:13px;color:#334155;">
        ${titleList(judgment.newTitles)}
      </ul>
    </div>

    <div style="text-align:center;margin-top:28px;font-size:11px;color:#94a3b8;">
      본 메일은 매일 오전 10시·오후 5시 자동 수집 후 발송됩니다. · 나라아이넷(주)
    </div>
  </div>
</body>
</html>`;
  }

  private buildReportHtml(payload: {
    preSpecRows: Record<string, string>[];
    bidRows: Record<string, string>[];
    runAt: string;
    baseKeywords?: string[];
    expandedTerms?: string[];
  }): string {
    const { preSpecRows, bidRows, runAt, baseKeywords, expandedTerms } =
      payload;
    const thead = (keys: string[]) =>
      '<tr>' +
      keys
        .map(
          (k) =>
            `<th style="border:1px solid #ddd;padding:6px;text-align:left">${escapeHtml(k)}</th>`,
        )
        .join('') +
      '</tr>';
    const tbody = (rows: Record<string, string>[]) => {
      if (rows.length === 0)
        return '<tr><td colspan="99" style="border:1px solid #ddd;padding:8px">없음</td></tr>';
      const keys = Object.keys(rows[0]);
      return rows
        .map(
          (r) =>
            '<tr>' +
            keys
              .map(
                (k) =>
                  `<td style="border:1px solid #ddd;padding:6px">${escapeHtml(String(r[k] ?? ''))}</td>`,
              )
              .join('') +
            '</tr>',
        )
        .join('');
    };

    const preSpecKeys = preSpecRows[0] ? Object.keys(preSpecRows[0]) : [];
    const bidKeys = bidRows[0] ? Object.keys(bidRows[0]) : [];

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>조달 수집 보고</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Malgun Gothic, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <div style="max-width:980px;margin:24px auto;padding:0 16px;">
    <!-- 헤더 카드 -->
    <div style="background:linear-gradient(135deg,#1f6feb,#3fb0ff);border-radius:12px;padding:20px 22px 18px 22px;color:#fff;box-shadow:0 6px 18px rgba(15,53,132,0.25);">
      <div style="font-size:18px;font-weight:700;margin-bottom:4px;">🤖 AI 조달 자동화 · 수집 결과 보고</div>
      <div style="font-size:13px;opacity:0.9;margin-bottom:6px;">
        나라아이넷(주) AI 에이전트 <strong>“아이로”</strong> 입니다.<br/>
        등록된 키워드를 기반으로 사전규격 및 본공고 데이터를 자동으로 수집·분석한 결과를 전달드립니다.
      </div>
      <div style="font-size:12px;opacity:0.85;">실행 시각: ${escapeHtml(
        runAt,
      )}</div>
    </div>

    <!-- 키워드 분석 카드 -->
    <div style="margin-top:18px;background:#ffffff;border-radius:10px;padding:16px 18px 14px 18px;border:1px solid #e0e5f0;">
      <div style="font-size:15px;font-weight:700;color:#222;margin-bottom:6px;">AI 키워드 분석</div>
      <div style="font-size:12px;color:#555;margin-bottom:10px;line-height:1.5;">
        아래 <strong>AI 확장·분석 키워드</strong>는 OpenAI 모델을 사용하여
        등록 키워드를 의미적으로 확장·정규화한 것으로, 실제 공고 제목·품명에서
        관련도가 높은 사업을 자동으로 탐색하기 위해 사용됩니다.
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:16px;">
        <div style="flex:1 1 260px;min-width:0;">
          <div style="font-size:13px;font-weight:600;color:#333;margin-bottom:4px;">
            등록 키워드 (${baseKeywords?.length ?? 0}개)
          </div>
          <div style="background:#f7f9ff;border-radius:8px;padding:8px 10px;max-height:140px;overflow:auto;border:1px solid #e1e6f5;">
            ${
              (baseKeywords ?? []).length
                ? `<ul style="margin:0;padding-left:16px;font-size:12px;color:#222;line-height:1.5;">${(
                    baseKeywords ?? []
                  )
                    .map((k) => `<li>${escapeHtml(k)}</li>`)
                    .join('')}</ul>`
                : '<div style="font-size:12px;color:#777;">등록된 키워드가 없습니다.</div>'
            }
          </div>
        </div>

        <div style="flex:1 1 260px;min-width:0;">
          <div style="font-size:13px;font-weight:600;color:#333;margin-bottom:4px;">
            AI 확장·분석 키워드 (${expandedTerms?.length ?? 0}개)
          </div>
          <div style="background:#fdf7ff;border-radius:8px;padding:8px 10px;max-height:140px;overflow:auto;border:1px solid #f0e3ff;">
            ${
              (expandedTerms ?? []).length
                ? `<ul style="margin:0;padding-left:16px;font-size:12px;color:#222;line-height:1.5;">${(
                    expandedTerms ?? []
                  )
                    .map((k) => `<li>${escapeHtml(k)}</li>`)
                    .join('')}</ul>`
                : '<div style="font-size:12px;color:#777;">AI 확장 결과가 없습니다.</div>'
            }
          </div>
        </div>
      </div>
    </div>

    <!-- 사전규격 매칭 -->
    <div style="margin-top:18px;background:#ffffff;border-radius:10px;padding:14px 16px 16px 16px;border:1px solid #e0e5f0;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <div style="font-size:15px;font-weight:700;color:#222;">사전규격 매칭 (${preSpecRows.length}건)</div>
      </div>
      <table style="border-collapse:collapse;width:100%;max-width:100%;font-size:12px;">
        <thead>
          <tr style="background:#f3f6ff;">
            ${thead(preSpecKeys)}
          </tr>
        </thead>
        <tbody>
          ${tbody(preSpecRows)}
        </tbody>
      </table>
    </div>

    <!-- 본공고 매칭 -->
    <div style="margin-top:18px;background:#ffffff;border-radius:10px;padding:14px 16px 18px 16px;border:1px solid #e0e5f0;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <div style="font-size:15px;font-weight:700;color:#222;">본공고 매칭 (${bidRows.length}건)</div>
      </div>
      <table style="border-collapse:collapse;width:100%;max-width:100%;font-size:12px;">
        <thead>
          <tr style="background:#f3f6ff;">
            ${thead(bidKeys)}
          </tr>
        </thead>
        <tbody>
          ${tbody(bidRows)}
        </tbody>
      </table>
      <div style="margin-top:16px;color:#888;font-size:11px;text-align:right;">
        본 메일은 오전 9시 / 오후 3시 자동 수집 후 발송됩니다.
      </div>
    </div>
  </div>
</body>
</html>`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
