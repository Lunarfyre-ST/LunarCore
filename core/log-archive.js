// Browser-local, opt-in storage. Only sanitized recorder exports enter this store.
export const MAX_SAVED_LOGS = 5, MAX_LOG_BYTES = 2 * 1024 * 1024;
export function createLogArchive(database = globalThis.indexedDB) {
    let opening;
    function open() {
        if (!database) return Promise.reject(new Error('Storage unavailable'));
        if (!opening) opening = new Promise((resolve, reject) => {
            const request = database.open('LunarDebug.logs', 1);
            request.onupgradeneeded = () => request.result.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => { opening = null; reject(new Error('Storage unavailable')); };
            request.onblocked = () => { opening = null; reject(new Error('Storage blocked')); };
        });
        return opening;
    }
    async function transaction(mode, action) {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('logs', mode), store = tx.objectStore('logs');
            let result;
            tx.oncomplete = () => resolve(result);
            tx.onerror = tx.onabort = () => reject(new Error('Storage failed'));
            action(store, value => { result = value; });
        });
    }
    return {
        list: () => transaction('readonly', (store, done) => { const request = store.getAll(); request.onsuccess = () => done(request.result.reverse()); }),
        remove: id => transaction('readwrite', store => store.delete(id)),
        async save(data, id) {
            const json = JSON.stringify(data);
            if (new TextEncoder().encode(json).byteLength > MAX_LOG_BYTES) throw new Error('Log too large');
            return transaction('readwrite', (store, done) => {
                const request = store.put({ ...(id == null ? {} : { id }), json });
                request.onsuccess = () => {
                    done(request.result);
                    const keys = store.getAllKeys();
                    keys.onsuccess = () => { for (const key of keys.result.slice(0, -MAX_SAVED_LOGS)) store.delete(key); };
                };
            });
        },
    };
}

// Serialize writes, coalesce routine changes and save attention changes promptly.
// A new session gets a new archive entry; checkpoints replace that entry.
export function createAutoSave({ archive, snapshot, status = () => {}, now = () => performance.now() }) {
    let id, revision = -1, attention = 0, last = -Infinity, epoch = 0, pending = null;
    return {
        rotate() { epoch++; id = undefined; revision = -1; attention = 0; last = -Infinity; },
        async checkpoint(stats, force = false) {
            if (!stats.count || stats.revision === revision || pending || (!force && stats.attentionCount === attention && now() - last < 5000)) return;
            const session = epoch, version = stats.revision, count = stats.attentionCount;
            last = now(); attention = count;
            try {
                const data = snapshot(), existingId = id;
                pending = Promise.resolve().then(() => archive.save(data, existingId));
                const key = await pending;
                if (session === epoch) { id = key; revision = version; attention = count; status('Saved locally.'); }
            } catch { if (session === epoch) status('Could not save locally (storage unavailable, full, or log exceeds 2 MB). Export JSON to keep this recording.'); }
            finally { pending = null; }
        },
    };
}
