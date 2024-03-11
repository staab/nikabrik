# Nikabrik [![version](https://badgen.net/npm/v/nikabrik)](https://npmjs.com/package/nikabrik)

Utilities for building DVMs on nostr. See `count` for an example of how to build a custom dvm handler.

```javascript
import {DVM, countAgents} from 'nikabrik'

const dvm = new DVM({
  sk: 'your dvm private key here',
  relays: ['wss://relay.damus.io'],
  agents: {
    ...countAgents,
  }
})

// When you're done
dvm.stop()
```
