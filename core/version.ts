/**
 * The running version, read from package.json at build time by nothing at all —
 * it is written here on purpose.
 *
 * Some answers are cached against it: a permission macOS granted to one build
 * is re-asked for the next, so the cache has to expire when the build does.
 */
export const VERSION = '0.1.0'
