// Preserve the existing object-fit crop, without downloading off-screen sides.
// Uses the already installed Sharp; run from the website root.
import sharp from 'sharp';
const folder='public/media/journey-v5/stills';
for(const [source,target] of [['000.webp','000-portrait.webp'],['000-before.webp','000-before-portrait.webp']]){
 const image=sharp(`${folder}/${source}`),meta=await image.metadata();
 if(meta.width!==1920||meta.height!==1080)throw Error(`Review mobile framing for the changed source: ${source}`);
 const info=await image.extract({left:285,top:0,width:1350,height:1080}).webp({quality:90,effort:6}).toFile(`${folder}/${target}`);
 console.log(`${target}: ${info.width}x${info.height}, ${info.size} bytes`);
}
