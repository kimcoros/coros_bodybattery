# COROS Body Battery

개인 COROS 회복 대시보드 PWA. 정적 프런트엔드와 Vercel Functions로 COROS 공식 MCP OAuth 연결을 구성합니다.

## 현재 구현
- 모바일 우선 PWA 대시보드
- COROS OAuth device-login 시작 및 상태 확인
- PKCE authorization-code 교환 및 refresh token 교환
- COROS MCP JSON-RPC 프록시와 동적 도구 목록 확인
- OAuth 토큰은 서버 DB에 저장하지 않고 브라우저 탭의 sessionStorage에 보관합니다. 탭 세션이 종료되면 다시 연결해야 할 수 있습니다.
- 실제 측정값이 확인되기 전에는 Body Battery 점수나 훈련 처방을 임의로 생성하지 않습니다.

## 배포 요구사항
Vercel에 저장소 `kimcoros/coros_bodybattery`를 연결해 루트 디렉터리에서 배포해야 합니다. `api/coros/*.js`는 Vercel Functions로 실행됩니다. Git 연동을 위해 Vercel 계정에 GitHub Login Connection이 필요합니다.

## COROS OAuth 흐름
1. `POST /api/coros/login-start`: 공개 OAuth 클라이언트 등록 및 COROS CLI 로그인 세션 생성
2. 브라우저에서 COROS 로그인 URL 열기
3. `POST /api/coros/login-poll`: 로그인 승인 티켓 확인
4. PKCE S256 authorize 요청 후 `/oauth-callback.html`로 복귀
5. `POST /api/coros/token`: authorization code를 토큰으로 교환
6. `POST /api/coros/mcp`: MCP JSON-RPC initialize 및 tools/list 요청

MCP endpoint: https://mcp.coros.com/mcp

## 다음 구현 단계
- 실제 COROS MCP tools/list 응답으로 수면, HRV, 훈련 부하, 안정시 심박수, 스트레스, 회복 데이터 도구와 필드 확인
- 일별 데이터 수집 및 단위/기준값 정규화
- 검증된 데이터가 있을 때만 Body Battery 산식과 아침/저녁 훈련 권고 표시
- OAuth flow와 Vercel 배포 URL에서 end-to-end 테스트

## References
- COROS MCP guide: https://support.coros.com/hc/en-us/articles/53181619102996-Build-on-COROS-MCP
- Official MCP repo: https://github.com/coroslab/COROS-MCP
