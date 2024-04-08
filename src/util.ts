import type {Event} from 'nostr-tools';
import {now} from '@coracle.social/lib';

export const getInputTag = (e: Event) => e.tags.find(t => t[0] === 'i');

export const getInputValue = (e: Event) => getInputTag(e)![1];

export const getInputParams = (e: Event, k: string) =>
  e.tags.filter(t => t[0] === 'param' && t[1] === k).map(t => t[2]);

export const getInputParam = (e: Event, k: string) => getInputParams(e, k)[0];

export const withExpiration = (tags: string[][], delta = 5 * 60 * 60) => [
  ...tags,
  ['expiration', String(now() + delta)],
];
