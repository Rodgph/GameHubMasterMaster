import { useEffect, useMemo, useRef, useState } from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { moduleRegistry } from "../modules/registry";
import type { DockEdge, WidgetLayout } from "./layoutStore";
import { useLayoutStore } from "./layoutStore";
import { DockShell } from "./shells/DockShell";
import { PopoutZone } from "./shells/PopoutZone";
import { TabContextMenu } from "./shells/TabContextMenu";
import { WidgetShell } from "./shells/WidgetShell";
import "./Workspace.css";
import { isTauri } from "../platform/isTauri";
import { tauriListen } from "../platform/tauriEvents";

const DOCK_SNAP_THRESHOLD = 24;
const PANEL_SNAP_THRESHOLD = 56;
const DOCK_UNDOCK_MARGIN = 40;

type PanelOverlayRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type SnapState =
  | { widgetId: string; kind: "workspace-edge"; edge: DockEdge }
  | {
      widgetId: string;
      kind: "panel-split";
      targetWidgetId: string;
      side: DockEdge;
      rect: PanelOverlayRect;
    }
  | {
      widgetId: string;
      kind: "panel-tab";
      targetWidgetId: string;
      rect: PanelOverlayRect;
    }
  | null;

type DockDragSnap = {
  kind: "panel-split" | "panel-tab";
  movingId: string;
  targetId: string;
  side?: DockEdge;
  rect: PanelOverlayRect;
} | null;

type TabDragSnap =
  | { kind: "reorder"; leafId: string; tabId: string; toIndex: number }
  | { kind: "panel-split"; leafId: string; tabId: string; targetId: string; side: DockEdge }
  | { kind: "panel-tab"; leafId: string; tabId: string; targetId: string }
  | null;

type TabContextMenuState = {
  open: boolean;
  x: number;
  y: number;
  leafId: string | null;
  tabId: string | null;
};

export function Workspace() {
  const widgets = useLayoutStore((state) => state.widgets);
  const dockTree = useLayoutStore((state) => state.dockTree);
  const addWidget = useLayoutStore((state) => state.addWidget);
  const dockWidget = useLayoutStore((state) => state.dockWidget);
  const dockIntoLeaf = useLayoutStore((state) => state.dockIntoLeaf);
  const dockAsTab = useLayoutStore((state) => state.dockAsTab);
  const closeWidget = useLayoutStore((state) => state.closeWidget);
  const closeWidgetWindow = useLayoutStore((state) => state.closeWidgetWindow);
  const reorderDockTab = useLayoutStore((state) => state.reorderDockTab);
  const detachDockTab = useLayoutStore((state) => state.detachDockTab);
  const popoutDockTab = useLayoutStore((state) => state.popoutDockTab);
  const closeDockTab = useLayoutStore((state) => state.closeDockTab);
  const moveDockedWidget = useLayoutStore((state) => state.moveDockedWidget);
  const undockWidgetAt = useLayoutStore((state) => state.undockWidgetAt);
  const resetLayout = useLayoutStore((state) => state.resetLayout);
  const canvasRef = useRef<HTMLElement | null>(null);
  const popoutZoneRef = useRef<HTMLElement | null>(null);
  const snapRef = useRef<SnapState>(null);
  const dockDragRef = useRef<DockDragSnap>(null);
  const tabDragRef = useRef<TabDragSnap>(null);
  const [snapState, setSnapState] = useState<SnapState | null>(null);
  const [dockDragSnap, setDockDragSnap] = useState<DockDragSnap>(null);
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [dragPassedThreshold, setDragPassedThreshold] = useState(false);
  const [popoutIntent, setPopoutIntent] = useState(false);
  const [overPopoutZone, setOverPopoutZone] = useState(false);
  const [tabContextMenu, setTabContextMenu] = useState<TabContextMenuState>({
    open: false,
    x: 0,
    y: 0,
    leafId: null,
    tabId: null,
  });

  const floatingWidgets = useMemo(
    () => widgets.filter((widget) => widget.mode === "widget" && widget.host !== "tauri"),
    [widgets],
  );
  const widgetsById = useMemo<Record<string, WidgetLayout>>(
    () => Object.fromEntries(widgets.map((widget) => [widget.id, widget])),
    [widgets],
  );
  const firstDockedWidgetId = useMemo(
    () => widgets.find((widget) => widget.mode === "dock")?.id,
    [widgets],
  );

  useEffect(() => {
    if (!isTauri) return;

    let unlistenAttach: (() => void) | null = null;
    let unlistenClose: (() => void) | null = null;

    void tauriListen<{ widgetId: string }>("mm:attach_widget", async (payload) => {
      const widgetId = payload.widgetId;
      await closeWidgetWindow(widgetId);
      if (firstDockedWidgetId && firstDockedWidgetId !== widgetId) {
        dockAsTab(widgetId, firstDockedWidgetId);
      } else {
        dockWidget(widgetId, "right");
      }
    }).then((unlisten) => {
      unlistenAttach = unlisten;
    });

    void tauriListen<{ widgetId: string }>("mm:close_widget", (payload) => {
      closeWidget(payload.widgetId);
    }).then((unlisten) => {
      unlistenClose = unlisten;
    });

    return () => {
      unlistenAttach?.();
      unlistenClose?.();
    };
  }, [closeWidget, closeWidgetWindow, dockAsTab, dockWidget, firstDockedWidgetId]);

  const getEdgeFromPointer = (pointerX: number, pointerY: number): DockEdge | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    if (
      pointerX < rect.left ||
      pointerX > rect.right ||
      pointerY < rect.top ||
      pointerY > rect.bottom
    ) {
      return null;
    }
    if (pointerX - rect.left <= DOCK_SNAP_THRESHOLD) return "left";
    if (rect.right - pointerX <= DOCK_SNAP_THRESHOLD) return "right";
    if (pointerY - rect.top <= DOCK_SNAP_THRESHOLD) return "top";
    if (rect.bottom - pointerY <= DOCK_SNAP_THRESHOLD) return "bottom";
    return null;
  };

  const getDockPanelAtPoint = (pointerX: number, pointerY: number): HTMLElement | null => {
    const topEl = document.elementFromPoint(pointerX, pointerY) as HTMLElement | null;
    const immediatePanel = topEl?.closest("[data-dock-widget-id]") as HTMLElement | null;
    if (immediatePanel) return immediatePanel;

    const stack = document.elementsFromPoint(pointerX, pointerY);
    for (const element of stack) {
      if (!(element instanceof HTMLElement)) continue;
      const panel = element.closest("[data-dock-widget-id]") as HTMLElement | null;
      if (panel) return panel;
    }
    return null;
  };

  const getSideWithinPanel = (
    panelEl: HTMLElement,
    pointerX: number,
    pointerY: number,
  ): DockEdge | null => {
    const rect = panelEl.getBoundingClientRect();
    if (
      pointerX < rect.left ||
      pointerX > rect.right ||
      pointerY < rect.top ||
      pointerY > rect.bottom
    ) {
      return null;
    }
    if (pointerX <= rect.left + PANEL_SNAP_THRESHOLD) return "left";
    if (pointerX >= rect.right - PANEL_SNAP_THRESHOLD) return "right";
    if (pointerY <= rect.top + PANEL_SNAP_THRESHOLD) return "top";
    if (pointerY >= rect.bottom - PANEL_SNAP_THRESHOLD) return "bottom";
    return null;
  };

  const getPanelDropIntent = (
    panelEl: HTMLElement,
    pointerX: number,
    pointerY: number,
  ):
    | { kind: "panel-split"; side: DockEdge; rect: PanelOverlayRect }
    | { kind: "panel-tab"; rect: PanelOverlayRect }
    | null => {
    const rect = panelEl.getBoundingClientRect();
    const side = getSideWithinPanel(panelEl, pointerX, pointerY);
    const panelRect = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
    if (side) {
      return { kind: "panel-split", side, rect: panelRect };
    }
    return { kind: "panel-tab", rect: panelRect };
  };

  const isOutsideDockRootWithMargin = (pointerX: number, pointerY: number) => {
    const dockRoot = document.querySelector(".dock-root");
    if (!(dockRoot instanceof HTMLElement)) return true;
    const rect = dockRoot.getBoundingClientRect();
    return (
      pointerX < rect.left - DOCK_UNDOCK_MARGIN ||
      pointerX > rect.right + DOCK_UNDOCK_MARGIN ||
      pointerY < rect.top - DOCK_UNDOCK_MARGIN ||
      pointerY > rect.bottom + DOCK_UNDOCK_MARGIN
    );
  };

  const getIsOverPopoutZone = (pointerX: number, pointerY: number) => {
    const popoutZone = popoutZoneRef.current;
    if (!popoutZone) return false;
    const rect = popoutZone.getBoundingClientRect();
    return (
      pointerX >= rect.left &&
      pointerX <= rect.right &&
      pointerY >= rect.top &&
      pointerY <= rect.bottom
    );
  };

  const handleWidgetDragMove = (
    widgetId: string,
    _nextX: number,
    _nextY: number,
    pointerX: number,
    pointerY: number,
  ) => {
    let nextSnap: SnapState = null;

    const panelEl = getDockPanelAtPoint(pointerX, pointerY);
    if (panelEl) {
      const targetWidgetId = panelEl.dataset.dockWidgetId;
      const intent = getPanelDropIntent(panelEl, pointerX, pointerY);
      if (targetWidgetId && intent) {
        nextSnap =
          intent.kind === "panel-split"
            ? {
                widgetId,
                kind: "panel-split",
                targetWidgetId,
                side: intent.side,
                rect: intent.rect,
              }
            : {
                widgetId,
                kind: "panel-tab",
                targetWidgetId,
                rect: intent.rect,
              };
      }
    }

    if (!nextSnap) {
      const edge = getEdgeFromPointer(pointerX, pointerY);
      nextSnap = edge ? { widgetId, kind: "workspace-edge", edge } : null;
    }

    snapRef.current = nextSnap;
    setSnapState(nextSnap);
  };

  const handleWidgetDragEnd = (
    widgetId: string,
    pointerX: number,
    pointerY: number,
    didDrag: boolean,
  ) => {
    if (!didDrag) {
      snapRef.current = null;
      setSnapState(null);
      return;
    }

    const snap = snapRef.current;
    if (snap && snap.widgetId === widgetId) {
      if (snap.kind === "panel-split") {
        dockIntoLeaf(widgetId, snap.targetWidgetId, snap.side);
      } else if (snap.kind === "panel-tab") {
        dockAsTab(widgetId, snap.targetWidgetId);
      } else {
        dockWidget(widgetId, snap.edge);
      }
    } else {
      const edge = getEdgeFromPointer(pointerX, pointerY);
      if (edge) {
        dockWidget(widgetId, edge);
      }
    }

    snapRef.current = null;
    setSnapState(null);
  };

  const handleDockDragMove = (movingId: string, pointerX: number, pointerY: number) => {
    let next: DockDragSnap = null;
    const panelEl = getDockPanelAtPoint(pointerX, pointerY);
    if (panelEl) {
      const targetId = panelEl.dataset.dockWidgetId;
      const intent = getPanelDropIntent(panelEl, pointerX, pointerY);
      if (targetId && targetId !== movingId && intent) {
        next =
          intent.kind === "panel-split"
            ? {
                kind: "panel-split",
                movingId,
                targetId,
                side: intent.side,
                rect: intent.rect,
              }
            : {
                kind: "panel-tab",
                movingId,
                targetId,
                rect: intent.rect,
              };
      }
    }
    dockDragRef.current = next;
    setDockDragSnap(next);
  };

  const handleDockDragEnd = (
    movingId: string,
    pointerX: number,
    pointerY: number,
    didDrag: boolean,
  ) => {
    if (!didDrag) {
      dockDragRef.current = null;
      setDockDragSnap(null);
      return;
    }

    const snap = dockDragRef.current;
    if (snap && snap.movingId === movingId) {
      if (snap.kind === "panel-split" && snap.side) {
        moveDockedWidget(movingId, snap.targetId, snap.side);
      } else if (snap.kind === "panel-tab") {
        dockAsTab(movingId, snap.targetId);
      }
    } else if (isOutsideDockRootWithMargin(pointerX, pointerY)) {
      undockWidgetAt(movingId, pointerX - 200, pointerY - 22);
    }

    dockDragRef.current = null;
    setDockDragSnap(null);
  };

  const getReorderIndexInLeaf = (leafId: string, pointerX: number) => {
    const tabs = Array.from(
      document.querySelectorAll(`[data-dock-leaf-id="${leafId}"]`),
    ) as HTMLElement[];
    if (tabs.length === 0) return 0;
    let index = tabs.length;
    for (let i = 0; i < tabs.length; i += 1) {
      const rect = tabs[i].getBoundingClientRect();
      if (pointerX < rect.left + rect.width / 2) {
        index = i;
        break;
      }
    }
    return index;
  };

  const resetTabDragRuntime = () => {
    tabDragRef.current = null;
    setDraggingTabId(null);
    setDragPassedThreshold(false);
    setPopoutIntent(false);
    setOverPopoutZone(false);
  };

  const handleDockTabDragStart = ({
    tabId,
    pointerX,
    pointerY,
    altKey,
  }: {
    leafId: string;
    tabId: string;
    pointerX: number;
    pointerY: number;
    altKey: boolean;
  }) => {
    setDraggingTabId(tabId);
    setDragPassedThreshold(true);
    setPopoutIntent(altKey);
    setOverPopoutZone(getIsOverPopoutZone(pointerX, pointerY));
  };

  const handleDockTabDragMove = ({
    leafId,
    tabId,
    pointerX,
    pointerY,
    altKey,
  }: {
    leafId: string;
    tabId: string;
    pointerX: number;
    pointerY: number;
    altKey: boolean;
  }) => {
    let next: TabDragSnap = null;
    setPopoutIntent(altKey);
    setOverPopoutZone(getIsOverPopoutZone(pointerX, pointerY));

    const topEl = document.elementFromPoint(pointerX, pointerY) as HTMLElement | null;
    const sameLeafTab = topEl?.closest(`[data-dock-leaf-id="${leafId}"]`);
    const sameLeafTabs = topEl?.closest(`[data-dock-tabs-leaf-id="${leafId}"]`);
    if (sameLeafTab || sameLeafTabs) {
      next = { kind: "reorder", leafId, tabId, toIndex: getReorderIndexInLeaf(leafId, pointerX) };
    } else {
      const panelEl = getDockPanelAtPoint(pointerX, pointerY);
      if (panelEl) {
        const targetId = panelEl.dataset.dockWidgetId;
        const intent = getPanelDropIntent(panelEl, pointerX, pointerY);
        if (targetId && intent) {
          next =
            intent.kind === "panel-split"
              ? { kind: "panel-split", leafId, tabId, targetId, side: intent.side }
              : { kind: "panel-tab", leafId, tabId, targetId };
        }
      }
    }

    tabDragRef.current = next;
  };

  const handleDockTabDragEnd = ({
    leafId,
    tabId,
    pointerX: _pointerX,
    pointerY: _pointerY,
    didDrag,
  }: {
    leafId: string;
    tabId: string;
    pointerX: number;
    pointerY: number;
    didDrag: boolean;
  }) => {
    if (!didDrag) {
      resetTabDragRuntime();
      return;
    }

    if (popoutIntent || overPopoutZone) {
      void popoutDockTab(tabId);
      resetTabDragRuntime();
      return;
    }

    const snap = tabDragRef.current;
    if (snap?.kind === "reorder" && snap.leafId === leafId && snap.tabId === tabId) {
      reorderDockTab(leafId, tabId, snap.toIndex);
    } else if (snap?.kind === "panel-tab" && snap.leafId === leafId && snap.tabId === tabId) {
      detachDockTab(leafId, tabId);
      dockAsTab(tabId, snap.targetId);
    } else if (snap?.kind === "panel-split" && snap.leafId === leafId && snap.tabId === tabId) {
      detachDockTab(leafId, tabId);
      moveDockedWidget(tabId, snap.targetId, snap.side);
    }

    resetTabDragRuntime();
  };

  const handleDockTabContextMenu = ({
    leafId,
    tabId,
    clientX,
    clientY,
  }: {
    leafId: string;
    tabId: string;
    clientX: number;
    clientY: number;
  }) => {
    setTabContextMenu({
      open: true,
      x: clientX,
      y: clientY,
      leafId,
      tabId,
    });
  };

  useEffect(() => {
    if (!draggingTabId || !dragPassedThreshold) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Alt") {
        setPopoutIntent(true);
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Alt") {
        setPopoutIntent(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [dragPassedThreshold, draggingTabId]);

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <main className="workspace-canvas" ref={canvasRef}>
          {dockTree.root ? (
            <section className="dock-root">
              <DockShell
                node={dockTree.root}
                widgetsById={widgetsById}
                onDockDragMove={handleDockDragMove}
                onDockDragEnd={handleDockDragEnd}
                onDockTabDragStart={handleDockTabDragStart}
                onDockTabDragMove={handleDockTabDragMove}
                onDockTabDragEnd={handleDockTabDragEnd}
                onDockTabContextMenu={handleDockTabContextMenu}
              />
            </section>
          ) : null}
          {floatingWidgets.map((widget) => (
            <WidgetShell
              key={widget.id}
              widget={widget}
              onDragMove={handleWidgetDragMove}
              onDragEnd={handleWidgetDragEnd}
            />
          ))}
          {snapState?.kind === "workspace-edge" ? (
            <section className="dock-overlay">
              <div
                className={`dock-zone dock-zone-left ${snapState.edge === "left" ? "active" : ""}`}
              />
              <div
                className={`dock-zone dock-zone-right ${snapState.edge === "right" ? "active" : ""}`}
              />
              <div
                className={`dock-zone dock-zone-top ${snapState.edge === "top" ? "active" : ""}`}
              />
              <div
                className={`dock-zone dock-zone-bottom ${snapState.edge === "bottom" ? "active" : ""}`}
              />
            </section>
          ) : null}
          {snapState?.kind === "panel-split" || snapState?.kind === "panel-tab" ? (
            <section
              className="panel-overlay"
              style={{
                left: snapState.rect.left,
                top: snapState.rect.top,
                width: snapState.rect.width,
                height: snapState.rect.height,
              }}
            >
              {snapState.kind === "panel-split" ? (
                <>
                  <div
                    className={`panel-zone panel-zone-left ${snapState.side === "left" ? "active" : ""}`}
                  />
                  <div
                    className={`panel-zone panel-zone-right ${snapState.side === "right" ? "active" : ""}`}
                  />
                  <div
                    className={`panel-zone panel-zone-top ${snapState.side === "top" ? "active" : ""}`}
                  />
                  <div
                    className={`panel-zone panel-zone-bottom ${snapState.side === "bottom" ? "active" : ""}`}
                  />
                </>
              ) : (
                <div className="panel-zone panel-zone-center active" />
              )}
            </section>
          ) : null}
          {dockDragSnap?.kind === "panel-split" || dockDragSnap?.kind === "panel-tab" ? (
            <section
              className="panel-overlay"
              style={{
                left: dockDragSnap.rect.left,
                top: dockDragSnap.rect.top,
                width: dockDragSnap.rect.width,
                height: dockDragSnap.rect.height,
              }}
            >
              {dockDragSnap.kind === "panel-split" ? (
                <>
                  <div
                    className={`panel-zone panel-zone-left ${dockDragSnap.side === "left" ? "active" : ""}`}
                  />
                  <div
                    className={`panel-zone panel-zone-right ${dockDragSnap.side === "right" ? "active" : ""}`}
                  />
                  <div
                    className={`panel-zone panel-zone-top ${dockDragSnap.side === "top" ? "active" : ""}`}
                  />
                  <div
                    className={`panel-zone panel-zone-bottom ${dockDragSnap.side === "bottom" ? "active" : ""}`}
                  />
                </>
              ) : (
                <div className="panel-zone panel-zone-center active" />
              )}
            </section>
          ) : null}
          {draggingTabId && dragPassedThreshold ? (
            <PopoutZone ref={popoutZoneRef} active={overPopoutZone} altActive={popoutIntent} />
          ) : null}
          <TabContextMenu
            open={tabContextMenu.open}
            x={tabContextMenu.x}
            y={tabContextMenu.y}
            onClose={() =>
              setTabContextMenu({
                open: false,
                x: 0,
                y: 0,
                leafId: null,
                tabId: null,
              })
            }
            onPopout={() => {
              if (!tabContextMenu.tabId) return;
              void popoutDockTab(tabContextMenu.tabId);
            }}
            onCloseTab={() => {
              if (!tabContextMenu.leafId || !tabContextMenu.tabId) return;
              closeDockTab(tabContextMenu.leafId, tabContextMenu.tabId);
            }}
          />
        </main>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="workspace-menu">
          <ContextMenu.Sub>
            <ContextMenu.SubTrigger className="workspace-menu-item">
              Adicionar modulo
            </ContextMenu.SubTrigger>
            <ContextMenu.Portal>
              <ContextMenu.SubContent className="workspace-menu">
                {moduleRegistry.map((module) => (
                  <ContextMenu.Item
                    key={module.id}
                    className="workspace-menu-item"
                    onSelect={() => addWidget(module.id)}
                  >
                    {module.title}
                  </ContextMenu.Item>
                ))}
              </ContextMenu.SubContent>
            </ContextMenu.Portal>
          </ContextMenu.Sub>
          <ContextMenu.Separator className="workspace-menu-separator" />
          <ContextMenu.Item className="workspace-menu-item" onSelect={resetLayout}>
            Reset layout
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
