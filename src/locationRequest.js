import {acceptableFix} from './gpsFollow.js';

function abortError() {
  const error=new Error('Location request cancelled');
  error.name='AbortError';
  return error;
}

function permissionDenied(error) {
  return error?.code===1 || /permission|denied|разрешени/i.test(String(error?.message??''));
}

/**
 * Obtain one position through the same native stream as GPS Follow.
 * An ordinary watch timeout can be transient; wait for a valid fix, but
 * stop on permission denial, explicit cancellation or the overall deadline.
 * Always unregister the temporary native watcher, including an early callback
 * arriving before watchPosition resolves its watcher ID.
 */
export function acquirePosition(geolocation,{signal,timeoutMs=22000}={}) {
  if(signal?.aborted)return Promise.reject(abortError());
  return new Promise((resolve,reject)=>{
    let settled=false,watchId=null;
    const stopWatch=()=>{
      if(watchId!==null) {
        const id=watchId;watchId=null;
        Promise.resolve().then(()=>geolocation.clearWatch({id})).catch(()=>{});
      }
    };
    const cleanup=()=>{
      clearTimeout(timer);
      signal?.removeEventListener('abort',abort);
      stopWatch();
    };
    const finish=(position,error)=>{
      if(settled)return;
      settled=true;cleanup();
      if(error)reject(error);else resolve(position);
    };
    const abort=()=>finish(null,abortError());
    const timer=setTimeout(()=>finish(null,new Error('Location request timed out')),timeoutMs);
    signal?.addEventListener('abort',abort,{once:true});
    Promise.resolve().then(()=>geolocation.watchPosition({
      enableHighAccuracy:false,
      timeout:15000,
      interval:3000,
      maximumAge:30000,
      minimumUpdateInterval:1000
    },(position,error)=>{
      if(settled)return;
      if(error){
        if(permissionDenied(error))finish(null,error);
        return;
      }
      if(acceptableFix(position?.coords))finish(position);
    })).then(id=>{
      if(id==null){finish(null,new Error('Geolocation watch unavailable'));return;}
      watchId=id;
      if(settled)stopWatch();
    }).catch(error=>finish(null,error));
  });
}
