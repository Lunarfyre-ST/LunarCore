import { VERSION } from './version.js';

const icons = {
    moon: '<path d="M20.6 15.7A9 9 0 0 1 8.3 3.4 9 9 0 1 0 20.6 15.7Z"/>',
    laptop: '<rect x="4" y="4" width="16" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2 18h20l-1 3H3z"/>',
    butterfly: '<path d="M11 11C8 2 1 1 2 8c0 3 3 5 6 5-6 0-7 7-3 8 3 1 5-3 6-6v5h2v-5c1 3 3 7 6 6 4-1 3-8-3-8 3 0 6-2 6-5 1-7-6-6-9 3z"/><path d="m12 10-3-7m3 7 3-7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
};

export function createSettingsDrawer(title, icon, className) {
    const drawer = document.createElement('details');
    drawer.className = `lunar-drawer ${className}`;
    const summary = document.createElement('summary'); summary.className = 'inline-drawer-header standoutHeader';
    summary.innerHTML = `<svg class="lunar-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor">${icons[icon]}</svg>`;
    const label = document.createElement('b'); label.textContent = title; summary.append(label);
    const arrow = document.createElement('span'); arrow.className = 'lunar-chevron'; arrow.setAttribute('aria-hidden', 'true');
    arrow.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.65"/><path d="m7 10 5 5 5-5" stroke="var(--SmartThemeBlurTintColor, #20202b)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    summary.append(arrow);
    const content = document.createElement('div'); content.className = 'lunar-drawer-content';
    drawer.append(summary, content);
    return { drawer, summary, label, content };
}

export function mountSettingsPanel(target) {
    const panel = createSettingsDrawer('LunarCore', 'moon', 'lunar-core');
    const alert = document.createElement('span'); alert.className = 'lunar-attention';
    panel.label.append(alert);
    const version = document.createElement('small'); version.className = 'lunar-version'; version.textContent = `LunarCore ${VERSION}`;
    panel.content.append(version); target.append(panel.drawer);
    // ImmersiveGroups mounts asynchronously and may use the other settings
    // column. Move only our panel, preserving every other extension's order.
    const doc = target.ownerDocument;
    const observer = new MutationObserver(() => placeAboveImmersiveGroups());
    function placeAboveImmersiveGroups() {
        const anchor = doc.querySelector('#extensions_settings .prome-vn-settings, #extensions_settings2 .prome-vn-settings');
        const column = anchor?.closest('#extensions_settings, #extensions_settings2');
        if (!column) return false;
        let sibling = anchor;
        while (sibling.parentElement !== column) sibling = sibling.parentElement;
        if (sibling.previousElementSibling !== panel.drawer) column.insertBefore(panel.drawer, sibling);
        observer.disconnect();
        return true;
    }
    doc.addEventListener('immersivegroups:ready', placeAboveImmersiveGroups);
    if (!placeAboveImmersiveGroups()) for (const column of doc.querySelectorAll('#extensions_settings, #extensions_settings2')) observer.observe(column, { childList: true });
    return {
        content: panel.content,
        updateStatus(stats) { alert.textContent = stats.attentionCount ? ` · ${stats.attentionCount} attention` : ''; },
        dispose() { observer.disconnect(); doc.removeEventListener('immersivegroups:ready', placeAboveImmersiveGroups); panel.drawer.remove(); },
    };
}
