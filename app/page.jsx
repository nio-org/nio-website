import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Link from 'next/link'
import { createHighlighter } from 'shiki'
import { MACHINE } from './benchmark-data'
import { Benchmarks } from './benchmarks'
import { NioLogo } from './logo'
import { RotatingWord } from './rotating-word'
import styles from './page.module.css'
import { pageMetadata, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from './seo'

export const metadata = pageMetadata({
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  path: '/',
  absoluteTitle: true
})

// Tells search engines the site's name, which they show above the result.
const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  alternateName: ['Nio programming language', 'nio-lang.org'],
  url: `${SITE_URL}/`
}

const SERVER = `import 'http';
import 'json';

type User {
    String? id;
    String name;
}

http.Response showUser(http.Request req) {
    User u = { id: req.params["id"], name: "Ada" };
    return http.json(200, json.toText(u));
}

http.Server app = http.server();
app.route(http.Method.GET, "/", http.Response (http.Request r) -> http.text(200, "hello"));
app.route(http.Method.GET, "/users/:id", http.Response (http.Request r) -> showUser(r));

await app.listen("0.0.0.0", 8080, null) catch e {
    print(\`cannot listen: \${e.message}\`);
};`

const CONFIG = `import 'fs';
import 'json';
import 'string';

type Config {
    String host;
    int port;
    String? name;    // may be missing: the compiler makes you check
}

Config load(String file) {
    byte[] raw = fs.readFile(file);    // can fail: the error goes up
    return json.parse(string.fromByteArray(raw)) as Config;
}

Config? cfg = load("config.json") catch null;
if (cfg != null) {
    print(\`\${cfg.host}:\${cfg.port}\`);    // localhost:8080
}`

const ICONS = {
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  shield: (
    <>
      <path d="M12 3 5 6v6c0 4.4 3 7.8 7 9 4-1.2 7-4.6 7-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3 2 20h20z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  flow: (
    <>
      <path d="M4 7h10M4 12h16M4 17h7" />
      <circle cx="18" cy="7" r="2" />
      <circle cx="15" cy="17" r="2" />
    </>
  ),
  server: (
    <>
      <rect x="3" y="4" width="18" height="7" rx="2" />
      <rect x="3" y="13" width="18" height="7" rx="2" />
      <path d="M7 7.5h.01M7 16.5h.01" />
    </>
  ),
  feather: (
    <>
      <path d="M20 4C12 4 6 10 6 18v2" />
      <path d="M6 14h7M9 10h8" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  tools: (
    <>
      <path d="m4 20 7-7" />
      <path d="M14.5 4.5a4 4 0 0 0 5 5L17 12l-5-5z" />
      <path d="m15 15 5 5" />
    </>
  )
}

const POINTS = [
  {
    icon: 'bolt',
    title: 'Native speed',
    body: 'Nio compiles through LLVM to one native executable. There is no virtual machine and nothing to install where it runs. Release builds optimize the whole program, runtime included.'
  },
  {
    icon: 'shield',
    title: 'Types that catch mistakes',
    body: 'Every value is checked before the program runs. Numbers never change type on their own, and a String is never null: a value that can be missing is a String?, and you must check it first.'
  },
  {
    icon: 'alert',
    title: 'Errors you cannot forget',
    body: 'The compiler works out which functions can fail. Errors go up to the caller by themselves, and you handle them with catch where it makes sense. No exceptions and no hidden jumps.'
  },
  {
    icon: 'flow',
    title: 'Async on one thread',
    body: 'async and await let one program serve many connections at once, while it waits for the network, the disk or a timer. There are no threads, so there are no locks and no data races.'
  },
  {
    icon: 'server',
    title: 'Built for the back end',
    body: 'An HTTP server and client, TLS 1.3, cryptography, JSON, sockets, files, processes and regular expressions are all in the standard library. You need no packages to start.'
  },
  {
    icon: 'feather',
    title: 'Light on memory',
    body: 'Each value uses only its own width, so a byte[] takes one byte per element. The garbage collector gives memory back to the system when the program goes quiet.'
  },
  {
    icon: 'lock',
    title: 'Safe by default',
    body: 'TLS checks certificates unless you say not to. Regular expressions run in linear time. Packages are checked against a hash on every build and never run code when you install them.'
  },
  {
    icon: 'tools',
    title: 'Tools included',
    body: 'A formatter, a test runner, a documentation viewer, debugger support and a language server for your editor all come in the one nio command. You only need clang.'
  }
]

const STATS = [
  {
    value: '≈ C',
    label: 'on calls and math',
    detail: 'fib, primes and mandelbrot take 0.93 to 0.98 of the time C takes.'
  },
  {
    value: '2×',
    label: 'faster than C at allocating',
    detail: 'records: 34 ms against 72 ms with malloc and free.'
  },
  {
    value: '10×',
    label: 'faster async than Go',
    detail: 'chain: 23 ms, against 226 ms for Go and 54 ms for Node.js.'
  },
  {
    value: '16.7 MB',
    label: 'for 1,000 HTTP connections',
    detail: 'At 139k requests a second. On one core Go uses 42 MB, Node.js 228 MB and Java 397 MB.'
  }
]

const STEPS = [
  { cmd: 'nio run app.nio', text: 'Compile and run in one step while you work.' },
  { cmd: 'nio build --release app.nio -o app', text: 'Build an optimized native program.' },
  { cmd: './app', text: 'Copy the one file to a server and run it.' }
]

async function highlight(codes) {
  const grammar = JSON.parse(
    readFileSync(join(process.cwd(), 'grammars/nio.tmLanguage.json'), 'utf8')
  )
  const highlighter = await createHighlighter({
    themes: ['github-light', 'github-dark'],
    langs: [{ ...grammar, name: 'nio' }]
  })
  return codes.map(code =>
    highlighter.codeToHtml(code, {
      lang: 'nio',
      themes: { light: 'github-light', dark: 'github-dark' }
    })
  )
}

function Icon({ name }) {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  )
}

function CodeWindow({ file, html }) {
  return (
    <div className={styles.window}>
      <div className={styles.windowBar}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.windowFile}>{file}</span>
      </div>
      <div className={styles.code} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}

export default async function HomePage() {
  const [server, config] = await highlight([SERVER, CONFIG])

  return (
    <div className={styles.home}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <section className={styles.hero}>
        <div className={styles.glow} aria-hidden="true" />
        <NioLogo size={132} id="hero-logo" className={styles.heroLogo} />
        <span className={styles.badge}>Version 0.1 · ready to try</span>
        <h1 className={styles.headline}>
          Fast, safe programs
          <br />
          for <RotatingWord />
        </h1>
        <p className={styles.subtitle}>
          Nio is a small, statically typed language. It compiles your code to
          one native program, finds mistakes before it runs, and comes with an
          HTTP server, TLS and cryptography in the box.
        </p>
        <div className={styles.ctaRow}>
          <Link className={styles.ctaPrimary} href="/docs/installation">
            Get started <span aria-hidden="true">→</span>
          </Link>
          <Link className={styles.ctaSecondary} href="/docs/quickstart">
            Take the tour
          </Link>
        </div>
      </section>

      <section className={styles.showcase}>
        <CodeWindow file="server.nio" html={server} />
        <p className={styles.caption}>
          A complete web service. <code>nio build --release server.nio</code>{' '}
          turns it into a single file you can copy to any server.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Why Nio</h2>
        <p className={styles.sectionLead}>
          The things Nio is built to do well.
        </p>
        <div className={styles.grid}>
          {POINTS.map(point => (
            <div className={styles.card} key={point.title}>
              <div className={styles.iconWrap}>
                <Icon name={point.icon} />
              </div>
              <h3 className={styles.cardTitle}>{point.title}</h3>
              <p className={styles.cardBody}>{point.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section} id="benchmarks">
        <h2 className={styles.sectionTitle}>Benchmarks</h2>
        <p className={styles.sectionLead}>
          The same small programs written in Nio, C, Go, Java and Node.js,
          line for line, each checked to print the same result before it is
          timed.
        </p>
        <div className={styles.stats}>
          {STATS.map(stat => (
            <div className={styles.stat} key={stat.label}>
              <span className={styles.statValue}>{stat.value}</span>
              <span className={styles.statLabel}>{stat.label}</span>
              <span className={styles.statDetail}>{stat.detail}</span>
            </div>
          ))}
        </div>
        <Benchmarks />
        <p className={styles.benchFootnote}>
          Measured on {MACHINE}, with the scripts in the Nio repository&apos;s{' '}
          <code>benchmark</code> folder. Nio and C are compiled with{' '}
          <code>-O2</code>. These are small programs that each stress one
          thing, so a real application will differ. In the HTTP test the load
          generator runs on the same machine as the server. Nio and Node.js
          serve from one thread, so Go and Java are limited to one core to
          match. <em>Go (multicore)</em> and <em>Java (multicore)</em> show
          what they do with all 10.
        </p>
      </section>

      <section className={styles.section}>
        <div className={styles.split}>
          <div>
            <h2 className={styles.sectionTitle}>Mistakes show up early</h2>
            <p className={styles.sectionLead}>
              Records turn into JSON and back with one call. A field that can
              be missing says so in its type, and the compiler does not let you
              use it before you check it. A function that can fail needs no
              special signature: its errors go up to the caller, and{' '}
              <code>catch</code> handles them where you choose.
            </p>
            <Link className={styles.ctaSecondary} href="/docs/errors">
              How errors work
            </Link>
          </div>
          <CodeWindow file="config.nio" html={config} />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>From source to server</h2>
        <p className={styles.sectionLead}>
          The compiler is written in Nio, and clang is the only thing it
          needs. It runs on macOS, Linux and Windows.
        </p>
        <ol className={styles.steps}>
          {STEPS.map((step, i) => (
            <li className={styles.step} key={step.cmd}>
              <span className={styles.stepNumber}>{i + 1}</span>
              <code className={styles.stepCmd}>{step.cmd}</code>
              <p className={styles.stepText}>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.footerCta}>
        <NioLogo size={56} id="footer-logo" />
        <h2 className={styles.sectionTitle}>Try Nio today</h2>
        <p className={styles.sectionLead}>
          Install the compiler with one command, then write your first
          program.
        </p>
        <div className={styles.ctaRow}>
          <Link className={styles.ctaPrimary} href="/docs/installation">
            Install Nio <span aria-hidden="true">→</span>
          </Link>
          <Link className={styles.ctaSecondary} href="/docs">
            Read the docs
          </Link>
          <a className={styles.ctaSecondary} href="https://github.com/nio-org/nio">
            View on GitHub
          </a>
        </div>
      </section>
    </div>
  )
}
