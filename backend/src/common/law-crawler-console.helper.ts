/**
 * 법률신문 크롤링(법원 뉴스·판결기사) 콘솔 출력용
 * - 조달 수집과 동일한 스타일(섹션/진행/건수/성공)
 */

export const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  brightCyan: '\x1b[96m',
  brightGreen: '\x1b[92m',
  brightMagenta: '\x1b[95m',
} as const;

let spinIndex = 0;
const SPIN_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function spin(): string {
  const frame = SPIN_FRAMES[spinIndex % SPIN_FRAMES.length];
  spinIndex += 1;
  return frame;
}

/** 섹션 헤더 (◆ 1. 법원 뉴스 수집) */
export function printSection(title: string, emoji = '◆'): void {
  console.log('\n  ' + C.blue + C.bold + `${emoji} ${title}` + C.reset + '\n');
}

/** 단계 한 줄 (▶ 단계명 상세) */
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

/** 페이지별 진행 (스피너 + [p.N] Y건 수집) */
export function printAiBusy(options: {
  message: string;
  page: number;
  count: number;
}): void {
  const frame = spin();
  const { message, page, count } = options;
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
      message +
      C.reset +
      ' ' +
      C.dim +
      `[p.${page}]` +
      C.reset +
      ' ' +
      C.brightGreen +
      `${count}건 수집` +
      C.reset +
      ' ' +
      C.dim +
      '···' +
      C.reset,
  );
}

/** 건수 요약 (▸ 라벨: N건 / M건) */
export function printCount(label: string, count: number, total?: number): void {
  const t = total != null ? ` / ${C.bold}${total}건${C.reset}` : '';
  console.log(
    '  ' +
      C.yellow +
      '•' +
      C.reset +
      ` ${label}: ${C.brightGreen}${C.bold}${count}건${C.reset}${t}`,
  );
}

/** 완료 체크 (✔ 메시지) */
export function printSuccess(line: string): void {
  console.log(
    '  ' + C.brightGreen + '✓' + C.reset + ' ' + C.bold + line + C.reset,
  );
}

/** 실시간 대시보드 박스 */
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

/** 결과 없음/요약 한 줄 */
export function printResultLine(label: string, value: string): void {
  console.log('  ' + C.dim + `[${label}]` + C.reset + ' ' + value);
}
