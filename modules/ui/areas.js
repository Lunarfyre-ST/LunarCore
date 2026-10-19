// Fixed product surfaces only: never inspect message text, input or asset data.
// Major surfaces precede the bounded header pool.
export const EFFECT_AREAS = Object.freeze([
    { id: 'chat', label: 'Chat / Sheld', selector: '#chat', portal: true, twinkles: 25 },
    { id: 'composer', label: 'Message composer', selector: '#send_form', portal: true, twinkles: 35 },
    { id: 'navigation', label: 'Navigation', selector: '#top-settings-holder', portal: true, twinkles: 65 },
    { id: 'panels', label: 'Side panels / drawers', selector: '.drawer-content, #left-nav-panel, #right-nav-panel', portal: true, twinkles: 60 },
    { id: 'dialogs', label: 'Dialogs', selector: 'dialog.popup', portal: false, twinkles: 50 },
    { id: 'settings', label: 'Settings headers', selector: '.inline-drawer-header, .lunar-theme-preview', portal: false, twinkles: 100 },
]);
