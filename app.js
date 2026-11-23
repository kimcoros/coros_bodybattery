const $=s=>document.querySelector(s);
const connectButton=$('#connect-coros');
const connectStatus=$('#connect-status');
const report=$('#report');
function setStatus(text){if(connectStatus)connectStatus.textContent=text;}
async function sha256(text){const bytes=new TextEncoder().encode(text);const hash=await crypto.subtle.digest('SHA-256',bytes);return btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
async function beginCorosLogin(){
  connectButton.disabled=true;setStatus('COROS 연결 정보를 준비하고 있어요…');
  try{
    const start=await fetch('/api/coros/login-start',{method:'POST'});const d=await start.json();if(!start.ok)throw Error(d.detail||d.error||'로그인을 시작하지 못했습니다.');
    sessionStorage.setItem('coros_client_id',d.clientId);sessionStorage.setItem('coros_redirect_uri',d.redirectUri);
    const verifier=Array.from(crypto.getRandomValues(new Uint8Array(48)),b=>b.toString(16).padStart(2,'0')).join('');
    const state=Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');
    sessionStorage.setItem('coros_pkce_verifier',verifier);sessionStorage.setItem('coros_oauth_state',state);
    const challenge=await sha256(verifier);
    const loginWindow=window.open(d.loginUrl,'_blank','noopener');
    setStatus('새 창에서 COROS 로그인을 완료해 주세요. 이 화면은 그대로 두세요.');
    let ticket=null;const deadline=Date.now()+4*60*1000;
    while(Date.now()<deadline){
      await new Promise(r=>setTimeout(r,Math.max(2000,(d.intervalSeconds||3)*1000)));
      const p=await fetch('/api/coros/login-poll',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionId:d.sessionId,pollToken:d.pollToken})});
      const status=await p.json();if(status.status==='authorized'&&status.loginTicket){ticket=status.loginTicket;break;}
      if(status.status==='failed'||status.status==='expired')throw Error('COROS 로그인이 만료되었거나 거절되었습니다.');
      if(!p.ok&&status.status!=='pending')throw Error(status.detail||'로그인 상태를 확인하지 못했습니다.');
    }
    if(!ticket)throw Error('로그인 대기 시간이 초과되었습니다. 다시 시도해 주세요.');
    setStatus('COROS 인증을 마무리하고 있어요…');
    const auth=new URL('https://mcp.coros.com/oauth2/authorize');
    auth.searchParams.set('response_type','code');auth.searchParams.set('client_id',d.clientId);auth.searchParams.set('redirect_uri',d.redirectUri);auth.searchParams.set('scope','openid offline_access mcp.tools');auth.searchParams.set('resource','https://mcp.coros.com/mcp');auth.searchParams.set('code_challenge',challenge);auth.searchParams.set('code_challenge_method','S256');auth.searchParams.set('state',state);auth.searchParams.set('login_ticket',ticket);
    location.href=auth.toString();
  }catch(e){setStatus('연결 실패: '+e.message);connectButton.disabled=false;}
}
async function mcpRequest(token,method,params,id){
  const r=await fetch('/api/coros/mcp',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+token},body:JSON.stringify({jsonrpc:'2.0',id,method,params})});
  const raw=await r.text();let data;try{data=JSON.parse(raw)}catch{data={raw}};
  if(!r.ok)throw Error(data.error?.message||data.message||'COROS MCP 요청 실패 ('+r.status+')');
  return data;
}
async function refreshIfNeeded(){
  let token=sessionStorage.getItem('coros_access_token');const expiry=Number(sessionStorage.getItem('coros_token_expiry')||0);
  if(!token)return null;
  if(expiry&&Date.now()>expiry-120000){
    const refresh=sessionStorage.getItem('coros_refresh_token');if(!refresh)return null;
    const r=await fetch('/api/coros/token',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({grantType:'refresh_token',clientId:sessionStorage.getItem('coros_client_id'),refreshToken:refresh})});
    const t=await r.json();if(!r.ok||!t.access_token)throw Error('COROS 재인증이 필요합니다.');
    token=t.access_token;sessionStorage.setItem('coros_access_token',token);if(t.refresh_token)sessionStorage.setItem('coros_refresh_token',t.refresh_token);sessionStorage.setItem('coros_token_expiry',String(Date.now()+(Number(t.expires_in)||2592000)*1000));
  }
  return token;
}
async function loadCorosTools(){
  const token=await refreshIfNeeded();if(!token){setStatus('COROS 계정 연결이 필요합니다.');return;}
  try{
    await mcpRequest(token,'initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'coros-bodybattery',version:'0.1.0'}},1);
    const list=await mcpRequest(token,'tools/list',{},2);
    const tools=list.result?.tools||[];
    setStatus('COROS 연결 완료 · 데이터 도구 '+tools.length+'개 확인');
    report.textContent='COROS 계정 인증이 완료되었습니다. 현재 사용 가능한 데이터 도구 '+tools.length+'개를 확인했습니다. 실제 수면·HRV·훈련 부하 필드의 응답 구조를 확인한 뒤 점수 계산을 연결합니다.';
    if(connectButton)connectButton.textContent='COROS 다시 연결';
  }catch(e){setStatus('연결 확인 실패: '+e.message);report.textContent='인증은 저장됐지만 COROS 데이터 도구 확인에 실패했습니다. 다시 연결하거나 잠시 후 새로고침해 주세요.';}
}
if(connectButton)connectButton.addEventListener('click',beginCorosLogin);
if(new URLSearchParams(location.search).get('coros')==='connected'){history.replaceState({},'',location.pathname);loadCorosTools();}
else if(sessionStorage.getItem('coros_access_token'))loadCorosTools();
