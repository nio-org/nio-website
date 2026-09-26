#!/bin/sh
# Starts the runner. Settings come from the environment, because the runner
# reads its flags and Nio programs have no access to environment variables.
set -eu
lib=/usr/local/lib/nio-playground

# nsjail gives every run a cgroup of its own under /sys/fs/cgroup when the
# container may write there, which needs --privileged. cgroup v2 lets a group
# pass controllers to its children only when it holds no processes itself, so
# everything already running moves into a leaf first.
cgroups() {
    cg=/sys/fs/cgroup
    [ -w "$cg/cgroup.subtree_control" ] || return 1
    mkdir -p "$cg/runner" || return 1
    for pid in $(cat "$cg/cgroup.procs"); do
        echo "$pid" > "$cg/runner/cgroup.procs" 2>/dev/null || true
    done
    echo "+memory +pids +cpu" > "$cg/cgroup.subtree_control"
}

# Whether nsjail can make a sandbox with namespaces here, with the extra flags.
probe() {
    nsjail --config "$lib/sandbox.cfg" -u 1000:20000:1 -g 1000:20000:1 "$@" \
        -- /bin/true < /dev/null > /dev/null 2>&1
}

# The strongest isolation this host allows, unless SANDBOX_ISOLATION names one.
isolation=${SANDBOX_ISOLATION:-auto}
if [ "$isolation" = auto ]; then
    if cgroups && probe --mount none:/proc:proc: --use_cgroupv2 --cgroup_pids_max 64; then
        isolation=full
    elif probe; then
        isolation=namespaces
    else
        isolation=process
    fi
fi

exec nio-playground \
    --port "${PORT:-8080}" \
    --origin "${ALLOWED_ORIGIN:-*}" \
    --max-runs "${MAX_RUNS:-0}" \
    --per-minute "${RUNS_PER_MINUTE:-30}" \
    --run-seconds "${RUN_SECONDS:-5}" \
    --trust-proxy "${TRUST_PROXY:-false}" \
    --isolation "$isolation" \
    --network "${SANDBOX_NETWORK:-none}"
