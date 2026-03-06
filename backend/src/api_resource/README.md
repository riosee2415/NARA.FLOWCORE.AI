# 공공데이터포털 API 리소스

- **사전규격**: `data.go.kr.ts` / `data.go.kr.json` — 조달청 나라장터 사전규격정보서비스
- **본공고(입찰공고)**: `data.go.kr-bid.ts` / `data.go.kr-bid.json` — 조달청 나라장터 입찰공고정보서비스

## 본공고 API 통신 참고 (15129394)

- **Base URL**: 문서 명세 `.../ad/BidPublicInfoService` 우선, 500 시 `.../BidPublicInfoService02` 자동 재시도
- **오퍼레이션**: `getBidPblancListInfoServc` (입찰공고목록 정보에 대한 용역조회)
- **필수 요청변수**: `serviceKey`, `inqryDiv`(1), `inqryBgnDt`, `inqryEndDt` (YYYYMMDDhhmm 12자), `pageNo`, `numOfRows`, `type`(json)
- 키워드는 수신 목록에서 클라이언트 필터.
- **활용신청**: [입찰공고정보서비스](https://www.data.go.kr/data/15129394) 활용신청 후 `DATA_GO_KR_BID_SERVICE_KEY` 사용.

## 테스트 (따로 실행)

- **사전규격만**: `npm run test:pre-spec`
- **본공고만**: `npm run test:bid`

공공데이터 429 완화를 위해 요청 간 300ms 대기 적용.
