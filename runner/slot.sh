#!/bin/sh
# Prepares one run slot when the sandbox has no namespaces, and clears it
# again afterwards: stops every process of the slot's user and gives it an
# empty directory that only that user can read.
#
#   slot.sh <slot>
set -u
uid=$((20000 + $1))
dir=/var/lib/nio-playground/slot-$1

# kill -1 as the slot's user reaches every process that user owns and nothing
# else, including one a program detached from the run.
setpriv --reuid="$uid" --regid="$uid" --clear-groups sh -c 'kill -KILL -1' 2>/dev/null
rm -rf "$dir"
mkdir -m 700 "$dir" && chown "$uid:$uid" "$dir"
