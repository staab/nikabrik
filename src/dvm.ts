import type {Event, EventTemplate} from 'nostr-tools';
import type {Filter} from '@coracle.social/util';
import {getSignature, getPublicKey, getEventHash} from 'nostr-tools';
import {now} from '@coracle.social/lib';
import {subscribe, publish} from '@coracle.social/network';
import {getInputTag} from './util';

export type DVMAgent = {
  stop?: () => void;
  handleEvent: (e: Event) => AsyncGenerator<EventTemplate>;
};

export type CreateDVMAgent = (dvm: DVM) => DVMAgent;

export type DVMOpts = {
  sk: string;
  relays: string[];
  agents: Record<string, CreateDVMAgent>;
  strict?: boolean;
};

export class DVM {
  seen = new Set();
  agents = new Map();
  stopped = false;

  constructor(readonly opts: DVMOpts) {
    this.init();
    this.listen();
  }

  init() {
    for (const [kind, createAgent] of Object.entries(this.opts.agents)) {
      this.agents.set(parseInt(kind), createAgent(this));
    }
  }

  async listen() {
    this.stopped = false;

    const {strict, sk, relays} = this.opts;

    const filter: Filter = {
      kinds: Array.from(this.agents.keys()),
      since: now(),
    };

    if (strict) {
      filter['#p'] = [getPublicKey(sk)];
    }

    while (!this.stopped) {
      await new Promise<void>(resolve => {
        const sub = subscribe({timeout: 30_000, relays, filters: [filter]});

        // @ts-ignore
        sub.emitter.on('event', (url, e) => this.onEvent(e));
        sub.emitter.on('complete', () => resolve());
      });
    }
  }

  async onEvent(e: Event) {
    if (this.seen.has(e.id)) {
      return;
    }

    const agent = this.agents.get(e.kind);

    if (!agent) {
      return;
    }

    this.seen.add(e.id);

    if (process.env.NIKABRIK_ENABLE_LOGGING) {
      console.info('Handling request', e);
    }

    for await (const event of agent.handleEvent(e)) {
      if (event.kind !== 7000) {
        event.tags.push(['request', JSON.stringify(e)]);

        const inputTag = getInputTag(e);

        if (inputTag) {
          event.tags.push(inputTag);
        }
      }

      event.tags.push(['p', e.pubkey]);
      event.tags.push(['e', e.id]);

      if (process.env.NIKABRIK_ENABLE_LOGGING) {
        console.info('Publishing event', event);
      }

      this.publish(event);
    }
  }

  async publish(template: EventTemplate) {
    const {sk, relays} = this.opts;
    const event = template as any;

    event.pubkey = getPublicKey(sk);
    event.id = getEventHash(event);
    event.sig = getSignature(event, sk);

    await new Promise<void>(resolve => {
      publish({event, relays}).emitter.on('success', () => resolve());
    });
  }

  stop() {
    for (const agent of this.agents.values()) {
      agent.stop?.();
    }

    this.stopped = true;
  }
}
