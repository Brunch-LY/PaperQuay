#!/bin/sh
set -eu

exec "${PAPERQUAY_ELECTRON:-electron}" /usr/lib/paperquay "$@"
