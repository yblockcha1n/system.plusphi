export type SectionRow = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CredentialRow = {
  id: string;
  section_id: string | null;
  name: string;
  username: string | null;
  password_ciphertext: string | null;
  url: string | null;
  notes_ciphertext: string | null;
  /** 登録者のメールアドレス。表示名は ADMIN_USERS から引く。 */
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  /** カレンダー上の識別色のキー。実体は features/projects/schema.ts が持つ。 */
  color: string;
  sort_order: number;
  /** null = 進行中。値が入っていれば完了（アーカイブ済み）。 */
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskRow = {
  id: string;
  project_id: string | null;
  title: string;
  detail: string | null;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  deadline_at: string | null;
  /** 担当者のメールアドレス。表示名は ADMIN_USERS から引く。 */
  assignee: string | null;
  /** 検収者のメールアドレス。 */
  reviewer: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type EventRow = {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** クレデンシャルの平文を復号した記録。0004 のマイグレーションで追加。 */
export type CredentialAccessLogRow = {
  id: string;
  /** 参照先が削除されると null になる（記録自体は残す）。 */
  credential_id: string | null;
  credential_name: string;
  /** 閲覧した利用者のメールアドレス。 */
  actor: string;
  field: "password" | "notes";
  created_at: string;
};

/** Web Push の購読。1 行 = 利用者 × 端末。0005 のマイグレーションで追加。 */
export type PushSubscriptionRow = {
  id: string;
  /** 購読した利用者のメールアドレス。 */
  actor: string;
  /** ブラウザが払い出す一意な宛先。 */
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
};

/** 定期通知の二重送信を防ぐための記録。0005 のマイグレーションで追加。 */
export type NotificationDeliveryRow = {
  id: string;
  kind: string;
  /** 宛先の利用者のメールアドレス。 */
  actor: string;
  dedupe_key: string;
  created_at: string;
};

/** DB 側にデフォルト値があるため、Insert では必須列以外を省略できる。 */
type Insertable<Row, Required extends keyof Row> = Pick<Row, Required> &
  Partial<Omit<Row, Required>>;

export type Database = {
  public: {
    Tables: {
      sections: {
        Row: SectionRow;
        Insert: Insertable<SectionRow, "name">;
        Update: Partial<SectionRow>;
        Relationships: [];
      };
      credentials: {
        Row: CredentialRow;
        Insert: Insertable<CredentialRow, "name">;
        Update: Partial<CredentialRow>;
        Relationships: [
          {
            foreignKeyName: "credentials_section_id_fkey";
            columns: ["section_id"];
            isOneToOne: false;
            referencedRelation: "sections";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: ProjectRow;
        Insert: Insertable<ProjectRow, "name">;
        Update: Partial<ProjectRow>;
        Relationships: [];
      };
      tasks: {
        Row: TaskRow;
        Insert: Insertable<TaskRow, "title">;
        Update: Partial<TaskRow>;
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: EventRow;
        Insert: Insertable<EventRow, "title" | "starts_at" | "ends_at">;
        Update: Partial<EventRow>;
        Relationships: [
          {
            foreignKeyName: "events_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      credential_access_log: {
        Row: CredentialAccessLogRow;
        Insert: Insertable<CredentialAccessLogRow, "credential_name" | "actor" | "field">;
        Update: Partial<CredentialAccessLogRow>;
        Relationships: [
          {
            foreignKeyName: "credential_access_log_credential_id_fkey";
            columns: ["credential_id"];
            isOneToOne: false;
            referencedRelation: "credentials";
            referencedColumns: ["id"];
          },
        ];
      };
      push_subscriptions: {
        Row: PushSubscriptionRow;
        Insert: Insertable<PushSubscriptionRow, "actor" | "endpoint" | "p256dh" | "auth">;
        Update: Partial<PushSubscriptionRow>;
        Relationships: [];
      };
      notification_deliveries: {
        Row: NotificationDeliveryRow;
        Insert: Insertable<NotificationDeliveryRow, "kind" | "actor" | "dedupe_key">;
        Update: Partial<NotificationDeliveryRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      /** 渡された id の順に sort_order を振り直す。1 本の UPDATE なので原子的。 */
      reorder_records: {
        Args: { p_table: string; p_ids: string[] };
        Returns: undefined;
      };
      /** プロジェクトごとのタスク件数（全体 / 完了 / 締切超過）。 */
      project_task_stats: {
        Args: Record<string, never>;
        Returns: {
          project_id: string;
          total: number;
          done: number;
          overdue: number;
        }[];
      };
      /** 30 日より古い送信記録を捨てる。Supabase Cron から 1 日 1 回呼ぶ。 */
      purge_notification_deliveries: {
        Args: Record<string, never>;
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
