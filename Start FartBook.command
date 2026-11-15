#!/bin/bash
# Double-click me in Finder to start FartBook Pro (it opens Terminal, asks your Mac password once, opens Safari).
cd "$(dirname "$0")"
exec ./scripts/start.sh "$@"
