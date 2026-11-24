const $=s=>document.querySelector(s);
const connectButton=$('#connect-coros');
const connectStatus=$('#connect-status');
const report=$('#report');
function setStatus(text){if(connectStatus)connectStatus.textContent=text;}
async function sha256(text){const bytes=new TextEncoder().encode(text);const hash=await crypto.subtle.digest('SHA-256',bytes);return btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');}
async function beginCorosLogin(){
  connectButton.disabled=true;setStatus('COROS 연결 정보를 준비하고 있어요…');
  try{
    const start=await fetch('/api/coros/login-start',{method:'POST'});const d=await start.json();if(!start.ok)throw Error(d.detail||d.error||'로그인을 시작하지 못했습니다.');
    sessionStorage.setItem('coros_client_id',d.clientId);sessionStorage.setItem('coros_redirect_uri',d.redirectUri);
    const verifier=Array.from(crypto.getRandomValues(new Uint8Array(48)),b=>b.toString(16).padStart(2,'0')).join('');
    const state=Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');
    sessionStorage.setItem('coros_pkce_verifier',verifier);sessionStorage.setItem('coros_oauth_state',state);
    const challenge=await sha256(verifier);
    window.open(d.loginUrl,'_blank','noopener');
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
  const r=await fetch('/api/coros/mcp',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+token,'accept':'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id,method,params})});
  const raw=await r.text();let data;
  try{data=JSON.parse(raw)}catch{
    const blocks=raw.split(/\\r?\\n/).filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trim());
    for(const block of blocks){try{data=JSON.parse(block);if(data?.result||data?.error)break}catch{}}
    if(!data)data={raw};
  }
  if(!r.ok)throw Error(data.error?.message||data.message||'COROS MCP 요청 실패 ('+r.status+')');
  if(data.error)throw Error(data.error.message||'COROS MCP 오류');
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
function textFromResult(result){
  if(result?.content){return result.content.map(c=>c.text||JSON.stringify(c)).join('\\n');}
  return JSON.stringify(result?.structuredContent??result??{},null,2);
}
function extractDisplay(text){
  try{return JSON.stringify(JSON.parse(text),null,2)}catch{return text}
}
async function loadCorosTools(){
  const token=await refreshIfNeeded();if(!token){setStatus('COROS 계정 연결이 필요합니다.');return;}
  try{
    await mcpRequest(token,'initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'coros-bodybattery',version:'0.2.0'}},1);
    const list=await mcpRequest(token,'tools/list',{},2);
    const tools=list.result?.tools||[];
    setStatus('COROS 연결 완료 · 데이터 도구 '+tools.length+'개 확인');
    if(connectButton)connectButton.textContent='COROS 다시 연결';
    report.textContent='COROS 실제 측정값을 불러오는 중입니다…';
    const wanted=[
      ['수면·일일 건강','queryDailyHealthData',{days:1}],
      ['수면 상세','querySleepOverview',{days:1}],
      ['수면 HRV','querySleepHrv',{days:1}],
      ['훈련 부하','queryTrainingLoadAssessment',{days:1}],
      ['안정시 심박수','queryRestingHeartRate',{days:1}],
      ['스트레스','queryStressLevel',{days:1}],
      ['회복 상태','queryRecoveryStatus',{}]
    ];
    const results=await Promise.all(wanted.map(async ([label,needle,args],i)=>{
      const tool=tools.find(t=>t.name===needle)||tools.find(t=>t.name.toLowerCase().includes(needle.toLowerCase()));
      if(!tool)return {label,error:'COROS 도구 목록에서 찾지 못했습니다.'};
      try{
        const schema=tool.inputSchema?.properties||{};
        const safeArgs={};for(const [k,v] of Object.entries(args)){if(Object.prototype.hasOwnProperty.call(schema,k))safeArgs[k]=v;}
        const response=await mcpRequest(token,'tools/call',{name:tool.name,arguments:safeArgs},10+i);
        if(response.result?.isError)throw Error(textFromResult(response.result));
        return {label,body:extractDisplay(textFromResult(response.result))};
      }catch(e){return {label,error:e.message};}
    }));
    const sections=results.map(x=>x.label+'\\n'+(x.error?'불러오기 실패: '+x.error:x.body)).join('\\n\\n────────────────\\n\\n');
    report.textContent='[실시간 COROS 원자료 · 점수 산출 전 검증]\n'+sections+'\\n\\n※ 현재는 원자료 연동 확인 단계입니다. 검증되지 않은 Body Battery 점수나 훈련 처방은 표시하지 않습니다.';
    setStatus('COROS 연결 완료 · 실제 데이터 조회 '+results.filter(x=>!x.error).length+'/'+results.length+'개 성공');
  }catch(e){setStatus('연결 확인 실패: '+e.message);report.textContent='인증은 저장됐지만 COROS 데이터 조회에 실패했습니다. '+e.message;}
}
if(connectButton)connectButton.addEventListener('click',beginCorosLogin);
if(new URLSearchParams(location.search).get('coros')==='connected'){history.replaceState({},'',location.pathname);loadCorosTools();}
else if(sessionStorage.getItem('coros_access_token'))loadCorosTools();
