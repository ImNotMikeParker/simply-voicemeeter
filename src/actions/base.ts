import streamDeck, {
  SingletonAction,
  type Action,
  type DialAction,
  type DidReceiveSettingsEvent,
  type KeyAction,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import { vm } from "../shared";

const logger = streamDeck.logger.createScope("actions");
export type AnyAction<T extends JsonObject> = KeyAction<T> | DialAction<T>;
const asRenderable = <T extends JsonObject>(a: Action<T>): AnyAction<T> | null => (a.isNeoInfobar() ? null : a);

/**
 * Shared plumbing: settings per instance, redraw on model updates, optional level-meter subscription with a
 * throttled redraw (10 fps) so eight meters do not flood the Stream Deck.
 */
export abstract class VmAction<T extends JsonObject = JsonObject> extends SingletonAction<T> {
  protected readonly settingsById = new Map<string, T>();
  /** Set true in subclasses that draw a level meter. */
  protected usesMeter = false;
  private unsubscribe: (() => void) | null = null;
  private meterTick = 0;

  constructor() {
    super();
    vm.on("update", () => void this.renderAll());
    vm.on("levels", () => {
      if (!this.usesMeter || !this.unsubscribe) return;
      if (++this.meterTick % 2) return; // 20 fps source → 10 fps redraw
      void this.renderAll();
    });
  }

  protected abstract render(action: AnyAction<T>, settings: T): Promise<void>;

  override async onWillAppear(ev: WillAppearEvent<T>): Promise<void> {
    const settings = ev.payload.settings ?? ({} as T);
    this.settingsById.set(ev.action.id, settings);
    if (this.usesMeter && !this.unsubscribe && this.wantsMeter(settings)) this.unsubscribe = vm.subscribeLevels();
    const a = asRenderable(ev.action);
    if (a) await this.safeRender(a, settings);
  }

  override onWillDisappear(ev: WillDisappearEvent<T>): void {
    this.settingsById.delete(ev.action.id);
    if (this.unsubscribe && ![...this.settingsById.values()].some((s) => this.wantsMeter(s))) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<T>): Promise<void> {
    const settings = ev.payload.settings ?? ({} as T);
    this.settingsById.set(ev.action.id, settings);
    const any = [...this.settingsById.values()].some((s) => this.wantsMeter(s));
    if (this.usesMeter && any && !this.unsubscribe) this.unsubscribe = vm.subscribeLevels();
    if (this.unsubscribe && !any) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    const a = asRenderable(ev.action);
    if (a) await this.safeRender(a, settings);
  }

  /** Whether this instance's settings ask for a meter (default: the `meter` setting, on unless false). */
  protected wantsMeter(s: T): boolean {
    return (s as { meter?: boolean }).meter !== false;
  }

  protected async renderAll(): Promise<void> {
    for (const action of this.actions) {
      const a = asRenderable(action);
      if (a) await this.safeRender(a, this.settingsById.get(a.id) ?? ({} as T));
    }
  }

  protected async safeRender(a: AnyAction<T>, s: T): Promise<void> {
    try {
      await this.render(a, s);
    } catch (e) {
      logger.warn(`render failed for ${a.manifestId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  protected async run(a: AnyAction<T>, fn: () => void | Promise<void>): Promise<void> {
    if (!vm.connected) {
      await a.showAlert();
      return;
    }
    try {
      await fn();
    } catch (e) {
      logger.warn(`${a.manifestId}: ${e instanceof Error ? e.message : String(e)}`);
      await a.showAlert();
    }
  }
}
