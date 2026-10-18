// Android injects the vault explicitly. Browsers never fall back to localStorage.
export function createCredentialStore(vault) {
  return {
    async load() { return vault ? (await vault.load()).key || null : null; },
    async save(value) {
      const key=String(value).trim();
      if (!key || key.length>4096) throw new Error('Invalid API key length');
      if (!vault) return false;
      await vault.save({key});return true;
    },
    async clear() { if(vault) await vault.clear(); }
  };
}
