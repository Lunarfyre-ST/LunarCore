import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnimationDriver } from '../modules/ui/animation-driver.js';

function fixture() {
    const classes = new Set(['lunar-ambient-visible']);
    const style = () => ({ removeProperty(name) { delete this[name]; } });
    const star = { style: style() }, sheen = { style: style() };
    const overlay = {
        classList: { contains: name => classes.has(name), add: name => classes.add(name), remove: name => classes.delete(name) },
        querySelectorAll: () => [star], querySelector: () => sheen,
    };
    const entry = { overlay, compatibility: true, seed: 0, cycles: new WeakMap(), animation: { twinkles: true, sweeps: true, random: true, twinkleTime: 10, sweepTime: 10, twinkleStrength: .5, sweepStrength: 1 } };
    let id = 0, now = 0, randomized = 0;
    const frames = new Map(), doc = { hidden: false };
    const win = { requestAnimationFrame(callback) { frames.set(++id, callback); return id; }, cancelAnimationFrame: id => frames.delete(id) };
    const driver = createAnimationDriver({ win, doc, entries: () => [entry].values(), randomize: () => randomized++ });
    const step = (ms = 100) => { now += ms; const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(now); };
    return { driver, doc, entry, star, sheen, classes, frames, step, randomizations: () => randomized };
}

test('compatibility effects draw without CSS animations, retain timing and randomize only at cycle boundaries', () => {
    const f = fixture(); f.driver.refresh(); f.step(0);
    assert.equal(f.frames.size, 1);
    for (let i = 0; i < 55; i++) f.step();
    assert.ok(Math.abs(Number(f.star.style.opacity) - .4) < .0001);
    assert.equal(f.randomizations(), 0);
    for (let i = 0; i < 19; i++) f.step();
    assert.ok(Number(f.sheen.style.opacity) > .99);
    assert.ok(Number.parseFloat(f.sheen.style.left) > -40);
    for (let i = 0; i < 26; i++) f.step();
    assert.equal(f.randomizations(), 1);
    f.driver.dispose(); assert.equal(f.frames.size, 0);
    assert.equal(f.classes.has('lunar-compatibility'), false);
    assert.equal(f.star.style.opacity, undefined);
    assert.equal(f.sheen.style.left, undefined);
});

test('compatibility rendering pauses hidden/offscreen, stops disabled effects and cleans up on CSS selection', () => {
    const f = fixture(); f.driver.refresh(); f.step(0); f.step();
    const elapsed = f.entry.elapsed;
    f.doc.hidden = true; f.driver.refresh(); assert.equal(f.frames.size, 0);
    f.step(60000); f.doc.hidden = false; f.driver.refresh(); f.step();
    assert.equal(f.entry.elapsed, elapsed);
    f.classes.delete('lunar-ambient-visible'); f.driver.refresh(); assert.equal(f.frames.size, 0);
    f.classes.add('lunar-ambient-visible'); f.driver.refresh(); assert.equal(f.frames.size, 1);
    f.entry.animation.twinkles = f.entry.animation.sweeps = false; f.driver.refresh();
    assert.equal(f.frames.size, 0); assert.equal(f.star.style.opacity, '0'); assert.equal(f.sheen.style.opacity, '0');
    f.entry.compatibility = false; f.driver.refresh();
    assert.equal(f.classes.has('lunar-compatibility'), false); assert.equal(f.star.style.opacity, undefined);
    f.driver.dispose(); f.driver.refresh(); assert.equal(f.frames.size, 0);
});
