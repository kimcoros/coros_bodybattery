export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"method_not_allowed"});
  const auth=req.headers.authorization||"";
  if(!auth.startsWith("Bearer ")) return res.status(401).json({error:"missing_bearer_token"});
  try{
    const r=await fetch("https://mcp.coros.com/mcp",{method:"POST",headers:{"authorization":auth,"content-type":"application/json","accept":"application/json, text/event-stream"},body:JSON.stringify(req.body||{})});
    const body=await r.text();res.status(r.status);res.setHeader("Cache-Control","no-store");
    res.setHeader("content-type",r.headers.get("content-type")||"application/json");
    return res.send(body);
  }catch(e){return res.status(502).json({error:"coros_unavailable",detail:String(e.message||e)});}
}