/** Package the factual report archive for deployment without oversized API bodies. */
import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),directory=new URL('public/data/reports/',root),records={},manifest=[];
for(const name of (await readdir(directory)).filter(n=>/^\d+\.json$/.test(n)).sort()){
 const raw=await readFile(new URL(name,directory),'utf8');
 records[name]=raw;manifest.push({file:name,sha256:createHash('sha256').update(raw).digest('hex')});
}
const bytes=Buffer.from(JSON.stringify(records));
const archive={format:'touchline-statistical-archive-v1',compression:'gzip-base64',reports:manifest,sha256:createHash('sha256').update(bytes).digest('hex'),data:gzipSync(bytes,{level:9}).toString('base64')};
await mkdir(new URL('data/',root),{recursive:true});
await writeFile(new URL('data/report-archive.json',root),JSON.stringify(archive));
console.log(`Packed ${manifest.length} statistical reports (${bytes.length} bytes → ${archive.data.length} base64 characters).`);
