import {normalizeArea, diagnosticError, classifyApiFailure} from './api.js';
import {CACHE_MAX_AGE} from './areaCache.js';
import {isCovered,contains,intersects} from './coverage.js';

const CACHE_AGE = 5 * 60 * 1000;
const complete=e=>e.state.complete??(!e.state.more&&(e.state.found!=null?e.state.places.length>=e.state.found:e.state.places.length<50));


// One instance per key/mode. Cache has a size and age limit; no credentials are stored.
export class AreaLoader {
  constructor(call, notify = () => {}, store = null) {
    this.store = store;
    this.call = call;
    this.notify = notify;
    this.cache = new Map();
    this.sequence = 0;
    this.continuation = 0;
    this.state = {places:[], displayPlaces:[], page:0, found:null, more:false, loading:false, error:'', failureKind:null,retryable:false,failureKind:null,background:false,draining:false,batchLimited:false,cacheIds:[]};
  }
  publish(patch) { this.state = {...this.state, ...patch}; this.notify(this.state); }
  stop() {
    this.sequence++;
    this.continuation++;
    this.controller?.abort();
    if (this.state.loading || this.state.draining) this.publish({loading:false,background:false,draining:false});
  }
  invalidate() {
    this.stop();
    this.publish({more:false});
  }
  prune() {
    for (const [key,entry] of this.cache) if (!entry.pinned&&Date.now()-entry.updated>=(entry.retentionDays??1)*CACHE_MAX_AGE) this.cache.delete(key);
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
    const fresh=[...this.cache.values()].filter(e=>Date.now()>=e.updated&&Date.now()-e.updated<CACHE_AGE);
    const inMemoryFresh=fresh.some(e=>(complete(e)||e.state.more)&&contains(e.bbox,view))||isCovered(view,fresh.filter(complete).map(e=>e.bbox));
    if (this.store && (!this.hydrated || (!force && !inMemoryFresh))) {
      try {
        const entries=await this.store.read();
        if(n!==this.sequence)return;
        for(const entry of entries) {
          const key=entry.bbox.join(',');
          if(!this.cache.has(key)||this.cache.get(key).updated<=entry.updated)this.cache.set(key,entry);
        }
        this.cache=new Map([...this.cache.entries()].sort((a,b)=>a[1].updated-b[1].updated));
      } catch {} // Storage unavailable: network and in-memory navigation still work.
      if(n!==this.sequence)return;
      this.hydrated=true;
    }
    this.view = [...view];
    this.prune();
    if (!force) {
      const entry = [...this.cache.values()].reverse().find(e=>Date.now()>=e.updated&&Date.now()-e.updated<CACHE_AGE&&(complete(e)||e.state.more)&&contains(e.bbox,view));
      if (entry) {
        this.bbox = [...entry.bbox];
        this.cacheKey = this.bbox.join(',');
        this.publish({...entry.state, displayPlaces:this.visibleCached(), cacheIds:[this.cacheKey],error:'', failureKind:null,retryable:false, loading:false,background:false,batchLimited:false});
        return;
      }
    }
    if (!force) {
      const coverageEntries=[...this.cache.values()].filter(e=>Date.now()>=e.updated&&Date.now()-e.updated<CACHE_AGE&&complete(e)&&intersects(e.bbox,view));
      if(isCovered(view,coverageEntries.map(e=>e.bbox))){
        this.bbox=[...view];this.cacheKey=null;
        const displayPlaces=this.visibleCached();
        this.publish({places:displayPlaces,displayPlaces,page:1,found:null,more:false,loading:false,error:'',failureKind:null,retryable:false,background:false,batchLimited:false,cacheIds:coverageEntries.map(e=>e.bbox.join(','))});
        return;
      }
    }
    this.bbox = [...bbox];
    this.cacheKey = bbox.join(',');
    const displayPlaces=this.visibleCached();
    this.publish({places:[],displayPlaces,page:0,found:null,more:false,error:'',failureKind:null,retryable:false,batchLimited:false,cacheIds:[...this.cache.values()].filter(e=>intersects(e.bbox,view)).map(e=>e.bbox.join(','))});
    await this.fetchPage(1);
  }
  async more() {
    if (!this.state.more || this.state.loading) return;
    await this.fetchPage(this.state.page + 1);
  }
  // Explicit user action: continue sequentially, without repeated taps. Keep a
  // finite budget for inconsistent/changing API result sets. Navigation cancels it.
  async remaining() {
    if (!this.state.more || this.state.loading || this.state.draining) return;
    const token = ++this.continuation;
    this.publish({draining:true,batchLimited:false});
    let requests = 0;
    while (token === this.continuation && this.state.more && requests < 20) {
      await this.more();
      requests++;
      if (this.state.error) break;
    }
    if (token === this.continuation) this.publish({draining:false,batchLimited:requests===20&&this.state.more&&!this.state.error});
  }
  async fetchPage(page) {
    const n = ++this.sequence;
    this.controller?.abort();
    this.controller = new AbortController();
    this.publish({loading:true,background:this.state.displayPlaces.some(p=>p.coords.length>=3)||this.state.page>0,error:'',failureKind:null,retryable:false});
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
      // Repeated/empty pages cannot prove completeness when the server reports more.
      const fullyLoaded=found!==null?places.length>=found:(items.length<50);
      const state = {places,page,found,more,complete:fullyLoaded,loading:false,background:false,error:'',failureKind:null,retryable:false};
      const key=this.cacheKey,old=this.cache.get(key);
      const record={bbox:[...this.bbox],state,updated:Date.now(),pinned:old?.pinned??false,retentionDays:old?.retentionDays??1};
      this.cache.delete(key);
      this.cache.set(key,record);
      while (this.cache.size > 8) this.cache.delete(this.cache.keys().next().value);
      this.publish({...state,displayPlaces:this.visibleCached(),cacheIds:[key]});
      try { await this.store?.put(record); } catch {}
    } catch (error) {
      if (n !== this.sequence) return;
      // Authentication, quota and invalid payloads need deliberate user action.
      const failureKind=classifyApiFailure(error, {offline:typeof navigator !== 'undefined' && navigator.onLine === false});
      const retryable=['network','timeout','unknown'].includes(failureKind);
      this.publish({loading:false,background:false,error:failureKind === 'offline'?'Нет подключения к интернету. Ранее сохранённые объекты доступны офлайн.':diagnosticError(error),failureKind,retryable});
    }
  }
}
