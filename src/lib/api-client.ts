import type { ActionState } from "@/lib/form";

export type ApiResult<T = undefined> = ActionState & { data?: T };

/**
 * Route Handler を叩く共通処理。
 *
 * 例外は投げず、必ず ActionState を返す。呼び出し側（フォーム / ダイアログ）が
 * Server Actions のときと同じ形で結果を扱えるようにするため。
 */
async function request<T = undefined>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown
): Promise<ApiResult<T>> {
  let response: Response;

  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      // Cookie は same-origin なら既定で載るが、意図を明示しておく
      credentials: "same-origin",
    });
  } catch {
    return { status: "error", message: "通信に失敗しました。接続を確認してください。" };
  }

  const payload = await response.json().catch(() => null);

  // サーバーが返した ActionState をそのまま通す
  if (payload && typeof payload === "object" && "status" in payload) {
    return payload as ApiResult<T>;
  }

  return { status: "error", message: `通信に失敗しました（HTTP ${response.status}）。` };
}

type Values = Record<string, unknown>;

/** 画面から呼ぶ API。パスとメソッドの知識はここだけに閉じ込める。 */
export const api = {
  login: (values: Values) => request("/api/auth/login", "POST", values),
  logout: () => request("/api/auth/logout", "POST"),

  createSection: (values: Values) => request("/api/sections", "POST", values),
  updateSection: (id: string, values: Values) => request(`/api/sections/${id}`, "PATCH", values),
  deleteSection: (id: string) => request(`/api/sections/${id}`, "DELETE"),
  reorderSections: (ids: string[]) => request("/api/sections/reorder", "POST", { ids }),

  createCredential: (values: Values) => request("/api/credentials", "POST", values),
  updateCredential: (id: string, values: Values) =>
    request(`/api/credentials/${id}`, "PATCH", values),
  deleteCredential: (id: string) => request(`/api/credentials/${id}`, "DELETE"),
  revealSecret: (id: string, field: "password" | "notes") =>
    request<{ value: string }>(`/api/credentials/${id}/reveal`, "POST", { field }),

  createProject: (values: Values) => request("/api/projects", "POST", values),
  updateProject: (id: string, values: Values) => request(`/api/projects/${id}`, "PATCH", values),
  deleteProject: (id: string) => request(`/api/projects/${id}`, "DELETE"),
  reorderProjects: (ids: string[]) => request("/api/projects/reorder", "POST", { ids }),
  setProjectArchived: (id: string, archived: boolean) =>
    request(`/api/projects/${id}/archive`, "POST", { archived }),

  updateReleaseNote: (id: string, values: Values) =>
    request(`/api/release-notes/${id}`, "PATCH", values),
  publishReleaseNote: (id: string) => request(`/api/release-notes/${id}/publish`, "POST"),
  deleteReleaseNote: (id: string) => request(`/api/release-notes/${id}`, "DELETE"),

  createInspiration: (values: Values) => request("/api/inspirations", "POST", values),
  updateInspiration: (id: string, values: Values) =>
    request(`/api/inspirations/${id}`, "PATCH", values),
  deleteInspiration: (id: string) => request(`/api/inspirations/${id}`, "DELETE"),
  /** サムネ・タイトル・投稿者を取り直す。 */
  refreshInspiration: (id: string) => request(`/api/inspirations/${id}/refresh`, "POST"),

  createInspirationTag: (values: Values) => request("/api/inspiration-tags", "POST", values),
  updateInspirationTag: (id: string, values: Values) =>
    request(`/api/inspiration-tags/${id}`, "PATCH", values),
  deleteInspirationTag: (id: string) => request(`/api/inspiration-tags/${id}`, "DELETE"),
  reorderInspirationTags: (ids: string[]) =>
    request("/api/inspiration-tags/reorder", "POST", { ids }),
  setInspirationTagArchived: (id: string, archived: boolean) =>
    request(`/api/inspiration-tags/${id}/archive`, "POST", { archived }),

  createTaskType: (values: Values) => request("/api/task-types", "POST", values),
  updateTaskType: (id: string, values: Values) =>
    request(`/api/task-types/${id}`, "PATCH", values),
  deleteTaskType: (id: string) => request(`/api/task-types/${id}`, "DELETE"),
  reorderTaskTypes: (ids: string[]) => request("/api/task-types/reorder", "POST", { ids }),
  setTaskTypeArchived: (id: string, archived: boolean) =>
    request(`/api/task-types/${id}/archive`, "POST", { archived }),

  createTask: (values: Values) => request("/api/tasks", "POST", values),
  updateTask: (id: string, values: Values) => request(`/api/tasks/${id}`, "PATCH", values),
  deleteTask: (id: string) => request(`/api/tasks/${id}`, "DELETE"),
  reorderTasks: (ids: string[]) => request("/api/tasks/reorder", "POST", { ids }),
  updateTaskStatus: (id: string, status: string) =>
    request(`/api/tasks/${id}/status`, "POST", { status }),

  subscribePush: (subscription: unknown) =>
    request("/api/push/subscribe", "POST", { subscription }),
  unsubscribePush: (endpoint: string) =>
    request("/api/push/subscribe", "DELETE", { endpoint }),
  sendTestPush: () => request("/api/push/test", "POST"),

  createEvent: (values: Values) => request("/api/events", "POST", values),
  updateEvent: (id: string, values: Values) => request(`/api/events/${id}`, "PATCH", values),
  deleteEvent: (id: string) => request(`/api/events/${id}`, "DELETE"),
  /** 繰り返しの予定から「この回だけ」を除外する。 */
  skipEventOccurrence: (id: string, occurrenceDate: string) =>
    request(`/api/events/${id}/skip`, "POST", { occurrenceDate }),
};

/**
 * 保存対象が新規か編集かで呼び分ける。
 * フォームの hidden な id の有無で判断するのは全画面共通なのでここにまとめる。
 */
export function upsert(
  values: Values,
  create: (values: Values) => Promise<ApiResult>,
  update: (id: string, values: Values) => Promise<ApiResult>
): Promise<ApiResult> {
  const id = typeof values.id === "string" ? values.id : "";
  return id ? update(id, values) : create(values);
}
