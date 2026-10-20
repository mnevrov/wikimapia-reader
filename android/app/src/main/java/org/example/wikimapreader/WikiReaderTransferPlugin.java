package org.example.wikimapreader;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Storage Access Framework: user chooses the destination/source, no storage permission. */
@CapacitorPlugin(name="WikiReaderTransfer")
public class WikiReaderTransferPlugin extends Plugin {
    private static final int MAX_BYTES=10*1048576;
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    @Override protected void handleOnDestroy(){worker.shutdown();}
    @PluginMethod public void share(PluginCall call) {
        String url=call.getString("url");
        if(url==null||!url.matches("https://wikimapia\\.org/[1-9][0-9]*/")) {
            call.reject("Некорректная ссылка", "INVALID_URL");return;
        }
        Intent intent=new Intent(Intent.ACTION_SEND);
        intent.setType("text/plain");
        intent.putExtra(Intent.EXTRA_TEXT,url);
        startActivityForResult(call,Intent.createChooser(intent,"Поделиться объектом Wikimapia"),"shared");
    }
    @ActivityCallback private void shared(PluginCall call,ActivityResult result){call.resolve();}
    @PluginMethod public void save(PluginCall call) {
        String content=call.getString("content");
        if(content==null||content.getBytes(StandardCharsets.UTF_8).length>MAX_BYTES){call.reject("Файл слишком велик","TOO_LARGE");return;}
        String name=call.getString("name","wikireader-library.json");
        if(!name.matches("wikireader-library-[0-9]{4}-[0-9]{2}-[0-9]{2}\\.json"))name="wikireader-library.json";
        Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE,name);
        startActivityForResult(call,intent,"saved");
    }
    @ActivityCallback private void saved(PluginCall call,ActivityResult result){
        if(result.getResultCode()!=Activity.RESULT_OK||result.getData()==null||result.getData().getData()==null){call.reject("Сохранение отменено","CANCELLED");return;}
        Uri uri=result.getData().getData();
        String content=call.getString("content");
        worker.execute(()->{
            try(OutputStream out=getContext().getContentResolver().openOutputStream(uri,"w")){
                if(out==null)throw new java.io.IOException();
                out.write(content.getBytes(StandardCharsets.UTF_8));out.flush();call.resolve();
            }catch(Exception e){call.reject("Не удалось сохранить файл","WRITE_FAILED");}
        });
    }
    @PluginMethod public void open(PluginCall call){
        Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"application/json","text/plain","application/octet-stream"});
        startActivityForResult(call,intent,"opened");
    }
    @ActivityCallback private void opened(PluginCall call,ActivityResult result){
        if(result.getResultCode()!=Activity.RESULT_OK||result.getData()==null||result.getData().getData()==null){call.reject("Выбор отменён","CANCELLED");return;}
        Uri uri=result.getData().getData();
        worker.execute(()->{
            try(InputStream in=getContext().getContentResolver().openInputStream(uri);
                ByteArrayOutputStream out=new ByteArrayOutputStream()){
                if(in==null)throw new java.io.IOException();
                byte[] buffer=new byte[8192];int count;
                while((count=in.read(buffer))!=-1){
                    if(out.size()+count>MAX_BYTES){call.reject("Файл слишком велик","TOO_LARGE");return;}
                    out.write(buffer,0,count);
                }
                JSObject data=new JSObject();
                data.put("content",out.toString(StandardCharsets.UTF_8.name()));
                call.resolve(data);
            }catch(Exception e){call.reject("Не удалось прочитать файл","READ_FAILED");}
        });
    }
}
