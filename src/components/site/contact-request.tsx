"use client";

import {useRef, useState} from 'react';
import {isValidPhoneNumber} from 'libphonenumber-js/min';
import type {Locale} from '@/i18n/routing';
import type {EditorialContent} from '@/lib/site-content';
import {homepageUxCopy} from '@/lib/homepage-ux-content';
import {leadAttribution, trackEvent} from '@/lib/analytics';
import {ArrowIcon} from './arrow-icon';

export function ContactRequest({locale, copy}: {locale: Locale; copy: EditorialContent['estimate']}) {
  const c = homepageUxCopy[locale];
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<'idle'|'sending'|'success'|'validation'|'error'>('idle');
  const busy = useRef(false);
  const started = useRef(false);
  const submission = useRef<{id: string; payload: string} | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || status === 'success') return;
    if (!isValidPhoneNumber(phone, 'RS') || !consent) {
      setStatus('validation'); trackEvent('lead_error', {locale, error_type: 'validation'}); return;
    }
    busy.current = true; setStatus('sending');
    // Freeze attribution along with the payload across timeout retries.
    const fields = JSON.stringify({phone: phone.trim(), consent, locale, requestKind: 'CONTACT_REQUEST'});
    if (!submission.current || JSON.parse(submission.current.payload).fields !== fields) {
      submission.current = {id: crypto.randomUUID(), payload: JSON.stringify({fields, attribution: leadAttribution()})};
    }
    try {
      const response = await fetch('/api/lead', {method: 'POST', headers: {'Content-Type': 'application/json'}, signal: AbortSignal.timeout(20000), body: JSON.stringify({...JSON.parse(fields), submissionId: submission.current.id, attribution: JSON.parse(submission.current.payload).attribution})});
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true) {
        setStatus(response.status === 400 ? 'validation' : 'error'); trackEvent('lead_error', {locale, error_type: 'server'}); return;
      }
      setStatus('success'); trackEvent('generate_lead', {locale});
    } catch {
      setStatus('error'); trackEvent('lead_error', {locale, error_type: 'network'});
    } finally { busy.current = false; }
  }
  return <form className="contact-request" onSubmit={submit} noValidate onFocusCapture={() => {if (!started.current) {started.current = true; trackEvent('form_start', {locale});}}}>
    <label className="contact-phone"><span>{copy.phone}</span><input type="tel" name="phone" autoComplete="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} required maxLength={40} aria-invalid={status === 'validation' && !isValidPhoneNumber(phone, 'RS')} aria-describedby={status === 'validation' || status === 'error' ? 'contact-status' : undefined}/></label>
    <label className="site-consent"><input type="checkbox" name="consent" checked={consent} onChange={e => setConsent(e.target.checked)} required aria-invalid={status === 'validation' && !consent}/><span>{copy.consent}</span></label>
    <button type="submit" disabled={status === 'sending' || status === 'success'}>{status === 'sending' ? copy.sending : c.send}<ArrowIcon/></button>
    {status === 'success' && <p role="status">{c.success}</p>}
    {(status === 'validation' || status === 'error') && <p id="contact-status" role="alert">{status === 'validation' ? c.validation : copy.error}</p>}
  </form>;
}
