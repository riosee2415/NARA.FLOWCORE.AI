/**
 * 조달 수집 결과 보고용 포맷터
 * - properties 한글 라벨 매핑, 보고용 테이블, 바로가기 링크
 * - AI 자동화 서버 보고용 콘솔 스타일 (박스/색상/섹션)
 */

/** ANSI 색상 (터미널 지원 시) */
export const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgCyan: '\x1b[46m',
  brightCyan: '\x1b[96m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightMagenta: '\x1b[95m',
  blink: '\x1b[5m',
} as const;

/** 스피너 프레임 (호출마다 다음 프레임) */
let spinIndex = 0;
const SPIN_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export function spin(): string {
  const frame = SPIN_FRAMES[spinIndex % SPIN_FRAMES.length];
  spinIndex += 1;
  return frame;
}

/** AI가 바쁘게 움직이는 듯한 메시지 풀 */
const AI_ACTIVITY_MESSAGES = [
  '입찰 공고 데이터 수집 중',
  'AI가 키워드 매칭 검증 중',
  '공고 문서 분석 파이프라인 가동 중',
  '데이터 정규화 및 필터링 중',
  '다음 페이지 스크래핑 중',
  '수집 결과 실시간 집계 중',
  '관련 입찰 건 매칭 검사 중',
  'Open API 응답 파싱 중',
  '중복 제거 및 병합 처리 중',
  '보고용 데이터 정제 중',
];

/** 본공고 페이지별 "AI 바쁨" 한 줄 출력 (스피너 + 색 + 메시지) */
export function printAiBusy(options?: {
  message?: string;
  page?: number;
  count?: number;
}): void {
  const frame = spin();
  const msg =
    options?.message ??
    AI_ACTIVITY_MESSAGES[spinIndex % AI_ACTIVITY_MESSAGES.length];
  const pagePart =
    options?.page != null ? ` ${C.dim}[p.${options.page}]${C.reset}` : '';
  const countPart =
    options?.count != null
      ? ` ${C.brightGreen}${options.count}건 수집${C.reset}`
      : '';
  console.log(
    '  ' +
      C.brightCyan +
      frame +
      C.reset +
      ' ' +
      C.brightMagenta +
      'AI' +
      C.reset +
      ' ' +
      C.bold +
      msg +
      C.reset +
      pagePart +
      countPart +
      ' ' +
      C.dim +
      '···' +
      C.reset,
  );
}

/** ASCII 진행 바 (예: [████████░░] 80%) */
export function printProgressBar(
  current: number,
  total: number,
  label: string,
  width = 24,
): void {
  const pct = total > 0 ? Math.min(1, current / total) : 0;
  const filled = Math.round(width * pct);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  const pctStr = `${Math.round(pct * 100)}%`;
  console.log(
    '  ' +
      C.cyan +
      '[' +
      C.brightGreen +
      bar +
      C.cyan +
      ']' +
      C.reset +
      ' ' +
      C.bold +
      pctStr +
      C.reset +
      '  ' +
      C.dim +
      label +
      C.reset,
  );
}

/** 단계 성공 시 화려한 체크 라인 */
export function printSuccess(line: string): void {
  console.log(
    '  ' + C.brightGreen + '✔' + C.reset + ' ' + C.bold + line + C.reset,
  );
}

/** 섹션 헤더 (본공고 대시보드 느낌) */
export function printLiveSection(title: string, subtitle: string): void {
  const line = '━'.repeat(52);
  console.log('\n  ' + C.brightCyan + '╭' + line + '╮' + C.reset);
  console.log(
    '  ' +
      C.brightCyan +
      '│' +
      C.reset +
      '  ' +
      C.bold +
      title +
      C.reset +
      ' '.repeat(Math.max(0, 48 - title.length)) +
      C.brightCyan +
      '  │' +
      C.reset,
  );
  console.log(
    '  ' +
      C.brightCyan +
      '│' +
      C.reset +
      '  ' +
      C.dim +
      subtitle +
      C.reset +
      ' '.repeat(Math.max(0, 48 - subtitle.length)) +
      C.brightCyan +
      '  │' +
      C.reset,
  );
  console.log('  ' + C.brightCyan + '╰' + line + '╯' + C.reset + '\n');
}

/** 나라장터(G2B) 바로가기 URL (실제 서비스에 맞게 수정 가능) */
const G2B_PRE_SPEC_BASE =
  'https://www.g2b.go.kr/ep/preparation/prestd/preStdDtl.do';
const G2B_BID_BASE =
  'https://www.g2b.go.kr/ep/invitation/publish/bidPblancDtl.do';

/** 사전규격 1건 → 보고용 한글 행 */
export function preSpecToReportRow(
  item: Record<string, unknown>,
): Record<string, string> {
  const bfSpecRgstNo = String(
    item.bfSpecRgstNo ?? item.specRgstNo ?? '',
  ).trim();
  const link = bfSpecRgstNo
    ? `${G2B_PRE_SPEC_BASE}?preStdRegNo=${encodeURIComponent(bfSpecRgstNo)}`
    : '';
  return {
    'No.': bfSpecRgstNo || '-',
    '주관처(발주기관)': String(item.ordncNm ?? item.ordncInsttNm ?? '-').trim(),
    수요기관: String(item.dmandInsttNm ?? item.dmandInstt ?? '-').trim(),
    '사업명(품명)': String(
      item.prdctNm ?? item.bsnsNm ?? item.prdctClsfcNm ?? '-',
    ).trim(),
    등록일시: formatDateKr(item.regDt),
    설명:
      String(item.bsnsCn ?? item.rm ?? '-')
        .trim()
        .slice(0, 80) || '-',
    바로가기: link || '-',
  };
}

/** 본공고 1건 → 보고용 한글 행 */
export function bidToReportRow(
  item: Record<string, unknown>,
): Record<string, string> {
  const bidNo = String(
    item.bidNtceNo ?? item.ntceNo ?? item.pblancId ?? '',
  ).trim();
  const link = bidNo
    ? `${G2B_BID_BASE}?bidPblancNo=${encodeURIComponent(bidNo)}`
    : '';
  return {
    'No.': bidNo || '-',
    '주관처(발주기관)': String(item.ordncNm ?? item.ordncInsttNm ?? '-').trim(),
    '사업명(공고명)': String(
      item.bidNtceNm ?? item.prdctNm ?? item.bsnsNm ?? '-',
    ).trim(),
    등록일시: formatDateKr(item.regDt ?? item.ntceDt),
    마감일시: formatDateKr(item.bidClseDt ?? item.clseDt),
    설명:
      String(item.bsnsCn ?? item.ntceCn ?? '-')
        .trim()
        .slice(0, 80) || '-',
    바로가기: link || '-',
  };
}

function formatDateKr(value: unknown): string {
  if (value == null) return '-';
  const s = String(value).replace(/[^\d]/g, '');
  if (s.length >= 12)
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)} ${s.slice(8, 10)}:${s.slice(10, 12)}`;
  if (s.length >= 8)
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return String(value);
}

/** 컬럼 너비 제한 */
const MAX_CELL = 44;

function cellStr(v: string, max = MAX_CELL): string {
  const s = String(v).replace(/\r?\n/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 2) + '…' : s;
}

/** 보고용 테이블 출력 (한글 헤더 + 행) */
export function printReportTable(
  title: string,
  rows: Record<string, string>[],
  color = C.cyan,
): void {
  if (rows.length === 0) {
    console.log(`  ${color}${C.bold}[${title}]${C.reset} 결과 없음\n`);
    return;
  }
  const keys = Object.keys(rows[0]);
  const colWidths = keys.map((k) => {
    const contentMax = Math.max(
      ...rows.map((r) => cellStr(r[k] ?? '').length),
      k.length,
    );
    return Math.min(MAX_CELL, Math.max(2, contentMax));
  });
  const sep = colWidths.map((w) => '─'.repeat(w)).join('─┬─');
  const top = '┌─' + sep + '─┐';
  const mid = '├─' + sep + '─┤';
  const bot = '└─' + sep + '─┘';

  console.log(`\n  ${color}${C.bold}▌ ${title} (${rows.length}건)${C.reset}`);
  console.log(`  ${C.dim}${top}${C.reset}`);
  const headerCells = keys.map((k, i) => {
    const w = colWidths[i];
    const t = k.length > w ? k.slice(0, w - 1) + '…' : k;
    return t + ' '.repeat(Math.max(0, w - t.length));
  });
  console.log('  ' + C.dim + '│ ' + headerCells.join(' │ ') + ' │' + C.reset);
  console.log(`  ${C.dim}${mid}${C.reset}`);
  for (const row of rows) {
    const cells = keys.map((k, i) => {
      const w = colWidths[i];
      const v = cellStr(row[k] ?? '', w);
      return v + ' '.repeat(Math.max(0, w - v.length));
    });
    console.log('  ' + C.dim + '│ ' + cells.join(' │ ') + ' │' + C.reset);
  }
  console.log(`  ${C.dim}${bot}${C.reset}\n`);
}

// ─── 콘솔 섹션 (AI 자동화 보고용) ───────────────────────────────────────────

export function printBanner(title: string, subtitle = ''): void {
  const line = '═'.repeat(58);
  console.log('\n' + C.cyan + C.bold + '  ╔' + line + '╗' + C.reset);
  console.log(C.cyan + C.bold + '  ║  ' + title.padEnd(54) + '  ║' + C.reset);
  if (subtitle) {
    console.log(C.dim + '  ║  ' + subtitle.padEnd(54) + '  ║' + C.reset);
  }
  console.log(C.cyan + C.bold + '  ╚' + line + '╝' + C.reset + '\n');
}

export function printSection(title: string, emoji = '◆'): void {
  console.log('\n  ' + C.blue + C.bold + `${emoji} ${title}` + C.reset + '\n');
}

export function printStep(step: string, detail: string): void {
  console.log(
    '  ' +
      C.green +
      '▶' +
      C.reset +
      ' ' +
      C.bold +
      step +
      C.reset +
      ' ' +
      C.dim +
      detail +
      C.reset,
  );
}

export function printAiPhase(message: string): void {
  console.log(
    '  ' + C.magenta + '◇ AI ' + C.reset + C.bold + message + C.reset,
  );
}

export function printCount(label: string, count: number, total?: number): void {
  const t = total != null ? ` / ${total}건` : '';
  console.log(
    '  ' +
      C.yellow +
      '▸' +
      C.reset +
      ` ${label}: ${C.bold}${count}건${t}${C.reset}`,
  );
}

export function printReportStart(): void {
  console.log('');
  console.log(
    C.brightCyan +
      '  ╔════════════════════════════════════════════════════════════╗' +
      C.reset,
  );
  console.log(
    C.brightCyan +
      '  ║' +
      C.reset +
      C.bold +
      '  🤖  AI 기반 조달 자동화 · 실시간 수집 & 매칭 보고  ' +
      C.reset +
      C.brightCyan +
      '║' +
      C.reset,
  );
  console.log(
    C.brightCyan +
      '  ║' +
      C.reset +
      C.dim +
      '  사전규격 · 본공고 키워드 확장 및 매칭  ' +
      C.reset +
      C.brightCyan +
      '                    ║' +
      C.reset,
  );
  console.log(
    C.brightCyan +
      '  ╚════════════════════════════════════════════════════════════╝' +
      C.reset,
  );
  console.log('');
}

export function printReportEnd(): void {
  console.log('');
  console.log(
    '  ' +
      C.brightCyan +
      '┌────────────────────────────────────────────────────────────┐' +
      C.reset,
  );
  console.log(
    '  ' +
      C.brightCyan +
      '│' +
      C.reset +
      '  ' +
      C.brightGreen +
      C.bold +
      '  ✓  AI 조달 수집·매칭 보고 완료  ' +
      C.reset +
      C.brightCyan +
      '                    │' +
      C.reset,
  );
  console.log(
    '  ' +
      C.brightCyan +
      '└────────────────────────────────────────────────────────────┘' +
      C.reset,
  );
  console.log('');
}
