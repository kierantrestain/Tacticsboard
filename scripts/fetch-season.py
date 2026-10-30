"""Fetch public football snapshots. No keys, accounts or paid feeds required."""
from pathlib import Path
from urllib.request import urlopen,Request
from concurrent.futures import ThreadPoolExecutor,as_completed
from datetime import date,timedelta
import json,time
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'data-cache'/'final-pass';OUT.mkdir(parents=True,exist_ok=True)
CAT=json.loads((ROOT/'public/data/catalogue.json').read_text());YEAR=CAT['seasonYear'];BASE='https://site.api.espn.com/apis/site/v2/sports/soccer/'
jobs={
'fpl-bootstrap':'https://fantasy.premierleague.com/api/bootstrap-static/',
'fpl-fixtures':'https://fantasy.premierleague.com/api/fixtures/',
'pl-table':f'https://site.api.espn.com/apis/v2/sports/soccer/eng.1/standings?season={YEAR}',
'ucl-table':f'https://site.api.espn.com/apis/v2/sports/soccer/uefa.champions/standings?season={YEAR}',
'pl-teams':BASE+'eng.1/teams?limit=100',
'ucl-teams':BASE+'uefa.champions/teams?limit=100'}
day=date(YEAR,9,1)
while day<=date(YEAR+1,1,31):
 if day.weekday() in [1,2] or (day.month==9 and day.day<20 and day.weekday()==3): jobs['ucl-day-'+day.strftime('%Y%m%d')]=BASE+'uefa.champions/scoreboard?dates='+day.strftime('%Y%m%d')
 day+=timedelta(days=1)
for t in CAT['teams']:
 for league in t['competitions']: jobs[f'roster-{league}-{t["id"]}']=BASE+f'{league}/teams/{t["id"]}/roster?season={YEAR}'
def fetch(job):
 name,url=job;p=OUT/(name+'.json')
 if p.exists() and time.time()-p.stat().st_mtime<600:return name,True
 try:
  with urlopen(Request(url,headers={'User-Agent':'TouchlineStudio/2.1','Accept':'application/json'}),timeout=25) as r:d=json.load(r)
  p.write_text(json.dumps(d));return name,True
 except Exception as e:return name,str(e)
with ThreadPoolExecutor(max_workers=4) as pool:
 for i,f in enumerate(as_completed([pool.submit(fetch,j) for j in jobs.items()]),1):
  name,result=f.result()
  if result is not True:print(name,result,flush=True)
  if i%20==0:print(f'Fetched {i}/{len(jobs)} season and squad feeds',flush=True)
print('Season and squad feeds ready',flush=True)
