import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Playground } from './playground'
import { pageMetadata } from '../seo'

export const metadata = pageMetadata({
  title: 'Playground',
  description:
    'Write and run Nio programs in your browser. Start from ten examples of the language and its standard library.',
  path: '/playground'
})

// The examples come from the examples folder when the site builds, so the
// playground always shows the same files the documentation refers to.
const EXAMPLES = [
  { file: 'strings.nio', title: 'Strings', about: 'Text, interpolation and the string module.' },
  { file: 'types.nio', title: 'Records and JSON', about: 'Nested record types, and reading and writing them as JSON.' },
  { file: 'arrays.nio', title: 'Arrays', about: 'Growable and fixed-size arrays, slicing, searching and sorting.' },
  { file: 'maps.nio', title: 'Maps', about: 'Map literals, lookups that answer an optional, and JSON round trips.' },
  { file: 'closures.nio', title: 'Closures', about: 'Function types, function values and what they capture.' },
  { file: 'errors.nio', title: 'Errors', about: 'Raising, catching and passing errors up the call chain.' },
  { file: 'async.nio', title: 'Async', about: 'Async functions, futures, await and callbacks on one thread.' },
  { file: 'union.nio', title: 'Unions', about: 'A value that is exactly one of a fixed set of types.' },
  { file: 'sealed.nio', title: 'Sealed types', about: 'A closed family of types, and switches that must cover all of it.' },
  { file: 'enums.nio', title: 'Enums', about: 'Named integer constants as types of their own, and switches over them.' }
]

export default function PlaygroundPage() {
  const examples = EXAMPLES.map(e => ({
    ...e,
    id: e.file.replace(/\.nio$/, ''),
    code: readFileSync(join(process.cwd(), 'examples', e.file), 'utf8')
  }))
  return <Playground examples={examples} />
}
