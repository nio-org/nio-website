#!/bin/sh
# Runs inside the sandbox, once per request. The program arrives on standard
# input. Standard error gets the compiler's messages and then one status line.
# Standard output gets the program's own output, both of its streams, in the
# order it wrote them.
#
# The status line is one of:
#
#   nio-playground compile <status> <compile milliseconds>
#   nio-playground run <status> <compile milliseconds> <run milliseconds>
#
# A run stopped by its time limit has status 124. One killed by a signal, such
# as the memory limit's, has 128 plus the signal number.

limit=65536
umask 077
work=${WORK:-/tmp}
cd "$work" || exit 1
export HOME="$work" TMPDIR="$work"
cat > main.nio

start=$(date +%s%N)
timeout -k 1 "${COMPILE_SECONDS:-15}" nio build main.nio -o main > compile.txt 2>&1
status=$?
end=$(date +%s%N)
compile_ms=$(((end - start) / 1000000))
head -c "$limit" compile.txt >&2
if [ "$status" -ne 0 ]; then
    echo "nio-playground compile $status $compile_ms" >&2
    exit 0
fi

# One byte over the limit tells the runner that the output was cut. When head
# stops reading, the program gets SIGPIPE on its next write.
#
# C's stdio holds output written to a pipe until a buffer fills. stdbuf makes
# it write each line at once, so a program stopped by its time limit keeps
# what it printed, and a runtime error on stderr comes after the lines printed
# before it.
start=$(date +%s%N)
{ timeout -k 1 "${RUN_SECONDS:-5}" stdbuf -oL -eL ./main; echo $? > status; } 2>&1 |
    head -c $((limit + 1))
end=$(date +%s%N)
echo "nio-playground run $(cat status 2>/dev/null || echo 137) $compile_ms $(((end - start) / 1000000))" >&2
