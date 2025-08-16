#!/bin/bash

if [[ $CI -eq "true" ]]; then
	COMPAT_FILE=src/compat.ts
	perl -pi -e "s/<BUILD_DATE>/$(date -u +%Y-%m-%d)/g" "$COMPAT_FILE"
fi
