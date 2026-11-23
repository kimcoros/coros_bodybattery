export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"method_not_allowed"});
  const {sessionId,pollToken}=req.body||{};
  if(typeof sessionId!=="string"||typeof pollToken!=="string") return res.status(400).json({error:"invalid_request"});
  try{
    const r=await fetch("https://mcp.coros.com/api/v1/cli/login-sessions/"+encodeURIComponent(sessionId)+"/claim",{method:"POST",headers:{"X-Poll-Token":pollToken,"content-type":"application/json"}});
    const data=await r.json();
    res.setHeader("Cache-Control","no-store");
    if(!r.ok) return res.status(r.status).json({error:"claim_failed",detail:data.message||data.error||"Login status unavailable"});
    return res.status(200).json(data);
  }catch(e){return res.status(502).json({error:"coros_unavailable",detail:String(e.message||e)});}
}