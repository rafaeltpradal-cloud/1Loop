// Tema: claro, escuro ou do sistema (segue o aparelho, que pode trocar sozinho de dia e de noite).
// A escolha fica salva no navegador. O script abaixo roda antes da página aparecer, para não piscar.

export type ThemePref = 'light' | 'dark' | 'system';
export const THEME_KEY = '1loop-theme';
export const DEFAULT_THEME: ThemePref = 'light';

export const THEME_SCRIPT = `(function(){
  var KEY='${THEME_KEY}', DEF='${DEFAULT_THEME}';
  var mq=window.matchMedia?window.matchMedia('(prefers-color-scheme: dark)'):null;
  function read(){try{var v=localStorage.getItem(KEY);return v==='light'||v==='dark'||v==='system'?v:DEF;}catch(e){return DEF;}}
  function apply(pref){
    pref=pref||read();
    var dark=pref==='dark'||(pref==='system'&&!!mq&&mq.matches);
    var el=document.documentElement;
    el.setAttribute('data-theme',dark?'dark':'light');
    el.setAttribute('data-theme-pref',pref);
  }
  window.__setTheme=function(pref){try{localStorage.setItem(KEY,pref);}catch(e){}apply(pref);};
  window.__getTheme=read;
  apply();
  if(mq){var on=function(){if(read()==='system')apply('system');};if(mq.addEventListener)mq.addEventListener('change',on);else if(mq.addListener)mq.addListener(on);}
})();`;
