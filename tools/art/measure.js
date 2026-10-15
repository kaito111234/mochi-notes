// đo nhanh PNG (RGBA 8bit): node tools/art/measure.js file.png  -> bề rộng đục theo hàng (mỗi 10px)
const fs=require('fs'),z=require('zlib');
function dec(f){const b=fs.readFileSync(f);let p=8,w,h,ct,idat=[];while(p<b.length){const l=b.readUInt32BE(p),t=b.toString('ascii',p+4,p+8);if(t==='IHDR'){w=b.readUInt32BE(p+8);h=b.readUInt32BE(p+12);ct=b[p+17];}if(t==='IDAT')idat.push(b.slice(p+8,p+8+l));p+=12+l;}
const raw=z.inflateSync(Buffer.concat(idat));const bpp=ct===6?4:3,st=w*bpp,out=Buffer.alloc(w*h*4);let prev=Buffer.alloc(st);
for(let y=0;y<h;y++){const ft=raw[y*(st+1)],ln=Buffer.from(raw.slice(y*(st+1)+1,(y+1)*(st+1)));for(let i=0;i<st;i++){const a=i>=bpp?ln[i-bpp]:0,u=prev[i],c=i>=bpp?prev[i-bpp]:0;let v=ln[i];if(ft===1)v+=a;else if(ft===2)v+=u;else if(ft===3)v+=(a+u)>>1;else if(ft===4){const pp=a+u-c,pa=Math.abs(pp-a),pb=Math.abs(pp-u),pc=Math.abs(pp-c);v+=(pa<=pb&&pa<=pc)?a:(pb<=pc?u:c);}ln[i]=v&255;}
for(let x=0;x<w;x++){out[(y*w+x)*4]=ln[x*bpp];out[(y*w+x)*4+1]=ln[x*bpp+1];out[(y*w+x)*4+2]=ln[x*bpp+2];out[(y*w+x)*4+3]=bpp===4?ln[x*bpp+3]:255;}prev=ln;}
return{w,h,d:out};}
module.exports=dec;
if(require.main===module){const {w,h,d}=dec(process.argv[2]);const step=+process.argv[3]||10;for(let y=0;y<h;y+=step){let mn=w,mx=-1;for(let x=0;x<w;x++)if(d[(y*w+x)*4+3]>20){if(x<mn)mn=x;if(x>mx)mx=x;}console.log(y,mx<0?'-':mn+'..'+mx+' w'+(mx-mn+1));}}
