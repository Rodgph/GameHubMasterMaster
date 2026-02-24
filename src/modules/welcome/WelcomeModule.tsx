import type { ModuleId } from "../../core/modules/types";
import { useSessionStore } from "../../core/stores/sessionStore";
import { useLayoutStore } from "../../core/workspace/layoutStore";
import "./welcome.css";

const MANAGED_MODULES: Array<Extract<ModuleId, "chat" | "feed" | "music">> = [
  "chat",
  "feed",
  "music",
];
const MODULE_LABELS: Record<Extract<ModuleId, "chat" | "feed" | "music">, string> = {
  chat: "Chat",
  feed: "Feed",
  music: "Music",
};

export function WelcomeModule() {
  const modulesEnabled = useSessionStore((state) => state.modulesEnabled);
  const setModuleEnabled = useSessionStore((state) => state.setModuleEnabled);
  const markWelcomeDone = useSessionStore((state) => state.markWelcomeDone);
  const ensureModuleDocked = useLayoutStore((state) => state.ensureModuleDocked);
  const closeWidgetsByModule = useLayoutStore((state) => state.closeWidgetsByModule);
  const widgetsById = useLayoutStore((state) => state.widgetsById);

  const handleContinue = async () => {
    await markWelcomeDone();
    for (const moduleId of MANAGED_MODULES) {
      if (modulesEnabled[moduleId]) {
        ensureModuleDocked(moduleId);
      } else if (Object.values(widgetsById).some((widget) => widget.moduleId === moduleId)) {
        closeWidgetsByModule(moduleId);
      }
    }
    closeWidgetsByModule("welcome");
  };

  return (
    <section className="welcome-module">
      <h2>Welcome</h2>
      <p>Ative os modulos que deseja usar agora. Voce pode ajustar depois.</p>
      <div className="welcome-modules-list">
        {MANAGED_MODULES.map((moduleId) => (
          <label key={moduleId} className="welcome-module-item">
            <div>
              <strong>{MODULE_LABELS[moduleId]}</strong>
              <span>{moduleId}</span>
            </div>
            <input
              type="checkbox"
              checked={Boolean(modulesEnabled[moduleId])}
              onChange={(event) => setModuleEnabled(moduleId, event.target.checked)}
            />
          </label>
        ))}
      </div>
      <button type="button" className="welcome-continue" onClick={() => void handleContinue()}>
        Continuar
      </button>
    </section>
  );
}
