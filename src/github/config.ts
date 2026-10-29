/**
 * Client ID of Rivet's GitHub OAuth App (with Device Flow enabled). README.md, section
 * "GitHub sign-in", explains how to register the app and get one.
 *
 * A client ID is public: it ships inside the app, like a username. There is no client secret
 * anywhere in Rivet; never put one here.
 */
export const githubClientId: string = "Ov23liQgSzFPgwxO7JnQ";

/** False until the placeholder above is replaced; the desktop app hides sign-in until then. */
export const githubConfigured = !/^YOUR_|^$/.test(githubClientId);
