#!/usr/bin/env python3
"""Documented, read-only checks. No private keys/URLs/bodies are written to reports."""
import argparse
import datetime
import getpass
import json
import math
import os
import socket
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request

HOST='api.wikimapia.org'
API='https://api.wikimapia.org/'

def api_url(method,key,**params):
    return API+'?'+urllib.parse.urlencode(dict(function=method,key=key,format='json',language='ru',pack='none',**params))

def check_dns(host):
    try:
        return {'host':host,'status':'PASS','addresses':sorted({v[4][0] for v in socket.getaddrinfo(host,443,type=socket.SOCK_STREAM)})}
    except OSError as e:
        return {'host':host,'status':'ENV_BLOCKED','error_type':type(e).__name__}

def request(label,url):
    result={'label':label}
    try:
        req=urllib.request.Request(url,headers={'User-Agent':'WikiReader/0.2 (personal API diagnostics)','Accept':'application/json'})
        with urllib.request.urlopen(req,timeout=20,context=ssl.create_default_context()) as r:
            result.update(status=r.status,server_date=r.headers.get('Date'),content_type=r.headers.get('Content-Type'),cors_origin=r.headers.get('Access-Control-Allow-Origin'))
            body=r.read(2*1024*1024+1)
            result['bytes']=len(body)
            if len(body)>2*1024*1024:result['error']='response_too_large';return result,None
            try:return result,json.loads(body)
            except (ValueError,UnicodeError):result['json']=False
    except urllib.error.HTTPError as e:result.update(status=e.code,error='http_error')
    except (OSError,urllib.error.URLError) as e:result.update(error_type=type(e).__name__,error='transport_failed')
    return result,None

def valid_polygon(points):
    if not isinstance(points,list) or len(points)<3:return False
    for point in points:
        if not isinstance(point,dict):return False
        try:
            if any(point.get(k) is None or isinstance(point.get(k),bool) or str(point.get(k)).strip()=='' for k in ['x','y']):return False
            lon,lat=float(point['x']),float(point['y'])
            if not (math.isfinite(lon) and math.isfinite(lat) and -180<=lon<=180 and -90<=lat<=90):return False
        except (KeyError,ValueError,TypeError):return False
    return True

def inspect(data,kind,expected_id=55,area_method='place.getbyarea'):
    if not isinstance(data,dict):return {'verified':False,'reason':'ambiguous_array' if data==[] else 'not_object'}
    if data.get('debug') or data.get('error') or data.get('error_message'):
        error=data.get('debug') or data.get('error') or data.get('error_message')
        # Classify without echoing untrusted messages that could include credentials.
        text=str(error).lower()
        return {'verified':False,'reason':'quota' if any(w in text for w in ['limit','wait','quota']) else 'api_error'}
    if kind=='area':
        places=data.get('folder' if area_method=='box' else 'places')
        if not isinstance(places,list):return {'verified':False,'reason':'missing_places'}
        polygons=sum(1 for p in places if isinstance(p,dict) and valid_polygon(p.get('polygon')))
        return {'verified':polygons>0,'places':len(places),'polygons':polygons,'reason':'objects_with_geometry' if polygons else 'no_geometry_evidence'}
    place=data.get('place',data)
    if not isinstance(place,dict):return {'verified':False,'reason':'invalid_place'}
    main=place.get('main',place)
    if not isinstance(main,dict):return {'verified':False,'reason':'invalid_main'}
    matched=str(place.get('id',main.get('id'))) == str(expected_id)
    description=main.get('description')
    geometry=place.get('geometry')
    polygon=place.get('polygon',geometry.get('polygon') if isinstance(geometry,dict) else None)
    return {'verified':bool(matched and main.get('title') and isinstance(description,str) and description and valid_polygon(polygon)),'id_matches':matched,'description_chars':len(description) if isinstance(description,str) else 0,'polygon_points':len(polygon) if isinstance(polygon,list) else 0,'photos_type':type(place.get('photos')).__name__,'comments_type':type(place.get('comments')).__name__}

def main():
    p=argparse.ArgumentParser(description='Проверка документированного Wikimapia API без записи ключа')
    p.add_argument('--id',type=int,default=55)
    p.add_argument('--area-method',choices=['box','place.getbyarea'],default='box')
    p.add_argument('--example',action='store_true',help='Use only the public example key from official documentation')
    p.add_argument('--ask-key',action='store_true',help='Hidden local prompt; never send your key in chat')
    p.add_argument('--out',default='probe-results.json')
    args=p.parse_args()
    if args.id<=0:p.error('--id must be positive')
    key=getpass.getpass('Wikimapia API key (hidden): ') if args.ask_key else ('example' if args.example else os.environ.get('WIKIMAPIA_API_KEY','').strip())
    report={'timestamp_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'connection':'environment HTTPS proxy' if os.environ.get('HTTPS_PROXY') else 'direct','key_source':'public_documented_example' if args.example else 'personal' if key else 'absent','dns':[check_dns(h) for h in [HOST,'wikimapia.org','registry.npmjs.org']],'checks':[]}
    docs,_=request('documentation','https://wikimapia.org/api');report['checks'].append(docs)
    if key:
        # Local DNS failure does not imply HTTPS failure when the environment proxy resolves remotely.
        area,data=request(args.area_method,api_url(args.area_method,key,bbox='37.616,55.751,37.625,55.756',coordsby='bbox',page=1,count=5))
        area.update(inspect(data,'area',area_method=args.area_method));report['checks'].append(area)
        time.sleep(6)  # one deliberate spacing, no automatic retry
        detail,data=request('place.getbyid',api_url('place.getbyid',key,id=args.id,data_blocks='main,location,geometry,photos,comments'))
        detail.update(inspect(data,'detail',args.id));report['checks'].append(detail)
    report['ready_for_map_mvp']=bool(key and all(c.get('verified') for c in report['checks'][1:]) and len(report['checks'])==3)
    with open(args.out,'w') as f:json.dump(report,f,ensure_ascii=False,indent=2)
    print(json.dumps(report,ensure_ascii=False,indent=2))
    return 0 if report['ready_for_map_mvp'] else 1 if key else 2

if __name__=='__main__':raise SystemExit(main())
