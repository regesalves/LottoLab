const { app, net, session } = require('electron');
const host = process.argv[2] || 'servicebus2.caixa.gov.br';
if (!/^servicebus\d+\.caixa\.gov\.br$/.test(host)) throw Error('Expected an official CAIXA host');
const urls = [`https://${host}/portaldeloterias/api/lotofacil/3794`, `https://${host}/portaldeloterias/api/lotofacil`];
async function probe(name, fn, url) {
 const start=Date.now();
 try { const r=await fn(url,{signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}}); const body=await r.text(); console.log(JSON.stringify({name,url,ms:Date.now()-start,status:r.status,body:body.slice(0,3200)})); }
 catch(e){ console.log(JSON.stringify({name,url,ms:Date.now()-start,error:e.message,cause:String(e.cause)})); }
}
app.whenReady().then(async()=>{
 console.log(JSON.stringify({versions:process.versions,proxy:await session.defaultSession.resolveProxy(urls[0])}));
 await Promise.all(urls.flatMap(url=>[probe('node-fetch',fetch,url),probe('electron-net',net.fetch,url)]));
 app.exit();
});
