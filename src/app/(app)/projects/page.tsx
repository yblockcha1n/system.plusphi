import type { Metadata } from "next";
import Link from "next/link";
import { getProjects } from "@/features/projects/queries";
import { PageHeader } from "@/components/shared/page-header";
import { ProjectBoard } from "@/components/projects/project-board";
import { ProjectToolbar } from "@/components/projects/project-toolbar";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "プロジェクト | plusphi",
};

export default async function ProjectsPage(props: PageProps<"/projects">) {
  const searchParams = await props.searchParams;
  const showArchived = first(searchParams.archived) === "1";

  const projects = await getProjects({ includeArchived: showArchived });
  const overdue = projects.reduce((sum, project) => sum + project.overdueCount, 0);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <PageHeader
        title="プロジェクト"
        description={
          overdue > 0
            ? `${projects.length} 件。締切を過ぎたタスクが ${overdue} 件あります。`
            : `${projects.length} 件。掴んで上下に動かすと並び順を変えられます。`
        }
        actions={<ProjectToolbar />}
      />

      <Link
        href={showArchived ? "/projects" : "/projects?archived=1"}
        className={cn(
          "w-fit border px-3 py-1 text-xs font-medium transition-colors",
          showArchived ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
        )}
      >
        完了したプロジェクトも表示
      </Link>

      <ProjectBoard projects={projects} />
    </div>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
