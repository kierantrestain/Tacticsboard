"""Refresh the factual football snapshot. No generated players or invented statistics.

ESPN public JSON is an upstream availability dependency, not a contracted data feed.
Coach identity is deliberately excluded from its stale roster coach field.
"""
from urllib.request import urlopen, Request
from pathlib import Path
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
import json, time, collections

ROOT=Path(__file__).resolve().parent.parent
CACHE=ROOT/'data-cache';CACHE.mkdir(exist_ok=True)
OUT=ROOT/'public'/'data';OUT.mkdir(parents=True,exist_ok=True)
BASE='https://site.api.espn.com/apis/site/v2/sports/soccer/'
NOW=datetime.now(timezone.utc)
SEASON=2026
LEAGUES={'eng.1':'Premier League','uefa.champions':'Champions League'}
issues=[]

def get(path):
    cache=CACHE/(path.replace('/','_').replace('?','_').replace('&','_')+'.json')
    if cache.exists():return json.loads(cache.read_text())
    for attempt in range(3):
        try:
            with urlopen(Request(BASE+path,headers={'User-Agent':'FixtureTacticsStudio/1.0'}),timeout=30) as r:data=json.load(r)
            cache.write_text(json.dumps(data));return data
        except Exception as e:
            if attempt==2:raise
            time.sleep(.3*(attempt+1))

def stats_of(a):
    return {s['name']:{'value':s.get('value'),'display':s.get('displayValue'),'label':s.get('displayName',s['name'])}
      for c in a.get('statistics',{}).get('splits',{}).get('categories',[]) for s in c.get('stats',[])}

def player(a,league):
    return {'id':str(a['id']),'name':a.get('displayName',a.get('fullName','')),'shortName':a.get('shortName'),
      'firstName':a.get('firstName'),'lastName':a.get('lastName'),'number':a.get('jersey'),
      'position':a.get('position',{}).get('displayName'),'positionCode':a.get('position',{}).get('abbreviation'),
      'nationality':a.get('citizenship'),'dateOfBirth':a.get('dateOfBirth'),
      'heightCm':round(a['height']*2.54) if a.get('height') else None,
      'weightKg':round(a['weight']/2.20462) if a.get('weight') else None,
      'birthPlace':a.get('birthPlace'),
      'statsByCompetition':{league:stats_of(a)},
      'sourceUrl':next((l['href'] for l in a.get('links',[]) if 'playercard' in l.get('rel',[])),None)}

def event(e,league):
    c=e.get('competitions',[{}])[0];by={x.get('homeAway'):x for x in c.get('competitors',[])}
    if 'home' not in by or 'away' not in by:return None
    status=c.get('status',e.get('status',{})).get('type',{})
    def score(x):
        z=x.get('score');return str(z.get('displayValue','')) if isinstance(z,dict) else str(z) if z is not None else None
    return {'id':str(e['id']),'league':league,'date':e.get('date'),'name':e.get('name'),
      'homeId':str(by['home']['id']),'awayId':str(by['away']['id']),
      'homeName':by['home'].get('team',{}).get('displayName'),
      'awayName':by['away'].get('team',{}).get('displayName'),
      'homeScore':score(by['home']),'awayScore':score(by['away']),
      'status':status.get('description','Scheduled'),'completed':bool(status.get('completed')),
      'venue':c.get('venue',{}).get('fullName'),
      'sourceUrl':f'https://www.espn.com/soccer/match/_/gameId/{e["id"]}'}

teams={};requests=[]
for league in LEAGUES:
    raw=get(league+'/teams?limit=100')
    for sport in raw.get('sports',[]):
        for comp in sport.get('leagues',[]):
            for x in comp.get('teams',[]):
                t=x['team'];tid=str(t['id'])
                if tid not in teams:
                    teams[tid]={'id':tid,'name':t.get('displayName'),'shortName':t.get('shortDisplayName',t.get('displayName')),
                      'abbreviation':t.get('abbreviation'), 'color':'#'+t.get('color','526270'),
                      'alternateColor':'#'+t.get('alternateColor','ffffff'),'competitions':[], 'players':[],
                      'sourceUrl':next((l['href'] for l in t.get('links',[]) if 'clubhouse' in l.get('rel',[])),None)}
                teams[tid]['competitions'].append(league);requests.append((league,tid))
print(f'Catalogue: {len(teams)} unique clubs / {len(requests)} competition memberships',flush=True)

def fetch_team(q):
    league,tid=q
    try:return q,get(f'{league}/teams/{tid}/roster?season={SEASON}'),get(f'{league}/teams/{tid}/schedule?season={SEASON}')
    except Exception as e:return q,None,str(e)
matches={};schedules={};roster_count=0
with ThreadPoolExecutor(max_workers=6) as pool:
    futures=[pool.submit(fetch_team,q) for q in requests]
    for future in as_completed(futures):
        (league,tid),r,s=future.result()
        if r is None:issues.append({'team':tid,'league':league,'error':s});continue
        if r.get('season',{}).get('year')!=SEASON:
            issues.append({'team':tid,'league':league,'error':'Upstream season differs from requested season'});continue
        t=teams[tid];existing={a['id']:a for a in t['players']}
        for a in r.get('athletes',[]):
            if not a.get('id'):continue
            normal=player(a,league)
            if normal['id'] in existing:existing[normal['id']]['statsByCompetition'].update(normal['statsByCompetition'])
            else:t['players'].append(normal);existing[normal['id']]=normal
        t['rosterUpdatedAt']=r.get('timestamp')
        schedules[(league,tid)]=[]
        for e in s.get('events',[]):
            m=event(e,league)
            if m:matches[m['id']]=m;schedules[(league,tid)].append(m)
        roster_count+=1
        if roster_count%10==0:print(f'Imported {roster_count}/{len(requests)} squad feeds',flush=True)

# Get the latest three actual lineups per team and competition. Cache summaries once.
summary_ids={}
for (league,tid),ms in schedules.items():
    recent=sorted([m for m in ms if m['completed'] and m['date']<=NOW.isoformat()],key=lambda m:m['date'],reverse=True)[:3]
    for m in recent:summary_ids[m['id']]=league
def summary(q):
    mid,league=q
    try:return mid,league,get(f'{league}/summary?event={mid}')
    except Exception as e:return mid,league,{'error':str(e)}
summaries={};formation_counts={tid:collections.Counter() for tid in teams}
with ThreadPoolExecutor(max_workers=6) as pool:
    for mid,league,d in pool.map(summary,summary_ids.items()):
        if 'error' in d:issues.append({'match':mid,'error':d['error']});continue
        lineups=[]
        for r in d.get('rosters',[]):
            tid=str(r.get('team',{}).get('id',''))
            raw_form=r.get('formation');form=raw_form.get('displayName') if isinstance(raw_form,dict) else raw_form
            athletes=[]
            for a in r.get('roster',[]):
                z=a.get('athlete',{})
                if not z.get('id'):continue
                athletes.append({'id':str(z['id']),'name':z.get('displayName'), 'number':a.get('jersey'),
                  'starter':bool(a.get('starter')),'formationPlace':a.get('formationPlace'),
                  'position':a.get('position',{}).get('displayName'),'positionCode':a.get('position',{}).get('abbreviation')})
            lineups.append({'teamId':tid,'side':r.get('homeAway'),'formation':form,'players':athletes})
            if tid in formation_counts and form:formation_counts[tid][form]+=1
        team_stats=[{'teamId':str(x.get('team',{}).get('id')),'stats':{s['name']:{'display':s.get('displayValue'),'label':s.get('label',s['name'])} for s in x.get('statistics',[])}} for x in d.get('boxscore',{}).get('teams',[])]
        key_events=[{'minute':e.get('clock',{}).get('displayValue'),'text':e.get('text'),'type':e.get('type',{}).get('text')} for e in d.get('keyEvents',[]) if e.get('text')]
        summaries[mid]={'id':mid,'lineups':lineups,'teamStats':team_stats,'events':key_events,'sourceUrl':matches.get(mid,{}).get('sourceUrl')}
print(f'Imported {len(summaries)} match summaries',flush=True)

managers=json.loads((ROOT/'data'/'managers.json').read_text())
for tid,t in teams.items():
    m=managers.get(tid)
    if m:
        source='https://www.premierleague.com/en/managers?cl=-1&se=-1' if 'eng.1' in t['competitions'] else 'https://www.uefa.com/uefachampionsleague/news/02a8-2171a88881a0-c70193b972c6-1000--meet-the-2026-27-champions-league-league-phase-teams/'
        t['manager']={**m,'sourceUrl':m.get('sourceUrl',source),'checkedAt':NOW.isoformat(),
            'formations':[{'name':f,'matches':n} for f,n in formation_counts[tid].most_common()],
            'tacticsBasis':'Starting formations supplied for the latest available match sample. Analysis lens is an editorial prompt, not measured tracking data.'}
    t['players'].sort(key=lambda a:(['G','D','M','F'].index(a['positionCode']) if a.get('positionCode') in ['G','D','M','F'] else 9,int(a.get('number') or 999)))
    t['defaultFormation']=formation_counts[tid].most_common(1)[0][0] if formation_counts[tid] else None
catalogue={'season':'2026/27','seasonYear':SEASON,'updatedAt':NOW.isoformat(),'provider':'ESPN public football data',
 'competitions':[{'id':k,'name':v,'teamCount':sum(k in t['competitions'] for t in teams.values())} for k,v in LEAGUES.items()],
 'teams':sorted(teams.values(),key=lambda t:t['name']),'matches':sorted(matches.values(),key=lambda m:m['date'],reverse=True),
 'quality':{'issues':issues,'squadCount':len(teams),'playerCount':sum(len(t['players']) for t in teams.values()),
 'notes':['Squads and statistics retain competition and season scope. Missing values are unknown, not zero.',
 'Roster coach fields are excluded; manager identities use separately checked sources.',
 'Pitch positions are analyst diagrams, not optical tracking. No xG or heatmaps are invented.']}}
(OUT/'catalogue.json').write_text(json.dumps(catalogue,ensure_ascii=False,separators=(',',':')))
(OUT/'matches.json').write_text(json.dumps(summaries,ensure_ascii=False,separators=(',',':')))
print(json.dumps({'clubs':len(teams),'players':catalogue['quality']['playerCount'],'matches':len(matches),'summaries':len(summaries),'issues':issues},ensure_ascii=False),flush=True)
