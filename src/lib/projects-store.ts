// Simple localStorage-backed projects store
export interface Project {
  id: string;
  name: string;
  description: string;
  template: string;
  html: string;
  createdAt: number;
}

const KEY = "website-designer-projects";

export function listProjects(): Project[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveProject(p: Project): void {
  const all = listProjects().filter((x) => x.id !== p.id);
  all.unshift(p);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function deleteProject(id: string): void {
  localStorage.setItem(KEY, JSON.stringify(listProjects().filter((p) => p.id !== id)));
}

export function getProject(id: string): Project | undefined {
  return listProjects().find((p) => p.id === id);
}
