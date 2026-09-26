# nio-lang.org

The website of the [Nio programming language](https://github.com/nio-org/nio):
the homepage, the documentation, the playground and the documentation
assistant. It is a [Next.js](https://nextjs.org) site built with
[Nextra](https://nextra.site).

## Running it

You need Node.js 20.9 or newer.

```sh
npm install
npm run dev        # http://localhost:3000
npm run build      # production build, plus the search index
npm start          # serve the production build
```

The site works without any configuration. Two features need a variable,
set in `.env.local` or in the environment:

| Variable | Used by | Without it |
|---|---|---|
| `OPENROUTER_API_KEY` | the documentation assistant (`app/api/chat/`) | the assistant cannot answer |
| `NEXT_PUBLIC_RUNNER_URL` | the playground's Run button | the playground calls `http://localhost:8080` |

`NEXT_PUBLIC_RUNNER_URL` is read when the site builds, so set it before
`npm run build`.

## Layout

| Path | What it holds |
|---|---|
| `content/` | the documentation pages, in Markdown, served under `/docs`. Each folder's `_meta.js` sets the order and titles in the sidebar. |
| `examples/` | example programs. The playground offers some of them, and the assistant reads all of them. |
| `app/` | the homepage, the playground, the assistant and the site layout |
| `app/benchmark-data.js` | the benchmark results on the homepage, measured with the programs in the language repository's `benchmark/` folder |
| `grammars/` | the Nio syntax grammar, copied from the language repository's `editors/shared/`. Copy it again when that file changes. |
| `runner/` | the service that compiles and runs playground programs in a sandbox. See [runner/README.md](runner/README.md). |

## Writing documentation

Code samples must compile with the current release of Nio, and a comment that
shows output (`// 11`) must match what the program prints. When the language
changes, check the pages and examples that use what changed.

The complete language reference is
[specs.md](https://github.com/nio-org/nio/blob/main/specs.md) in the language
repository. These pages explain the language; the reference defines it.

## License

[Apache License 2.0](LICENSE).
