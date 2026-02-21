import { useLayoutStore } from "../../core/workspace/layoutStore";
import { useCurrentWidgetId } from "../../core/workspace/moduleRuntime";

type ShortcutState = {
  label?: string;
  path?: string;
};

export function ShortcutModule() {
  const widgetId = useCurrentWidgetId();
  const runtime = useLayoutStore((state) =>
    widgetId
      ? (state.moduleRuntimeStateByWidgetId[widgetId] as ShortcutState | undefined)
      : undefined,
  );

  return (
    <section className="module-body">
      <h3>App Shortcut</h3>
      <p>Atalho criado por drop externo.</p>
      <div className="module-item">
        <strong>{runtime?.label ?? "Arquivo"}</strong>
        <p>{runtime?.path ?? "Caminho indisponivel no ambiente atual."}</p>
      </div>
    </section>
  );
}
