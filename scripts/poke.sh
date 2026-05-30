#!/bin/bash
# Poke the running Desktop Pet to simulate a Claude/Codex activity state,
# so you can watch the pet react without a full session.
#
#   scripts/poke.sh working   # pet "works" (bouncing dots above it)
#   scripts/poke.sh tool      # tool running
#   scripts/poke.sh idle      # pet relaxes / wanders
#
KIND="${1:-working}"
if curl -s -m 2 -X POST http://127.0.0.1:38917/event \
  -H 'content-type: application/json' \
  -d "{\"source\":\"claude\",\"kind\":\"$KIND\"}" >/dev/null 2>&1; then
  echo "poked: $KIND"
else
  echo "couldn't reach the pet — is it running?  (npm start)"
fi
