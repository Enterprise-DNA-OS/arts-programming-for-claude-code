#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { parseCsv } from './lib/csv.mjs';
import { table as textTable } from './lib/format.mjs';
import { page, table, writeOut } from './lib/render.mjs';

export const reads = {
 seasons:'select code,name,starts_on,ends_on from seasons order by starts_on,code',
 productions:'select p.code,p.name,s.code season,p.owner,p.territory,p.rights_context,p.review_due,p.status from productions p join seasons s on s.id=p.season_id order by p.code',
 works:'select code,name,creator,duration_seconds from works order by code',
 spaces:'select code,name,capacity,turnaround_minutes from spaces order by code',
 'season-review':`select p.code,p.name,p.owner,p.status,(select count(*)::int from sessions s where s.production_id=p.id and s.status<>'cancelled') calls,(select count(*)::int from programme_items i where i.production_id=p.id) works,(select count(*)::int from rights_gaps g where g.production=p.code) rights_gaps,(select count(*)::int from actions a where a.production_id=p.id and a.status='open') open_actions from productions p where p.status<>'closed' order by p.review_due,p.code`,
 repertoire:'select code,production,position,title,creator,duration_seconds,credit,decision from repertoire order by production,position',
 'rehearsal-call':`select code,production,kind,space,starts_at,ends_at,planned_people,status from call_sheet where status<>'cancelled' order by starts_at,code`,
 clashes:'select first_call,second_call,space,first_start,second_start,issue from schedule_clashes order by first_start,first_call',
 'rights-due':'select code,production,title,performance,starts_at,issue from rights_gaps order by starts_at,code',
 'actions-due':`select code,production,description,owner,due,overdue from action_register where status='open' order by due,code`,
 'credit-gaps':`select code,production,title,creator from repertoire where trim(credit)='' order by production,position`,
 'work-history':'select w.code,w.name,count(distinct i.production_id)::int productions,coalesce(sum(case when i.id is not null then w.duration_seconds else 0 end),0)::int programmed_seconds from works w left join programme_items i on i.work_id=w.id group by w.id order by w.code',
 'owner-workload':`select owner,count(*)::int open_actions,count(*) filter(where due<current_date)::int overdue from actions where status='open' group by owner order by overdue desc,owner`,
 'safety-gaps':`select code,production,space,kind,starts_at,revision from call_sheet where status<>'cancelled' and not safety_reviewed order by starts_at,code`,
 'capacity-check':`select code,production,space,planned_people,capacity from call_sheet where status<>'cancelled' and planned_people>capacity order by starts_at,code`,
 'programme-length':'select production,sum(duration_seconds)::int seconds,count(*)::int works from repertoire group by production order by production',
 compliance:'select * from compliance_findings order by rule,production,code',
 attention:'select * from compliance_findings order by rule,production,code',
 notes:'select p.code production,n.body,n.actor,n.created_at from notes n join productions p on p.id=n.production_id order by n.created_at',
 audit:'select entity,record_id,operation,actor,before_row,after_row,created_at from audit_log order by created_at,id',
 imports:'select id,filename,fingerprint,row_count,actor,created_at from import_batches order by created_at',
};
const commands = {
 'add-season':['code','name','starts','ends'],
 'add-production':['code','name','season','owner','territory','timezone','context','review-due'],
 'revise-production':['production','owner','context','status'],
 'add-work':['code','name','creator','seconds'],
 'add-space':['code','name','capacity','turnaround'],
 'add-programme':['code','production','work','position','credit'],
 'revise-programme':['item','credit','work'],
 'add-session':['code','production','space','kind','starts','ends','people','status'],
 'revise-session':['session','starts','ends','people','space','status'],
 'clear-rights':['item','decision','from','to','authority','evidence'],
 'review-safety':['session','evidence','consulted'],
 'add-action':['code','production','description','owner','due'],
 'complete-action':['action','evidence'],
 'set-review-date':['production','due'],
 'log':['production','body'],
 import:['kind','mapping','dry-run'], export:['out'],
 'weekly-review':[], 'draft-programme':['production'], 'draft-call':['production'],
 production:[], help:[],
};
export const commandNames=[...Object.keys(reads),...Object.keys(commands)];
function parse(argv){
 const pos=[],opts={};
 for(let i=0;i<argv.length;i++){
  const a=argv[i];
  if(a==='--help'){pos.push('help');continue;}
  if(!a.startsWith('--')){pos.push(a);continue;}
  const eq=a.indexOf('=');const key=a.slice(2,eq<0?undefined:eq);
  if(Object.hasOwn(opts,key))throw Error(`Duplicate option --${key}`);
  if(['json','dry-run'].includes(key)){if(eq>=0)throw Error(`Use --${key} without a value`);opts[key]=true;}
  else {const val=eq<0?argv[++i]:a.slice(eq+1);if(!val||val.startsWith('--'))throw Error(`Missing --${key} value`);opts[key]=val;}
 }
 return {pos,opts};
}
const required=(o,k)=>{if(typeof o[k]!=='string'||!o[k].trim())throw Error(`Required --${k}`);return o[k].trim();};
function int(v,label,min=0){if(!/^\d+$/.test(String(v))||!Number.isSafeInteger(Number(v))||Number(v)<min||Number(v)>2147483647)throw Error(`Invalid ${label}`);return Number(v);}
function date(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(v))||Number.isNaN(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error('Use a real YYYY-MM-DD date');return v;}
function instant(v){if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/.test(v))throw Error('Timestamp needs an explicit UTC offset');date(v.slice(0,10));if(Number.isNaN(Date.parse(v))||Number(v.slice(11,13))>23||Number(v.slice(14,16))>59||Number(v.slice(17,19))>59)throw Error('Invalid timestamp');return new Date(v).toISOString();}
const choice=(v,values)=>{if(!values.includes(v))throw Error(`Expected ${values.join('|')}`);return v;};
export async function resolve(db,entity,ref){
 if(!['seasons','productions','works','programme_items','spaces','sessions','actions'].includes(entity))throw Error('Unknown entity');
 if(!String(ref||'').trim())throw Error('Record reference is required');
 const cols=entity==='programme_items'?'credit':entity==='actions'?'description':['sessions'].includes(entity)?'code':'name';
 let rows=await db.query(`select * from ${entity} where lower(code)=lower($1) or id::text=$1`,[ref]);
 if(!rows.length)rows=await db.query(`select * from ${entity} where starts_with(lower(code),lower($1)) or starts_with(id::text,lower($1)) or strpos(lower(${cols}),lower($1))>0 order by code`,[ref]);
 if(rows.length!==1)throw Error(rows.length?`Ambiguous ${entity}: ${rows.map(r=>`${r.code} (${r.id})`).join(', ')}`:`No ${entity} match: ${ref}`);
 return rows[0];
}
async function insert(db,entity,values){const keys=Object.keys(values);return (await db.query(`insert into ${entity} (${keys.join(',')}) values (${keys.map((_,i)=>'$'+(i+1)).join(',')}) returning *`,Object.values(values)))[0];}
async function update(db,entity,id,values){const keys=Object.keys(values);return (await db.query(`update ${entity} set ${keys.map((k,i)=>k+'=$'+(i+1)).join(',')} where id=$${keys.length+1} returning *`,[...Object.values(values),id]))[0];}
export async function transact(db,actor,fn,dry=false){
 await db.exec('BEGIN');
 try{await db.query("select set_config('app.actor',$1,true)",[actor]);const out=await fn();await db.exec(dry?'ROLLBACK':'COMMIT');return out;}
 catch(e){await db.exec('ROLLBACK');throw e;}
}
async function mutate(db,cmd,o){
 const req=k=>required(o,k),id=async(t,k)=>(await resolve(db,t,req(k))).id;
 if(cmd==='add-season')return insert(db,'seasons',{code:req('code'),name:req('name'),starts_on:date(req('starts')),ends_on:date(req('ends'))});
 if(cmd==='add-production')return insert(db,'productions',{code:req('code'),name:req('name'),season_id:await id('seasons','season'),owner:req('owner'),territory:choice(req('territory'),['NZ','AU']),timezone:req('timezone'),rights_context:choice(o.context||'unknown',['unknown','dramatic','other']),review_due:date(req('review-due'))});
 if(cmd==='revise-production'){
  const p=await resolve(db,'productions',req('production')),v={};
  if(o.owner)v.owner=req('owner');if(o.context)v.rights_context=choice(o.context,['unknown','dramatic','other']);if(o.status)v.status=choice(o.status,['planned','confirmed','closed']);
  if(!Object.keys(v).length)throw Error('Supply an owner, context or status change');return update(db,'productions',p.id,v);
 }
 if(cmd==='add-work')return insert(db,'works',{code:req('code'),name:req('name'),creator:req('creator'),duration_seconds:int(req('seconds'),'seconds',1)});
 if(cmd==='add-space')return insert(db,'spaces',{code:req('code'),name:req('name'),capacity:int(req('capacity'),'capacity',1),turnaround_minutes:int(o.turnaround??30,'turnaround')});
 if(cmd==='add-programme')return insert(db,'programme_items',{code:req('code'),production_id:await id('productions','production'),work_id:await id('works','work'),position:int(req('position'),'position',1),credit:o.credit||''});
 if(cmd==='revise-programme'){
  const item=await resolve(db,'programme_items',req('item')),v={};
  if(o.credit!==undefined)v.credit=o.credit;if(o.work)v.work_id=await id('works','work');
  if(!Object.keys(v).length)throw Error('Supply a credit or work change');return update(db,'programme_items',item.id,v);
 }
 if(cmd==='add-session')return insert(db,'sessions',{code:req('code'),production_id:await id('productions','production'),space_id:await id('spaces','space'),kind:choice(req('kind'),['rehearsal','performance','get-in','get-out']),starts_at:instant(req('starts')),ends_at:instant(req('ends')),planned_people:int(req('people'),'people'),status:choice(o.status||'tentative',['tentative','confirmed','cancelled'])});
 if(cmd==='revise-session'){
  const s=await resolve(db,'sessions',req('session')),v={};
  if(o.starts)v.starts_at=instant(o.starts);if(o.ends)v.ends_at=instant(o.ends);if(o.people!==undefined)v.planned_people=int(o.people,'people');if(o.space)v.space_id=await id('spaces','space');if(o.status)v.status=choice(o.status,['tentative','confirmed','cancelled']);
  if(!Object.keys(v).length)throw Error('Supply a call change');return update(db,'sessions',s.id,v);
 }
 if(cmd==='clear-rights'){
  const item=await resolve(db,'programme_items',req('item'));const [p]=await db.query('select * from productions where id=$1',[item.production_id]);
  return insert(db,'clearances',{programme_item_id:item.id,item_revision:item.revision,production_territory:p.territory,production_context:p.rights_context,decision:choice(req('decision'),['approved','exempt','pending','revoked']),valid_from:date(req('from')),valid_to:date(req('to')),authority:req('authority'),evidence:req('evidence'),actor:req('actor')});
 }
 if(cmd==='review-safety'){
  const s=await resolve(db,'sessions',req('session'));return insert(db,'safety_reviews',{session_id:s.id,session_revision:s.revision,evidence:req('evidence'),consulted_with:req('consulted'),actor:req('actor')});
 }
 if(cmd==='add-action')return insert(db,'actions',{code:req('code'),production_id:await id('productions','production'),description:req('description'),owner:req('owner'),due:date(req('due'))});
 if(cmd==='complete-action')return update(db,'actions',await id('actions','action'),{status:'done',evidence:req('evidence')});
 if(cmd==='set-review-date')return update(db,'productions',await id('productions','production'),{review_due:date(req('due'))});
 if(cmd==='log')return insert(db,'notes',{production_id:await id('productions','production'),body:req('body'),actor:req('actor')});
 throw Error(`Unknown mutation: ${cmd}`);
}
const importKinds={sessions:'add-session',programme:'add-programme',works:'add-work',productions:'add-production',spaces:'add-space',seasons:'add-season'};
async function importArtifax(db,file,o){
 const kind=choice(required(o,'kind'),Object.keys(importKinds));
 const bytes=fs.readFileSync(file);const rows=parseCsv(bytes.toString('utf8'));
 if(!rows.length)throw Error('CSV has no data rows');
 const mapping=JSON.parse(fs.readFileSync(required(o,'mapping'),'utf8'));
 if(!mapping||typeof mapping!=='object'||Array.isArray(mapping))throw Error('Mapping must be an object of CLI field to CSV column');
 const allowed=commands[importKinds[kind]];
 for(const [key,column] of Object.entries(mapping)){
  if(!allowed.includes(key)||typeof column!=='string'||!Object.hasOwn(rows[0],column))throw Error(`Invalid mapping ${key}: ${column}`);
 }
 if(!mapping.code)throw Error('Mapping must include a stable source code');
 const fingerprint=createHash('sha256').update(bytes).update(JSON.stringify([kind,Object.entries(mapping).sort()])).digest('hex');
 if((await db.query('select id from import_batches where fingerprint=$1',[fingerprint])).length)return [{status:'unchanged',rows:rows.length,fingerprint}];
 const entity={sessions:'sessions',programme:'programme_items',works:'works',productions:'productions',spaces:'spaces',seasons:'seasons'}[kind];
 let added=0,unchanged=0;
 for(let i=0;i<rows.length;i++){
  const options={actor:required(o,'actor')};for(const [key,column] of Object.entries(mapping))options[key]=rows[i][column];
  // Exact repeated records are accepted across overlapping exports. Changed records require a reviewed revision.
  const existing=await db.query(`select * from ${entity} where lower(code)=lower($1)`,[required(options,'code')]);
  if(existing.length){
   // Validate and compare through a savepoint insertion using a temporary unique code.
   await db.exec('SAVEPOINT compare_import');
   try{
    if(kind==='programme')throw Error('Programme codes already exist; use the original complete file or import into a new production');
    const candidate=await mutate(db,importKinds[kind],{...options,code:`check-${createHash('sha256').update(options.code+fingerprint).digest('hex').slice(0,24)}`});
    const skip=new Set(['id','code','created_at','updated_at','revision']);
    const norm=v=>v instanceof Date?v.toISOString():v;
    for(const key of Object.keys(candidate))if(!skip.has(key)&&JSON.stringify(norm(candidate[key]))!==JSON.stringify(norm(existing[0][key])))throw Error(`Existing ${options.code} differs in ${key}; review with a revision command or import into a new workspace`);
    unchanged++;
   }finally{await db.exec('ROLLBACK TO SAVEPOINT compare_import');await db.exec('RELEASE SAVEPOINT compare_import');}
  }else{try{await mutate(db,importKinds[kind],options);added++;}catch(e){throw Error(`CSV row ${i+2}: ${e.message}`);}}
 }
 await insert(db,'import_batches',{fingerprint,filename:path.basename(file),source_base64:bytes.toString('base64'),mapping:JSON.stringify({kind,fields:mapping}),rows:JSON.stringify(rows),row_count:rows.length,actor:required(o,'actor')});
 return [{status:o['dry-run']?'dry-run':'imported',added,unchanged,rows:rows.length,fingerprint}];
}
const entities=['seasons','productions','works','programme_items','spaces','sessions','clearances','safety_reviews','actions','notes','import_batches','audit_log'];
async function exportAll(db,out){
 const destination=path.resolve(out);if(fs.existsSync(destination))throw Error('Export destination already exists');
 const data={};await db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 try{for(const t of entities)data[t]=await db.query(`select * from ${t} order by created_at,id`);await db.exec('COMMIT');}catch(e){await db.exec('ROLLBACK');throw e;}
 fs.mkdirSync(destination,{recursive:true,mode:0o700});
 for(const [name,rows] of Object.entries(data))fs.writeFileSync(path.join(destination,name+'.json'),JSON.stringify(rows,null,2)+'\n',{mode:0o600,flag:'wx'});
 fs.writeFileSync(path.join(destination,'manifest.json'),JSON.stringify({format:'arts-programming-archive-v1',created:new Date().toISOString(),counts:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,v.length]))},null,2),{mode:0o600,flag:'wx'});
 return [{directory:destination,collections:entities.length}];
}
export async function run(db,argv){
 const {pos,opts:o}=parse(argv);const cmd=pos.shift()||'help';
 if(!commandNames.includes(cmd))throw Error(`Unknown command ${cmd}. Run help.`);
 const allowed=[...(commands[cmd]||[]),'json',...(Object.keys(commands).includes(cmd)?['actor']:[])];
 for(const k of Object.keys(o))if(!allowed.includes(k))throw Error(`Unknown option --${k} for ${cmd}`);
 const n=cmd==='import'?2:cmd==='production'?1:0;if(pos.length!==n)throw Error(`${cmd} expects ${n} positional arguments`);
 if(cmd==='help')return commandNames.map(command=>({command,options:(commands[command]||[]).map(k=>'--'+k).join(' ')}));
 if(reads[cmd])return db.query(reads[cmd]);
 if(cmd==='production'){
  const p=await resolve(db,'productions',pos[0]);return [{...p,programme:await db.query('select * from repertoire where production_id=$1 order by position',[p.id]),calls:await db.query('select * from call_sheet where production_id=$1 order by starts_at',[p.id]),notes:await db.query('select body,actor,created_at from notes where production_id=$1 order by created_at',[p.id])}];
 }
 if(cmd==='export')return exportAll(db,required(o,'out'));
 if(cmd==='weekly-review'||cmd.startsWith('draft-')){
  const sections=[];
  if(cmd==='weekly-review'){for(const [title,query] of [['Season review',reads['season-review']],['Rights requiring follow-up',reads['rights-due']],['Clashes',reads.clashes],['Actions due',reads['actions-due']]])sections.push({title,html:table(await db.query(query))});}
  else {const p=await resolve(db,'productions',required(o,'production'));const query=cmd==='draft-programme'?'select position,title,creator,credit,duration_seconds from repertoire where production_id=$1 order by position':'select code,kind,space,starts_at,ends_at,planned_people,status from call_sheet where production_id=$1 order by starts_at';sections.push({title:p.name,html:table(await db.query(query,[p.id]))});}
  const file=writeOut('drafts',`${cmd}-${Date.now()}`,page({title:cmd==='weekly-review'?'Weekly programming review':cmd==='draft-programme'?'Draft programme credits':'Draft rehearsal calls',subtitle:'Internal draft. Times shown in UTC. Human review required before sharing.',sections}));return [{file}];
 }
 return transact(db,required(o,'actor'),async()=>{
  if(cmd==='import'){if(pos[0]!=='artifax')throw Error('Import source must be artifax');return importArtifax(db,pos[1],o);}
  return [await mutate(db,cmd,o)];
 },Boolean(o['dry-run']));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 let db;try{db=await getDb();const rows=await run(db,process.argv.slice(2));if(process.argv.includes('--json'))console.log(JSON.stringify(rows,null,2));else console.log(textTable(rows,Object.keys(rows[0]||{}).map(key=>({key,label:key,width:72,format:v=>v instanceof Date?v.toISOString():typeof v==='object'?JSON.stringify(v):v}))));}
 catch(e){console.error(e.message);process.exitCode=1;}finally{if(db)await db.close();}
}
