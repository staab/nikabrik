import type {Event} from 'nostr-tools';
import type {Subscription} from '@coracle.social/network';
import type {Filter} from '@coracle.social/util';
import {now} from '@coracle.social/lib';
import {Tags, createEvent} from '@coracle.social/util';
import {subscribe} from '@coracle.social/network';
import {seconds} from 'hurdak';
import type {DVM} from '../dvm';
import {getInputParams, withExpiration, getInputValue} from '../util';

type CountWithProgressOpts = {
  dvm: DVM;
  event: Event;
  filters: Filter[];
  init: (sub: Subscription) => void;
  getResult: () => string;
};

const getGroupKey = (group: string, e: Event) => {
  if (['content', 'pubkey'].includes(group)) {
    return (e as any)[group];
  }

  if (group === 'reply') {
    return Tags.fromEvent(e).reply().value();
  }

  if (group === 'root') {
    return Tags.fromEvent(e).root().value();
  }

  if (group.match(/^created_at\/\d+$/)) {
    return Math.floor(e.created_at / parseInt(group.split('/').slice(-1)[0]));
  }

  return Tags.fromEvent(e).get(group)?.value() || '';
};

async function* countWithProgress({
  dvm,
  event,
  filters,
  init,
  getResult,
}: CountWithProgressOpts) {
  const sub = subscribe({
    filters,
    timeout: 30000,
    closeOnEose: true,
    relays: getInputParams(event, 'relay'),
  });

  init(sub);

  let done = false;
  let prev = '0';

  sub.emitter.on('complete', () => {
    done = true;
  });

  while (!done) {
    await new Promise(resolve => setTimeout(resolve, 500));

    const cur = getResult();

    if (cur !== prev) {
      yield createEvent(7000, {
        content: cur,
        tags: withExpiration([]),
      });
    }

    prev = cur;
  }

  yield createEvent(event.kind + 1000, {
    content: getResult(),
    tags: [['expiration', String(now() + seconds(1, 'hour'))]],
  });
}

export const configureCountAgent = () => (dvm: DVM) => ({
  handleEvent: async function* (event: Event) {
    const groups = getInputParams(event, 'group');

    let result = groups.length > 0 ? {} : 0;

    yield* countWithProgress({
      dvm,
      event,
      filters: JSON.parse(getInputValue(event)),
      getResult: () => JSON.stringify(result),
      init: (sub: Subscription) => {
        sub.emitter.on('event', (e: Event) => {
          if (groups.length === 0) {
            (result as number) += 1;
          } else {
            let data: any = result;

            groups.forEach((group, i) => {
              const key = getGroupKey(group, e);

              if (i < groups.length - 1) {
                if (!data[key]) {
                  data[key] = {};
                }

                data = data[key];
              } else {
                if (!data[key]) {
                  data[key] = 0;
                }

                data[key] += 1;
              }
            });
          }
        });
      },
    });
  },
});

export default {
  '5400': configureCountAgent(),
};
