import {normalizeArea, diagnosticError} from './api.js';

// One instance per key/mode. Bounded in-memory cache never stores credentials.
export class AreaLoader {
  constructor(call, notify = () => {}) {
    this.call = call;
    this.notify = notify;
    this.cache = new Map();
    this.sequence = 0;
    this.state = {places:[], page:0, found:null, more:false, loading:false, error:''};
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
  async load(bbox, {force = false} = {}) {
    this.stop();
    this.bbox = [...bbox];
    this.cacheKey = bbox.map(v=>v.toFixed(6)).join(',');
    const cached = this.cache.get(this.cacheKey);
    if (cached && !force) { this.publish({...cached, error:'', loading:false}); return; }
    this.publish({places:[],page:0,found:null,more:false,error:''});
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
    this.publish({loading:true,error:''});
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
      this.publish({places,page,found,more,loading:false,error:''});
      this.cache.delete(this.cacheKey);
      this.cache.set(this.cacheKey,{...this.state});
      while (this.cache.size > 8) this.cache.delete(this.cache.keys().next().value);
    } catch (error) {
      if (n !== this.sequence) return;
      this.publish({loading:false,error:diagnosticError(error)});
    }
  }
}
