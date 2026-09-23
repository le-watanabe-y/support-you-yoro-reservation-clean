"use client";
import { useEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Tabs as BaseTabs } from '@/components/ui/tabs';

// Only explicit navigation reveals a section. Background refreshes must never
// move the reader or discard the active form, including after tab suspension.
export function revealNow(element: HTMLElement | null) {
 if (!element?.isConnected || !element.getClientRects().length) return;
 const target = element.matches('h1,h2,h3,summary,[data-step-heading]') ? element : element.querySelector<HTMLElement>('[data-step-heading],h1,h2,h3,summary') || element;
 if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
 target.focus({preventScroll:true});
 target.scrollIntoView({block:'start',behavior:'instant'});
}
export function revealAfterRender(find: () => HTMLElement | null) {
 let second = 0;
 const first = requestAnimationFrame(() => {second = requestAnimationFrame(() => revealNow(find()));});
 return () => {cancelAnimationFrame(first);cancelAnimationFrame(second);};
}
export function revealById(id: string) { return revealAfterRender(() => document.getElementById(id)); }

export function useStepFocus<T extends HTMLElement>(step: unknown, onMount = false) {
 const ref = useRef<T>(null), previous = useRef(step);
 useEffect(() => {
  const changed = previous.current !== step;
  previous.current = step;
  if (onMount || changed) return revealAfterRender(() => ref.current);
 }, [step,onMount]);
 return ref;
}

export function Reveal({children,title,id}:{children:ReactNode,title?:string,id?:string}) {
 const ref = useStepFocus<HTMLDivElement>('open',true), titleId = useId();
 return <div id={id} ref={ref} className="revealed-step" tabIndex={-1} aria-labelledby={title?titleId:undefined}>{title&&<h3 id={titleId} data-step-heading tabIndex={-1}>{title}</h3>}{children}</div>;
}

export function Details({children,...props}:ComponentProps<'details'>) {
 return <details {...props} onToggle={e=>{props.onToggle?.(e);const element=e.currentTarget;if(element.open)revealAfterRender(()=>element.querySelector<HTMLElement>('summary'));}}>{children}</details>;
}

export function WorkflowTabs(props:ComponentProps<typeof BaseTabs>) {
 const ref=useRef<HTMLDivElement>(null);
 return <div ref={ref}><BaseTabs activationMode="manual" {...props} onValueChange={value=>{props.onValueChange?.(value);revealAfterRender(()=>ref.current?.querySelector<HTMLElement>('[role="tabpanel"][data-state="active"]')||null);}}/></div>;
}

export function GuidedForm({children,onSubmit,...props}:ComponentProps<'form'>) {
 const [error,setError]=useState(''),id=useId();
 return <form {...props} noValidate onSubmit={e=>{
  // Custom selects/checkboxes contain native inputs that mobile browsers cannot
  // focus. Validate them explicitly and move to their visible labelled control.
  const invalid=Array.from(e.currentTarget.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>('input,select,textarea')).find(input=>input.willValidate&&!input.validity.valid);
  if(invalid){
   e.preventDefault();
   const group=invalid.closest<HTMLElement>('.field,.check')||invalid;
   const name=invalid.getAttribute('aria-label')||group.querySelector('.field-label')?.textContent||group.querySelector('span')?.textContent||'入力内容';
   setError(`${name}を確認してください。入力が不足しているか、形式が合っていません。`);
   const control=group.querySelector<HTMLElement>('[role="combobox"],[role="checkbox"],input:not([type="hidden"]),textarea')||group;
   control.setAttribute('aria-invalid','true');control.setAttribute('aria-describedby',id);
   revealAfterRender(()=>control);return;
  }
  setError('');onSubmit?.(e);
 }} onChange={e=>{props.onChange?.(e);e.currentTarget.querySelectorAll('[aria-invalid="true"]').forEach(node=>{node.removeAttribute('aria-invalid');node.removeAttribute('aria-describedby');});setError('');}}>
  {children}
  {error&&<p id={id} role="alert" className="error form-error">{error}</p>}
 </form>;
}
