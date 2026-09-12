export const uid = () => crypto.randomUUID();
export const day = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export const tomorrow = () => { const d = new Date(); d.setDate(d.getDate()+1); return day(d); };
export const emptyState = () => ({schema:1,projects:[],tasks:[],papers:[],logs:[],venues:[],goals:[],prelim:{date:'',topic:'',questions:'',survey:'',gaps:'',progress:'',requirements:''}});
export function validateState(s) {
  if (!s || s.schema !== 1 || !['projects','tasks','papers','logs','venues','goals'].every(k => Array.isArray(s[k])) || !s.prelim || typeof s.prelim !== 'object') throw new Error('Choose a Fieldnotes backup with schema version 1.');
  const fields={projects:['title','status','question','method','interaction','next','references'],tasks:['title','project','date','due','done','priority','focus'],papers:['title','url','project','status','note','lens'],logs:['date','project','did','learned','next'],venues:['name','year','track','deadline','zone','status','source','verified','project'],goals:['title','horizon','project','due','done']};
  for(const [key, keys] of Object.entries(fields)){
    const ids=new Set();
    for(const x of s[key]){
      if(!x || typeof x.id!=='string' || !x.id || ids.has(x.id)) throw new Error(`Invalid or duplicate ${key} record.`);
      ids.add(x.id);
      for(const f of keys){ if(x[f] === undefined) continue; if(['done','priority','focus'].includes(f)){if(typeof x[f]!=='boolean') throw new Error(`Invalid ${f}.`);}else if(typeof x[f]!=='string') throw new Error(`Invalid ${f}.`); }
    }
  }
  for(const value of Object.values(s.prelim)) if(typeof value!=='string') throw new Error('Invalid prelim field.');
  if(s.appliedUpdates!==undefined&&(!Array.isArray(s.appliedUpdates)||!s.appliedUpdates.every(x=>typeof x==='string')))throw new Error('Invalid update history.');
  if(s.captures!==undefined){
    if(!Array.isArray(s.captures))throw new Error('Invalid captured notes.');
    for(const n of s.captures){if(!n||typeof n.id!=='string'||typeof n.text!=='string'||typeof n.createdAt!=='string')throw new Error('Invalid captured note.');if(n.image&&(typeof n.image.name!=='string'||typeof n.image.data!=='string'||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(n.image.data)))throw new Error('Invalid photo attachment.');}
  }
  return s;
}
export function demoState(){
  const s=emptyState();
  s.projects=[{id:'sample-a',title:'Spatial sketchbook',status:'Exploring',question:'How can spatial tools help people express a visual idea?',method:'Compare two representations of a scene edit.',interaction:'Sketch a direct manipulation interaction.',next:'Identify one concrete failure case.',references:''},{id:'sample-b',title:'Interactive scenes',status:'Exploring',question:'How can a scene respond to a person’s direction?',method:'Explore responsive scene behavior.',interaction:'Storyboard a short interaction.',next:'Draw the interaction sequence.',references:''}];
  s.tasks=[{id:uid(),title:'Sketch one interaction worth exploring',project:'sample-a',date:day(),due:'',priority:true,focus:true,done:false},{id:uid(),title:'Compare two related papers',project:'sample-b',date:day(),due:'',priority:true,focus:false,done:false},{id:uid(),title:'Write down the biggest open question',project:'sample-a',date:tomorrow(),due:'',priority:false,focus:false,done:false}];
  s.goals=[{id:uid(),title:'Develop a defensible research question',horizon:'Long term',project:'',due:'',done:false}];
  return s;
}
export function suggestions(s,today=day()){
  return s.tasks.filter(t=>!t.done&&!t.priority).map(t=>({task:t,reason:t.due&&t.due<=today?'Due or overdue':t.date&&t.date<today?'Unfinished plan':'Next action',score:t.due&&t.due<=today?0:t.date&&t.date<today?1:2})).sort((a,b)=>a.score-b.score||(a.task.due||'9999').localeCompare(b.task.due||'9999')).slice(0,3);
}
export function setFocus(s,id){for(const t of s.tasks)t.focus=t.id===id&&!t.done;}
export function applyAgentUpdate(current,update){
  if(update?.kind!=='fieldnotes-update'||update.version!==1||typeof update.id!=='string'||!update.id||!Array.isArray(update.additions)||!update.additions.length||update.additions.length>100)throw new Error('Use a Fieldnotes update file containing 1–100 additions.');
  if((current.appliedUpdates||[]).includes(update.id))throw new Error('This update has already been applied.');
  const next=JSON.parse(JSON.stringify(current));
  for(const entry of update.additions){
    if(!['tasks','logs','papers','projects','goals'].includes(entry.collection)||!entry.record||typeof entry.record!=='object')throw new Error('Unsupported update. Only tasks, logs, papers, ideas, and goals can be added.');
    const record=JSON.parse(JSON.stringify(entry.record));
    if(typeof record.id!=='string'||!record.id||next[entry.collection].some(x=>x.id===record.id))throw new Error('An addition is missing an ID or already exists.');
    if(typeof record[entry.collection==='logs'?'did':'title']!=='string'||!record[entry.collection==='logs'?'did':'title'].trim())throw new Error('Every addition needs a title or work-log text.');
    if(record.project&&!next.projects.some(p=>p.id===record.project))throw new Error('An addition links to an unknown project. Add the project first.');
    if(entry.collection==='tasks'){record.done=false;record.focus=false;record.priority=false;}
    next[entry.collection].push(record);
  }
  validateState(next);next.appliedUpdates=[...(next.appliedUpdates||[]),update.id];return next;
}
