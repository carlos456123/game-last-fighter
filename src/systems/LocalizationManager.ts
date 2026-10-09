import ptBR from '@/data/locales/pt-BR.json';
import { DEFAULT_LANGUAGE } from '@/config/gameConfig';
import { Logger } from '@/utils/Logger';

type Dictionary = { [key: string]: string | string[] | Dictionary };
export type Params = Record<string, string | number>;

const LOCALES: Record<string, Dictionary> = { 'pt-BR': ptBR as Dictionary };

/**
 * All visible text goes through `t(key)`. Missing keys are reported once and rendered as the key
 * itself so they are easy to spot instead of crashing the game.
 */
export class LocalizationManager {
  private dict: Dictionary;
  private readonly warned = new Set<string>();

  constructor(private language: string = DEFAULT_LANGUAGE) {
    this.dict = LOCALES[language] ?? LOCALES[DEFAULT_LANGUAGE];
  }

  get current(): string {
    return this.language;
  }

  get available(): string[] {
    return Object.keys(LOCALES);
  }

  setLanguage(language: string): void {
    if (!LOCALES[language]) return;
    this.language = language;
    this.dict = LOCALES[language];
  }

  has(key: string): boolean {
    return typeof this.lookup(key) === 'string';
  }

  t(key: string, params?: Params): string {
    const value = this.lookup(key);
    if (typeof value !== 'string') {
      if (!this.warned.has(key)) {
        this.warned.add(key);
        Logger.warn('i18n', `Missing translation: ${key}`);
      }
      return key;
    }
    return params ? interpolate(value, params) : value;
  }

  list(key: string): string[] {
    const value = this.lookup(key);
    return Array.isArray(value) ? value : [];
  }

  private lookup(key: string): Dictionary[string] | undefined {
    let node: Dictionary[string] | undefined = this.dict;
    for (const part of key.split('.')) {
      if (typeof node !== 'object' || node === null || Array.isArray(node)) return undefined;
      node = node[part];
    }
    return node;
  }
}

export const interpolate = (text: string, params: Params): string =>
  text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
