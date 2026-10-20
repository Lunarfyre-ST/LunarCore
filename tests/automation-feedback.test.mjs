import test from 'node:test';
import assert from 'node:assert/strict';
import { automationFeedback } from '../core/record-analysis.js';
import { createRecorder } from '../core/diagnostics.js';
test('retained automation feedback distinguishes outcomes without double-counting operation totals', () => {
 const r=createRecorder();r.start();const op=r.api.begin('automation.execute',{commands:4});
 op.step({kind:'outfit',outcome:'applied'});op.step({kind:'outfit',outcome:'skipped',reason:'locked',name:'PRIVATE'});
 op.step({kind:'background',outcome:'skipped',reason:'scope'});op.step({kind:'outfit',outcome:'cancelled',reason:'stale'});op.finish({outcome:'completed',applied:1,skipped:3});
 const counts=automationFeedback(r.entries());assert.equal(counts.applied,1);assert.equal(counts.locked,1);assert.equal(counts.scope,1);assert.equal(counts.cancelled,1);assert.equal(Object.values(counts).reduce((a,b)=>a+b),4);assert.equal(JSON.stringify(r.entries()).includes('PRIVATE'),false);
 r.clear();assert.equal(Object.values(automationFeedback(r.entries())).reduce((a,b)=>a+b),0);
});
