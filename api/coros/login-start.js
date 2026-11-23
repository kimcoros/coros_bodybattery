export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"method_not_allowed"});
  try{
    const origin=req.headers.origin;
    const host=req.headers["x-forwarded-host"]||req.headers.host;
    const proto=req.headers["x-forwarded-proto"]||"https";
    if(!host) return res.status(400).json({error:"missing_host"});
    const redirectUri=proto+"://"+host+"/oauth-callback.html";
    const reg=await fetch("https://mcp.coros.com/connect/register",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({client_name:"COROS Body Battery",redirect_uris:[redirectUri],grant_types:["authorization_code","refresh_token"],response_types:["code"],scope:"",token_endpoint_auth_method:"none"})});
    const client=await reg.json();
    if(!reg.ok||!client.client_id) return res.status(502).json({error:"client_registration_failed",detail:client.error||client.message||"COROS OAuth registration failed"});
    const login=await fetch("https://mcp.coros.com/api/v1/cli/login-sessions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({clientId:client.client_id})});
    const session=await login.json();
    if(!login.ok||!session.sessionId||!session.pollToken||!session.loginUrl) return res.status(502).json({error:"login_session_failed",detail:session.message||"COROS login session could not be created"});
    res.setHeader("Cache-Control","no-store");
    return res.status(200).json({clientId:client.client_id,redirectUri,sessionId:session.sessionId,pollToken:session.pollToken,loginUrl:session.loginUrl,intervalSeconds:session.intervalSeconds||3,expiresAt:session.expiresAt});
  }catch(e){return res.status(502).json({error:"coros_unavailable",detail:String(e.message||e)});}
}