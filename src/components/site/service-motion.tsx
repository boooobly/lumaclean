'use client';

import {useEffect} from 'react';

/** Progressive enhancement for the shared service template. Content is visible without JS. */
export function ServiceMotion() {
  useEffect(() => {
    const root=document.querySelector<HTMLElement>('.service-page');
    if(!root||!window.matchMedia||!('animate' in Element.prototype))return;
    const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
    const reveals=new Set<Animation>();
    const disclosures=new Map<HTMLDetailsElement,{animation:Animation;expanded:boolean}>();
    let observer:IntersectionObserver|undefined;
    const stop=()=>{
      observer?.disconnect();
      reveals.forEach(animation=>animation.cancel());reveals.clear();
      disclosures.forEach(({animation,expanded},details)=>{
        animation.cancel();details.open=expanded;details.style.overflow='';
      });
      disclosures.clear();
    };
    const start=()=>{
      stop();
      if(preference.matches||!('IntersectionObserver' in window))return;
      try{
        observer=new IntersectionObserver(entries=>{
          for(const entry of entries){
            if(!entry.isIntersecting)continue;
            observer?.unobserve(entry.target);
            try{
              const animation=entry.target.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:360,easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'});
              reveals.add(animation);animation.finished.then(()=>reveals.delete(animation),()=>reveals.delete(animation));
            }catch{/* Server-rendered content stays visible. */}
          }
        },{threshold:0.08,rootMargin:'0px 0px -20px 0px'});
        root.querySelectorAll('.service-overview-copy,.service-pricing-grid,.service-scope-visual,.service-included-list li,.service-detail-grid article,.service-brief li,.service-faq details,.service-related nav a,.service-reading-grid article').forEach(element=>observer!.observe(element));
      }catch{observer?.disconnect();}
    };
    const summaries=[...root.querySelectorAll<HTMLElement>('.service-faq summary')];
    const toggle=(event:MouseEvent)=>{
      if(preference.matches)return;
      const summary=event.currentTarget as HTMLElement;
      const details=summary.parentElement as HTMLDetailsElement;
      const active=disclosures.get(details);
      const expanded=active?!active.expanded:!details.open;
      const from=details.getBoundingClientRect().height;
      if(active){active.animation.cancel();disclosures.delete(details);}
      details.open=true;
      const style=getComputedStyle(details);
      const to=expanded?details.getBoundingClientRect().height:summary.getBoundingClientRect().height+parseFloat(style.borderTopWidth)+parseFloat(style.borderBottomWidth);
      try{
        const animation=details.animate([{height:`${from}px`},{height:`${to}px`}],{duration:240,easing:'cubic-bezier(.22,1,.36,1)'});
        event.preventDefault();details.style.overflow='hidden';
        disclosures.set(details,{animation,expanded});
        const finish=()=>{
          if(disclosures.get(details)?.animation!==animation)return;
          details.open=expanded;details.style.overflow='';disclosures.delete(details);
        };
        animation.finished.then(finish,finish);
      }catch{details.open=expanded;details.style.overflow='';event.preventDefault();}
    };
    summaries.forEach(summary=>summary.addEventListener('click',toggle));
    preference.addEventListener('change',start);start();
    return()=>{stop();summaries.forEach(summary=>summary.removeEventListener('click',toggle));preference.removeEventListener('change',start);};
  },[]);
  return null;
}
