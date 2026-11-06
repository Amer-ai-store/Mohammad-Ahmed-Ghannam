/* Private-by-device ChatGPT conversation link registry.
 * Links are not written to the public GitHub message issue.
 * Local storage proves local configuration only, not cross-project reachability.
 */
export const LINKS_STORAGE_KEY="amer.projectMessageHub.links.v1";
export const MAX_NODES=100,MAX_RELATIONS=500;
export function normalizeChatUrl(value){
  if(typeof value!=="string")throw Error("INVALID_URL");
  let url;
  try{url=new URL(value.trim());}catch{throw Error("INVALID_URL");}
  if(url.protocol!=="https:"||url.hostname!=="chatgpt.com"||url.username||url.password||url.port)throw Error("CHATGPT_LINK_ONLY");
  const path=url.pathname.replace(/\/+$/,"");
  if(!/^\/(?:(?:g|g-p)\/[A-Za-z0-9_-]+\/)?(?:c|share)\/[A-Za-z0-9-]+$/.test(path))throw Error("CHAT_LINK_REQUIRED");
  return "https://chatgpt.com"+path;
}
export function parseSideLinks(text,project){
  if(!["gpt","التقرير النهائي"].includes(project))throw Error("UNKNOWN_PROJECT");
  const lines=String(text||"").split(/[\n,]+/).map(s=>s.trim()).filter(Boolean);
  if(!lines.length||lines.length>MAX_NODES)throw Error("INVALID_LINK_COUNT");
  const entries=lines.map((raw,i)=>{
    const pivot=raw.indexOf("|");
    const title=pivot===-1?"محادثة "+(i+1):raw.slice(0,pivot).trim().slice(0,80);
    const link=pivot===-1?raw:raw.slice(pivot+1).trim();
    const url=normalizeChatUrl(link);
    return {key:project+"::"+url,project,url,title:title||"محادثة "+(i+1)};
  });
  return [...new Map(entries.map(e=>[e.key,e])).values()];
}
export function createLinkGraph(initial,left,right){
  if(left.some(n=>n.project!==left[0]?.project)||right.some(n=>n.project!==right[0]?.project))throw Error("MIXED_PROJECT");
  const nodes=[...(initial?.nodes||[])],edges=[...(initial?.edges||[])];
  const knownNodes=new Set(nodes.map(n=>n.key));
  for(const n of [...left,...right])if(!knownNodes.has(n.key)){nodes.push(n);knownNodes.add(n.key);}
  for(const a of left)for(const b of right){
    if(a.key===b.key)continue;
    const keys=[a.key,b.key].sort();
    const relationKey=JSON.stringify(keys);
    if(!edges.some(e=>e.id===relationKey))edges.push({id:relationKey,left:a.key,right:b.key,connected:false});
  }
  if(nodes.length>MAX_NODES||edges.length>MAX_RELATIONS)throw Error("LIMIT_EXCEEDED");
  return {schema:1,nodes,edges};
}
export function neighbors(graph,nodeKey){
  const items=(graph?.edges||[]).filter(e=>e.left===nodeKey||e.right===nodeKey).map(e=>e.left===nodeKey?e.right:e.left);
  return (graph?.nodes||[]).filter(n=>items.includes(n.key));
}
export function unlink(graph,relationId){
  return {...graph,edges:(graph.edges||[]).filter(e=>e.id!==relationId)};
}
export const EMPTY_GRAPH={schema:1,nodes:[],edges:[]};
export function loadLinkGraph(store){
  try{
    const data=JSON.parse(store.getItem(LINKS_STORAGE_KEY)||"null");
    if(!data||data.schema!==1||!Array.isArray(data.nodes)||!Array.isArray(data.edges))return {...EMPTY_GRAPH};
    if(data.nodes.length>MAX_NODES||data.edges.length>MAX_RELATIONS)return {...EMPTY_GRAPH};
    const nodes=data.nodes.filter(n=>["gpt","التقرير النهائي"].includes(n.project)&&typeof n.url==="string"&&typeof n.key==="string"&&typeof n.title==="string");
    const keys=new Set(nodes.map(n=>n.key));
    const edges=data.edges.filter(e=>keys.has(e.left)&&keys.has(e.right)&&typeof e.id==="string");
    return {schema:1,nodes,edges};
  }catch{return {...EMPTY_GRAPH};}
}
export function saveLinkGraph(store,graph){
  store.setItem(LINKS_STORAGE_KEY,JSON.stringify(graph));
}
