import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { seed } from './seed.mjs';
import { run, reads, resolve, commandNames } from './arts.mjs';
import { parseCsv } from './lib/csv.mjs';
import { page, table } from './lib/render.mjs';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'arts-test-'));
process.env.DATABASE_URL=process.env.ARTS_TEST_POSTGRES_URL||'';
process.env.DATA_DIR=path.join(tmp,'db');
process.env.OUTPUT_DIR=path.join(tmp,'reports');
const db=await getDb();let checks=0;
const ok=(v,msg)=>{assert.ok(v,msg);checks++;};
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const reject=async(args,pattern)=>{await assert.rejects(()=>run(db,args),pattern);checks++;};
const invoke=(cmd,o={},pos=[])=>run(db,[cmd,...pos,...Object.entries(o).map(([k,v])=>v===true?'--'+k:'--'+k+'='+v)]);
const write=(cmd,o)=>invoke(cmd,{...o,actor:'Test operator'});
try{
 eq((await migrate(db)).ran.length,1);eq((await migrate(db)).ran.length,0);
 await seed(db);const [before]=await db.query('select count(*)::int n from audit_log');await seed(db);eq((await db.query('select count(*)::int n from audit_log'))[0],before);
 for(const cmd of Object.keys(reads))ok(Array.isArray(await invoke(cmd)),cmd);
 eq((await invoke('programme-length'))[0].seconds,600);
 eq((await invoke('rights-due')).length,2);
 eq((await invoke('clashes')).length,2);
 eq((await invoke('capacity-check')).length,1);
 eq((await invoke('safety-gaps')).length,3);
 eq((await invoke('credit-gaps')).length,1);
 ok((await invoke('compliance')).some(x=>x.rule==='R05'));
 eq((await resolve(db,'productions','returning')).code,'TIDE');
 eq((await resolve(db,'productions','tide')).code,'TIDE');
 const production=(await invoke('production',{},['TIDE']))[0];eq(production.programme.length,2);
 const show=(await db.query("select * from sessions where code='TIDE-SHOW'"))[0];
 const start=new Date(show.starts_at).toISOString().slice(0,10),end=new Date(new Date(show.ends_at).valueOf()+86400000).toISOString().slice(0,10);
 await write('clear-rights',{item:'TIDE-01',decision:'approved',from:start,to:end,authority:'Fictional publisher',evidence:'Current signed licence'});
 eq((await invoke('rights-due')).length,1);
 await write('clear-rights',{item:'TIDE-01',decision:'revoked',from:start,to:end,authority:'Publisher',evidence:'Withdrawal'});
 eq((await invoke('rights-due')).length,2);
 await write('clear-rights',{item:'TIDE-01',decision:'approved',from:start,to:end,authority:'Publisher',evidence:'Replacement licence'});
 await write('revise-programme',{item:'TIDE-01',credit:'New version credit'});
 ok((await invoke('rights-due')).some(r=>r.code==='TIDE-01'&&r.issue.includes('earlier')));
 await write('review-safety',{session:'TIDE-SHOW',evidence:'Risk controls checked',consulted:'Venue and stage crew'});
 eq((await invoke('safety-gaps')).length,2);
 await write('revise-session',{session:'TIDE-SHOW',people:'70'});
 eq((await invoke('capacity-check')).length,0);eq((await invoke('safety-gaps')).length,3);
 await write('revise-session',{session:'WINTER-REH',status:'cancelled'});eq((await invoke('clashes')).length,1);
 await write('add-season',{code:'TEST-SEASON',name:'Future programme',starts:'2030-01-01',ends:'2030-12-31'});
 await write('add-production',{code:'TEST-P',name:'Tide Workshop',season:'TEST-SEASON',owner:'Rae',territory:'AU',timezone:'Australia/Perth',context:'other','review-due':'2030-02-01'});
 await assert.rejects(()=>resolve(db,'productions','ti'),/Ambiguous.*TIDE.*TEST-P|Ambiguous.*TEST-P.*TIDE/);checks++;
 await write('revise-production',{production:'TEST-P',owner:'New owner',context:'dramatic',status:'confirmed'});
 eq((await resolve(db,'productions','TEST-P')).status,'confirmed');
 await write('add-work',{code:'TEST-W',name:'Work <script>alert(1)</script>',creator:'Author',seconds:'120'});
 await write('add-space',{code:'TEST-R',name:'Room',capacity:'10',turnaround:'15'});
 await write('add-programme',{code:'TEST-I',production:'TEST-P',work:'TEST-W',position:'1',credit:'Author credit'});
 await write('add-session',{code:'TEST-S',production:'TEST-P',space:'TEST-R',kind:'performance',starts:'2030-02-01T23:30:00+08:00',ends:'2030-02-02T00:30:00+08:00',people:'8'});
 await write('clear-rights',{item:'TEST-I',decision:'exempt',from:'2030-02-01',to:'2030-02-01',authority:'Rights reviewer',evidence:'Test only'});
 ok((await invoke('rights-due')).some(r=>r.code==='TEST-I'&&r.issue.includes('dates')));
 await write('add-action',{code:'TEST-A',production:'TEST-P',description:'Review credits',owner:'Rae',due:'2030-01-10'});
 await write('complete-action',{action:'TEST-A',evidence:'Reviewed'});
 await write('set-review-date',{production:'TIDE',due:'2030-01-01'});
 await write('log',{production:'TIDE',body:'Reviewed with the stage team'});
 await reject(['add-work','--code=X'],/actor/);
 await reject(['seasons','--extra=x'],/Unknown option/);
 await reject(['seasons','unexpected'],/positional/);
 await reject(['add-season','--actor=X','--code=BAD','--name=Invalid','--starts=2030-02-30','--ends=2030-03-01'],/real/);
 await reject(['add-session','--actor=X','--code=BAD','--production=TIDE','--space=STUDIO','--kind=rehearsal','--starts=2030-02-01T12:00','--ends=2030-02-01T13:00Z','--people=1'],/offset/);
 await reject(['add-space','--actor=X','--code=BAD','--name=Invalid','--capacity=2.5'],/Invalid/);
 await reject(['complete-action','--actor=X','--action=A-RIGHTS'],/evidence/);
 await assert.rejects(()=>db.query("delete from notes"),/history/);checks++;
 await assert.rejects(()=>db.query("update audit_log set actor='changed'"),/history/);checks++;
 await assert.rejects(()=>db.query("insert into works(code,name,creator,duration_seconds) values('RAW','X','Y',1)"),/Named actor/);checks++;
 // Exactly the recorded turnaround is allowed; one minute less is flagged.
 await write('add-session',{code:'BOUND-A',production:'TEST-P',space:'TEST-R',kind:'rehearsal',starts:'2030-03-02T08:00:00Z',ends:'2030-03-02T09:00:00Z',people:'2'});
 await write('add-session',{code:'BOUND-B',production:'TEST-P',space:'TEST-R',kind:'rehearsal',starts:'2030-03-02T09:15:00Z',ends:'2030-03-02T10:00:00Z',people:'2'});
 ok(!(await invoke('clashes')).some(r=>r.first_call==='BOUND-A'));
 await write('revise-session',{session:'BOUND-B',starts:'2030-03-02T09:14:00Z'});
 ok((await invoke('clashes')).some(r=>r.first_call==='BOUND-A'&&r.second_call==='BOUND-B'));
 // Exercise all six import kinds, including linked programme records.
 const importsToCheck=[
  ['seasons',{code:'IMP-SEASON',name:'Imported season',starts:'2030-01-01',ends:'2030-12-31'}],
  ['spaces',{code:'IMP-SPACE',name:'Imported room',capacity:'25',turnaround:'10'}],
  ['productions',{code:'IMP-PROD',name:'Imported production',season:'IMP-SEASON',owner:'Importer',territory:'NZ',timezone:'Pacific/Auckland',context:'other','review-due':'2030-02-01'}],
  ['programme',{code:'IMP-ITEM',production:'IMP-PROD',work:'TEST-W',position:'1',credit:'Approved credit'}]
 ];
 for(const [kind,record] of importsToCheck){
  const importFile=path.join(tmp,kind+'.csv'),mapFile=path.join(tmp,kind+'.json');
  const keys=Object.keys(record);fs.writeFileSync(importFile,keys.join(',')+'\n'+Object.values(record).join(',')+'\n');fs.writeFileSync(mapFile,JSON.stringify(Object.fromEntries(keys.map(k=>[k,k]))));
  eq((await invoke('import',{kind,mapping:mapFile,actor:'Importer'},['artifax',importFile]))[0].added,1);
 }
 const mapping=path.join(tmp,'map.json');fs.writeFileSync(mapping,JSON.stringify({code:'Work ID',name:'Title',creator:'Creator',seconds:'Duration'}));
 const csv=path.join(tmp,'works.csv');fs.writeFileSync(csv,'\uFEFFWork ID,Title,Creator,Duration,Unmapped\r\nCSV-1,"Quoted, work","Writer\nTwo",210,original\r\n');
 const args={kind:'works',mapping};
 const count=async()=>Number((await db.query('select count(*)::int n from works'))[0].n);
 const countBefore=await count();
 eq((await invoke('import',{...args,actor:'Importer','dry-run':true},['artifax',csv]))[0].status,'dry-run');eq(await count(),countBefore);
 eq((await invoke('import',{...args,actor:'Importer'},['artifax',csv]))[0].added,1);
 eq((await invoke('import',{...args,actor:'Importer'},['artifax',csv]))[0].status,'unchanged');
 const saved=(await db.query("select * from import_batches where filename='works.csv'"))[0];eq(Buffer.from(saved.source_base64,'base64'),fs.readFileSync(csv));eq(saved.rows[0].Unmapped,'original');
 const bad=path.join(tmp,'bad.csv');fs.writeFileSync(bad,'Work ID,Title,Creator,Duration\nROLLBACK,Good,Writer,100\nFAIL,Bad,Writer,-3\n');
 await assert.rejects(()=>invoke('import',{...args,actor:'Importer'},['artifax',bad]),/row 3/);checks++;
 eq((await db.query("select count(*)::int n from works where code='ROLLBACK'"))[0].n,0);
 fs.writeFileSync(bad,'Work ID,Title,Creator,Duration\nCSV-1,Changed,Writer,100\n');
 await assert.rejects(()=>invoke('import',{...args,actor:'Importer'},['artifax',bad]),/differs/);checks++;
 const sessionMap=path.join(tmp,'sessions-map.json');fs.writeFileSync(sessionMap,JSON.stringify({code:'ID',production:'Production',space:'Space',kind:'Type',starts:'Start',ends:'End',people:'People'}));
 fs.writeFileSync(bad,'ID,Production,Space,Type,Start,End,People\nIMP-S,TIDE,STUDIO,rehearsal,2030-03-01T08:00:00Z,2030-03-01T09:00:00Z,2\n');
 eq((await invoke('import',{kind:'sessions',mapping:sessionMap,actor:'Importer'},['artifax',bad]))[0].added,1);
 // Different source bytes, same record: reconcile without duplicating or leaving comparison audit rows.
 fs.appendFileSync(bad,'\n');eq((await invoke('import',{kind:'sessions',mapping:sessionMap,actor:'Importer'},['artifax',bad]))[0].unchanged,1);
 eq((await db.query("select count(*)::int n from audit_log where after_row->>'code' like 'check-%'"))[0].n,0);
 assert.throws(()=>parseCsv('a,a\n1,2'),/unique/);checks++;
 assert.throws(()=>parseCsv('a,b\n"broken,2'),/unclosed/);checks++;
 const archive=path.join(tmp,'archive');await invoke('export',{out:archive});eq(JSON.parse(fs.readFileSync(path.join(archive,'manifest.json'))).counts.works,await count());
 await assert.rejects(()=>invoke('export',{out:archive}),/already exists/);checks++;
 for(const cmd of ['weekly-review','draft-programme','draft-call']){const result=await invoke(cmd,cmd==='weekly-review'?{}:{production:'TIDE'});ok(fs.readFileSync(result[0].file,'utf8').includes('Internal draft'));fs.unlinkSync(result[0].file);}
 const html=page({title:'Test',sections:[{title:'Escaped',html:table([{name:'<script>bad</script>'}])}]});ok(html.includes('&lt;script&gt;'));ok(!html.includes('<script>bad'));
 eq((await invoke('help')).length,commandNames.length);
 // Close embedded store before child-process checks (Windows file locks included).
 await db.close();
 for(const [script,args] of [['arts.mjs',['season-review','--json']],['view.mjs',[]],['docs.mjs',[]]]){
  const child=spawnSync(process.execPath,[path.join(REPO_ROOT,'scripts',script),...args],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});eq(child.status,0);if(script==='arts.mjs')ok(JSON.parse(child.stdout).length>0);
 }
 const ambiguous=spawnSync(process.execPath,['scripts/arts.mjs','production','ti'],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});eq(ambiguous.status,1);ok(ambiguous.stderr.includes('Ambiguous'));
 const commandsCount=fs.readdirSync(path.join(REPO_ROOT,'.claude','commands')).filter(f=>f.endsWith('.md')).length;
 console.log(`PASS: ${checks} checks, ${commandNames.length} CLI commands, ${commandsCount} slash commands (${process.platform}, ${db.mode})`);
}finally{try{await db.close();}catch{}fs.rmSync(tmp,{recursive:true,force:true});}
