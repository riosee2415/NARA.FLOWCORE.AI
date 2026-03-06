/**
 * 조달청 나라장터 입찰공고정보서비스(본공고) API 오퍼레이션 목록
 * 공공데이터포털 기준 - https://www.data.go.kr/data/15129394
 */
export interface DataGoKrBidOperation {
  no: number;
  name: string;
  path: string;
  description: string;
  dailyLimit: number;
  status: string;
}

export const DATA_GO_KR_BID_OPERATIONS: DataGoKrBidOperation[] = [
  {
    no: 1,
    name: '입찰공고목록 정보에 대한 공사조회',
    path: '/getBidPblancListInfoCnstwk',
    description:
      '검색조건에 등록일시, 입찰공고번호, 변경일시를 입력하여 나라장터의 입찰공고번호, 공고명, 발주기관, 수요기관, 계약체결방법명 등 공사부분의 입찰공고정보를 조회함',
    dailyLimit: 1000,
    status: '확인',
  },
  {
    no: 2,
    name: '입찰공고목록 정보에 대한 용역조회',
    path: '/getBidPblancListInfoServc',
    description:
      '검색조건에 등록일시, 입찰공고번호, 변경일시를 입력하여 나라장터의 입찰공고번호, 공고명, 발주기관, 수요기관, 계약체결방법명 등 용역부분의 입찰공고정보를 조회함',
    dailyLimit: 1000,
    status: '확인',
  },
  {
    no: 3,
    name: '입찰공고목록 정보에 대한 외자조회',
    path: '/getBidPblancListInfoFrgcpt',
    description:
      '검색조건에 등록일시, 입찰공고번호, 변경일시를 입력하여 나라장터의 입찰공고번호, 공고명, 발주기관, 수요기관, 계약체결방법명 등 외자부분의 입찰공고정보를 조회함',
    dailyLimit: 1000,
    status: '확인',
  },
  {
    no: 4,
    name: '입찰공고목록 정보에 대한 물품조회',
    path: '/getBidPblancListInfoThng',
    description:
      '검색조건에 등록일시, 입찰공고번호, 변경일시를 입력하여 나라장터의 입찰공고번호, 공고명, 발주기관, 수요기관, 계약체결방법명 등 물품부분의 입찰공고정보를 조회함',
    dailyLimit: 1000,
    status: '확인',
  },
  {
    no: 5,
    name: '입찰공고목록 정보에 대한 물품기초금액조회',
    path: '/getBidPblancListInfoThngBsisAmount',
    description:
      '검색조건에 기초금액 등록일시, 입찰공고번호를 입력하여 입찰공고번호, 입찰공고명, 기초금액, 기초금액공개일시, 예비가격범위시작율, 평가기준금액, 난이도계수, 기타경비기준율 등 물품의 기초금액정보 조회',
    dailyLimit: 1000,
    status: '확인',
  },
  {
    no: 6,
    name: '입찰공고목록 정보에 대한 공사기초금액조회',
    path: '/getBidPblancListInfoCnstwkBsisAmount',
    description:
      '검색조건에 기초금액 등록일시, 입찰공고번호를 입력하여 입찰공고번호, 입찰공고명, 기초금액, 기초금액공개일시, 예비가격범위시작율, 평가기준금액, 난이도계수, 기타경비기준율 등의 공사의 기초금액정보 조회',
    dailyLimit: 1000,
    status: '확인',
  },
  {
    no: 7,
    name: '입찰공고목록 정보에 대한 용역기초금액조회',
    path: '/getBidPblancListInfoServcBsisAmount',
    description:
      '검색조건에 기초금액 등록일시, 입찰공고번호를 입력하여 입찰공고번호, 입찰공고명, 기초금액, 기초금액공개일시, 예비가격범위시작율, 평가기준금액, 난이도계수, 기타경비기준율 등의 용역의 기초금액정보 조회',
    dailyLimit: 1000,
    status: '확인',
  },
  {
    no: 8,
    name: '입찰공고목록 정보에 대한 물품변경이력조회',
    path: '/getBidPblancListInfoChgHstryThng',
    description:
      '검색조건에 변경일시, 입찰공고번호를 입력하여 변경된 입찰공고번호, 입찰공고차수, 입찰분류번호, 재입찰번호, 변경항목명, 변경전후값 등 물품 입찰공고변경 데이터 조회',
    dailyLimit: 1000,
    status: '확인',
  },
  {
    no: 9,
    name: '입찰공고목록 정보에 대한 공사변경이력조회',
    path: '/getBidPblancListInfoChgHstryCnstwk',
    description:
      '검색조건에 변경일시, 입찰공고번호를 입력하여 변경된 입찰공고번호, 입찰공고차수, 입찰분류번호, 재입찰번호, 변경항목명, 변경전후값 등 공사 입찰공고변경 데이터 조회',
    dailyLimit: 1000,
    status: '확인',
  },
  {
    no: 10,
    name: '입찰공고목록 정보에 대한 용역변경이력조회',
    path: '/getBidPblancListInfoChgHstryServc',
    description:
      '검색조건에 변경일시, 입찰공고번호를 입력하여 변경된 입찰공고번호, 입찰공고차수, 입찰분류번호, 재입찰번호, 변경항목명, 변경전후값 등 용역 입찰공고변경 데이터 조회',
    dailyLimit: 1000,
    status: '확인',
  },
  {
    no: 11,
    name: '나라장터검색조건에 의한 입찰공고공사조회',
    path: '/getBidPblancListInfoCnstwkPPSSrch',
    description:
      '검색조건에 공고게시일시, 개찰일시 범위, 공고기관, 수요기관, 참조번호 등을 입력하여 나라장터의 입찰공고번호, 공고명, 발주기관, 수요기관, 계약체결방법명 등 공사부분의 입찰공고정보를 조회함',
    dailyLimit: 1000,
    status: '확인',
  },
  {
    no: 12,
    name: '나라장터검색조건에 의한 입찰공고용역조회',
    path: '/getBidPblancListInfoServcPPSSrch',
    description:
      '검색조건에 공고게시일시, 개찰일시 범위, 공고기관, 수요기관, 참조번호 등을 입력하여 나라장터의 입찰공고번호, 공고명, 발주기관, 수요기관, 계약체결방법명 등 용역부분의 입찰공고정보를 조회함',
    dailyLimit: 1000,
    status: '확인',
  },
  {
    no: 13,
    name: '나라장터검색조건에 의한 입찰공고외자조회',
    path: '/getBidPblancListInfoFrgcptPPSSrch',
    description:
      '검색조건에 공고게시일시, 개찰일시 범위, 공고기관, 수요기관, 참조번호 등을 입력하여 나라장터의 입찰공고번호, 공고명, 발주기관, 수요기관, 계약체결방법명 등 외자부분의 입찰공고정보를 조회함',
    dailyLimit: 1000,
    status: '확인',
  },
  {
    no: 14,
    name: '나라장터검색조건에 의한 입찰공고물품조회',
    path: '/getBidPblancListInfoThngPPSSrch',
    description:
      '검색조건에 공고게시일시, 개찰일시 범위, 공고기관, 수요기관, 참조번호 등을 입력하여 나라장터의 입찰공고번호, 공고명, 발주기관, 수요기관, 계약체결방법명 등 물품부분의 입찰공고정보를 조회함',
    dailyLimit: 1000,
    status: '확인',
  },
  {
    no: 15,
    name: '입찰공고목록 정보에 대한 면허제한정보조회',
    path: '/getBidPblancListInfoLicenseLimit',
    description:
      '검색조건에 등록일시범위(통합입찰공고)와 입찰공고번호를 입력하여 입찰공고번호, 입찰공고차수, 제한그룹번호, 제한순번, 면허제한명, 허용업종목록, 등록일시를 포함한 면허제한정보 조회',
    dailyLimit: 1000,
    status: '확인',
  },
  {
    no: 16,
    name: '입찰공고목록 정보에 대한 참가가능지역정보조회',
    path: '/getBidPblancListInfoPrtcptPsblRgn',
    description:
      '검색조건에 등록일시범위(통합입찰공고)와 입찰공고번호를 입력하여 입찰공고번호, 입찰공고차수, 제한그룹번호, 참가가능지역명, 등록일시 등 참가가능지역정보조회',
    dailyLimit: 1000,
    status: '확인',
  },
  {
    no: 17,
    name: '입찰공고목록 정보에 대한 물품 구매대상물품조회',
    path: '/getBidPblancListInfoThngPurchsObjPrdct',
    description:
      '검색조건에 등록일시범위(통합입찰공고)와 입찰공고번호를 입력하여 입찰공고번호, 입찰공고차수, 입찰분류번호, 물품순번, 수요기관코드, 수요기관명, 물품분류번호, 품명, 세부품명번호, 세부품명, 수량, 단위, 단가, 납품기한일시, 납품일수, 납품장소, 인도조건명 등 물품 구매대상물품 정보 조회',
    dailyLimit: 1000,
    status: '확인',
  },
  {
    no: 18,
    name: '입찰공고목록 정보에 대한 용역 구매대상물품조회',
    path: '/getBidPblancListInfoServcPurchsObjPrdct',
    description:
      '검색조건에 등록일시범위(통합입찰공고)와 입찰공고번호를 입력하여 입찰공고번호, 입찰공고차수, 입찰분류번호, 물품순번, 수요기관코드, 수요기관명, 물품분류번호, 품명, 세부품명번호, 세부품명, 수량, 단위, 단가, 납품기한일시, 납품일수, 납품장소, 인도조건명 등 용역 구매대상물품 정보 조회',
    dailyLimit: 1000,
    status: '확인',
  },
  {
    no: 19,
    name: '입찰공고목록 정보에 대한 외자 구매대상물품조회',
    path: '/getBidPblancListInfoFrgcptPurchsObjPrdct',
    description:
      '검색조건에 등록일시범위(통합입찰공고)와 입찰공고번호를 입력하여 입찰공고번호, 입찰공고차수, 입찰분류번호, 물품순번, 수요기관코드, 수요기관명, HSK번호, 세부품명번호, 세부품명, 수량, 단위, 배정금액, 배정금액통화 등 외자 구매대상물품 정보 조회',
    dailyLimit: 1000,
    status: '확인',
  },
  {
    no: 20,
    name: '입찰공고목록 정보에 대한 e발주 첨부파일정보조회',
    path: '/getBidPblancListInfoEorderAtchFileInfo',
    description:
      '검색조건에 등록일시범위(통합입찰공고)와 입찰공고번호를 입력하여 입찰공고번호, 입찰공고차수, 첨부순번, e발주문서구분명, e발주첨부파일명, e발주첨부파일URL 정보 조회',
    dailyLimit: 1000,
    status: '확인',
  },
  {
    no: 21,
    name: '입찰공고목록 정보에 대한 기타공고조회',
    path: '/getBidPblancListInfoEtc',
    description:
      '검색조건에 등록일시, 입찰공고번호를 입력하여 나라장터의 입찰공고번호, 공고명, 발주기관, 수요기관, 계약체결방법명 등 기타공고정보를 조회',
    dailyLimit: 1000,
    status: '확인',
  },
  {
    no: 22,
    name: '나라장터검색조건에 의한 입찰공고 기타조회',
    path: '/getBidPblancListInfoEtcPPSSrch',
    description:
      '검색조건에 공고게시일시, 개찰일시 범위, 공고기관, 수요기관, 참조번호 등을 입력하여 나라장터의 입찰공고번호, 공고명, 발주기관, 수요기관, 계약체결방법명 등 입찰공고정보를 조회함',
    dailyLimit: 1000,
    status: '확인',
  },
  {
    no: 23,
    name: '입찰공고목록 정보에 대한 혁신장터 최종제안요청서 교부 첨부파일정보조회',
    path: '/getBidPblancListPPIFnlRfpIssAtchFileInfo',
    description:
      '낙찰자결정방법이 [경쟁적 대화에 의한 낙찰자 선정 낙찰방법] 일경우 검색조건에 등록일시, 입찰공고번호, 교부일시를 입력하여 혁신장터에서 교부된 최종제안요청서 첨부파일정보를 조회함',
    dailyLimit: 1000,
    status: '확인',
  },
  {
    no: 24,
    name: '입찰공고목록 정보에 대한 입찰가격산식A정보조회',
    path: '/getBidPblancListBidPrceCalclAInfo',
    description:
      '검색조건에 공고게시일시와 입찰공고번호를 입력하여 입찰가격산식 A값 적용 공고의 합산항목인 국민연금보험료, 국민건강보험료, 퇴직공제부금비, 노인장기요양보험료, 산업안전보건관리비, 안전관리비, 품질관리비, 품질관리비 적용대상여부등 입찰가격산식A정보 조회',
    dailyLimit: 1000,
    status: '확인',
  },
  {
    no: 25,
    name: '입찰공고목록 정보에 대한 평가대상 주력분야 조회',
    path: '/getBidPblancListEvaluationIndstrytyMfrcInfo',
    description:
      '검색조건에 등록일시와 입찰공고번호를 입력하여 입찰 평가대상주력분야의 건산법적용여부, 건설업역상호진출가능여부, 건설업역구분코드, 낙찰자선정적용기준코드, 공종유형명, 공사대상업종명, 업종주력분야명, 추정금액, 추정가격, 부가가치세, 평가비율을 조회',
    dailyLimit: 1000,
    status: '확인',
  },
];
