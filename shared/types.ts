export type ItemCategory = "weapon" | "tool" | "food" | "decoration" | "other";

export interface CustomItem {
  id: string;
  baseItem: string;
  baseItemName: string;
  renameTrigger: string;
  category: ItemCategory;
  iconBase64?: string;
  modelPath: string;
  texturePath: string;
}

export interface ProjectManifest {
  shareCode: string;
  name: string;
  packHash: string;
  packFormat: number;
  gameVersions: string[];
  customItems: CustomItem[];
}

export interface CreateProjectRequest { name: string }
export interface CreateProjectResponse {
  shareCode: string;
  editToken: string;
  manifest: ProjectManifest;
}
