import type { RegisteredModule } from "./types";
import { ChatModule } from "../../modules/ModuleChat/ChatModule";
import { FeedModule } from "../../modules/ModuleFeed/FeedModule";
import { MusicModule } from "../../modules/ModuleMusic/MusicModule";
import { NavModule } from "../../modules/ModuleNav/NavModule";
import { WelcomeModule } from "../../modules/welcome/WelcomeModule";

export const moduleRegistry: RegisteredModule[] = [
  {
    id: "chat",
    title: "Chat",
    component: ChatModule,
    dockConstraints: { minWidth: 400, height: "100%" },
    widgetConstraints: { minWidth: 400, minHeight: 600 },
  },
  {
    id: "feed",
    title: "Feed",
    component: FeedModule,
    dockConstraints: { minWidth: 400, height: "100%" },
    widgetConstraints: { minWidth: 400, minHeight: 600 },
  },
  {
    id: "music",
    title: "Music",
    component: MusicModule,
    dockConstraints: { minWidth: 400, height: "100%" },
    widgetConstraints: { minWidth: 400, minHeight: 600 },
  },
  {
    id: "nav",
    title: "Nav",
    component: NavModule,
    dockConstraints: { minWidth: 50, height: "100%" },
    widgetConstraints: { minWidth: 50, minHeight: 600 },
  },
  {
    id: "welcome",
    title: "Welcome",
    component: WelcomeModule,
    dockConstraints: { minWidth: 400, height: "100%" },
    widgetConstraints: { minWidth: 400, minHeight: 600 },
  },
];

export const moduleRegistryById = Object.fromEntries(
  moduleRegistry.map((module) => [module.id, module]),
);
