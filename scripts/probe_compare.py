#!/usr/bin/env python3
"""Compare documented Wikimapia area APIs manually; do not expose key or geo data."""
import argparse
import getpass
import json
import os
import time

from probe import api_url, inspect, request

METHODS = ('box', 'place.getbyarea')
# A fixed public test rectangle: never include the user's current GPS position.
TEST_BBOX = '37.616,55.751,37.625,55.756'


def safe_summary(method, response, payload):
    check = inspect(payload, 'area', area_method=method)
    return {
        'method': method,
        'http_status': response.get('status'),
        'verified_geometry': check.get('verified', False),
        'reason': check.get('reason', 'no_contract_evidence'),
        'places': check.get('places', 0),
        'polygons': check.get('polygons', 0),
    }


def main():
    parser = argparse.ArgumentParser(description='Сравнить box и place.getbyarea (только ручной запуск)')
    parser.add_argument('--example', action='store_true', help='Use documented public example key')
    parser.add_argument('--ask-key', action='store_true', help='Read personal API key without echo')
    parser.add_argument('--out', default='wikimapia-area-compare.json')
    args = parser.parse_args()
    if args.ask_key and args.example:
        parser.error('Choose only one key source')
    key = getpass.getpass('Wikimapia API key: ') if args.ask_key else ('example' if args.example else os.environ.get('WIKIMAPIA_API_KEY', '').strip())
    if not key:
        parser.error('Set WIKIMAPIA_API_KEY, --ask-key or --example')
    results, last_start = [], None
    for method in METHODS:
        if last_start is not None:
            time.sleep(max(0, 6 - (time.monotonic() - last_start)))
        last_start = time.monotonic()
        summary, data = request(method, api_url(method, key, bbox=TEST_BBOX, coordsby='bbox', page=1, count=5))
        results.append(safe_summary(method, summary, data))
    report = {
        'method_comparison': results,
        'automatic_fallback_enabled': False,
        'note': 'Results describe this run only; do not imply future API availability.',
    }
    with open(args.out,'w',encoding='utf-8') as out:
        json.dump(report,out,indent=2,ensure_ascii=False)
    print(json.dumps(report,indent=2,ensure_ascii=False))
    return 0 if all(entry['verified_geometry'] for entry in results) else 1


if __name__ == '__main__':
    raise SystemExit(main())
