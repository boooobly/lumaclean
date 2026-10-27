'use client';

import Image from 'next/image';
import {useCallback,useEffect,useId,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';

const floatingQuery='(min-width: 1000px) and (hover: hover) and (pointer: fine)';
const subscribe=(listener:()=>void)=>{
  const media=window.matchMedia(floatingQuery);
  media.addEventListener('change',listener);
  return()=>media.removeEventListener('change',listener);
};
const floatingSnapshot=()=>window.matchMedia(floatingQuery).matches;
const serverSnapshot=()=>false;

type ExtraItem={id:string;title:string;price:string;description:string;image:string};

export function ExtrasLedger({items,hint,closeLabel}:{items:ExtraItem[];hint:string;closeLabel:string}) {
  const [activeId,setActiveId]=useState<string|null>(null);
  const floating=useSyncExternalStore(subscribe,floatingSnapshot,serverSnapshot);
  const prefix=useId();
  const root=useRef<HTMLDivElement>(null);
  const rail=useRef<HTMLDivElement>(null);
  const card=useRef<HTMLElement>(null);
  const buttons=useRef(new Map<string,HTMLButtonElement>());
  const currentId=useRef<string|null>(null);
  const pinned=useRef(false);
  const ignoreFocus=useRef(false);
  const restoreFocusTo=useRef<HTMLButtonElement|null>(null);
  const lastPointer=useRef<{x:number;y:number}|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const active=items.find(item=>item.id===activeId);

  const cancelClose=useCallback(()=>{
    if(timer.current!==null)clearTimeout(timer.current);
    timer.current=null;
  },[]);
  const close=useCallback((restoreFocus=false)=>{
    cancelClose();
    const button=currentId.current?buttons.current.get(currentId.current):undefined;
    restoreFocusTo.current=restoreFocus&&button?button:null;
    currentId.current=null;
    pinned.current=false;
    setActiveId(null);
  },[cancelClose]);
  const show=(id:string,keepOpen=false)=>{
    cancelClose();
    pinned.current=keepOpen;
    currentId.current=id;
    setActiveId(id);
  };
  const scheduleClose=()=>{
    if(pinned.current)return;
    cancelClose();
    timer.current=setTimeout(()=>close(),180);
  };

  useEffect(()=>()=>cancelClose(),[cancelClose]);
  useEffect(()=>{
    const track=(event:PointerEvent)=>{if(event.pointerType==='mouse')lastPointer.current={x:event.clientX,y:event.clientY};};
    document.addEventListener('pointermove',track,{passive:true});
    return()=>document.removeEventListener('pointermove',track);
  },[]);
  useEffect(()=>{
    if(!activeId)return;
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key!=='Escape')return;
      const ownsFocus=root.current?.contains(document.activeElement)??false;
      if(ownsFocus){event.preventDefault();event.stopPropagation();}
      close(ownsFocus);
    };
    const onPointerDown=(event:PointerEvent)=>{
      if(!root.current?.contains(event.target as Node))close();
    };
    const onFocusIn=(event:FocusEvent)=>{
      // Safari can blur a row to body when a mouse presses a native button.
      // Wait for the actual next focus target instead of removing that button mid-click.
      if(event.target!==document.body&&event.target!==document.documentElement&&!root.current?.contains(event.target as Node))close();
    };
    document.addEventListener('keydown',onKeyDown,true);
    document.addEventListener('pointerdown',onPointerDown);
    document.addEventListener('focusin',onFocusIn);
    return()=>{
      document.removeEventListener('keydown',onKeyDown,true);
      document.removeEventListener('pointerdown',onPointerDown);
      document.removeEventListener('focusin',onFocusIn);
    };
  },[activeId,close]);

  useLayoutEffect(()=>{
    if(!activeId){
      const button=restoreFocusTo.current;
      restoreFocusTo.current=null;
      if(button){
        ignoreFocus.current=true;
        button.focus({preventScroll:true});
        button.scrollIntoView({block:'nearest',behavior:'instant'});
        ignoreFocus.current=false;
      }
      return;
    }
    if(!card.current)return;
    // Keep a bottom-edge fallback inline until this card is closed or replaced.
    // This avoids moving the list back and forth while the visitor scrolls.
    let inlineFallback=false;
    const place=()=>{
      const panel=card.current,space=rail.current,button=buttons.current.get(activeId);
      if(!panel||!space||!button)return;
      const inline=()=>{
        panel.dataset.floating='false';
        panel.style.removeProperty('width');
        panel.style.removeProperty('left');
        panel.style.removeProperty('top');
      };
      if(!floating||inlineFallback){inline();return;}
      const target=button.getBoundingClientRect(),area=space.getBoundingClientRect();
      if(target.bottom<96||target.top>window.innerHeight){close();return;}
      panel.dataset.floating='true';
      const width=Math.min(360,area.width,window.innerWidth-32);
      panel.style.width=`${width}px`;
      const height=panel.getBoundingClientRect().height;
      const topEdge=Math.max(96,area.top);
      const bottomEdge=Math.min(window.innerHeight-16,area.bottom)-height;
      if(bottomEdge<topEdge){inlineFallback=true;inline();return;}
      const left=Math.max(16,Math.min(area.left,window.innerWidth-width-16));
      const top=Math.min(bottomEdge,Math.max(topEdge,target.top+(target.height-height)/2));
      panel.style.left=`${left}px`;
      panel.style.top=`${top}px`;
    };
    place();
    let frame:number|null=null;
    const schedule=()=>{
      if(frame!==null)return;
      frame=requestAnimationFrame(()=>{frame=null;place();});
    };
    const observer=new ResizeObserver(schedule);
    observer.observe(card.current);
    if(rail.current)observer.observe(rail.current);
    window.addEventListener('resize',schedule);
    window.addEventListener('scroll',schedule,true);
    return()=>{
      observer.disconnect();
      if(frame!==null)cancelAnimationFrame(frame);
      window.removeEventListener('resize',schedule);
      window.removeEventListener('scroll',schedule,true);
    };
  },[activeId,floating,close]);

  return (
    <div className="extras-experience" ref={root} data-floating-enabled={floating} onPointerEnter={cancelClose} onPointerLeave={scheduleClose}>
      <p className="extras-ledger-hint">{hint}</p>
      <div className="extras-ledger extras-ledger-interactive">
        {items.map((item,index)=>{
          const expanded=activeId===item.id;
          const buttonId=`${prefix}-${item.id}`;
          return (
            <div className="extra-ledger-row" key={item.id} data-extra={item.id}>
              <button type="button" className="extra-ledger-trigger" id={buttonId}
                ref={element=>{if(element)buttons.current.set(item.id,element);else buttons.current.delete(item.id);}}
                aria-expanded={expanded} aria-controls={expanded?`${prefix}-preview`:undefined} aria-describedby={`${buttonId}-description`}
                onPointerEnter={event=>{
                  // Focus scrolling can move a different row under a stationary mouse.
                  const keyboardFocus=root.current?.contains(document.activeElement)&&document.activeElement?.matches(':focus-visible');
                  const point=lastPointer.current;
                  const stationary=point&&Math.abs(point.x-event.clientX)<2&&Math.abs(point.y-event.clientY)<2;
                  if(floating&&event.pointerType==='mouse'&&!(keyboardFocus&&stationary))show(item.id);
                }}
                onFocus={event=>{
                  if(floating&&!ignoreFocus.current&&event.currentTarget.matches(':focus-visible')){
                    event.currentTarget.scrollIntoView({block:'nearest',behavior:'instant'});
                    show(item.id,true);
                  }
                }}
                onClick={()=>{if(expanded&&pinned.current)close();else show(item.id,true);}}>
                <span className="extra-ledger-number" aria-hidden="true">{String(index+1).padStart(2,'0')}</span>
                <strong>{item.title}</strong><small>{item.price}</small>
                <i aria-hidden="true">{expanded?'−':'+'}</i>
              </button>
              <span id={`${buttonId}-description`} className="rate-sr-only">{item.description}</span>
              {expanded&&active&&<section key={item.id} ref={card} className="extra-info-card" id={`${prefix}-preview`} aria-labelledby={`${buttonId}-title`}
                onPointerEnter={cancelClose} onFocusCapture={()=>{cancelClose();pinned.current=true;}}>
                <Image src={active.image} alt="" fill sizes="(max-width: 600px) calc(100vw - 36px), 480px" loading="eager"/>
                <div className="extra-info-caption"><h3 id={`${buttonId}-title`}>{active.title}</h3><p>{active.description}</p></div>
                <button type="button" className="extra-info-close" aria-label={closeLabel} onClick={()=>close(true)}>×</button>
              </section>}
            </div>
          );
        })}
      </div>
      <div className="extra-preview-rail" ref={rail} aria-hidden="true"/>
    </div>
  );
}
