/** Restore exactly the committed statistical reports and verify every byte. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),archive=JSON.parse(await readFile(new URL('data/report-archive.json',root),'utf8'));
if(archive.format!=='touchline-statistical-archive-v1'||archive.compression!=='gzip-base64')throw Error('Unsupported statistical report archive.');
const bytes=gunzipSync(Buffer.from(archive.data,'base64'));
if(createHash('sha256').update(bytes).digest('hex')!==archive.sha256)throw Error('Statistical archive checksum mismatch.');
const records=JSON.parse(bytes.toString('utf8')),directory=new URL('public/data/reports/',root);
await mkdir(directory,{recursive:true});let restored=0;
for(const entry of archive.reports){
 if(!/^\d+\.json$/.test(entry.file)||typeof records[entry.file]!=='string')throw Error('Invalid statistical report entry.');
 const data=records[entry.file];if(createHash('sha256').update(data).digest('hex')!==entry.sha256)throw Error('Statistical report checksum mismatch: '+entry.file);
 const target=new URL(entry.file,directory);let same=false;try{same=(await readFile(target,'utf8'))===data;}catch{}
 if(!same){await writeFile(target,data);restored++;}
}
console.log(`Verified ${archive.reports.length} statistical reports; restored ${restored}.`);
