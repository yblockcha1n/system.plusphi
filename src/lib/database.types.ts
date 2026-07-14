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

/** DB 側にデフォルト値があるため、Insert では name 以外を省略できる。 */
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
