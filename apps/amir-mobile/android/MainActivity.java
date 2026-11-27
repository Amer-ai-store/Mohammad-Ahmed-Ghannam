package com.amer.store;
import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;
import android.webkit.*;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.graphics.Color;

public class MainActivity extends Activity {
 private static final String HOST="amir-ai-store.vercel.app";
 private WebView web;
 private TextView status;
 private boolean allowed(Uri uri) {
  return "https".equals(uri.getScheme()) && HOST.equalsIgnoreCase(uri.getHost()) && (uri.getPort()==-1||uri.getPort()==443);
 }
 @Override public void onCreate(Bundle b) {
  super.onCreate(b);
  LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);
  status=new TextView(this);status.setText("Amir AI Store");status.setTextColor(Color.WHITE);status.setBackgroundColor(Color.rgb(24,117,48));status.setPadding(20,12,20,12);root.addView(status);
  web=new WebView(this);root.addView(web,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,0,1));setContentView(root);
  WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setJavaScriptCanOpenWindowsAutomatically(false);s.setSupportMultipleWindows(false);s.setGeolocationEnabled(false);
  CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest req){Uri uri=req.getUrl();if(!req.isForMainFrame())return !allowed(uri);if(allowed(uri))return false;if("https".equals(uri.getScheme()))try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception e){status.setText("تعذر فتح الرابط الخارجي");}return true;}
   @Override public void onPageFinished(WebView v,String url){status.setText("Amir AI Store | أسواق جوافة");}
   @Override public void onReceivedError(WebView v,WebResourceRequest req,WebResourceError e){if(req.isForMainFrame())status.setText("تعذر الاتصال — تحقق من الإنترنت ثم أعد فتح التطبيق");}
  });
  if(b==null)web.loadUrl("https://"+HOST+"/?source=android");else web.restoreState(b);
 }
 @Override protected void onSaveInstanceState(Bundle b){web.saveState(b);super.onSaveInstanceState(b);}
 @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else super.onBackPressed();}
 @Override protected void onDestroy(){if(web!=null){web.stopLoading();web.destroy();}super.onDestroy();}
}
