// Measured on 2026-09-26 with the scripts in the language repository's
// benchmark/ folder. Nio programs built with --release.

export const MACHINE =
  'Apple M4 (10 cores), macOS, clang 21, Go 1.26, Java 23, Node.js 24'

export const COMPUTE = {
  unit: 'ms',
  better: 'lower',
  valueLabel: 'time',
  extraLabel: 'memory',
  note: 'Time is wall clock, the median of 10 runs. Memory, underlined, is the peak memory of the whole process. Java and Node.js include the start of their virtual machines: about 30 ms and 42 MB for Java, 20 ms and 44 MB for Node.js.',
  series: ['Nio', 'C', 'Go', 'Java', 'Node.js'],
  groups: [
    {
      name: 'loops',
      what: '100 million loop steps over an array',
      detail: [
        'Two nested loops of 10,000 steps each add j % 10 into one element of a 10,000-element int array.',
        'The loop reads and writes the array, so the compiler cannot fold the work away. This measures raw loop, modulo and array-access speed.',
        'Taken from bddicken/languages.'
      ],
      values: [59, 22, 134, 81, 137],
      extra: ['1.8 MB', '1.7 MB', '4.6 MB', '43.2 MB', '51.3 MB']
    },
    {
      name: 'fib',
      what: 'recursive function calls',
      detail: [
        'Computes fib(35) with the plain recursive definition: about 30 million calls, each doing one comparison and one addition.',
        'Almost all the time goes to calling and returning, so this measures the cost of a function call.'
      ],
      values: [19, 20, 24, 42, 80],
      extra: ['1.7 MB', '1.7 MB', '4.4 MB', '42.8 MB', '50.3 MB']
    },
    {
      name: 'primes',
      what: 'integer division and comparisons',
      detail: [
        'Counts the primes below 2,000,000 by trying every odd divisor up to the square root.',
        'Nearly all the time is integer %, multiplication and comparisons in a short inner loop.'
      ],
      values: [65, 67, 59, 89, 134],
      extra: ['1.7 MB', '1.7 MB', '4.4 MB', '43.0 MB', '50.7 MB']
    },
    {
      name: 'mandelbrot',
      what: 'floating-point math',
      detail: [
        'Runs the Mandelbrot iteration z = z² + c for each point of a 1000 × 1000 grid, up to 250 steps per point.',
        'The work is double-precision multiplication and addition.',
        'C is built with -ffp-contract=off, so every language does the same float operations and prints the same checksum.'
      ],
      values: [90, 92, 94, 116, 119],
      extra: ['1.7 MB', '1.7 MB', '4.4 MB', '43.3 MB', '52.1 MB']
    },
    {
      name: 'records',
      what: 'allocating 2 million records',
      detail: [
        'Creates 2 million Segment records, each holding two Point records (6 million allocations), and reads their fields.',
        'A four-slot ring buffer keeps the newest segments alive and drops the older ones.',
        'Nio, Go, Java and Node.js free them with their garbage collectors. C frees each one with free().'
      ],
      values: [34, 72, 54, 57, 43],
      extra: ['3.2 MB', '1.7 MB', '11.8 MB', '115.8 MB', '54.0 MB']
    },
    {
      name: 'strings',
      what: 'building and comparing strings',
      detail: [
        'Builds a 32-character string by appending "ab" 16 times, then compares it with a target. This repeats 100,000 times.',
        'That is 1.6 million new strings, so this measures string allocation, copying and equality.'
      ],
      values: [17, 41, 26, 56, 35],
      extra: ['3.3 MB', '1.8 MB', '11.2 MB', '86.8 MB', '53.3 MB']
    },
    {
      name: 'files',
      what: 'file I/O and regular expressions',
      detail: [
        'Writes a 401-line file to a temporary folder. Then, 1,000 times: reads the whole file, finds "counter = NNNN" with a regular expression, adds one to the number, and writes the file back.',
        'The match is on the last line, so every search scans the whole text.'
      ],
      values: [63, 67, 67, 178, 94],
      extra: ['3.4 MB', '2.0 MB', '10.6 MB', '77.6 MB', '52.9 MB']
    }
  ]
}

export const ASYNC = {
  unit: 'ms',
  better: 'lower',
  valueLabel: 'time',
  extraLabel: 'memory',
  note: 'Time is wall clock, the average of 10 runs. Memory, underlined, is the peak memory of the whole process.',
  series: ['Nio', 'Go', 'Node.js'],
  groups: [
    {
      name: 'spawn',
      what: 'a million short tasks, 10,000 at a time',
      detail: [
        'In 100 waves, starts 10,000 async tasks and then awaits all of them: one million tasks in total. Each task does one modulo and returns.',
        'This measures how fast the runtime creates, schedules and frees tasks.',
        'Go uses goroutines with a WaitGroup. Node.js uses promises.'
      ],
      values: [37, 141, 75],
      extra: ['8.9 MB', '12.9 MB', '85.7 MB']
    },
    {
      name: 'chain',
      what: 'start a task and await it, one after another',
      detail: [
        'One async function awaits another one million times in a row. Each await starts a new task that adds one and returns.',
        'Nothing runs at the same time, so this measures one full start, suspend and resume through the scheduler.'
      ],
      values: [23, 226, 54],
      extra: ['2.8 MB', '11.1 MB', '51.0 MB']
    },
    {
      name: 'sleepers',
      what: '10,000 tasks sleeping at the same time',
      detail: [
        'Starts 10,000 tasks that each sleep for 1 ms, then waits for all of them.',
        'They all sleep at the same time, so about 1 ms of the result is the sleep itself. The rest is the cost of the timers and wake-ups.'
      ],
      values: [5, 8, 33],
      extra: ['4.4 MB', '23.1 MB', '65.7 MB']
    }
  ]
}

export const HTTP = {
  unit: 'req/s',
  better: 'higher',
  valueLabel: 'req/s',
  extraLabel: 'memory',
  note: 'Requests per second: how many complete requests the server answered each second, so 139k means 139,000 responses every second. Averaged over three small routes, over keep-alive connections on the same machine, and the median of three passes. Memory, underlined, is the peak memory of the server process.',
  series: ['Nio', 'Go', 'Go (multicore)', 'Java', 'Java (multicore)', 'Node.js'],
  groups: [
    {
      name: '1 connection',
      what: 'one client, one request at a time',
      detail: [
        'One client sends a request only after it gets the previous response, 200,000 times per route.',
        'This measures how long one request takes to go through each HTTP stack.',
        'Each server has three routes: /plaintext answers "Hello, World!", /json answers it as a JSON object, and /users/:id answers with a path parameter.',
        'One load generator, written in Go, sends keep-alive requests over loopback without pipelining. Opening connections is not timed.',
        'Java is the JDK\'s built-in server with one virtual thread per request, and no libraries from outside the JDK.'
      ],
      values: [55570, 51790, 38953, 42161, 41891, 51558],
      extra: ['3.6 MB', '15.4 MB', '19.4 MB', '216.1 MB', '389.6 MB', '69.5 MB']
    },
    {
      name: '100 connections',
      what: 'many clients at once',
      detail: [
        '100 clients send requests at the same time, 200,000 requests per route.',
        'Nio and Node.js serve from one thread, and Go and Java are limited to one core to match. Go (multicore) and Java (multicore) use all 10 cores.',
        'Each server has three routes: /plaintext answers "Hello, World!", /json answers it as a JSON object, and /users/:id answers with a path parameter.',
        'One load generator, written in Go, sends keep-alive requests over loopback without pipelining. Opening connections is not timed.',
        'Java is the JDK\'s built-in server with one virtual thread per request, and no libraries from outside the JDK.'
      ],
      values: [170666, 155204, 184003, 135996, 183110, 136655],
      extra: ['5.3 MB', '16.5 MB', '23.1 MB', '234.0 MB', '478.5 MB', '98.4 MB']
    },
    {
      name: '1,000 connections',
      what: 'a thousand clients at once',
      detail: [
        '1,000 clients send requests at the same time, 1,000,000 requests per route.',
        'This shows how each server handles many open connections, and how much memory they cost.',
        'Each server has three routes: /plaintext answers "Hello, World!", /json answers it as a JSON object, and /users/:id answers with a path parameter.',
        'One load generator, written in Go, sends keep-alive requests over loopback without pipelining. Opening connections is not timed.',
        'Java is the JDK\'s built-in server with one virtual thread per request, and no libraries from outside the JDK.'
      ],
      values: [138868, 128216, 190295, 116461, 180545, 115641],
      extra: ['16.7 MB', '41.7 MB', '61.0 MB', '396.6 MB', '704.1 MB', '227.5 MB']
    }
  ]
}

export const TABS = [
  { key: 'http', label: 'HTTP server', data: HTTP },
  { key: 'compute', label: 'Speed', data: COMPUTE },
  { key: 'async', label: 'Async', data: ASYNC }
]
