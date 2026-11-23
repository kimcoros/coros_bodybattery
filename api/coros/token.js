export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"method_not_allowed"});
  const {grantType,clientId,code,redirectUri,codeVerifier,refreshToken}=req.body||{};
  if(typeof clientId!=="string") return res.status(400).json({error:"invalid_client"});
  const form=new URLSearchParams();
  form.set("client_id",clientId);
  if(grantType==="authorization_code"){
    if(!code||!redirectUri||!codeVerifier) return res.status(400).json({error:"missing_code_parameters"});
    form.set("grant_type","authorization_code");form.set("code",code);form.set("redirect_uri",redirectUri);form.set("code_verifier",codeVerifier);
  }else if(grantType==="refresh_token"){
    if(!refreshToken) return res.status(400).json({error:"missing_refresh_token"});
    form.set("grant_type","refresh_token");form.set("refresh_token",refreshToken);
  }else return res.status(400).json({error:"unsupported_grant_type"});
  try{
    const r=await fetch("https://mcp.coros.com/oauth2/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:form});
    const data=await r.json();res.setHeader("Cache-Control","no-store");
    return res.status(r.status).json(data);
  }catch(e){return res.status(502).json({error:"coros_unavailable",detail:String(e.message||e)});}
}