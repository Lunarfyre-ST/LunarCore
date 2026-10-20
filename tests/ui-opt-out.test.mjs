import test from 'node:test';
import assert from 'node:assert/strict';
import { clipOptOuts, isEffectsOptedOut } from '../modules/ui/opt-out.js';

function fixture(rectangles, supported = true) {
    const roots = rectangles.map(rect => ({ parentElement: { closest: () => null }, getBoundingClientRect: () => rect,
        get textContent() { throw new Error('Do not read extension text'); } }));
    const surface = { querySelectorAll: () => roots };
    const overlay = { clientWidth: 100, clientHeight: 100,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 200 }),
        style: { removeProperty(key) { delete this[key === 'clip-path' ? 'clipPath' : key]; } } };
    return { roots, surface, overlay, win: { CSS: { supports: () => supported } } };
}

test('opt-out clipping scales geometry and merges overlaps without inspecting content', () => {
    const f = fixture([{ left: 20, top: 20, right: 80, bottom: 80 }, { left: 60, top: 60, right: 120, bottom: 120 }]);
    clipOptOuts(f.surface, f.overlay, f.win);
    assert.equal(f.overlay.style.clipPath, 'path(evenodd, "M0 0H100V100H0ZM10 10H60V60H10Z")');
    assert.equal(f.overlay.style.visibility, undefined);
    f.roots.length = 0; clipOptOuts(f.surface, f.overlay, f.win);
    assert.equal(f.overlay.style.clipPath, undefined);
});

test('unsupported or excessive clipping suppresses ancestor effects and recovers when cleared', () => {
    const rect = { left: 10, top: 10, right: 20, bottom: 20 };
    for (const f of [fixture([rect], false), fixture(Array(129).fill(rect))]) {
        clipOptOuts(f.surface, f.overlay, f.win);
        assert.equal(f.overlay.style.visibility, 'hidden');
        f.roots.length = 0; clipOptOuts(f.surface, f.overlay, f.win);
        assert.equal(f.overlay.style.visibility, undefined);
    }
    assert.equal(isEffectsOptedOut(null), false);
    assert.equal(isEffectsOptedOut({ closest: () => ({}) }), true);
});
