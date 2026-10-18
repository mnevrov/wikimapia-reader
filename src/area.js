import {normalizeArea, diagnosticError, ApiError} from './api.js';
import {CACHE_MAX_AGE} from './areaCache.js';

const CACHE_AGE = 5 * 60 * 1000;
const contains = (a,b) => a[0]<=b[0] && a[1]<=b[1] && a[2]>=b[2] && a[3]>=b[3];
const intersects = (a,b) => a[0]<=b[2] && a[2]>=b[0] && a[1]<=b[3] && a[3]>=b[1];

// One instance per key/mode. Cache has a size and age limit; no credentials are stored.
export class AreaLoader {
  constructor(call, notify = () => {}, store = null) {
    this.store = store;
    this.call = call;
    this.notify = notify;
    this.cache = new Map();
    this.sequence = 0;
    this.state = {places:[], displayPlaces:[], page:0, found:null, more:false, loading:false, error:'', retryable:false};
  }
  publish(patch) { this.state = {...this.state, ...patch}; this.notify(this.state); }
  stop() {
    this.sequence++;
    this.controller?.abort();
    if (this.state.loading) this.publish({loading:false});
  }
  invalidate() {
    this.stop();
    this.publish({more:false});
  }
  prune() {
    for (const [key,entry] of this.cache) if (Date.now()-entry.updated>=CACHE_MAX_AGE) this.cache.delete(key);
  }
  visibleCached() {
    const unique = new Map();
    for (const entry of this.cache.values()) {
      if (intersects(entry.bbox,this.view)) for (const place of entry.state.places) unique.set(place.id,place);
    }
    return [...unique.values()];
  }
  async load(bbox, {force = false, view = bbox} = {}) {
    this.stop();
    const n=this.sequence;
    if (this.store && !this.hydrated) {
      try {
        const entries=await this.store.read();
        if(n!==this.sequence)return;
        for(const entry of [...entries].sort((a,b)=>a.updated-b.updated))this.cache.set(entry.bbox.join(','),entry);
      } catch {} // Storage unavailable: network and in-memory navigation still work.
      if(n!==this.sequence)return;
      this.hydrated=true;
    }
    this.view = [...view];
    this.prune();
    if (!force) {
      const entry = [...this.cache.values()].reverse().find(e=>Date.now()-e.updated<CACHE_AGE && contains(e.bbox,view));
      if (entry) {
        this.bbox = [...entry.bbox];
        this.cacheKey = this.bbox.join(',');
        this.publish({...entry.state, displayPlaces:this.visibleCached(), error:'', retryable:false, loading:false});
        return;
      }
    }
    this.bbox = [...bbox];
    this.cacheKey = bbox.join(',');
    this.publish({places:[],displayPlaces:this.visibleCached(),page:0,found:null,more:false,error:'',retryable:false});
    await this.fetchPage(1);
  }
  async more() {
    if (!this.state.more || this.state.loading) return;
    await this.fetchPage(this.state.page + 1);
  }
  async fetchPage(page) {
    const n = ++this.sequence;
    this.controller?.abort();
    this.controller = new AbortController();
    this.publish({loading:true,error:'',retryable:false});
    try {
      const payload = await this.call({bbox:this.bbox,page,signal:this.controller.signal});
      if (n !== this.sequence) return;
      const items = normalizeArea(payload);
      const unique = new Map(this.state.places.map(p=>[p.id,p]));
      for (const p of items) unique.set(p.id,p);
      const places = [...unique.values()];
      const rawFound = Number(payload.found);
      const found = payload.found != null && Number.isSafeInteger(rawFound) && rawFound >= 0 ? rawFound : null;
      // A repeated/empty page must not create an endless "more" loop.
      const progress = places.length > this.state.places.length;
      const more = progress && items.length > 0 && (found !== null ? places.length < found : items.length === 50);
      const state = {places,page,found,more,loading:false,error:'',retryable:false};
      this.cache.delete(this.cacheKey);
      this.cache.set(this.cacheKey,{bbox:[...this.bbox],state,updated:Date.now()});
      while (this.cache.size > 8) this.cache.delete(this.cache.keys().next().value);
      this.publish({...state,displayPlaces:this.visibleCached()});
      try { await this.store?.put(this.cache.get(this.cacheKey)); } catch {}
    } catch (error) {
      if (n !== this.sequence) return;
      // Authentication, quota and invalid payloads need deliberate user action.
      const message=String(error?.message??'');
      const retryable=!(error instanceof ApiError) && !/401|403|429|limit|quota/i.test(message);
      this.publish({loading:false,error:diagnosticError(error),retryable});
    }
  }
}
