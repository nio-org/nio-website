# syntax=docker/dockerfile:1.7
#
# The playground runner: an HTTP service that compiles and runs Nio programs,
# each in an nsjail sandbox of its own. See README.md.
#
#   docker build -t nio-playground runner
#   docker run -p 8080:8080 nio-playground
#
# It runs anywhere, and --privileged gives it the strongest isolation.
#
# The Nio source comes from the release tag. To build from a local checkout:
#
#   docker build --build-context nio-src=../programming-language -t nio-playground runner

ARG NIO_VERSION=0.1.0
ARG NSJAIL_VERSION=3.4

# The Nio source tree, at the root of this stage.
FROM scratch AS nio-src
ARG NIO_VERSION
ADD https://github.com/nio-org/nio.git#v${NIO_VERSION} /

FROM debian:trixie-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends clang lld \
    && rm -rf /var/lib/apt/lists/*
# GNU ld reads LLVM bitcode only with a plugin, so every link goes through lld.
# The same wrapper is in the final image, where the sandbox also finds it.
RUN printf '#!/bin/sh\nexec /usr/bin/clang -fuse-ld=lld "$@"\n' > /usr/local/bin/clang \
    && chmod 755 /usr/local/bin/clang

# nsjail is not packaged for Debian.
FROM debian:trixie-slim AS nsjail
ARG NSJAIL_VERSION
RUN apt-get update \
    && apt-get install -y --no-install-recommends autoconf bison ca-certificates flex \
        g++ gcc git libnl-route-3-dev libprotobuf-dev libtool make pkg-config \
        protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --branch "$NSJAIL_VERSION" https://github.com/google/nsjail /nsjail \
    && make -C /nsjail -j"$(nproc)"

# Stage 0 from the checked-in IR, then the compiler builds itself.
FROM base AS build
COPY --from=nio-src / /src
RUN cd /src && sh bootstrap/build.sh /tmp/nio0 \
    && /tmp/nio0 build --release src/nio.nio -o /usr/local/bin/nio
COPY server.nio /runner/
RUN nio build --release /runner/server.nio -o /usr/local/bin/nio-playground

FROM base
RUN apt-get update \
    && apt-get install -y --no-install-recommends libnl-route-3-200 libprotobuf32t64 tini \
    && rm -rf /var/lib/apt/lists/*
COPY --from=nsjail /nsjail/nsjail /usr/local/bin/
COPY --from=build /usr/local/bin/nio /usr/local/bin/nio-playground /usr/local/bin/
COPY --chmod=755 run.sh slot.sh entrypoint.sh /usr/local/lib/nio-playground/
COPY sandbox.cfg sandbox-process.cfg /usr/local/lib/nio-playground/
# Run slots' directories, used when the host allows no namespaces.
RUN mkdir -m 711 /var/lib/nio-playground

# Fill the compiler's object cache with every runtime file, so a run compiles
# only its own program. The sandbox mounts it read only.
COPY warm.nio /tmp/warm/
RUN cd /tmp/warm && XDG_DATA_HOME=/opt/nio-data nio build warm.nio -o warm \
    && ./warm && rm -rf /tmp/warm && chmod -R a+rX /opt/nio-data

LABEL org.opencontainers.image.title="nio-playground" \
      org.opencontainers.image.description="Compiles and runs Nio programs for the playground at nio-lang.org, each in a sandbox of its own."

EXPOSE 8080
# tini reaps processes a run left behind once they are killed. Without a
# namespace of its own, such a process becomes a child of process 1.
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/lib/nio-playground/entrypoint.sh"]
