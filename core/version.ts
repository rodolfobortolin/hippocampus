import { readFileSync } from 'node:fs'

/**
 * The running version, read from package.json — the one place it is written.
 *
 * It used to be typed out here as well, which is a second thing to remember at
 * every release and exactly the kind of thing that gets forgotten. Some answers
 * are cached against it: a permission macOS granted to one build is re-asked
 * for the next, so the cache has to expire when the version does.
 *
 * package.json sits one level up from core/ both in the repository and inside
 * the packaged bundle, so the same relative path finds it in either.
 */
export const VERSION: string = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
).version
