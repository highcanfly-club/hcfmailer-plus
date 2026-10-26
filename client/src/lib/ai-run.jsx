'use strict';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import csrfToken from 'csrfToken';
import { useTranslation } from './i18n';
import { getUrl } from './urls';

// Runs an AI request as a stream of events (text/event-stream over a POST): progress steps, the reasoning of the model and
// its raw answer as they are produced, then the final result. Closing the connection (Stop) aborts the call at the provider.
// Errors raised before the stream starts (402 offer, 400...) come as plain JSON and are thrown with a `response` like axios does.
async function streamPost(path, body, { signal, onEvent }) {
  const res = await fetch(getUrl(path), {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', 'X-CSRF-TOKEN': csrfToken },
    body: JSON.stringify({ ...body, stream: true }),
    signal
  });
  if (!res.ok || !(res.headers.get('content-type') || '').includes('text/event-stream')) {
    let data = null;
    try { data = await res.json(); } catch (e) { /* not JSON */ }
    throw Object.assign(new Error((data && data.message) || `HTTP ${res.status}`), { response: { status: res.status, data } });
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result = null;
  let failure = null;
  const handle = raw => {
    let event = 'message';
    const data = [];
    for (const line of raw.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
    }
    if (!data.length) return;
    const payload = JSON.parse(data.join('\n'));
    if (event === 'progress') onEvent(payload);
    else if (event === 'result') result = payload;
    else if (event === 'error') failure = payload;
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
    let index;
    while ((index = buffer.indexOf('\n\n')) >= 0) {
      handle(buffer.slice(0, index));
      buffer = buffer.slice(index + 2);
    }
  }
  if (failure) {
    throw Object.assign(new Error(failure.message), { response: { status: failure.status || 400, data: { message: failure.message } }, debug: failure.debug });
  }
  if (!result) {
    throw new Error('The connection was interrupted');
  }
  return result;
}

const DEBUG_KEY = 'hcfmailer.ai.debug';
const readDebug = () => { try { return window.localStorage.getItem(DEBUG_KEY) === '1'; } catch (e) { return false; } };

const emptyProgress = { step: null, calls: [] };

function reduce(progress, event) {
  const calls = progress.calls.slice();
  const index = event.call ? calls.findIndex(c => c.id === event.call) : -1;
  const update = changes => { calls[index] = { ...calls[index], ...changes }; return { ...progress, calls }; };
  switch (event.type) {
    case 'step': return { ...progress, step: event };
    case 'call-start': return { ...progress, calls: [...calls, { id: event.call, purpose: event.purpose, reasoning: '', text: '', done: false, attempt: 1 }] };
    case 'attempt': return index >= 0 ? update({ reasoning: '', text: '', attempt: event.n }) : progress;
    case 'reasoning': return index >= 0 ? update({ reasoning: calls[index].reasoning + event.delta }) : progress;
    case 'text': return index >= 0 ? update({ text: calls[index].text + event.delta }) : progress;
    case 'call-end': return index >= 0 ? update({ done: true, ms: event.ms, error: event.error, usage: event.usage }) : progress;
    default: return progress;
  }
}

// State of one AI request: `run` resolves with the result, `progress` feeds <AIProgress>, `debug` feeds <AIDebugButton>
export function useAIRun() {
  const [progress, setProgress] = useState(emptyProgress);
  const [debug, setDebug] = useState(null);
  const [debugOn, setDebugOnState] = useState(readDebug);
  const [running, setRunning] = useState(false);
  const controller = useRef(null);
  const pending = useRef(emptyProgress);
  const frame = useRef(null);

  useEffect(() => () => { if (controller.current) controller.current.abort(); if (frame.current) cancelAnimationFrame(frame.current); }, []);

  const setDebugOn = on => {
    setDebugOnState(on);
    try { window.localStorage.setItem(DEBUG_KEY, on ? '1' : '0'); } catch (e) { /* storage unavailable */ }
  };

  const run = useCallback(async (path, body) => {
    controller.current = new AbortController();
    pending.current = emptyProgress;
    setProgress(emptyProgress);
    setDebug(null);
    setRunning(true);
    const onEvent = event => { // many small deltas: repaint at most once per frame
      pending.current = reduce(pending.current, event);
      if (!frame.current) frame.current = requestAnimationFrame(() => { frame.current = null; setProgress(pending.current); });
    };
    try {
      const result = await streamPost(path, { ...body, debug: debugOn || undefined }, { signal: controller.current.signal, onEvent });
      if (result.debug) setDebug(result.debug);
      return result;
    } catch (err) {
      if (err.debug) setDebug(err.debug);
      if (err.name === 'AbortError') err.stopped = true;
      throw err;
    } finally {
      if (frame.current) { cancelAnimationFrame(frame.current); frame.current = null; }
      setProgress(pending.current);
      setRunning(false);
    }
  }, [debugOn]);

  const stop = () => { if (controller.current) controller.current.abort(); };

  return { run, stop, running, progress, debug, debugOn, setDebugOn };
}

const pre = { whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 180, overflowY: 'auto', fontSize: 12, background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: 4, padding: 6, margin: '4px 0', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' };
const small = { fontSize: 12 };
const button = { border: '1px solid #4f46e5', borderRadius: 4, padding: '2px 10px', fontSize: 13, cursor: 'pointer', background: '#fff', color: '#4f46e5' };

// Keeps a growing <pre> scrolled to its end while the text arrives
function Live({ text }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [text]);
  return <pre ref={ref} style={pre}>{text}</pre>;
}

export function AIProgress({ run }) {
  const { t } = useTranslation();
  const { progress, running, stop } = run;
  if (!running && !progress.calls.length) return null;
  const step = progress.step;
  const label = !step ? t('aiStepStarting') : ({
    research: () => t('aiStepResearch', { round: step.round, of: step.of }),
    tool: () => t('aiStepTool', { tool: step.tool }),
    write: () => t('aiStepWrite', { batch: step.batch, of: step.of }),
    validate: () => t('aiStepValidate'),
    retry: () => t('aiStepRetry'),
    render: () => t('aiStepRender')
  }[step.step] || (() => step.step))();
  return (
    <div className="mt-2" style={{ ...small, borderTop: '1px solid #dee2e6', paddingTop: 6 }}>
      <div className="d-flex align-items-center justify-content-between">
        <span>{running && <span className="spinner-border spinner-border-sm me-2" role="status" />}{running ? label : t('aiStepDone')}</span>
        {running && <button type="button" style={button} onClick={stop}>{t('aiStop')}</button>}
      </div>
      {progress.calls.map(call => (
        <div key={call.id} className="mt-1">
          <div className="text-muted">#{call.id} {call.purpose}{call.attempt > 1 ? ` (${t('aiAttempt', { n: call.attempt })})` : ''}{call.done ? ` · ${(call.ms / 1000).toFixed(1)} s` : ''}{call.error ? ` · ${call.error}` : ''}</div>
          {(call.reasoning || (running && !call.done && !call.text)) && (
            <details open={running && !call.text && !!call.reasoning}>
              <summary>{t('aiReasoning', { n: call.reasoning.length })}</summary>
              <Live text={call.reasoning || t('aiWaitingModel')} />
            </details>
          )}
          {call.text && (
            <details>
              <summary>{t('aiRawReply', { n: call.text.length })}</summary>
              <Live text={call.text} />
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

export function AIDebugToggle({ run }) {
  const { t } = useTranslation();
  return (
    <label className="d-block text-muted" style={small}>
      <input type="checkbox" className="me-1" checked={run.debugOn} onChange={e => run.setDebugOn(e.target.checked)} />
      {t('aiDebugToggle')}
    </label>
  );
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function DebugDialog({ debug, onClose }) {
  const { t } = useTranslation();
  const json = JSON.stringify(debug, null, 2);
  const section = (title, text) => text ? (<details><summary>{title} ({text.length})</summary><pre style={{ ...pre, maxHeight: 320 }}>{text}</pre></details>) : null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3600, background: 'rgba(33,37,41,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, textAlign: 'left', color: '#212529', fontWeight: 'normal', fontSize: 14 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 10, padding: 20, maxWidth: 900, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,.4)' }} onClick={e => e.stopPropagation()}>
        <div className="d-flex justify-content-between align-items-start">
          <h5>{t('aiDebugTitle')}</h5>
          <button className="btn-close" aria-label={t('aiPreviewClose')} onClick={onClose} />
        </div>
        <p className="text-muted" style={small}>
          {t('aiDebugSummary', { ms: (debug.totalMs / 1000).toFixed(1), input: debug.tokens.input, output: debug.tokens.output })}{debug.tokens.estimated ? ` ${t('aiDebugEstimated')}` : ''} {t('aiDebugPrivacy')}
        </p>
        <button type="button" style={{ ...button, marginRight: 6 }} onClick={() => navigator.clipboard && navigator.clipboard.writeText(json)}>{t('aiDebugCopy')}</button>
        <button type="button" style={button} onClick={() => download('ai-debug.json', json)}>{t('aiDebugDownload')}</button>
        {debug.calls.map(call => (
          <div key={call.id} className="mt-3 p-2" style={{ border: '1px solid #dee2e6', borderRadius: 6 }}>
            <strong>#{call.id} {call.purpose}</strong>
            <span className="text-muted" style={small}> · {call.protocol} {call.model} {call.host && `(${call.host})`} · {t('aiTierLabel', { tier: call.tier })} · {(call.ms / 1000).toFixed(1)} s
              {call.usage ? ` · ${call.usage.input} → ${call.usage.output} ${call.usage.estimated ? '~' : ''}` : ''}</span>
            {call.attempts.length > 1 && <div className="text-warning" style={small}>{call.attempts.filter(a => a.error).map(a => `${t('aiAttempt', { n: a.n })}: ${a.error}`).join(' · ')}</div>}
            {call.error && <div className="text-danger" style={small}>{call.error}</div>}
            {section(t('aiDebugSystem'), call.system)}
            {section(t('aiDebugUser'), call.user)}
            {call.reasoning ? section(t('aiDebugReasoning'), call.reasoning) : <div className="text-muted" style={small}>{t('aiDebugNoReasoning')}</div>}
            {section(t('aiDebugReply'), call.reply)}
          </div>
        ))}
        {debug.notes.length > 0 && (
          <div className="mt-3">
            <strong>{t('aiDebugNotes')}</strong>
            <pre style={{ ...pre, maxHeight: 260 }}>{debug.notes.map(n => `+${(n.at / 1000).toFixed(1)}s ${JSON.stringify({ ...n, at: undefined })}`).join('\n')}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

export function AIDebugButton({ run }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (!run.debug) return null;
  return (
    <>
      <button type="button" style={{ ...button, marginTop: 6 }} onClick={() => setOpen(true)}>{t('aiDebugOpen')}</button>
      {open && <DebugDialog debug={run.debug} onClose={() => setOpen(false)} />}
    </>
  );
}
