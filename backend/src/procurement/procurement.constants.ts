/** 공공데이터포털 조달청 나라장터 사전규격정보서비스 */
export const PROCUREMENT_PRE_SPEC_API_BASE =
  'https://apis.data.go.kr/1230000/ao/HrcspSsstndrdInfoService';

/**
 * 공공데이터포털 조달청 나라장터 입찰공고정보서비스 (본공고, 15129394)
 * - 활용명세/마이페이지 End Point: https://apis.data.go.kr/1230000/ad/BidPublicInfoService
 * - 테스트용 단순 스크립트(test-bid-simple.ts)도 동일 End Point 사용
 */
export const PROCUREMENT_BID_API_BASES = [
  'https://apis.data.go.kr/1230000/ad/BidPublicInfoService',
] as const;

/** 하위 호환: 첫 번째 Base 사용 */
export const PROCUREMENT_BID_API_BASE = PROCUREMENT_BID_API_BASES[0];
