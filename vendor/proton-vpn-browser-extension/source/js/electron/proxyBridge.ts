type ProxyDetails = { active: boolean; value?: unknown };

type CypherProtonBridge = {
	get: () => Promise<ProxyDetails>;
	set: (value: unknown) => Promise<boolean>;
	clear: () => Promise<boolean>;
	openUrl: (url: string) => Promise<{id: string}>;
};

declare global {
	interface Window {
		cypherProtonVpn?: CypherProtonBridge;
	}
}

export const isCypherElectron = typeof window !== 'undefined' && !!window.cypherProtonVpn;

export const protonProxyBridge = {
	get: () => requireBridge().get(),
	set: (value: unknown) => requireBridge().set(value),
	clear: () => requireBridge().clear(),
	openUrl: (url: string) => requireBridge().openUrl(url),
};

function requireBridge(): CypherProtonBridge {
	if (!window.cypherProtonVpn) {
		throw new Error('A integração VPN do Cypher não está disponível.');
	}
	return window.cypherProtonVpn;
}
