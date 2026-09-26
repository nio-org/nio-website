# Playground runner

The service behind the Run button on https://nio-lang.org/playground. It takes
a program over HTTP, compiles and runs it in a sandbox, and answers what the
compiler and the program wrote. It is written in Nio (`server.nio`).

```
POST /run      {"code": "..."}
GET  /health   {"ok": true, "isolation": "namespaces", "network": "loopback", ...}
```

`/run` answers:

```json
{
  "stage": "run",
  "compilerOutput": "",
  "output": "hello\n",
  "exitCode": 0,
  "timedOut": false,
  "truncated": false,
  "compileMs": 104,
  "runMs": 1,
  "totalMs": 118,
  "network": "loopback"
}
```

When it starts, the runner compiles and runs one program in its own sandbox.
`/health` answers 503 with `"ok": false` and the reason in `selfTest` when that
failed, so a platform's health check can use it. The first log line says the
same.

`stage` is `"compile"` when the compiler refused the program. Then
`compilerOutput` holds its messages and nothing ran.

## Image

```
ghcr.io/nio-org/nio-playground:latest     linux/amd64 and linux/arm64
```

## The sandbox

Every run is one [nsjail](https://github.com/google/nsjail) process that
compiles the program and then runs it (`run.sh`). A run gets a slot, and each
slot has a host user of its own, so runs never share a user. On every host a
run has:

- a time limit: 15 seconds to compile and `RUN_SECONDS` (5 by default) to run
- 64 KB of output, at most 64 processes and 256 open files
- a seccomp policy that refuses mount, ptrace, bpf, new namespaces and other
  calls a program has no use for

What else it gets depends on what the host allows. The runner tries the
strongest first when it starts, and `/health` and its first log line say which
one it uses:

| Isolation | Where | Network | Files and processes | Memory |
|---|---|---|---|---|
| `full` | `docker run --privileged`, a VM | loopback only, per run | private root, `/tmp`, PIDs | 512 MB per run (cgroup) |
| `namespaces` | plain Docker, most container platforms | loopback only, per run | private root, `/tmp`, PIDs | 2 GB per process |
| `process` | platforms that allow no namespaces | none (see below) | own user and directory | 2 GB per process |

With `full` and `namespaces`, a program can start servers on any port and
connect to them, and two runs can use the same port at once. Nothing outside
the run can be reached: not the internet, the host, or the platform's
metadata server.

With `process`, the run shares the container's network, so internet sockets
are refused and programs that use `net`, `http` or `tls` fail. Set
`SANDBOX_NETWORK=open` to allow them, but only where the platform itself
blocks outbound traffic from the service, because a program could otherwise
reach the internet and the platform's metadata server. The runner refuses
requests that come from loopback in every mode, so a program cannot call it.

## Deploy

The container listens on `PORT` (8080 by default), which is what Cloud Run,
Render and Railway set.

| Variable | Default | Meaning |
|---|---|---|
| `ALLOWED_ORIGIN` | `*` | The site allowed to call it from a browser (CORS). Set it to `https://nio-lang.org`. |
| `MAX_RUNS` | one per CPU | Runs at once. A request past it waits up to 10 seconds for a slot, then gets 503. |
| `RUNS_PER_MINUTE` | `30` | Runs each client address may start per minute. |
| `RUN_SECONDS` | `5` | How long a program may run. |
| `TRUST_PROXY` | `false` | Take the client address from `X-Forwarded-For`. Set it to `true` behind a platform's proxy, which every one of these is. |
| `SANDBOX_ISOLATION` | `auto` | Force `full`, `namespaces` or `process`. |
| `SANDBOX_NETWORK` | `none` | `open` allows internet sockets in `process` isolation. |

Give the container about 1 GB of memory per run slot and one CPU per slot:
compiling is most of a run's work.

**Render and Railway** pull the image straight from ghcr.io. If the package
is private, give the platform a GitHub token with `read:packages`, or make
the package public in the organization's package settings.

**Cloud Run** runs images from Artifact Registry, not from ghcr.io. Copy the
image there first, or create an Artifact Registry remote repository that
points at `https://ghcr.io`:

```sh
docker pull ghcr.io/nio-org/nio-playground:latest
docker tag ghcr.io/nio-org/nio-playground:latest \
    REGION-docker.pkg.dev/PROJECT/nio/nio-playground:latest
docker push REGION-docker.pkg.dev/PROJECT/nio/nio-playground:latest

gcloud run deploy nio-playground \
    --image REGION-docker.pkg.dev/PROJECT/nio/nio-playground:latest \
    --execution-environment gen2 \
    --cpu 2 --memory 2Gi --concurrency 8 --timeout 60 \
    --set-env-vars ALLOWED_ORIGIN=https://nio-lang.org,TRUST_PROXY=true,MAX_RUNS=2 \
    --allow-unauthenticated
```

The second-generation environment is a full Linux kernel, where the
`namespaces` isolation is likely to work; `/health` says what it got. Give the
service its own service account with no roles, so nothing it could reach
carries any permission.

**A VM** with Docker gives the `full` isolation:

```sh
docker run -d --privileged --restart unless-stopped -p 8080:8080 \
    -e ALLOWED_ORIGIN=https://nio-lang.org -e TRUST_PROXY=true \
    ghcr.io/nio-org/nio-playground:latest
```

## Build

The image builds the compiler from the Nio source at a release tag:

```sh
docker build -t nio-playground runner
docker build --build-arg NIO_VERSION=0.2.0 -t nio-playground runner
```

To build from a local checkout of the language repository instead, and to
publish both architectures:

```sh
docker buildx build --platform linux/amd64,linux/arm64 \
    --build-context nio-src=../programming-language \
    -t ghcr.io/nio-org/nio-playground:latest --push runner
```

## The website

The playground page calls the runner at `NEXT_PUBLIC_RUNNER_URL`, which is
read when the site builds:

```sh
NEXT_PUBLIC_RUNNER_URL=https://play.nio-lang.org npm run build
```

Without it, the page calls `http://localhost:8080`, which is what a local
`docker run -p 8080:8080` gives.
