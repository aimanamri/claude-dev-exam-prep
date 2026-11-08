#!/bin/bash
# Double-click in Finder to start the CCDV-F practice exam site.
cd "$(dirname "$0")"
python3 server.py --open
