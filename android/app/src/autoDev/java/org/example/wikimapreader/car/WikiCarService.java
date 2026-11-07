package org.example.wikimapreader.car;
import androidx.annotation.NonNull;
import androidx.car.app.*;
import androidx.car.app.validation.HostValidator;
import org.example.wikimapreader.BuildConfig;
public final class WikiCarService extends CarAppService {
 @NonNull @Override public HostValidator createHostValidator(){if(BuildConfig.DEBUG)return HostValidator.ALLOW_ALL_HOSTS_VALIDATOR;return new HostValidator.Builder(this).addAllowedHosts(androidx.car.app.R.array.hosts_allowlist_sample).build();}
 @NonNull @Override public Session onCreateSession(){return new WikiSession();}
}
