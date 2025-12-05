import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { Trash2, Pin, ChevronLeft, Plus } from "lucide-react";

type FamilyBoardPost = {
  id: number;
  connectionId: string;
  createdBy: number;
  title: string;
  body: string;
  pinned: boolean;
  tags: string[];
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type User = {
  id: number;
  name: string;
  role: string;
  connectionId: string;
};

export function FamilyBoard({ user, familyMembers, onClose }: { 
  user: User; 
  familyMembers: { id: number; name: string }[];
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const locale = i18n.language === "de" ? de : enUS;
  
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [tags, setTags] = useState("");

  const { data: posts = [], isLoading } = useQuery<FamilyBoardPost[]>({
    queryKey: ["/api/board", user.connectionId],
    queryFn: async () => {
      const res = await fetch(`/api/board/${user.connectionId}?peerId=${user.id}`);
      if (!res.ok) throw new Error("Failed to fetch posts");
      return res.json();
    },
    enabled: !!user.connectionId
  });

  const createPost = useMutation({
    mutationFn: async (data: { title: string; body: string; pinned: boolean; tags: string[] }) => {
      const res = await fetch("/api/board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: user.connectionId,
          createdBy: user.id,
          ...data
        })
      });
      if (!res.ok) throw new Error("Failed to create post");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/board"] });
      toast({ title: t("familyBoard.postCreated") });
      setTitle("");
      setBody("");
      setPinned(false);
      setTags("");
      setShowForm(false);
    }
  });

  const deletePost = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/board/${id}?peerId=${user.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete post");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/board"] });
      toast({ title: t("familyBoard.postDeleted") });
    }
  });

  const togglePin = useMutation({
    mutationFn: async ({ id, pinned }: { id: number; pinned: boolean }) => {
      const res = await fetch(`/api/board/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peerId: user.id, pinned })
      });
      if (!res.ok) throw new Error("Failed to update post");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/board"] });
    }
  });

  const getAuthorName = (createdBy: number) => {
    const member = familyMembers.find(m => m.id === createdBy);
    return member?.name || "Unknown";
  };

  const handleSubmit = () => {
    if (!title.trim() || !body.trim()) return;
    createPost.mutate({
      title: title.trim(),
      body: body.trim(),
      pinned,
      tags: tags.split(",").map(t => t.trim()).filter(Boolean)
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onClose} className="gap-2" data-testid="button-back-board">
            <ChevronLeft className="h-4 w-4" />
            {t("common.back")}
          </Button>
          <Button onClick={() => setShowForm(!showForm)} className="gap-2" data-testid="button-new-post">
            <Plus className="h-4 w-4" />
            {t("familyBoard.newPost")}
          </Button>
        </div>
        <h1 className="text-2xl font-bold text-center">{t("familyBoard.title")}</h1>
      </div>

      {showForm && (
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
          <CardHeader>
            <CardTitle>{t("familyBoard.newPost")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>{t("familyBoard.titleLabel")}</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("familyBoard.titlePlaceholder")}
                data-testid="input-post-title"
              />
            </div>
            <div>
              <Label>{t("familyBoard.bodyLabel")}</Label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t("familyBoard.bodyPlaceholder")}
                className="w-full min-h-[100px] p-3 rounded-md border bg-background"
                data-testid="input-post-body"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={pinned} onCheckedChange={setPinned} data-testid="switch-pin-post" />
              <Label>{t("familyBoard.pinPost")}</Label>
            </div>
            <div>
              <Label>{t("familyBoard.tagsLabel")}</Label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder={t("familyBoard.tagsPlaceholder")}
                data-testid="input-post-tags"
              />
            </div>
            <Button 
              onClick={handleSubmit} 
              disabled={!title.trim() || !body.trim() || createPost.isPending}
              className="w-full"
              data-testid="button-create-post"
            >
              {t("familyBoard.createPost")}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : posts.length === 0 ? (
        <Card className="py-12 text-center text-muted-foreground">
          <p>{t("familyBoard.empty")}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Card 
              key={post.id} 
              className={`${post.pinned ? "border-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20" : ""}`}
              data-testid={`card-post-${post.id}`}
            >
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {post.pinned && (
                        <span className="text-yellow-600 text-sm font-medium">{t("familyBoard.pinned")}</span>
                      )}
                      <h3 className="font-semibold text-lg">{post.title}</h3>
                    </div>
                    <p className="text-muted-foreground whitespace-pre-wrap mb-3">{post.body}</p>
                    {post.tags && post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {post.tags.map((tag, i) => (
                          <span key={i} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {t("familyBoard.postedBy", { name: getAuthorName(post.createdBy) })} • {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale })}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    {user.role === "parent" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => togglePin.mutate({ id: post.id, pinned: !post.pinned })}
                          data-testid={`button-pin-${post.id}`}
                        >
                          <Pin className={`h-4 w-4 ${post.pinned ? "text-yellow-500 fill-yellow-500" : ""}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deletePost.mutate(post.id)}
                          className="text-red-500 hover:text-red-600"
                          data-testid={`button-delete-post-${post.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
