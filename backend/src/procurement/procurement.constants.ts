/**
 * 공공데이터포털 조달청 나라장터 사전규격정보서비스 (15129437)
 * 문서: https://www.data.go.kr/data/15129437/openapi.do
 * 서비스 URL(문서 기준): http://apis.data.go.kr/1230000/ao/HrcspSsstndrdInfoService
 * 404 시 https 로 변경해 볼 것.
 */
export const PROCUREMENT_PRE_SPEC_API_BASE =
  'http://apis.data.go.kr/1230000/ao/HrcspSsstndrdInfoService';

/**
 * 공공데이터포털 조달청 나라장터 입찰공고정보서비스 (본공고, 15129394)
 * - 활용명세/마이페이지 End Point: https://apis.data.go.kr/1230000/ad/BidPublicInfoService
 * - 테스트: npm run test:procurement
 */
export const PROCUREMENT_BID_API_BASES = [
  'https://apis.data.go.kr/1230000/ad/BidPublicInfoService',
] as const;

/** 하위 호환: 첫 번째 Base 사용 */
export const PROCUREMENT_BID_API_BASE = PROCUREMENT_BID_API_BASES[0];
