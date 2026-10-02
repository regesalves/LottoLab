const dns=require('node:dns').promises, https=require('node:https');
(async()=>{
for(const host of ['servicebus2.caixa.gov.br','servicebus.caixa.gov.br']){
 console.log(host,await dns.lookup(host,{all:true}).catch(e=>e.message));
 await Promise.all([4,6].map(family=>new Promise(resolve=>{
 const start=Date.now(); const req=https.get(`https://${host}/portaldeloterias/api/lotofacil/3794`,{family,headers:{Accept:'application/json'}},r=>{let body='';r.on('data',c=>body+=c);r.on('end',()=>{console.log({host,family,ms:Date.now()-start,status:r.statusCode,body:body.slice(0,2000)});resolve();});});
 const timer=setTimeout(()=>req.destroy(Error('deadline')),8000);
 req.on('socket',s=>{s.on('lookup',(e,address)=>console.log({host,family,phase:'dns',ms:Date.now()-start,address,error:e?.message}));s.on('connect',()=>console.log({host,family,phase:'tcp',ms:Date.now()-start}));s.on('secureConnect',()=>console.log({host,family,phase:'tls',ms:Date.now()-start}));});
 req.on('error',e=>{clearTimeout(timer);console.log({host,family,ms:Date.now()-start,error:e.message,code:e.code});resolve();});req.on('close',()=>clearTimeout(timer));
 })));
}
})();
