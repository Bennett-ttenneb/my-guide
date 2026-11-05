// shortcut: the on-device AI voice (Kokoro) is switched off because v2.0.0, the first build with its native
// libraries, would not open on the user's phone. The full version is in git history (commit 6d0dd41);
// restore it once a device log shows which library crashes.
export const AI_VOICES = [];
export const supported = false;
export const isInstalled = async () => false;
export const install = async () => { throw new Error('AI voice is not available in this version'); };
export const remove = async () => {};
export const speak = async () => { throw new Error('AI voice is not available in this version'); };
export const stop = () => {};
