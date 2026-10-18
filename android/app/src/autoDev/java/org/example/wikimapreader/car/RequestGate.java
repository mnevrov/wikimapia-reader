package org.example.wikimapreader.car;
/** One gate shared by every phone/car request in this process. Monotonic milliseconds. */
public final class RequestGate {
 private long next;
 public synchronized long available(long now){return Math.max(now,next);}
 public synchronized long reserve(long now){long at=Math.max(now,next);next=at+6000;return at;}
 public synchronized void backoff(long now,long delay){next=Math.max(next,now+Math.max(6000,delay));}
}
