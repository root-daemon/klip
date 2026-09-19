import type { KlipAPI } from '../preload/index';

declare global {
  interface Window {
    klip: KlipAPI;
  }
}

