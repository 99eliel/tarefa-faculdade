const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];

function setup(options={}){
  const nodes=new Map(),records=new Map(),objects=new Set(),calls={create:0,upload:0,metadata:0,delete:0};
  const node=id=>{
    if(!nodes.has(id)){
      const classes=new Set();
      nodes.set(id,{value:id==='filter'?'all':'',textContent:'',innerHTML:'',files:[],disabled:false,handlers:{},
        classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,yes){if(yes)classes.add(x);else classes.delete(x)}},
        addEventListener(event,fn){this.handlers[event]=fn},reset(){},});
    }
    return nodes.get(id);
  };
  const fields=Object.fromEntries(Object.entries({name:'API',image:'node:22',status:'active',description:'Teste',cpu:'1',ram:'2',disk:'10',price:'100'}).map(([key,value])=>[key,{value}]));
  node('containerForm').elements={namedItem:key=>fields[key]};
  const context={console:{warn(){}},Intl,setTimeout:()=>0,clearTimeout(){},crypto:{randomUUID:()=>String(calls.upload+1)},
    document:{getElementById:node,querySelectorAll:()=>[]},confirm:()=>true,
    initializeApp:()=>({}),getAuth:()=>({currentUser:{uid:'admin',email:'admin@example.test'}}),getFirestore:()=>({}),getStorage:()=>({}),
    collection:(_,name)=>name,doc:(_,collection,id)=>id,ref:(_,p)=>p,serverTimestamp:()=>({seconds:123}),
    onAuthStateChanged:(_,fn)=>{context.authCallback=fn},
    onSnapshot:(_,success,error)=>{context.snapshot=success;context.snapshotError=error;return ()=>{}},
    getDoc:async()=>({exists:()=>true}),
    getDocFromServer:async id=>{if(options.readFails)throw Error('offline');if(id==='admin')return {exists:()=>options.adminExists!==false};return {exists:()=>records.has(id),data:()=>records.get(id)}},
    signOut:async()=>{},
    GoogleAuthProvider:class{setCustomParameters(){}},
    addDoc:async(_,values)=>{calls.create++;const id='container-'+calls.create;records.set(id,{...values});return {id}},
    updateDoc:async(id,values)=>{
      if(!records.has(id))throw Error('not-found');
      if(values.pdfPath){calls.metadata++;if(options.metadataFails){options.metadataFails--;if(options.commitBeforeFailure)records.set(id,{...records.get(id),...values});throw Error('metadata unavailable')}}
      records.set(id,{...records.get(id),...values});
    },
    uploadBytes:async(p)=>{calls.upload++;if(options.uploadFails){options.uploadFails--;throw Error('upload unavailable')}objects.add(p)},
    deleteObject:async p=>{calls.delete++;if(options.deleteFails)throw Error('delete unavailable');objects.delete(p)},
  };
  vm.createContext(context);vm.runInContext(script.replace(/^import .*;$/gm,''),context);
  const run=source=>vm.runInContext(source,context);
  const submit=()=>node('containerForm').handlers.submit({preventDefault(){},currentTarget:node('containerForm')});
  const withPdf=()=>{node('pdfInput').files=[{name:'doc.pdf',type:'application/pdf',size:100}]};
  return {node,fields,context,run,submit,withPdf,records,objects,calls,options};
}

test('both hosting entry points stay identical and the module parses',()=>{
  assert.equal(html,fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'));
  const result=spawnSync(process.execPath,['--input-type=module','--check'],{input:script,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
});
test('empty dashboard and valid legacy numeric strings render',()=>{
  const h=setup();h.run('render()');assert.equal(h.node('statTotal').textContent,0);
  h.context.record={name:'API',image:'node',description:'',status:'active',cpu:'1',ram:'2',disk:'10',price:'99.90',id:'forged'};
  h.run('items=[readContainer({id:"real",data:()=>record})];render()');
  assert.equal(h.run('items[0].id'),'real');assert.equal(h.run('items[0].price'),99.9);
  assert.equal(h.node('statTotal').textContent,1);
});
test('malformed records are omitted with a visible warning and preserved input',async()=>{
  const h=setup();await h.run('enter({uid:"admin"})');
  const valid={name:'API',image:'node',description:'',status:'active',cpu:1,ram:2,disk:10,price:100};
  const invalid={...valid,price:{toString:'invalid',valueOf:'invalid'}};
  h.context.snapshot({docs:[{id:'a',data:()=>valid},{id:'b',data:()=>invalid}]});
  assert.equal(h.run('items.length'),1);assert.match(h.node('dataWarning').textContent,/1 cadastro/);
  assert.deepEqual(invalid.price,{toString:'invalid',valueOf:'invalid'});
});
test('validation rejects out-of-range, nonfinite and invalid status before writes',async()=>{
  for(const [key,value] of [['cpu','129'],['ram','0'],['disk','-1'],['price','Infinity'],['status','unknown'],['name',' '],['image','x'.repeat(101)]]){
    const h=setup();h.fields[key].value=value;await h.submit();assert.equal(h.calls.create,0,key);assert.ok(h.node('formError').textContent,key);
  }
});
test('create without PDF and edit preserve one document',async()=>{
  const h=setup();await h.submit();assert.equal(h.records.size,1);assert.equal(h.calls.upload,0);
  h.context.existing={id:'container-1',...h.records.get('container-1')};h.run('openModal(existing)');h.fields.name.value='Updated';await h.submit();
  assert.equal(h.records.size,1);assert.equal(h.records.get('container-1').name,'Updated');
});
test('retry after upload failure reuses the confirmed container ID',async()=>{
  const h=setup({uploadFails:1});h.withPdf();await h.submit();
  assert.equal(h.records.size,1);assert.equal(h.run('editingId'),'container-1');assert.match(h.node('formError').textContent,/dados.*salvos/);
  await h.submit();assert.equal(h.calls.create,1);assert.equal(h.calls.upload,2);assert.ok(h.records.get('container-1').pdfPath);assert.equal(h.run('editingId'),null);
});
test('metadata failure retries the same uploaded file without deleting it',async()=>{
  const h=setup({metadataFails:1});h.withPdf();await h.submit();
  assert.equal(h.objects.size,1);assert.equal(h.calls.delete,0);assert.equal(h.node('pdfInput').disabled,true);
  await h.submit();assert.equal(h.calls.create,1);assert.equal(h.calls.upload,1);assert.equal(h.calls.metadata,2);assert.equal(h.objects.size,1);
});
test('cancel removes only a confirmed unlinked pending PDF',async()=>{
  const h=setup({metadataFails:1});h.withPdf();await h.submit();await h.run('closeModal()');
  assert.equal(h.calls.delete,1);assert.equal(h.objects.size,0);assert.equal(h.records.size,1);assert.equal(h.run('pendingPdf'),null);
});
test('cancel preserves PDF if metadata committed before an uncertain failure',async()=>{
  const h=setup({metadataFails:1,commitBeforeFailure:true});h.withPdf();await h.submit();await h.run('closeModal()');
  assert.equal(h.calls.delete,0);assert.equal(h.objects.size,1);assert.ok(h.records.get('container-1').pdfPath);
});
test('offline cancel keeps recovery state and reports the failure',async()=>{
  const h=setup({metadataFails:1,readFails:true});h.withPdf();await h.submit();await h.run('closeModal()');
  assert.ok(h.run('pendingPdf'));assert.equal(h.calls.delete,0);assert.match(h.node('formError').textContent,/conexão/);
});
test('invalid PDF is rejected before document creation',async()=>{
  for(const file of [{type:'text/plain',size:100},{type:'application/pdf',size:0},{type:'application/pdf',size:10*1024*1024+1}]){
    const h=setup();h.node('pdfInput').files=[file];await h.submit();assert.equal(h.calls.create,0);
  }
});
test('snapshot errors clear stale totals and remain visible',async()=>{
  const h=setup();await h.run('enter({uid:"admin"})');h.context.snapshotError({message:'denied'});
  assert.equal(h.run('items.length'),0);assert.match(h.node('dataWarning').textContent,/indisponíveis/);
});
test('old listener cannot repopulate data after logout',async()=>{
  const h=setup();await h.run('enter({uid:"admin"})');const oldCallback=h.context.snapshot;
  h.context.authCallback(null);
  oldCallback({docs:[{id:'a',data:()=>({name:'API',image:'node',description:'',status:'active',cpu:1,ram:2,disk:10,price:100})}]});
  assert.equal(h.run('items.length'),0);assert.equal(h.node('appScreen').classList.contains('hidden'),true);
});
test('replacement cleanup failure reports partial cleanup but preserves new attachment',async()=>{
  const h=setup({deleteFails:true});await h.submit();
  const existing={id:'container-1',...h.records.get('container-1'),pdfPath:'old.pdf',pdfName:'old.pdf'};
  h.records.set('container-1',existing);h.context.existing=existing;h.run('items=[existing];openModal(existing)');h.withPdf();await h.submit();
  assert.notEqual(h.records.get('container-1').pdfPath,'old.pdf');assert.equal(h.objects.size,1);assert.match(h.node('toast').textContent,/Não foi possível remover o anexo anterior/);
});
test('double submit while saving does not start another operation',async()=>{
  const h=setup();let release;h.context.addDoc=async(_,values)=>{h.calls.create++;await new Promise(resolve=>release=resolve);h.records.set('one',values);return {id:'one'}};
  const first=h.submit();await h.submit();assert.equal(h.calls.create,1);release();await first;
});
test('render still escapes user-provided HTML',()=>{
  const h=setup();h.run('items=[{id:"a",name:"<img src=x onerror=alert(1)>",image:"node",status:"active",cpu:1,ram:2,disk:10,price:100}];render()');
  assert.ok(h.node('containerTable').innerHTML.includes('&lt;img'));assert.ok(!h.node('containerTable').innerHTML.includes('<img'));
});
test('login copy does not contain infrastructure notices',()=>{
  const login=html.slice(html.indexOf('<section id="loginScreen"'),html.indexOf('<section id="appScreen"'));
  assert.doesNotMatch(login,/Firebase|Firestore|UID|administradores cadastrados/);
  assert.match(login,/Continuar com Google/);assert.match(login,/Seu e-mail/);
});
test('unknown backend errors never expose raw details to the user',()=>{
  const h=setup();h.context.failure={code:'unexpected',message:'Firebase secret diagnostic UID Firestore'};
  assert.doesNotMatch(h.run('userMessage(failure)'),/Firebase|secret|UID|Firestore/);
  assert.match(h.run('userMessage({code:"auth/popup-blocked"})'),/janela de login/);
});
test('Google sign-in errors use readable messages and unlock both login methods',async()=>{
  for(const code of ['auth/unauthorized-domain','auth/operation-not-allowed','auth/popup-blocked','auth/network-request-failed','auth/popup-closed-by-user','unknown']){
    const h=setup();h.context.signInWithPopup=async()=>{throw {code,message:'Firebase raw diagnostic'}};
    await h.node('googleLogin').handlers.click();
    assert.ok(h.node('loginError').textContent);assert.doesNotMatch(h.node('loginError').textContent,/Firebase|raw|Authentication|Authorized domains/);
    assert.equal(h.node('googleLogin').disabled,false);assert.equal(h.node('loginButton').disabled,false);
  }
});
test('email login rejects credentials without exposing backend diagnostics',async()=>{
  const h=setup();h.context.signInWithEmailAndPassword=async()=>{throw {code:'auth/invalid-credential',message:'Firebase raw diagnostic'}};
  await h.node('loginForm').handlers.submit({preventDefault(){}});
  assert.match(h.node('loginError').textContent,/E-mail ou senha incorretos/);assert.equal(h.node('loginButton').disabled,false);
});
test('Google authentication alone does not grant admin access',async()=>{
  const h=setup({adminExists:false});h.context.signInWithPopup=async()=>({user:{uid:'admin'}});
  await h.node('googleLogin').handlers.click();
  assert.equal(h.node('appScreen').classList.contains('hidden'),true);
  assert.match(h.node('loginError').textContent,/ainda não tem acesso/);assert.doesNotMatch(h.node('loginError').textContent,/UID|Firestore|admins/);
});
test('retry with an already authenticated account verifies access again',async()=>{
  const h=setup({readFails:true});h.context.signInWithPopup=async()=>({user:{uid:'admin'}});
  await h.node('googleLogin').handlers.click();assert.match(h.node('loginError').textContent,/verificar seu acesso/);
  h.options.readFails=false;await h.node('googleLogin').handlers.click();
  assert.equal(h.node('appScreen').classList.contains('hidden'),false);assert.equal(h.node('loginError').textContent,'');assert.equal(h.node('loginButton').disabled,false);
});
