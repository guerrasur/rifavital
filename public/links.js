export const normalizeBuyerName=name=>String(name||"").trim().replace(/\s+/g," ").toLocaleLowerCase("es");

export function buyerGroups(tickets){
  const groups=new Map();
  for(const [number,data] of tickets){
    const key=normalizeBuyerName(data.ownerName);
    if(!key||!/^[a-f0-9]{48}$/.test(data.certificateId||""))continue;
    if(!groups.has(key))groups.set(key,{name:data.ownerName.trim(),tickets:[]});
    groups.get(key).tickets.push({number,certificateId:data.certificateId});
  }
  return Array.from(groups.values()).map(group=>({...group,tickets:group.tickets.sort((a,b)=>a.number-b.number)}));
}

export function buyerUrl(origin,tickets){
  return `${origin}/tus-rifas#ids=${tickets.map(t=>t.certificateId).join(",")}`;
}

export function parseBuyerTokens(hash){
  const value=new URLSearchParams(hash.replace(/^#/,"")).get("ids")||"";
  const tokens=[...new Set(value.split(",").map(token=>token.trim().toLowerCase()))];
  return tokens.length<=150&&tokens.every(token=>/^[a-f0-9]{48}$/.test(token))?tokens:[];
}
