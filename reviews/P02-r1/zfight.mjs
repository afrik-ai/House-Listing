import { openGame } from '../../scripts/shot.mjs';
let { browser, page } = await openGame({ w:800, h:450, quality:'low', tod:'day' });
const r = await page.evaluate(() => {
  const g = window.__game, T = g.THREE;
  const tris = [];
  const root = g.game.house.root || g.scene;
  root.updateMatrixWorld(true);
  root.traverse(o => {
    if (!o.isMesh || !o.visible || /^COL_|GLASS/.test(o.name)) return;
    let m=o.material; if (Array.isArray(m)) m=m[0]; if (m && m.transparent) return;
    const pos = o.geometry.attributes.position, idx = o.geometry.index;
    const n = idx ? idx.count : pos.count;
    const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),nn=new T.Vector3(),e1=new T.Vector3(),e2=new T.Vector3();
    for (let i=0;i<n;i+=3){
      const ia=idx?idx.getX(i):i, ib=idx?idx.getX(i+1):i+1, ic=idx?idx.getX(i+2):i+2;
      a.fromBufferAttribute(pos,ia).applyMatrix4(o.matrixWorld); b.fromBufferAttribute(pos,ib).applyMatrix4(o.matrixWorld); c.fromBufferAttribute(pos,ic).applyMatrix4(o.matrixWorld);
      e1.subVectors(b,a); e2.subVectors(c,a); nn.crossVectors(e1,e2); const area=nn.length()/2; if (area<0.02) continue; nn.normalize();
      for (const [ax,u,v] of [['y','x','z'],['x','y','z'],['z','x','y']]) {
        if (Math.abs(nn[ax])>0.999) {
          tris.push({name:o.name, ax, s:Math.sign(nn[ax]), d:+a[ax].toFixed(3),
            u0:Math.min(a[u],b[u],c[u]), u1:Math.max(a[u],b[u],c[u]), v0:Math.min(a[v],b[v],c[v]), v1:Math.max(a[v],b[v],c[v])});
        }
      }
    }
  });
  const byKey = {};
  for (const t of tris) { const k=t.ax+t.s+'_'+t.d.toFixed(2); (byKey[k]=byKey[k]||[]).push(t); }
  const hits = {};
  for (const k in byKey) { const L=byKey[k]; if (L.length>4000) continue;
    for (let i=0;i<L.length;i++) for (let j=i+1;j<L.length;j++) { const A=L[i],B=L[j]; if (A.name===B.name) continue; if (Math.abs(A.d-B.d)>0.002) continue;
      const ou=Math.min(A.u1,B.u1)-Math.max(A.u0,B.u0), ov=Math.min(A.v1,B.v1)-Math.max(A.v0,B.v0);
      if (ou>0.05&&ov>0.05) { const key=[A.name,B.name].sort().join(' x ')+' @'+A.ax+'='+A.d; hits[key]=(hits[key]||0)+ou*ov; } } }
  return { ntris: tris.length, hits: Object.entries(hits).sort((a,b)=>b[1]-a[1]).slice(0,40) };
});
console.log('tris', r.ntris); for (const [k,v] of r.hits) console.log(v.toFixed(2).padStart(7), k);
await browser.close();
