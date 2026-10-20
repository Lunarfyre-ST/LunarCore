// Only product configuration, never user-defined labels or identifiers.
const boolean = { type: 'boolean' };
const number = (min, max) => ({ type: 'number', min, max });
const choice = (...values) => ({ type: 'enum', values });
export const SETTINGS = Object.freeze({
    enableVN_UI: boolean, layoutMode: choice('auto', 'desktop', 'mobile'),
    settingsEditProfile: choice('auto', 'desktop', 'mobile'), mobileLayoutWidth: number(100, 3000),
    ...Object.fromEntries(['outfit', 'background'].flatMap(kind => [
        [`${kind}FadeEnabled`, boolean], [`${kind}FadeLinked`, boolean],
        [`${kind}FadeMode`, choice('cross', 'sequential')],
        [`${kind}FadeIn`, number(0, 3000)], [`${kind}FadeOut`, number(0, 3000)],
    ])),
    ...Object.fromEntries([
        ['expression', 0, 3000, 100], ['scene', 0, 3000, 100],
        ['entrance', 0, 3000, 80], ['speaking', 0, 3000, 30],
        ['breathing', 1000, 20000, 3], ['reaction', 0, 3000, 20],
        ['focus', 0, 3000, 100], ['backgroundPan', 5000, 120000, 10],
    ].flatMap(([id, min, max, strength]) => [
        [`${id}MotionEnabled`, boolean], [`${id}MotionDuration`, number(min, max)],
        [`${id}MotionStrength`, number(0, strength)],
    ])),
    breathingMotionWaitingStrength: number(0, 100),
    entranceMotionStyle: choice('fade', 'slide'), breathingMotionScope: choice('speaker', 'all'),
    reactionMotionStyle: choice('hop', 'nod', 'tilt', 'shake'),
    backgroundPanMotionDirection: choice('left', 'right', 'up', 'down'),
    backgroundPanMotionMobileVertical: boolean, recentSpeakerLimit: number(0, 50),
    heightReferenceMode: choice('visible', 'group'),
    stageGap: number(0, 200), stageIdleOpacity: number(0, 100), stageFontSize: number(0, 100),
    spriteSpacingPercent: number(0, 300), layoutSpriteScale: number(0, 300),
    spriteOffsetY: number(-2000, 2000), stageOffsetX: number(-2000, 2000), stageOffsetY: number(-2000, 2000),
    stageShowSpeak: boolean, stageShowOutfits: boolean, stageShowNames: boolean,
    stageNamesAbove: boolean, stageCenterCards: boolean, stageShowBackgroundArrows: boolean,
    stageLayout: choice('characters', 'shared'), stageFlow: choice('scroll', 'wrap', 'stack'),
    stageSpeakPlacement: choice('top', 'bottom'), stageOutfitPlacement: choice('top', 'bottom'),
    'scene.enabled': boolean, 'scene.mode': choice('prompt', 'api'),
    'scene.depth': number(0, 100), 'scene.outfits': boolean, 'scene.backgrounds': boolean,
    'scene.commandless': boolean, 'scene.hideCommands': boolean, 'scene.includeDescriptions': boolean,
    'scene.scope': choice('all', 'speaker'), 'scene.apiTransport': choice('main', 'profile', 'custom'),
    'scene.apiAutoAfterReply': boolean, 'scene.apiRecentMessages': number(1, 1000),
    'scene.apiMaxTokens': number(32, 2048), 'scene.maxOutfits': number(1, 100), 'scene.maxBackgrounds': number(1, 100),
});
export function settingValue(key, value) {
    const rule = Object.hasOwn(SETTINGS, key) ? SETTINGS[key] : null;
    if (!rule) return undefined;
    if (rule.type === 'boolean' && typeof value === 'boolean') return value;
    if (rule.type === 'enum' && rule.values.includes(value)) return value;
    if (rule.type === 'number' && typeof value === 'number' && Number.isFinite(value) && value >= rule.min && value <= rule.max) return Math.round(value * 100) / 100;
    return undefined;
}
export const ACTIONS = Object.freeze([
    'tab.layout', 'tab.controls', 'tab.characters', 'tab.sprites', 'tab.animations',
    'tab.backgrounds', 'tab.automation', 'tab.gallery', 'tab.legacy', 'tab.about',
    'animation.section_idle', 'animation.section_experimental',
    'outfit_picker.toggle', 'outfit.select', 'background.select', 'background_picker.close',
    'background.lock', 'background_library.open', 'animation_defaults.reset',
    'automation.analyze', 'automation.cancel', 'automation.apply', 'context.preview',
    'context.instructions_reset', 'layout.preview_changed', 'layout.editor_changed',
    'background.previous', 'background.next',
]);
