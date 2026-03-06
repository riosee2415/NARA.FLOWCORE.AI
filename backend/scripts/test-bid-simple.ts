import * as fs from 'fs';
import * as path from 'path';

// backend/.env 최소 파서 (외부 라이브러리 없이)
function loadEnvOnce() {
  const envPath = path.resolve(__dirname, '../.env');
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const rawVal = trimmed.slice(eq + 1).trim();
      if (!key || process.env[key] !== undefined) continue;
      const unquoted =
        (rawVal.startsWith('"') && rawVal.endsWith('"')) ||
        (rawVal.startsWith("'") && rawVal.endsWith("'"))
          ? rawVal.slice(1, -1)
          : rawVal;
      process.env[key] = unquoted;
    }
  } catch {
    // .env 없으면 무시
  }
}

loadEnvOnce();

/**
 * 조달청 나라장터 입찰공고정보서비스(본공고) 단순 테스트 스크립트
 * - 최근 1개월 기준, 키워드 없이 최근 10건만 조회
 * - Nest 컨텍스트와 무관한 순수 fetch 호출로 500/응답 구조 확인용
 *
 * 실행: npm run test:bid:simple
 */

function getLastMonthRange(): { inqryBgnDt: string; inqryEndDt: string } {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 1);

  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
      d.getDate(),
    ).padStart(2, '0')}${String(d.getHours()).padStart(2, '0')}${String(
      d.getMinutes(),
    ).padStart(2, '0')}`;

  return {
    inqryBgnDt: fmt(start),
    inqryEndDt: fmt(end),
  };
}

async function main() {
  const rawKey =
    process.env.DATA_GO_KR_BID_SERVICE_KEY ||
    process.env.DATA_GO_KR_SERVICE_KEY ||
    '';

  const serviceKey = rawKey.trim();

  if (!serviceKey) {
    // eslint-disable-next-line no-console
    console.error(
      '[test-bid-simple] 환경변수 DATA_GO_KR_BID_SERVICE_KEY 또는 DATA_GO_KR_SERVICE_KEY 가 설정되어 있지 않습니다.',
    );
    process.exit(1);
  }

  const { inqryBgnDt, inqryEndDt } = getLastMonthRange();

  // 공공데이터포털 활용명세의 End Point + 오퍼레이션 (예제와 동일한 형태)
  const baseUrl =
    'https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoServc';

  const params = new URLSearchParams();
  params.set('inqryDiv', '1');
  params.set('inqryBgnDt', inqryBgnDt);
  params.set('inqryEndDt', inqryEndDt);
  params.set('pageNo', '1');
  params.set('numOfRows', '10');
  params.set('type', 'json');
  // 공식 예제에 맞춰 ServiceKey(대문자 S) 사용, 별도 인코딩 없이 그대로 전달
  params.set('ServiceKey', serviceKey);

  const url = `${baseUrl}?${params.toString()}`;

  // eslint-disable-next-line no-console
  console.log('[test-bid-simple] 요청 URL:\n', url, '\n');

  const res = await fetch(url);
  const text = await res.text();

  // eslint-disable-next-line no-console
  console.log('[test-bid-simple] HTTP 상태코드:', res.status);

  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.log('[test-bid-simple] 원문 응답(앞부분):\n', text.slice(0, 1000));
    return;
  }

  try {
    const json = JSON.parse(text) as {
      response?: {
        header?: { resultCode?: string; resultMsg?: string };
        body?: { items?: unknown; totalCount?: number };
      };
    };

    const header = json.response?.header;
    const body = json.response?.body;

    // eslint-disable-next-line no-console
    console.log(
      '[test-bid-simple] resultCode/resultMsg:',
      header?.resultCode,
      header?.resultMsg,
    );

    if (header?.resultCode && header.resultCode !== '00') {
      // eslint-disable-next-line no-console
      console.log(
        '[test-bid-simple] API 오류 resultCode != 00, body 전체:\n',
        JSON.stringify(json, null, 2),
      );
      return;
    }

    const rawItems = body?.items;
    const list = Array.isArray(rawItems)
      ? (rawItems as Array<Record<string, unknown>>)
      : rawItems
        ? [rawItems as Record<string, unknown>]
        : [];

    // eslint-disable-next-line no-console
    console.log(
      `[test-bid-simple] 최근 1개월 본공고 조회 결과: ${list.length}건`,
    );

    if (list.length > 0) {
      // eslint-disable-next-line no-console
      console.log(
        '[test-bid-simple] 첫 번째 공고 예시:\n',
        JSON.stringify(list[0], null, 2),
      );
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      '[test-bid-simple] JSON 파싱 실패, 원문 응답:\n',
      text.slice(0, 2000),
      '\n에러:',
      err,
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();
