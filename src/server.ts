import 'dotenv/config'

import {DVM} from './dvm';
import countHandlers from './handlers/count';

const sk = process.env.NIKABRIK_SK as string
const relays = process.env.NIKABRIK_RELAYS as string

export const dvm = new DVM({
  sk,
  relays: relays.split(','),
  handlers: {
    ...countHandlers,
  },
})

if (process.env.NIKABRIK_ENABLE_LOGGING) {
  console.info(`Started dvm with ${Object.keys(dvm.opts.handlers).length} handlers`)
}
