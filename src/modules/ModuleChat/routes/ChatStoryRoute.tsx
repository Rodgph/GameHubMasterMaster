import { useEffect, useMemo, useState } from "react";
import { FaPause, FaPlay } from "react-icons/fa";
import { FiTrash2 } from "react-icons/fi";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ContextMenuBase, type ContextMenuBaseItem } from "../../../components/ContextMenuBase/ContextMenuBase";
import { getSupabaseClient } from "../../../core/services/supabase";
import { useSessionStore } from "../../../core/stores/sessionStore";
import { BaseIconButton } from "../../../shared/ui";
import { StoryCreateHeader, StoryReplyFooter } from "../components";
import { ConversationHeader } from "./conversation/components";
import {
  createStoryMedia,
  createStoryText,
  deleteStory,
  getStoryMediaUrl,
  listActiveStoriesForUser,
  type ChatStory,
} from "../data/stories.repository";

type StoryProfile = {
  username: string;
  avatar_url?: string | null;
};

type StoryCreateMode = "text" | "music" | "layout" | "voice";
const STORY_DURATION_MS = 5000;

export function ChatStoryRoute() {
  const { userId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const currentUserId = useSessionStore((state) => state.user?.id ?? null);
  const [profile, setProfile] = useState<StoryProfile | null>(null);
  const [stories, setStories] = useState<ChatStory[]>([]);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [activeStoryMediaUrl, setActiveStoryMediaUrl] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState<StoryCreateMode>("text");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [selectedFilePreviewUrl, setSelectedFilePreviewUrl] = useState("");
  const [storyText, setStoryText] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [storyReply, setStoryReply] = useState("");
  const [storyPaused, setStoryPaused] = useState(false);
  const [storyProgress, setStoryProgress] = useState(0);
  const [contextOpen, setContextOpen] = useState(false);
  const [contextX, setContextX] = useState(0);
  const [contextY, setContextY] = useState(0);
  const isCreateMode = userId === "create" || location.pathname.endsWith("/chat/story/create");
  const isAuthorView = Boolean(currentUserId && userId && currentUserId === userId);
  const activeStory = stories[activeStoryIndex] ?? null;

  const canPublish = useMemo(
    () => Boolean(storyText.trim() || selectedFileName),
    [selectedFileName, storyText],
  );

  useEffect(() => {
    if (!userId || isCreateMode) return;
    let active = true;
    const run = async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("chat_profiles")
        .select("username, avatar_url")
        .eq("id", userId)
        .single();
      if (!active) return;
      setProfile((data ?? null) as StoryProfile | null);

      try {
        const list = await listActiveStoriesForUser(userId);
        if (!active) return;
        setStories(list);
        setActiveStoryIndex(0);
        setStoryProgress(0);
      } catch {
        if (!active) return;
        setStories([]);
        setActiveStoryIndex(0);
        setStoryProgress(0);
        setActiveStoryMediaUrl(null);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [isCreateMode, userId]);

  useEffect(() => {
    if (isCreateMode || stories.length === 0) {
      setActiveStoryMediaUrl(null);
      return;
    }
    if (!activeStory?.media_path) {
      setActiveStoryMediaUrl(null);
      return;
    }
    let active = true;
    const run = async () => {
      try {
        const url = await getStoryMediaUrl(activeStory.media_path as string);
        if (!active) return;
        setActiveStoryMediaUrl(url);
      } catch {
        if (!active) return;
        setActiveStoryMediaUrl(null);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [activeStory, activeStoryIndex, isCreateMode, stories]);

  useEffect(() => {
    if (isCreateMode || storyPaused || stories.length === 0) return;
    let rafId = 0;
    let lastTick = performance.now();

    const tick = (now: number) => {
      const elapsed = now - lastTick;
      lastTick = now;
      setStoryProgress((prev) => {
        const nextProgress = prev + elapsed / STORY_DURATION_MS;
        if (nextProgress < 1) return nextProgress;
        setActiveStoryIndex((prevIndex) => {
          const nextIndex = prevIndex + 1;
          if (nextIndex >= stories.length) {
            navigate("/chat");
            return prevIndex;
          }
          return nextIndex;
        });
        return 0;
      });
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [activeStoryIndex, isCreateMode, navigate, stories.length, storyPaused]);

  useEffect(() => {
    setStoryProgress(0);
  }, [activeStoryIndex]);

  useEffect(() => {
    if (!contextOpen) return;
    const close = () => setContextOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [contextOpen]);

  useEffect(() => {
    return () => {
      if (selectedFilePreviewUrl) URL.revokeObjectURL(selectedFilePreviewUrl);
    };
  }, [selectedFilePreviewUrl]);

  if (isCreateMode) {
    return (
      <div className="chat-create-story-route" data-no-drag="true">
        <div className="chat-create-story-header-fixed" data-no-drag="true">
          <StoryCreateHeader
            selectedMode={createMode}
            onSelectMode={setCreateMode}
            storyText={storyText}
            onStoryTextChange={setStoryText}
            onUploadClick={() => {
              const uploadInput = document.getElementById("story-upload-input") as HTMLInputElement | null;
              uploadInput?.click();
            }}
            onPublish={async () => {
              if (!currentUserId || !canPublish || isPublishing) return;
              setIsPublishing(true);
              try {
                if (selectedFile) {
                  await createStoryMedia({
                    userId: currentUserId,
                    file: selectedFile,
                    optionalText: storyText,
                  });
                } else {
                  await createStoryText({
                    userId: currentUserId,
                    text: storyText,
                  });
                }
                setStoryText("");
                setSelectedFile(null);
                setSelectedFileName("");
                if (selectedFilePreviewUrl) {
                  URL.revokeObjectURL(selectedFilePreviewUrl);
                  setSelectedFilePreviewUrl("");
                }
              } catch (error) {
                console.error(error);
              } finally {
                setIsPublishing(false);
              }
            }}
            canPublish={canPublish && !isPublishing}
          />
        </div>
        <section data-no-drag="true">
          <p className="chat-create-story-subtitle">
            {selectedFileName
              ? `Arquivo selecionado: ${selectedFileName}`
              : "Envie foto, video ou gif para comecar."}
          </p>
          <input id="story-upload-input" className="chat-create-story-upload-input" type="file" accept="image/*,video/*,.gif"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (selectedFilePreviewUrl) URL.revokeObjectURL(selectedFilePreviewUrl);
              setSelectedFile(file ?? null);
              setSelectedFileName(file?.name ?? "");
              setSelectedFilePreviewUrl(file ? URL.createObjectURL(file) : "");
            }}
          />
          {selectedFilePreviewUrl ? (
            <div className="chat-create-story-preview-wrap" data-no-drag="true">
              <img
                src={selectedFilePreviewUrl}
                alt="Preview"
                className="chat-create-story-preview-image"
              />
            </div>
          ) : null}
        </section>
      </div>
    );
  }

  const contextItems: ContextMenuBaseItem[] = [
    {
      id: "delete-story",
      label: "Apagar story",
      icon: <FiTrash2 size={16} />,
      onClick: async () => {
        if (!activeStory) return;
        try {
          await deleteStory({
            storyId: activeStory.id,
            mediaPath: activeStory.media_path,
          });
          setStories((prev) => {
            const next = prev.filter((item) => item.id !== activeStory.id);
            if (next.length === 0) {
              navigate("/chat");
              return next;
            }
            if (activeStoryIndex >= next.length) {
              setActiveStoryIndex(next.length - 1);
            }
            return next;
          });
        } catch (error) {
          console.error(error);
        }
      },
    },
  ];

  return (
    <div className="chat-story-route" data-no-drag="true">
      <div className="chat-story-header" data-no-drag="true">
        <ConversationHeader
          storyCount={Math.max(1, stories.length)}
          activeStoryIndex={activeStoryIndex}
          activeStoryProgress={storyProgress}
        />
        <div className="chat-story-header-actions" data-no-drag="true">
          <BaseIconButton
            aria-label={storyPaused ? "Reproduzir story" : "Pausar story"}
            onClick={() => setStoryPaused((prev) => !prev)}
          >
            {storyPaused ? <FaPlay size={12} /> : <FaPause size={12} />}
          </BaseIconButton>
        </div>
      </div>
      <div className="chat-story-content" data-no-drag="true">
        <div
          className="chat-story-image-wrap"
          data-no-drag="true"
          onContextMenu={(event) => {
            if (!isAuthorView || !activeStory) return;
            event.preventDefault();
            event.stopPropagation();
            setContextX(event.clientX);
            setContextY(event.clientY);
            setContextOpen(true);
          }}
        >
          {activeStoryMediaUrl || profile?.avatar_url ? (
            <img
              src={activeStoryMediaUrl || profile?.avatar_url || ""}
              alt={activeStory?.text || profile?.username || "Story"}
              className="chat-story-image"
            />
          ) : null}
        </div>
      </div>
      <div className="chat-story-footer-fixed" data-no-drag="true">
        <StoryReplyFooter
          value={storyReply}
          onChange={setStoryReply}
          onOpenEmoji={() => {}}
          onRecordVoice={() => {}}
        />
      </div>
      <ContextMenuBase
        open={contextOpen && isAuthorView}
        anchorPoint={{ x: contextX, y: contextY }}
        onClose={() => setContextOpen(false)}
        items={contextItems}
      />
    </div>
  );
}
